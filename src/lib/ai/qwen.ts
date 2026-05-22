import OpenAI from "openai";

const API_TIMEOUT = 45_000; // 45s timeout for vision calls

const qwen = new OpenAI({
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  apiKey: process.env.QWEN_API_KEY || "",
  timeout: API_TIMEOUT,
});

const VL_MODEL = "qwen-vl-max";
const TEXT_MODEL = "qwen-plus";

interface MenuDishAnalysis {
  name_original: string;
  name_translated: string;
  description: string;
  ingredients: string[];
  allergens: string[];
  taste_profile: string[];
  confidence: number;
  _needsRetranslate?: boolean;
}

interface MenuImageAnalysis {
  dishes: MenuDishAnalysis[];
  page_label: string;
  source_language: string;
}

// ── Helpers ────────────────────────────────────────────────────────

/** Returns true if text contains at least one Chinese character */
export function hasChinese(text: string): boolean {
  return /[一-鿿]/.test(text);
}

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

// ── Image → Structured extraction ──────────────────────────────────

const VL_SYSTEM_PROMPT = `You are a professional menu translator. Your PRIMARY job is to translate ALL dish names and descriptions into CHINESE (中文).

CRITICAL RULES:
1. name_original: copy the EXACT original text from the menu photo (can be any language)
2. name_translated: MUST be in CHINESE characters (中文). NEVER output English, French, or any Latin script here. This is the most important rule.
3. description: MUST be in CHINESE (中文). One sentence describing what the dish is.
4. ingredients: list of main ingredients, in Chinese if possible
5. allergens: from [egg, dairy, peanut, tree_nut, soy, wheat, fish, shellfish, alcohol]
6. taste_profile: from [spicy, sweet, sour, salty, umami, bitter, fresh, rich]
7. confidence: 0.0-1.0

Also detect:
- page_label: menu section in Chinese (e.g. "前菜", "主菜", "酒单", "甜点", "饮品", "混合")
- source_language: ISO 639-1 code (fr, ja, it, es, de, ko, th, en, etc.)

CORRECT OUTPUT EXAMPLES:
- "Salmon Rillettes" → name_translated: "三文鱼酱配烤面包"
- "Boeuf Bourguignon" → name_translated: "勃艮第红酒炖牛肉"
- "Sole Meunière" → name_translated: "法式香煎比目鱼"
- "Pâtes Carbonara" → name_translated: "培根蛋酱意面"
- "Duck Confit" → name_translated: "法式油封鸭"

IMPORTANT: Even if the photo is blurry, poorly lit, or partially obscured, do your best to extract any visible dishes. Return an empty dishes array ONLY if there is genuinely nothing resembling a menu in the image.

Output ONLY valid JSON. No markdown, no explanation.
{
  "dishes": [...],
  "page_label": "主菜",
  "source_language": "fr"
}`;

export async function analyzeMenuImage(base64Image: string): Promise<MenuImageAnalysis> {
  let lastError: Error | null = null;
  const MAX_RETRIES = 2;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await qwen.chat.completions.create({
        model: VL_MODEL,
        messages: [
          { role: "system", content: VL_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${base64Image}` },
              },
              { type: "text", text: "Extract all dishes from this menu photo. Remember: ALL translations must be in Chinese (中文)." },
            ],
          },
        ],
        max_tokens: 2048,
        temperature: 0.1,
      });

      const text = response.choices[0]?.message?.content || "";

      if (!text || text.trim().length < 10) {
        throw new Error("AI returned empty or too-short response");
      }

      const result = parseAIJson<MenuImageAnalysis>(text);

      if (!result.dishes || !Array.isArray(result.dishes)) {
        throw new Error("AI response missing dishes array");
      }

      if (result.dishes.length === 0 && attempt < MAX_RETRIES - 1) {
        // Empty dishes — might be a model hiccup, retry
        lastError = new Error("AI found no dishes in the image");
        continue;
      }

      // Post-validate: if name_translated has no Chinese, mark for re-translation
      for (const dish of result.dishes) {
        if (!hasChinese(dish.name_translated || "")) {
          dish._needsRetranslate = true;
        }
      }

      return result;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES - 1) {
        // Brief backoff before retry
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  throw new Error(
    `Menu analysis failed after ${MAX_RETRIES} attempts: ${lastError?.message || "unknown error"}`
  );
}

// ── Translation refinement ─────────────────────────────────────────

export async function refineTranslation(dish: {
  name_original: string;
  name_translated: string;
  description: string;
  source_language: string;
}): Promise<{
  name_translated: string;
  description: string;
}> {
  const needsChinese = !hasChinese(dish.name_translated);
  const instruction = needsChinese
    ? `The current "translation" is NOT in Chinese. You MUST translate it to proper Chinese (中文).`
    : `Refine the Chinese translation to sound more natural and appetizing.`;

  const response = await qwen.chat.completions.create({
    model: TEXT_MODEL,
    messages: [
      {
        role: "system",
        content: `You are a bilingual food editor. Your job is to produce the best CHINESE (中文) translation of dish names and descriptions.

${instruction}

CRITICAL: name_translated and description MUST be in Chinese characters (中文). Never output English or any other language.

Source language: ${dish.source_language}
Return ONLY valid JSON: { "name_translated": "...", "description": "..." }`,
      },
      {
        role: "user",
        content: `Original name: ${dish.name_original}\nCurrent translation (may be wrong or in wrong language): ${dish.name_translated}\nCurrent description: ${dish.description}\n\nPlease provide proper CHINESE translations.`,
      },
    ],
    max_tokens: 256,
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
  const response = await qwen.chat.completions.create({
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

// ── Content moderation ─────────────────────────────────────────────

export async function moderateReview(
  text: string
): Promise<{ safe: boolean; reason?: string }> {
  const response = await qwen.chat.completions.create({
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
