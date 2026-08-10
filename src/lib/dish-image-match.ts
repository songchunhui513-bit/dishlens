import dishKnowledgeDb from "../../public/dish-knowledge-db.json";
import generatedDishLocalIndex from "../../public/generated-dish-local-index.json";
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

type GeneratedDishLocalEntry = {
  id: string;
  names: string[];
  context_terms?: string[];
  category?: string;
  card: string;
  hero: string;
  source?: string;
};

const LOCAL_IMAGE_OVERRIDES: Array<{
  patterns: string[];
  id: string;
  card: string;
  hero: string;
  names: string[];
}> = [
  {
    patterns: ["la reine", "pizza reine", "pizza prosciutto e funghi", "prosciutto funghi pizza", "ham mushrooms olives", "jambon champignons olives", "皇后披萨"],
    id: "pizza-prosciutto-funghi",
    card: "/dishes/pizza-prosciutto-funghi.webp",
    hero: "/dishes/pizza-prosciutto-funghi.webp",
    names: ["Pizza Prosciutto e Funghi", "La Reine", "皇后披萨"],
  },
  {
    patterns: ["la genovese", "pizza genovese", "pesto genovese fior di latte", "热那亚披萨"],
    id: "pizza-genovese",
    card: "/dishes/pizza-genovese.webp",
    hero: "/dishes/pizza-genovese.webp",
    names: ["Pizza Genovese", "La Genovese", "热那亚披萨"],
  },
  {
    patterns: ["trois fromages", "three cheese pizza", "quattro formaggi", "三奶酪披萨", "四奶酪披萨"],
    id: "pizza-quattro-formaggi",
    card: "/dishes/pizza-quattro-formaggi.webp",
    hero: "/dishes/pizza-quattro-formaggi.webp",
    names: ["Pizza Quattro Formaggi", "La Trois Fromages", "三奶酪披萨"],
  },
  {
    patterns: ["la jardin", "pizza jardin", "jardin", "seasonal vegetables", "legumes de saison", "花园披萨", "蔬菜披萨"],
    id: "pizza-quattro-stagioni",
    card: "/dishes/pizza-quattro-stagioni.webp",
    hero: "/dishes/pizza-quattro-stagioni.webp",
    names: ["Pizza Quattro Stagioni", "La Jardin", "花园披萨"],
  },
  {
    patterns: ["la pizza cioccolato", "pizza cioccolato", "pizza chocolate", "chocolate pizza", "巧克力披萨", "甜味披萨"],
    id: "pizza-margherita",
    card: "/dishes/pizza-margherita.webp",
    hero: "/dishes/pizza-margherita.webp",
    names: ["Pizza al Cioccolato", "La Pizza Cioccolato", "巧克力披萨"],
  },
  {
    patterns: ["croquettes vg", "manchego corn chilli croquettes", "croquettes manchego", "炸奶酪丸", "炸丸子"],
    id: "bistro-croquettes",
    card: "/dishes/bistro-croquettes.webp",
    hero: "/dishes/bistro-croquettes.webp",
    names: ["Bistro Croquettes", "Croquettes VG", "炸奶酪丸"],
  },
  {
    patterns: ["banana fritter", "fried banana mango", "banana mango sauce", "香蕉炸饼", "炸香蕉"],
    id: "banana-fritter",
    card: "/dishes/banana-fritter.webp",
    hero: "/dishes/banana-fritter.webp",
    names: ["Banana Fritter", "香蕉炸饼"],
  },
  {
    patterns: ["matcha roll", "matcha pastry cake", "抹茶卷", "抹茶蛋糕卷"],
    id: "matcha-roll",
    card: "/dishes/matcha-roll.webp",
    hero: "/dishes/matcha-roll.webp",
    names: ["Matcha Roll", "抹茶卷"],
  },
  {
    patterns: ["mochi black sesame", "black sesame ice cream filling", "麻糬", "麻薯", "黑芝麻麻薯"],
    id: "black-sesame-mochi",
    card: "/dishes/black-sesame-mochi.webp",
    hero: "/dishes/black-sesame-mochi.webp",
    names: ["Black Sesame Mochi", "黑芝麻麻薯"],
  },
  {
    patterns: ["albacore tuna", "smoked soy soba", "tuna soba", "金枪鱼刺身", "金枪鱼荞麦面"],
    id: "albacore-tuna-soba",
    card: "/dishes/albacore-tuna-soba.webp",
    hero: "/dishes/albacore-tuna-soba.webp",
    names: ["Albacore Tuna with Soba", "金枪鱼荞麦面"],
  },
];

const DIRECT_ALIASES: Array<{ patterns: string[]; id: string }> = [
  { patterns: ["marinara"], id: "pizza-marinara" },
  { patterns: ["margherita"], id: "pizza-margherita" },
  { patterns: ["diavola"], id: "pizza-diavola" },
  { patterns: ["capriccioza", "capricciosa", "pizza capricciosa", "capricciosa pizza"], id: "pizza-capricciosa" },
  { patterns: ["caesar", "caesar salad", "凯撒沙拉"], id: "caesar-salad" },
  { patterns: ["vitello tonnato", "tonnato"], id: "vitello-tonnato" },
  { patterns: ["turkish baklava", "baklava turkish", "土耳其果仁蜜饼"], id: "baklava-turkish" },
  { patterns: ["middle eastern baklava", "arabic baklava", "baklava me", "中东果仁蜜饼"], id: "baklava-me" },
  { patterns: ["pizza burrata e prosciutto", "burrata prosciutto pizza", "burrata and prosciutto pizza", "布拉塔火腿披萨"], id: "pizza-burrata-prosciutto" },
  { patterns: ["prosciutto e melone", "prosciutto con melone", "prosciutto with melon", "ham with melon", "火腿蜜瓜"], id: "prosciutto-e-melone" },
  { patterns: ["burrata con pomodorini", "burrata e pomodorini", "burrata with tomato", "burrata番茄", "布里塔配小番茄", "布拉塔配番茄"], id: "burrata-con-pomodorini" },
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
  { patterns: ["heirloom tomato", "buffalo mozzarella tomato", "tomato buffalo mozzarella", "番茄水牛芝士"], id: "burrata-con-pomodorini" },
  { patterns: ["unagi don", "unagi donburi", "unadon", "eel don", "eel rice bowl", "鳗鱼饭", "鳗鱼丼"], id: "unagi-don" },
  { patterns: ["warabimochi", "warabi mochi", "bracken mochi", "bracken starch mochi", "蕨饼"], id: "warabimochi" },
  { patterns: ["cheonggukjang", "fermented soybean stew", "清国酱汤", "清国酱"], id: "cheonggukjang" },
  { patterns: ["doenjang jjigae", "doenjang stew", "soybean paste stew", "大酱汤", "大酱湯"], id: "doenjang-jjigae" },
  { patterns: ["gochujang jjigae", "gochujang stew", "辣椒酱汤", "辣酱汤"], id: "gochujang-jjigae" },
  { patterns: ["galbi", "kalbi", "korean short ribs", "grilled short ribs", "韩式牛排骨", "갈비"], id: "galbi" },
  { patterns: ["galbitang", "short rib soup", "beef short rib soup", "牛排骨汤"], id: "galbitang" },
  { patterns: ["gyoza", "japanese dumplings", "japanese pan fried dumplings", "日式煎饺", "餃子"], id: "gyoza" },
  { patterns: ["hotteok", "korean sweet pancake", "sweet pancake", "韩式糖饼", "호떡"], id: "hotteok" },
  { patterns: ["inari sushi", "fried tofu pouch sushi", "稻荷寿司", "稲荷寿司"], id: "inari-sushi" },
  { patterns: ["jajangmyeon", "jjajangmyeon", "black bean noodles", "korean black bean noodles", "韩式炸酱面", "자장면", "짜장면"], id: "jajangmyeon" },
  { patterns: ["japchae", "glass noodle stir fry", "glass noodle stir-fry", "korean glass noodles", "韩式杂菜", "잡채"], id: "japchae" },
  { patterns: ["jokbal", "braised pig's feet", "braised pigs feet", "korean braised pork trotter", "韩式卤猪蹄", "족발"], id: "jokbal" },
  { patterns: ["kakigori", "japanese shaved ice", "shaved ice", "刨冰", "かき氷"], id: "kakigori" },
  { patterns: ["karaage", "japanese fried chicken", "日式炸鸡块", "唐揚げ"], id: "karaage" },
  { patterns: ["middle eastern muhammara", "muhammara me", "arabic muhammara", "中东核桃辣酱"], id: "muhammara-me" },
  { patterns: ["lebanese muhammara", "muhammara lebanese", "muhammara", "核桃辣酱"], id: "muhammara-lebanese" },
  { patterns: ["hainan chicken rice", "hainanese chicken rice", "海南鸡饭"], id: "hainanese-chicken-rice" },
  { patterns: ["japanese curry", "japanese curry rice", "kare raisu", "kare rice", "日式咖喱饭"], id: "japanese-curry" },
  { patterns: ["dorayaki", "red bean pancake", "铜锣烧", "铜鑼烧", "どら焼き"], id: "dorayaki" },
  { patterns: ["omurice", "omelette rice", "omelet rice", "蛋包饭", "オムライス"], id: "omurice" },
  { patterns: ["bossam", "bo ssam", "bo-ssam", "boiled pork wraps", "korean boiled pork", "보쌈", "韩式水煮五花肉"], id: "bossam" },
  { patterns: ["onigiri", "rice ball", "japanese rice ball", "おにぎり", "日式饭团"], id: "onigiri" },
  { patterns: ["smorrebrod", "smørrebrød", "open faced rye sandwich", "danish open sandwich", "丹麦开放式三明治"], id: "smorrebrod" },
  { patterns: ["takoyaki", "octopus balls", "たこ焼き", "章鱼烧"], id: "takoyaki" },
  { patterns: ["taiyaki", "tai yaki", "たい焼き", "鲷鱼烧", "日式鲷鱼烧"], id: "taiyaki" },
  { patterns: ["tsukemen", "dipping noodles", "蘸面", "つけ麺"], id: "tsukemen" },
  { patterns: ["tteokguk", "korean rice cake soup", "rice cake soup", "年糕汤", "떡국"], id: "tteokguk" },
  { patterns: ["tteokbokki", "tteok-bokki", "spicy rice cakes", "korean spicy rice cakes", "炒年糕", "韩式炒年糕", "떡볶이"], id: "tteokbokki" },
  { patterns: ["yukgaejang", "korean spicy beef soup", "spicy beef soup", "辣牛肉汤", "육개장"], id: "yukgaejang" },
  { patterns: ["yakisoba", "yaki soba", "japanese fried noodles", "日式炒面", "焼きそば"], id: "yakisoba" },
  { patterns: ["udon", "udon noodles", "乌冬面", "うどん"], id: "udon" },
  { patterns: ["yudofu", "hot tofu", "汤豆腐", "湯豆腐"], id: "yudofu" },
  { patterns: ["anmitsu", "japanese anmitsu", "red bean jelly dessert", "馅蜜", "あんみつ"], id: "anmitsu" },
  { patterns: ["bibim guksu", "spicy mixed noodles", "korean spicy mixed noodles", "韩式拌面", "비빔국수"], id: "bibim-guksu" },
  { patterns: ["bibim naengmyeon", "spicy cold noodles", "korean spicy cold noodles", "韩式拌冷面", "비빔냉면"], id: "bibim-naengmyeon" },
  { patterns: ["bingsu", "patbingsu", "shaved ice dessert", "korean shaved ice", "韩式刨冰", "빙수"], id: "bingsu" },
  { patterns: ["bo luc lac", "bò lúc lắc", "shaking beef", "vietnamese shaking beef", "越式摇摇牛肉"], id: "bo-luc-lac" },
  { patterns: ["mushroom bruschetta", "bruschetta ai funghi", "funghi bruschetta", "蘑菇烤面包", "蘑菇布鲁斯凯塔"], id: "bruschetta-ai-funghi" },
  { patterns: ["bruschetta", "bruschetta al pomodoro", "tomato bruschetta", "番茄烤面包"], id: "bruschetta-al-pomodoro" },
  { patterns: ["bulgogi", "korean bulgogi", "marinated grilled beef", "韩式烤肉", "불고기"], id: "bulgogi" },
  { patterns: ["cao lau", "cao lầu", "hoi an noodles", "会安高楼面"], id: "cao-lau" },
  { patterns: ["cassata siciliana", "sicilian cassata", "cassata", "西西里卡萨塔蛋糕"], id: "cassata-siciliana" },
  { patterns: ["chebakia", "shebakia", "moroccan sesame honey cookie", "花形蜂蜜饼干"], id: "chebakia" },
  { patterns: ["cendol", "chendol", "煎蕊", "煎蕊冰"], id: "chendol" },
  { patterns: ["chicken korma", "creamy chicken curry", "奶油鸡咖喱"], id: "chicken-korma" },
  { patterns: ["chiles en nogada", "chiles nogada", "stuffed poblano peppers in walnut sauce", "核桃酱酿辣椒"], id: "chiles-en-nogada" },
  { patterns: ["churros con chocolate", "churros with chocolate", "吉拿棒配巧克力"], id: "churros-con-chocolate" },
  { patterns: ["kanelbulle", "cinnamon roll", "swedish cinnamon roll", "瑞典肉桂卷"], id: "cinnamon-roll-scandinavian" },
  { patterns: ["cochinillo asado", "roast suckling pig", "spanish suckling pig", "烤乳猪"], id: "cochinillo-asado" },
  { patterns: ["crema catalana", "catalan cream", "加泰罗尼亚焦糖布丁"], id: "crema-catalana" },
  { patterns: ["crostata di marmellata", "jam tart", "italian jam tart", "果酱塔"], id: "crostata-di-marmellata" },
  { patterns: ["dakgalbi", "dak galbi", "spicy stir fried chicken", "spicy stir-fried chicken", "春川辣炒鸡排", "닭갈비"], id: "dakgalbi" },
  { patterns: ["gozleme", "turkish gozleme", "turkish stuffed flatbread", "土耳其馅饼"], id: "gozleme" },
  { patterns: ["temaki", "hand roll", "sushi hand roll", "手巻き", "手卷", "手捲"], id: "temaki" },
  { patterns: ["arroz con mariscos", "seafood rice", "peruvian seafood rice", "秘鲁海鲜饭"], id: "arroz-con-mariscos" },
  { patterns: ["arroz negro", "black rice", "squid ink rice", "墨鱼汁饭"], id: "arroz-negro" },
  { patterns: ["bacalao al pil pil", "cod in garlic emulsion", "pil pil cod", "蒜香鳕鱼"], id: "bacalao-al-pil-pil" },
  { patterns: ["banh trang tron", "bánh tráng trộn", "mixed rice paper salad", "vietnamese rice paper salad", "越南米纸沙拉"], id: "banh-trang-tron" },
  { patterns: ["shahi paneer", "royal paneer curry", "皇室芝士咖喱"], id: "shahi-paneer" },
  { patterns: ["tacos al pastor", "pork pineapple tacos", "pastor taco", "pastor tacos", "牧羊人塔可"], id: "tacos-al-pastor" },
  { patterns: ["tamagoyaki", "japanese omelette", "rolled japanese omelette", "玉子焼き", "日式煎蛋卷"], id: "tamagoyaki" },
  { patterns: ["tebasaki", "nagoya chicken wings", "fried chicken wings", "手羽先", "名古屋炸鸡翅"], id: "tebasaki" },
  { patterns: ["teriyaki chicken", "chicken teriyaki", "照り焼きチキン", "照烧鸡"], id: "teriyaki-chicken" },
  { patterns: ["thai kanom jeen", "kanom jeen", "khanom jeen", "kanom chin", "khanom chin", "ขนมจีน"], id: "kanom-jeen" },
  { patterns: ["kibbeh", "middle eastern kibbeh", "lebanese kibbeh", "kibbeh croquettes", "炸肉丸"], id: "kibbeh-me" },
  { patterns: ["street dumplings", "potstickers", "pan fried dumplings", "pan-fried dumplings", "锅贴", "煎饺"], id: "dumplings-street" },
];

const STOPWORDS = new Set([
  "la", "le", "les", "du", "de", "des", "di", "al", "alla", "the", "and",
  "with", "moment", "inspiration", "chef", "mauro", "notre", "facon", "façon",
  "bio", "organic", "salade", "salad",
]);

const MENU_MARKER_SUFFIX_TOKENS = new Set([
  "l", "lg", "gf", "gfo", "df", "dfo", "of", "vg", "v", "ve", "vgo", "vgn", "lvg", "lgfo", "ldf", "ldfo", "gfof", "lgeo",
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
    .replace(/[øØ]/g, "o")
    .replace(/[œŒ]/g, "oe")
    .replace(/[æÆ]/g, "ae")
    .replace(/[™®©]/g, " ")
    .toLowerCase()
    .replace(/^\s*(?:no\.?|#)?\s*\d{1,3}\s+[\-.)、]?\s*/i, "")
    .replace(/[€$£¥₹]\s*\d+(?:[,.]\d+)?|\d+(?:[,.]\d+)?\s*(?:€|eur|euros?|usd|gbp|元|円|₹)/gi, " ")
    .replace(/[«»"“”'’`´.,;:!?()[\]{}+*/\\|_~^=<>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripMenuMarkerSuffix(normalized: string): string {
  const parts = normalized.split(" ").filter(Boolean);
  let end = parts.length;
  while (end > 1 && MENU_MARKER_SUFFIX_TOKENS.has(parts[end - 1])) end--;
  return end < parts.length && end >= 1 ? parts.slice(0, end).join(" ") : normalized;
}

function stripComboMealWords(normalized: string): string {
  return normalized
    .replace(/\b(?:meal|combo|set|menu deal|value meal|box meal)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function generatedCacheNameVariants(value: string): string[] {
  const normalized = normalizeDishText(value);
  return Array.from(new Set([
    normalized,
    stripMenuMarkerSuffix(normalized),
    stripComboMealWords(normalized),
    stripMenuMarkerSuffix(stripComboMealWords(normalized)),
  ].filter((name) => name.length > 3)));
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
    localized(dish.description),
    ...(dish.ingredients || []),
    dish.category || "",
    dish.cuisine_region || "",
    dish.page_label || "",
  ].join(" ");
}

function isComboMealText(text: string): boolean {
  return /\b(?:meal|combo|set|menu deal|value meal|box meal|with fries|with drink|fries and drink|chips and drink)\b|套餐|组合餐|套饭|配薯条|配饮料|含饮品|含薯条/.test(text);
}

function containsNormalizedPhrase(text: string, pattern: string): boolean {
  const normalizedPattern = normalizeDishText(pattern);
  if (!normalizedPattern) return false;
  if (/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(normalizedPattern)) {
    return text.includes(normalizedPattern);
  }
  return text === normalizedPattern ||
    text.startsWith(`${normalizedPattern} `) ||
    text.includes(` ${normalizedPattern} `) ||
    text.endsWith(` ${normalizedPattern}`);
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

function matchGeneratedLocalIndex(queryText: string): DishImageMatch | null {
  const normalizedQuery = normalizeDishText(queryText);
  const queryVariants = new Set(generatedCacheNameVariants(queryText));
  let best: DishImageMatch | null = null;

  for (const entry of generatedDishLocalIndex as GeneratedDishLocalEntry[]) {
    if (!isLocalImageUrl(entry.card) || !isLocalImageUrl(entry.hero)) continue;

    const names = entry.names.flatMap(generatedCacheNameVariants);
    const contextTerms = (entry.context_terms || []).map(normalizeDishText).filter(Boolean);
    const hasRequiredContext = contextTerms.length === 0 ||
      contextTerms.some((term) => containsNormalizedPhrase(normalizedQuery, term));
    const matched = names.some((name) =>
      queryVariants.has(name) ||
      (hasRequiredContext && (
        normalizedQuery.startsWith(`${name} `) ||
        normalizedQuery.includes(` ${name} `)
      ))
    );
    if (!matched) continue;

    const normalizedEntryId = normalizeDishText(entry.id.replace(/^local-generated-/, ""));
    const exactNameMatch = (entry.names || []).some((name) => normalizeDishText(name) === normalizedQuery);
    const variantNameMatch = !exactNameMatch && names.some((name) => queryVariants.has(name));
    const score =
      (exactNameMatch ? 0.96 : variantNameMatch ? 0.955 : 0.94) +
      (normalizedEntryId === normalizedQuery ? 0.04 : 0);
    const candidate = {
      id: entry.id,
      card: entry.card,
      hero: entry.hero,
      entry: {
        id: entry.id,
        names: entry.names,
        cuisine: "generated-local",
        category: entry.category || "main",
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
        card: entry.card,
        hero: entry.hero,
      },
      score,
    };
    if (!best || candidate.score > best.score) best = candidate;
  }

  return best;
}

export function matchDishKnowledgeImage(dish: DishLike): DishImageMatch | null {
  const queryText = textForDish(dish);
  const normalizedQuery = normalizeDishText(queryText);

  if (isComboMealText(normalizedQuery)) {
    const generatedLocalMatch = matchGeneratedLocalIndex(queryText);
    return generatedLocalMatch || null;
  }

  for (const override of LOCAL_IMAGE_OVERRIDES) {
    if (override.patterns.some((pattern) => containsNormalizedPhrase(normalizedQuery, pattern))) {
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
    if (alias.patterns.some((pattern) => containsNormalizedPhrase(normalizedQuery, pattern))) {
      const entry = (dishKnowledgeDb as DishKnowledgeEntry[]).find((item) => item.id === alias.id);
      if (entry && isLocalImageUrl(entry.card) && isLocalImageUrl(entry.hero)) {
        return { id: entry.id, card: entry.card, hero: entry.hero, entry, score: 0.92 };
      }
    }
  }

  const generatedLocalMatch = matchGeneratedLocalIndex(queryText);
  if (generatedLocalMatch) return generatedLocalMatch;

  const hasProsciutto = containsNormalizedPhrase(normalizedQuery, "prosciutto");
  const hasMelon = containsNormalizedPhrase(normalizedQuery, "melone") ||
    containsNormalizedPhrase(normalizedQuery, "melon") ||
    containsNormalizedPhrase(normalizedQuery, "蜜瓜");
  if (hasProsciutto && !hasMelon) return null;

  const hasBurrata = containsNormalizedPhrase(normalizedQuery, "burrata") ||
    containsNormalizedPhrase(normalizedQuery, "布拉塔") ||
    containsNormalizedPhrase(normalizedQuery, "布里塔");
  const hasTomato = containsNormalizedPhrase(normalizedQuery, "pomodor") ||
    containsNormalizedPhrase(normalizedQuery, "tomato") ||
    containsNormalizedPhrase(normalizedQuery, "番茄");
  const isStandaloneBurrata = /^(?:burrata|布拉塔|布里塔|布里亚塔)$/.test(normalizedQuery);
  if (hasBurrata && !hasTomato && !isStandaloneBurrata) return null;

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
