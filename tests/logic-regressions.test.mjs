import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import ts from "typescript";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { dirname, relative, join } from "node:path";

const ROOT = "/Users/julian/AI点菜/dishlens";
const TMP_ROOT = "/tmp/dishlens-logic-tests";

async function loadTsModule(file) {
  const source = await readFile(file, "utf8");
  let compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      resolveJsonModule: true,
      esModuleInterop: true,
    },
  }).outputText;
  compiled = compiled.replace(
    'import dishKnowledgeDb from "../../public/dish-knowledge-db.json";',
    'const dishKnowledgeDb = JSON.parse(await (await import("node:fs/promises")).readFile(new URL("../../public/dish-knowledge-db.json", import.meta.url), "utf8"));',
  );
  compiled = compiled.replace(
    'import { matchDishKnowledgeImage } from "@/lib/dish-image-match";',
    'import { matchDishKnowledgeImage } from "./dish-image-match.mjs";',
  );
  compiled = compiled.replaceAll(
    'from "@/lib/dish-name-normalization"',
    'from "./dish-name-normalization.mjs"',
  );
  compiled = compiled.replaceAll(
    'from "@/lib/results-categories"',
    'from "./results-categories.mjs"',
  );
  compiled = compiled.replaceAll(
    'from "@/lib/dish-presentation"',
    'from "./dish-presentation.mjs"',
  );
  compiled = compiled.replaceAll(
    'from "@/lib/dish-image-url"',
    'from "./dish-image-url.mjs"',
  );
  compiled = compiled.replaceAll(
    'from "@/lib/order-state"',
    'from "./order-state.mjs"',
  );
  compiled = compiled.replaceAll(
    'from "@/lib/restaurant-display"',
    'from "./restaurant-display.mjs"',
  );
  compiled = compiled.replaceAll(
    'from "@/lib/menu-source-language"',
    'from "./menu-source-language.mjs"',
  );
  compiled = compiled.replaceAll(
    'from "@/lib/location-recommendation"',
    'from "./location-recommendation.mjs"',
  );
  compiled = compiled.replaceAll(
    'from "@/lib/region-landmarks"',
    'from "./region-landmarks.mjs"',
  );
  const rel = relative(ROOT, file).replace(/\.ts$/, ".mjs");
  const outFile = join(TMP_ROOT, rel);
  await mkdir(dirname(outFile), { recursive: true });
  await mkdir(join(TMP_ROOT, "public"), { recursive: true });
  await copyFile(join(ROOT, "public/dish-knowledge-db.json"), join(TMP_ROOT, "public/dish-knowledge-db.json"));
  await writeFile(outFile, compiled);
  const dependencyMap = [
    { pattern: 'from "./dish-image-match.mjs"', file: `${ROOT}/src/lib/dish-image-match.ts` },
    { pattern: 'from "./dish-name-normalization.mjs"', file: `${ROOT}/src/lib/dish-name-normalization.ts` },
    { pattern: 'from "./results-categories.mjs"', file: `${ROOT}/src/lib/results-categories.ts` },
    { pattern: 'from "./dish-presentation.mjs"', file: `${ROOT}/src/lib/dish-presentation.ts` },
    { pattern: 'from "./dish-image-url.mjs"', file: `${ROOT}/src/lib/dish-image-url.ts` },
    { pattern: 'from "./order-state.mjs"', file: `${ROOT}/src/lib/order-state.ts` },
    { pattern: 'from "./restaurant-display.mjs"', file: `${ROOT}/src/lib/restaurant-display.ts` },
    { pattern: 'from "./menu-source-language.mjs"', file: `${ROOT}/src/lib/menu-source-language.ts` },
    { pattern: 'from "./location-recommendation.mjs"', file: `${ROOT}/src/lib/location-recommendation.ts` },
    { pattern: 'from "./region-landmarks.mjs"', file: `${ROOT}/src/lib/region-landmarks.ts` },
  ];
  for (const dep of dependencyMap) {
    if (file !== dep.file && compiled.includes(dep.pattern)) {
      await loadTsModule(dep.file);
    }
  }
  return import(`${pathToFileURL(outFile).href}?t=${Date.now()}`);
}

test("information pages with zero dishes do not trigger menu OCR retry", async () => {
  const { shouldRetryEmptyMenuResult } = await loadTsModule(
    `${ROOT}/src/lib/menu-analysis-utils.ts`,
  );

  assert.equal(
    shouldRetryEmptyMenuResult({ dishes: [], page_label: "说明页", source_language: "fr" }, 0, 2),
    false,
  );
  assert.equal(
    shouldRetryEmptyMenuResult({ dishes: [], page_label: "主菜", source_language: "fr" }, 0, 2),
    true,
  );
});

test("location recommendation formats distance and selects navigation providers", async () => {
  const {
    chooseLocationProvider,
    formatDistanceLabel,
    shouldShowDistance,
    buildNavigationUrl,
    getLocationRecommendation,
  } = await loadTsModule(`${ROOT}/src/lib/location-recommendation.ts`);

  assert.equal(chooseLocationProvider("CN"), "amap");
  assert.equal(chooseLocationProvider("HK"), "amap");
  assert.equal(chooseLocationProvider("IT"), "google");
  assert.equal(formatDistanceLabel(1800, "zh"), "<2km");
  assert.equal(formatDistanceLabel(2300, "zh"), "2.3km");
  assert.equal(formatDistanceLabel(950, "en"), "<1km");
  assert.equal(shouldShowDistance(49_900), true);
  assert.equal(shouldShowDistance(50_001), false);

  assert.match(
    buildNavigationUrl({
      provider: "amap",
      name: "附近小馆",
      latitude: 31.2304,
      longitude: 121.4737,
    }),
    /^https:\/\/uri\.amap\.com\/navigation\?/,
  );
  assert.match(
    buildNavigationUrl({
      provider: "google",
      name: "Maison Champignon",
      latitude: 48.8566,
      longitude: 2.3522,
    }),
    /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=/,
  );

  const result = await getLocationRecommendation({
    lat: 48.8566,
    lon: 2.3522,
    country: "FR",
    locale: "zh",
    env: {},
    fetcher: async () => {
      throw new Error("network should not be called without a key");
    },
  });
  assert.equal(result, null);
});

test("region landmark resolver covers common travel menu regions", async () => {
  const { resolveRegionLandmark } = await loadTsModule(
    `${ROOT}/src/lib/region-landmarks.ts`,
  );

  assert.equal(resolveRegionLandmark({ cuisine: "Italian pizzeria" }).key, "it");
  assert.equal(resolveRegionLandmark({ sourceLang: "fr" }).key, "fr");
  assert.equal(resolveRegionLandmark({ sourceLang: "ja-JP" }).key, "ja");
  assert.equal(resolveRegionLandmark({ cuisine: "Thai street food" }).key, "th");
  assert.equal(resolveRegionLandmark({ cuisine: "Indian curry and paneer" }).key, "in");
  assert.equal(resolveRegionLandmark({ cuisine: "Mexican tacos" }).key, "mx");
  assert.equal(resolveRegionLandmark({ cuisine: "unknown cuisine" }).key, "international");
});

test("region landmark icons use local warm PNG assets instead of inline SVG drawings", async () => {
  const component = await readFile(`${ROOT}/src/components/shared/RegionLandmarkIcon.tsx`, "utf8");
  const landmarks = await readFile(`${ROOT}/src/lib/region-landmarks.ts`, "utf8");

  for (const key of ["fr", "it", "ja", "zh", "ko", "th", "de", "es", "en", "in", "mx", "vn", "tr", "gr", "br", "international"]) {
    assert.match(landmarks, new RegExp(`"${key}"`));
    const image = await readFile(`${ROOT}/public/icons/landmarks/${key}.png`);
    assert.equal(image.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  }

  assert.match(component, /\/icons\/landmarks\/\$\{landmark\.key\}\.png/);
  assert.doesNotMatch(component, /const ICONS:/);
  assert.doesNotMatch(component, /<svg[\s\S]*<Icon/);
});

test("region landmark icons avoid inner white rings on warm cards", async () => {
  const component = await readFile(`${ROOT}/src/components/shared/RegionLandmarkIcon.tsx`, "utf8");

  assert.doesNotMatch(component, /overflow:\s*"hidden"/);
  assert.doesNotMatch(component, /rgba\(255,227,191,0\.55\)/);
  assert.match(component, /background:\s*"rgba\(254,230,203,0\.64\)"/);
  assert.match(component, /landmarkImageSize/);
});

test("recent translations are menu records with landmark stamps, not first-dish cards", async () => {
  const homePage = await readFile(`${ROOT}/src/components/home/HomePage.tsx`, "utf8");
  const { buildRecentMenuRecords } = await loadTsModule(
    `${ROOT}/src/lib/recent-menu-records.ts`,
  );

  const records = buildRecentMenuRecords([
    {
      id: "history-italy",
      restaurant_name: "Pecora Negra Pizzeria",
      city: "Roma",
      dish_count: 17,
      page_count: 1,
      date: "2026-06-09T08:00:00.000Z",
      thumbnail: "/generated-dishes/generated-la-pesto.png",
      source_lang: "it",
      target_lang: "zh",
      result_summary: {
        task_id: "history-italy",
        status: "done",
        pages: [{
          page_index: 0,
          page_label: "Pizza",
          image_thumbnail: "",
          dishes: [
            {
              id: "marinara",
              name_original: "LA MARINARA",
              name_translated: { zh: "玛琳娜披萨" },
              description: { zh: "番茄酱、牛至和蒜油。" },
              ingredients: ["番茄酱"],
              allergens: [],
              taste_profile: [],
              category: "staple",
              image_source: "ai",
            },
          ],
        }],
        metadata: {
          source_language: "it",
          target_language: "zh",
          total_dishes: 17,
          cached: false,
          insight: { summary: "", occasion_tags: [], cuisine_style: "Italian pizzeria" },
        },
      },
    },
  ], { now: new Date("2026-06-09T10:00:00.000Z") });

  assert.equal(records.length, 1);
  assert.equal(records[0].restaurantName, "Pecora Negra Pizzeria");
  assert.equal(records[0].sourceLabel, "IT");
  assert.equal(records[0].targetLabel, "中文");
  assert.equal(records[0].dishCount, 17);
  assert.equal(records[0].landmarkKey, "it");
  assert.notEqual(records[0].restaurantName, "玛琳娜披萨");
  assert.match(homePage, /onClick=\{\(\) => item\.id && onRecentClick\?\.\(item\.id\)\}/);
  assert.doesNotMatch(homePage, /font:\s*"800 13px var\(--font-ui\)"[\s\S]*?>→<\/span>/);
});

test("common short menu names resolve to prebuilt local dish images", async () => {
  const { matchDishKnowledgeImage } = await loadTsModule(
    `${ROOT}/src/lib/dish-image-match.ts`,
  );

  assert.equal(matchDishKnowledgeImage({ name_original: "LA MARINARA" })?.id, "pizza-marinara");
  assert.equal(matchDishKnowledgeImage({ name_original: "LA MARGHERITA" })?.id, "pizza-margherita");
  assert.equal(matchDishKnowledgeImage({ name_original: "LA DIAVOLA" })?.id, "pizza-diavola");
  assert.equal(matchDishKnowledgeImage({ name_original: "LA SALADE DU MOMENT" })?.id, "salade-nicoise");
  assert.equal(matchDishKnowledgeImage({ name_original: "LA SALADE JAMBON DE PARME" })?.id, "salade-chez-louis");
});

test("pizza variants do not collapse to the same generic fallback image", async () => {
  const { matchDishKnowledgeImage } = await loadTsModule(
    `${ROOT}/src/lib/dish-image-match.ts`,
  );

  assert.equal(matchDishKnowledgeImage({ name_original: "LA JARDIN", description: "seasonal vegetables and mozzarella" })?.id, "pizza-quattro-stagioni");
  assert.equal(matchDishKnowledgeImage({ name_original: "LA REINE", description: "ham mushrooms and olives" })?.id, "pizza-prosciutto-funghi");
  assert.equal(matchDishKnowledgeImage({ name_original: "LA GENOVESE", description: "Pesto Genovese, Fior di latte mozzarella and Grana Padano" })?.id, "pizza-genovese");
  assert.equal(matchDishKnowledgeImage({ name_original: "LA TROIS FROMAGES", description: "aged Comté, mozzarella and fresh goat cheese" })?.id, "pizza-quattro-formaggi");
  assert.match(
    matchDishKnowledgeImage({
      name_original: "LA PIZZA « CIOCCOLATO »",
      name_translated: { zh: "巧克力披萨" },
      description: "甜味披萨，搭配有机榛子奶油和切碎榛子。",
    })?.id || "",
    /^pizza-/,
  );
});

test("meal combos keep included items visible and avoid generic paneer images", async () => {
  const { matchDishKnowledgeImage } = await loadTsModule(
    `${ROOT}/src/lib/dish-image-match.ts`,
  );
  const { buildDishImagePrompt, classifyDishImageKind } = await loadTsModule(
    `${ROOT}/src/lib/ai/image-gen.ts`,
  );
  const { getDishIncludedItems } = await loadTsModule(
    `${ROOT}/src/lib/dish-presentation.ts`,
  );
  const types = await readFile(`${ROOT}/src/types/index.ts`, "utf8");
  const qwen = await readFile(`${ROOT}/src/lib/ai/qwen.ts`, "utf8");
  const resultsPage = await readFile(`${ROOT}/src/components/results/ResultsPage.tsx`, "utf8");
  const detailPage = await readFile(`${ROOT}/src/components/dish/DishDetailPage.tsx`, "utf8");

  const spicyWrapMeal = {
    id: "spicy-wrap-meal",
    name_original: "BigSpicy Paneer Wrap Meal",
    name_translated: { zh: "辣味奶酪卷套餐" },
    description: { zh: "香辣印度奶酪包裹在薄饼中，配薯条和可乐。" },
    ingredients: ["paneer wrap", "fries", "cola"],
    included_items: ["辣味奶酪卷", "薯条", "可乐"],
    allergens: ["dairy", "wheat"],
    taste_profile: ["spicy", "rich"],
    category: "main",
    image_source: "ai",
  };
  const mcpaneerMeal = {
    ...spicyWrapMeal,
    id: "mcpaneer-meal",
    name_original: "McSpicy™ Paneer Meal",
    name_translated: { zh: "麦辣奶酪套餐" },
    description: { zh: "酥脆炸奶酪汉堡，搭配生菜和酱料，配薯条与可乐。" },
    ingredients: ["paneer burger", "lettuce", "fries", "cola"],
    included_items: ["麦辣奶酪汉堡", "薯条", "可乐"],
  };

  assert.match(types, /included_items\?:\s*string\[\]/);
  assert.match(qwen, /included_items/);
  assert.deepEqual(getDishIncludedItems(spicyWrapMeal), ["辣味奶酪卷", "薯条", "可乐"]);
  assert.equal(matchDishKnowledgeImage(spicyWrapMeal), null);
  assert.equal(matchDishKnowledgeImage(mcpaneerMeal), null);
  assert.equal(classifyDishImageKind(spicyWrapMeal), "meal");
  assert.equal(classifyDishImageKind(mcpaneerMeal), "meal");
  assert.notEqual(buildDishImagePrompt(spicyWrapMeal), buildDishImagePrompt(mcpaneerMeal));
  assert.match(buildDishImagePrompt(spicyWrapMeal), /combo meal|fries|cola|wrap/i);
  assert.match(buildDishImagePrompt(mcpaneerMeal), /combo meal|fries|cola|burger/i);
  assert.match(buildDishImagePrompt(mcpaneerMeal), /ALL included items must be visible/i);
  assert.match(buildDishImagePrompt(mcpaneerMeal), /do not generate only the main item/i);
  assert.match(resultsPage, /getDishIncludedItems/);
  assert.match(resultsPage, /套餐包含/);
  assert.ok(resultsPage.includes('includedItems.join(" / ")'));
  assert.doesNotMatch(resultsPage, /includedItems\.map\(\(item\)/);
  assert.match(detailPage, /getDishIncludedItems/);
  assert.match(detailPage, /套餐包含/);
});

test("dish image prompts prioritize real dish identity over generic category framing", async () => {
  const { buildDishImagePrompt, classifyDishImageKind } = await loadTsModule(
    `${ROOT}/src/lib/ai/image-gen.ts`,
  );

  const prompt = buildDishImagePrompt({
    name_original: "Rouget Barbet",
    name_translated: { zh: "红鲻鱼" },
    description: { zh: "红鲻鱼配海盐、黑胡椒、橄榄油、欧芹和柠檬。" },
    ingredients: ["红鲻鱼", "海盐", "黑胡椒", "橄榄油", "欧芹", "柠檬"],
    category: "main",
  });

  assert.equal(
    classifyDishImageKind({
      name_original: "Rouget Barbet",
      name_translated: { zh: "红鲻鱼" },
      description: { zh: "红鲻鱼配海盐、黑胡椒、橄榄油、欧芹和柠檬。" },
      ingredients: ["红鲻鱼", "海盐", "黑胡椒", "橄榄油", "欧芹", "柠檬"],
      category: "main",
    }),
    "seafood",
  );
  assert.match(prompt, /small Mediterranean red mullet/i);
  assert.match(prompt, /red-orange skin/i);
  assert.match(prompt, /not sea bass/i);
  assert.match(prompt, /not salmon/i);
  assert.match(prompt, /not a large generic grilled fish/i);
});

test("dish image prompts include specific visual identity for foie gras, scallop, escargots, and burrata", async () => {
  const { buildDishImagePrompt } = await loadTsModule(
    `${ROOT}/src/lib/ai/image-gen.ts`,
  );

  // Foie gras
  const foieGrasPrompt = buildDishImagePrompt({
    name_original: "Foie Gras",
    name_translated: { zh: "鹅肝" },
    description: { zh: "香煎鹅肝配无花果酱" },
    ingredients: ["鹅肝", "无花果", "黄油"],
    category: "appetizer",
  });
  assert.match(foieGrasPrompt, /foie gras is a luxurious duck or goose liver/i);
  assert.match(foieGrasPrompt, /not a large meat steak/i);
  assert.match(foieGrasPrompt, /not a whole liver organ raw/i);

  // Scallop
  const scallopPrompt = buildDishImagePrompt({
    name_original: "Coquilles Saint-Jacques",
    name_translated: { zh: "焗烤扇贝" },
    description: { zh: "法式焗烤扇贝配奶油白酱" },
    ingredients: ["扇贝", "奶油", "白酱"],
    category: "appetizer",
  });
  assert.match(scallopPrompt, /scallops are round, pale-cream medallions/i);
  assert.match(scallopPrompt, /not a whole fish/i);
  assert.match(scallopPrompt, /not a generic fried seafood platter/i);

  // Escargots
  const escargotPrompt = buildDishImagePrompt({
    name_original: "Escargots de Bourgogne",
    name_translated: { zh: "勃艮第蜗牛" },
    description: { zh: "经典蒜香黄油焗蜗牛" },
    ingredients: ["蜗牛", "大蒜", "欧芹", "黄油"],
    category: "appetizer",
  });
  assert.match(escargotPrompt, /escargots are.*land snails/i);
  assert.match(escargotPrompt, /garlic-parsley butter/i);
  assert.match(escargotPrompt, /not a bowl of pasta shells/i);
  assert.match(escargotPrompt, /not a soup/i);

  // Burrata
  const burrataPrompt = buildDishImagePrompt({
    name_original: "Burrata",
    name_translated: { zh: "布拉塔奶酪" },
    description: { zh: "新鲜布拉塔奶酪配樱桃番茄和罗勒" },
    ingredients: ["布拉塔奶酪", "樱桃番茄", "罗勒"],
    category: "appetizer",
  });
  assert.match(burrataPrompt, /burrata is a round, white, pillow-soft italian cheese/i);
  assert.match(burrataPrompt, /creamy stracciatella interior/i);
  assert.match(burrataPrompt, /not a hard cheese wedge/i);
  assert.match(burrataPrompt, /not fried mozzarella sticks/i);
});

test("dish image prompts guard against dessert-drink confusion and generic steak", async () => {
  const { buildDishImagePrompt } = await loadTsModule(
    `${ROOT}/src/lib/ai/image-gen.ts`,
  );

  // Affogato (dessert with coffee + ice cream)
  const affogatoPrompt = buildDishImagePrompt({
    name_original: "Affogato",
    name_translated: { zh: "阿芙佳朵" },
    description: { zh: "浓缩咖啡浇在香草冰淇淋上" },
    ingredients: ["浓缩咖啡", "香草冰淇淋"],
    category: "dessert",
  });
  assert.match(affogatoPrompt, /dessert.*food|DESSERT FOOD/i);

  // Steak
  const steakPrompt = buildDishImagePrompt({
    name_original: "Entrecôte",
    name_translated: { zh: "法式肋眼牛排" },
    description: { zh: "炭烤肋眼牛排配黑胡椒汁" },
    ingredients: ["肋眼牛排", "黑胡椒", "黄油"],
    category: "main",
  });
  assert.match(steakPrompt, /steak is a thick-cut beef slice/i);
  assert.match(steakPrompt, /not a thin sliced stir-fry/i);
  assert.match(steakPrompt, /not a stew or braise/i);
});

test("image generation prompt keeps a strict food-photo quality spec", async () => {
  const script = await readFile(`${ROOT}/scripts/generate-dish-content.mjs`, "utf8");
  assert.match(script, /realistic restaurant food photography/i);
  assert.match(script, /accurate ingredients/i);
  assert.match(script, /no text/i);
  assert.match(script, /no logo/i);
  assert.match(script, /no watermark/i);
  assert.match(script, /negative_prompt/i);
});

test("menu OCR defaults to fast mode and avoids low-confidence text refinement", async () => {
  const route = await readFile(`${ROOT}/src/app/api/v1/translate/menu/route.ts`, "utf8");
  assert.match(route, /MENU_FAST_OCR_MODE !== "false"/);
  assert.match(route, /FULL_PROMPT_PAGE_LIMIT = FAST_OCR_MODE\s*\?\s*0/);
  assert.match(route, /MENU_REFINE_LOW_CONFIDENCE === "true"/);
  assert.match(route, /REFINE_LOW_CONFIDENCE && dish\.confidence < 0\.5/);
});

test("menu uploads preserve supported image mime types and allow 20 pages", async () => {
  const { MAX_MENU_IMAGES, normalizeImageMimeType, shouldNormalizeClientImage } = await loadTsModule(
    `${ROOT}/src/lib/image-input.ts`,
  );

  assert.equal(MAX_MENU_IMAGES, 20);
  assert.equal(normalizeImageMimeType("image/webp", "menu.webp"), "image/webp");
  assert.equal(normalizeImageMimeType("", "menu.webp"), "image/webp");
  assert.equal(normalizeImageMimeType("application/octet-stream", "menu.jpg"), "image/jpeg");
  assert.equal(shouldNormalizeClientImage({ name: "small.webp", type: "image/webp", size: 64_000 }), true);
  assert.equal(shouldNormalizeClientImage({ name: "small.jpg", type: "image/jpeg", size: 64_000 }), false);
});

test("server-side menu image normalization protects overseas uploads from large-photo AI timeouts", async () => {
  const packageJson = JSON.parse(await readFile(`${ROOT}/package.json`, "utf8"));
  const route = await readFile(`${ROOT}/src/app/api/v1/translate/menu/route.ts`, "utf8");
  const imageInput = await readFile(`${ROOT}/src/lib/image-input.ts`, "utf8");
  const serverNormalization = await readFile(`${ROOT}/src/lib/server-image-normalization.ts`, "utf8");

  assert.equal(packageJson.dependencies.sharp, "^0.34.5");
  assert.match(imageInput, /DEFAULT_SERVER_IMAGE_MAX_DIM = 896/);
  assert.match(imageInput, /DEFAULT_SERVER_IMAGE_QUALITY = 56/);
  assert.match(imageInput, /getServerImageMaxDim/);
  assert.match(imageInput, /getServerImageQuality/);
  assert.match(serverNormalization, /export async function normalizeServerMenuImage/);
  assert.match(serverNormalization, /await import\("sharp"\)/);
  assert.match(serverNormalization, /const maxDim = getServerImageMaxDim\(\)/);
  assert.match(serverNormalization, /const quality = getServerImageQuality\(\)/);
  assert.match(serverNormalization, /jpeg\(\{ quality/);
  assert.match(route, /normalizeServerMenuImage/);
  assert.match(route, /normalized\.buffer\.toString\("base64"\)/);
  assert.match(route, /normalized\.mimeType/);
  assert.match(route, /normalizedSize/);
});

test("menu recognition has instrumentation and upload optimizations for fast first paint", async () => {
  const apiClient = await readFile(`${ROOT}/src/lib/api-client.ts`, "utf8");
  const route = await readFile(`${ROOT}/src/app/api/v1/translate/menu/route.ts`, "utf8");
  const qwen = await readFile(`${ROOT}/src/lib/ai/qwen.ts`, "utf8");

  assert.match(apiClient, /maxDim = 1024,\s*quality = 0\.62/);
  assert.match(apiClient, /console\.info\("translate:client_upload_prepared"/);
  assert.match(apiClient, /originalBytes/);
  assert.match(apiClient, /compressedBytes/);
  assert.match(apiClient, /compressionMs/);

  assert.match(route, /\.createHash\("sha256"\)/);
  assert.match(route, /hashImageContent\(targetLang/);
  assert.match(route, /const timings: TranslationTimings/);
  assert.match(route, /formDataMs/);
  assert.match(route, /normalizationMs/);
  assert.match(route, /firstPassMs/);
  assert.match(route, /firstPageMs/);
  assert.match(route, /metadata[\s\S]*timings/);
  assert.match(route, /translate:task_intake_ready/);
  assert.match(route, /translate:page_first_pass_finished/);
  assert.match(route, /setTimeout\(\(\) => \{/);
  assert.match(route, /MENU_ENRICHMENT_DELAY_MS/);

  assert.match(qwen, /MENU_FAST_FIRST_PASS_MAX_TOKENS/);
  assert.match(qwen, /QWEN_FAST_VL_MODEL/);
  assert.match(qwen, /model:\s*fastFirstPass \? FAST_VL_MODEL : VL_MODEL/);
  assert.match(qwen, /analyzeWithPrompt\(base64Image,\s*VL_SYSTEM_PROMPT_FAST_FIRST_PASS,\s*mimeType,\s*FAST_FIRST_PASS_MAX_TOKENS,\s*targetLang,\s*\{\s*fastFirstPass:\s*true\s*\}\)/);
});

test("fast overseas recognition returns a lightweight first result before enrichment", async () => {
  const qwen = await readFile(`${ROOT}/src/lib/ai/qwen.ts`, "utf8");
  const aiIndex = await readFile(`${ROOT}/src/lib/ai/index.ts`, "utf8");
  const route = await readFile(`${ROOT}/src/app/api/v1/translate/menu/route.ts`, "utf8");

  assert.match(qwen, /VL_SYSTEM_PROMPT_FAST_FIRST_PASS/);
  assert.match(qwen, /export async function analyzeMenuImageFast/);
  assert.match(qwen, /analyzeWithPrompt\(base64Image,\s*VL_SYSTEM_PROMPT_FAST_FIRST_PASS,\s*mimeType,\s*FAST_FIRST_PASS_MAX_TOKENS,\s*targetLang,\s*\{\s*fastFirstPass:\s*true\s*\}\)/);
  assert.match(qwen, /Do NOT generate recommendation/);
  assert.match(qwen, /provide ONLY[\s\S]*name_original[\s\S]*name_translated[\s\S]*description[\s\S]*confidence/);
  assert.doesNotMatch(qwen.match(/const VL_SYSTEM_PROMPT_FAST_FIRST_PASS = `([\s\S]*?)`;/)?.[1] || "", /ingredients|allergens|taste_profile/);
  assert.match(aiIndex, /analyzeMenuImageFast/);
  assert.match(route, /FAST_FIRST_PASS/);
  assert.match(route, /analyzeMenuImageFast/);
  assert.match(route, /resultPayload[\s\S]*metadata[\s\S]*enrichment_status:\s*"pending"/);
  assert.match(route, /enrichResultInBackground/);
  assert.match(route, /enrichResultInBackground[\s\S]*generateImagesInBackground\(taskId, enrichedPayload, cacheKey\)/);
  assert.match(route, /translate:task_first_pass_finished/);
});

test("fast first-pass returns text results without waiting for remote image cache lookups", async () => {
  const route = await readFile(`${ROOT}/src/app/api/v1/translate/menu/route.ts`, "utf8");

  assert.match(route, /type DishRecordOptions/);
  assert.match(route, /imageLookup\?:\s*"full" \| "local-only"/);
  assert.match(route, /const imageLookup = options\.imageLookup \|\| "full"/);
  assert.match(route, /imageLookup === "full"[\s\S]*findExistingDishImages/);
  assert.match(route, /imageLookup === "full"[\s\S]*getCachedDishImageUrl/);
  assert.match(route, /processImagesFastFirstPass[\s\S]*buildDishRecords\(raw\.dishes,\s*raw\.page_label,\s*usedImageIds,\s*targetLang,\s*\{\s*imageLookup:\s*"local-only"\s*\}\)/);
  assert.match(route, /MENU_IMAGE_GENERATION_CONCURRENCY \|\| "1"/);
});

test("loading screen copy does not imply blocking AI image generation", async () => {
  const loadingPage = await readFile(`${ROOT}/src/components/results/LoadingPage.tsx`, "utf8");

  assert.doesNotMatch(loadingPage, /正在匹配图片/);
  assert.match(loadingPage, /正在准备结果/);
});

test("result-page AI fields are requested in fast and enriched menu analysis", async () => {
  const qwen = await readFile(`${ROOT}/src/lib/ai/qwen.ts`, "utf8");

  assert.match(qwen, /process\.env\.QWEN_BASE_URL \|\| "https:\/\/dashscope\.aliyuncs\.com\/compatible-mode\/v1"/);
  assert.match(qwen, /process\.env\.QWEN_VL_MODEL \|\| "qwen-vl-max"/);
  assert.match(qwen, /process\.env\.QWEN_TEXT_MODEL \|\| "qwen-plus"/);

  const fastPrompt = qwen.match(/const VL_SYSTEM_PROMPT_FAST_FIRST_PASS = `([\s\S]*?)`;/)?.[1] || "";
  assert.match(fastPrompt, /category:\s*one of "appetizer","main","staple","dessert","drink"/);
  assert.match(fastPrompt, /Do NOT generate recommendation/);
  assert.doesNotMatch(fastPrompt.match(/Output ONLY valid JSON:([\s\S]*)/)?.[1] || "", /recommendation|good_for|caution/);

  const simplePrompt = qwen.match(/const VL_SYSTEM_PROMPT_SIMPLE = `([\s\S]*?)`;/)?.[1] || "";
  assert.match(simplePrompt, /category:\s*one of "appetizer","main","staple","dessert","drink"/);
  assert.match(simplePrompt, /"menu_metadata":/);
  assert.match(simplePrompt, /"restaurant":/);
  assert.match(simplePrompt, /"insight":/);
  assert.match(simplePrompt, /"signature":/);
});

test("fast first-pass and enrichment preserve results summary metadata", async () => {
  const route = await readFile(`${ROOT}/src/app/api/v1/translate/menu/route.ts`, "utf8");

  assert.match(route, /type MenuAnalysisResult[\s\S]*menu_metadata\?:/);
  assert.match(route, /function needsTargetLanguageCorrection/);
  assert.match(route, /refineDishesForTargetLanguage/);
  assert.doesNotMatch(route, /const shouldRefine = raw\.dishes\.length <= 10;/);
  assert.match(route, /processImagesFastFirstPass[\s\S]*restaurant:\s*extractRestaurantMeta\(sorted\)/);
  assert.match(route, /processImagesFastFirstPass[\s\S]*insight:\s*extractMenuInsight\(sorted\)/);
  assert.match(route, /processImagesFastFirstPass[\s\S]*signature:\s*extractSignature\(sorted\)/);
  assert.match(route, /enrichedPayload[\s\S]*restaurant:\s*extractRestaurantMeta\(pages\)/);
  assert.match(route, /enrichedPayload[\s\S]*insight:\s*extractMenuInsight\(pages\)/);
  assert.match(route, /enrichedPayload[\s\S]*signature:\s*extractSignature\(pages\)/);
});

test("results categories infer useful tabs from dish text and restore AI and girl-favorite tabs", async () => {
  const { buildCategoryList, filterDishesByCategory } = await loadTsModule(
    `${ROOT}/src/lib/results-categories.ts`,
  );

  const result = {
    task_id: "dessert-menu",
    status: "done",
    pages: [{
      page_index: 0,
      page_label: "Desserts",
      image_thumbnail: "",
      dishes: [
        {
          id: "tiramisu",
          name_original: "TIRAMISU MAISON",
          name_translated: { zh: "自制提拉米苏" },
          description: { zh: "咖啡酒浸手指饼配马斯卡彭奶油，甜点。" },
          ingredients: ["马斯卡彭", "咖啡"],
          allergens: [],
          taste_profile: [],
          image_source: "ai",
          rating_avg: 4.8,
        },
        {
          id: "mousse",
          name_original: "MOUSSE AU CHOCOLAT",
          name_translated: { zh: "巧克力慕斯" },
          description: { zh: "浓郁巧克力甜品，口感柔滑。" },
          ingredients: ["巧克力"],
          allergens: [],
          taste_profile: [],
          image_source: "ai",
        },
        {
          id: "pizza",
          name_original: "LA DIAVOLA 16,00€",
          name_translated: { zh: "恶魔披萨" },
          description: { zh: "有机番茄酱、Fior di latte 马苏里拉奶酪和辣味萨拉米。" },
          ingredients: ["番茄酱", "Fior di latte", "萨拉米"],
          allergens: ["dairy"],
          taste_profile: ["spicy"],
          category: "main",
          image_source: "ai",
        },
        {
          id: "chocolate-pizza",
          name_original: "LA PIZZA « CIOCCOLATO » 12,00€",
          name_translated: { zh: "巧克力披萨" },
          description: { zh: "甜味披萨，搭配有机榛子奶油、自制焦糖和切碎榛子。" },
          ingredients: ["披萨面饼", "巧克力", "榛子"],
          allergens: ["gluten", "tree_nut"],
          taste_profile: ["sweet"],
          category: "dessert",
          image_source: "ai",
        },
        {
          id: "pommeau-glace",
          name_original: "POMMEAU GLACÉ 12,00€",
          name_translated: { zh: "苹果冰沙配卡尔瓦多斯" },
          description: { zh: "苹果冰沙加入卡尔瓦多斯苹果酒，清爽微醺。" },
          ingredients: ["Pommeau", "Calvados", "苹果"],
          allergens: [],
          taste_profile: ["refreshing"],
          category: "dessert",
          image_source: "ai",
        },
      ],
    }],
    metadata: {
      source_language: "fr",
      target_language: "zh",
      total_dishes: 3,
      cached: false,
      signature: { dish_ids: ["tiramisu"], reason: "经典甜点" },
    },
  };

  const categories = buildCategoryList(result);
  const categoryKeys = categories.map((c) => c.key);
  assert.ok(categories.length >= 5, `expected compact smart categories, got ${categoryKeys.join(",")}`);
  assert.ok(categories.length <= 6, `small menus should stay compact, got ${categoryKeys.join(",")}`);
  for (const key of ["all", "must_order", "ai_recommend", "girl_favorite", "staple", "dessert"]) {
    assert.ok(categoryKeys.includes(key), `missing ${key}`);
  }
  assert.equal(categories.find((c) => c.key === "dessert")?.count, 2);
  assert.equal(categories.find((c) => c.key === "girl_favorite")?.count, 4);
  assert.equal(categories.find((c) => c.key === "ai_recommend")?.count, 1);
  assert.equal(categories.find((c) => c.key === "staple")?.count, 2);
  assert.equal(categories.find((c) => c.key === "main"), undefined);
  assert.equal(categories.find((c) => c.key === "drink"), undefined);
  assert.equal(filterDishesByCategory(result, "dessert").length, 2);
  assert.deepEqual(filterDishesByCategory(result, "drink").map((dish) => dish.id), ["pommeau-glace"]);
  assert.deepEqual(filterDishesByCategory(result, "staple").map((dish) => dish.id), ["pizza", "chocolate-pizza"]);
});

test("results categories adapt count to menu size instead of forcing sparse menus into seven filters", async () => {
  const { buildCategoryList, filterDishesByCategory } = await loadTsModule(
    `${ROOT}/src/lib/results-categories.ts`,
  );

  const result = {
    task_id: "pizza-menu",
    status: "done",
    pages: [{
      page_index: 0,
      page_label: "Pizza",
      image_thumbnail: "",
      dishes: [
        {
          id: "marinara",
          name_original: "LA MARINARA 11,50€",
          name_translated: { zh: "玛琳娜披萨" },
          description: { zh: "有机番茄酱、牛至和蒜油，经典招牌。" },
          ingredients: ["番茄酱", "牛至", "蒜油"],
          allergens: [],
          taste_profile: ["classic", "light"],
          category: "main",
          image_source: "ai",
        },
        {
          id: "margherita",
          name_original: "LA MARGHERITA 13,50€",
          name_translated: { zh: "玛格丽特披萨" },
          description: { zh: "番茄酱、Fior di latte 马苏里拉奶酪、罗勒，适合分享。" },
          ingredients: ["番茄酱", "Fior di latte", "罗勒"],
          allergens: ["dairy"],
          taste_profile: ["vegetarian", "fresh"],
          category: "main",
          image_source: "ai",
        },
        {
          id: "diavola",
          name_original: "LA DIAVOLA 16,00€",
          name_translated: { zh: "恶魔披萨" },
          description: { zh: "番茄酱、Fior di latte 马苏里拉奶酪和辣味萨拉米。" },
          ingredients: ["番茄酱", "Fior di latte", "萨拉米"],
          allergens: ["dairy"],
          taste_profile: ["spicy"],
          category: "main",
          image_source: "ai",
        },
        {
          id: "tonno",
          name_original: "LA THON ET OIGNONS 19,50€",
          name_translated: { zh: "金枪鱼洋葱披萨" },
          description: { zh: "金枪鱼腩、红洋葱和牛至，海鲜鲜味明显。" },
          ingredients: ["金枪鱼", "洋葱"],
          allergens: ["fish"],
          taste_profile: ["umami"],
          category: "main",
          image_source: "ai",
        },
      ],
    }],
    metadata: {
      source_language: "fr",
      target_language: "zh",
      total_dishes: 4,
      cached: false,
      signature: { dish_ids: ["marinara", "margherita"], reason: "菜单精选推荐" },
    },
  };

  const categories = buildCategoryList(result);
  const keys = categories.map((c) => c.key);
  assert.ok(categories.length >= 5, `expected compact useful categories, got ${keys.join(",")}`);
  assert.ok(categories.length <= 6, `small menus should not feel over-categorized, got ${keys.join(",")}`);
  assert.ok(keys.includes("ai_recommend"));
  assert.ok(keys.includes("girl_favorite"));
  assert.ok(keys.includes("safe_pick"));
  assert.equal(categories.find((c) => c.key === "drink"), undefined);
  assert.equal(categories.find((c) => c.key === "main"), undefined);
  assert.equal(categories.find((c) => c.key === "staple"), undefined);
  assert.equal(filterDishesByCategory(result, "spicy").map((dish) => dish.id).join(","), "diavola");
  assert.equal(filterDishesByCategory(result, "seafood").map((dish) => dish.id).join(","), "tonno");
});

test("results categories still provide richer filters for larger menus", async () => {
  const { buildCategoryList } = await loadTsModule(
    `${ROOT}/src/lib/results-categories.ts`,
  );

  const dishes = Array.from({ length: 12 }, (_, index) => {
    const id = `dish-${index + 1}`;
    const variants = [
      { name: "招牌牛排", desc: "主厨经典牛排，浓郁酱汁，适合肉食爱好者。", category: "main", ingredients: ["牛肉"] },
      { name: "海鲜意面", desc: "虾和贝类搭配番茄酱，适合分享。", category: "staple", ingredients: ["虾", "意面"] },
      { name: "罗勒番茄沙拉", desc: "清爽开胃，适合素食者。", category: "appetizer", ingredients: ["番茄", "罗勒"] },
      { name: "奶酪拼盘", desc: "当地奶酪组合，适合分享。", category: "appetizer", ingredients: ["奶酪"] },
      { name: "巧克力慕斯", desc: "浓郁甜点，适合饭后。", category: "dessert", ingredients: ["巧克力"] },
      { name: "柠檬苏打", desc: "清爽饮品。", category: "drink", ingredients: ["柠檬"] },
    ][index % 6];
    return {
      id,
      name_original: variants.name,
      name_translated: { zh: variants.name },
      description: { zh: variants.desc },
      ingredients: variants.ingredients,
      category: variants.category,
      allergens: [],
      taste_profile: [],
      image_source: "ai",
    };
  });

  const categories = buildCategoryList({
    task_id: "large-menu",
    status: "done",
    pages: [{ page_index: 0, page_label: "Menu", image_thumbnail: "", dishes }],
    metadata: {
      source_language: "fr",
      target_language: "zh",
      total_dishes: dishes.length,
      cached: false,
      signature: { dish_ids: ["dish-1", "dish-2", "dish-4"], reason: "招牌菜" },
    },
  });
  const keys = categories.map((c) => c.key);
  assert.ok(categories.length >= 7, `larger menus should expose richer filters, got ${keys.join(",")}`);
  assert.ok(keys.includes("ai_recommend"));
  assert.ok(keys.includes("girl_favorite"));
  assert.ok(keys.includes("drink"));
  assert.ok(keys.includes("dessert"));
});

test("dish cards and detail can show smart category labels as normal dish pills", async () => {
  const { buildDishDisplayTags } = await loadTsModule(
    `${ROOT}/src/lib/dish-display-tags.ts`,
  );

  const dish = {
    id: "margherita",
    name_original: "LA MARGHERITA 13,50€",
    name_translated: { zh: "玛格丽特披萨" },
    description: { zh: "有机番茄酱、Fior di latte 马苏里拉奶酪、橄榄油和罗勒，适合分享。" },
    ingredients: ["番茄酱", "Fior di latte", "罗勒"],
    allergens: ["dairy"],
    taste_profile: ["vegetarian", "fresh"],
    category: "main",
    image_source: "ai",
  };
  const tags = buildDishDisplayTags({
    dish,
    signature: { dish_ids: ["margherita"], reason: "菜单精选推荐" },
    maxTags: 4,
  });

  assert.deepEqual(tags.map((tag) => tag.label), ["本店必点", "AI 推荐", "女生喜欢", "素食"]);
  assert.ok(tags.every((tag) => tag.type === "green" || tag.type === "veg"));

  const resultsPage = await readFile(`${ROOT}/src/components/results/ResultsPage.tsx`, "utf8");
  const detailPage = await readFile(`${ROOT}/src/components/dish/DishDetailPage.tsx`, "utf8");
  const appPage = await readFile(`${ROOT}/src/app/page.tsx`, "utf8");
  assert.match(resultsPage, /buildDishDisplayTags/);
  assert.match(resultsPage, /signature:\s*result\?\.metadata\?\.signature/);
  assert.match(detailPage, /smartTags/);
  assert.match(appPage, /buildDishDisplayTags/);
  assert.match(appPage, /smartTags=\{selectedDishSmartTags\}/);
});

test("sparse menus stay compact and avoid fake filter entry points", async () => {
  const { buildCategoryList, filterDishesByCategory } = await loadTsModule(
    `${ROOT}/src/lib/results-categories.ts`,
  );

  const result = {
    task_id: "sparse-menu",
    status: "done",
    pages: [{
      page_index: 0,
      page_label: "Menu",
      image_thumbnail: "",
      dishes: [
        {
          id: "unknown",
          name_original: "MENU ITEM",
          name_translated: { zh: "菜单菜品" },
          description: {},
          ingredients: [],
          allergens: [],
          taste_profile: [],
          image_source: "ai",
        },
      ],
    }],
    metadata: {
      source_language: "en",
      target_language: "zh",
      total_dishes: 1,
      cached: false,
    },
  };

  const categories = buildCategoryList(result);
  assert.deepEqual(categories.map((c) => c.key), ["all"]);
  assert.deepEqual(filterDishesByCategory(result, "all").map((dish) => dish.id), ["unknown"]);
  assert.deepEqual(filterDishesByCategory(result, "safe_pick"), []);
});

test("menu summary tags prioritize four dish-aware user-need labels", async () => {
  const { buildMenuSmartTags } = await loadTsModule(
    `${ROOT}/src/lib/results-menu-tags.ts`,
  );

  const pizzaDishes = [
    {
      id: "margherita",
      name_original: "LA MARGHERITA",
      name_translated: { zh: "玛格丽特披萨" },
      description: { zh: "番茄酱、Fior di latte 马苏里拉奶酪、罗勒，适合分享。" },
      ingredients: ["番茄酱", "Fior di latte", "罗勒"],
      taste_profile: ["vegetarian", "fresh"],
      image_source: "ai",
    },
    {
      id: "diavola",
      name_original: "LA DIAVOLA",
      name_translated: { zh: "恶魔披萨" },
      description: { zh: "辣味萨拉米、马苏里拉奶酪和番茄酱。" },
      ingredients: ["萨拉米", "马苏里拉奶酪"],
      taste_profile: ["spicy"],
      image_source: "ai",
    },
    {
      id: "tonno",
      name_original: "LA THON ET OIGNONS",
      name_translated: { zh: "金枪鱼洋葱披萨" },
      description: { zh: "金枪鱼、洋葱和牛至，鲜味明显。" },
      ingredients: ["金枪鱼", "洋葱"],
      taste_profile: ["umami"],
      image_source: "ai",
    },
  ];

  const tags = buildMenuSmartTags({
    sourceLang: "it",
    dishes: pizzaDishes,
    aiTags: ["约会小聚", "朋友聚餐", "配红酒", "主厨推荐", "第 5 个"],
  });

  assert.equal(tags.length, 4);
  assert.deepEqual(tags, ["适合分享", "奶酪爱好", "辣味选择", "海鲜鲜味"]);
  assert.doesNotMatch(tags.join(","), /约会小聚|朋友聚餐|配红酒|主厨推荐|第 5 个/);

  const sparseTags = buildMenuSmartTags({
    sourceLang: "fr",
    dishes: [{ id: "x", name_original: "MENU ITEM", name_translated: { zh: "菜单菜品" }, description: {}, ingredients: [], taste_profile: [], image_source: "ai" }],
    aiTags: [],
  });
  assert.equal(sparseTags.length, 4);
  assert.deepEqual(sparseTags, ["稳妥选择", "适合分享", "当地特色", "轻松聚餐"]);
});

test("menu source language is corrected from dish and restaurant evidence", async () => {
  const { resolveMenuSourceLanguage } = await loadTsModule(
    `${ROOT}/src/lib/menu-source-language.ts`,
  );

  const italianMenu = {
    metadata: {
      source_language: "fr",
      target_language: "zh",
      total_dishes: 3,
      cached: false,
      restaurant: { display_name: "Pecora Negra Pizzeria", restaurant_type: "Pizzeria", rating_estimate: 4.2 },
    },
    pages: [{
      page_index: 0,
      page_label: "菜单",
      image_thumbnail: "",
      dishes: [
        { id: "margherita", name_original: "LA MARGHERITA 13,50€", name_translated: { zh: "玛格丽特披萨" }, description: { zh: "番茄、马苏里拉和罗勒。" }, ingredients: ["Fior di latte", "basilico"], allergens: [], taste_profile: [], image_source: "ai" },
        { id: "diavola", name_original: "LA DIAVOLA 16,00€", name_translated: { zh: "恶魔披萨" }, description: { zh: "辣味萨拉米披萨。" }, ingredients: ["salame piccante"], allergens: [], taste_profile: [], image_source: "ai" },
        { id: "espresso", name_original: "ESPRESSO 2,50€", name_translated: { zh: "浓缩咖啡" }, description: { zh: "意式浓缩。" }, ingredients: [], allergens: [], taste_profile: [], image_source: "ai" },
      ],
    }],
  };

  assert.equal(resolveMenuSourceLanguage(italianMenu), "it");
});

test("menu analysis normalization separates multiline names from descriptions", async () => {
  const { normalizeExtractedDishFields } = await loadTsModule(
    `${ROOT}/src/lib/menu-analysis-normalization.ts`,
  );

  const dish = normalizeExtractedDishFields({
    name_original: "枝豆\n塩ゆで枝豆",
    name_translated: "毛豆",
    description: "",
    confidence: 0.8,
  });

  assert.equal(dish.name_original, "枝豆");
  assert.equal(dish.description, "塩ゆで枝豆");
  assert.equal(dish.confidence, 0.8);
});

test("menu analysis normalization keeps fine-dining dish names separate from garnish descriptions", async () => {
  const { normalizeExtractedDishFields } = await loadTsModule(
    `${ROOT}/src/lib/menu-analysis-normalization.ts`,
  );

  const foie = normalizeExtractedDishFields({
    name_original: "Half-Baked Duck Foie Gras Marinated with Cognac, Tahitian Vanilla & Fives Spices, Sauternes Wine Jelly, Cherry Tomato Jam, Toasted Ginger & Goji Berry Brioche.",
    name_translated: "半烤鸭肝鹅肝配干邑、塔希提香草与五香料，苏玳酒冻，樱桃番茄酱，烤姜与枸杞面包",
    description: "",
    category: "drink",
    confidence: 0.82,
  });

  assert.equal(foie.name_original, "Half-Baked Duck Foie Gras");
  assert.equal(foie.name_translated, "半烤鸭肝鹅肝");
  assert.match(foie.description, /Cognac|Tahitian Vanilla|Sauternes|Brioche/);
  assert.equal(foie.category, "appetizer");

  const scallops = normalizeExtractedDishFields({
    name_original: "Pan Fried Japanese Hokkaido Sea Scallops, Grilled King Oyster Mushrooms, Mashed Pumpkin with Spices, Sautéed Asparagus, Scallop Crispy Tuile, Salmon Roe, Citrus Foam, Lemon Gel, Coconut Reduction, Yuzu Sauce.",
    name_translated: "煎日本北海道扇贝，烤杏鲍菇，香料南瓜泥，炒芦笋，扇贝脆片，鲑鱼子，柑橘泡沫，柠檬凝胶，椰奶浓缩汁，柚子酱",
    description: "",
    category: "dessert",
    confidence: 0.84,
  });

  assert.equal(scallops.name_original, "Pan Fried Japanese Hokkaido Sea Scallops");
  assert.equal(scallops.name_translated, "煎日本北海道扇贝");
  assert.match(scallops.description, /King Oyster Mushrooms|Yuzu Sauce/);
  assert.equal(scallops.category, "appetizer");
});

test("global menu recognition is resilient to slow overseas uploads and provider failures", async () => {
  const apiClient = await readFile(`${ROOT}/src/lib/api-client.ts`, "utf8");
  const aiIndex = await readFile(`${ROOT}/src/lib/ai/index.ts`, "utf8");
  const route = await readFile(`${ROOT}/src/app/api/v1/translate/menu/route.ts`, "utf8");
  const loadingPage = await readFile(`${ROOT}/src/components/results/LoadingPage.tsx`, "utf8");
  const appPage = await readFile(`${ROOT}/src/app/page.tsx`, "utf8");

  assert.match(apiClient, /TRANSLATION_UPLOAD_TIMEOUT_MS/);
  assert.match(apiClient, /AbortController/);
  assert.match(apiClient, /maxDim = 1024/);
  assert.match(apiClient, /quality = 0\.62/);
  assert.match(aiIndex, /providerOrder/);
  assert.match(aiIndex, /MENU_AI_PROVIDER/);
  assert.match(aiIndex, /analyzeMenuImage[\s\S]*lastError/);
  assert.match(aiIndex, /Provider \$\{provider\} failed/);
  assert.match(route, /translate:task_started/);
  assert.match(route, /translate:page_failed/);
  assert.match(route, /provider/);
  assert.match(loadingPage, /MAX_POLLING_MS/);
  assert.match(loadingPage, /onTimeout/);
  assert.match(appPage, /handleLoadingTimeout/);
  assert.match(appPage, /海外网络/);
});

test("translation tasks can fall back to memory when the remote task store is unavailable", async () => {
  const taskStore = await readFile(`${ROOT}/src/lib/cache/task-store.ts`, "utf8");
  const route = await readFile(`${ROOT}/src/app/api/v1/translate/menu/route.ts`, "utf8");

  assert.match(taskStore, /const memoryTasks = new Map/);
  assert.match(taskStore, /const memoryOnlyTasks = new Set/);
  assert.match(taskStore, /allowMemoryFallback\?:\s*boolean/);
  assert.match(taskStore, /preferMemory\?:\s*boolean/);
  assert.match(taskStore, /MENU_TASK_MEMORY_FALLBACK/);
  assert.match(taskStore, /Task store request failed; using memory fallback/);
  assert.match(taskStore, /Task store read failed/);
  assert.match(taskStore, /Task store update request failed/);
  assert.match(taskStore, /if \(options\.preferMemory\)/);
  assert.match(taskStore, /memoryTasks\.set\(id, task\)/);
  assert.match(taskStore, /memoryOnlyTasks\.add\(id\)/);
  assert.match(taskStore, /memoryTasks\.get\(id\) \|\| await getTask\(id\)/);
  assert.match(taskStore, /if \(memoryOnlyTasks\.has\(id\)\) return/);
  assert.match(taskStore, /if \(error\)/);
  assert.match(taskStore, /Task store unavailable/);
  assert.match(taskStore, /updates\.status \|\| existing\.status/);
  assert.match(route, /isLocalTaskFallbackRequest\(req\)/);
  assert.match(route, /allowMemoryFallback:\s*true/);
  assert.match(route, /preferMemory:\s*preferMemoryTask/);
  assert.match(route, /localhost|127\\.0\\.0\\.1|\[::1\]/);
});

test("translation cache survives process restarts through a server file cache", async () => {
  const route = await readFile(`${ROOT}/src/app/api/v1/translate/menu/route.ts`, "utf8");
  const fileCache = await readFile(`${ROOT}/src/lib/cache/translation-file-cache.ts`, "utf8");

  assert.match(route, /getCachedTranslationResult\(cacheKey\)/);
  assert.match(route, /rememberTranslation\(cacheKey,\s*resultPayload\)/);
  assert.match(route, /rememberTranslation\(cacheKey,\s*enrichedPayload\)/);
  assert.match(route, /setCachedTranslationResult\(cacheKey,\s*result\)/);
  assert.match(fileCache, /MENU_TRANSLATION_FILE_CACHE_DIR/);
  assert.match(fileCache, /MENU_TRANSLATION_FILE_CACHE_TTL_MS/);
  assert.match(fileCache, /createHash\("sha256"\)\.update\(cacheKey\)/);
  assert.match(fileCache, /\.cache", "translation-results"/);
});

test("dietary settings persist locally across page refreshes without an account", async () => {
  const localStorage = await readFile(`${ROOT}/src/lib/local-storage.ts`, "utf8");
  const appPage = await readFile(`${ROOT}/src/app/page.tsx`, "utf8");

  assert.match(localStorage, /dishlens_settings/);
  assert.match(localStorage, /export function getSettings/);
  assert.match(localStorage, /export function setSettings/);
  assert.match(localStorage, /globalThis/);
  assert.match(localStorage, /getBrowserStorage/);
  assert.match(localStorage, /getBrowserDocument/);
  assert.doesNotMatch(localStorage, /typeof window === "undefined"/);
  assert.match(appPage, /getSettings as getStoredSettings/);
  assert.match(appPage, /setSettings as setStoredSettings/);
  assert.match(appPage, /getStoredSettings\(\)/);
  assert.match(appPage, /setStoredSettings\(next\)/);
});

test("language settings affect API target language, cache keys, visible settings copy, and result text", async () => {
  await loadTsModule(`${ROOT}/src/lib/dish-image-match.ts`);
  const { getDishText } = await loadTsModule(`${ROOT}/src/lib/dish-presentation.ts`);
  const apiClient = await readFile(`${ROOT}/src/lib/api-client.ts`, "utf8");
  const appPage = await readFile(`${ROOT}/src/app/page.tsx`, "utf8");
  const route = await readFile(`${ROOT}/src/app/api/v1/translate/menu/route.ts`, "utf8");
  const qwen = await readFile(`${ROOT}/src/lib/ai/qwen.ts`, "utf8");
  const settingsPage = await readFile(`${ROOT}/src/components/settings/SettingsPage.tsx`, "utf8");
  const resultsPage = await readFile(`${ROOT}/src/components/results/ResultsPage.tsx`, "utf8");

  assert.equal(
    getDishText({
      id: "dish-ja",
      name_original: "TAIYAKI",
      name_translated: { zh: "鲷鱼烧", ja: "たい焼き" },
      description: { zh: "红豆甜点", ja: "あんこ入りの和菓子" },
      ingredients: [],
      allergens: [],
      taste_profile: [],
      image_source: "ai",
    }, "ja").translatedName,
    "たい焼き",
  );

  assert.match(apiClient, /postTranslation\(images:\s*File\[\],\s*targetLang/);
  assert.match(apiClient, /const normalizedTargetLang = normalizeTargetLang\(targetLang\)/);
  assert.match(apiClient, /formData\.append\("target_lang",\s*normalizedTargetLang\)/);
  assert.doesNotMatch(apiClient, /formData\.append\("target_lang",\s*"zh"\)/);
  assert.match(appPage, /createTranslation\(files,\s*settings\.targetLang\)/);
  assert.match(appPage, /targetLang=\{settings\.targetLang\}/);
  assert.match(appPage, /uiLang=\{settings\.uiLang\}/);
  assert.match(route, /normalizeTargetLang/);
  assert.match(route, /hashImageContent\(targetLang/);
  assert.match(route, /analyzeMenuImageFast\(item\.base64,\s*false,\s*item\.mimeType,\s*targetLang\)/);
  assert.match(route, /target_language:\s*targetLang/);
  assert.match(qwen, /TARGET_LANGUAGE_LABELS/);
  assert.match(qwen, /targetLanguageInstruction/);
  assert.match(qwen, /analyzeMenuImageFast\(base64Image:[\s\S]*targetLang/);
  assert.match(settingsPage, /settingsCopy/);
  assert.match(settingsPage, /const copy = settingsCopy\[s\.uiLang\]/);
  assert.match(resultsPage, /targetLanguageName\(resultTargetLang/);
  assert.match(resultsPage, /targetLanguageNativeName\(resultTargetLang\)/);
});

test("home page responds to interface language settings beyond the settings screen", async () => {
  const appPage = await readFile(`${ROOT}/src/app/page.tsx`, "utf8");
  const homePage = await readFile(`${ROOT}/src/components/home/HomePage.tsx`, "utf8");
  const recommendationHook = await readFile(`${ROOT}/src/hooks/useDailyRecommendation.ts`, "utf8");

  assert.match(appPage, /uiLang=\{settings\.uiLang\}/);
  assert.match(appPage, /useDailyRecommendation\(settings\.uiLang\)/);
  assert.match(appPage, /recentHistory=\{mounted \? buildRecentMenuRecords\(historyEntries, \{ targetLang: settings\.targetLang \}\) : undefined\}/);
  assert.match(appPage, /restaurantSource=\{dailyRestaurantSource\}/);
  assert.match(appPage, /selectedDishRestaurantSource/);
  assert.match(appPage, /restaurantSource=\{selectedDishRestaurantSource\}/);
  assert.match(appPage, /setSelectedDishRestaurantSource\(dailyRestaurantSource\)/);
  assert.match(appPage, /setSelectedDishRestaurantSource\(null\)/);
  assert.match(homePage, /uiLang\?:\s*"zh"\s*\|\s*"en"/);
  assert.match(homePage, /restaurantSource\?:/);
  assert.match(homePage, /const homeCopy =/);
  assert.match(homePage, /const copy = homeCopy\[uiLang === "en" \? "en" : "zh"\]/);
  assert.match(homePage, /copy\.captureCta/);
  assert.match(homePage, /copy\.albumCta/);
  assert.match(homePage, /copy\.recentTitle/);
  assert.match(homePage, /copy\.viewAll/);
  assert.match(homePage, /visibility:\s*isEmpty\s*\?\s*"hidden"\s*:\s*"visible"/);
  assert.doesNotMatch(homePage, /\{!isEmpty && \(/);
  assert.match(homePage, /failedRecentThumbs/);
  assert.match(homePage, /onError=\{\(\) => setFailedRecentThumbs/);
  assert.match(homePage, /copy\.navHistory/);
  assert.match(homePage, /copy\.navFavorites/);
  assert.match(homePage, /copy\.navSettings/);
  assert.match(homePage, /copy\.emptyTitle/);
  assert.match(homePage, /copy\.recommendationReasonLabel/);
  assert.match(homePage, /formatCuisine\(dailyDish\?\.cuisine \|\| "french",\s*uiLang\)/);
  assert.match(homePage, /formatCategory\(dailyDish\?\.category,\s*uiLang\)/);
  assert.match(homePage, /formatTaste\(t,\s*uiLang\)/);
  assert.match(homePage, /Today's pick/);
  assert.match(homePage, /Choose from album/);
  assert.match(homePage, /Italian cuisine/);
  assert.match(homePage, /Creamy/);
  assert.match(recommendationHook, /export function useDailyRecommendation\(uiLang: "zh" \| "en" = "zh"\)/);
  assert.match(recommendationHook, /restaurant,\s*loading,\s*contextLabel,\s*reason/);
  assert.match(recommendationHook, /setDish\(cached\)/);
  assert.match(recommendationHook, /fetchNearbyRestaurant/);
  assert.match(recommendationHook, /location-rec-demo/);
  assert.match(recommendationHook, /getTimeLabel\(now\.getHours\(\),\s*uiLang\)/);
  assert.match(recommendationHook, /buildReason\(recommended,\s*temperature,\s*now\.getHours\(\),\s*uiLang,\s*nearbyRestaurant\)/);
  assert.match(recommendationHook, /Unknown weather/);
  assert.match(recommendationHook, /Dinner/);
});

test("recent menu thumbnails ignore unsafe generated image URLs", async () => {
  const recentRecords = await readFile(`${ROOT}/src/lib/recent-menu-records.ts`, "utf8");

  assert.match(recentRecords, /function isSafeRecentThumbnail/);
  assert.match(recentRecords, /url\.startsWith\("\/generated-dishes\/"\)/);
  assert.match(recentRecords, /dashscope-result\.\*aliyuncs/);
  assert.match(recentRecords, /image\\.pollinations\\.ai/);
  assert.match(recentRecords, /isSafeRecentThumbnail\(url\)/);
});

test("location recommendation demo data is gated to local review only", async () => {
  const route = await readFile(`${ROOT}/src/app/api/v1/recommendations/location/route.ts`, "utf8");

  assert.match(route, /process\.env\.NODE_ENV !== "production"/);
  assert.match(route, /searchParams\.get\("demo"\) === "1"/);
  assert.match(route, /providerConfigured:\s*true,\s*demo:\s*true/);
  assert.match(route, /chooseLocationProvider\(country\)/);
});

test("generated menu images use stable storage ids even for temporary dishes", async () => {
  await loadTsModule(`${ROOT}/src/lib/dish-name-normalization.ts`);
  const { storageIdForGeneratedDishImage } = await loadTsModule(
    `${ROOT}/src/lib/dish-image-persistence.ts`,
  );

  assert.equal(storageIdForGeneratedDishImage({ id: "db-dish-1" }), "db-dish-1");
  assert.equal(
    storageIdForGeneratedDishImage({ id: "temp-123", name_original: "LA MARINARA 11,50€" }),
    "generated-marinara",
  );
  assert.equal(
    storageIdForGeneratedDishImage({ id: "temp-789", name_original: "03 LA MARINARA 11,50€" }),
    "generated-marinara",
  );
  assert.equal(
    storageIdForGeneratedDishImage({ id: "temp-456", name_original: "Marinara Pizza" }),
    "generated-marinara",
  );
  assert.equal(
    storageIdForGeneratedDishImage({ name_original: "Crème brûlée" }),
    "generated-creme-brulee",
  );
  const chineseOnlyA = storageIdForGeneratedDishImage({ name_original: "豆酱焗斗仓" });
  const chineseOnlyB = storageIdForGeneratedDishImage({ name_original: "陈年花雕焗膏蟹" });
  assert.match(chineseOnlyA, /^generated-dish-[a-z0-9]+$/);
  assert.match(chineseOnlyB, /^generated-dish-[a-z0-9]+$/);
  assert.notEqual(chineseOnlyA, "generated-dish");
  assert.notEqual(chineseOnlyB, "generated-dish");
  assert.notEqual(chineseOnlyA, chineseOnlyB);
});

test("next image config allows DashScope result hosts", async () => {
  const config = await readFile(`${ROOT}/next.config.ts`, "utf8");
  assert.match(config, /\*\*\.aliyuncs\.com/);
});

test("missing dish images are treated as pending instead of real food placeholders", async () => {
  await loadTsModule(`${ROOT}/src/lib/dish-image-match.ts`);
  const { isDishImagePending } = await loadTsModule(
    `${ROOT}/src/lib/dish-presentation.ts`,
  );

  assert.equal(
    isDishImagePending({
      id: "temp-1",
      name_original: "Imaginary Dessert Cloud",
      name_translated: { zh: "云朵甜点" },
      description: { zh: "一道还没有生成图片的甜点" },
      ingredients: [],
      allergens: [],
      taste_profile: [],
      category: "dessert",
      image_source: "ai",
    }),
    true,
  );
  assert.equal(
    isDishImagePending({
      id: "local-1",
      name_original: "LA MARINARA",
      name_translated: { zh: "玛丽娜披萨" },
      description: { zh: "番茄披萨" },
      ingredients: [],
      allergens: [],
      taste_profile: [],
      category: "main",
      image_source: "mixed",
    }),
    false,
  );
  assert.equal(
    isDishImagePending({
      id: "cached-1",
      name_original: "Rare Soup",
      name_translated: { zh: "少见汤品" },
      description: { zh: "已有 AI 图片" },
      ingredients: [],
      allergens: [],
      taste_profile: [],
      category: "soup",
      image_source: "ai",
      ai_image_url: "https://gbkallzbksmaahzvxezq.supabase.co/storage/v1/object/public/dishes/generated-rare-soup.png",
    }),
    false,
  );
  assert.equal(
    isDishImagePending({
      id: "dirty-1",
      name_original: "Rare Soup",
      name_translated: { zh: "少见汤品" },
      description: { zh: "误存的占位图" },
      ingredients: [],
      allergens: [],
      taste_profile: [],
      category: "soup",
      image_source: "ai",
      ai_image_url: "https://images.unsplash.com/photo-1504674900247-0877df9cc836",
    }),
    true,
  );
  assert.equal(
    isDishImagePending({
      id: "expired-1",
      name_original: "Uncached Temporary Dish",
      name_translated: { zh: "未缓存临时菜" },
      description: { zh: "过期的临时生图地址" },
      ingredients: [],
      allergens: [],
      taste_profile: [],
      category: "main",
      image_source: "ai",
      ai_image_url: "https://dashscope-result-wlcb-acdr-1.oss-cn-wulanchabu-acdr-1.aliyuncs.com/temporary.png",
    }),
    true,
  );
});

test("dish image pending UI falls back instead of showing a permanent percent", async () => {
  const component = await readFile(`${ROOT}/src/components/shared/DishImageWithLoading.tsx`, "utf8");

  assert.match(component, /IMAGE_PENDING_STALE_MS/);
  assert.match(component, /hasWaitedLong/);
  assert.match(component, /图片生成较慢，先用示意图/);
  assert.match(component, /clearTimeout/);
});

test("dish image matching avoids generic drink and repeated platter mismatches", async () => {
  await loadTsModule(`${ROOT}/src/lib/dish-image-match.ts`);
  const { getDishImageUrl, isDishImagePending } = await loadTsModule(
    `${ROOT}/src/lib/dish-presentation.ts`,
  );

  const cheeseBoard = {
    id: "cheese-board",
    name_original: "PLANCHE DE FROMAGES ITALIENS",
    name_translated: { zh: "意大利奶酪拼盘" },
    description: { zh: "精选意大利奶酪组合，质地柔软，风味浓郁，适合佐酒。" },
    ingredients: ["奶酪"],
    allergens: ["dairy"],
    taste_profile: [],
    category: "appetizer",
    image_source: "ai",
  };

  assert.equal(isDishImagePending(cheeseBoard), true);
  assert.doesNotMatch(getDishImageUrl(cheeseBoard), /wine|792e7990302f|1510812431401/);

  const mortadella = {
    id: "mortadella",
    name_original: "MORTADELLE DE BOLOGNE AUX PISTACHES",
    name_translated: { zh: "开心果博洛尼亚香肠" },
    description: { zh: "意大利风味香肠配开心果，口感丰富，咸香微甜。" },
    ingredients: ["香肠", "开心果"],
    allergens: ["tree_nut"],
    taste_profile: [],
    category: "appetizer",
    image_source: "ai",
  };
  const charcuterie = {
    ...mortadella,
    id: "charcuterie-board",
    name_original: "ASSORTIMENT DE CHARCUTERIE",
    name_translated: { zh: "冷切拼盘" },
  };

  assert.match(getDishImageUrl(charcuterie), /charcuterie-francaise|1529692236671/);
  assert.equal(isDishImagePending(mortadella), true);
});

test("dish image loading animation chooses category-specific food characters", async () => {
  const component = await readFile(`${ROOT}/src/components/shared/DishImageWithLoading.tsx`, "utf8");
  assert.match(component, /function selectLoadingCharacter/);
  assert.match(component, /pizza|披萨/);
  assert.match(component, /seafood|fish|海鲜|鱼/);
  assert.match(component, /steak|beef|meat|牛排|牛肉/);
  assert.match(component, /salad|沙拉|vegetable|蔬菜/);
  assert.match(component, /egg|breakfast|benedict|早餐|鸡蛋/);
  assert.match(component, /dessert|cake|甜点|蛋糕/);
  assert.match(component, /soup|stew|汤|羹/);
  assert.match(component, /drink|beverage|coffee|tea|饮品|咖啡|茶/);
  assert.match(component, /onError/);
  assert.match(component, /dish-image-loading--card/);
  assert.doesNotMatch(component, /skeleton-shimmer/);
});

test("AI image generation prompt uses category-specific framing for drinks, soups, and seafood", async () => {
  const { buildDishImagePrompt, classifyDishImageKind } = await loadTsModule(
    `${ROOT}/src/lib/ai/image-gen.ts`,
  );

  const drinkPrompt = buildDishImagePrompt({
    name_original: "Cappuccino",
    name_translated: { zh: "卡布奇诺" },
    description: { zh: "热咖啡饮品" },
    ingredients: ["espresso", "milk foam"],
    category: "drink",
  });
  assert.match(drinkPrompt, /single beverage/i);
  assert.match(drinkPrompt, /cup|glass/i);
  assert.match(drinkPrompt, /distinct beverage texture|foam|ice|garnish/i);
  assert.doesNotMatch(drinkPrompt, /white ceramic plate/i);

  const tiramisuWithCoffee = {
    name_original: "TIRAMISU MAISON",
    name_translated: { zh: "自制提拉米苏" },
    description: { zh: "咖啡酒浸手指饼配马斯卡彭奶油，经典甜点。" },
    ingredients: ["coffee", "mascarpone", "ladyfingers"],
    category: "dessert",
  };
  const tiramisuPrompt = buildDishImagePrompt(tiramisuWithCoffee);
  assert.equal(classifyDishImageKind(tiramisuWithCoffee), "dessert");
  assert.match(tiramisuPrompt, /dessert photography|dessert plate|cream texture/i);
  assert.doesNotMatch(tiramisuPrompt, /single beverage|appropriate cup|distinct beverage texture/i);

  const soupPrompt = buildDishImagePrompt({
    name_original: "Miso Soup",
    name_translated: { zh: "味噌汤" },
    description: { zh: "热汤" },
    ingredients: ["miso", "tofu", "seaweed"],
    category: "soup",
  });
  assert.match(soupPrompt, /bowl/i);
  assert.match(soupPrompt, /broth|soup/i);
  assert.match(soupPrompt, /visible individual ingredients|surface detail/i);
  assert.doesNotMatch(soupPrompt, /white ceramic plate/i);

  const seafoodDish = {
    name_original: "陈年花雕焗膏蟹",
    name_translated: { zh: "陈年花雕焗膏蟹" },
    description: { zh: "膏蟹以陈年花雕酒焗制，蟹黄饱满" },
    ingredients: ["膏蟹", "花雕酒", "姜葱"],
  };
  const seafoodPrompt = buildDishImagePrompt(seafoodDish);
  assert.equal(classifyDishImageKind(seafoodDish), "seafood");
  assert.match(seafoodPrompt, /seafood|crab|shellfish|fish/i);
  assert.match(seafoodPrompt, /shell|claw|roe|fillet|shrimp|crab/i);
  assert.doesNotMatch(seafoodPrompt, /cup|mug|beverage/i);

  const wineCookedConch = {
    name_original: "紫苏辣酒煮花螺",
    name_translated: { zh: "紫苏辣酒煮花螺" },
    description: { zh: "花螺以紫苏、辣椒和米酒热煮，鲜辣带酒香。" },
    ingredients: ["花螺", "紫苏", "辣椒", "米酒"],
  };
  const conchPrompt = buildDishImagePrompt(wineCookedConch);
  assert.equal(classifyDishImageKind(wineCookedConch), "seafood");
  assert.match(conchPrompt, /seafood|shellfish|conch|whelk|sea snail/i);
  assert.doesNotMatch(conchPrompt, /single beverage|appropriate cup|wine glass|clear tumbler|distinct beverage texture/i);

  const chocolatePizza = {
    name_original: "LA PIZZA « CIOCCOLATO »",
    name_translated: { zh: "巧克力披萨" },
    description: { zh: "甜味披萨，搭配有机榛子奶油、自制焦糖和切碎榛子。" },
    ingredients: ["pizza dough", "chocolate", "hazelnut"],
    category: "dessert",
  };
  const chocolatePizzaPrompt = buildDishImagePrompt(chocolatePizza);
  assert.equal(classifyDishImageKind(chocolatePizza), "pizza");
  assert.match(chocolatePizzaPrompt, /single pizza|visible crust|toppings/i);
  assert.doesNotMatch(chocolatePizzaPrompt, /single beverage|appropriate cup|dessert photography/i);

  const pommeauGlace = {
    name_original: "POMMEAU GLACÉ",
    name_translated: { zh: "苹果冰沙配卡尔瓦多斯" },
    description: { zh: "苹果冰沙加入卡尔瓦多斯苹果酒，清爽微醺。" },
    ingredients: ["Pommeau", "Calvados", "apple"],
    category: "dessert",
  };
  const pommeauPrompt = buildDishImagePrompt(pommeauGlace);
  assert.equal(classifyDishImageKind(pommeauGlace), "drink");
  assert.match(pommeauPrompt, /single beverage|cup|glass|ice/i);
  assert.doesNotMatch(pommeauPrompt, /single pizza|white ceramic plate/i);
});

test("dish insight fallback recommendations are specific to each dish", async () => {
  await loadTsModule(`${ROOT}/src/lib/dish-image-match.ts`);
  const { getDishInsight, isVegetarianDish } = await loadTsModule(
    `${ROOT}/src/lib/dish-presentation.ts`,
  );

  const dishes = [
    {
      name_original: "03 豆酱焗斗仑",
      name_translated: { zh: "豆酱焗斗仑" },
      description: { zh: "用豆酱调味的贝类焗烤，香气扑鼻，鲜甜多汁，外壳酥脆内里嫩滑。" },
      ingredients: ["斗仑", "豆酱", "姜葱"],
      category: "seafood",
    },
    {
      name_original: "04 椒盐油膳",
      name_translated: { zh: "椒盐油膳" },
      description: { zh: "油膳炸至金黄，撒上椒盐，外酥里嫩，咸香微辣，适合下酒。" },
      ingredients: ["油膳", "椒盐"],
      category: "seafood",
    },
    {
      name_original: "05 陈年花雕焗膏蟹",
      name_translated: { zh: "陈年花雕焗膏蟹" },
      description: { zh: "选用膏蟹以陈年花雕酒焗制，蟹黄饱满，酒香浓郁，入口即化。" },
      ingredients: ["膏蟹", "陈年花雕酒"],
      category: "seafood",
    },
    {
      name_original: "06 橄榄油炒杂菜",
      name_translated: { zh: "橄榄油炒杂菜" },
      description: { zh: "多种时蔬以橄榄油快炒，保留营养与清甜，口感爽脆，健康美味。" },
      ingredients: ["橄榄油", "时蔬"],
      category: "vegetable",
    },
    {
      name_original: "07 樱花虾拌马家沟有机芹菜",
      name_translated: { zh: "樱花虾拌马家沟有机芹菜" },
      description: { zh: "樱花虾与有机芹菜凉拌，清香爽口，富含膳食纤维，低脂健康。" },
      ingredients: ["樱花虾", "马家沟芹菜"],
      category: "salad",
    },
    {
      name_original: "08 紫苏辣酒煮花螺",
      name_translated: { zh: "紫苏辣酒煮花螺" },
      description: { zh: "花螺用紫苏、辣椒和米酒热煮，螺肉弹嫩，鲜辣带酒香。" },
      ingredients: ["花螺", "紫苏", "辣椒", "米酒"],
      category: "main",
    },
  ];

  const recommendations = dishes.map((dish) => getDishInsight(dish).recommendation);
  const staleDrinkSummary = getDishInsight({
    name_original: "05 陈年花雕焗膏蟹",
    name_translated: { zh: "陈年花雕焗膏蟹" },
    description: { zh: "选用膏蟹以陈年花雕酒焗制，蟹黄饱满，酒香浓郁，入口即化，适合搭配热饮或冷饮。" },
    ingredients: ["膏蟹", "陈年花雕酒"],
    category: "seafood",
    image_source: "ai",
  }).summary;
  const pizzaRecommendation = getDishInsight({
    name_original: "LA DIAVOLA 16,00€",
    name_translated: { zh: "恶魔披萨" },
    description: { zh: "有机番茄酱、Fior di latte 马苏里拉奶酪和辣味萨拉米。" },
    ingredients: ["番茄酱", "Fior di latte", "萨拉米"],
    category: "pizza",
    image_source: "ai",
  }).recommendation;
  const chocolatePizzaRecommendation = getDishInsight({
    name_original: "LA PIZZA « CIOCCOLATO » 12,00€",
    name_translated: { zh: "巧克力披萨" },
    description: { zh: "甜味披萨，搭配有机榛子奶油、自制焦糖和切碎榛子。" },
    ingredients: ["披萨面饼", "巧克力", "榛子"],
    category: "dessert",
    image_source: "ai",
  }).recommendation;
  const pommeauRecommendation = getDishInsight({
    name_original: "POMMEAU GLACÉ 12,00€",
    name_translated: { zh: "苹果冰沙配卡尔瓦多斯" },
    description: { zh: "苹果冰沙加入卡尔瓦多斯苹果酒，清爽微醺。" },
    ingredients: ["Pommeau", "Calvados", "苹果"],
    category: "dessert",
    image_source: "ai",
  }).recommendation;
  const tiramisuRecommendation = getDishInsight({
    name_original: "TIRAMISU MAISON",
    name_translated: { zh: "自制提拉米苏" },
    description: { zh: "咖啡酒浸手指饼配马斯卡彭奶油，经典甜点。" },
    ingredients: ["咖啡", "马斯卡彭", "手指饼"],
    category: "dessert",
    image_source: "ai",
  }).recommendation;
  const diavolaPizza = {
    name_original: "LA DIAVOLA 16,00€",
    name_translated: { zh: "恶魔披萨" },
    description: { zh: "有机番茄酱、Fior di latte 马苏里拉奶酪和辣味萨拉米。" },
    ingredients: ["番茄酱", "Fior di latte", "萨拉米"],
    taste_profile: ["vegetarian"],
    category: "main",
    image_source: "ai",
  };
  const tunaPizza = {
    name_original: "LA THON ET OIGNONS 19,50€",
    name_translated: { zh: "金枪鱼洋葱披萨" },
    description: { zh: "含金枪鱼腩、橄榄和红洋葱。" },
    ingredients: ["金枪鱼", "橄榄", "洋葱"],
    category: "main",
    image_source: "ai",
  };

  assert.equal(new Set(recommendations).size, dishes.length);
  assert.match(recommendations[0], /豆酱|酱香|斗仑/);
  assert.match(recommendations[1], /椒盐|趁热|下酒/);
  assert.match(recommendations[2], /花雕|蟹黄|膏蟹/);
  assert.match(recommendations[3], /橄榄油|蔬菜|清爽|油腻/);
  assert.match(recommendations[4], /樱花虾|芹菜|脆爽|清口/);
  assert.match(recommendations[5], /花螺|鲜度|火候|海鲜|紫苏|酒香/);
  assert.doesNotMatch(recommendations[5], /饮品|点一杯|补一杯|冷饮|热饮|餐后慢慢喝/);
  assert.match(staleDrinkSummary, /膏蟹|花雕|酒香/);
  assert.doesNotMatch(staleDrinkSummary, /饮品|冷饮|热饮/);
  assert.match(pizzaRecommendation, /恶魔披萨|主食|披萨|口味|风味|菜/);
  assert.doesNotMatch(pizzaRecommendation, /饮品|点一杯|补一杯|冷饮|热饮|单独喝|餐后慢慢喝/);
  assert.match(chocolatePizzaRecommendation, /巧克力披萨|披萨|分享|主食|甜味/);
  assert.doesNotMatch(chocolatePizzaRecommendation, /饮品|点一杯|补一杯|冷饮|热饮|单独喝|餐后慢慢喝/);
  assert.match(pommeauRecommendation, /苹果冰沙配卡尔瓦多斯|饮品|佐餐|餐后|一杯|慢慢喝/);
  assert.match(tiramisuRecommendation, /自制提拉米苏|甜点|餐后|甜度|分享/);
  assert.doesNotMatch(tiramisuRecommendation, /饮品|点一杯|补一杯|冷饮|热饮|单独喝|餐后慢慢喝/);
  assert.equal(isVegetarianDish(diavolaPizza), false);
  assert.equal(isVegetarianDish(tunaPizza), false);
  assert.doesNotMatch(recommendations.join("\n"), /如果你想点一杯佐餐或餐后的饮品/);
  assert.doesNotMatch(recommendations.join("\n"), /如果你想补一杯饮品|冷饮或热饮/);
  assert.doesNotMatch(recommendations.join("\n"), /如果你还有胃口，强烈推荐用这道甜品/);
});

test("AI generated dish images are cached with deterministic keys before generating again", async () => {
  const route = await readFile(`${ROOT}/src/app/api/v1/translate/menu/route.ts`, "utf8");
  const storage = await readFile(`${ROOT}/src/lib/storage/supabase-storage.ts`, "utf8");
  const imageGen = await readFile(`${ROOT}/src/lib/ai/image-gen.ts`, "utf8");
  const appPage = await readFile(`${ROOT}/src/app/page.tsx`, "utf8");
  assert.match(route, /getCachedDishImageUrl/);
  assert.match(route, /getSupabaseAdminClient/);
  assert.match(route, /storageIdForGeneratedDishImage/);
  assert.match(route, /findExistingDishImages/);
  assert.match(route, /existingImagesByIndex/);
  assert.doesNotMatch(route, /await findExistingDishImage\(dish\.name_original\)/);
  assert.match(route, /progress:\s*\{\s*current:\s*images\.length,\s*total:\s*images\.length\s*\}/);
  assert.match(route, /localMatch\?\.card \|\| cachedGeneratedImageUrl \|\| existingImageUrl/);
  assert.match(storage, /public", "generated-dishes/);
  assert.match(storage, /existsSync\(localDishImagePath\(dishId\)\)/);
  assert.match(storage, /return localUrl/);
  const uploadDishImageBody = storage.match(/export async function uploadDishImage[\s\S]*?\n}\n\nexport async function getCachedDishImageUrl/)?.[0] || "";
  assert.match(uploadDishImageBody, /const client = getSupabaseAdminClient\(\)/);
  assert.doesNotMatch(uploadDishImageBody, /getSupabaseAdminClient\(\) \|\| getSupabaseClient\(\)/);
  assert.match(route, /metadata\.image_generation_status = status/);
  assert.match(route, /updateImageGenerationTask\("processing"\)/);
  assert.match(route, /finalStatus = failures\.length === 0\s*\n\s*\? "done"/);
  assert.match(route, /"failed" : "partial"/);
  assert.match(route, /image_generation_progress/);
  assert.match(route, /image_generation_failed/);
  assert.match(route, /generationOrder/);
  assert.doesNotMatch(route, /if \(!publicUrl\) return/);
  assert.doesNotMatch(route, /publicUrl \|\| tempUrl/);
  assert.doesNotMatch(route, /generateImagesForDishes\([\s\S]*,\s*1,\s*\)/);
  assert.doesNotMatch(route, /dishesForGeneration[\s\S]*?\.slice\(/);
  assert.match(imageGen, /await onImageReady/);
  assert.match(imageGen, /onImageFailed/);
  assert.match(imageGen, /retries = IMAGE_GENERATION_RETRIES/);
  assert.match(imageGen, /idx >= queue\.length && running === 0\) resolve/);
  assert.doesNotMatch(imageGen, /queue\.length >= idx && running === 0\) resolve/);
  assert.match(appPage, /hasPendingImages/);
  assert.match(appPage, /MAX_IDLE_POLLS/);
  assert.doesNotMatch(appPage, /const MAX_POLLS = 20/);
});

test("AI image generation queue drains every dish after the first concurrent batch", async () => {
  const previousProvider = process.env.IMAGE_PROVIDER;
  process.env.IMAGE_PROVIDER = "pollinations";
  try {
    const { generateImagesForDishes } = await loadTsModule(`${ROOT}/src/lib/ai/image-gen.ts`);
    const completed = [];
    await generateImagesForDishes(
      Array.from({ length: 5 }, (_, index) => ({
        id: `dish-${index + 1}`,
        name_original: `Dish ${index + 1}`,
        name_translated: { zh: `菜品 ${index + 1}` },
        description: "测试菜品",
      })),
      async (index, url) => {
        completed.push({ index, url });
      },
      2,
    );

    assert.deepEqual(completed.map((item) => item.index), [0, 1, 2, 3, 4]);
    assert.equal(completed.every((item) => typeof item.url === "string" && item.url.length > 0), true);
  } finally {
    if (previousProvider === undefined) delete process.env.IMAGE_PROVIDER;
    else process.env.IMAGE_PROVIDER = previousProvider;
  }
});

test("stale local generated image URLs from the database are not reused as valid cached images", async () => {
  await loadTsModule(`${ROOT}/src/lib/dish-image-match.ts`);
  const { getDishImageUrl, isDishImagePending } = await loadTsModule(
    `${ROOT}/src/lib/dish-presentation.ts`,
  );
  const { isReusableExistingImageUrl } = await loadTsModule(
    `${ROOT}/src/lib/dish-image-url.ts`,
  );

  assert.equal(isReusableExistingImageUrl("/generated-dishes/generated-old-local-only.png"), false);
  assert.equal(
    getDishImageUrl({
      id: "temp-current",
      name_original: "TRUFFLE PECORINO FRIES",
      name_translated: { zh: "松露佩科里诺薯条" },
      description: { zh: "已生成图片的当前结果" },
      ai_image_url: "/generated-dishes/generated-truffle-pecorino-fries.png",
      image_status: "done",
      image_source: "ai",
      ingredients: [],
      allergens: [],
      taste_profile: [],
    }),
    "/generated-dishes/generated-truffle-pecorino-fries.png",
  );
  assert.equal(
    isDishImagePending({
      id: "temp-current",
      name_original: "TRUFFLE PECORINO FRIES",
      name_translated: { zh: "松露佩科里诺薯条" },
      description: { zh: "已生成图片的当前结果" },
      ai_image_url: "/generated-dishes/generated-truffle-pecorino-fries.png",
      image_status: "done",
      image_source: "ai",
      ingredients: [],
      allergens: [],
      taste_profile: [],
    }),
    false,
  );
  assert.equal(isReusableExistingImageUrl("/dishes/pizza-marinara.png"), true);
  assert.equal(
    isReusableExistingImageUrl("https://gbkallzbksmaahzvxezq.supabase.co/storage/v1/object/public/dishes/generated-dish-xoismf.png"),
    true,
  );
  assert.equal(
    isReusableExistingImageUrl("https://dashscope-result-wlcb-acdr-1.oss-cn-wulanchabu-acdr-1.aliyuncs.com/temporary.png"),
    false,
  );
});

test("task responses strip missing local generated dish image URLs before reaching the UI", async () => {
  const { sanitizeTranslationResultImages } = await loadTsModule(
    `${ROOT}/src/lib/server/sanitize-translation-result.ts`,
  );

  const sanitized = sanitizeTranslationResultImages({
    task_id: "task-with-stale-images",
    metadata: {},
    pages: [
      {
        page_index: 0,
        dishes: [
          {
            id: "missing",
            name_original: "Missing cached image",
            ai_image_url: "/generated-dishes/generated-file-that-does-not-exist.png",
            image_status: "done",
            image_source: "ai",
          },
          {
            id: "existing",
            name_original: "Cheese bombs",
            ai_image_url: "/generated-dishes/generated-cheese-bombs.png",
            image_status: "done",
            image_source: "ai",
          },
        ],
      },
    ],
  });

  const dishes = sanitized.pages[0].dishes;
  assert.equal(dishes[0].ai_image_url, undefined);
  assert.equal(dishes[0].image_status, "failed");
  assert.equal(dishes[1].ai_image_url, "/generated-dishes/generated-cheese-bombs.png");
  assert.equal(dishes[1].image_status, "done");
  assert.equal(sanitized.metadata.image_sanitized_count, 1);
});

test("translated menus can be shared through a public read-only menu page", async () => {
  const appPage = await readFile(`${ROOT}/src/app/page.tsx`, "utf8");
  const resultsPage = await readFile(`${ROOT}/src/components/results/ResultsPage.tsx`, "utf8");
  const detailPage = await readFile(`${ROOT}/src/components/dish/DishDetailPage.tsx`, "utf8");
  const sharePage = await readFile(`${ROOT}/src/app/share/[id]/page.tsx`, "utf8");
  const sharedMenu = await readFile(`${ROOT}/src/components/share/SharedMenuPage.tsx`, "utf8");

  assert.match(appPage, /handleShareMenu/);
  assert.match(resultsPage, /onShare/);
  assert.match(detailPage, /onShare/);
  assert.match(sharePage, /getTask/);
  assert.match(sharedMenu, /onDishDetail/);
  assert.match(sharedMenu, /分享菜单/);
});

test("app link icons use the warm DishLens illustration style", async () => {
  const appIcon = await readFile(`${ROOT}/src/app/icon.svg`, "utf8");
  const icon192 = await readFile(`${ROOT}/public/icons/icon-192.svg`, "utf8");
  const layout = await readFile(`${ROOT}/src/app/layout.tsx`, "utf8");
  const manifest = JSON.parse(await readFile(`${ROOT}/public/manifest.json`, "utf8"));
  const favicon = await readFile(`${ROOT}/src/app/favicon.ico`);
  const rootAppleIcon = await readFile(`${ROOT}/public/apple-touch-icon.png`);
  const sharePreviewIcon = await readFile(`${ROOT}/public/icons/share-preview-20260527.png`);

  for (const icon of [appIcon, icon192]) {
    assert.match(icon, /#FFF5E9/);
    assert.match(icon, /#4CAF50/);
    assert.match(icon, /#D4A574/);
    assert.match(icon, /ellipse/);
    assert.match(icon, /stroke-linecap="round"/);
    assert.match(icon, /M39 74 q0-22 27-22/);
    assert.match(icon, /M104 61 q0-20 25-20/);
    assert.match(icon, /Q96 136 138 112/);
    assert.doesNotMatch(icon, /<text|DL|#000|black|triangle/i);
    assert.doesNotMatch(icon, /circle cx="114" cy="64" r="28"|M134 84 L154 104|M55 30 L77 22/);
  }

  assert.match(layout, /\/icon\.svg/);
  assert.match(layout, /\/favicon\.ico/);
  assert.match(layout, /\/apple-touch-icon\.png/);
  assert.match(layout, /apple-touch-icon\.png/);
  assert.equal(manifest.icons.some((icon) => icon.src === "/icons/icon-192.png" && icon.type === "image/png"), true);
  assert.equal(manifest.icons.some((icon) => icon.src === "/icons/icon-512.png" && icon.type === "image/png"), true);
  assert.equal(favicon.subarray(0, 4).toString("hex"), "00000100");
  assert.equal(rootAppleIcon.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(sharePreviewIcon.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
});

test("global menu sharing builds platform links without private WeChat deep links", async () => {
  const { buildShareHref, buildShareMenuMeta, SHARE_TARGETS } = await loadTsModule(
    `${ROOT}/src/lib/share-menu.ts`,
  );

  const result = {
    task_id: "task-123",
    status: "done",
    pages: [
      {
        page_index: 0,
        page_label: "Main",
        image_thumbnail: "",
        dishes: [
          {
            id: "dish-1",
            name_original: "Soupe a l'oignon",
            name_translated: { zh: "法式洋葱汤" },
            description: {},
            ingredients: [],
            allergens: [],
            taste_profile: [],
            image_source: "mixed",
          },
          {
            id: "dish-2",
            name_original: "Burrata",
            name_translated: { en: "Burrata" },
            description: {},
            ingredients: [],
            allergens: [],
            taste_profile: [],
            image_source: "mixed",
          },
        ],
      },
    ],
    metadata: {
      source_language: "fr",
      total_dishes: 2,
      cached: false,
    },
  };

  const meta = buildShareMenuMeta(result, "https://dishlens.wukongmkt.com", "task-123");
  assert.equal(meta.url, "https://dishlens.wukongmkt.com/share/task-123");
  assert.equal(meta.dishCount, 2);
  assert.equal(meta.sourceTitle, "法语菜单");
  assert.deepEqual(meta.previewDishes, ["法式洋葱汤", "Burrata"]);
  assert.match(meta.title, /2 道菜/);
  assert.match(meta.text, /法式洋葱汤、Burrata/);

  assert.deepEqual(
    SHARE_TARGETS.map((target) => target.id),
    ["native", "copy", "wechat", "whatsapp", "telegram", "line", "facebook", "x"],
  );
  assert.match(buildShareHref("whatsapp", meta), /^https:\/\/wa\.me\/\?text=/);
  assert.match(buildShareHref("telegram", meta), /^https:\/\/t\.me\/share\/url\?/);
  assert.match(buildShareHref("line", meta), /^https:\/\/social-plugins\.line\.me\/lineit\/share\?/);
  assert.match(buildShareHref("facebook", meta), /^https:\/\/www\.facebook\.com\/sharer\/sharer\.php\?/);
  assert.match(buildShareHref("x", meta), /^https:\/\/twitter\.com\/intent\/tweet\?/);
  assert.match(decodeURIComponent(buildShareHref("whatsapp", meta) || ""), /https:\/\/dishlens\.wukongmkt\.com\/share\/task-123/);
  assert.match(decodeURIComponent(buildShareHref("telegram", meta) || ""), /https:\/\/dishlens\.wukongmkt\.com\/share\/task-123/);
  assert.match(decodeURIComponent(buildShareHref("line", meta) || ""), /https:\/\/dishlens\.wukongmkt\.com\/share\/task-123/);
  assert.match(decodeURIComponent(buildShareHref("facebook", meta) || ""), /https:\/\/dishlens\.wukongmkt\.com\/share\/task-123/);
  assert.match(decodeURIComponent(buildShareHref("x", meta) || ""), /https:\/\/dishlens\.wukongmkt\.com\/share\/task-123/);
  assert.equal(SHARE_TARGETS.some((target) => target.label === "短信" || target.label === "邮件"), false);
  assert.equal(buildShareHref("wechat", meta), null);
  assert.equal(buildShareHref("native", meta), null);
  assert.equal(buildShareHref("copy", meta), null);
});

test("share metadata uses corrected source language for Italian pizzeria menus", async () => {
  const { buildShareMenuMeta } = await loadTsModule(`${ROOT}/src/lib/share-menu.ts`);

  const meta = buildShareMenuMeta({
    task_id: "it-pizzeria",
    status: "done",
    pages: [
      {
        page_index: 0,
        page_label: "Menu",
        image_thumbnail: "",
        dishes: [
          {
            id: "diavola",
            name_original: "LA DIAVOLA 16,00€",
            name_translated: { zh: "恶魔披萨" },
            description: { zh: "辣味萨拉米披萨。" },
            ingredients: ["Fior di latte", "salame piccante"],
            allergens: [],
            taste_profile: [],
            image_source: "mixed",
          },
          {
            id: "espresso",
            name_original: "ESPRESSO 2,50€",
            name_translated: { zh: "浓缩咖啡" },
            description: {},
            ingredients: [],
            allergens: [],
            taste_profile: [],
            image_source: "mixed",
          },
        ],
      },
    ],
    metadata: {
      source_language: "fr",
      target_language: "zh",
      total_dishes: 2,
      cached: false,
      restaurant: { display_name: "Pecora Negra Pizzeria", restaurant_type: "Pizzeria", rating_estimate: 4.2 },
    },
  }, "https://dishlens.wukongmkt.com", "it-pizzeria");

  assert.equal(meta.sourceTitle, "意大利语菜单");
  assert.match(meta.text, /意大利语菜单/);
});

test("global share UI is wired through a reusable sheet and dynamic metadata", async () => {
  const appPage = await readFile(`${ROOT}/src/app/page.tsx`, "utf8");
  const sharedMenu = await readFile(`${ROOT}/src/components/share/SharedMenuPage.tsx`, "utf8");
  const sharePage = await readFile(`${ROOT}/src/app/share/[id]/page.tsx`, "utf8");
  const layout = await readFile(`${ROOT}/src/app/layout.tsx`, "utf8");
  const sheet = await readFile(`${ROOT}/src/components/share/ShareSheet.tsx`, "utf8");

  assert.match(appPage, /ShareSheet/);
  assert.match(appPage, /buildShareMenuMeta/);
  assert.match(sharedMenu, /ShareSheet/);
  assert.match(sharedMenu, /buildShareMenuMeta/);
  assert.match(sharePage, /generateMetadata/);
  assert.match(sharePage, /openGraph/);
  assert.match(layout, /metadataBase/);
  assert.match(sheet, /WhatsApp/);
  assert.match(sheet, /Telegram/);
  assert.match(sheet, /LINE/);
  assert.match(sheet, /Facebook/);
  assert.match(sheet, /X/);
  assert.match(sheet, /微信/);
  assert.match(sheet, /ShareIllustrationIcon/);
  assert.match(sheet, /navigator\.share/);
  assert.match(sheet, /clipboard\.writeText/);
  assert.doesNotMatch(sheet, /系统分享/);
  assert.doesNotMatch(sheet, /短信/);
  assert.doesNotMatch(sheet, /邮件/);
});

test("finalized share sheet uses the together-at-the-table illustration system", async () => {
  const { SHARE_TARGETS } = await loadTsModule(
    `${ROOT}/src/lib/share-menu.ts`,
  );
  const sheet = await readFile(`${ROOT}/src/components/share/ShareSheet.tsx`, "utf8");

  assert.equal(SHARE_TARGETS.find((target) => target.id === "native")?.description, "发到聊天里一起看菜");
  assert.equal(SHARE_TARGETS.find((target) => target.id === "copy")?.description, "适合粘到任何群聊");
  assert.match(sheet, /一起看菜/);
  assert.match(sheet, /朋友不用登录/);
  assert.match(sheet, /聊天里粘贴链接/);
  assert.match(sheet, /targetId === "wechat"/);
  assert.match(sheet, /targetId === "whatsapp"/);
  assert.match(sheet, /targetId === "telegram"/);
  assert.match(sheet, /targetId === "line"/);
  assert.match(sheet, /targetId === "facebook"/);
  assert.match(sheet, /targetId === "x"/);
  assert.doesNotMatch(sheet, /打开手机分享菜单|贴到任何聊天工具|系统分享|短信|邮件/);
  assert.doesNotMatch(sheet, /#49A4E8|#2677B8|#4D8CE8|#2B65B8|fill="#2D2D2D"|stroke="#111"/);
});

test("share sheet opens native share for WeChat, keeps URLs in share text, and uses stronger feedback", async () => {
  const sheet = await readFile(`${ROOT}/src/components/share/ShareSheet.tsx`, "utf8");

  assert.doesNotMatch(sheet, /WeixinJSBridge|sendAppMessage|shareTimeline|addToFavorites|isWeChatBrowser|shareToWeChat/);
  assert.doesNotMatch(sheet, /微信分享未完成，链接已复制/);
  assert.match(sheet, /text:\s*buildShareMessage\(shareMeta\)/);
  assert.match(sheet, /window\.location\.assign\(href\)/);
  assert.match(sheet, /role="status"/);
  assert.match(sheet, /aria-live="polite"/);
  assert.match(sheet, /已显示链接，请长按上方链接复制/);
  assert.match(sheet, /setSelectionRange/);
  assert.match(sheet, /targetId="menu"/);
  assert.match(sheet, /targetId === "menu"/);

  const nativeBranch = sheet.match(/if \(targetId === "native"\) \{[\s\S]*?return;\n    \}/)?.[0] || "";
  assert.match(nativeBranch, /shareNative/);

  const wechatBranch = sheet.match(/if \(targetId === "wechat"\) \{[\s\S]*?return;\n    \}/)?.[0] || "";
  assert.match(wechatBranch, /shareNative\("微信分享未打开，链接已复制"\)/);
  assert.doesNotMatch(wechatBranch, /copyLink\("链接已复制，打开微信粘贴给好友或群聊"\)/);
});

test("iOS native share previews use explicit image metadata and WeChat opens the native share path", async () => {
  const layout = await readFile(`${ROOT}/src/app/layout.tsx`, "utf8");
  const sharePage = await readFile(`${ROOT}/src/app/share/[id]/page.tsx`, "utf8");
  const sheet = await readFile(`${ROOT}/src/components/share/ShareSheet.tsx`, "utf8");

  assert.match(layout, /\/icons\/share-preview-20260527\.png/);
  assert.match(sharePage, /SHARE_PREVIEW_IMAGE/);
  assert.match(sharePage, /images:\s*\[\s*shareImage/);
  assert.match(sharePage, /twitter:[\s\S]*images:\s*\[shareImage\.url/);
  assert.match(sheet, /Promise\.race/);
  assert.match(sheet, /Clipboard write timed out/);

  const wechatBranch = sheet.match(/if \(targetId === "wechat"\) \{[\s\S]*?return;\n    \}/)?.[0] || "";
  assert.match(wechatBranch, /shareNative\("微信分享未打开，链接已复制"\)/);
  assert.doesNotMatch(wechatBranch, /shareToWeChat|WeixinJSBridge|sendAppMessage/);
});

test("dish image diagnostics script reports image source layers", async () => {
  const script = await readFile(`${ROOT}/scripts/diagnose-dish-images.mjs`, "utf8");
  assert.match(script, /local_knowledge/);
  assert.match(script, /generated_local/);
  assert.match(script, /supabase_db/);
  assert.match(script, /ai_pending/);
  assert.match(script, /matchDishKnowledgeImage/);
  assert.match(script, /storageIdForGeneratedDishImage/);
});

test("knowledge image downloader can materialize existing files without long network runs", async () => {
  const script = await readFile(`${ROOT}/scripts/download-knowledge-images.mjs`, "utf8");
  assert.match(script, /--existing-only/);
  assert.match(script, /DOWNLOAD_LIMIT/);
  assert.match(script, /fileExists/);
  assert.match(script, /continue/);
});

test("ordering state supports quantity changes and unknown menu prices", async () => {
  const {
    changeOrderQuantity,
    buildOrderItems,
    summarizeOrder,
  } = await loadTsModule(`${ROOT}/src/lib/order-state.ts`);

  const result = {
    task_id: "task-order",
    status: "done",
    pages: [{
      page_index: 0,
      page_label: "Menu",
      image_thumbnail: "",
      dishes: [
        {
          id: "escargots",
          name_original: "ESCARGOTS DE BOURGOGNE",
          name_translated: { zh: "勃艮第蜗牛" },
          description: {},
          ingredients: [],
          allergens: [],
          taste_profile: [],
          image_source: "ai",
          price_text: "14€",
        },
        {
          id: "cheese",
          name_original: "PLANCHE DE FROMAGES ITALIENS",
          name_translated: { zh: "意大利奶酪拼盘" },
          description: {},
          ingredients: [],
          allergens: [],
          taste_profile: [],
          image_source: "ai",
        },
      ],
    }],
    metadata: { source_language: "fr", target_language: "zh", total_dishes: 2, cached: false },
  };

  let quantities = {};
  quantities = changeOrderQuantity(quantities, result.pages[0].dishes[0], 1);
  quantities = changeOrderQuantity(quantities, result.pages[0].dishes[0], 1);
  quantities = changeOrderQuantity(quantities, result.pages[0].dishes[1], 1);
  quantities = changeOrderQuantity(quantities, result.pages[0].dishes[1], -1);

  assert.deepEqual(quantities, { escargots: 2 });

  const items = buildOrderItems(result, quantities);
  assert.equal(items.length, 1);
  assert.equal(items[0].quantity, 2);
  assert.equal(items[0].unitPrice?.amount, 14);

  const summary = summarizeOrder(items);
  assert.equal(summary.totalQuantity, 2);
  assert.equal(summary.knownTotal, 28);
  assert.equal(summary.hasUnknownPrices, false);

  const withUnknown = buildOrderItems(result, { escargots: 1, cheese: 1 });
  const unknownSummary = summarizeOrder(withUnknown);
  assert.equal(unknownSummary.totalQuantity, 2);
  assert.equal(unknownSummary.knownTotal, 14);
  assert.equal(unknownSummary.hasUnknownPrices, true);
});

test("ordered visits persist locally and dishes can be marked reviewed", async () => {
  const localStorage = await readFile(`${ROOT}/src/lib/local-storage.ts`, "utf8");
  const types = await readFile(`${ROOT}/src/types/index.ts`, "utf8");

  assert.match(types, /export interface OrderedVisit/);
  assert.match(types, /export interface OrderedDishItem/);
  assert.match(localStorage, /dishlens_ordered_visits/);
  assert.match(localStorage, /export function getOrderedVisits/);
  assert.match(localStorage, /export function addOrderedVisit/);
  assert.match(localStorage, /export function markOrderedDishReviewed/);
});

test("ordered visits reuse the result-page restaurant name and cuisine illustration", async () => {
  const { buildOrderedVisit } = await loadTsModule(`${ROOT}/src/lib/order-state.ts`);
  const { getRestaurantDisplayMeta } = await loadTsModule(`${ROOT}/src/lib/restaurant-display.ts`);
  const appPage = await readFile(`${ROOT}/src/app/page.tsx`, "utf8");
  const historyPage = await readFile(`${ROOT}/src/components/history/HistoryPage.tsx`, "utf8");
  const summaryCard = await readFile(`${ROOT}/src/components/results/SummaryInsightCard.tsx`, "utf8");
  const orderedPage = await readFile(`${ROOT}/src/components/order/OrderedPage.tsx`, "utf8");
  const orderedDetailPage = await readFile(`${ROOT}/src/components/order/OrderedDetailPage.tsx`, "utf8");

  const baseResult = {
    task_id: "ordered-restaurant",
    status: "done",
    pages: [],
    metadata: {
      source_language: "fr",
      target_language: "zh",
      total_dishes: 0,
      cached: false,
    },
  };
  const fallbackVisit = buildOrderedVisit(baseResult, [], [], "zh");
  assert.equal(fallbackVisit.restaurant_name, "巴黎小馆 Le Petit Bistro");
  assert.equal(fallbackVisit.city, "巴黎");
  assert.equal(fallbackVisit.country, "法国");

  const englishFallbackVisit = buildOrderedVisit(baseResult, [], [], "en");
  assert.equal(englishFallbackVisit.restaurant_name, "Le Petit Bistro");

  const namedVisit = buildOrderedVisit({
    ...baseResult,
    metadata: {
      ...baseResult.metadata,
      restaurant: { display_name: "Le Petit Bistro", restaurant_type: "餐厅", rating_estimate: 4.2 },
    },
  }, [], [], "zh");
  assert.equal(namedVisit.restaurant_name, "巴黎小馆 Le Petit Bistro");
  assert.equal(namedVisit.city, "巴黎");

  const pizzeriaZh = getRestaurantDisplayMeta(
    "it",
    "zh",
    { display_name: "Pecora Negra Pizzeria", restaurant_type: "Pizzeria", rating_estimate: 4.2 },
  );
  assert.equal(pizzeriaZh.display_name, "罗马小馆 Pecora Negra Pizzeria");

  const pizzeriaEn = getRestaurantDisplayMeta(
    "it",
    "en",
    { display_name: "Pecora Negra Pizzeria", restaurant_type: "Pizzeria", rating_estimate: 4.2 },
  );
  assert.equal(pizzeriaEn.display_name, "Pecora Negra Pizzeria");

  assert.match(appPage, /getRestaurantDisplayMeta/);
  assert.doesNotMatch(appPage, /\$\{sourceLanguageName\(result\.metadata\.source_language\)\}菜单/);
  assert.doesNotMatch(appPage, /翻译 #\$\{newResult\.task_id\.slice\(0, 6\)\}/);
  assert.match(historyPage, /getRestaurantDisplayMeta/);
  assert.match(historyPage, /isLegacyName/);
  assert.match(summaryCard, /getRestaurantDisplayMeta/);
  assert.doesNotMatch(summaryCard, /restaurant \|\|/);
  assert.match(orderedPage, /getRestaurantDisplayMeta/);
  assert.match(orderedPage, /CuisineIllustration/);
  assert.match(orderedPage, /isLegacyMenuName/);
  assert.match(orderedDetailPage, /getRestaurantDisplayMeta/);
  assert.match(orderedDetailPage, /isLegacyMenuName/);
  assert.doesNotMatch(orderedPage, /function FrenchIllustration/);
  assert.doesNotMatch(orderedPage, /function JapaneseIllustration/);
});

test("ordering UI is added as minimal increments to existing H5 screens", async () => {
  const appPage = await readFile(`${ROOT}/src/app/page.tsx`, "utf8");
  const homePage = await readFile(`${ROOT}/src/components/home/HomePage.tsx`, "utf8");
  const resultsPage = await readFile(`${ROOT}/src/components/results/ResultsPage.tsx`, "utf8");
  const dishDetailPage = await readFile(`${ROOT}/src/components/dish/DishDetailPage.tsx`, "utf8");

  assert.match(appPage, /orderConfirm/);
  assert.match(appPage, /orderedDetail/);
  assert.match(appPage, /getOrderedVisits as getStoredOrderedVisits/);
  assert.match(homePage, /navOrdered/);
  assert.match(homePage, /screen:\s*"ordered"/);
  assert.match(resultsPage, /OrderQuantityControl/);
  assert.doesNotMatch(resultsPage, /几道菜品/);
  assert.match(dishDetailPage, /OrderSummaryDock/);
  assert.match(dishDetailPage, /paddingBottom:\s*onOrderQuantityChange/);
  assert.doesNotMatch(dishDetailPage, /confidenceLabel/);
  assert.doesNotMatch(dishDetailPage, /AI 推荐参考/);
  const orderSummaryDock = await readFile(`${ROOT}/src/components/order/OrderSummaryDock.tsx`, "utf8");
  assert.match(orderSummaryDock, /background:\s*"rgba\(255,250,242,0\.96\)"/);
  assert.match(orderSummaryDock, /已选 · \$\{totalLabel\}/);
  assert.match(orderSummaryDock, /aria-label="当前菜品数量"/);
  assert.match(orderSummaryDock, /aria-label="查看点单"/);
  assert.match(orderSummaryDock, /import OrderQuantityControl/);
  assert.match(orderSummaryDock, /<OrderQuantityControl/);
  assert.match(orderSummaryDock, /expanded/);
  assert.doesNotMatch(orderSummaryDock, /hasCurrentDish \? "查看点单" : "选择这道菜"/);
  assert.doesNotMatch(orderSummaryDock, /hasCurrentDish \? `已选 · \$\{totalLabel\}` : "加入点单"/);
  assert.doesNotMatch(orderSummaryDock, /if \(hasAnyOrder\) \{/);
  assert.match(orderSummaryDock, /borderRadius:\s*999/);
  assert.match(orderSummaryDock, /width:\s*24/);
  assert.doesNotMatch(orderSummaryDock, /height:\s*44/);
  assert.doesNotMatch(orderSummaryDock, /background:\s*"var\(--primary\)"/);
  assert.doesNotMatch(orderSummaryDock, /选择这道菜后，可给店员核对/);
  assert.doesNotMatch(orderSummaryDock, /先选一份/);
  assert.doesNotMatch(orderSummaryDock, /这道菜/);
  assert.doesNotMatch(orderSummaryDock, /加入这道菜/);
});

test("primary mobile H5 actions keep thumb-friendly hit targets", async () => {
  const quantityControl = await readFile(`${ROOT}/src/components/order/OrderQuantityControl.tsx`, "utf8");
  const resultsPage = await readFile(`${ROOT}/src/components/results/ResultsPage.tsx`, "utf8");
  const detailPage = await readFile(`${ROOT}/src/components/dish/DishDetailPage.tsx`, "utf8");
  const summaryDock = await readFile(`${ROOT}/src/components/order/OrderSummaryDock.tsx`, "utf8");
  const homePage = await readFile(`${ROOT}/src/components/home/HomePage.tsx`, "utf8");
  const settingsPage = await readFile(`${ROOT}/src/components/settings/SettingsPage.tsx`, "utf8");
  const cameraPage = await readFile(`${ROOT}/src/components/camera/CameraPage.tsx`, "utf8");

  assert.match(quantityControl, /const addSize = compact \? 44 : 46/);
  assert.match(quantityControl, /minHeight: 44/);
  assert.doesNotMatch(quantityControl, /group-hover:inline-flex/);
  assert.match(resultsPage, /const orderControlOffset = onOrderQuantityChange \? 58 : 0/);
  assert.match(resultsPage, /minHeight: 44/);
  assert.match(detailPage, /minWidth: 44/);
  assert.match(detailPage, /minHeight: 44/);
  assert.match(summaryDock, /env\(safe-area-inset-bottom\)/);
  assert.match(homePage, /minHeight: 44/);
  assert.match(settingsPage, /width: 48/);
  assert.match(settingsPage, /height: 44/);
  assert.match(cameraPage, /minWidth: 68/);
});

test("results dish cards preserve the production information hierarchy when ordering is added", async () => {
  const resultsPage = await readFile(`${ROOT}/src/components/results/ResultsPage.tsx`, "utf8");

  assert.match(resultsPage, /<button[\s\S]*onClick=\{\(\) => onDishDetail\(dish\)\}/);
  assert.match(resultsPage, /const orderControlOffset = onOrderQuantityChange \? 58 : 0/);
  assert.match(resultsPage, /\{insight\.recommendation\}/);
  assert.doesNotMatch(resultsPage, /const pd = parseDishPrice\(dish\); return pd \? `\$\{pd\.amount\}\$\{pd\.currency\}` : "";/);
  assert.match(resultsPage, /getDishPriceDisplay\(dish\)/);
});

test("results dish cards use app-like readable food card typography", async () => {
  const resultsPage = await readFile(`${ROOT}/src/components/results/ResultsPage.tsx`, "utf8");
  const dishImage = await readFile(`${ROOT}/src/components/shared/DishImageWithLoading.tsx`, "utf8");

  assert.match(resultsPage, /borderRadius:\s*26/);
  assert.match(resultsPage, /fontSize:\s*18/);
  assert.match(resultsPage, /fontSize:\s*12,\s*color:\s*"var\(--ink-soft\)"/);
  assert.match(resultsPage, /fontSize:\s*12,\s*color:\s*"var\(--primary\)"/);
  assert.match(resultsPage, /fontSize:\s*"10px"/);
  assert.match(dishImage, /const width = compact \? 128 : "100%"/);
  assert.match(dishImage, /sizes=\{compact \? "128px"/);
});

test("dish prices are displayed beside translated names instead of only inside original names", async () => {
  const { getDishPriceDisplay, stripPriceFromOriginalName } = await loadTsModule(
    `${ROOT}/src/lib/dish-price-display.ts`,
  );
  const display = await readFile(`${ROOT}/src/lib/dish-price-display.ts`, "utf8");
  const resultsPage = await readFile(`${ROOT}/src/components/results/ResultsPage.tsx`, "utf8");
  const detailPage = await readFile(`${ROOT}/src/components/dish/DishDetailPage.tsx`, "utf8");

  assert.match(display, /export function getDishPriceDisplay/);
  assert.match(display, /export function stripPriceFromOriginalName/);
  assert.match(resultsPage, /getDishPriceDisplay/);
  assert.match(resultsPage, /stripPriceFromOriginalName\(dishText\.originalName\)/);
  assert.match(resultsPage, /dishPriceLabel/);
  assert.match(detailPage, /getDishPriceDisplay/);
  assert.match(detailPage, /stripPriceFromOriginalName\(dishText\.originalName\)/);
  assert.match(detailPage, /dishPriceLabel/);
  assert.equal(
    getDishPriceDisplay({
      id: "pizza-marinara",
      name_original: "LA MARINARA 11,50€",
      name_translated: { zh: "玛琳娜披萨" },
      description: {},
      ingredients: [],
      allergens: [],
      taste_profile: [],
      image_source: "ai",
    }),
    "11,50€",
  );
  assert.equal(stripPriceFromOriginalName("LA MARINARA 11,50€"), "LA MARINARA");
});

test("waiter order confirmation shows dish images and separates translated notes", async () => {
  const orderConfirmPage = await readFile(`${ROOT}/src/components/order/OrderConfirmPage.tsx`, "utf8");

  assert.match(orderConfirmPage, /import DishImageWithLoading/);
  assert.match(orderConfirmPage, /<DishImageWithLoading/);
  assert.match(orderConfirmPage, /order-confirm-thumb/);
  assert.match(orderConfirmPage, /gridTemplateColumns:\s*"42px minmax\(0, 1fr\) 34px auto"/);
  assert.match(orderConfirmPage, /previewDish/);
  assert.match(orderConfirmPage, /setPreviewDish\(item\.dish\)/);
  assert.match(orderConfirmPage, /aria-label=\{`查看 \$\{item\.dish\.name_translated\?\.zh \|\| item\.dish\.name_original\} 大图`\}/);
  assert.match(orderConfirmPage, /\{item\.quantity\}份/);
  assert.doesNotMatch(orderConfirmPage, /left:\s*3,\s*bottom:\s*3/);
  assert.match(orderConfirmPage, /selectedNotes\.map\(\(note\)/);
  assert.match(orderConfirmPage, /note\.original/);
  assert.match(orderConfirmPage, /note\.zh/);
  assert.doesNotMatch(orderConfirmPage, /selectedNotes\.map\(\(note\) => `\$\{note\.original\} · \$\{note\.zh\}`\)\.join/);
});
