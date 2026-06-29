const DASHSCOPE_BASE = "https://dashscope.aliyuncs.com/api/v1";
const WAN_MODEL = process.env.WAN_MODEL || "wanx2.1-t2i-turbo";
const IMAGE_PROVIDER = process.env.IMAGE_PROVIDER || "wan";
const POLL_INTERVAL = 3000;
const POLL_TIMEOUT = 60_000;
const IMAGE_GENERATION_RETRIES = Math.max(
  1,
  Math.min(3, Number.parseInt(process.env.MENU_IMAGE_GENERATION_RETRIES || "2", 10) || 2),
);
const REQUEST_INTERVAL_MS = 3000; // 3s between requests to stay under DashScope rate limits

function getApiKey(): string {
  const key = process.env.QWEN_API_KEY || "";
  if (!key) throw new Error("QWEN_API_KEY is required for image generation");
  return key;
}

type DishImagePromptInput = {
  name_original: string;
  name_translated?: string | Record<string, string>;
  description?: string | Record<string, string>;
  ingredients?: string[];
  included_items?: string[];
  category?: string;
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
  const kindFraming = framing[kind] || framing.main;
  const isPlateFormat = kind === "main" || kind === "seafood" || kind === "burger" || kind === "wrap" || kind === "sandwich" || kind === "salad" || kind === "meal";
  const parts = [
    "Visual priority: match the exact dish identity and culinary form first; the category framing below is only secondary guidance.",
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

async function createTask(prompt: string): Promise<string> {
  const res = await fetch(`${DASHSCOPE_BASE}/services/aigc/text2image/image-synthesis`, {
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
    const res = await fetch(`${DASHSCOPE_BASE}/tasks/${taskId}`, {
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
}): Promise<string | null> {
  if (IMAGE_PROVIDER === "pollinations") {
    return buildFreeImageUrl(dish);
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
