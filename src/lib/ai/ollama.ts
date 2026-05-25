import OpenAI from "openai";

// Ollama provides an OpenAI-compatible API at /v1
const ollama = new OpenAI({
  baseURL: `${process.env.OLLAMA_BASE_URL}/v1`,
  apiKey: "ollama", // Ollama doesn't require a key but the SDK needs one
});

const VISION_MODEL = process.env.OLLAMA_VISION_MODEL || "minicpm-v:8b";
const TEXT_MODEL = process.env.OLLAMA_TEXT_MODEL || "qwen2.5:32b";

interface MenuImageAnalysis {
  dishes: Array<{
    name_original: string;
    name_translated: string;
    description: string;
    ingredients: string[];
    allergens: string[];
    taste_profile: string[];
    confidence: number;
  }>;
  page_label: string;
  source_language: string;
}

// ── Image → Structured extraction (vision model) ──────────────────

export async function analyzeMenuImage(base64Image: string, _rich?: boolean, mimeType = "image/jpeg"): Promise<MenuImageAnalysis> {
  const systemPrompt = `You are a professional menu translator for restaurants.
Analyze the menu photo and output ONLY valid JSON. No markdown, no explanation.

For each dish, return:
- name_original: exact text from the menu
- name_translated: culturally-adapted Chinese translation (NOT literal word-for-word)
- description: 1-sentence Chinese description of what the dish is
- ingredients: list of main ingredients
- allergens: from [egg, dairy, peanut, tree_nut, soy, wheat, fish, shellfish, alcohol]
- taste_profile: from [spicy, sweet, sour, salty, umami, bitter, fresh, rich]
- confidence: 0.0-1.0

Also detect:
- page_label: what section of the menu (e.g. "前菜", "主菜", "酒单", "甜点", "饮品", "混合")
- source_language: ISO 639-1 code (fr, ja, it, es, de, ko, th, etc.)

For dish names with cultural context, translate the MEANING:
- "佛跳墙" → "Braised Treasures in Broth" not "Buddha Jumps Over Wall"
- "Boeuf Bourguignon" → "勃艮第红酒炖牛肉" not "勃艮第牛肉"

Output format:
{
  "dishes": [...],
  "page_label": "主菜",
  "source_language": "fr"
}`;

  const response = await ollama.chat.completions.create({
    model: VISION_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${base64Image}` },
          },
          { type: "text", text: "Extract all dishes from this menu photo." },
        ],
      },
    ],
    max_tokens: 4096,
    temperature: 0.1,
  });

  const text = response.choices[0]?.message?.content || "";
  return parseAIJson<MenuImageAnalysis>(text);
}

// ── Translation refinement (Qwen text model) ──────────────────────

export async function refineTranslation(dish: {
  name_original: string;
  name_translated: string;
  description: string;
  source_language: string;
}): Promise<{
  name_translated: string;
  description: string;
}> {
  const response = await ollama.chat.completions.create({
    model: TEXT_MODEL,
    messages: [
      {
        role: "system",
        content: `You are a bilingual food editor. Refine the Chinese translation of this dish to sound natural and appetizing. Keep the translation accurate but culturally adapted. Read your translation aloud — if it doesn't sound like something you'd read in a food magazine, rewrite it.

Source language: ${dish.source_language}
Return ONLY JSON: { "name_translated": "...", "description": "..." }`,
      },
      {
        role: "user",
        content: `Original: ${dish.name_original}\nDraft translation: ${dish.name_translated}\nDraft description: ${dish.description}`,
      },
    ],
    max_tokens: 512,
    temperature: 0.3,
  });

  const text = response.choices[0]?.message?.content || "";
  return parseAIJson<{ name_translated: string; description: string }>(text);
}

// ── Review summarization ──────────────────────────────────────────

export async function summarizeReviews(
  dishName: string,
  reviews: Array<{ rating: number; content: string }>
): Promise<{
  summary: string;
  praised: string[];
  criticized: string[];
  bestFor: string;
}> {
  const response = await ollama.chat.completions.create({
    model: TEXT_MODEL,
    messages: [
      {
        role: "system",
        content: `You are a food critic. Summarize these reviews into:
- summary: one sentence overall impression (max 30 chars Chinese)
- praised: top 3 praised aspects (3 words each)
- criticized: top 3 criticized aspects (3 words each)
- bestFor: a tag like "date night" / "comfort food" / "adventurous"

Return ONLY JSON.`,
      },
      {
        role: "user",
        content: `Dish: ${dishName}\nReviews:\n${reviews
          .map((r) => `[${r.rating}★] ${r.content}`)
          .join("\n")}`,
      },
    ],
    max_tokens: 512,
    temperature: 0.3,
  });

  const text = response.choices[0]?.message?.content || "";
  return parseAIJson<{
    summary: string;
    praised: string[];
    criticized: string[];
    bestFor: string;
  }>(text);
}

// ── Content moderation ────────────────────────────────────────────

export async function moderateReview(
  text: string
): Promise<{ safe: boolean; reason?: string }> {
  const response = await ollama.chat.completions.create({
    model: TEXT_MODEL,
    messages: [
      {
        role: "system",
        content:
          'Is this restaurant review appropriate? Check for: spam, ads, hate speech, personal attacks, NSFW. Return JSON: { "safe": true/false, "reason": "..." }. If safe, omit reason.',
      },
      { role: "user", content: text },
    ],
    max_tokens: 128,
    temperature: 0,
  });

  const text2 = response.choices[0]?.message?.content || "";
  return parseAIJson<{ safe: boolean; reason?: string }>(text2);
}

// ── Helpers ────────────────────────────────────────────────────────

function parseAIJson<T>(text: string): T {
  // Remove markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  }
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error(`AI JSON parse failed: ${cleaned.slice(0, 300)}`);
  }
}
