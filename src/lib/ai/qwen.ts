import OpenAI from "openai";
import { shouldRetryEmptyMenuResult } from "@/lib/menu-analysis-utils";
import { normalizeExtractedDishFields } from "@/lib/menu-analysis-normalization";
import { TARGET_LANGUAGE_LABELS, normalizeTargetLang } from "@/lib/languages";

const API_TIMEOUT = 120_000;

const qwen = new OpenAI({
  baseURL: process.env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
  apiKey: process.env.QWEN_API_KEY || "",
  timeout: API_TIMEOUT,
});

const VL_MODEL = process.env.QWEN_VL_MODEL || "qwen-vl-max";
const TEXT_MODEL = process.env.QWEN_TEXT_MODEL || "qwen-plus";

interface MenuDishAnalysis {
  name_original: string;
  name_translated: string;
  description: string;
  recommendation?: string;
  good_for?: string;
  caution?: string;
  category?: string;
  ingredients: string[];
  included_items?: string[];
  allergens: string[];
  taste_profile: string[];
  confidence: number;
  _needsRetranslate?: boolean;
}

interface MenuMetadataAnalysis {
  restaurant?: {
    display_name?: string;
    restaurant_type?: string;
    rating_estimate?: number;
  };
  insight?: {
    summary?: string;
    occasion_tags?: string[];
    cuisine_style?: string;
  };
  signature?: {
    dish_indexes?: number[];
    reason?: string;
  };
}

interface MenuImageAnalysis {
  dishes: MenuDishAnalysis[];
  page_label: string;
  page_type?: "menu" | "info";
  page_description?: string;
  source_language: string;
  menu_metadata?: MenuMetadataAnalysis;
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
- If a page is only restaurant/story information and has no orderable items, return an empty dishes array with page_label "说明页" and page_type "info". Also provide page_description: a 30-60 char Chinese summary of what this page is about (e.g. "本页介绍餐厅的有机食材采购理念和面团发酵工艺" or "餐厅品牌故事和厨师团队介绍").
- For non-orderable story/brand/ingredient philosophy pages, set page_type to "info".

For each dish, provide:
1. name_original: exact dish/course title from the menu (any language). Include prices only if attached to the title line. Do NOT include comma-separated garnishes, sauces, wine pairings, or ingredient explanations in name_original.
2. name_translated: MUST be in the requested target language.
3. description: 30-60 chars or equivalent short sentence in the requested target language: main ingredient + cooking method + taste/texture + serving style.
4. recommendation: 40-70 chars or equivalent concise sentence in the requested target language: explain who should order this, why it's worth trying, and what makes it special. Be specific about taste and dining context.
5. good_for: 25-40 chars or equivalent concise phrase in the requested target language: describe the best dining scenario — is it for sharing, solo dining, appetizer, or a hearty main? Mention pairing suggestions.
6. caution: 25-40 chars or equivalent concise phrase in the requested target language: what to watch out for — potential allergens, richness level, portion size, or spice. Be helpful, not alarmist.
7. included_items: array of visible combo/set contents when this item is a meal/set/combo/menu deal. Include main item, fries/sides, drink names, sauce, dessert, or upgrades if visible. Use the requested target language. Return [] for ordinary single dishes.
8. category: one of "appetizer","main","staple","dessert","drink" — classify each dish by its primary role in the meal structure. Appetizer=starter/sharing plates/cold dishes/salad, Main=core protein/entree/hot dish, Staple=noodle/rice/bread, Dessert=sweet, Drink=beverage/alcohol (only when the item IS the drink, not cooked-with-alcohol dishes).
9. confidence: 0.0-1.0
10. page_label: menu section in the requested target language (appetizer/main/dessert/drinks/mixed equivalent)
11. source_language: ISO 639-1 code (fr, ja, it, es, de, ko, th, en, etc.)

IMPORTANT: Extract EVERY orderable dish. Do not confuse a restaurant story page with a dish list. For menu pages with prices, never return empty.
IMPORTANT: Keep dish names and descriptions separate. Fine-dining menus often write one course as "Main protein, garnish, sauce, side, puree". This is ONE dish, not many dishes. Put only the main course title in name_original/name_translated; move garnishes, sauces, sides, and preparation notes into description, ingredients, or included_items.
IMPORTANT: Alcohol used in cooking is not a beverage category. Examples such as 啤酒鸭, 红酒炖牛肉, 花雕焗蟹, 绍兴酒蒸鱼, and 紫苏辣酒煮花螺 are food dishes; describe the solid ingredient and cooking method, not a drink.
Example: {"name_original":"Foie Gras","name_translated":"鹅肝酱","description":"黄油煎鹅肝配无花果酱与烤面包片，外脆内滑，甜咸交织。","recommendation":"如果你喜欢法式经典前菜，强烈推荐。鹅肝的丰腴与无花果的酸甜平衡得恰到好处，适合特殊场合或想犒劳自己的时候点。","good_for":"适合作为前菜，两个人分食体验更佳。建议搭配甜白葡萄酒。","caution":"脂肪含量较高，热量不低。对鹅肝过敏或素食者需避开。分量通常较小，价格偏高。","category":"appetizer","confidence":0.95}

Output ONLY valid JSON:
{
  "dishes": [...],
  "page_label": "主菜",
  "page_type": "menu",
  "page_description": "（说明页时必填）",
  "source_language": "fr",
  "menu_metadata": {
    "restaurant": {
      "display_name": "餐厅名 + 类型（必须基于菜单/语种推断，如「巴黎小馆 Le Petit Bistro」「江南私房菜」）",
      "restaurant_type": "小馆 / 酒馆 / 街边店 / 米其林 / 私房菜 等中文标签",
      "rating_estimate": "0.0-5.0 基于菜品丰富度和组合推断"
    },
    "insight": {
      "summary": "30-60 字总结这份菜单的料理风格、招牌特色和口味基调（必须用目标语言）",
      "occasion_tags": ["3-5 个用餐场景标签如约会小聚/朋友聚餐/商务宴请/配红酒/配啤酒"],
      "cuisine_style": "主菜系名称如勃艮第料理/江浙菜"
    },
    "signature": {
      "dish_indexes": [0, 2],
      "reason": "10-25 字推荐这几道招牌菜的理由"
    }
  }
}`;

const VL_SYSTEM_PROMPT_SIMPLE = `You are a professional restaurant menu OCR translator. Extract ALL ORDERABLE menu items from a photographed menu and translate them into the requested target language.

Extract priced menu lines and orderable items even if the page is tilted, warm-colored, partially cropped, distant, low-resolution, shown on a lightbox, or includes descriptions in another language. Read multi-column menus from top to bottom and left to right. Ignore brand headers, stories, tax notes, and sourcing/ingredient philosophy pages with no orderable priced items.

Rules:
1. name_original: exact dish/course title from the menu (any language). Include prices only if attached to the title line. Do NOT include comma-separated garnishes, sauces, wine pairings, or ingredient explanations in name_original.
2. name_translated: MUST be in the requested target language.
3. description: 30-60 chars or equivalent short sentence in the requested target language: main ingredient + cooking method + taste/texture + serving style.
4. included_items: array of visible combo/set contents when this item is a meal/set/combo/menu deal. Include main item, fries/sides, drink names, sauce, dessert, or upgrades if visible. Use the requested target language. Return [] for ordinary single dishes.
5. category: one of "appetizer","main","staple","dessert","drink" — classify each dish by its primary role in the meal structure. Appetizer=starter/sharing plates/cold dishes/salad, Main=core protein/entree/hot dish, Staple=noodle/rice/bread, Dessert=sweet, Drink=beverage/alcohol (only when the item IS the drink, not cooked-with-alcohol dishes).
6. confidence: 0.0-1.0
7. page_label: menu section in the requested target language (appetizer/main/dessert/drinks/mixed equivalent)
8. source_language: ISO 639-1 code (fr, ja, it, es, de, ko, th, en, etc.)

IMPORTANT: Extract EVERY orderable dish. Return empty dishes ONLY if the page has no orderable items. For non-orderable story/brand/ingredient philosophy pages, set page_label to "说明页" and page_type to "info", and provide page_description: a 30-60 char Chinese summary of what this page describes.
IMPORTANT: Keep dish names and descriptions separate. Fine-dining menus often write one course as "Main protein, garnish, sauce, side, puree". This is ONE dish, not many dishes. Put only the main course title in name_original/name_translated; move garnishes, sauces, sides, and preparation notes into description, ingredients, or included_items.
IMPORTANT: Alcohol used in cooking is not a beverage category. Examples such as 啤酒鸭, 红酒炖牛肉, 花雕焗蟹, 绍兴酒蒸鱼, and 紫苏辣酒煮花螺 are food dishes; describe the solid ingredient and cooking method, not a drink.

Output ONLY valid JSON:
{
  "dishes": [...],
  "page_label": "主菜",
  "page_type": "menu",
  "page_description": "（说明页时必填）",
  "source_language": "fr",
  "menu_metadata": {
    "restaurant": {
      "display_name": "餐厅名 + 类型（基于菜单/语种推断）",
      "restaurant_type": "小馆 / 酒馆 / 街边店 / 米其林 / 私房菜 等中文标签",
      "rating_estimate": "0.0-5.0 基于菜品丰富度和组合推断"
    },
    "insight": {
      "summary": "30-60 字总结这份菜单的料理风格、招牌特色和口味基调（必须用目标语言）",
      "occasion_tags": ["3-5 个用餐场景标签"],
      "cuisine_style": "主菜系名称"
    },
    "signature": {
      "dish_indexes": [0, 2],
      "reason": "10-25 字推荐这几道招牌菜的理由"
    }
  }
}`;

const VL_SYSTEM_PROMPT_FAST_FIRST_PASS = `You are a fast restaurant menu OCR translator. Extract ALL ORDERABLE menu items from a photographed menu and translate dish names into the requested target language.

Optimize for speed and recall. Read multi-column menus top-to-bottom and left-to-right. Do NOT generate recommendation, good_for, caution, long food advice, reviews, or rich commentary.

For each dish, provide ONLY:
1. name_original: exact dish/course title from the menu. Include visible price only if attached to the title line. Do NOT include comma-separated garnishes, sauces, wine pairings, or ingredient explanations in name_original.
2. name_translated: short dish name in the requested target language.
3. description: concise ingredient/type hint only in the requested target language.
4. included_items: array of visible combo/set contents when this item is a meal/set/combo/menu deal. Include main item, fries/sides, drink names, sauce, dessert, or upgrades if visible. Use the requested target language. Return [] for ordinary single dishes.
5. category: one of "appetizer","main","staple","dessert","drink".
6. confidence: 0.0-1.0.

Also provide page_label, page_type, page_description only for info pages, and source_language.

IMPORTANT: Do NOT generate recommendation, good_for, or caution in this fast first pass.
IMPORTANT: Extract every priced/orderable item; never collapse variants into one item.
IMPORTANT: Keep dish names and descriptions separate. If a menu line has a dish name followed by smaller explanatory text, put only the dish name in name_original and summarize the explanatory text in description.
IMPORTANT: Fine-dining menus often write one course as "Main protein, garnish, sauce, side, puree". This is ONE dish, not many dishes. Keep only the main course title in name_original/name_translated; move garnishes, sauces, sides, and preparation notes into description or included_items.
IMPORTANT: For meal/set/combo items, do not hide the contents in generic description only. Put visible sides and drinks into included_items.

Output ONLY valid JSON:
{ "dishes": [...], "page_label": "主菜", "page_type": "menu", "page_description": "（说明页时必填）", "source_language": "fr" }`;

function targetLanguageInstruction(targetLang: string): string {
  const normalized = normalizeTargetLang(targetLang);
  const label = TARGET_LANGUAGE_LABELS[normalized].prompt;
  return `\n\nTARGET LANGUAGE: ${label}. All values for name_translated, description, recommendation, good_for, caution, page_label, and page_description MUST be written in ${label}. Preserve name_original exactly as seen on the menu.`;
}

function normalizeMenuImageAnalysis(result: MenuImageAnalysis, targetLang = "zh"): MenuImageAnalysis {
  if (!result.dishes || !Array.isArray(result.dishes)) {
    throw new Error("AI response missing dishes array");
  }

  for (const dish of result.dishes) {
    normalizeExtractedDishFields(dish);
    if (normalizeTargetLang(targetLang) === "zh" && !hasChinese(dish.name_translated || "")) {
      dish._needsRetranslate = true;
    }
  }

  return result;
}

async function analyzeWithPrompt(
  base64Image: string,
  systemPrompt: string,
  mimeType: string,
  maxTokens: number,
  targetLang = "zh",
): Promise<MenuImageAnalysis> {
  const normalizedTargetLang = normalizeTargetLang(targetLang);
  const targetPrompt = targetLanguageInstruction(normalizedTargetLang);
  const response = await qwen.chat.completions.create({
    model: VL_MODEL,
    messages: [
      { role: "system", content: `${systemPrompt}${targetPrompt}` },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${base64Image}` },
          },
          { type: "text", text: `Extract ALL orderable dishes from this menu photo. Priced dotted menu lines, numbered combos, tasting-menu courses, dessert/drink lines, and menu-board items are dishes. Ignore only brand/story pages with no orderable items. Remember: translated fields must be in ${TARGET_LANGUAGE_LABELS[normalizedTargetLang].prompt}.` },
        ],
      },
    ],
    max_tokens: maxTokens,
    temperature: 0.1,
  });

  const text = response.choices[0]?.message?.content || "";

  if (!text || text.trim().length < 10) {
    throw new Error("AI returned empty response");
  }

  return normalizeMenuImageAnalysis(parseAIJson<MenuImageAnalysis>(text), normalizedTargetLang);
}

export async function analyzeMenuImageFast(base64Image: string, _rich?: boolean, mimeType = "image/jpeg", targetLang = "zh"): Promise<MenuImageAnalysis> {
  let lastError: Error | null = null;
  const MAX_RETRIES = 1;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await analyzeWithPrompt(base64Image, VL_SYSTEM_PROMPT_FAST_FIRST_PASS, mimeType, 3072, targetLang);

      if (shouldRetryEmptyMenuResult(result, attempt, MAX_RETRIES)) {
        lastError = new Error("AI found no dishes");
        continue;
      }

      return result;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw new Error(
    `Fast menu analysis failed after ${MAX_RETRIES} attempts: ${lastError?.message || "unknown error"}`
  );
}

export async function analyzeMenuImage(base64Image: string, rich?: boolean, mimeType = "image/jpeg", targetLang = "zh"): Promise<MenuImageAnalysis> {
  let lastError: Error | null = null;
  const MAX_RETRIES = 1;
  const systemPrompt = rich ? VL_SYSTEM_PROMPT_FULL : VL_SYSTEM_PROMPT_SIMPLE;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await analyzeWithPrompt(base64Image, systemPrompt, mimeType, rich ? 8192 : 4096, targetLang);

      if (shouldRetryEmptyMenuResult(result, attempt, MAX_RETRIES)) {
        lastError = new Error("AI found no dishes");
        continue;
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
}, targetLang = "zh"): Promise<{ name_translated: string; description: string }> {
  const normalizedTargetLang = normalizeTargetLang(targetLang);
  const targetLabel = TARGET_LANGUAGE_LABELS[normalizedTargetLang].prompt;
  const needsChinese = normalizedTargetLang === "zh" && !hasChinese(dish.name_translated);
  const instruction = needsChinese
    ? "The current translation is NOT in Chinese. You MUST translate to proper Chinese (中文)."
    : `Refine the translation to sound more natural and appetizing in ${targetLabel}.`;

  const response = await qwen.chat.completions.create({
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
