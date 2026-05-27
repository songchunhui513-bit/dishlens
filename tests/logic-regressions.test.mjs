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

test("dish insight fallback recommendations are specific to each dish", async () => {
  await loadTsModule(`${ROOT}/src/lib/dish-image-match.ts`);
  const { getDishInsight } = await loadTsModule(
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
  ];

  const recommendations = dishes.map((dish) => getDishInsight(dish).recommendation);

  assert.equal(new Set(recommendations).size, dishes.length);
  assert.match(recommendations[0], /豆酱|酱香|斗仑/);
  assert.match(recommendations[1], /椒盐|趁热|下酒/);
  assert.match(recommendations[2], /花雕|蟹黄|膏蟹/);
  assert.match(recommendations[3], /橄榄油|蔬菜|清爽|油腻/);
  assert.match(recommendations[4], /樱花虾|芹菜|脆爽|清口/);
  assert.doesNotMatch(recommendations.join("\n"), /如果你想点一杯佐餐或餐后的饮品/);
  assert.doesNotMatch(recommendations.join("\n"), /如果你还有胃口，强烈推荐用这道甜品/);
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
  assert.equal(SHARE_TARGETS.some((target) => target.label === "短信" || target.label === "邮件"), false);
  assert.equal(buildShareHref("wechat", meta), null);
  assert.equal(buildShareHref("native", meta), null);
  assert.equal(buildShareHref("copy", meta), null);
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

test("iOS native share previews use explicit image metadata and WeChat avoids hanging native share", async () => {
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
  assert.match(wechatBranch, /copyLink\("链接已复制，打开微信粘贴给好友或群聊"\)/);
  assert.doesNotMatch(wechatBranch, /nativeShare|shareNative|navigator\.share/);
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
