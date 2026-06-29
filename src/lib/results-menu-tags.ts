import type { Dish } from "@/types";

const MAX_MENU_TAGS = 4;

type SmartTagRule = {
  label: string;
  weight: number;
  match: (ctx: MenuTagContext) => boolean;
};

type MenuTagContext = {
  sourceLang: string;
  dishes: Dish[];
  text: string;
};

function localizedText(value?: string | Record<string, string> | null): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return [value.zh, value.en, value.ja, value.ko].filter(Boolean).join(" ");
}

function dishText(dish: Dish): string {
  return [
    dish.category,
    dish.cuisine_region,
    dish.name_original,
    localizedText(dish.name_translated),
    localizedText(dish.description),
    ...(dish.ingredients || []),
    ...(dish.taste_profile || []),
  ].filter(Boolean).join(" ").toLowerCase();
}

function normalizedMenuText(dishes: Dish[]): string {
  return dishes.map(dishText).join(" ").replace(/fior\s+di\s+latte/g, " ");
}

function countMatches(dishes: Dish[], pattern: RegExp): number {
  return dishes.filter((dish) => pattern.test(dishText(dish))).length;
}

function has(text: string, pattern: RegExp): boolean {
  return pattern.test(text);
}

function uniquePush(tags: string[], tag: string): void {
  if (!tags.includes(tag)) tags.push(tag);
}

const GENERIC_AI_TAGS = new Set([
  "约会小聚",
  "朋友聚餐",
  "家庭聚会",
  "商务宴请",
  "主厨推荐",
]);

const LANG_FALLBACKS: Record<string, string[]> = {
  fr: ["稳妥选择", "适合分享", "当地特色", "轻松聚餐"],
  it: ["适合分享", "奶酪爱好", "当地特色", "轻松聚餐"],
  es: ["适合分享", "海鲜鲜味", "当地特色", "轻松聚餐"],
  ja: ["清爽轻食", "当地特色", "精致体验", "稳妥选择"],
  ko: ["适合分享", "辣味选择", "热闹聚餐", "当地特色"],
  th: ["酸辣口味", "清爽开胃", "适合分享", "当地特色"],
  de: ["肉食爱好", "配啤酒", "扎实饱足", "当地特色"],
  zh: ["适合分享", "本土风味", "热闹聚餐", "稳妥选择"],
  en: ["稳妥选择", "适合分享", "轻松聚餐", "当地特色"],
};

const TAG_RULES: SmartTagRule[] = [
  {
    label: "适合分享",
    weight: 95,
    match: ({ text }) => has(text, /分享|拼盘|冷切|奶酪盘|披萨|比萨|ピザ|tapas|platter|assortment|charcuterie|fromage|cheese board|pizza|share/),
  },
  {
    label: "奶酪爱好",
    weight: 90,
    match: ({ text }) => has(text, /奶酪|芝士|马苏里拉|布拉塔|干酪|乳酪|mozzarella|burrata|fromage|cheese|parmesan|pecorino|comt[eé]|goat cheese/),
  },
  {
    label: "辣味选择",
    weight: 88,
    match: ({ text }) => has(text, /辣|麻辣|香辣|辣椒|diavola|spicy|hot|chili|chilli|pepper|pepperoni/),
  },
  {
    label: "海鲜鲜味",
    weight: 86,
    match: ({ text }) => has(text, /海鲜|鱼|虾|蟹|贝|蚝|蛤|鳀鱼|金枪鱼|三文鱼|鳕鱼|鱿鱼|章鱼|seafood|fish|tuna|anchovy|salmon|cod|shrimp|prawn|crab|clam|oyster|shellfish|calamari|octopus/),
  },
  {
    label: "清爽开胃",
    weight: 82,
    match: ({ text }) => has(text, /清爽|清淡|清新|轻盈|爽口|开胃|沙拉|罗勒|番茄|fresh|light|refreshing|salad|basil|tomato/),
  },
  {
    label: "素食友好",
    weight: 80,
    match: ({ text }) => has(text, /素食|蔬菜|时蔬|菌菇|蘑菇|vegetarian|vegetable|mushroom/) && !has(text, /萨拉米|火腿|培根|香肠|金枪鱼|鳀鱼|牛|羊|猪|鸡|鸭|seafood|fish|tuna|anchovy|salami|ham|bacon|sausage|beef|pork|chicken|duck/),
  },
  {
    label: "甜点收尾",
    weight: 78,
    match: ({ text }) => has(text, /甜|甜点|甜品|蛋糕|冰淇淋|慕斯|巧克力|提拉米苏|奶冻|焦糖|dessert|sweet|cake|gelato|mousse|tiramisu|panna cotta|chocolate|caramel/),
  },
  {
    label: "肉食爱好",
    weight: 76,
    match: ({ text }) => has(text, /肉|牛|羊|猪|鸡|鸭|火腿|培根|香肠|萨拉米|beef|steak|lamb|pork|chicken|duck|ham|bacon|sausage|salami|meat/),
  },
  {
    label: "浓郁满足",
    weight: 74,
    match: ({ text }) => has(text, /浓郁|厚重|奶油|黄油|酱汁|rich|creamy|butter|cream|sauce/),
  },
  {
    label: "当地特色",
    weight: 70,
    match: ({ text }) => has(text, /当地|本地|传统|经典|特色|主厨|招牌|手工|自制|traditional|classic|signature|chef|local|house|homemade|maison/),
  },
  {
    label: "配红酒",
    weight: 66,
    match: ({ sourceLang, text }) => ["fr", "it", "es"].includes(sourceLang) && has(text, /牛|羊|奶酪|芝士|冷切|火腿|披萨|beef|lamb|cheese|fromage|charcuterie|ham|pizza/),
  },
  {
    label: "配啤酒",
    weight: 64,
    match: ({ sourceLang, text }) => ["de", "en", "ko"].includes(sourceLang) && has(text, /炸|烤|香肠|辣|fried|grill|sausage|spicy|hot/),
  },
  {
    label: "稳妥选择",
    weight: 60,
    match: ({ dishes, text }) => dishes.length > 0 && (countMatches(dishes, /经典|招牌|推荐|popular|classic|signature|recommended/) > 0 || !has(text, /极辣|内脏|生食|offal|very spicy|raw/)),
  },
];

export function buildMenuSmartTags({
  sourceLang,
  dishes,
  aiTags = [],
}: {
  sourceLang: string;
  dishes: Dish[];
  aiTags?: string[];
}): string[] {
  const lang = (sourceLang || "en").toLowerCase();
  const text = normalizedMenuText(dishes);
  const ctx: MenuTagContext = { sourceLang: lang, dishes, text };

  const scored = TAG_RULES
    .filter((rule) => rule.match(ctx))
    .sort((a, b) => b.weight - a.weight)
    .map((rule) => rule.label);

  const tags: string[] = [];
  for (const tag of scored) uniquePush(tags, tag);

  for (const tag of aiTags) {
    const clean = String(tag || "").trim().slice(0, 8);
    if (!clean || GENERIC_AI_TAGS.has(clean)) continue;
    uniquePush(tags, clean);
  }

  const fallback = LANG_FALLBACKS[lang] || LANG_FALLBACKS.en;
  for (const tag of fallback) uniquePush(tags, tag);

  return tags.slice(0, MAX_MENU_TAGS);
}
