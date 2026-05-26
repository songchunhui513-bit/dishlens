import type { Dish } from "@/types";
import { matchDishKnowledgeImage } from "@/lib/dish-image-match";

type DishText = {
  originalName: string;
  translatedName: string;
  description: string;
  searchText: string;
};

type DishImageRule = {
  patterns: string[];
  card: string;
  hero: string;
};

type DishInsight = {
  summary: string;
  recommendation: string;
  goodFor: string;
  caution: string;
  confidenceLabel: string;
};

const imageRules: DishImageRule[] = [
  {
    patterns: ["caesar salad", "凯撒", "caesar"],
    card: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=136&h=136&fit=crop&auto=format",
    hero: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&h=400&fit=crop&auto=format",
  },
  {
    patterns: ["garden salad", "田园", "green salad"],
    card: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=136&h=136&fit=crop&auto=format",
    hero: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&h=400&fit=crop&auto=format",
  },
  {
    patterns: ["salad", "沙拉"],
    card: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=136&h=136&fit=crop&auto=format",
    hero: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&h=400&fit=crop&auto=format",
  },
  {
    patterns: ["fried calamari", "calamari", "鱿鱼", "炸鱿"],
    card: "https://images.unsplash.com/photo-1562967916-eb82221dfb92?w=136&h=136&fit=crop&auto=format",
    hero: "https://images.unsplash.com/photo-1562967916-eb82221dfb92?w=600&h=400&fit=crop&auto=format",
  },
  {
    patterns: ["mozzarella", "奶酪棒", "芝士棒", "cheese stick"],
    card: "https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=136&h=136&fit=crop&auto=format",
    hero: "https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=600&h=400&fit=crop&auto=format",
  },
  {
    patterns: ["chicken", "roast chicken", "鸡肉", "鸡"],
    card: "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=136&h=136&fit=crop&auto=format",
    hero: "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=600&h=400&fit=crop&auto=format",
  },
  {
    patterns: ["beef", "steak", "bourguignon", "牛排", "牛肉"],
    card: "https://images.unsplash.com/photo-1544025162-d76694265947?w=136&h=136&fit=crop&auto=format",
    hero: "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&h=400&fit=crop&auto=format",
  },
  {
    patterns: ["fish", "sole", "salmon", "鱼", "三文鱼"],
    card: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=136&h=136&fit=crop&auto=format",
    hero: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600&h=400&fit=crop&auto=format",
  },
  {
    patterns: ["pasta", "spaghetti", "carbonara", "意面", "面"],
    card: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=136&h=136&fit=crop&auto=format",
    hero: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=600&h=400&fit=crop&auto=format",
  },
  {
    patterns: ["dessert", "cake", "tatin", "甜点", "蛋糕", "挞"],
    card: "https://images.unsplash.com/photo-1616953882462-8a583e0afbb4?w=136&h=136&fit=crop&auto=format",
    hero: "https://images.unsplash.com/photo-1616953882462-8a583e0afbb4?w=600&h=400&fit=crop&auto=format",
  },
  {
    patterns: ["starter", "appetizer", "前菜", "开胃"],
    card: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=136&h=136&fit=crop&auto=format",
    hero: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=400&fit=crop&auto=format",
  },
  {
    patterns: ["coffee", "espresso", "expresso", "cappuccino", "latte", "americano", "咖啡", "浓缩", "卡布奇诺", "拿铁"],
    card: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=136&h=136&fit=crop&auto=format",
    hero: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&h=400&fit=crop&auto=format",
  },
  {
    patterns: ["tea", "matcha", "chai", "茶", "抹茶"],
    card: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=136&h=136&fit=crop&auto=format",
    hero: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&h=400&fit=crop&auto=format",
  },
  {
    patterns: ["beer", "draft beer", "lager", "ale", "stout", "pilsner", "asahi", "heineken", "budweiser", "corona", "啤酒", "生啤酒", "生啤", "精酿"],
    card: "https://images.unsplash.com/photo-1566632776289-2a5f5b9b6e4e?w=136&h=136&fit=crop&auto=format",
    hero: "https://images.unsplash.com/photo-1566632776289-2a5f5b9b6e4e?w=600&h=400&fit=crop&auto=format",
  },
  {
    patterns: ["wine", "red wine", "white wine", "rosé", "vin", "vino", "红酒", "白酒", "葡萄酒", "杯装酒"],
    card: "https://images.unsplash.com/photo-1474722883777-792e7990302f?w=136&h=136&fit=crop&auto=format",
    hero: "https://images.unsplash.com/photo-1474722883777-792e7990302f?w=600&h=400&fit=crop&auto=format",
  },
  {
    patterns: ["whiskey", "whisky", "scotch", "bourbon", "威士忌"],
    card: "https://images.unsplash.com/photo-1572715376701-579e0b0e88a5?w=136&h=136&fit=crop&auto=format",
    hero: "https://images.unsplash.com/photo-1572715376701-579e0b0e88a5?w=600&h=400&fit=crop&auto=format",
  },
  {
    patterns: ["shochu", "soju", "烧酒", "烧酎", "韩国烧酒", "日本烧酒", "芋", "麦烧酒", "薯烧酒"],
    card: "https://images.unsplash.com/photo-1599300298645-398187537a19?w=136&h=136&fit=crop&auto=format",
    hero: "https://images.unsplash.com/photo-1599300298645-398187537a19?w=600&h=400&fit=crop&auto=format",
  },
  {
    patterns: ["plum wine", "ume", "umeshu", "梅酒", "梅子酒"],
    card: "https://images.unsplash.com/photo-1584319302131-3c5fce30c0b4?w=136&h=136&fit=crop&auto=format",
    hero: "https://images.unsplash.com/photo-1584319302131-3c5fce30c0b4?w=600&h=400&fit=crop&auto=format",
  },
  {
    patterns: ["sake", "nihonshu", "清酒", "日本酒", "daiginjo", "junmai"],
    card: "https://images.unsplash.com/photo-1576800651266-77a58ce2f10b?w=136&h=136&fit=crop&auto=format",
    hero: "https://images.unsplash.com/photo-1576800651266-77a58ce2f10b?w=600&h=400&fit=crop&auto=format",
  },
  {
    patterns: ["cocktail", "martini", "margarita", "mojito", "鸡尾酒"],
    card: "https://images.unsplash.com/photo-1551024709-8f5b2d99e352?w=136&h=136&fit=crop&auto=format",
    hero: "https://images.unsplash.com/photo-1551024709-8f5b2d99e352?w=600&h=400&fit=crop&auto=format",
  },
  {
    patterns: ["champagne", "sparkling", "prosecco", "香槟", "起泡酒", "气泡酒"],
    card: "https://images.unsplash.com/photo-1594144355189-40b46e72efd8?w=136&h=136&fit=crop&auto=format",
    hero: "https://images.unsplash.com/photo-1594144355189-40b46e72efd8?w=600&h=400&fit=crop&auto=format",
  },
  {
    patterns: ["酒", "alcohol", "liquor", "spirit", "drink", "beverage"],
    card: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=136&h=136&fit=crop&auto=format",
    hero: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600&h=400&fit=crop&auto=format",
  },
  {
    patterns: ["juice", "smoothie", "lemonade", "果汁", "冰沙", "柠檬水"],
    card: "https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=136&h=136&fit=crop&auto=format",
    hero: "https://images.unsplash.com/photo-1622597467836-f2131b8?w=600&h=400&fit=crop&auto=format",
  },
  {
    patterns: ["ham", "jambon", "prosciutto", "parma", "cold cut", "charcuterie", "salami", "sausage", "saucisson", "火腿", "香肠", "冷切", "肉肠", "萨拉米"],
    card: "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=136&h=136&fit=crop&auto=format",
    hero: "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=600&h=400&fit=crop&auto=format",
  },
];

const diverseFallbacks = [
  "https://images.unsplash.com/photo-1414235077428-338989a2e8c0",
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836",
  "https://images.unsplash.com/photo-1544025162-d76694265947",
  "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327",
  "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd",
  "https://images.unsplash.com/photo-1467003909585-2f8a72700288",
];

function localized(value: Dish["name_translated"] | Dish["description"] | string | undefined): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.zh || value.en || Object.values(value)[0] || "";
}

function hashStr(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (Math.imul(31, h) + value.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function getDishText(dish: Dish): DishText {
  const translatedName = localized(dish.name_translated) || dish.name_original || "未命名菜品";
  const description = localized(dish.description);
  const originalName = dish.name_original || translatedName;
  const searchText = [
    originalName,
    translatedName,
    description,
    dish.category || "",
    dish.cuisine_region || "",
    ...(dish.ingredients || []),
    ...(dish.taste_profile || []),
  ]
    .join(" ")
    .toLowerCase();

  return { originalName, translatedName, description, searchText };
}

export function getDishImageUrl(dish: Dish, size: "card" | "hero" = "card"): string {
  const existingImage = dish.ai_image_url || (dish as { image_url?: string }).image_url;
  if (dish.image_source === "user" && existingImage) return existingImage;

  // Check local pre-built image database
  const localImage = matchLocalImage(dish);
  if (localImage) return size === "hero" ? localImage.hero : localImage.card;

  if (existingImage) return existingImage;

  // Fallback to Unsplash keyword rules
  const text = getDishText(dish).searchText;
  const matched = imageRules.find((rule) =>
    rule.patterns.some((pattern) => text.includes(pattern.toLowerCase()))
  );
  if (matched) return matched[size];

  const base = diverseFallbacks[hashStr(text || dish.id) % diverseFallbacks.length];
  const dimensions = size === "card" ? "w=136&h=136" : "w=600&h=400";
  return `${base}?${dimensions}&fit=crop&auto=format`;
}

export function isDishImagePending(dish: Dish): boolean {
  const localImage = matchLocalImage(dish);
  if (localImage) return false;

  const existingImage = dish.ai_image_url || (dish as { image_url?: string }).image_url;
  if (!existingImage) return true;
  if (/images\.unsplash\.com|image\.pollinations\.ai|dashscope-result.*aliyuncs\.com/i.test(existingImage)) return true;
  return false;
}

function matchLocalImage(dish: Dish): { card: string; hero: string } | null {
  const matched = matchDishKnowledgeImage(dish);
  return matched ? { card: matched.card, hero: matched.hero } : null;
}

export function isVegetarianDish(dish: Dish): boolean {
  const ingredients = dish.ingredients || [];
  if ((dish.taste_profile || []).includes("vegetarian")) return true;
  if (ingredients.length === 0) return /salad|沙拉|vegetable|蔬菜|mozzarella|奶酪/i.test(getDishText(dish).searchText);
  return ingredients.every(
    (ing) => !/肉|鱼|鸡|牛|猪|羊|虾|蟹|贝|蛋|lamb|beef|pork|chicken|fish|meat|seafood|egg/i.test(ing)
  );
}

export function getDishInsight(dish: Dish): DishInsight {
  const { translatedName, description, searchText } = getDishText(dish);
  const isVeg = isVegetarianDish(dish);
  const isFried = /fried|炸|煎|calamari|鱿鱼/.test(searchText);
  const isDessert = /dessert|cake|sweet|甜|蛋糕|挞/.test(searchText);
  const isSeafood = /fish|seafood|salmon|sole|calamari|鱼|海鲜|鱿鱼/.test(searchText);
  const isHearty = /beef|steak|chicken|pork|lamb|牛排|牛肉|鸡肉|猪|羊/.test(searchText);
  const isSalad = /salad|沙拉|fresh|蔬菜/.test(searchText);
  const isDrink = /coffee|espresso|expresso|cappuccino|latte|americano|tea|matcha|chai|wine|beer|cocktail|juice|smoothie|lemonade|咖啡|浓缩|卡布奇诺|拿铁|茶|抹茶|酒|啤酒|鸡尾酒|果汁|冰沙/.test(searchText);
  const baseDescription = description || `${translatedName} 是一道适合作为菜单参考的菜品，重点看食材、烹饪方式和风味强度。`;

  // AI-generated fields take priority
  const aiRecommendation = localized(dish.recommendation);
  const aiGoodFor = localized(dish.good_for);
  const aiCaution = localized(dish.caution);

  let recommendation = "这道菜风味温和不刺激，适合第一次尝试该菜系的人。如果你想吃一顿不出错的正餐，这是一个稳妥的选择。";
  if (isDrink) recommendation = "如果你想点一杯佐餐或餐后的饮品，这是不错的选择。可以根据个人口味选择热饮或冷饮，搭配甜点或单独享用都很合适。";
  else if (isFried) recommendation = "如果你喜欢外酥里嫩的口感，这道菜不会让你失望。炸制食物讲究趁热吃，上桌后尽快享用风味最佳。挤点柠檬汁或蘸上店家特调酱汁，能让层次更丰富。";
  else if (isDessert) recommendation = "如果你还有胃口，强烈推荐用这道甜品为整顿饭画上句号。甜食搭配浓缩咖啡或红茶尤其出色，也可以和朋友分着吃，不会太腻。";
  else if (isSeafood) recommendation = "如果你钟爱鲜味和海洋气息，这道菜值得一试。重点在于食材的新鲜度——好的海鲜料理能让你一口尝到海的清甜。注意看是否配奶油或黄油酱汁，会影响整体口感走向。";
  else if (isHearty) recommendation = "如果你今天想吃一顿扎实过瘾的正餐，这就是答案。浓郁的酱汁、饱满的肉香，适合饿了一天之后好好犒劳自己。一个人点一份通常足够，不太建议再点太多其他主菜。";
  else if (isSalad) recommendation = "想吃点清爽的、给胃减减负担？选它没错。新鲜蔬菜搭配酱汁，既开胃又不会占太多胃容量。不过如果只点这一道当正餐，可能会觉得不够饱，建议再配一份主食或汤。";

  let goodFor = "适合第一次看菜单时作为安全选择，也适合想尝试经典口味但不愿冒险的人。";
  if (isDrink) goodFor = "适合佐餐、餐后小憩或下午茶时段。也可以作为不喝酒的社交替代饮品。";
  else if (isFried) goodFor = "适合作为开胃前菜或和朋友分食的小吃，也可以点几道不同的炸物拼盘尝鲜。";
  else if (isDessert) goodFor = "适合饭后与同伴分享甜蜜时刻，不建议当正餐单独点。搭配茶或咖啡体验更佳。";
  else if (isHearty) goodFor = "适合作为正餐的核心主菜，一个人一份通常够饱。胃口大的可以再配一道汤或小菜。";
  else if (isSalad) goodFor = "适合作为配菜搭配主菜，或者想吃得清淡健康时作为轻食。也可以当开胃菜打开味蕾。";

  let caution = "如果你有食物过敏或特殊忌口，点单前建议向服务员确认酱汁和隐藏配料，有些菜可能含有坚果、乳制品或鱼类高汤。";
  if (isDrink) caution = "注意咖啡因含量，下午较晚时段建议选低咖啡因或花草茶。对乳糖不耐的人注意拿铁和卡布奇诺含牛奶。";
  else if (isFried) caution = "油炸菜热量较高，如果正在控制油脂摄入或不太能吃油腻食物，建议谨慎选择或和朋友分食。";
  else if (isSeafood) caution = "海鲜过敏者务必注意，这道菜可能含贝类、虾蟹或鱼类高汤。点单前一定要向餐厅确认具体食材和交叉污染风险。";
  else if (isDessert) caution = "甜品通常含较多糖分、乳制品和鸡蛋。如果你在控糖、有乳糖不耐或鸡蛋过敏，建议先确认成分。";
  else if (isVeg) caution = "看起来是素食，但部分菜可能使用蛋奶、鱼露或高汤调味。如果你是严格素食者，建议和餐厅确认具体配料。";

  return {
    summary: baseDescription,
    recommendation: aiRecommendation || recommendation,
    goodFor: aiGoodFor || goodFor,
    caution: aiCaution || caution,
    confidenceLabel: dish.rating_avg ? `食客评分 ${dish.rating_avg}` : "AI 推荐参考",
  };
}
