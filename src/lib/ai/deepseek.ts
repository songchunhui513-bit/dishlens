import OpenAI from "openai";
import { shouldRetryEmptyMenuResult } from "@/lib/menu-analysis-utils";
import { TARGET_LANGUAGE_LABELS, normalizeTargetLang } from "@/lib/languages";

const API_TIMEOUT = 75_000;

const deepseek = new OpenAI({
  baseURL: "https://api.deepseek.com/v1",
  apiKey: process.env.DEEPSEEK_API_KEY || "",
  timeout: API_TIMEOUT,
});

const VL_MODEL = "deepseek-chat";
const TEXT_MODEL = "deepseek-chat";

interface MenuDishAnalysis {
  name_original: string;
  name_translated: string;
  description: string;
  recommendation?: string;
  good_for?: string;
  caution?: string;
  ingredients: string[];
  allergens: string[];
  taste_profile: string[];
  confidence: number;
  _needsRetranslate?: boolean;
}

interface MenuImageAnalysis {
  dishes: MenuDishAnalysis[];
  page_label: string;
  page_type?: "menu" | "info";
  page_description?: string;
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

const VL_SYSTEM_PROMPT_FULL = `You are a professional restaurant menu OCR translator and food advisor. Extract ALL ORDERABLE menu items from a photographed menu and translate them into the requested target language.

The photo may be a paper menu, menu board, fast-food lightbox, poster, two-page spread, narrow receipt-style tasting menu, or a low-resolution/distant phone photo. Read all visible columns and sections. If the image already contains food photos, still extract the text menu items next to them.

What counts as a dish:
- A priced menu line, often in uppercase, with dotted leaders, a price, or an ingredient description.
- Pizza, burrata, salad, carpaccio, veal, pasta, dessert, drink, or other orderable restaurant items.
- Extract the dish name even when the menu also includes English/French descriptions below it.

What to ignore:
- Restaurant brand names, sourcing stories, slogans, section decorations, social handles, tax notes, and ingredient philosophy pages with no orderable priced items.
- If a page is only restaurant/story information and has no orderable items, return an empty dishes array with page_label "说明页" and page_type "info". Also provide page_description: a 30-60 char Chinese summary of what this page is about.

For each dish, provide:
1. name_original: exact original text from the menu (any language). Include prices if visible.
2. name_translated: MUST be in the requested target language.
3. description: 30-60 chars or equivalent short sentence in the requested target language: main ingredient + cooking method + taste/texture + serving style.
4. recommendation: 40-70 chars or equivalent concise sentence in the requested target language: explain who should order this, why it's worth trying, and what makes it special.
5. good_for: 25-40 chars or equivalent concise phrase in the requested target language: describe the best dining scenario.
6. caution: 25-40 chars or equivalent concise phrase in the requested target language: what to watch out for — potential allergens, richness level, portion size, or spice.
7. confidence: 0.0-1.0
8. page_label: menu section in the requested target language.
9. source_language: ISO 639-1 code (fr, ja, it, es, de, ko, th, en, etc.)

IMPORTANT: Extract EVERY orderable dish. For menu pages with prices, never return empty.
IMPORTANT: Alcohol used in cooking is not a beverage category. Examples such as 啤酒鸭, 红酒炖牛肉, 花雕焗蟹, 绍兴酒蒸鱼, and 紫苏辣酒煮花螺 are food dishes; describe the solid ingredient and cooking method, not a drink.
Output ONLY valid JSON.`;

const VL_SYSTEM_PROMPT_SIMPLE = `You are a professional restaurant menu OCR translator. Extract ALL ORDERABLE menu items from a photographed menu and translate them into the requested target language.

Extract priced menu lines and orderable items even if the page is tilted, warm-colored, partially cropped, distant, low-resolution, shown on a lightbox, or includes descriptions in another language. Read multi-column menus from top to bottom and left to right. Ignore brand headers, stories, tax notes, and sourcing/ingredient philosophy pages with no orderable priced items.

Rules:
1. name_original: exact original text from the menu (any language). Include prices if visible.
2. name_translated: MUST be in the requested target language.
3. description: 30-60 chars or equivalent short sentence in the requested target language: main ingredient + cooking method + taste/texture + serving style.
4. confidence: 0.0-1.0
5. page_label: menu section in the requested target language.
6. source_language: ISO 639-1 code (fr, ja, it, es, de, ko, th, en, etc.)

IMPORTANT: Extract EVERY orderable dish. For non-orderable story pages, set page_label to "说明页" and page_type to "info" with a page_description.
IMPORTANT: Alcohol used in cooking is not a beverage category. Examples such as 啤酒鸭, 红酒炖牛肉, 花雕焗蟹, 绍兴酒蒸鱼, and 紫苏辣酒煮花螺 are food dishes; describe the solid ingredient and cooking method, not a drink.
Output ONLY valid JSON.`;

function targetPrompt(targetLang: string): string {
  const normalized = normalizeTargetLang(targetLang);
  const label = TARGET_LANGUAGE_LABELS[normalized].prompt;
  return `\n\nTARGET LANGUAGE: ${label}. All translated fields, including name_translated, description, recommendation, good_for, caution, page_label, and page_description, MUST be written in ${label}. Preserve name_original exactly as seen on the menu.`;
}

export async function analyzeMenuImage(base64Image: string, rich?: boolean, mimeType = "image/jpeg", targetLang = "zh"): Promise<MenuImageAnalysis> {
  let lastError: Error | null = null;
  const MAX_RETRIES = 1;
  const normalizedTargetLang = normalizeTargetLang(targetLang);
  const systemPrompt = `${rich ? VL_SYSTEM_PROMPT_FULL : VL_SYSTEM_PROMPT_SIMPLE}${targetPrompt(normalizedTargetLang)}`;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await deepseek.chat.completions.create({
        model: VL_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64Image}` },
              },
              { type: "text", text: `Extract ALL orderable dishes from this menu photo. ALL translated fields must be in ${TARGET_LANGUAGE_LABELS[normalizedTargetLang].prompt}.` },
            ],
          },
        ],
        max_tokens: rich ? 8192 : 4096,
        temperature: 0.1,
      });

      const text = response.choices[0]?.message?.content || "";

      if (!text || text.trim().length < 10) {
        throw new Error("DeepSeek returned empty response");
      }

      const result = parseAIJson<MenuImageAnalysis>(text);

      if (!result.dishes || !Array.isArray(result.dishes)) {
        throw new Error("DeepSeek response missing dishes array");
      }

      if (shouldRetryEmptyMenuResult(result, attempt, MAX_RETRIES)) {
        lastError = new Error("DeepSeek found no dishes");
        continue;
      }

      for (const dish of result.dishes) {
        if (normalizedTargetLang === "zh" && !hasChinese(dish.name_translated || "")) {
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

  throw new Error(`DeepSeek menu analysis failed after ${MAX_RETRIES} attempts: ${lastError?.message || "unknown error"}`);
}

export async function refineTranslation(dish: {
  name_original: string;
  name_translated: string;
  description: string;
  source_language: string;
}, targetLang = "zh"): Promise<{ name_translated: string; description: string }> {
  const normalizedTargetLang = normalizeTargetLang(targetLang);
  const targetLabel = TARGET_LANGUAGE_LABELS[normalizedTargetLang].prompt;
  const needsChinese = normalizedTargetLang === "zh" && !hasChinese(dish.name_translated);
  const instruction = needsChinese
    ? "The current translation is NOT in Chinese. You MUST translate to proper Chinese (中文)."
    : `Refine the translation to sound more natural and appetizing in ${targetLabel}.`;

  const response = await deepseek.chat.completions.create({
    model: TEXT_MODEL,
    messages: [
      {
        role: "system",
        content: `You are a bilingual food editor. ${instruction}

CRITICAL: name_translated and description MUST be in ${targetLabel}.
Source language: ${dish.source_language}
Return ONLY valid JSON: { "name_translated": "...", "description": "..." }`,
      },
      {
        role: "user",
        content: `Original: ${dish.name_original}\nCurrent: ${dish.name_translated}\nDescription: ${dish.description}\n\nProvide proper ${targetLabel} translations.`,
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
  const response = await deepseek.chat.completions.create({
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
  const response = await deepseek.chat.completions.create({
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
