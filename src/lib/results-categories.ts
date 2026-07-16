import type { Dish, TranslationResult, SignatureRecommendation } from "@/types";

export type CategoryKey =
  | "all"
  | "must_order"
  | "ai_recommend"
  | "girl_favorite"
  | "appetizer"
  | "main"
  | "staple"
  | "dessert"
  | "drink"
  | "safe_pick"
  | "shareable"
  | "light"
  | "rich"
  | "spicy"
  | "seafood"
  | "meat"
  | "vegetarian"
  | "cheese"
  | "local_special";

export interface CategoryDef {
  key: CategoryKey;
  label: string;
  count: number;
}

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  all: "全部",
  must_order: "本店必点",
  ai_recommend: "AI 推荐",
  girl_favorite: "女生喜欢",
  appetizer: "前菜",
  main: "主菜",
  staple: "主食",
  dessert: "甜点",
  drink: "饮品",
  safe_pick: "稳妥选择",
  shareable: "适合分享",
  light: "清爽",
  rich: "浓郁",
  spicy: "辣味",
  seafood: "海鲜",
  meat: "肉食",
  vegetarian: "素食",
  cheese: "奶酪",
  local_special: "当地特色",
};

const STAPLE_CATEGORIES = new Set(["noodle", "rice", "pasta", "stew"]);

const CATEGORY_ORDER: CategoryKey[] = [
  "all",
  "must_order",
  "ai_recommend",
  "girl_favorite",
  "appetizer",
  "main",
  "staple",
  "dessert",
  "drink",
  "safe_pick",
  "shareable",
  "light",
  "rich",
  "spicy",
  "seafood",
  "meat",
  "vegetarian",
  "cheese",
  "local_special",
];

const ROLE_CATEGORY_KEYS = new Set<CategoryKey>(["appetizer", "main", "staple", "dessert", "drink"]);
const PRIMARY_FILTER_KEYS = new Set<CategoryKey>(["must_order", "ai_recommend", "girl_favorite"]);

const CATEGORY_PRIORITY: Record<CategoryKey, number> = {
  all: 1000,
  must_order: 100,
  ai_recommend: 96,
  girl_favorite: 92,
  appetizer: 86,
  staple: 84,
  main: 82,
  dessert: 80,
  drink: 78,
  safe_pick: 72,
  shareable: 70,
  light: 68,
  rich: 66,
  spicy: 64,
  seafood: 62,
  meat: 60,
  vegetarian: 58,
  cheese: 56,
  local_special: 54,
};

function maxVisibleCategoriesFor(totalDishes: number): number {
  if (totalDishes <= 0) return 1;
  if (totalDishes <= 1) return 3;
  if (totalDishes <= 3) return 4;
  if (totalDishes <= 6) return 6;
  if (totalDishes <= 10) return 7;
  return 9;
}

function categoryOrderIndex(key: CategoryKey): number {
  return CATEGORY_ORDER.indexOf(key);
}

function isUsefulTab(key: CategoryKey, count: number, totalDishes: number): boolean {
  if (key === "all") return true;
  if (count <= 0) return false;
  if (count >= totalDishes && ROLE_CATEGORY_KEYS.has(key)) return false;
  if (count >= totalDishes && !PRIMARY_FILTER_KEYS.has(key) && totalDishes <= 6) return false;
  return true;
}

function localizedText(value?: string | Record<string, string> | null): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return [value.zh, value.en, value.ja, value.ko].filter(Boolean).join(" ");
}

function dishTextBlob(dish: Dish): string {
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

function normalizedCategory(dish: Dish): string {
  return (dish.category || "").trim().toLowerCase();
}

function textWithoutCheeseLatte(text: string): string {
  return text.replace(/fior\s+di\s+latte/g, " ").replace(/latte\s+mozzarella/g, " ");
}

function isDessertText(text: string): boolean {
  return /甜|甜点|甜品|蛋糕|冰淇淋|雪糕|慕斯|巧克力|提拉米苏|奶冻|焦糖|布丁|dessert|sweet|cake|ice|gelato|mousse|tiramisu|panna cotta|chocolate|caramel|pudding/.test(text);
}

function isPizzaText(text: string): boolean {
  return /披萨|比萨|ピザ|\bpizza\b|pizzeria|margherita|marinara|diavola|genovese|napoletana/.test(text);
}

function isStapleText(text: string): boolean {
  return isPizzaText(text) || /主食|面|饭|米|粉|noodle|rice|pasta|bread|risotto|sandwich|burger|taco|ramen|udon/.test(text);
}

function isDrinkText(text: string): boolean {
  const drinkTerm =
    /饮品|饮料|冰饮|beverage|cocktail|mocktail|juice|smoothie|lemonade|aperitif|apéritif|digestif|pommeau|calvados|cidre|cider|liqueur|咖啡|coffee|espresso|cappuccino|americano|拿铁|卡布奇诺|茶|tea|matcha|wine|beer|spritz|啤酒|葡萄酒|红酒|白酒|苹果酒|利口酒/.test(text);
  const icedDrink =
    /(?:glac[eé]|iced|冰沙|冰饮).{0,18}(?:pommeau|calvados|cidre|cider|wine|beer|cocktail|juice|smoothie|lemonade|tea|coffee|酒|果汁|茶|咖啡)|(?:pommeau|calvados|cidre|cider|wine|beer|cocktail|juice|smoothie|lemonade|tea|coffee|酒|果汁|茶|咖啡).{0,18}(?:glac[eé]|iced|冰沙|冰饮)/.test(text);
  return drinkTerm || icedDrink;
}

function isStrongDrinkText(text: string): boolean {
  return /饮品|饮料|冰饮|beverage|cocktail|mocktail|juice|smoothie|lemonade|aperitif|apéritif|digestif|pommeau|calvados|cidre|cider|liqueur|wine|beer|spritz|啤酒|葡萄酒|红酒|白酒|苹果酒|利口酒/.test(text);
}

function isDessertFormatText(text: string): boolean {
  return /\b(?:roll|cake|chiffon|swiss roll|pastry|pudding|mousse|tart|pie|mochi|dorayaki|waffle|pancake|crepe|cheesecake|brownie|cookie|biscuit)\b|卷|蛋糕|戚风|点心|甜点|甜品|糕|饼|布丁|慕斯|挞|派|麻薯|大福|铜锣烧|华夫|松饼|可丽饼|芝士蛋糕|曲奇/.test(text);
}

function isSeafoodText(text: string): boolean {
  return /海鲜|鱼|虾|蟹|贝|蚝|蛤|鳀鱼|金枪鱼|三文鱼|鳕鱼|鱿鱼|章鱼|海螺|花螺|蛏|扇贝|seafood|fish|tuna|anchovy|salmon|cod|shrimp|prawn|crab|clam|oyster|shellfish|calamari|octopus|conch|whelk/.test(text);
}

function isMeatText(text: string): boolean {
  return /肉|牛|羊|猪|鸡|鸭|火腿|培根|香肠|腊肠|萨拉米|beef|steak|lamb|pork|chicken|duck|ham|bacon|sausage|salami|pepperoni|meat/.test(text);
}

function isSpicyText(text: string): boolean {
  return /辣|麻辣|香辣|辣椒|diavola|spicy|hot|chili|chilli|pepper|pepperoni/.test(text);
}

function isCheeseText(text: string): boolean {
  return /奶酪|芝士|马苏里拉|布拉塔|干酪|乳酪|fior\s+di\s+latte|mozzarella|burrata|fromage|cheese|parmesan|pecorino|comt[eé]|goat cheese/.test(text);
}

function isVegetarianText(text: string): boolean {
  return !isSeafoodText(text) && !isMeatText(text) && /素食|蔬菜|时蔬|番茄|蘑菇|菌菇|罗勒|沙拉|vegetarian|vegetable|tomato|mushroom|basil|salad/.test(text);
}

function isLightText(text: string): boolean {
  return !isMeatText(text) && /清爽|清淡|清新|轻盈|爽口|开胃|番茄|蔬菜|沙拉|罗勒|fresh|light|mild|refreshing|tomato|vegetable|salad|basil/.test(text);
}

function isRichText(text: string): boolean {
  return /浓郁|厚重|奶油|黄油|奶酪|芝士|巧克力|焦糖|酱汁|rich|creamy|butter|cream|cheese|chocolate|caramel|sauce/.test(text);
}

function isShareableText(text: string): boolean {
  return /分享|拼盘|冷切|奶酪盘|披萨|比萨|ピザ|tapas|platter|assortment|charcuterie|fromage|cheese board|pizza|share/.test(text);
}

function isLocalSpecialText(text: string): boolean {
  return /当地|本地|传统|经典|特色|主厨|招牌|手工|自制|罗马|巴黎|法式|意式|日式|traditional|classic|signature|chef|local|house|homemade|maison|italian|french|japanese/.test(text);
}

export function isAIRecommendedDish(dish: Dish, signature?: SignatureRecommendation): boolean {
  if (signature?.dish_ids?.includes(dish.id)) return true;
  if (typeof dish.rating_avg === "number" && dish.rating_avg >= 4.5) return true;

  const text = dishTextBlob(dish);
  return /chef|signature|popular|recommended|must.?try|招牌|推荐|必点|经典|特色|主厨|人气/.test(text);
}

export function isGirlFavoriteDish(dish: Dish): boolean {
  const text = dishTextBlob(dish);
  const isDessert = isDessertText(text);
  if (!isDessert && (isMeatText(text) || isSeafoodText(text) || isSpicyText(text))) return false;
  return isDessert || isVegetarianText(text) || isLightText(text) || isCheeseText(text);
}

function dishCategoryKey(dish: Dish): CategoryKey | null {
  const rawCategory = normalizedCategory(dish);
  const c = textWithoutCheeseLatte(dishTextBlob(dish));
  if (!c) return null;
  const pizzaLike = isPizzaText(c);
  const dessertLike = isDessertText(c);
  const dessertFormat = isDessertFormatText(c);
  const drinkLike = isDrinkText(c);
  if ((rawCategory === "drink" || rawCategory === "beverage") && !dessertFormat) return "drink";
  if (pizzaLike) return "staple";
  if (isStrongDrinkText(c) || (drinkLike && !dessertLike && !dessertFormat)) return "drink";
  if (dessertLike) return "dessert";
  if (isStapleText(c)) return "staple";
  if (rawCategory === "appetizer") return "appetizer";
  if (rawCategory === "main") return "main";
  if (rawCategory === "staple" || STAPLE_CATEGORIES.has(rawCategory)) return "staple";
  if (rawCategory === "dessert") return "dessert";
  if (/前菜|开胃|starter|appetizer|salad|tapas|burrata|charcuterie|fromage|cheese|escargot|冷切|奶酪/.test(c)) return "appetizer";
  if (/主菜|主餐|entree|main course|steak|beef|chicken|lamb|pork|fish|seafood|salmon|duck|veal|肉|鱼|牛|鸡|羊|猪/.test(c)) return "main";
  return null;
}

function addSmartCategories(cats: Set<CategoryKey>, dish: Dish, signature?: SignatureRecommendation): void {
  const rawText = dishTextBlob(dish);
  const text = textWithoutCheeseLatte(rawText);

  if (signature?.dish_ids?.includes(dish.id) || isAIRecommendedDish(dish, signature) || isLocalSpecialText(text)) cats.add("safe_pick");
  if (isShareableText(text)) cats.add("shareable");
  if (isLightText(text)) cats.add("light");
  if (isRichText(rawText)) cats.add("rich");
  if (isSpicyText(text)) cats.add("spicy");
  if (isSeafoodText(text)) cats.add("seafood");
  if (isMeatText(text)) cats.add("meat");
  if (isVegetarianText(text)) cats.add("vegetarian");
  if (isCheeseText(rawText)) cats.add("cheese");
  if (isLocalSpecialText(text)) cats.add("local_special");
}

export function classifyDish(
  dish: Dish,
  signature?: SignatureRecommendation
): Set<CategoryKey> {
  const cats = new Set<CategoryKey>();

  if (signature?.dish_ids?.includes(dish.id)) cats.add("must_order");
  if (isAIRecommendedDish(dish, signature)) cats.add("ai_recommend");
  if (isGirlFavoriteDish(dish)) cats.add("girl_favorite");

  const menuCat = dishCategoryKey(dish);
  if (menuCat) cats.add(menuCat);
  addSmartCategories(cats, dish, signature);

  return cats;
}

function flattenDishes(result: TranslationResult | null): Dish[] {
  if (!result) return [];
  const out: Dish[] = [];
  for (const page of result.pages || []) {
    for (const d of page.dishes || []) out.push(d);
  }
  return out;
}

export function buildCategoryList(result: TranslationResult | null): CategoryDef[] {
  const allDishes = flattenDishes(result);
  const signature = result?.metadata?.signature;
  const totalDishes = allDishes.length;

  const counts: Record<CategoryKey, number> = {
    all: totalDishes,
    must_order: 0,
    ai_recommend: 0,
    girl_favorite: 0,
    appetizer: 0,
    main: 0,
    staple: 0,
    dessert: 0,
    drink: 0,
    safe_pick: 0,
    shareable: 0,
    light: 0,
    rich: 0,
    spicy: 0,
    seafood: 0,
    meat: 0,
    vegetarian: 0,
    cheese: 0,
    local_special: 0,
  };

  for (const dish of allDishes) {
    for (const k of classifyDish(dish, signature)) counts[k]++;
  }

  const maxVisible = maxVisibleCategoriesFor(totalDishes);
  const candidateKeys = CATEGORY_ORDER
    .filter((k) => k !== "all" && isUsefulTab(k, counts[k], totalDishes))
    .sort((a, b) => {
      const priorityDiff = CATEGORY_PRIORITY[b] - CATEGORY_PRIORITY[a];
      if (priorityDiff !== 0) return priorityDiff;
      const countDiff = counts[b] - counts[a];
      if (countDiff !== 0) return countDiff;
      return categoryOrderIndex(a) - categoryOrderIndex(b);
    })
    .slice(0, Math.max(0, maxVisible - 1))
    .sort((a, b) => categoryOrderIndex(a) - categoryOrderIndex(b));

  const visible = ["all", ...candidateKeys].map((k) => ({
    key: k as CategoryKey,
    label: CATEGORY_LABELS[k as CategoryKey],
    count: counts[k as CategoryKey],
  }));

  return visible;
}

export function filterDishesByCategory(
  result: TranslationResult | null,
  selected: CategoryKey
): Dish[] {
  const allDishes = flattenDishes(result);
  const signature = result?.metadata?.signature;
  if (selected === "all") return allDishes;
  const matched = allDishes.filter((d) => classifyDish(d, signature).has(selected));
  return matched;
}
