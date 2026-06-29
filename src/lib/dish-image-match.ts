import dishKnowledgeDb from "../../public/dish-knowledge-db.json";
import type { DishKnowledgeEntry } from "./dish-knowledge-types";

type DishLike = {
  id?: string;
  name_original?: string;
  name_translated?: string | Record<string, string>;
  description?: string | Record<string, string>;
  ingredients?: string[];
  category?: string;
  cuisine_region?: string;
  page_label?: string;
};

export type DishImageMatch = {
  id: string;
  card: string;
  hero: string;
  entry: DishKnowledgeEntry;
  score: number;
};

const LOCAL_IMAGE_OVERRIDES: Array<{
  patterns: string[];
  id: string;
  card: string;
  hero: string;
  names: string[];
}> = [
  {
    patterns: ["la reine", "pizza reine", "ham mushrooms olives", "jambon champignons olives", "皇后披萨"],
    id: "pizza-prosciutto-funghi",
    card: "/dishes/pizza-prosciutto-funghi.png",
    hero: "/dishes/pizza-prosciutto-funghi.png",
    names: ["Pizza Prosciutto e Funghi", "La Reine", "皇后披萨"],
  },
  {
    patterns: ["la genovese", "pizza genovese", "pesto genovese fior di latte", "热那亚披萨"],
    id: "pizza-genovese",
    card: "/dishes/pizza-genovese.png",
    hero: "/dishes/pizza-genovese.png",
    names: ["Pizza Genovese", "La Genovese", "热那亚披萨"],
  },
  {
    patterns: ["trois fromages", "three cheese pizza", "quattro formaggi", "三奶酪披萨", "四奶酪披萨"],
    id: "pizza-quattro-formaggi",
    card: "/dishes/pizza-quattro-formaggi.png",
    hero: "/dishes/pizza-quattro-formaggi.png",
    names: ["Pizza Quattro Formaggi", "La Trois Fromages", "三奶酪披萨"],
  },
  {
    patterns: ["la jardin", "pizza jardin", "jardin", "seasonal vegetables", "legumes de saison", "花园披萨", "蔬菜披萨"],
    id: "pizza-quattro-stagioni",
    card: "/dishes/pizza-quattro-stagioni.png",
    hero: "/dishes/pizza-quattro-stagioni.png",
    names: ["Pizza Quattro Stagioni", "La Jardin", "花园披萨"],
  },
  {
    patterns: ["la pizza cioccolato", "pizza cioccolato", "pizza chocolate", "chocolate pizza", "巧克力披萨", "甜味披萨"],
    id: "pizza-margherita",
    card: "/dishes/pizza-margherita.png",
    hero: "/dishes/pizza-margherita.png",
    names: ["Pizza al Cioccolato", "La Pizza Cioccolato", "巧克力披萨"],
  },
];

const DIRECT_ALIASES: Array<{ patterns: string[]; id: string }> = [
  { patterns: ["marinara"], id: "pizza-marinara" },
  { patterns: ["margherita"], id: "pizza-margherita" },
  { patterns: ["diavola"], id: "pizza-diavola" },
  { patterns: ["vitello tonnato", "tonnato"], id: "vitello-tonnato" },
  { patterns: ["burrata con pomodorini", "burrata e pomodorini", "burrata with tomato", "burrata番茄", "布里塔配小番茄"], id: "burrata-con-pomodorini" },
  { patterns: ["carpaccio"], id: "carpaccio-de-boeuf" },
  { patterns: ["salade du moment", "salad of the day", "主厨灵感沙拉"], id: "salade-nicoise" },
  { patterns: ["salade jambon", "parma ham salad", "帕尔马火腿沙拉"], id: "salade-chez-louis" },
  { patterns: ["assortiment de charcuterie", "charcuterie board", "cold cut platter", "cold cuts platter", "冷切拼盘", "肉拼盘"], id: "charcuterie-francaise" },
  { patterns: ["nicoise", "niçoise"], id: "salade-nicoise" },
  { patterns: ["pesto genovese", "trofie al pesto", "pasta al pesto", "青酱意面"], id: "pasta-al-pesto" },
  { patterns: ["bolognese", "ragù alla bolognese", "ragu alla bolognese", "肉酱意面"], id: "ragu-alla-bolognese" },
  { patterns: ["carbonara", "卡邦尼", "培根蛋黄意面"], id: "carbonara" },
  { patterns: ["minestrone", "蔬菜汤"], id: "minestrone" },
  { patterns: ["tiramisu", "tiramisù", "提拉米苏"], id: "tiramisu" },
  { patterns: ["panna cotta", "奶冻"], id: "panna-cotta" },
  { patterns: ["affogato", "阿芙佳朵"], id: "affogato" },
  { patterns: ["cannoli", "奶油卷"], id: "cannoli-siciliani" },
  { patterns: ["gelato", "意式冰淇淋"], id: "gelato-italiano" },
  { patterns: ["focaccia", "佛卡夏"], id: "focaccia-italiana" },
  { patterns: ["paneer tikka", "芝士块"], id: "paneer-tikka" },
];

const STOPWORDS = new Set([
  "la", "le", "les", "du", "de", "des", "di", "al", "alla", "the", "and",
  "with", "moment", "inspiration", "chef", "mauro", "notre", "facon", "façon",
  "bio", "organic", "salade", "salad",
]);

function isLocalImageUrl(value: string | undefined): boolean {
  return typeof value === "string" && value.startsWith("/dishes/");
}

function localized(value: DishLike["name_translated"] | DishLike["description"]): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.zh || value.en || Object.values(value)[0] || "";
}

export function normalizeDishText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .toLowerCase()
    .replace(/[€$£¥]\s*\d+(?:[,.]\d+)?|\d+(?:[,.]\d+)?\s*(?:€|eur|euros?)/gi, " ")
    .replace(/[«»"“”'’`´.,;:!?()[\]{}+*/\\|_~^=<>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string): string[] {
  return normalizeDishText(value)
    .split(" ")
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

function textForDish(dish: DishLike): string {
  return [
    dish.name_original || "",
    localized(dish.name_translated),
    ...(dish.ingredients || []),
    dish.category || "",
    dish.cuisine_region || "",
    dish.page_label || "",
  ].join(" ");
}

function isComboMealText(text: string): boolean {
  return /\b(?:meal|combo|set|menu deal|value meal|box meal|with fries|with drink|fries and drink|chips and drink)\b|套餐|组合餐|套饭|配薯条|配饮料|含饮品|含薯条/.test(text);
}

function scoreEntry(queryText: string, queryTokens: string[], entry: DishKnowledgeEntry): number {
  const entryNames = entry.names.map(normalizeDishText);
  const normalizedQuery = normalizeDishText(queryText);

  if (entryNames.some((name) => name && normalizedQuery === name)) return 1;
  if (entryNames.some((name) => name.length > 3 && normalizedQuery.includes(name))) return 0.95;
  if (entryNames.some((name) => name.length > 3 && name.includes(normalizedQuery))) return 0.9;

  const entryTokens = new Set(tokens([...entry.names, entry.description.zh, entry.description.en].join(" ")));
  if (entryTokens.size === 0 || queryTokens.length === 0) return 0;

  let overlap = 0;
  for (const token of queryTokens) {
    if (entryTokens.has(token)) overlap++;
  }

  const coverage = overlap / Math.max(1, queryTokens.length);
  const density = overlap / Math.max(1, entryTokens.size);
  return coverage * 0.75 + density * 0.25;
}

export function matchDishKnowledgeImage(dish: DishLike): DishImageMatch | null {
  const queryText = textForDish(dish);
  const normalizedQuery = normalizeDishText(queryText);

  if (isComboMealText(normalizedQuery)) return null;

  for (const override of LOCAL_IMAGE_OVERRIDES) {
    if (override.patterns.some((pattern) => normalizedQuery.includes(normalizeDishText(pattern)))) {
      return {
        id: override.id,
        card: override.card,
        hero: override.hero,
        entry: {
          id: override.id,
          names: override.names,
          cuisine: "italian",
          category: "main",
          description: { zh: "", en: "" },
          recommendation: { zh: "", en: "" },
          good_for: "",
          caution: "",
          ingredients: [],
          allergens: [],
          taste_profile: [],
          calories: null,
          spice_level: null,
          reviews: [],
          card: override.card,
          hero: override.hero,
        },
        score: 0.96,
      };
    }
  }

  for (const alias of DIRECT_ALIASES) {
    if (alias.patterns.some((pattern) => normalizedQuery.includes(normalizeDishText(pattern)))) {
      const entry = (dishKnowledgeDb as DishKnowledgeEntry[]).find((item) => item.id === alias.id);
      if (entry && isLocalImageUrl(entry.card) && isLocalImageUrl(entry.hero)) {
        return { id: entry.id, card: entry.card, hero: entry.hero, entry, score: 0.92 };
      }
    }
  }

  const queryTokens = tokens(queryText);
  let best: DishImageMatch | null = null;

  for (const entry of dishKnowledgeDb as DishKnowledgeEntry[]) {
    if (!isLocalImageUrl(entry.card) || !isLocalImageUrl(entry.hero)) continue;
    const score = scoreEntry(queryText, queryTokens, entry);
    if (!best || score > best.score) {
      best = { id: entry.id, card: entry.card, hero: entry.hero, entry, score };
    }
  }

  return best && best.score >= 0.58 ? best : null;
}
