import OpenAI from "openai";

const API_TIMEOUT = 120_000;

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

const VL_SYSTEM_PROMPT = `You are a professional menu translator. Extract ALL dish names from a menu photo and translate them into CHINESE (中文).

Rules:
1. name_original: exact original text from the menu (any language). Include prices if visible.
2. name_translated: MUST be in CHINESE (中文). NEVER output English/Latin script.
3. description: one sentence in Chinese describing the dish.
4. confidence: 0.0-1.0
5. page_label: menu section in Chinese (前菜/主菜/甜点/饮品/混合)
6. source_language: ISO 639-1 code (fr, ja, it, es, de, ko, th, en, etc.)

IMPORTANT: Extract EVERY dish. Return empty dishes ONLY if no menu in the image.

Output ONLY valid JSON:
{
  "dishes": [{"name_original": "...", "name_translated": "...", "description": "...", "confidence": 0.9}],
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
              { type: "text", text: "Extract ALL dishes from this menu. Remember: ALL translations must be in Chinese (中文)." },
            ],
          },
        ],
        max_tokens: 4096,
        temperature: 0.1,
      });

      const text = response.choices[0]?.message?.content || "";

      if (!text || text.trim().length < 10) {
        throw new Error("AI returned empty response");
      }

      const result = parseAIJson<MenuImageAnalysis>(text);

      if (!result.dishes || !Array.isArray(result.dishes)) {
        throw new Error("AI response missing dishes array");
      }

      if (result.dishes.length === 0 && attempt < MAX_RETRIES - 1) {
        lastError = new Error("AI found no dishes");
        continue;
      }

      for (const dish of result.dishes) {
        if (!hasChinese(dish.name_translated || "")) {
          dish._needsRetranslate = true;
        }
        if (!dish.ingredients) dish.ingredients = [];
        if (!dish.allergens) dish.allergens = [];
        if (!dish.taste_profile) dish.taste_profile = [];
        if (!dish.description) dish.description = "";
        if (dish.confidence === undefined) dish.confidence = 0.7;
      }

      return result;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  throw new Error(
    `Menu analysis failed after ${MAX_RETRIES} attempts: ${lastError?.message || "unknown error"}`
  );
}

export async function refineTranslation(dish: {
  name_original: string;
  name_translated: string;
  description: string;
  source_language: string;
}): Promise<{ name_translated: string; description: string }> {
  const needsChinese = !hasChinese(dish.name_translated);
  const instruction = needsChinese
    ? "The current translation is NOT in Chinese. You MUST translate to proper Chinese (中文)."
    : "Refine the Chinese translation to sound more natural and appetizing.";

  const response = await qwen.chat.completions.create({
    model: TEXT_MODEL,
    messages: [
      {
        role: "system",
        content: `You are a bilingual food editor. ${instruction}

CRITICAL: name_translated and description MUST be in Chinese characters (中文).
Source language: ${dish.source_language}
Return ONLY valid JSON: { "name_translated": "...", "description": "..." }`,
      },
      {
        role: "user",
        content: `Original: ${dish.name_original}\nCurrent: ${dish.name_translated}\nDescription: ${dish.description}\n\nProvide proper CHINESE translations.`,
      },
    ],
    max_tokens: 256,
    temperature: 0.3,
  });

  const text = response.choices[0]?.message?.content || "";
  return parseAIJson<{ name_translated: string; description: string }>(text);
}

export async function summarizeReviews(
  dishName: string,
  reviews: Array<{ rating: number; content: string }>
): Promise<{ summary: string; praised: string[]; criticized: string[]; bestFor: string }> {
  const response = await qwen.chat.completions.create({
    model: TEXT_MODEL,
    messages: [
      {
        role: "system",
        content: "Summarize reviews. Return JSON: { summary, praised: [], criticized: [], bestFor }",
      },
      {
        role: "user",
        content: `Dish: ${dishName}\nReviews:\n${reviews.map((r) => `[${r.rating}★] ${r.content}`).join("\n")}`,
      },
    ],
    max_tokens: 512,
    temperature: 0.3,
  });

  const text = response.choices[0]?.message?.content || "";
  return parseAIJson<{ summary: string; praised: string[]; criticized: string[]; bestFor: string }>(text);
}

export async function moderateReview(text: string): Promise<{ safe: boolean; reason?: string }> {
  const response = await qwen.chat.completions.create({
    model: TEXT_MODEL,
    messages: [
      { role: "system", content: 'Is this review appropriate? Return JSON: { "safe": true/false, "reason": "..." }.' },
      { role: "user", content: text },
    ],
    max_tokens: 128,
    temperature: 0,
  });

  const text2 = response.choices[0]?.message?.content || "";
  return parseAIJson<{ safe: boolean; reason?: string }>(text2);
}
