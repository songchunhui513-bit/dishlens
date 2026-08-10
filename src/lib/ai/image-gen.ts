const LEGACY_DASHSCOPE_BASE = "https://dashscope.aliyuncs.com/api/v1";
const WAN_MODEL = process.env.WAN_MODEL || "wanx2.1-t2i-turbo";
const IMAGE_PROVIDER = process.env.IMAGE_PROVIDER || "wan";
const MODEL_STUDIO_FAST_MODEL = process.env.ALIBABA_IMAGE_FAST_MODEL || "z-image-turbo";
const MODEL_STUDIO_QUALITY_MODEL = process.env.ALIBABA_IMAGE_FALLBACK_MODEL || "wan2.7-image";
const DEFAULT_POLL_INTERVAL_MS = 1500;
const DEFAULT_REQUEST_INTERVAL_MS = 1200;
const POLL_TIMEOUT = 60_000;

function envInt(name: string, fallback: number, min: number, max: number): number {
  const value = Number.parseInt(process.env[name] || "", 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

const POLL_INTERVAL = envInt(
  "MENU_IMAGE_GENERATION_POLL_INTERVAL_MS",
  DEFAULT_POLL_INTERVAL_MS,
  800,
  5000,
);
const IMAGE_GENERATION_RETRIES = Math.max(
  1,
  Math.min(3, Number.parseInt(process.env.MENU_IMAGE_GENERATION_RETRIES || "2", 10) || 2),
);
const REQUEST_INTERVAL_MS = envInt(
  "MENU_IMAGE_GENERATION_REQUEST_INTERVAL_MS",
  DEFAULT_REQUEST_INTERVAL_MS,
  400,
  5000,
);
const MODEL_STUDIO_FAST_TIMEOUT_MS = envInt(
  "ALIBABA_IMAGE_FAST_TIMEOUT_MS",
  15_000,
  3_000,
  60_000,
);
const MODEL_STUDIO_QUALITY_TIMEOUT_MS = envInt(
  "ALIBABA_IMAGE_QUALITY_TIMEOUT_MS",
  45_000,
  5_000,
  120_000,
);
const MODEL_STUDIO_MIN_REQUEST_INTERVAL_MS = envInt(
  "ALIBABA_IMAGE_REQUEST_INTERVAL_MS",
  550,
  250,
  5_000,
);
const MODEL_STUDIO_QUALITY_KINDS = new Set(
  (process.env.ALIBABA_IMAGE_QUALITY_KINDS || "drink,soup,seafood,meal")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);

function resolveModelStudioBaseUrl(): string {
  const explicit = process.env.ALIBABA_MODEL_STUDIO_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const workspaceId = process.env.ALIBABA_MODEL_STUDIO_WORKSPACE_ID?.trim();
  if (!workspaceId || !/^[a-zA-Z0-9-]+$/.test(workspaceId)) return "";
  return `https://${workspaceId}.ap-southeast-1.maas.aliyuncs.com/api/v1`;
}

const MODEL_STUDIO_BASE_URL = resolveModelStudioBaseUrl();
let modelStudioRequestGate = Promise.resolve();
let lastModelStudioRequestStartedAt = 0;

function getApiKey(): string {
  const key = process.env.QWEN_API_KEY || "";
  if (!key) throw new Error("QWEN_API_KEY is required for image generation");
  return key;
}

function getModelStudioApiKey(): string {
  const key = process.env.ALIBABA_MODEL_STUDIO_API_KEY || "";
  if (!key) throw new Error("ALIBABA_MODEL_STUDIO_API_KEY is required for Singapore image generation");
  return key;
}

async function waitForModelStudioRequestSlot(): Promise<void> {
  let releaseGate: () => void = () => {};
  const previousGate = modelStudioRequestGate;
  modelStudioRequestGate = new Promise<void>((resolve) => {
    releaseGate = resolve;
  });

  await previousGate;
  try {
    const waitMs = Math.max(
      0,
      MODEL_STUDIO_MIN_REQUEST_INTERVAL_MS - (Date.now() - lastModelStudioRequestStartedAt),
    );
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    lastModelStudioRequestStartedAt = Date.now();
  } finally {
    releaseGate();
  }
}

type DishImagePromptInput = {
  name_original: string;
  name_translated?: string | Record<string, string>;
  description?: string | Record<string, string>;
  ingredients?: string[];
  included_items?: string[];
  category?: string;
  image_prompt_hint?: string;
};

function localized(value: string | Record<string, string> | undefined): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.zh || value.en || Object.values(value)[0] || "";
}

const SEAFOOD_PATTERN = /seafood|fish|salmon|tuna|shrimp|prawn|scallop|clam|oyster|crab|lobster|eel|squid|calamari|shellfish|conch|whelk|sea snail|snail|escargot|海鲜|鱼|虾|蟹|贝|蚝|蛤|鲍|鳝|鱿鱼|花蛤|膏蟹|樱花虾|螺|花螺|海螺|响螺|田螺|蛏|扇贝/;
const COOKING_ALCOHOL_PATTERN = /(?:wine|beer|sake|shaoxing|huadiao|rice wine|red wine|white wine).{0,24}(?:sauce|stew|brais|cook|boil|simmer|steam|roast|grill)|(?:red wine|white wine|beer|shaoxing|huadiao|rice wine|sake|酒|红酒|白酒|啤酒|米酒|花雕|绍兴酒|料酒|黄酒|清酒).{0,10}(?:煮|炖|焗|烧|烩|蒸|炒|醉|浸|腌|卤)|(?:煮|炖|焗|烧|烩|蒸|炒|醉|浸|腌|卤).{0,10}(?:red wine|white wine|beer|shaoxing|huadiao|rice wine|sake|酒|红酒|白酒|啤酒|米酒|花雕|绍兴酒|料酒|黄酒|清酒)/;
const SOLID_FOOD_PATTERN = /beef|chicken|duck|pork|lamb|fish|crab|shrimp|prawn|shellfish|conch|whelk|clam|oyster|snail|escargot|tofu|egg|noodle|rice|vegetable|mushroom|牛|鸡|鸭|猪|羊|肉|鱼|虾|蟹|贝|蚝|蛤|鲍|鳝|鱿|螺|花螺|海螺|蛏|扇贝|豆腐|蛋|面|粉|饭|菜|菇|茄子|排骨/;
const PIZZA_PATTERN = /pizza|pizzas|pizzeria|margherita|marinara|diavola|genovese|napoletana|披萨|比萨|ピザ|薄饼|🍕/;
const CALZONE_PATTERN = /calzone|folded\s*pizza|折叠披萨|折疊披薩|半月形.*披萨|半月形.*披薩/;
const DRINK_PATTERN = /drink|beverage|coffee|tea|latte|cappuccino|espresso|cocktail|mocktail|juice|smoothie|lemonade|wine|beer|pommeau|calvados|cidre|cider|aperitif|apéritif|digestif|liqueur|spritz|glac[eé]|iced|奶茶|咖啡|茶|饮品|饮料|冰沙|冰饮|酒|果汁|苹果酒|利口酒|cola|coke|soda|soft drink/;
const STRONG_DRINK_PATTERN = /drink|beverage|cocktail|mocktail|juice|smoothie|lemonade|wine|beer|pommeau|calvados|cidre|cider|aperitif|apéritif|digestif|liqueur|spritz|glac[eé]|iced|饮品|饮料|冰沙|冰饮|啤酒|鸡尾酒|葡萄酒|红酒|白酒|果汁|苹果酒|利口酒|cola|coke|soda|soft drink/;
const DESSERT_PATTERN = /dessert|cake|pie|tart|pudding|ice cream|gelato|sweet|tiramisu|panna cotta|mousse|甜点|蛋糕|布丁|冰淇淋|提拉米苏|奶冻|慕斯|挞|派/;
const MEAL_PATTERN = /\b(?:meal|combo|set|menu deal|value meal|box meal|with fries|with drink|fries and drink|chips and drink)\b|套餐|组合餐|套饭|配薯条|配饮料|含饮品|含薯条/;
const RED_MULLET_PATTERN = /rouget\s*barbet|red\s*mullet|rouget|红鲻鱼|红鲻|鲻鱼/;
const FOIE_GRAS_PATTERN = /foie\s*gras|foie|鹅肝|肥肝|fegato\s*grasso/;
const SCALLOP_PATTERN = /scallop|coquille\s*st[-\s]?jacques|noix\s*de\s*st[-\s]?jacques|圣雅克|扇贝|带子|帆立|hotate|ほたて|ホタテ|capesante|vongole\s*veraci|vieira/;
const ESCARGOT_PATTERN = /escargot|snail|蜗牛|caracol|lumache|cargol|bourgogne.*snail|snail.*bourgogne/;
const BURRATA_PATTERN = /burrata|布拉塔|布拉塔奶酪|布拉塔芝士|stracciatella/;
const DESSERT_DRINK_PATTERN = /(?:affogato|irish\s*coffee|espresso\s*martini|tiramisu.*coffee|coffee.*dessert|巧克力.*酒|酒.*巧克力|朗姆.*蛋糕|rum.*cake|sabayon|zabaglione|baileys.*cream|奶酒|百利甜)/;
const STEAK_PATTERN = /steak|beef.*steak|牛排|肋眼|西冷|菲力|filet|ribeye|sirloin|t-bone|entrec[ôo]te|bistecca|chateaubriand|tournedos/;
const BIRYANI_PATTERN = /biryani|biriyani|biriani|比尔亚尼|印度香饭|印度焖饭/;
const BUBBLE_TEA_PATTERN = /bubble\s*tea|boba|pearl\s*milk\s*tea|珍珠奶茶|波霸奶茶|黑糖珍珠/;
const INCA_COLA_PATTERN = /inca\s*cola|印加可乐/;
const BIRRIA_TACOS_PATTERN = /birria\s*tacos?|quesabirria|braised\s*beef\s*tacos?|比尔里亚.*塔可|炖牛肉塔可/;
const KATSUDON_PATTERN = /katsudon|katsu\s*don|cutlet\s*rice\s*bowl|カツ丼|炸猪排丼|炸豬排丼/;
const OYAKODON_PATTERN = /oyakodon|oyako\s*don|chicken\s*and\s*egg\s*rice\s*bowl|親子丼|亲子丼|親子どんぶり/;
const RAMUNE_PATTERN = /ramune|ramune\s*soda|ラムネ|波子汽水|弹珠汽水|彈珠汽水/;
const FOUL_MOUDAMMAS_PATTERN = /foul\s*moudammas|ful\s*medames|foul\s*medames|fava\s*bean|蚕豆泥|蚕豆/;
const GAJI_NAMUL_PATTERN = /gaji\s*namul|seasoned\s*eggplant|korean\s*eggplant|韩式拌茄子|拌茄子|가지나물/;
const KOREAN_SUNDAE_PATTERN = /korean\s*sundae|soondae|sundae.*blood|blood\s*sausage|韩式血肠|韓式血腸|血肠|순대/;
const KHAO_SOI_PATTERN = /khao\s*soi|泰北金面|ข้าวซอย/;
const TURKISH_LENTIL_SOUP_PATTERN = /mercimek\s*(?:ç|c)orbas[ıi]|turkish\s*lentil\s*soup|red\s*lentil\s*soup|土耳其红扁豆汤|红扁豆汤/;
const TTEOKGUK_PATTERN = /tteokguk|rice\s*cake\s*soup|korean\s*rice\s*cake\s*soup|年糕汤|韓式年糕湯|떡국/;
const YUKGAEJANG_PATTERN = /yukgaejang|spicy\s*beef\s*soup|korean\s*spicy\s*beef\s*soup|辣牛肉汤|辣牛肉湯|육개장/;
const RFISSA_PATTERN = /rfissa|رفيسة|moroccan\s*chicken.*(?:msemen|flatbread)|msemen.*chicken|摩洛哥鸡肉薄饼|摩洛哥.*薄饼/;
const SHABU_SHABU_PATTERN = /shabu[-\s]?shabu|しゃぶしゃぶ|涮涮锅|涮涮鍋/;
const SALTIMBOCCA_PATTERN = /saltimbocca|saltimbocca\s*alla\s*romana|veal.*prosciutto|prosciutto.*sage|罗马跳嘴肉|羅馬跳嘴肉/;
const BEYTI_KEBAB_PATTERN = /beyti\s*kebab|beyti\s*kebab[ıi]|贝伊提烤肉|貝伊提烤肉/;
const BO_LA_LOT_PATTERN = /b[oò]\s*l[aá]\s*l[oố]t|beef\s*in\s*betel\s*leaf|betel\s*leaf\s*beef|蒌叶牛肉|蒌叶牛肉卷|萎叶牛肉|越南.*牛肉卷/;
const BOSSAM_PATTERN = /bossam|bo[-\s]?ssam|boiled\s*pork\s*wraps?|korean\s*boiled\s*pork|보쌈|韩式水煮五花肉|韓式水煮五花肉/;
const ONIGIRI_PATTERN = /onigiri|rice\s*ball|japanese\s*rice\s*ball|おにぎり|日式饭团|飯糰|饭团/;
const TEMAKI_PATTERN = /temaki|hand\s*roll|手巻き|手卷|手捲/;
const BANH_TRANG_TRON_PATTERN = /b[aáàảãạ]nh\s*tr[aáàảãạ]ng\s*tr[oộ]n|banh\s*trang\s*tron|mixed\s*rice\s*paper\s*salad|越南米纸沙拉|米纸沙拉|米紙沙拉/;
const CALIFORNIA_ROLL_PATTERN = /california\s*roll|加州卷|カリフォルニアロール/;
const BUN_CHA_PATTERN = /b[uúùủũụ]n\s*ch[aảàáãạ]|bun\s*cha|越式烤肉米粉|grilled\s*pork\s*(?:rice\s*)?vermicelli/;
const BLACK_PEPPER_CRAB_PATTERN = /black\s*pepper\s*crab|黑胡椒螃蟹|黑椒蟹/;

function isAlcoholCookedDish(text: string): boolean {
  return COOKING_ALCOHOL_PATTERN.test(text) && SOLID_FOOD_PATTERN.test(text);
}

export function classifyDishImageKind(dish: DishImagePromptInput): "drink" | "soup" | "dessert" | "seafood" | "burger" | "wrap" | "sandwich" | "salad" | "pizza" | "meal" | "main" {
  const text = [
    dish.category || "",
    dish.name_original || "",
    localized(dish.name_translated),
    localized(dish.description),
    ...(dish.ingredients || []),
    ...(dish.included_items || []),
  ].join(" ").toLowerCase();
  const alcoholCookedDish = isAlcoholCookedDish(text);

  if (MEAL_PATTERN.test(text) || (dish.included_items?.length || 0) >= 2) {
    return "meal";
  }
  if (RFISSA_PATTERN.test(text) || SHABU_SHABU_PATTERN.test(text)) {
    return "main";
  }
  if (PIZZA_PATTERN.test(text)) {
    return "pizza";
  }
  const dessertLike = DESSERT_PATTERN.test(text);
  const drinkLike = DRINK_PATTERN.test(text);
  if (drinkLike && (!dessertLike || STRONG_DRINK_PATTERN.test(text)) && !alcoholCookedDish && !SOLID_FOOD_PATTERN.test(text)) {
    return "drink";
  }
  if (SEAFOOD_PATTERN.test(text)) {
    return "seafood";
  }
  if (BIRRIA_TACOS_PATTERN.test(text) || /taco|tacos|塔可/.test(text)) {
    return "main";
  }
  if (/soup|stew|broth|chowder|bisque|consomm|汤|羹|浓汤|清汤|炖/.test(text)) {
    return "soup";
  }
  if (dessertLike) {
    return "dessert";
  }
  if (/burger|hamburger|cheeseburger|双层|汉堡|牛肉堡|鸡腿堡|🍔/.test(text)) {
    return "burger";
  }
  if (/wrap|burrito|wraps|twister|卷饼|卷|鸡肉卷|老北京/.test(text)) {
    return "wrap";
  }
  if (/sandwich|sub|hoagie|panini|三明治|潜艇堡/.test(text)) {
    return "sandwich";
  }
  if (/salad|沙拉|salade|insalata|ensalada|蔬菜沙拉/.test(text)) {
    return "salad";
  }
  return "main";
}

function buildDishVisualProfile(dish: DishImagePromptInput, kind: ReturnType<typeof classifyDishImageKind>): string[] {
  const text = [
    dish.name_original || "",
    localized(dish.name_translated),
    localized(dish.description),
    ...(dish.ingredients || []),
    ...(dish.included_items || []),
  ].join(" ");
  const lowerText = text.toLowerCase();
  const profile: string[] = [];

  // ── Red Mullet ────────────────────────────────────────────
  if (RED_MULLET_PATTERN.test(lowerText)) {
    profile.push(
      "Specific visual identity: Rouget Barbet is a small Mediterranean red mullet, with red-orange skin, a slim modest-sized fish body, delicate white flesh, and refined French bistro plating. It may be lightly grilled or pan-seared whole, or served as small fillets when the description implies fillets.",
      "Negative visual guardrails: not sea bass, not salmon, not tuna, not cod, not a large generic grilled fish, not battered fish, not fish and chips.",
    );
  }

  // ── Foie Gras ─────────────────────────────────────────────
  if (FOIE_GRAS_PATTERN.test(lowerText)) {
    profile.push(
      "Specific visual identity: foie gras is a luxurious duck or goose liver preparation. It appears as a smooth pale-beige terrine slice, a seared lobe with golden-brown crust, or a torchon round. Plated on a small white plate, often accompanied by a fruit compote (fig, cherry), toasted brioche on the side, and a light drizzle of reduction sauce. Fine-dining presentation with precise plating.",
      "Negative visual guardrails: not a generic pâté, not a large meat steak, not a whole liver organ raw, not a salad bowl, not a drink. Use main-course framing, not seafood framing.",
    );
  }

  // ── Scallop ───────────────────────────────────────────────
  if (SCALLOP_PATTERN.test(lowerText)) {
    profile.push(
      "Specific visual identity: scallops are round, pale-cream medallions with a slightly firm surface and delicate coral (orange roe) optionally attached. They are typically seared with a golden-brown crust on top, served in a shell or on a small plate, 3-5 pieces. Garnished simply: butter, herb sprig, lemon wedge. Refined seafood presentation.",
      "Negative visual guardrails: not a whole fish, not shrimp with shell, not a bowl of mussels, not a generic fried seafood platter, not ceviche in a glass.",
    );
  }

  // ── Escargots ─────────────────────────────────────────────
  if (ESCARGOT_PATTERN.test(lowerText)) {
    profile.push(
      "Specific visual identity: escargots are 6-12 land snails served in a specialized escargot dish with round indentations (escargotière). Each snail sits in its shell cavity, topped with glistening garlic-parsley butter (green-flecked, bubbling). The dish is ceramic with 6 or 12 wells. Served with a small fork and crusty bread on the side. Rustic French bistro style.",
      "Negative visual guardrails: not a bowl of pasta shells, not seafood like clams or mussels in a pot, not a soup, not a garden slug raw. Shells are dark brown and spiraled, visible in the dish.",
    );
  }

  // ── Burrata ───────────────────────────────────────────────
  if (BURRATA_PATTERN.test(lowerText)) {
    profile.push(
      "Specific visual identity: burrata is a round, white, pillow-soft Italian cheese ball, about 10-12cm diameter. When cut open it reveals a creamy stracciatella interior (shredded mozzarella in cream). Served whole on a plate, often with cherry tomatoes, basil leaves, olive oil drizzle, and cracked pepper. The exterior is smooth mozzarella-like skin, the interior is visibly creamy and oozing.",
      "Negative visual guardrails: not a hard cheese wedge, not a pizza, not fried mozzarella sticks, not a drink, not a salad bowl without the cheese as the main subject.",
    );
  }

  // ── Dessert Drinks / Alcohol Desserts ─────────────────────
  if (DESSERT_DRINK_PATTERN.test(lowerText)) {
    profile.push(
      "Dessert-drink visual guardrail: this is a dessert that may contain or reference alcohol, coffee, or both. The final image must show the DESSERT FOOD as the primary subject — e.g. tiramisu, cake slice, or sabayon in a glass — not a cocktail glass, not a coffee cup alone, not a bar setting.",
      "Negative visual guardrails: not a martini glass, not an espresso cup as the main subject, not a bar counter, not a drink menu.",
    );
  }

  // ── Steak ─────────────────────────────────────────────────
  if (STEAK_PATTERN.test(lowerText)) {
    profile.push(
      "Specific visual identity: a steak is a thick-cut beef slice with visible grill marks or seared crust. Interior shows doneness level (pink-red for medium-rare, light pink for medium). Served on a warm plate, often with simple accompaniments: herb sprig, coarse salt, peppercorn crust, or a small butter pat melting on top. No heavy sauce drowning the meat.",
      "Negative visual guardrails: not a thin sliced stir-fry, not a stew or braise in liquid, not a burger patty, not raw meat, not a roast whole joint.",
    );
  }

  // ── Biryani ───────────────────────────────────────────────
  if (BIRYANI_PATTERN.test(lowerText)) {
    profile.push(
      "Specific visual identity: biryani is a layered spiced rice dish built from separate long-grain basmati rice, saffron-yellow and white rice grains, fried onions, whole spices, herbs, and visible meat or vegetables nestled between the rice layers. Serve as a heaped rice platter or handi bowl with fluffy separated grains, not a saucy curry bowl.",
      "Negative visual guardrails: not curry poured over plain white rice, not risotto, not fried rice, not paella, not a wet stew, not a smooth sauce covering the grains. The rice grains must stay distinct and layered.",
    );
  }

  // ── Bubble tea ────────────────────────────────────────────
  if (BUBBLE_TEA_PATTERN.test(lowerText)) {
    profile.push(
      "Specific visual identity: bubble tea is a cold milk tea in a transparent unbranded cup with visible black tapioca pearls gathered at the bottom, creamy tea color, ice cubes, and a plain straw. The cup wall must be completely blank, smooth, and undecorated.",
      "Negative visual guardrails: no printed text on the cup, no letters, no Chinese characters, no transliteration, no brand label, no logo, no menu text, not a coffee cup, not a plated dessert, not a smoothie bowl.",
    );
  }

  // ── Inca Cola ─────────────────────────────────────────────
  if (INCA_COLA_PATTERN.test(lowerText)) {
    profile.push(
      "Specific visual identity: Inca Cola is a bright golden-yellow soda served ice-cold in a clear unbranded glass or plain unbranded bottle, with visible carbonation bubbles, condensation, and a pale yellow foam ring. It should read as a yellow soda, not ordinary cola.",
      "Negative visual guardrails: not dark cola, not brown cola, not black soda, no brand label, no logo, no printed text, no can design, no commercial packaging.",
    );
  }

  // ── Birria tacos ─────────────────────────────────────────
  if (BIRRIA_TACOS_PATTERN.test(lowerText)) {
    profile.push(
      "Specific visual identity: birria tacos are small open U-shaped folded corn tortillas, not rolled wraps, filled with juicy slow-braised shredded beef and melted cheese, griddled until the tortillas have orange-red chile oil edges and crisp browned spots. Serve 2-3 half-folded tacos as the primary subject with chopped onion, cilantro, lime wedges, and a small cup of consomme dipping broth on the side.",
      "Negative visual guardrails: not a bowl of stew, not soup, not loose shredded beef in broth, not a burrito, not rolled wraps, not rolled cylinders, not nachos, not a plated enchilada. The tacos must be open half-folded tortillas and the consomme is only a small side cup for dipping.",
    );
  }

  // ── Katsudon ─────────────────────────────────────────────
  if (KATSUDON_PATTERN.test(lowerText)) {
    profile.push(
      "Specific visual identity: katsudon is a Japanese tonkatsu rice bowl: sliced breaded pork cutlet simmered with onion and soft-cooked egg, egg-bound and glossy, laid over steamed white rice in a donburi bowl. The cutlet slices remain visible under the tender yellow egg and translucent onion.",
      "Negative visual guardrails: not curry, no curry sauce, not katsu curry, not a flat plate of cutlet with brown sauce, not plain tonkatsu alone. It must read as a pork cutlet rice bowl with soft-cooked egg and onion.",
    );
  }

  // ── Oyakodon ─────────────────────────────────────────────
  if (OYAKODON_PATTERN.test(lowerText)) {
    profile.push(
      "Specific visual identity: oyakodon is a Japanese chicken and egg rice bowl: tender bite-size chicken pieces and translucent onion simmered in dashi, bound with soft-cooked egg, served over steamed white rice in a donburi bowl. The yellow egg ribbons and chicken pieces are the clear subject.",
      "Negative visual guardrails: not noodles, not soba, not udon, not ramen, not katsudon, not curry, not fried rice. It must read as chicken and egg over steamed white rice.",
    );
  }

  // ── Ramune ───────────────────────────────────────────────
  if (RAMUNE_PATTERN.test(lowerText)) {
    profile.push(
      "Specific visual identity: Ramune is a clear Japanese soda served in a distinctive Codd-neck glass bottle with a visible glass marble stopper in the neck, clear or very pale blue fizzy liquid, condensation, and ice-cold sparkle. Use a plain unbranded bottle with no printed label.",
      "Negative visual guardrails: not pink cocktail, not fruit juice, not lemonade in a tumbler, not a wine glass, not a can, no brand label, no logo, no printed text.",
    );
  }

  // ── Foul Moudammas ───────────────────────────────────────
  if (FOUL_MOUDAMMAS_PATTERN.test(lowerText)) {
    profile.push(
      "Specific visual identity: foul moudammas is a Middle Eastern breakfast bowl of whole fava beans and lightly crushed stewed beans, glossy with olive oil, lemon wedge, chopped tomato, parsley, cumin, and sometimes chili. The beans must remain visible as beans, rustic and chunky, served warm in a small bowl with pita on the side only if appropriate.",
      "Negative visual guardrails: not hummus, not a smooth chickpea puree, not guacamole, not a creamy beige dip, not a blended sauce. Do not make it a flat spread; show whole fava beans and chunky stewed beans clearly.",
    );
  }

  // ── Gaji Namul ───────────────────────────────────────────
  if (GAJI_NAMUL_PATTERN.test(lowerText)) {
    profile.push(
      "Specific visual identity: gaji namul is a Korean banchan of short chunky steamed eggplant pieces, not long strands. Each piece shows purple eggplant skin on the outside and pale beige eggplant flesh inside, with a glossy sesame oil sheen, sesame seeds, chopped scallion, and light soy-garlic seasoning. Serve as a small side dish in a shallow ceramic bowl.",
      "Negative visual guardrails: not kimchi, not noodles, not spicy napa cabbage, not stir-fried red pepper strips, not orange-red sauce, not a saucy stew. The subject must be recognizable eggplant chunks with purple skin and pale beige eggplant flesh.",
    );
  }

  // ── Korean Soondae ───────────────────────────────────────
  if (KOREAN_SUNDAE_PATTERN.test(lowerText)) {
    profile.push(
      "Specific visual identity: Korean blood sausage, also called soondae, is sliced dark purple-brown sausage rounds stuffed with sticky rice, glass noodles, and pig blood inside a thin casing. Serve several short sliced rounds on a small Korean street-food plate with coarse salt or sesame salt on the side; the filling should look moist, dense, and noodle-speckled.",
      "Negative visual guardrails: not ice cream sundae, not dessert, not salami, not cured sausage, not pepperoni, not chorizo, not Western charcuterie, not glossy red sausage. It should read as Korean street-food blood sausage, dark and tender, with visible sticky rice and glass noodles in the cut face.",
    );
  }

  // ── Khao Soi ─────────────────────────────────────────────
  if (KHAO_SOI_PATTERN.test(lowerText)) {
    profile.push(
      "Specific visual identity: Khao Soi is a northern Thai coconut curry noodle soup in a bowl, with golden-orange coconut curry broth, soft yellow egg noodles submerged in the broth, crispy fried egg noodles piled on top, and a chicken drumstick or tender chicken pieces visible. Garnish may include lime wedge, red onion, cilantro, and chili oil.",
      "Negative visual guardrails: not scrambled eggs, not generic ramen, not laksa, not spaghetti, not dry noodles, not a plain curry bowl without noodles, not a fried noodle plate.",
    );
  }

  // ── Turkish Lentil Soup ──────────────────────────────────
  if (TURKISH_LENTIL_SOUP_PATTERN.test(lowerText)) {
    profile.push(
      "Specific visual identity: Turkish lentil soup (Mercimek Corbasi) is a smooth orange-red pureed lentil soup in a simple bowl, with a silky surface, a swirl of paprika butter or olive oil, a lemon wedge on the side, and a small sprinkle of dried mint or chili flakes.",
      "Negative visual guardrails: not a chunky bean stew, not chili con carne, not tomato minestrone, not whole beans floating in red sauce, not curry with rice, not a noodle soup.",
    );
  }

  // ── Tteokguk ─────────────────────────────────────────────
  if (TTEOKGUK_PATTERN.test(lowerText)) {
    profile.push(
      "Specific visual identity: Tteokguk is Korean rice cake soup with many visible oval rice cake slices floating in a clear or milky-white broth. Garnish with thin egg ribbons, sliced scallions, small seaweed strips, and optionally a few tender beef shreds. The oval sliced rice cakes are the main subject.",
      "Negative visual guardrails: not red spicy soup, not noodles, not ramen, not udon, not tteokbokki, not gochujang sauce, not a red stew, not a fried egg on top. The broth should be pale, clear, or milky-white, never orange-red.",
    );
  }

  // ── Yukgaejang ───────────────────────────────────────────
  if (YUKGAEJANG_PATTERN.test(lowerText)) {
    profile.push(
      "Specific visual identity: Yukgaejang is Korean spicy beef soup in a deep bowl with red chili beef broth, lots of hand-shredded beef strands, long scallion strips, fernbrake or gosari stems, bean sprouts, and a few egg ribbons. The shredded beef and vegetables should be the main visible solids.",
      "Negative visual guardrails: not noodles, not ramen, not udon, not soba, not pho, not vermicelli, not a noodle soup, no long white noodle-like strands, not a plain red broth with only meat slices, not tteokbokki, not curry. Bean sprouts should be short and sparse, never piled like noodles. Do not add any noodles unless explicitly listed in the menu description.",
    );
  }

  // ── Rfissa ───────────────────────────────────────────────
  if (RFISSA_PATTERN.test(lowerText)) {
    profile.push(
      "Specific visual identity: Rfissa is a Moroccan chicken dish served over shredded msemen flatbread, with tender stewed chicken pieces, lentils, fenugreek-spiced broth, and torn flatbread strips soaking up the sauce. Serve as a rustic mound or shallow platter, with the chicken and lentils clearly visible on top.",
      "Negative visual guardrails: not pizza, not a round baked flatbread, not focaccia, not a cheese pie, not a dry sandwich, not tacos. The flatbread should appear as torn flatbread strips under saucy chicken and lentils, not as a single baked crust.",
    );
  }

  // ── Shabu-Shabu ──────────────────────────────────────────
  if (SHABU_SHABU_PATTERN.test(lowerText)) {
    profile.push(
      "Specific visual identity: Shabu-Shabu is a Japanese hot pot served in a tabletop pot, with thinly sliced raw beef arranged beside or partly over clear simmering broth, tofu cubes, napa cabbage, mushrooms, and leafy greens. The image should show the communal hot pot setting and delicate thin beef slices.",
      "Negative visual guardrails: not noodle soup, not ramen, not pho, not a single serving beef soup bowl, not sukiyaki with dark sweet soy broth, not barbecue. Emphasize tabletop pot, clear broth, vegetables, tofu, and thinly sliced raw beef.",
    );
  }

  // ── Saltimbocca ──────────────────────────────────────────
  if (SALTIMBOCCA_PATTERN.test(lowerText)) {
    profile.push(
      "Specific visual identity: Saltimbocca alla Romana is made from wide flat thin veal scallopini or flattened thin veal cutlets, lightly pan-seared, with paper-thin prosciutto layered across each cutlet and fresh sage leaves pinned or resting on top. Serve 2-3 flat irregular cutlets in a shallow glossy white-wine butter pan sauce, elegant Roman trattoria plating.",
      "Negative visual guardrails: not thick beef steak, not thick steak, not filet mignon, not red-centered medallions, not round medallions, not rolled meat rounds, not roulade, not meatballs, not stew, not a hamburger steak, not a generic pork chop, not a heavy green sauce. The meat must stay wide, thin, and flat with prosciutto and sage visibly attached.",
    );
  }

  // ── Calzone ──────────────────────────────────────────────
  if (CALZONE_PATTERN.test(lowerText)) {
    profile.push(
      "Specific visual identity: Calzone is a folded sealed pizza, shaped like a half-moon turnover with a crimped edge or sealed edge. Show one baked golden-brown folded pizza pocket, optionally cut open at one end to reveal mozzarella, tomato sauce, and filling inside.",
      "Negative visual guardrails: not a round pizza, not a pizza slice, not flat open pizza, not cheese-stretch slice pull, not a quesadilla, not empanadas. The outer dough must be folded over and sealed into one large half-moon calzone.",
    );
  }

  // ── Beyti Kebab ──────────────────────────────────────────
  if (BEYTI_KEBAB_PATTERN.test(lowerText)) {
    profile.push(
      "Specific visual identity: Beyti kebab is a Turkish grilled minced lamb or beef kebab wrapped in thin lavash flatbread, then sliced into thick round segments arranged in a row. The meat filling must be visible inside each lavash slice. It is topped with red tomato butter sauce and served with a spoon of plain yogurt, grilled tomato, grilled pepper, and parsley garnish.",
      "Negative visual guardrails: not pizza, not round pizza, not open flatbread pizza, not pide, not lahmacun, not burrito, not shawarma sandwich, not generic kebab skewers alone. It must read as sliced lavash-wrapped kebab with tomato sauce and yogurt.",
    );
  }

  // ── Bò Lá Lốt ────────────────────────────────────────────
  if (BO_LA_LOT_PATTERN.test(lowerText)) {
    profile.push(
      "Specific visual identity: Bò Lá Lốt is Vietnamese grilled beef wrapped in betel leaves. Show many small dark-green glossy cylindrical leaf-wrapped rolls, lightly charred from grilling, with beef visible at the cut ends. Serve with rice vermicelli, fresh mint and herbs, lettuce, pickled carrot or daikon, crushed peanuts, and a small bowl of fish sauce.",
      "Negative visual guardrails: not steamed banana leaf parcels, not zongzi, not tamales, not cabbage rolls, not grape-leaf dolma, not a burrito, not a loose minced beef bowl. The rolls must be individual grilled betel-leaf cylinders, dark green and charred.",
    );
  }

  // ── Bossam ───────────────────────────────────────────────
  if (BOSSAM_PATTERN.test(lowerText)) {
    profile.push(
      "Specific visual identity: Bossam is Korean boiled pork belly served as thick pale tender slices, arranged neatly on a plate with napa cabbage leaves or lettuce, perilla leaves, kimchi, spicy radish salad, garlic slices, green chili, and ssamjang dipping paste. The pork must look boiled, moist, and tender, with pale fat layers and lean meat layers.",
      "Negative visual guardrails: not burrito, not tortilla wrap, not sandwich, not grilled pork belly barbecue, not crispy bacon, not charred pork, not a taco, not a single rolled wrap. Show sliced boiled pork belly and wrap leaves separately.",
    );
  }

  // ── Onigiri ──────────────────────────────────────────────
  if (ONIGIRI_PATTERN.test(lowerText)) {
    profile.push(
      "Specific visual identity: Onigiri is a Japanese rice ball, usually triangular or rounded triangle, made from compact white rice with a rectangular or wrapped sheet of dark nori seaweed on the outside. Optional small filling or topping may be visible, but the main subject is a clean white rice triangle with black-green nori.",
      "Negative visual guardrails: not arancini, not fried rice balls, not sushi rolls, not nigiri sushi, not mochi, not dessert rice balls, not a Western meatball. It must read as a Japanese white rice ball with nori seaweed.",
    );
  }

  // ── Temaki ───────────────────────────────────────────────
  if (TEMAKI_PATTERN.test(lowerText)) {
    profile.push(
      "Specific visual identity: Temaki is a Japanese cone-shaped sushi hand roll. Show one diagonal tapered cone of crisp dark nori seaweed resting diagonally on the plate like a small ice-cream cone: a narrow pointed bottom, a wide open top, and visible sushi rice, salmon or tuna, cucumber, avocado, and roe or sesame if listed. The cone silhouette must be obvious from the camera angle; show the pointed tapered end clearly, not hidden under the filling.",
      "Negative visual guardrails: not maki rolls, not rectangular sushi blocks, not cut sushi rounds, not cylindrical sushi roll, not seaweed cup, not standing vertical, not upright cylinder, not closed rectangular sushi blocks, not closed sushi logs, not nigiri, not onigiri, not a burrito, not a sandwich wrap. It must read as an open cone-shaped nori hand roll resting diagonally with visible filling at the top and a narrow pointed bottom.",
    );
  }

  // ── Bánh Tráng Trộn ──────────────────────────────────────
  if (BANH_TRANG_TRON_PATTERN.test(lowerText)) {
    profile.push(
      "Specific visual identity: Bánh Tráng Trộn is Vietnamese mixed rice paper salad made from thin translucent rice paper strips tossed with shredded green mango, Vietnamese herbs, peanuts, dried shrimp, chili oil, and quail egg when listed. Serve as a street-food salad with the rice paper strips clearly visible as pale flexible ribbons.",
      "Negative visual guardrails: not cabbage salad, not coleslaw, not papaya salad, not vermicelli noodles, not glass noodle salad, not a shrimp garden salad, not lettuce as the main bulk. The main texture must be thin translucent rice paper strips, with green mango, dried shrimp, quail egg, herbs, and peanuts as accents.",
    );
  }

  // ── California Roll ──────────────────────────────────────
  if (CALIFORNIA_ROLL_PATTERN.test(lowerText)) {
    profile.push(
      "Specific visual identity: California Roll is an inside-out sushi roll shown as 6-8 separate cut maki pieces or sliced rounds arranged flat on a plate. The sushi rice is on the outside, sprinkled with sesame seeds or orange roe when listed; nori seaweed is inside, wrapping imitation crab, avocado, and cucumber visible in each cross-section.",
      "Negative visual guardrails: not temaki, not hand roll, not upright cylinder, not seaweed cup, not single cone, not single uncut roll, not sushi log, not nigiri, not onigiri, not burrito, not a loose salad. It must read as inside-out sushi with rice on the outside and multiple cut rounds.",
    );
  }

  // ── Bún Chả ──────────────────────────────────────────────
  if (BUN_CHA_PATTERN.test(lowerText)) {
    profile.push(
      "Specific visual identity: Vietnamese bún chả is grilled pork patties or grilled pork slices served with white rice vermicelli, fresh herbs, lettuce, pickled carrot or daikon, and a small bowl of nuoc cham dipping sauce. The pork should be caramelized from grilling and the vermicelli should be visible as fine white noodles.",
      "Negative visual guardrails: not rice bowl, not kebab chunks, not pho, not ramen, not fried rice, not a dry grilled meat platter without noodles, not a burger patty. It must show rice vermicelli and nuoc cham or dipping sauce with grilled pork.",
    );
  }

  // ── Black Pepper Crab ────────────────────────────────────
  if (BLACK_PEPPER_CRAB_PATTERN.test(lowerText)) {
    profile.push(
      "Specific visual identity: Singapore black pepper crab is whole crab pieces coated in dark black pepper sauce or black pepper crust, glossy and almost black-brown, with visible coarse black pepper specks, crab claws and shell pieces, butter sheen, and optional scallion.",
      "Negative visual guardrails: not chili crab, not bright red sauce, not orange sauce, not orange-red sauce, not tomato chili gravy, not pale steamed crab, not generic seafood pasta. The sauce must be dark and peppery, never bright red or orange.",
    );
  }

  // ── Generic fish guardrail (when not a known fish dish) ──
  if (kind === "seafood" && /fish|鱼|poisson|pesce|pescado/.test(lowerText) && !RED_MULLET_PATTERN.test(lowerText)) {
    profile.push(
      "Fish visual guardrail: render the named fish species or closest culinary form from the dish name; avoid a generic oversized whole fish when the name suggests a fillet, small fish, or delicate seafood course.",
    );
  }

  // ── Category-level guardrails ─────────────────────────────
  if (kind === "pizza") {
    profile.push(
      "Pizza visual guardrail: the final image must clearly be pizza, not a drink, dessert bowl, soup, or plated entree. Toppings must reflect the dish name and description.",
    );
  }

  if (kind === "drink") {
    profile.push(
      "Beverage visual guardrail: the final image must clearly be a drink in a cup or glass, not a plated dessert or food dish.",
    );
  }

  if (kind === "meal" && (dish.included_items?.length || 0) > 0) {
    profile.push(
      "Combo visual guardrail: every included item is a real visual subject in the image. Do not hide fries, sauce, drink, dessert, or side items behind the main item.",
    );
  }

  if (kind === "burger") {
    profile.push(
      "Burger visual guardrail: the patty MUST visually match the dish ingredients — chicken patty ≠ beef patty, paneer patty must look like Indian cheese not meat. Bun appropriate to cuisine: sesame seed for American, potato bun for premium. No fries or drink unless listed in included items.",
    );
  }

  return profile;
}

export function buildDishImagePrompt(dish: DishImagePromptInput): string {
  const translated = typeof dish.name_translated === "string"
    ? dish.name_translated
    : (dish.name_translated as Record<string, string>)?.zh || "";
  const name = translated || dish.name_original;
  const desc = typeof dish.description === "string"
    ? dish.description
    : (dish.description as Record<string, string>)?.zh || "";
  const ings = dish.ingredients?.length ? dish.ingredients.join("、") : "";
  const includedItems = dish.included_items?.length ? dish.included_items.join("、") : "";
  const kind = classifyDishImageKind(dish);
  const visualProfile = buildDishVisualProfile(dish, kind);
  const criticalHint = dish.image_prompt_hint?.trim() || "";
  const identityText = [
    dish.name_original || "",
    localized(dish.name_translated),
    localized(dish.description),
    ...(dish.ingredients || []),
    ...(dish.included_items || []),
  ].join(" ").toLowerCase();
  const framing: Record<string, string> = {
    drink: "Premium restaurant beverage photography of a single beverage served in an appropriate cup, mug, coupe, wine glass, or clear tumbler. The drink is the only subject, with distinct beverage texture: foam, ice, garnish, steam, condensation, bubbles, crema, or liquid color when relevant. No plate, no food platter.",
    soup: "Premium restaurant food photography of a single bowl of soup, broth, noodle soup, chowder, or stew. The bowl is centered, with visible individual ingredients, broth surface detail, garnish, oil droplets or steam, and clear soup depth. Not plated flat.",
    dessert: "Premium restaurant dessert photography of one finished dessert portion. Show precise pastry layers, cream texture, fruit, sauce, crumb, glaze, melted chocolate, or ice cream surface detail clearly on a small dessert plate or bowl.",
    seafood: "Premium restaurant seafood photography of one finished seafood dish. The seafood is the unmistakable subject: visible crab shell or claws, shrimp shape, fish fillet flakes, scallop texture, conch or whelk sea-snail shells, shellfish, eel pieces, roe, or seafood sauce as appropriate to the dish name. Show fresh gloss, steam or seared edges, accurate seafood anatomy, not a drink and no glassware.",
    burger: "Premium fast-food product photography of a single plated burger. The burger is the only subject, shown whole or cut in half to reveal internal layers. The patty MUST visually match the dish name and ingredients — a chicken patty must look different from a beef patty, a paneer patty must look like Indian cheese not meat, a vegetable patty must show visible vegetables. Bun should be appropriate to cuisine: sesame seed for American, potato bun for premium, no bun if described as lettuce-wrapped. Served on branded paper or simple plate. No fries, no cola, no other items.",
    wrap: "Premium food photography of a single wrap, burrito, or rolled tortilla. The wrap is the only subject, shown whole or diagonally cut showing filling layers. Visible: flour tortilla exterior with light grill marks, sliced cross-section revealing layered fillings (protein, vegetables, sauce, cheese). Served on simple plate or paper. No sides unless specified.",
    sandwich: "Premium food photography of a single sandwich or sub. The sandwich is the only subject, shown whole or cut diagonally. Visible: bread slices or sub roll, layered fillings (protein, vegetables, cheese, spreads) between bread. Served on simple plate. No sides unless specified.",
    salad: "Premium food photography of a single composed salad. The salad fills a bowl or plate, with visible fresh vegetables, greens, dressing drizzled on top, and distinct ingredient textures. Shot from above or 45-degree angle showing salad composition.",
    pizza: "Premium food photography of a single pizza on a wooden board or metal tray. The pizza is the only subject, shown whole with visible crust, melted cheese, toppings evenly distributed. Possible slice pulled away showing cheese stretch. No other dishes visible.",
    meal: "Premium fast-casual combo meal photography. ALL included items must be visible in the final image, arranged together as one restaurant tray or plate. Do not generate only the main item. Show the named main item clearly plus every listed side, sauce, and drink. The main item must match the dish name: Filet-O-Fish meals show a fish burger, wrap meals show a cut wrap, burger meals show a burger, rice or noodle meals show the bowl. Fries, sauce, and cola or drink should appear only when listed.",
    main: "Premium restaurant food photography of a single finished dish with accurate portion, cooking texture, sauce placement, garnish, and ingredient separation.",
  };
  const kindFraming = kind === "pizza" && CALZONE_PATTERN.test(identityText)
    ? "Premium restaurant food photography of a single calzone: one folded sealed half-moon pizza pocket with golden-brown baked dough, crimped sealed edge, and visible melted cheese or tomato filling only if cut open. Not a round open pizza."
    : framing[kind] || framing.main;
  const isPlateFormat = kind === "main" || kind === "seafood" || kind === "burger" || kind === "wrap" || kind === "sandwich" || kind === "salad" || kind === "meal";
  const parts = [
    "Visual priority: match the exact dish identity and culinary form first; the category framing below is only secondary guidance.",
    criticalHint,
    kindFraming,
    `Dish name: ${dish.name_original}`,
    translated && translated !== dish.name_original ? `(${name})` : "",
    ings ? `Main ingredients visibly represented: ${ings}` : "",
    includedItems ? `Required visible combo contents: ${includedItems}. These are mandatory visual subjects, not text labels.` : "",
    desc ? `Description: ${desc}` : "",
    ...visualProfile,
    "Evidence rule: use only the dish name, original menu words, description, ingredients, and included items as evidence. Do not invent a different species, cuisine style, side dish, garnish, sauce, or serving vessel that conflicts with the evidence.",
    "Shot from 45-degree angle with a close editorial crop, natural window light, shallow depth of field, soft shadows, realistic restaurant tableware.",
    isPlateFormat ? "Dish centered on a simple ceramic plate or appropriate serving dish, neutral table background." : "Neutral table background, clean editorial restaurant styling.",
    "Photorealistic, high detail, appetizing colors, realistic ingredients, no invented garnish that conflicts with the dish.",
    "No text, no logo, no watermark, no hands, no people, no menu, no extra dishes visible, no cartoon style.",
  ];
  return parts.filter(Boolean).join(" ");
}

function buildFastDishImagePrompt(dish: DishImagePromptInput): string {
  const kind = classifyDishImageKind(dish);
  const translated = localized(dish.name_translated);
  const description = localized(dish.description);
  const visualProfile = buildDishVisualProfile(dish, kind).join(" ");
  const framing: Record<ReturnType<typeof classifyDishImageKind>, string> = {
    drink: "Single restaurant beverage in the correct cup or glass; show accurate liquid color, foam, ice, bubbles, steam, or garnish.",
    soup: "Single centered bowl of soup with visible broth depth, ingredients, oil droplets, garnish, and steam.",
    dessert: "Single finished dessert portion with accurate pastry, cream, fruit, sauce, crumb, glaze, or ice-cream texture.",
    seafood: "Single finished seafood dish with anatomically accurate named seafood, shell, claws, fillet, roe, or seared texture.",
    burger: "Single burger whose patty and layers exactly match the named ingredients; no sides unless listed.",
    wrap: "Single wrap or burrito, diagonally cut to reveal the exact named filling.",
    sandwich: "Single sandwich, cut to reveal the exact named bread, protein, vegetables, cheese, and spread.",
    salad: "Single composed salad with distinct fresh ingredients and dressing visible from above or at 45 degrees.",
    pizza: "Single whole pizza with accurate crust, cheese, sauce, and named toppings; no other dishes.",
    meal: "One complete combo tray showing every listed main item, side, sauce, and drink.",
    main: "Single finished restaurant dish with accurate culinary form, portion, ingredients, cooking texture, and sauce.",
  };
  const identity = [
    `Exact dish: ${dish.name_original}.`,
    translated && translated !== dish.name_original ? `Translation: ${translated}.` : "",
    dish.ingredients?.length ? `Visible ingredients: ${dish.ingredients.join(", ")}.` : "",
    dish.included_items?.length ? `Required contents: ${dish.included_items.join(", ")}.` : "",
    description ? `Menu description: ${description}.` : "",
    dish.image_prompt_hint?.trim() || "",
    framing[kind],
    visualProfile,
  ].filter(Boolean).join(" ");
  const finish = "Photorealistic premium food photography, natural light, 45-degree close crop, accurate ingredients, no invented garnish, no text, logo, watermark, hands, people, menu, cartoon, or extra dishes.";
  const finishCharacters = Array.from(finish);
  const identityLimit = Math.max(1, 800 - finishCharacters.length - 1);
  const compactIdentity = Array.from(identity).slice(0, identityLimit).join("").trim();
  return `${compactIdentity} ${finish}`;
}

function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function buildFreeImageUrl(dish: {
  name_original: string;
  name_translated?: string | Record<string, string>;
  description?: string | Record<string, string>;
  ingredients?: string[];
  included_items?: string[];
}): string {
  const prompt = `${buildDishImagePrompt(dish)} realistic food photo, no text, no logo, no watermark`.slice(0, 900);
  const params = new URLSearchParams({
    width: "1024",
    height: "1024",
    model: "flux",
    seed: String(hashSeed([
      dish.name_original,
      localized(dish.name_translated),
      localized(dish.description),
      ...(dish.ingredients || []),
      ...(dish.included_items || []),
    ].join("|"))),
    nologo: "true",
    safe: "true",
  });
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params.toString()}`;
}

interface WanTaskResult {
  url: string;
}

type ModelStudioResponse = {
  output?: {
    choices?: Array<{
      message?: {
        content?: Array<{ image?: string; type?: string }>;
      };
    }>;
  };
  code?: string;
  message?: string;
  request_id?: string;
};

class ModelStudioImageError extends Error {
  constructor(message: string, readonly terminal: boolean) {
    super(message);
    this.name = "ModelStudioImageError";
  }
}

function isTerminalModelStudioError(status: number, code = ""): boolean {
  if (status >= 400 && status < 500 && status !== 408 && status !== 429) return true;
  return /invalid|inspection|infringement|safety|moderation|permission|authentication/i.test(code);
}

function modelStudioImageUrl(data: ModelStudioResponse): string | null {
  for (const choice of data.output?.choices || []) {
    for (const content of choice.message?.content || []) {
      if (typeof content.image === "string" && content.image.startsWith("https://")) {
        return content.image;
      }
    }
  }
  return null;
}

async function callModelStudioImage(
  model: string,
  prompt: string,
  timeoutMs: number,
  seed: number,
): Promise<string> {
  const isFastModel = model === MODEL_STUDIO_FAST_MODEL;
  const apiKey = getModelStudioApiKey();
  await waitForModelStudioRequestSlot();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const startedAt = Date.now();
    const res = await fetch(`${MODEL_STUDIO_BASE_URL}/services/aigc/multimodal-generation/generation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        input: {
          messages: [{
            role: "user",
            content: [{ text: prompt }],
          }],
        },
        parameters: isFastModel
          ? { prompt_extend: false, size: "1024*1024", seed }
          : { size: "1K", n: 1, watermark: false, thinking_mode: false },
      }),
    });
    const text = await res.text();
    let data: ModelStudioResponse = {};
    if (text) {
      try {
        data = JSON.parse(text) as ModelStudioResponse;
      } catch {
        data = { message: text.slice(0, 300) };
      }
    }
    if (!res.ok) {
      throw new ModelStudioImageError(
        `${model} failed (${res.status}): ${data.message || data.code || text.slice(0, 300)}`,
        isTerminalModelStudioError(res.status, data.code),
      );
    }
    const url = modelStudioImageUrl(data);
    if (!url) {
      throw new ModelStudioImageError(
        `${model} returned no image URL${data.message ? `: ${data.message}` : ""}`,
        isTerminalModelStudioError(200, data.code),
      );
    }
    console.info("image:model_studio_generated", {
      model,
      requestId: data.request_id,
      elapsedMs: Date.now() - startedAt,
    });
    return url;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ModelStudioImageError(`${model} timed out after ${timeoutMs}ms`, false);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function generateWithModelStudio(dish: DishImagePromptInput): Promise<string> {
  getModelStudioApiKey();
  const kind = classifyDishImageKind(dish);
  const preferQuality = MODEL_STUDIO_QUALITY_KINDS.has(kind);
  const models = preferQuality
    ? [MODEL_STUDIO_QUALITY_MODEL, MODEL_STUDIO_FAST_MODEL]
    : [MODEL_STUDIO_FAST_MODEL, MODEL_STUDIO_QUALITY_MODEL];
  const uniqueModels = [...new Set(models.filter(Boolean))];
  const seed = hashSeed([
    dish.name_original,
    localized(dish.name_translated),
    localized(dish.description),
    ...(dish.ingredients || []),
    ...(dish.included_items || []),
  ].join("|"));
  const errors: string[] = [];

  for (const model of uniqueModels) {
    try {
      const isFastModel = model === MODEL_STUDIO_FAST_MODEL;
      return await callModelStudioImage(
        model,
        isFastModel ? buildFastDishImagePrompt(dish) : buildDishImagePrompt(dish),
        isFastModel ? MODEL_STUDIO_FAST_TIMEOUT_MS : MODEL_STUDIO_QUALITY_TIMEOUT_MS,
        seed,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(message);
      console.warn("Model Studio dish image attempt failed", {
        dish: dish.name_original,
        model,
        error: message,
      });
      if (error instanceof ModelStudioImageError && error.terminal) throw error;
    }
  }

  throw new Error(`Singapore image generation failed: ${errors.join("; ")}`);
}

async function createTask(prompt: string): Promise<string> {
  const res = await fetch(`${LEGACY_DASHSCOPE_BASE}/services/aigc/text2image/image-synthesis`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getApiKey()}`,
      "X-DashScope-Async": "enable",
    },
    body: JSON.stringify({
      model: WAN_MODEL,
      input: { prompt },
      parameters: { size: "1024*1024", n: 1 },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Wan createTask failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const taskId = data.output?.task_id;
  if (!taskId) throw new Error(`Wan createTask returned no task_id: ${JSON.stringify(data)}`);
  return taskId;
}

async function pollTask(taskId: string): Promise<WanTaskResult | null> {
  const deadline = Date.now() + POLL_TIMEOUT;

  while (Date.now() < deadline) {
    const res = await fetch(`${LEGACY_DASHSCOPE_BASE}/tasks/${taskId}`, {
      headers: { "Authorization": `Bearer ${getApiKey()}` },
    });

    if (!res.ok) {
      throw new Error(`Wan pollTask failed (${res.status})`);
    }

    const data = await res.json();
    const status: string = data.output?.task_status;

    if (status === "SUCCEEDED") {
      const url = data.output?.results?.[0]?.url;
      if (!url) throw new Error("Wan succeeded but no URL in response");
      return { url };
    }

    if (status === "FAILED") {
      const msg = data.output?.message || "unknown error";
      console.error(`Wan task ${taskId} failed: ${msg}`);
      return null;
    }

    // PENDING or RUNNING — wait and retry
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }

  console.error(`Wan task ${taskId} timed out after ${POLL_TIMEOUT}ms`);
  return null;
}

export async function generateDishImage(dish: {
  name_original: string;
  name_translated?: string | Record<string, string>;
  description?: string | Record<string, string>;
  ingredients?: string[];
  included_items?: string[];
  category?: string;
  image_prompt_hint?: string;
}): Promise<string | null> {
  if (IMAGE_PROVIDER === "pollinations") {
    return buildFreeImageUrl(dish);
  }

  if (MODEL_STUDIO_BASE_URL && IMAGE_PROVIDER !== "wan-legacy") {
    try {
      return await generateWithModelStudio(dish);
    } catch (error) {
      console.error("generateDishImage Model Studio chain failed", {
        dish: dish.name_original,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  const retries = IMAGE_GENERATION_RETRIES;
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const prompt = buildDishImagePrompt(dish);
      const taskId = await createTask(prompt);
      const result = await pollTask(taskId);
      if (result?.url) return result.url;
      lastError = new Error("Wan image task finished without URL");
    } catch (err) {
      lastError = err;
      console.error("generateDishImage attempt error:", {
        attempt,
        totalAttempts: retries,
        dish: dish.name_original,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    if (attempt < retries) {
      // Exponential backoff: 2s, 4s, 8s to respect rate limits
      const backoff = Math.min(1200 * Math.pow(2, attempt), 10_000);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }

  console.error("generateDishImage failed after retries:", {
    dish: dish.name_original,
    error: lastError instanceof Error ? lastError.message : String(lastError),
  });
  return null;
}

export async function generateDishImageWithError(dish: {
  name_original: string;
  name_translated?: string | Record<string, string>;
  description?: string | Record<string, string>;
  ingredients?: string[];
  included_items?: string[];
  category?: string;
  image_prompt_hint?: string;
}): Promise<{ url: string | null; error?: string }> {
  try {
    const url = await generateDishImage(dish);
    if (!url) return { url: null, error: "DashScope image generation did not return a usable URL" };
    return { url };
  } catch (err) {
    return { url: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function generateImagesForDishes(
  dishes: Array<{
    id?: string;
    name_original: string;
    name_translated?: string | Record<string, string>;
    description?: string | Record<string, string>;
    ingredients?: string[];
    included_items?: string[];
    category?: string;
    ai_image_url?: string | null;
  }>,
  onImageReady?: (index: number, url: string) => void | Promise<void>,
  concurrency = 1,
  onImageFailed?: (index: number, error: string) => void | Promise<void>,
): Promise<void> {
  const queue = dishes
    .map((dish, i) => ({ dish, index: i }))
    .filter(({ dish }) => !dish.ai_image_url);

  let running = 0;
  let idx = 0;

  // Throttle helper: wait between starting new requests to avoid rate limits
  let lastRequestTime = 0;
  async function throttledNext() {
    const now = Date.now();
    const wait = Math.max(0, REQUEST_INTERVAL_MS - (now - lastRequestTime));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestTime = Date.now();

    while (running < concurrency && idx < queue.length) {
      const item = queue[idx++];
      running++;
      generateDishImageWithError(item.dish)
        .then(async ({ url, error }) => {
          if (url && onImageReady) {
            await onImageReady(item.index, url);
            return;
          }
          if (onImageFailed) {
            await onImageFailed(item.index, error || "Image generation returned no URL");
          }
        })
        .catch(async (err) => {
          if (onImageFailed) {
            await onImageFailed(item.index, err instanceof Error ? err.message : String(err));
          }
        })
        .finally(() => {
          running--;
          if (idx >= queue.length && running === 0) resolve();
          else throttledNext();
        });
      // Respect interval between batch starts
      if (idx < queue.length && running >= concurrency) {
        lastRequestTime = Date.now();
      }
    }
    if (queue.length === 0 || (idx >= queue.length && running === 0)) resolve();
  }

  let resolve: () => void;
  const promise = new Promise<void>((r) => { resolve = r; });
  throttledNext();
  return promise;
}
