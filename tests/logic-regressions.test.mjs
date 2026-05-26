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
  const rel = relative(ROOT, file).replace(/\.ts$/, ".mjs");
  const outFile = join(TMP_ROOT, rel);
  await mkdir(dirname(outFile), { recursive: true });
  await mkdir(join(TMP_ROOT, "public"), { recursive: true });
  await copyFile(join(ROOT, "public/dish-knowledge-db.json"), join(TMP_ROOT, "public/dish-knowledge-db.json"));
  await writeFile(outFile, compiled);
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
});

test("AI generated dish images are cached with deterministic keys before generating again", async () => {
  const route = await readFile(`${ROOT}/src/app/api/v1/translate/menu/route.ts`, "utf8");
  const storage = await readFile(`${ROOT}/src/lib/storage/supabase-storage.ts`, "utf8");
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
  assert.doesNotMatch(route, /generateImagesForDishes\([\s\S]*,\s*1,\s*\)/);
});

test("stale local generated image URLs from the database are not reused as valid cached images", async () => {
  const { isReusableExistingImageUrl } = await loadTsModule(
    `${ROOT}/src/lib/dish-image-url.ts`,
  );

  assert.equal(isReusableExistingImageUrl("/generated-dishes/generated-old-local-only.png"), false);
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
