import OpenAI from "openai";
import { TARGET_LANGUAGE_LABELS, normalizeTargetLang } from "@/lib/languages";

const gemini = new OpenAI({
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  apiKey: process.env.GEMINI_API_KEY || "",
});

const MODEL = "gemini-2.5-flash";

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

// ── Image → Structured extraction ──────────────────────────────────

export async function analyzeMenuImage(base64Image: string, _rich?: boolean, mimeType = "image/jpeg", targetLang = "zh"): Promise<MenuImageAnalysis> {
  const normalizedTargetLang = normalizeTargetLang(targetLang);
  const targetLabel = TARGET_LANGUAGE_LABELS[normalizedTargetLang].prompt;
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

Important: Alcohol used in cooking is not a beverage category. Examples such as 啤酒鸭, 红酒炖牛肉, 花雕焗蟹, 绍兴酒蒸鱼, and 紫苏辣酒煮花螺 are food dishes; describe the solid ingredient and cooking method, not a drink.

Output format:
{
  "dishes": [...],
  "page_label": "主菜",
  "source_language": "fr"
}

TARGET LANGUAGE: ${targetLabel}. All translated fields, including name_translated, description, and page_label, MUST be written in ${targetLabel}. Preserve name_original exactly as seen on the menu.`;

  const response = await gemini.chat.completions.create({
    model: MODEL,
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

// ── Translation refinement ─────────────────────────────────────────

export async function refineTranslation(dish: {
  name_original: string;
  name_translated: string;
  description: string;
  source_language: string;
}, targetLang = "zh"): Promise<{
  name_translated: string;
  description: string;
}> {
  const targetLabel = TARGET_LANGUAGE_LABELS[normalizeTargetLang(targetLang)].prompt;
  const response = await gemini.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: `You are a bilingual food editor. Refine this dish translation to sound natural and appetizing in ${targetLabel}. Keep the translation accurate but culturally adapted.

Source language: ${dish.source_language}
Target language: ${targetLabel}
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

// ── Review summarization ───────────────────────────────────────────

export async function summarizeReviews(
  dishName: string,
  reviews: Array<{ rating: number; content: string }>
): Promise<{
  summary: string;
  praised: string[];
  criticized: string[];
  bestFor: string;
}> {
  const response = await gemini.chat.completions.create({
    model: MODEL,
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

// ── Content moderation ─────────────────────────────────────────────

export async function moderateReview(
  text: string
): Promise<{ safe: boolean; reason?: string }> {
  const response = await gemini.chat.completions.create({
    model: MODEL,
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
