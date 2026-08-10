import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import ts from "typescript";
import { mkdir, readFile, writeFile, copyFile, rm, stat } from "node:fs/promises";
import { dirname, relative, join } from "node:path";
import { promisify } from "node:util";

const ROOT = "/Users/julian/AI点菜/dishlens";
const TMP_ROOT = "/tmp/dishlens-logic-tests";
const execFileAsync = promisify(execFile);

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
    'import generatedDishLocalIndex from "../../public/generated-dish-local-index.json";',
    'const generatedDishLocalIndex = JSON.parse(await (await import("node:fs/promises")).readFile(new URL("../../public/generated-dish-local-index.json", import.meta.url), "utf8"));',
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
    'from "@/lib/safe-image-url"',
    file.includes("/src/lib/server/")
      ? 'from "../safe-image-url.mjs"'
      : 'from "./safe-image-url.mjs"',
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
  await copyFile(join(ROOT, "public/generated-dish-local-index.json"), join(TMP_ROOT, "public/generated-dish-local-index.json"));
  await writeFile(outFile, compiled);
  const dependencyMap = [
    { pattern: 'from "./dish-image-match.mjs"', file: `${ROOT}/src/lib/dish-image-match.ts` },
    { pattern: 'from "./dish-name-normalization.mjs"', file: `${ROOT}/src/lib/dish-name-normalization.ts` },
    { pattern: 'from "./results-categories.mjs"', file: `${ROOT}/src/lib/results-categories.ts` },
    { pattern: 'from "./dish-presentation.mjs"', file: `${ROOT}/src/lib/dish-presentation.ts` },
    { pattern: 'from "./dish-image-url.mjs"', file: `${ROOT}/src/lib/dish-image-url.ts` },
    { pattern: 'from "./safe-image-url.mjs"', file: `${ROOT}/src/lib/safe-image-url.ts` },
    { pattern: 'from "../safe-image-url.mjs"', file: `${ROOT}/src/lib/safe-image-url.ts` },
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

test("menu OCR image normalization keeps photographed text legible by default", async () => {
  const imageInput = await readFile(`${ROOT}/src/lib/image-input.ts`, "utf8");
  const apiClient = await readFile(`${ROOT}/src/lib/api-client.ts`, "utf8");

  const { DEFAULT_SERVER_IMAGE_MAX_DIM, DEFAULT_SERVER_IMAGE_QUALITY } = await loadTsModule(
    `${ROOT}/src/lib/image-input.ts`,
  );

  assert.ok(DEFAULT_SERVER_IMAGE_MAX_DIM >= 1280);
  assert.ok(DEFAULT_SERVER_IMAGE_QUALITY >= 72);
  assert.match(imageInput, /DEFAULT_SERVER_IMAGE_MAX_DIM\s*=\s*1[34]\d{2}/);
  assert.match(imageInput, /DEFAULT_SERVER_IMAGE_QUALITY\s*=\s*7[2-9]/);
  assert.match(apiClient, /CLIENT_MENU_IMAGE_MAX_DIM\s*=\s*1[34]\d{2}/);
  assert.match(apiClient, /CLIENT_MENU_IMAGE_QUALITY\s*=\s*0\.8[0-9]/);
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
  assert.equal(matchDishKnowledgeImage({ name_original: "Pizza Bianca" })?.id, "pizza-bianca");
  assert.equal(matchDishKnowledgeImage({ name_original: "Pizza Bufalina" })?.id, "pizza-bufalina");
  assert.equal(matchDishKnowledgeImage({ name_original: "Pizza Napoletana" })?.id, "pizza-napoletana");
  assert.equal(matchDishKnowledgeImage({ name_original: "Pizza al Tartufo" })?.id, "pizza-tartufo");
  assert.equal(matchDishKnowledgeImage({ name_original: "Pizza Frutti di Mare" })?.id, "pizza-frutti-di-mare");
  assert.equal(matchDishKnowledgeImage({ name_original: "Pizza Caprese" })?.id, "pizza-caprese");
  assert.equal(matchDishKnowledgeImage({ name_original: "Pizza Romana" })?.id, "pizza-romana");
  assert.equal(matchDishKnowledgeImage({ name_original: "Pizza Siciliana" })?.id, "pizza-siciliana");
  assert.equal(matchDishKnowledgeImage({ name_original: "Pizza Burrata e Prosciutto" })?.id, "pizza-burrata-prosciutto");
  assert.equal(matchDishKnowledgeImage({ name_original: "Pizza Prosciutto e Funghi" })?.id, "pizza-prosciutto-funghi");
  assert.notEqual(
    matchDishKnowledgeImage({ name_original: "Burrata salad with peaches and mint" })?.id,
    "burrata-con-pomodorini",
  );
  assert.equal(matchDishKnowledgeImage({ name_original: "Pizza Mortadella e Pistacchio" })?.id, "pizza-mortadella-pistacchio");
  assert.equal(matchDishKnowledgeImage({ name_original: "Pizza Pugliese" })?.id, "pizza-pugliese");
  assert.equal(matchDishKnowledgeImage({ name_original: "Pizza Salsiccia e Friarielli" })?.id, "pizza-salsiccia-friarielli");
  assert.equal(matchDishKnowledgeImage({ name_original: "Pizza Wurstel e Patate" })?.id, "pizza-wurstel-patate");
  assert.equal(matchDishKnowledgeImage({ name_original: "Popiah" })?.id, "popiah");
  assert.equal(matchDishKnowledgeImage({ name_original: "Saltimbocca alla Romana" })?.id, "saltimbocca");
  assert.equal(matchDishKnowledgeImage({ name_original: "Temaki" })?.id, "temaki");
  assert.equal(matchDishKnowledgeImage({ name_original: "Arroz con Mariscos" })?.id, "arroz-con-mariscos");
  assert.equal(matchDishKnowledgeImage({ name_original: "Arroz Negro" })?.id, "arroz-negro");
  assert.equal(matchDishKnowledgeImage({ name_original: "Bacalao al Pil-Pil" })?.id, "bacalao-al-pil-pil");
  assert.equal(matchDishKnowledgeImage({ name_original: "Banh Trang Tron" })?.id, "banh-trang-tron");
  assert.equal(matchDishKnowledgeImage({ name_original: "Banh Xeo" })?.id, "banh-xeo");
  assert.equal(matchDishKnowledgeImage({ name_original: "Bun Cha" })?.id, "bun-cha");
  assert.equal(matchDishKnowledgeImage({ name_original: "Chili Crab" })?.id, "chili-crab");
  assert.equal(matchDishKnowledgeImage({ name_original: "Black Pepper Crab" })?.id, "black-pepper-crab");
  assert.equal(matchDishKnowledgeImage({ name_original: "California Roll" })?.id, "california-roll");
  assert.equal(matchDishKnowledgeImage({ name_original: "Gambas al Ajillo" })?.id, "gambas-al-ajillo");
  assert.equal(matchDishKnowledgeImage({ name_original: "Goi Cuon" })?.id, "goi-cuon");
  assert.equal(matchDishKnowledgeImage({ name_original: "Cha Gio" })?.id, "cha-gio");
  assert.equal(matchDishKnowledgeImage({ name_original: "Croquetas" })?.id, "croquetas-espanolas");
  assert.equal(matchDishKnowledgeImage({ name_original: "Fish Tacos" })?.id, "fish-tacos-street");
  assert.equal(matchDishKnowledgeImage({ name_original: "Boquerones Fritos" })?.id, "boquerones-fritos");
  assert.equal(matchDishKnowledgeImage({ name_original: "Branzino al Forno" })?.id, "branzino-al-forno");
  assert.equal(matchDishKnowledgeImage({ name_original: "Bun Thit Nuong" })?.id, "bun-thit-nuong");
  assert.equal(matchDishKnowledgeImage({ name_original: "Bungeoppang" })?.id, "bungeoppang");
  assert.equal(matchDishKnowledgeImage({ name_original: "Ca Kho To" })?.id, "ca-kho-to");
  assert.equal(matchDishKnowledgeImage({ name_original: "Calamares a la Andaluza" })?.id, "calamares-a-la-andaluza");
  assert.equal(matchDishKnowledgeImage({ name_original: "Char Kway Teow" })?.id, "char-kway-teow");
  assert.equal(matchDishKnowledgeImage({ name_original: "Chirashizushi" })?.id, "chirashizushi");
  assert.equal(matchDishKnowledgeImage({ name_original: "Dragon Roll" })?.id, "dragon-roll");
  assert.equal(matchDishKnowledgeImage({ name_original: "Fish Amritsari" })?.id, "fish-amritsari");
  assert.equal(matchDishKnowledgeImage({ name_original: "Fish Curry" })?.id, "fish-curry");
  assert.equal(matchDishKnowledgeImage({ name_original: "Fugu Sashimi" })?.id, "fugu-sashimi");
  assert.equal(matchDishKnowledgeImage({ name_original: "Gai Tod" })?.id, "gai-tod");
  assert.equal(matchDishKnowledgeImage({ name_original: "Ganjang Gejang" })?.id, "ganjang-gejang");
  assert.equal(matchDishKnowledgeImage({ name_original: "Gravlax" })?.id, "gravlax");
  assert.equal(matchDishKnowledgeImage({ name_original: "Haemul Pajeon" })?.id, "haemul-pajeon");
  assert.equal(matchDishKnowledgeImage({ name_original: "Nasu Dengaku" })?.id, "nasu-dengaku");
  assert.equal(matchDishKnowledgeImage({ name_original: "Okonomiyaki" })?.id, "okonomiyaki");
  assert.equal(matchDishKnowledgeImage({ name_original: "Pajeon" })?.id, "pajeon");
  assert.equal(matchDishKnowledgeImage({ name_original: "Tortellini Panna" })?.id, "tortellini-panna");
  assert.equal(matchDishKnowledgeImage({ name_original: "Hokkien Mee" })?.id, "hokkien-mee");
  assert.equal(matchDishKnowledgeImage({ name_original: "Hoy Tod" })?.id, "hoy-tod");
  assert.equal(matchDishKnowledgeImage({ name_original: "Kerak Telor" })?.id, "kerak-telor");
  assert.equal(matchDishKnowledgeImage({ name_original: "Khao Pad" })?.id, "khao-pad");
  assert.equal(matchDishKnowledgeImage({ name_original: "Bal Kaymak" })?.id, "bal-kaymak");
  assert.equal(matchDishKnowledgeImage({ name_original: "Cloudberry Cream" })?.id, "cloudberry-cream");
  assert.equal(matchDishKnowledgeImage({ name_original: "Dadar Gulung" })?.id, "dadar-gulung");
  assert.equal(matchDishKnowledgeImage({ name_original: "Sweet Glazed Chicken" })?.id, "dakgangjeong");
  assert.equal(matchDishKnowledgeImage({ name_original: "Dal Makhani" })?.id, "dal-makhani");
  assert.equal(matchDishKnowledgeImage({ name_original: "Fettuccine Alfredo" })?.id, "fettuccine-alfredo");
  assert.equal(matchDishKnowledgeImage({ name_original: "Gado-Gado" })?.id, "gado-gado");
  assert.equal(matchDishKnowledgeImage({ name_original: "Edamame" })?.id, "edamame");
  assert.equal(matchDishKnowledgeImage({ name_original: "Es Campur" })?.id, "es-campur");
  assert.equal(matchDishKnowledgeImage({ name_original: "Galbi" })?.id, "galbi");
  assert.equal(matchDishKnowledgeImage({ name_original: "Soy Garlic Chicken" })?.id, "ganjang-chicken");
  assert.equal(matchDishKnowledgeImage({ name_original: "Gnocchi al Ragu" })?.id, "gnocchi-al-ragu");
  assert.equal(matchDishKnowledgeImage({ name_original: "Danish Pastry" })?.id, "danish-pastry");
  assert.equal(matchDishKnowledgeImage({ name_original: "Durian" })?.id, "durian-sg");
  assert.equal(matchDishKnowledgeImage({ name_original: "Turkish Baklava" })?.id, "baklava-turkish");
  assert.equal(matchDishKnowledgeImage({ name_original: "Churros" })?.id, "churros-street");
  assert.equal(matchDishKnowledgeImage({ name_original: "Ghriba" })?.id, "grina");
  assert.equal(matchDishKnowledgeImage({ name_original: "Gulab Jamun" })?.id, "gulab-jamun");
  assert.equal(matchDishKnowledgeImage({ name_original: "Egg Bread" })?.id, "gyeranppang");
  assert.equal(matchDishKnowledgeImage({ name_original: "Turkish Gozleme" })?.id, "gozleme");
  assert.equal(matchDishKnowledgeImage({ name_original: "Gyoza" })?.id, "gyoza");
  assert.equal(matchDishKnowledgeImage({ name_original: "Halva" })?.id, "halva-me");
  assert.equal(matchDishKnowledgeImage({ name_original: "Hotteok" })?.id, "hotteok");
  assert.equal(matchDishKnowledgeImage({ name_original: "Ice Kacang" })?.id, "ice-kacang");
  assert.equal(matchDishKnowledgeImage({ name_original: "Inari Sushi" })?.id, "inari-sushi");
  assert.equal(matchDishKnowledgeImage({ name_original: "Jajangmyeon" })?.id, "jajangmyeon");
  assert.equal(matchDishKnowledgeImage({ name_original: "Jalebi" })?.id, "jalebi");
  assert.equal(matchDishKnowledgeImage({ name_original: "Japchae" })?.id, "japchae");
  assert.equal(matchDishKnowledgeImage({ name_original: "Jokbal" })?.id, "jokbal");
  assert.equal(matchDishKnowledgeImage({ name_original: "Kakigori" })?.id, "kakigori");
  assert.equal(matchDishKnowledgeImage({ name_original: "Thai Kanom Jeen" })?.id, "kanom-jeen");
  assert.equal(matchDishKnowledgeImage({ name_original: "Kanom Krok" })?.id, "kanom-krok");
  assert.equal(matchDishKnowledgeImage({ name_original: "Karaage" })?.id, "karaage");
  assert.equal(matchDishKnowledgeImage({ name_original: "Karnıyarık" })?.id, "karniyarik");
  assert.equal(matchDishKnowledgeImage({ name_original: "Kaya Toast" })?.id, "kaya-toast");
  assert.equal(matchDishKnowledgeImage({ name_original: "Kazandibi" })?.id, "kazandibi");
  assert.equal(matchDishKnowledgeImage({ name_original: "Keema Matar" })?.id, "keema-matar");
  assert.equal(matchDishKnowledgeImage({ name_original: "Khanom Buang" })?.id, "khanom-buang");
  assert.equal(matchDishKnowledgeImage({ name_original: "Thai Khao Man Gai" })?.id, "khao-man-gai-thai");
  assert.equal(matchDishKnowledgeImage({ name_original: "Khao Mok Gai" })?.id, "khao-mok-gai");
  assert.equal(matchDishKnowledgeImage({ name_original: "Kheer" })?.id, "kheer");
  assert.equal(matchDishKnowledgeImage({ name_original: "Middle Eastern Kibbeh" })?.id, "kibbeh-me");
  assert.equal(matchDishKnowledgeImage({ name_original: "Knafeh" })?.id, "knafeh-me");
  assert.equal(matchDishKnowledgeImage({ name_original: "Korean BBQ Platter" })?.id, "korean-bbq-platter");
  assert.equal(matchDishKnowledgeImage({ name_original: "Korean Fried Chicken" })?.id, "korean-fried-chicken");
  assert.equal(matchDishKnowledgeImage({ name_original: "Kra Pao Gai" })?.id, "kra-pao-gai");
  assert.equal(matchDishKnowledgeImage({ name_original: "Kua Mee" })?.id, "kua-mee");
  assert.equal(matchDishKnowledgeImage({ name_original: "Kulfi" })?.id, "kulfi");
  assert.equal(matchDishKnowledgeImage({ name_original: "Kulfi Falooda" })?.id, "kulfi-falooda");
  assert.equal(matchDishKnowledgeImage({ name_original: "Künefe" })?.id, "kunefe");
  assert.equal(matchDishKnowledgeImage({ name_original: "Shahi Paneer" })?.id, "shahi-paneer");
  assert.equal(matchDishKnowledgeImage({ name_original: "Tacos al Pastor" })?.id, "tacos-al-pastor");
  assert.equal(matchDishKnowledgeImage({ name_original: "Japanese Omelette" })?.id, "tamagoyaki");
  assert.equal(matchDishKnowledgeImage({ name_original: "Tebasaki" })?.id, "tebasaki");
  assert.equal(matchDishKnowledgeImage({ name_original: "Teriyaki Chicken" })?.id, "teriyaki-chicken");
  assert.equal(matchDishKnowledgeImage({ name_original: "Street Dumplings" })?.id, "dumplings-street");
  assert.equal(matchDishKnowledgeImage({ name_original: "Lod Chong" })?.id, "lod-chong");
  assert.equal(matchDishKnowledgeImage({ name_original: "Lokum" })?.id, "lokum-turkish");
  assert.equal(matchDishKnowledgeImage({ name_original: "Lomo Saltado" })?.id, "lomo-saltado");
  assert.equal(matchDishKnowledgeImage({ name_original: "Malai Kofta" })?.id, "malai-kofta");
  assert.equal(matchDishKnowledgeImage({ name_original: "Maki Roll" })?.id, "maki-roll");
  assert.equal(matchDishKnowledgeImage({ name_original: "Massaman Curry" })?.id, "massaman-curry");
  assert.equal(matchDishKnowledgeImage({ name_original: "Mazamorra Morada" })?.id, "mazamorra-morada");
  assert.equal(matchDishKnowledgeImage({ name_original: "Mee Goreng" })?.id, "mee-goreng");
  assert.equal(matchDishKnowledgeImage({ name_original: "Mee Krob" })?.id, "mee-krob");
  assert.equal(matchDishKnowledgeImage({ name_original: "Mole Negro" })?.id, "mole-negro");
  assert.equal(matchDishKnowledgeImage({ name_original: "Mole Poblano" })?.id, "mole-poblano");
  assert.equal(matchDishKnowledgeImage({ name_original: "Moo Ping" })?.id, "moo-ping");
  assert.equal(matchDishKnowledgeImage({ name_original: "Muhammara" })?.id, "muhammara-lebanese");
  assert.equal(matchDishKnowledgeImage({ name_original: "Middle Eastern Muhammara" })?.id, "muhammara-me");
  assert.equal(matchDishKnowledgeImage({ name_original: "Mujadara" })?.id, "mujadara");
  assert.equal(matchDishKnowledgeImage({ name_original: "Mutter Paneer" })?.id, "mutter-paneer");
  assert.equal(matchDishKnowledgeImage({ name_original: "Spicy Stir-Fried Octopus" })?.id, "nakji-bokkeum");
  assert.equal(matchDishKnowledgeImage({ name_original: "Nam Prik Oong" })?.id, "nam-prik-oong");
  assert.equal(matchDishKnowledgeImage({ name_original: "Nasi Lemak" })?.id, "nasi-lemak");
  assert.equal(matchDishKnowledgeImage({ name_original: "Scallion Tuna Roll" })?.id, "negitoro-roll");
  assert.equal(matchDishKnowledgeImage({ name_original: "Assorted Nigiri Platter" })?.id, "nigiri-assorted");
  assert.equal(matchDishKnowledgeImage({ name_original: "Or Suan" })?.id, "or-suan");
  assert.equal(matchDishKnowledgeImage({ name_original: "Oyster Omelette" })?.id, "oyster-omelette");
  assert.equal(matchDishKnowledgeImage({ name_original: "Pad Kra Pao" })?.id, "pad-kra-pao");
  assert.equal(matchDishKnowledgeImage({ name_original: "Seafood Paella" })?.id, "paella-de-marisco");
  assert.equal(matchDishKnowledgeImage({ name_original: "Seafood Pasta" })?.id, "pasta-frutti-di-mare");
  assert.equal(matchDishKnowledgeImage({ name_original: "Pickled Herring" })?.id, "pickled-herring");
  assert.equal(matchDishKnowledgeImage({ name_original: "Galician Octopus" })?.id, "pulpo-a-la-gallega");
  assert.equal(matchDishKnowledgeImage({ name_original: "Puttanesca Pasta" })?.id, "puttanesca");
  assert.equal(matchDishKnowledgeImage({ name_original: "Seafood Risotto" })?.id, "risotto-ai-frutti-di-mare");
  assert.equal(matchDishKnowledgeImage({ name_original: "Squid Ink Risotto" })?.id, "risotto-al-nero-di-seppia");
  assert.equal(matchDishKnowledgeImage({ name_original: "Norwegian Salmon" })?.id, "norwegian-salmon");
  assert.equal(matchDishKnowledgeImage({ name_original: "Pla Rad Prik" })?.id, "pla-rad-prik");
  assert.equal(matchDishKnowledgeImage({ name_original: "Spicy Prawn Curry" })?.id, "prawn-masala");
  assert.equal(matchDishKnowledgeImage({ name_original: "Rainbow Roll" })?.id, "rainbow-roll");
  assert.equal(matchDishKnowledgeImage({ name_original: "Shrimp Risotto" })?.id, "risotto-ai-gamberi");
  assert.equal(matchDishKnowledgeImage({ name_original: "Mie Goreng" })?.id, "mie-goreng-indonesian");
  assert.equal(matchDishKnowledgeImage({ name_original: "Nasi Goreng" })?.id, "nasi-goreng-indonesian");
  assert.equal(matchDishKnowledgeImage({ name_original: "Smorrebrod" })?.id, "smorrebrod");
  assert.equal(matchDishKnowledgeImage({ name_original: "Clam Pasta" })?.id, "spaghetti-alle-vongole");
  assert.equal(matchDishKnowledgeImage({ name_original: "Takoyaki" })?.id, "takoyaki");
  assert.equal(matchDishKnowledgeImage({ name_original: "Sashimi" })?.id, "sashimi");
  assert.equal(matchDishKnowledgeImage({ name_original: "Sashimi Platter" })?.id, "sashimi-platter");
  assert.equal(matchDishKnowledgeImage({ name_original: "Spicy Tuna Roll" })?.id, "spicy-tuna-roll");
  assert.equal(matchDishKnowledgeImage({ name_original: "Salmon Nigiri Sushi" })?.id, "sushi-nigiri-salmon");
  assert.equal(matchDishKnowledgeImage({ name_original: "Taiyaki" })?.id, "taiyaki");
  assert.equal(matchDishKnowledgeImage({ name_original: "Tuna Nigiri Sushi" })?.id, "sushi-nigiri-tuna");
  assert.equal(matchDishKnowledgeImage({ name_original: "Shrimp Nigiri Sushi" })?.id, "sushi-nigiri-shrimp");
  assert.equal(matchDishKnowledgeImage({ name_original: "Eel Nigiri Sushi" })?.id, "sushi-nigiri-eel");
  assert.equal(matchDishKnowledgeImage({ name_original: "Octopus Nigiri Sushi" })?.id, "sushi-nigiri-octopus");
  assert.equal(matchDishKnowledgeImage({ name_original: "Shrimp Tempura" })?.id, "tempura-shrimp");
  assert.equal(matchDishKnowledgeImage({ name_original: "Polpo alla Lucchese" })?.id, "polpo-alla-lucchese");
  assert.equal(matchDishKnowledgeImage({ name_original: "Rojak" })?.id, "rojak");
  assert.equal(matchDishKnowledgeImage({ name_original: "Smorgasbord" })?.id, "smorgasbord");
  assert.equal(matchDishKnowledgeImage({ name_original: "Mussel Spaghetti" })?.id, "spaghetti-alle-cozze");
  assert.equal(matchDishKnowledgeImage({ name_original: "Tandoori Prawns" })?.id, "tandoori-prawns");
  assert.equal(matchDishKnowledgeImage({ name_original: "Tteokbokki" })?.id, "tteokbokki");
  assert.equal(matchDishKnowledgeImage({ name_original: "Yakisoba" })?.id, "yakisoba");
  assert.equal(matchDishKnowledgeImage({ name_original: "Yam Pla Muk" })?.id, "yam-pla-muk");
  assert.equal(matchDishKnowledgeImage({ name_original: "Tempeh" })?.id, "tempeh-indonesian");
  assert.equal(matchDishKnowledgeImage({ name_original: "Aebleskiver" })?.id, "aebleskiver");
  assert.equal(matchDishKnowledgeImage({ name_original: "Rakfisk" })?.id, "rakfisk");
  assert.equal(matchDishKnowledgeImage({ name_original: "Spanish Meatballs" })?.id, "albondigas-espanolas");
  assert.equal(matchDishKnowledgeImage({ name_original: "Anmitsu" })?.id, "anmitsu");
  assert.equal(matchDishKnowledgeImage({ name_original: "Baghrir" })?.id, "baghrir");
  assert.equal(matchDishKnowledgeImage({ name_original: "Crispy Duck" })?.id, "bebek-bengil");
  assert.equal(matchDishKnowledgeImage({ name_original: "Bibim Guksu" })?.id, "bibim-guksu");
  assert.equal(matchDishKnowledgeImage({ name_original: "Bibim Naengmyeon" })?.id, "bibim-naengmyeon");
  assert.equal(matchDishKnowledgeImage({ name_original: "Bingsu" })?.id, "bingsu");
  assert.equal(matchDishKnowledgeImage({ name_original: "Bo Luc Lac" })?.id, "bo-luc-lac");
  assert.equal(matchDishKnowledgeImage({ name_original: "Bruschetta" })?.id, "bruschetta-al-pomodoro");
  assert.equal(matchDishKnowledgeImage({ name_original: "Mushroom Bruschetta" })?.id, "bruschetta-ai-funghi");
  assert.equal(matchDishKnowledgeImage({ name_original: "Bulgogi" })?.id, "bulgogi");
  assert.equal(matchDishKnowledgeImage({ name_original: "Cao Lau" })?.id, "cao-lau");
  assert.equal(matchDishKnowledgeImage({ name_original: "Sicilian Cassata" })?.id, "cassata-siciliana");
  assert.equal(matchDishKnowledgeImage({ name_original: "Chebakia" })?.id, "chebakia");
  assert.equal(matchDishKnowledgeImage({ name_original: "Cendol" })?.id, "chendol");
  assert.equal(matchDishKnowledgeImage({ name_original: "Chicken Korma" })?.id, "chicken-korma");
  assert.equal(matchDishKnowledgeImage({ name_original: "Chiles en Nogada" })?.id, "chiles-en-nogada");
  assert.equal(matchDishKnowledgeImage({ name_original: "Churros with Chocolate" })?.id, "churros-con-chocolate");
  assert.equal(matchDishKnowledgeImage({ name_original: "Cinnamon Roll" })?.id, "cinnamon-roll-scandinavian");
  assert.equal(matchDishKnowledgeImage({ name_original: "Roast Suckling Pig" })?.id, "cochinillo-asado");
  assert.equal(matchDishKnowledgeImage({ name_original: "Crema Catalana" })?.id, "crema-catalana");
  assert.equal(matchDishKnowledgeImage({ name_original: "Jam Tart" })?.id, "crostata-di-marmellata");
  assert.equal(matchDishKnowledgeImage({ name_original: "Dakgalbi" })?.id, "dakgalbi");
  assert.equal(matchDishKnowledgeImage({ name_original: "Burrata" })?.id, "burrata-con-pomodorini");
  assert.equal(matchDishKnowledgeImage({ name_original: "LA SALADE DU MOMENT" })?.id, "salade-nicoise");
  assert.equal(matchDishKnowledgeImage({ name_original: "LA SALADE JAMBON DE PARME" })?.id, "salade-chez-louis");
  assert.equal(matchDishKnowledgeImage({ name_original: "Bibimbap" })?.id, "bibimbap");
  assert.equal(matchDishKnowledgeImage({ name_original: "Bossam" })?.id, "bossam");
  assert.equal(matchDishKnowledgeImage({ name_original: "Causa Peruana" })?.id, "causa-peruviana");
  assert.equal(matchDishKnowledgeImage({ name_original: "Chawanmushi" })?.id, "chawanmushi");
  assert.equal(matchDishKnowledgeImage({ name_original: "Dango" })?.id, "dango");
  assert.equal(matchDishKnowledgeImage({ name_original: "Dorayaki" })?.id, "dorayaki");
  assert.equal(matchDishKnowledgeImage({ name_original: "Gyudon" })?.id, "gyudon");
  assert.equal(matchDishKnowledgeImage({ name_original: "Gaji Namul" })?.id, "gaji-namul");
  assert.equal(matchDishKnowledgeImage({ name_original: "Hamburg Steak" })?.id, "hamburg-steak");
  assert.equal(matchDishKnowledgeImage({ name_original: "Hayashi Rice" })?.id, "hayashi-rice");
  assert.equal(matchDishKnowledgeImage({ name_original: "Ikura Don" })?.id, "ikura-don");
  assert.equal(matchDishKnowledgeImage({ name_original: "Inca Cola" })?.id, "inca-cola");
  assert.equal(matchDishKnowledgeImage({ name_original: "Injeolmi" })?.id, "injeolmi");
  assert.equal(matchDishKnowledgeImage({ name_original: "Kaiseki" })?.id, "kaiseki");
  assert.equal(matchDishKnowledgeImage({ name_original: "Katsu Curry" })?.id, "katsu-curry");
  assert.equal(matchDishKnowledgeImage({ name_original: "Katsudon" })?.id, "katsudon");
  assert.equal(matchDishKnowledgeImage({ name_original: "Makgeolli" })?.id, "makgeolli");
  assert.equal(matchDishKnowledgeImage({ name_original: "Mandu" })?.id, "mandu");
  assert.equal(matchDishKnowledgeImage({ name_original: "Mul Naengmyeon" })?.id, "mul-naengmyeon");
  assert.equal(matchDishKnowledgeImage({ name_original: "Natto" })?.id, "natto");
  assert.equal(matchDishKnowledgeImage({ name_original: "Ochazuke" })?.id, "ochazuke");
  assert.equal(matchDishKnowledgeImage({ name_original: "Onigiri" })?.id, "onigiri");
  assert.equal(matchDishKnowledgeImage({ name_original: "Omurice" })?.id, "omurice");
  assert.equal(matchDishKnowledgeImage({ name_original: "Oyakodon" })?.id, "oyakodon");
  assert.equal(matchDishKnowledgeImage({ name_original: "Ramune" })?.id, "ramune");
  assert.equal(matchDishKnowledgeImage({ name_original: "Ssambap" })?.id, "ssambap");
  assert.equal(matchDishKnowledgeImage({ name_original: "Tsukemen" })?.id, "tsukemen");
  assert.equal(matchDishKnowledgeImage({ name_original: "Tteokguk" })?.id, "tteokguk");
  assert.equal(matchDishKnowledgeImage({ name_original: "Udon" })?.id, "udon");
  assert.equal(matchDishKnowledgeImage({ name_original: "Unagi Don" })?.id, "unagi-don");
  assert.equal(matchDishKnowledgeImage({ name_original: "Warabimochi" })?.id, "warabimochi");
  assert.equal(matchDishKnowledgeImage({ name_original: "Yudofu" })?.id, "yudofu");
  assert.equal(matchDishKnowledgeImage({ name_original: "Cheonggukjang" })?.id, "cheonggukjang");
  assert.equal(matchDishKnowledgeImage({ name_original: "Doenjang Jjigae" })?.id, "doenjang-jjigae");
  assert.equal(matchDishKnowledgeImage({ name_original: "Gochujang Jjigae" })?.id, "gochujang-jjigae");
  assert.equal(matchDishKnowledgeImage({ name_original: "Galbitang" })?.id, "galbitang");
  assert.equal(matchDishKnowledgeImage({ name_original: "Hainan Chicken Rice" })?.id, "hainanese-chicken-rice");
  assert.equal(matchDishKnowledgeImage({ name_original: "Japanese Curry" })?.id, "japanese-curry");
  assert.equal(matchDishKnowledgeImage({ name_original: "Kare Raisu" })?.id, "japanese-curry");
  assert.equal(matchDishKnowledgeImage({ name_original: "Yukgaejang" })?.id, "yukgaejang");
  assert.equal(matchDishKnowledgeImage({ name_original: "Spicy Beef Soup" })?.id, "yukgaejang");
  assert.equal(matchDishKnowledgeImage({ name_original: "Bruschetta" })?.id, "bruschetta-al-pomodoro");
  assert.equal(matchDishKnowledgeImage({ name_original: "Chicken Parmigiana" })?.id, "pollo-alla-parmigiana");
  assert.equal(matchDishKnowledgeImage({ name_original: "Chocolate Lava Cake" })?.id, "tortino-al-cioccolato");
  assert.equal(matchDishKnowledgeImage({ name_original: "Jamón Ibérico" })?.id, "jamon-iberico");
  assert.equal(matchDishKnowledgeImage({ name_original: "Melanzane alla Parmigiana" })?.id, "melanzane-parmigiana");
  assert.equal(matchDishKnowledgeImage({ name_original: "Paella Valenciana" })?.id, "paella-valenciana");
  assert.equal(matchDishKnowledgeImage({ name_original: "Patatas Bravas" })?.id, "patatas-bravas");
});

test("modern bistro menu names resolve to local images before AI generation", async () => {
  const { matchDishKnowledgeImage } = await loadTsModule(
    `${ROOT}/src/lib/dish-image-match.ts`,
  );

  assert.equal(matchDishKnowledgeImage({ name_original: "CROQUETTES VG", description: "manchego, corn and chilli croquettes" })?.card, "/dishes/bistro-croquettes.webp");
  assert.equal(matchDishKnowledgeImage({ name_original: "HEIRLOOM TOMATO L VG", description: "buffalo mozzarella, basil cream, lemon oil" })?.id, "burrata-con-pomodorini");
  assert.equal(matchDishKnowledgeImage({ name_original: "BANANA FRITTER", description: "mango sauce" })?.card, "/dishes/banana-fritter.webp");
  assert.equal(matchDishKnowledgeImage({ name_original: "MATCHA ROLL", description: "matcha pastry cake with raspberry" })?.card, "/dishes/matcha-roll.webp");
  assert.equal(matchDishKnowledgeImage({ name_original: "MOCHI", description: "black sesame ice cream filling, coconut" })?.card, "/dishes/black-sesame-mochi.webp");
  assert.equal(matchDishKnowledgeImage({ name_original: "ALBACORE TUNA L DF", description: "smoked soy, soba noodles, yuzu ponzu" })?.card, "/dishes/albacore-tuna-soba.webp");
});

test("real-world menu names produce stable cache and local-image lookup candidates", async () => {
  const { dishNameLookupCandidates } = await loadTsModule(
    `${ROOT}/src/lib/dish-name-normalization.ts`,
  );
  const { matchDishKnowledgeImage } = await loadTsModule(
    `${ROOT}/src/lib/dish-image-match.ts`,
  );

  const rillettes = dishNameLookupCandidates("01 Rillettes aux deux saumons / 2 Salmons Rillettes");
  assert.ok(rillettes.includes("rillettes aux deux saumons"));
  assert.ok(rillettes.includes("salmons rillettes"));
  assert.ok(rillettes.every((candidate) => !/^01\b/.test(candidate)));

  assert.equal(matchDishKnowledgeImage({ name_original: "BigSpicy Chicken Wrap Meal" })?.card, "/dishes/generated-cache/generated-bigspicy-chicken-wrap.webp");
  assert.equal(matchDishKnowledgeImage({ name_original: "Chicken Maharaja Mac Meal" })?.card, "/dishes/generated-cache/generated-chicken-maharaja-mac.webp");
  assert.equal(matchDishKnowledgeImage({ name_original: "Filet-O-Fish Meal" })?.card, "/dishes/generated-cache/generated-filet-o-fish.webp");
  assert.equal(matchDishKnowledgeImage({ name_original: "McChicken™ Meal" })?.card, "/dishes/generated-cache/generated-mcchicken.webp");
});

test("fast-food combo meals are normalized away from dessert or drink categories", async () => {
  const { normalizeExtractedDishFields } = await loadTsModule(
    `${ROOT}/src/lib/menu-analysis-normalization.ts`,
  );

  assert.equal(
    normalizeExtractedDishFields({
      name_original: "BigSpicy Paneer Wrap Meal",
      name_translated: "大辣素斋卷餐",
      description: "Paneer wrap with fries and soft drink",
      category: "dessert",
    }).category,
    "staple",
  );
  assert.equal(
    normalizeExtractedDishFields({
      name_original: "McSpicy™ Paneer Meal",
      name_translated: "麦辣素斋餐",
      description: "Paneer burger meal with fries and cola",
      category: "drink",
    }).category,
    "staple",
  );
});

test("verified generated dish images can be promoted into the offline local image index", async () => {
  const { matchDishKnowledgeImage } = await loadTsModule(
    `${ROOT}/src/lib/dish-image-match.ts`,
  );
  const index = JSON.parse(await readFile(`${ROOT}/public/generated-dish-local-index.json`, "utf8"));
  const promoteScript = await readFile(`${ROOT}/scripts/promote-generated-dish-images.mjs`, "utf8");

  assert.ok(index.length >= 18);
  assert.match(promoteScript, /PROMOTION_BLOCKLIST/);
  assert.match(promoteScript, /PROMOTION_NAME_BLOCKLIST/);
  assert.match(promoteScript, /skipped_generic_name/);
  assert.match(promoteScript, /plain/);
  assert.match(promoteScript, /vegan/);
  assert.match(promoteScript, /overnight/);
  assert.match(promoteScript, /generated-prosciutto-gfo-df/);
  assert.match(promoteScript, /task_cache_generated/);
  assert.match(promoteScript, /total_generated_files/);
  assert.match(promoteScript, /unmapped_generated_files/);
  assert.match(promoteScript, /review_ready_mapped/);
  assert.match(promoteScript, /recover_task_cache_evidence_before_promoting/);
  assert.match(promoteScript, /unmapped_remote_knowledge_matches/);
  assert.match(promoteScript, /unmapped_local_knowledge_duplicates/);
  assert.match(promoteScript, /unmapped_hashed_storage_ids/);
  assert.match(promoteScript, /loadKnowledgeDb/);
  assert.match(promoteScript, /manual_visual_review_then_promote_to_knowledge_or_delete_duplicate/);
  assert.match(promoteScript, /--apply/);
  assert.match(promoteScript, /public", "dishes", "generated-cache"/);

  const { stdout: promoteDryRun } = await execFileAsync(
    process.execPath,
    ["scripts/promote-generated-dish-images.mjs", "--limit=20", "--verbose"],
    { cwd: ROOT, timeout: 30_000 },
  );
  const promoteReport = JSON.parse(promoteDryRun);
  assert.ok(promoteReport.audit.total_generated_files >= promoteReport.task_cache_mapped_images);
  assert.ok(promoteReport.audit.unmapped_generated_files >= 0);
  assert.ok(promoteReport.audit.unmapped_remote_knowledge_matches >= 0);
  assert.ok(promoteReport.audit.unmapped_local_knowledge_duplicates >= 0);
  assert.ok(promoteReport.audit.unmapped_hashed_storage_ids >= 0);
  assert.equal(promoteReport.audit.unmapped_remote_knowledge_matches, 0);
  assert.ok(promoteReport.audit.already_indexed >= promoteReport.summary.already_indexed);
  assert.equal(promoteReport.audit.next_action_for_unmapped, "recover_task_cache_evidence_before_promoting");
  assert.equal(
    promoteReport.audit.next_action_for_unmapped_knowledge_matches,
    "manual_visual_review_then_promote_to_knowledge_or_delete_duplicate",
  );
  assert.ok(promoteReport.audit.skipped_generic_name >= 3);
  assert.ok(promoteReport.summary.would_promote >= 0);
  const skippedIds = new Set(
    promoteReport.audit.samples.skipped_generic_name,
  );
  assert.deepEqual(skippedIds, new Set([
    "generated-plain",
    "generated-vegan",
    "generated-overnight",
  ]));

  assert.equal(
    matchDishKnowledgeImage({ name_original: "ROYALE" })?.card,
    "/dishes/generated-cache/generated-royale.webp",
  );
  assert.equal(
    matchDishKnowledgeImage({ name_original: "BENEDICT" })?.card,
    "/dishes/generated-cache/generated-benedict.webp",
  );
  assert.equal(
    matchDishKnowledgeImage({ name_original: "FLORENTINE" })?.card,
    "/dishes/generated-cache/generated-florentine.webp",
  );
  const newlyPromotedGeneratedImages = [
    ["CHIA PUDDING", "/dishes/generated-cache/generated-chia-pudding.webp"],
    ["SANDWICH, PISELLI, FAVA, MELISSA, UOVO POCHÉ", "/dishes/generated-cache/generated-sandwich-piselli-fava-melissa-uovo-poche.webp"],
    ["OMELETTE ALLA VIGNAROLA", "/dishes/generated-cache/generated-omelette-alla-vignarola.webp"],
    ["PAN FRUTTO, RICOTTA, MIELE, NOCI", "/dishes/generated-cache/generated-pan-frutto-ricotta-miele-noci.webp"],
    ["SEMI DI CHIA, LATTE DI RISO, SCIROPPPO D'ACERO, FRUTTI DI BOSCO", "/dishes/generated-cache/generated-semi-di-chia-latte-di-riso-sciropppo-d-acero-frutti-di-bosco.webp"],
    ["SEMI DI CHIA, LATTE DI RISO, SCIROPPIO D'ACERO, FRUTTI DI BOSCO", "/dishes/generated-cache/generated-semi-di-chia-latte-di-riso-sciroppio-d-acero-frutti-di-bosco.webp"],
    ["SYDNEY ROCK OYSTERS, MIGNONETTE LG OF $32/$64", [
      "/dishes/generated-cache/generated-sydney-rock-oysters-mignonette-l-gf-df.webp",
      "/dishes/generated-cache/generated-sydney-rock-oysters-mignonette-lg-of.webp",
    ]],
    ["CHIA PUDDING (V)", [
      "/dishes/generated-cache/generated-chia-pudding.webp",
      "/dishes/generated-cache/generated-chia-pudding-v.webp",
    ]],
    ["POMME RÔTIE AU FOUR", "/dishes/generated-cache/generated-pomme-rotie-au-four.webp"],
    ["POIRE POCHÉE À LA CRÈME DE MASCARPONE", "/dishes/generated-cache/generated-poire-pochee-a-la-creme-de-mascarpone.webp"],
    ["GLACES ARTISANALES ET CROQUANT D'AMANDES", "/dishes/generated-cache/generated-glaces-artisanales-et-croquant-d-amandes.webp"],
    ["COLONEL", "/dishes/generated-cache/generated-colonel.webp"],
    ["EXPRESSO", "/dishes/generated-cache/generated-expresso.webp"],
    ["DÉCAFÉINÉ", "/dishes/generated-cache/generated-decafeine.webp"],
    ["DOUBLE EXPRESSO", "/dishes/generated-cache/generated-double-expresso.webp"],
    ["GRAND CAFÉ", "/dishes/generated-cache/generated-grand-cafe.webp"],
    ["CAPPUCCINO", "/dishes/generated-cache/generated-cappuccino.webp"],
    ["LATTE MACCHIATO", "/dishes/generated-cache/generated-latte-macchiato.webp"],
    ["THÉ / INFUSION", "/dishes/generated-cache/generated-infusion.webp"],
    ["DÉCAFINÉ", "/dishes/generated-cache/generated-decafine.webp"],
  ];
  for (const [name, expectedCard] of newlyPromotedGeneratedImages) {
    const actualCard = matchDishKnowledgeImage({ name_original: name })?.card;
    if (Array.isArray(expectedCard)) {
      assert.ok(expectedCard.includes(actualCard), `${name} matched ${actualCard}`);
    } else {
      assert.equal(actualCard, expectedCard);
    }
  }
  assert.equal(
    matchDishKnowledgeImage({ name_original: "TRUFFLE PECORINO FRIES VG DFO" })?.card,
    "/dishes/generated-cache/generated-truffle-pecorino-fries-vg-dfo.webp",
  );
  assert.equal(
    matchDishKnowledgeImage({ name_original: "WAGYU SKEWERS L DF GF" })?.card,
    "/dishes/generated-cache/generated-wagyu-skewers-l-df-gf.webp",
  );
  assert.equal(
    matchDishKnowledgeImage({ name_original: "ANGELOCHU ANCHOVY" })?.card,
    "/dishes/generated-cache/generated-angelachu-anchovy.webp",
  );
  assert.equal(
    matchDishKnowledgeImage({ name_original: "MISO CHICKPEA V.L" })?.card,
    "/dishes/generated-cache/generated-miso-chickpea-vl.webp",
  );
  assert.equal(
    matchDishKnowledgeImage({ name_original: "SYDNEY ROCK OYSTERS, MIGNONETTE LG OF $32/$64" })?.card,
    "/dishes/generated-cache/generated-sydney-rock-oysters-mignonette-lg-of.webp",
  );
  assert.ok([
    "/dishes/generated-cache/generated-sydney-rock-oysters-mignonette-l-gf-df.webp",
    "/dishes/generated-cache/generated-sydney-rock-oysters-mignonette-lg-of.webp",
  ].includes(
    matchDishKnowledgeImage({ name_original: "SYDNEY ROCK OYSTERS, MIGNONETTE" })?.card,
  ));
  assert.notEqual(
    matchDishKnowledgeImage({ name_original: "PROSCIUTTO GFO DF" })?.id,
    "prosciutto-e-melone",
  );
});

test("generated image promotion script reports unpromoted unstable files with safe next actions", async () => {
  const promoteScript = await readFile(`${ROOT}/scripts/promote-generated-dish-images.mjs`, "utf8");
  assert.match(promoteScript, /--unstable-report/);
  assert.match(promoteScript, /already_promoted_source_files/);
  assert.match(promoteScript, /total_unstable_unpromoted/);
  assert.match(promoteScript, /unstable_unpromoted_items/);
  assert.match(promoteScript, /already_promoted_source_file/);
  assert.match(promoteScript, /manual_visual_review_then_restore_task_evidence_or_backfill_knowledge/);

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/promote-generated-dish-images.mjs", "--unstable-report", "--limit=12"],
    { cwd: ROOT, timeout: 30_000 },
  );
  const report = JSON.parse(stdout);
  assert.ok(report.audit.total_generated_files >= report.unstable_report.total_unstable_unpromoted);
  assert.ok(report.audit.already_promoted_source_files >= 0);
  assert.equal(
    report.audit.total_generated_files,
    report.audit.already_promoted_source_files + report.unstable_report.total_unstable_unpromoted,
  );
  assert.ok(report.unstable_report.total_unstable_unpromoted >= report.unstable_report.items.length);
  assert.ok(report.unstable_report.items.length <= 12);
  assert.equal(report.unstable_report.items.some((item) => item.status === "already_promoted_source_file"), false);
  assert.ok(report.unstable_report.items.every((item) => item.storage_id && item.next_action));
});

test("generated image promotion script can render a visual review contact sheet", async () => {
  const promoteScript = await readFile(`${ROOT}/scripts/promote-generated-dish-images.mjs`, "utf8");
  assert.match(promoteScript, /--contact-sheet=/);
  assert.match(promoteScript, /buildReviewCandidates/);
  assert.match(promoteScript, /renderContactSheet/);
  assert.match(promoteScript, /review_candidates/);
  assert.match(promoteScript, /manual_visual_review_contact_sheet/);

  const contactSheetPath = "/tmp/dishlens-generated-review-test.png";
  await rm(contactSheetPath, { force: true });
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/promote-generated-dish-images.mjs",
      "--unstable-report",
      "--limit=4",
      `--contact-sheet=${contactSheetPath}`,
    ],
    { cwd: ROOT, timeout: 30_000 },
  );
  const report = JSON.parse(stdout);
  assert.equal(report.contact_sheet.path, contactSheetPath);
  assert.ok(report.contact_sheet.items >= 1);
  assert.ok(report.unstable_report.review_candidates.length >= report.contact_sheet.items);
  assert.ok(report.unstable_report.review_candidates.every((item) => item.thumbnail_path && item.candidate_name));
  const written = await stat(contactSheetPath);
  assert.ok(written.size > 10_000);
});

test("visual-reviewed unmapped generated images can be explicitly promoted", async () => {
  const { matchDishKnowledgeImage } = await loadTsModule(
    `${ROOT}/src/lib/dish-image-match.ts`,
  );
  const promoteScript = await readFile(`${ROOT}/scripts/promote-generated-dish-images.mjs`, "utf8");
  assert.match(promoteScript, /--reviewed-ids=/);
  assert.match(promoteScript, /buildReviewedCandidateItems/);
  assert.match(promoteScript, /manual_visual_review_verified/);
  assert.match(promoteScript, /categoryForPromotionName/);

  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/promote-generated-dish-images.mjs",
      "--reviewed-ids=generated-pan-seared-salmon,generated-panko-crumbed-calamari",
      "--verbose",
    ],
    { cwd: ROOT, timeout: 30_000 },
  );
  const report = JSON.parse(stdout);
  assert.equal(report.summary.reviewed_candidates, 2);
  assert.equal(report.summary.would_promote + report.summary.already_indexed, 2);
  assert.equal(
    report.results.find((item) => item.storage_id === "generated-pan-seared-salmon")?.name_original,
    "Pan Seared Salmon",
  );
  assert.equal(
    report.results.find((item) => item.storage_id === "generated-panko-crumbed-calamari")?.card,
    "/dishes/generated-cache/generated-panko-crumbed-calamari.webp",
  );

  for (const [name, expectedCard] of [
    ["Pan Fried Japanese Hokkaido Sea Scallops", "/dishes/generated-cache/generated-pan-fried-japanese-hokkaido-sea-scallops.webp"],
    ["Pan Seared Salmon", "/dishes/generated-cache/generated-pan-seared-salmon.webp"],
    ["Panko Crumbed Calamari", "/dishes/generated-cache/generated-panko-crumbed-calamari.webp"],
    ["Pepperoni", "/dishes/generated-cache/generated-pepperoni.webp"],
    ["Portuguese Chicken Breast", "/dishes/generated-cache/generated-portuguese-chicken-breast.webp"],
    ["Prawn Soup", "/dishes/generated-cache/generated-prawn-soup.webp"],
    ["Pugliese", "/dishes/generated-cache/generated-pugliese.webp"],
    ["Rice Balls", "/dishes/generated-cache/generated-rice-balls.webp"],
    ["Roasted Baby Vegetables", "/dishes/generated-cache/generated-roasted-baby-vegetables.webp"],
    ["Roasted Lamb Rack", "/dishes/generated-cache/generated-roasted-lamb-rack.webp"],
    ["Sicilian", "/dishes/generated-cache/generated-sicilian.webp"],
    ["Smoked Chicken", "/dishes/generated-cache/generated-smoked-chicken.webp"],
    ["Smoked Mushroom", "/dishes/generated-cache/generated-smoked-mushroom.webp"],
    ["Funghetto", "/dishes/generated-cache/generated-funghetto.webp"],
    ["Mungindi Rib Eye", "/dishes/generated-cache/generated-mungindi-rib-eye.webp"],
    ["Pappardelle Boscaiola", "/dishes/generated-cache/generated-pappardelle-boscaiola.webp"],
    ["Pappardelle", "/dishes/generated-cache/generated-pappardelle.webp"],
    ["Seared Kangaroo", "/dishes/generated-cache/generated-seared-kangaroo.webp"],
    ["Soup Of The Day", "/dishes/generated-cache/generated-soup-of-the-day.webp"],
    ["Spaghetti", "/dishes/generated-cache/generated-spaghetti.webp"],
    ["Spinach Salad", "/dishes/generated-cache/generated-spinach-salad.webp"],
    ["Tassie Salmon", "/dishes/generated-cache/generated-tassie-salmon.webp"],
    ["Tatin Tart", "/dishes/generated-cache/generated-tatin-tart.webp"],
    ["Teriyaki Rare Beef Salad", "/dishes/generated-cache/generated-teriyaki-rare-beef-salad.webp"],
    ["Vanilla Ice Cream", "/dishes/generated-cache/generated-vanilla-ice-cream.webp"],
    ["Vegetable Curry", "/dishes/generated-cache/generated-vegetable-curry.webp"],
  ]) {
    assert.equal(matchDishKnowledgeImage({ name_original: name })?.card, expectedCard);
  }
});

test("visual-review rejected runtime images are blocked from future contact sheets", async () => {
  const promoteScript = await readFile(`${ROOT}/scripts/promote-generated-dish-images.mjs`, "utf8");
  for (const storageId of [
    "generated-albacore-tuna-lof",
    "generated-beef-steak",
    "generated-bottle",
    "generated-borgo-signature",
    "generated-bread-roll",
    "generated-caesar",
    "generated-capriccioza",
    "generated-cheesy-garlic-bread",
    "generated-chicken-piccata",
    "generated-dessert",
    "generated-desserts",
    "generated-drinks",
    "generated-heirloom-tomato-lvg",
    "generated-la-burrata-du-moment-l-inspiration-du-chef-mauro",
    "generated-long-paddock-driftwood-lgeo",
    "generated-main-course",
    "generated-main-courses",
    "generated-marinara",
  ]) {
    assert.match(promoteScript, new RegExp(storageId));
  }

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/promote-generated-dish-images.mjs", "--unstable-report", "--limit=40"],
    { cwd: ROOT, timeout: 30_000 },
  );
  const report = JSON.parse(stdout);
  const candidateIds = new Set(
    report.unstable_report.review_candidates.map((item) => item.storage_id),
  );
  for (const storageId of [
    "generated-albacore-tuna-lof",
    "generated-beef-steak",
    "generated-bottle",
    "generated-borgo-signature",
    "generated-bread-roll",
    "generated-caesar",
    "generated-capriccioza",
    "generated-cheesy-garlic-bread",
    "generated-chicken-piccata",
    "generated-dessert",
    "generated-desserts",
    "generated-drinks",
    "generated-heirloom-tomato-lvg",
    "generated-la-burrata-du-moment-l-inspiration-du-chef-mauro",
    "generated-long-paddock-driftwood-lgeo",
    "generated-main-course",
    "generated-main-courses",
    "generated-marinara",
  ]) {
    assert.equal(candidateIds.has(storageId), false, `${storageId} should stay out of contact sheets`);
  }
});

test("visually reviewed runtime images are reusable as stable generated-cache dish images", async () => {
  const { matchDishKnowledgeImage } = await loadTsModule(
    `${ROOT}/src/lib/dish-image-match.ts`,
  );

  const reviewedImages = [
    ["Battered Onion Rings", "/dishes/generated-cache/generated-battered-onion-rings.webp"],
    ["Chicken Wings", "/dishes/generated-cache/generated-chicken-wings.webp"],
    ["Crispy Fried Calamari", "/dishes/generated-cache/generated-crispy-fried-calamari.webp"],
    ["Egyptian Falafels", "/dishes/generated-cache/generated-egyptian-falafels.webp"],
    ["Garlic Prawns", "/dishes/generated-cache/generated-garlic-prawns.webp"],
    ["Grilled Salmon", "/dishes/generated-cache/generated-grilled-salmon.webp"],
    ["Italian Ice", "/dishes/generated-cache/generated-italian-ice.webp"],
  ];

  for (const [name, expectedCard] of reviewedImages) {
    assert.equal(matchDishKnowledgeImage({ name_original: name })?.card, expectedCard);
  }
});

test("contact-sheet reviewed runtime images are stabilized without duplicating existing knowledge images", async () => {
  const { matchDishKnowledgeImage } = await loadTsModule(
    `${ROOT}/src/lib/dish-image-match.ts`,
  );

  const reviewedGeneratedImages = [
    ["Ai Funghi", "/dishes/generated-cache/generated-ai-funghi.webp"],
    ["Artichoke Dip", "/dishes/generated-cache/generated-artichoke-dip.webp"],
    ["Battered Whiting", "/dishes/generated-cache/generated-battered-whiting.webp"],
    ["Bigspicy Chicken Wrap", "/dishes/generated-cache/generated-bigspicy-chicken-wrap.webp"],
    ["Blette A La Ligure", "/dishes/generated-cache/generated-blette-a-la-ligure.webp"],
    ["Braised Pork Belly", "/dishes/generated-cache/generated-braised-pork-belly.webp"],
    ["Cafe Gourmand", "/dishes/generated-cache/generated-cafe-gourmand.webp"],
    ["Cauliflower Aged Cheddar Croquettes", "/dishes/generated-cache/generated-cauliflower-aged-cheddar-croquettes.webp"],
  ];

  for (const [name, expectedCard] of reviewedGeneratedImages) {
    assert.equal(matchDishKnowledgeImage({ name_original: name })?.card, expectedCard);
  }

  assert.equal(matchDishKnowledgeImage({ name_original: "Risotto ai Funghi Porcini" })?.id, "risotto-ai-funghi");
  assert.equal(matchDishKnowledgeImage({ name_original: "Caesar" })?.id, "caesar-salad");
  assert.equal(matchDishKnowledgeImage({ name_original: "Capriccioza" })?.id, "pizza-capricciosa");
});

test("second contact-sheet reviewed runtime images are promoted only for specific safe dishes", async () => {
  const { matchDishKnowledgeImage } = await loadTsModule(
    `${ROOT}/src/lib/dish-image-match.ts`,
  );

  const reviewedGeneratedImages = [
    ["Cheese Bombs", "/dishes/generated-cache/generated-cheese-bombs.webp"],
    ["Chef Salad", "/dishes/generated-cache/generated-chef-salad.webp"],
    ["Chicken Maharaja Mac", "/dishes/generated-cache/generated-chicken-maharaja-mac.webp"],
    ["Crumbed Lamb Loin Chops", "/dishes/generated-cache/generated-crumbed-lamb-loin-chops.webp"],
    ["Espresso", "/dishes/generated-cache/generated-espresso.webp"],
    ["Eye Fillet", "/dishes/generated-cache/generated-eye-fillet.webp"],
    ["Farfalle", "/dishes/generated-cache/generated-farfalle.webp"],
    ["Field Greens With Balsamic Vinaigrette", "/dishes/generated-cache/generated-field-greens-with-balsamic-vinaigrette.webp"],
    ["Filet O Fish", "/dishes/generated-cache/generated-filet-o-fish.webp"],
    ["Fisherman S Basket", "/dishes/generated-cache/generated-fisherman-s-basket.webp"],
  ];

  for (const [name, expectedCard] of reviewedGeneratedImages) {
    assert.equal(matchDishKnowledgeImage({ name_original: name })?.card, expectedCard);
  }

  assert.notEqual(
    matchDishKnowledgeImage({ name_original: "Beef Steak" })?.card,
    "/dishes/generated-cache/generated-beef-steak.webp",
  );
  assert.notEqual(
    matchDishKnowledgeImage({ name_original: "Dessert" })?.card,
    "/dishes/generated-cache/generated-dessert.webp",
  );
  assert.notEqual(
    matchDishKnowledgeImage({ name_original: "Drinks" })?.card,
    "/dishes/generated-cache/generated-drinks.webp",
  );
});

test("third contact-sheet reviewed runtime images add common overseas quick-order dishes", async () => {
  const { matchDishKnowledgeImage } = await loadTsModule(
    `${ROOT}/src/lib/dish-image-match.ts`,
  );

  const reviewedGeneratedImages = [
    ["Coffee Tea", "/dishes/generated-cache/generated-coffee-tea.webp"],
    ["Garlic Bread", "/dishes/generated-cache/generated-garlic-bread.webp"],
    ["Green Tea", "/dishes/generated-cache/generated-green-tea.webp"],
    ["Grilled Chicken Breast", "/dishes/generated-cache/generated-grilled-chicken-breast.webp"],
    ["House Salad", "/dishes/generated-cache/generated-house-salad.webp"],
    ["Iceburg Salad", "/dishes/generated-cache/generated-iceburg-salad.webp"],
    ["Iceberg Salad", "/dishes/generated-cache/generated-iceburg-salad.webp"],
    ["Kanelone", "/dishes/generated-cache/generated-kanelone.webp"],
    ["Cannelloni", "/dishes/generated-cache/generated-kanelone.webp"],
    ["Linguine Pesto", "/dishes/generated-cache/generated-linguine-pesto.webp"],
    ["Mcchicken", "/dishes/generated-cache/generated-mcchicken.webp"],
  ];

  for (const [name, expectedCard] of reviewedGeneratedImages) {
    assert.equal(matchDishKnowledgeImage({ name_original: name })?.card, expectedCard);
  }

  assert.equal(matchDishKnowledgeImage({ name_original: "ALBACORE TUNA L DF" })?.id, "albacore-tuna-soba");
  assert.notEqual(
    matchDishKnowledgeImage({ name_original: "Marinara" })?.card,
    "/dishes/generated-cache/generated-marinara.webp",
  );
  assert.notEqual(
    matchDishKnowledgeImage({ name_original: "Main Course" })?.card,
    "/dishes/generated-cache/generated-main-course.webp",
  );
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
  assert.equal(matchDishKnowledgeImage(spicyWrapMeal)?.card, "/dishes/generated-cache/generated-bigspicy-paneer-wrap.webp");
  assert.equal(matchDishKnowledgeImage(mcpaneerMeal)?.card, "/dishes/generated-cache/generated-mcspicy-paneer.webp");
  assert.notEqual(matchDishKnowledgeImage(spicyWrapMeal)?.id, "paneer-tikka");
  assert.notEqual(matchDishKnowledgeImage(mcpaneerMeal)?.id, "paneer-tikka");
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

test("dish image prompts keep biryani from becoming curry over plain rice", async () => {
  const { buildDishImagePrompt } = await loadTsModule(
    `${ROOT}/src/lib/ai/image-gen.ts`,
  );

  const prompt = buildDishImagePrompt({
    name_original: "Lamb Biryani",
    name_translated: { zh: "羊肉比尔亚尼饭" },
    description: { zh: "印度香料羊肉焖饭，长粒米饭和羊肉分层焖制。" },
    ingredients: ["羊肉", "巴斯马蒂米", "藏红花", "香料", "炸洋葱"],
    category: "rice",
  });

  assert.match(prompt, /biryani/i);
  assert.match(prompt, /long-grain basmati rice/i);
  assert.match(prompt, /layered/i);
  assert.match(prompt, /not curry poured over plain white rice/i);
});

test("dish image prompts keep bubble tea cups unbranded and text-free", async () => {
  const { buildDishImagePrompt } = await loadTsModule(
    `${ROOT}/src/lib/ai/image-gen.ts`,
  );

  const prompt = buildDishImagePrompt({
    name_original: "Bubble Tea",
    name_translated: { zh: "珍珠奶茶" },
    description: { zh: "奶茶配黑糖珍珠，冷饮。" },
    ingredients: ["奶茶", "黑糖珍珠", "冰块"],
    category: "drink",
  });

  assert.match(prompt, /black tapioca pearls/i);
  assert.match(prompt, /transparent unbranded cup/i);
  assert.match(prompt, /no printed text on the cup/i);
  assert.match(prompt, /no letters/i);
  assert.match(prompt, /no Chinese characters/i);
});

test("dish image prompts keep Inca Cola as a golden unbranded soda instead of dark cola", async () => {
  const { buildDishImagePrompt, classifyDishImageKind } = await loadTsModule(
    `${ROOT}/src/lib/ai/image-gen.ts`,
  );

  const dish = {
    name_original: "Inca Cola",
    name_translated: { zh: "印加可乐" },
    description: { zh: "秘鲁常见的金黄色甜味汽水。" },
    category: "drink",
  };
  const prompt = buildDishImagePrompt(dish);

  assert.equal(classifyDishImageKind(dish), "drink");
  assert.match(prompt, /golden-yellow|bright yellow|yellow soda/i);
  assert.match(prompt, /unbranded/i);
  assert.match(prompt, /not dark cola|not brown cola/i);
});

test("dish image prompts keep katsudon as an egg-bound pork cutlet rice bowl instead of curry", async () => {
  const { buildDishImagePrompt } = await loadTsModule(
    `${ROOT}/src/lib/ai/image-gen.ts`,
  );

  const prompt = buildDishImagePrompt({
    name_original: "Katsudon",
    name_translated: { zh: "炸猪排丼" },
    description: { zh: "炸猪排、洋葱和半熟蛋铺在米饭上。" },
    ingredients: ["炸猪排", "鸡蛋", "洋葱", "米饭"],
    category: "rice",
  });

  assert.match(prompt, /egg-bound|soft-cooked egg|onion/i);
  assert.match(prompt, /pork cutlet rice bowl|tonkatsu rice bowl/i);
  assert.match(prompt, /not curry|no curry sauce/i);
});

test("dish image prompts keep oyakodon as a chicken and egg rice bowl", async () => {
  const { buildDishImagePrompt } = await loadTsModule(
    `${ROOT}/src/lib/ai/image-gen.ts`,
  );

  const prompt = buildDishImagePrompt({
    name_original: "Oyakodon",
    name_translated: { zh: "亲子丼" },
    description: { zh: "鸡肉、洋葱和半熟蛋铺在米饭上。" },
    ingredients: ["鸡肉", "鸡蛋", "洋葱", "米饭"],
    category: "rice",
  });

  assert.match(prompt, /chicken and egg rice bowl|oyakodon/i);
  assert.match(prompt, /soft-cooked egg|onion|steamed white rice/i);
  assert.match(prompt, /not noodles|not soba/i);
});

test("dish image prompts keep Ramune as a clear Japanese soda bottle", async () => {
  const { buildDishImagePrompt, classifyDishImageKind } = await loadTsModule(
    `${ROOT}/src/lib/ai/image-gen.ts`,
  );

  const dish = {
    name_original: "Ramune",
    name_translated: { zh: "波子汽水" },
    description: { zh: "带弹珠瓶塞的日本透明汽水。" },
    category: "drink",
  };
  const prompt = buildDishImagePrompt(dish);

  assert.equal(classifyDishImageKind(dish), "drink");
  assert.match(prompt, /clear Japanese soda|Codd-neck bottle|glass marble/i);
  assert.match(prompt, /not pink cocktail|not fruit juice/i);
});

test("dish image prompts keep foul moudammas from becoming hummus", async () => {
  const { buildDishImagePrompt } = await loadTsModule(
    `${ROOT}/src/lib/ai/image-gen.ts`,
  );

  const prompt = buildDishImagePrompt({
    name_original: "Foul Moudammas",
    name_translated: { zh: "蚕豆泥" },
    description: { zh: "中东早餐，用整颗蚕豆慢炖，配橄榄油、柠檬、番茄和欧芹。" },
    ingredients: ["蚕豆", "橄榄油", "柠檬", "番茄", "欧芹"],
    category: "breakfast",
  });

  assert.match(prompt, /whole fava beans/i);
  assert.match(prompt, /stewed beans/i);
  assert.match(prompt, /not hummus/i);
  assert.match(prompt, /not a smooth chickpea puree/i);
});

test("dish image prompts keep gaji namul visually identifiable as eggplant", async () => {
  const { buildDishImagePrompt } = await loadTsModule(
    `${ROOT}/src/lib/ai/image-gen.ts`,
  );

  const prompt = buildDishImagePrompt({
    name_original: "Gaji Namul",
    name_translated: { zh: "韩式拌茄子" },
    description: { zh: "蒸熟茄子撕成条，以酱油、蒜、芝麻油和葱拌匀。" },
    ingredients: ["茄子", "酱油", "蒜", "芝麻油", "葱", "芝麻"],
    category: "side",
  });

  assert.match(prompt, /short chunky steamed eggplant pieces/i);
  assert.match(prompt, /purple eggplant skin/i);
  assert.match(prompt, /pale beige eggplant flesh/i);
  assert.match(prompt, /not kimchi/i);
  assert.match(prompt, /not noodles/i);
  assert.match(prompt, /not orange-red sauce/i);
});

test("dish image prompts keep Korean sundae as blood sausage, not dessert or salami", async () => {
  const { buildDishImagePrompt } = await loadTsModule(
    `${ROOT}/src/lib/ai/image-gen.ts`,
  );

  const prompt = buildDishImagePrompt({
    name_original: "Sundae",
    name_translated: { zh: "韩式血肠" },
    description: { zh: "韩国街头小吃，猪肠衣内填糯米、粉丝和猪血，切片后蘸盐食用。" },
    ingredients: ["猪血", "糯米", "粉丝", "猪肠衣", "盐"],
    category: "side",
  });

  assert.match(prompt, /Korean blood sausage|soondae/i);
  assert.match(prompt, /dark purple-brown|sticky rice|glass noodles/i);
  assert.match(prompt, /not salami|not cured sausage/i);
  assert.match(prompt, /not ice cream sundae/i);
});

test("dish image prompts keep birria tacos as tacos with consomme, not stew", async () => {
  const { buildDishImagePrompt } = await loadTsModule(
    `${ROOT}/src/lib/ai/image-gen.ts`,
  );

  const prompt = buildDishImagePrompt({
    name_original: "Birria Tacos",
    name_translated: { zh: "比尔里亚炖牛肉塔可" },
    description: { zh: "玉米饼夹慢炖牛肉和融化奶酪，配一小碗蘸汤。" },
    ingredients: ["玉米饼", "炖牛肉", "奶酪", "洋葱", "香菜", "蘸汤"],
    category: "main",
  });

  assert.match(prompt, /folded corn tortillas|tacos/i);
  assert.match(prompt, /consomme|dipping broth/i);
  assert.match(prompt, /not rolled wraps|not rolled cylinders/i);
  assert.match(prompt, /not a bowl of stew|not soup/i);
});

test("dish image prompts keep signature soups and noodles visually specific", async () => {
  const { buildDishImagePrompt, classifyDishImageKind } = await loadTsModule(
    `${ROOT}/src/lib/ai/image-gen.ts`,
  );

  const khaoSoiPrompt = buildDishImagePrompt({
    name_original: "Khao Soi",
    name_translated: { zh: "泰北金面" },
    description: { zh: "椰香咖喱汤面，配鸡腿、鸡蛋面和炸脆面。" },
    ingredients: ["coconut curry broth", "egg noodles", "crispy noodles", "chicken drumstick"],
    category: "noodle",
  });
  assert.equal(classifyDishImageKind({ name_original: "Khao Soi", category: "noodle" }), "main");
  assert.match(khaoSoiPrompt, /northern Thai coconut curry noodle soup/i);
  assert.match(khaoSoiPrompt, /crispy fried egg noodles/i);
  assert.match(khaoSoiPrompt, /not scrambled eggs/i);
  assert.match(khaoSoiPrompt, /not generic ramen/i);

  const lentilPrompt = buildDishImagePrompt({
    name_original: "Mercimek Çorbası",
    name_translated: { zh: "土耳其红扁豆汤" },
    description: { zh: "顺滑的红扁豆浓汤，配柠檬和辣椒油。" },
    ingredients: ["red lentils", "lemon", "paprika butter"],
    category: "soup",
  });
  assert.equal(classifyDishImageKind({ name_original: "Turkish Lentil Soup", category: "soup" }), "soup");
  assert.match(lentilPrompt, /smooth orange-red pureed lentil soup/i);
  assert.match(lentilPrompt, /lemon wedge/i);
  assert.match(lentilPrompt, /not a chunky bean stew/i);
  assert.match(lentilPrompt, /not chili con carne/i);

  const tteokgukPrompt = buildDishImagePrompt({
    name_original: "Tteokguk",
    name_translated: { zh: "年糕汤" },
    description: { zh: "韩国清汤年糕汤，配蛋丝、葱花和海苔。" },
    ingredients: ["椭圆年糕片", "牛肉清汤", "鸡蛋丝", "葱花", "海苔"],
    category: "soup",
  });
  assert.match(tteokgukPrompt, /oval rice cake slices|sliced rice cakes/i);
  assert.match(tteokgukPrompt, /clear or milky-white broth|pale broth/i);
  assert.match(tteokgukPrompt, /egg ribbons|scallions|seaweed/i);
  assert.match(tteokgukPrompt, /not red spicy soup|not noodles|not ramen/i);

  const yukgaejangPrompt = buildDishImagePrompt({
    name_original: "Yukgaejang",
    name_translated: { zh: "辣牛肉汤" },
    description: { zh: "韩国辣牛肉汤，配手撕牛肉、葱段、蕨菜和豆芽。" },
    ingredients: ["shredded beef", "scallions", "fernbrake", "bean sprouts", "red chili broth"],
    category: "soup",
  });
  assert.equal(classifyDishImageKind({ name_original: "Yukgaejang", category: "soup" }), "soup");
  assert.match(yukgaejangPrompt, /Korean spicy beef soup|yukgaejang/i);
  assert.match(yukgaejangPrompt, /shredded beef|scallions|fernbrake|bean sprouts/i);
  assert.match(yukgaejangPrompt, /not noodles|not ramen|not udon/i);
  assert.match(yukgaejangPrompt, /no long white noodle-like strands|not vermicelli/i);
});

test("dish image prompts keep regional mains from collapsing into pizza or generic soup", async () => {
  const { buildDishImagePrompt } = await loadTsModule(
    `${ROOT}/src/lib/ai/image-gen.ts`,
  );

  const rfissaPrompt = buildDishImagePrompt({
    name_original: "Rfissa",
    name_translated: { zh: "摩洛哥鸡肉薄饼" },
    description: { zh: "炖鸡、扁豆和香料浇在撕碎薄饼上。" },
    ingredients: ["chicken", "lentils", "shredded msemen flatbread", "fenugreek", "broth"],
    category: "main",
  });
  assert.match(rfissaPrompt, /Moroccan chicken dish served over shredded msemen/i);
  assert.match(rfissaPrompt, /torn flatbread strips/i);
  assert.match(rfissaPrompt, /not pizza/i);
  assert.match(rfissaPrompt, /not a round baked flatbread/i);

  const shabuPrompt = buildDishImagePrompt({
    name_original: "Shabu-Shabu",
    name_translated: { zh: "涮涮锅" },
    description: { zh: "薄切牛肉、白菜、豆腐和蘑菇在清汤锅中涮煮。" },
    ingredients: ["thinly sliced beef", "hot pot broth", "tofu", "napa cabbage", "mushrooms"],
    category: "main",
  });
  assert.match(shabuPrompt, /Japanese hot pot/i);
  assert.match(shabuPrompt, /thinly sliced raw beef/i);
  assert.match(shabuPrompt, /tabletop pot/i);
  assert.match(shabuPrompt, /not noodle soup/i);

  const saltimboccaPrompt = buildDishImagePrompt({
    name_original: "Saltimbocca alla Romana",
    name_translated: { zh: "罗马跳嘴肉" },
    description: { zh: "小牛肉片配帕尔马火腿和鼠尾草，白葡萄酒黄油汁。" },
    ingredients: ["thin veal cutlets", "prosciutto", "sage", "white wine butter sauce"],
    category: "main",
  });
  assert.match(saltimboccaPrompt, /thin veal cutlets|thin veal scallopini/i);
  assert.match(saltimboccaPrompt, /wide flat|flat irregular|flattened/i);
  assert.match(saltimboccaPrompt, /prosciutto/i);
  assert.match(saltimboccaPrompt, /sage/i);
  assert.match(saltimboccaPrompt, /not thick beef steak|not thick steak/i);
  assert.match(saltimboccaPrompt, /not round medallions|not rolled meat rounds/i);
});

test("dish image prompts keep calzone as a folded sealed pizza, not a round pizza slice", async () => {
  const { buildDishImagePrompt, classifyDishImageKind } = await loadTsModule(
    `${ROOT}/src/lib/ai/image-gen.ts`,
  );

  const dish = {
    name_original: "Calzone",
    name_translated: { zh: "折叠披萨" },
    description: { zh: "半月形折叠披萨，内含奶酪和番茄酱。" },
    ingredients: ["pizza dough", "mozzarella", "tomato sauce", "ham"],
    category: "pizza",
  };
  const prompt = buildDishImagePrompt(dish);

  assert.equal(classifyDishImageKind(dish), "pizza");
  assert.match(prompt, /folded sealed pizza|half-moon/i);
  assert.match(prompt, /crimped edge|sealed edge/i);
  assert.match(prompt, /not a round pizza|not a pizza slice/i);
});

test("dish image prompts keep regional wrapped dishes from collapsing into pizza or burritos", async () => {
  const { buildDishImagePrompt } = await loadTsModule(
    `${ROOT}/src/lib/ai/image-gen.ts`,
  );

  const beytiPrompt = buildDishImagePrompt({
    name_original: "Beyti Kebab",
    name_translated: { zh: "贝伊提烤肉" },
    description: { zh: "土耳其烤肉卷切段，配番茄黄油酱和酸奶。" },
    ingredients: ["minced lamb", "lavash", "tomato butter sauce", "yogurt"],
    category: "main",
  });
  assert.match(beytiPrompt, /lavash flatbread/i);
  assert.match(beytiPrompt, /sliced into thick round segments/i);
  assert.match(beytiPrompt, /tomato butter sauce/i);
  assert.match(beytiPrompt, /not pizza/i);
  assert.match(beytiPrompt, /not burrito/i);

  const boLaLotPrompt = buildDishImagePrompt({
    name_original: "Bo La Lot",
    name_translated: { zh: "蒌叶牛肉卷" },
    description: { zh: "越南蒌叶包牛肉炭烤，配米粉和鱼露。" },
    ingredients: ["beef", "betel leaves", "rice vermicelli", "fish sauce"],
    category: "appetizer",
  });
  assert.match(boLaLotPrompt, /beef wrapped in betel leaves/i);
  assert.match(boLaLotPrompt, /dark-green glossy cylindrical leaf-wrapped rolls/i);
  assert.match(boLaLotPrompt, /not steamed banana leaf parcels/i);
  assert.match(boLaLotPrompt, /not zongzi/i);

  const bossamPrompt = buildDishImagePrompt({
    name_original: "Bossam",
    name_translated: { zh: "韩式水煮五花肉" },
    description: { zh: "水煮五花肉片，搭配白菜叶、紫苏叶、泡菜和蘸酱。" },
    ingredients: ["boiled pork belly", "napa cabbage", "perilla leaves", "kimchi", "ssamjang"],
    category: "main",
  });
  assert.match(bossamPrompt, /thick pale tender slices/i);
  assert.match(bossamPrompt, /napa cabbage leaves/i);
  assert.match(bossamPrompt, /ssamjang/i);
  assert.match(bossamPrompt, /not burrito/i);
  assert.match(bossamPrompt, /not grilled pork belly barbecue/i);

  const onigiriPrompt = buildDishImagePrompt({
    name_original: "Onigiri",
    name_translated: { zh: "日式饭团" },
    description: { zh: "白米饭捏成三角形，外包海苔。" },
    ingredients: ["white rice", "nori seaweed"],
    category: "street-food",
  });
  assert.match(onigiriPrompt, /Japanese rice ball/i);
  assert.match(onigiriPrompt, /triangular/i);
  assert.match(onigiriPrompt, /nori seaweed/i);
  assert.match(onigiriPrompt, /not arancini/i);
  assert.match(onigiriPrompt, /not sushi rolls/i);

  const temakiPrompt = buildDishImagePrompt({
    name_original: "Temaki",
    name_translated: { zh: "手卷" },
    description: { zh: "海苔卷成锥形，里面有寿司饭、鱼生、黄瓜和牛油果。" },
    ingredients: ["nori seaweed", "sushi rice", "salmon", "cucumber", "avocado"],
    category: "main",
  });
  assert.match(temakiPrompt, /cone-shaped|open cone/i);
  assert.match(temakiPrompt, /resting diagonally|diagonal tapered cone/i);
  assert.match(temakiPrompt, /nori seaweed/i);
  assert.match(temakiPrompt, /open wide top|visible filling/i);
  assert.match(temakiPrompt, /not maki rolls|not rectangular/i);
  assert.match(temakiPrompt, /not closed rectangular sushi blocks|not closed sushi logs/i);
  assert.match(temakiPrompt, /not cylindrical sushi roll|not seaweed cup/i);
  assert.match(temakiPrompt, /not standing vertical|not upright cylinder/i);
  assert.doesNotMatch(temakiPrompt, /single upright cone|upright cone/i);
});

test("dish image prompts keep Vietnamese rice paper salad from becoming ordinary cabbage salad", async () => {
  const { buildDishImagePrompt } = await loadTsModule(
    `${ROOT}/src/lib/ai/image-gen.ts`,
  );

  const prompt = buildDishImagePrompt({
    name_original: "Bánh Tráng Trộn",
    name_translated: { zh: "越南米纸沙拉" },
    description: { zh: "剪成细条的米纸，拌青芒、香草、花生、虾米和鹌鹑蛋。" },
    ingredients: ["rice paper strips", "green mango", "dried shrimp", "quail egg", "peanuts", "Vietnamese herbs"],
    category: "street-food",
  });

  assert.match(prompt, /Vietnamese mixed rice paper salad/i);
  assert.match(prompt, /thin translucent rice paper strips/i);
  assert.match(prompt, /green mango|dried shrimp|quail egg|peanuts/i);
  assert.match(prompt, /not cabbage salad|not coleslaw/i);
});

test("dish image prompts keep high-frequency overseas dishes visually distinct", async () => {
  const { buildDishImagePrompt } = await loadTsModule(
    `${ROOT}/src/lib/ai/image-gen.ts`,
  );

  const californiaRollPrompt = buildDishImagePrompt({
    name_original: "California Roll",
    name_translated: { zh: "加州卷" },
    description: { zh: "寿司米在外，海苔在内，包蟹柳、牛油果和黄瓜，外层撒芝麻或鱼籽。" },
    ingredients: ["sushi rice", "nori", "imitation crab", "avocado", "cucumber", "sesame"],
    category: "main",
  });
  assert.match(californiaRollPrompt, /inside-out sushi roll/i);
  assert.match(californiaRollPrompt, /cut maki pieces|sliced rounds/i);
  assert.match(californiaRollPrompt, /rice on the outside/i);
  assert.match(californiaRollPrompt, /not temaki|not hand roll/i);
  assert.match(californiaRollPrompt, /not upright cylinder|not seaweed cup/i);
  assert.match(californiaRollPrompt, /not single uncut roll|not sushi log/i);

  const bunChaPrompt = buildDishImagePrompt({
    name_original: "Bún Chả",
    name_translated: { zh: "越式烤肉米粉" },
    description: { zh: "炭烤猪肉搭配细米粉、生菜香草和酸甜鱼露蘸汁。" },
    ingredients: ["grilled pork", "rice vermicelli", "fresh herbs", "lettuce", "nuoc cham"],
    category: "noodle",
  });
  assert.match(bunChaPrompt, /Vietnamese b[uú]n ch[aả]/i);
  assert.match(bunChaPrompt, /rice vermicelli/i);
  assert.match(bunChaPrompt, /grilled pork patties|grilled pork slices/i);
  assert.match(bunChaPrompt, /nuoc cham|dipping sauce/i);
  assert.match(bunChaPrompt, /not rice bowl|not kebab chunks/i);

  const blackPepperCrabPrompt = buildDishImagePrompt({
    name_original: "Black Pepper Crab",
    name_translated: { zh: "黑胡椒螃蟹" },
    description: { zh: "整只螃蟹裹上深色黑胡椒酱，香辣浓郁。" },
    ingredients: ["whole crab", "black pepper", "dark sauce", "butter"],
    category: "main",
  });
  assert.match(blackPepperCrabPrompt, /Singapore black pepper crab/i);
  assert.match(blackPepperCrabPrompt, /dark black pepper sauce|black pepper crust/i);
  assert.match(blackPepperCrabPrompt, /not chili crab|not bright red sauce/i);
  assert.match(blackPepperCrabPrompt, /not orange sauce|not orange-red sauce/i);
});

test("dish image prompts can place critical local-library hints before generic framing", async () => {
  const { buildDishImagePrompt } = await loadTsModule(
    `${ROOT}/src/lib/ai/image-gen.ts`,
  );

  const prompt = buildDishImagePrompt({
    name_original: "California Roll",
    name_translated: { zh: "加州卷" },
    image_prompt_hint: "CRITICAL LOCAL LIBRARY IMAGE: show only eight separate sliced inside-out sushi rounds.",
    ingredients: ["sushi rice", "nori", "imitation crab", "avocado", "cucumber"],
    category: "main",
  });

  assert.match(prompt, /CRITICAL LOCAL LIBRARY IMAGE/i);
  assert.ok(
    prompt.indexOf("CRITICAL LOCAL LIBRARY IMAGE") < prompt.indexOf("Premium"),
    "critical local-library hint should appear before generic category framing",
  );
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

  assert.equal(packageJson.dependencies.sharp, "0.35.3");
  assert.match(imageInput, /DEFAULT_SERVER_IMAGE_MAX_DIM = 1400/);
  assert.match(imageInput, /DEFAULT_SERVER_IMAGE_QUALITY = 76/);
  assert.match(imageInput, /getServerImageMaxDim/);
  assert.match(imageInput, /getServerImageQuality/);
  assert.match(serverNormalization, /export async function normalizeServerMenuImage/);
  assert.match(serverNormalization, /await import\("sharp"\)/);
  assert.match(serverNormalization, /const maxDim = getServerImageMaxDim\(\)/);
  assert.match(serverNormalization, /const quality = getServerImageQuality\(\)/);
  assert.match(serverNormalization, /const metadata = await image\.metadata\(\)/);
  assert.match(serverNormalization, /const exceedsMaxDim = Boolean/);
  assert.match(serverNormalization, /shouldNormalizeClientImage[\s\S]*exceedsMaxDim/);
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

  assert.match(apiClient, /CLIENT_MENU_IMAGE_MAX_DIM = 1400/);
  assert.match(apiClient, /CLIENT_MENU_IMAGE_QUALITY = 0\.82/);
  assert.match(apiClient, /const exceedsMaxDim = width > maxDim \|\| height > maxDim/);
  assert.match(apiClient, /!shouldNormalizeClientImage\(file\) && !exceedsMaxDim/);
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
  assert.match(qwen, /process\.env\.MENU_FAST_FIRST_PASS_MAX_TOKENS \|\| "4096"/);
  assert.match(qwen, /Math\.min\(4096/);
  assert.match(qwen, /QWEN_FAST_VL_MODEL/);
  assert.match(qwen, /QWEN_FAST_FIRST_PASS_MODELS/);
  assert.match(qwen, /function parseFastFirstPassModels/);
  assert.match(qwen, /const fastFirstPassModels = parseFastFirstPassModels\(\)/);
  assert.match(qwen, /Array\.from\(new Set\(\[\.{3}configuredModels,\s*FAST_VL_MODEL,\s*VL_MODEL\]\)\)/);
  assert.match(qwen, /const model = options\.modelOverride \|\| \(fastFirstPass \? fastFirstPassModels\[0\] : VL_MODEL\)/);
  assert.match(qwen, /_model:\s*model/);
  assert.match(qwen, /analyzeWithPrompt\(base64Image,\s*VL_SYSTEM_PROMPT_FAST_FIRST_PASS,\s*mimeType,\s*FAST_FIRST_PASS_MAX_TOKENS,\s*targetLang,\s*\{\s*fastFirstPass:\s*true,\s*modelOverride:\s*model,\s*signal\s*\}\)/);
});

test("cache-miss menu uploads return a task id before server-side normalization", async () => {
  const route = await readFile(`${ROOT}/src/app/api/v1/translate/menu/route.ts`, "utf8");
  const postBody = route.slice(
    route.indexOf("export async function POST"),
    route.indexOf("async function analyzeMenuImageWithEmptyRetry"),
  );

  assert.match(route, /type RawMenuImageInput/);
  assert.match(route, /async function normalizeMenuImagesForProcessing/);
  assert.match(postBody, /const rawImageBuffers = await Promise\.all/);
  assert.match(postBody, /processor\(taskId,\s*rawImageBuffers/);
  assert.doesNotMatch(postBody, /const normalizationStart = Date\.now\(\)[\s\S]*return NextResponse\.json\(\s*\{\s*task_id: taskId,\s*status: "processing"\s*\}/);
});

test("multi-page menu OCR uses higher fast first-pass concurrency without changing full pass concurrency", async () => {
  const route = await readFile(`${ROOT}/src/app/api/v1/translate/menu/route.ts`, "utf8");

  assert.match(route, /const OCR_CONCURRENCY = Math\.max\(/);
  assert.match(route, /MENU_OCR_CONCURRENCY \|\| "2"/);
  assert.match(route, /Math\.min\(3,\s*Number\.parseInt\(process\.env\.MENU_OCR_CONCURRENCY/);
  assert.match(route, /const FAST_FIRST_PASS_OCR_CONCURRENCY = Math\.max\(/);
  assert.match(route, /MENU_FAST_FIRST_PASS_OCR_CONCURRENCY \|\| "3"/);
  assert.match(route, /Math\.min\(4,\s*Number\.parseInt\(process\.env\.MENU_FAST_FIRST_PASS_OCR_CONCURRENCY/);
  assert.match(route, /for \(let batch = 0; batch < imageBuffers\.length; batch \+= FAST_FIRST_PASS_OCR_CONCURRENCY\)/);
  assert.match(route, /const batchItems = firstPassImageBuffers\.slice\(batch,\s*batch \+ FAST_FIRST_PASS_OCR_CONCURRENCY\)/);
  assert.match(route, /for \(let batch = 0; batch < imageBuffers\.length; batch \+= OCR_CONCURRENCY\)/);
  assert.match(route, /const batchItems = imageBuffers\.slice\(batch,\s*batch \+ OCR_CONCURRENCY\)/);
  assert.match(route, /await Promise\.all\(/);
});

test("fast overseas recognition returns a lightweight first result before enrichment", async () => {
  const qwen = await readFile(`${ROOT}/src/lib/ai/qwen.ts`, "utf8");
  const aiIndex = await readFile(`${ROOT}/src/lib/ai/index.ts`, "utf8");
  const route = await readFile(`${ROOT}/src/app/api/v1/translate/menu/route.ts`, "utf8");

  assert.match(qwen, /VL_SYSTEM_PROMPT_FAST_FIRST_PASS/);
  assert.match(qwen, /export async function analyzeMenuImageFast/);
  assert.match(qwen, /const FAST_VL_MODEL = process\.env\.QWEN_FAST_VL_MODEL \|\| "qwen-vl-plus"/);
  assert.match(qwen, /const fastFirstPassModels = parseFastFirstPassModels\(\)/);
  assert.match(qwen, /process\.env\.QWEN_FAST_FIRST_PASS_MODELS/);
  assert.match(qwen, /MENU_FAST_FIRST_PASS_ATTEMPT_TIMEOUT_MS/);
  assert.match(qwen, /MENU_FAST_FIRST_PASS_ATTEMPT_TIMEOUT_MS \|\| "30000"/);
  assert.match(qwen, /FAST_FIRST_PASS_ATTEMPT_TIMEOUT_MS/);
  assert.match(qwen, /function withFastFirstPassAttemptTimeout/);
  assert.match(qwen, /const controller = new AbortController\(\)/);
  assert.match(qwen, /controller\.abort\(\)/);
  assert.match(qwen, /clearTimeout\(timeout\)/);
  assert.match(qwen, /MENU_FAST_FIRST_PASS_MAX_TOKENS \|\| "4096"/);
  assert.match(qwen, /Math\.min\(4096,\s*Number\.parseInt\(process\.env\.MENU_FAST_FIRST_PASS_MAX_TOKENS/s);
  assert.match(qwen, /modelOverride:\s*model/);
  assert.match(qwen, /withFastFirstPassAttemptTimeout\(\s*\(signal\)\s*=>\s*analyzeWithPrompt\(base64Image,\s*VL_SYSTEM_PROMPT_FAST_FIRST_PASS,\s*mimeType,\s*FAST_FIRST_PASS_MAX_TOKENS,\s*targetLang,\s*\{\s*fastFirstPass:\s*true,\s*modelOverride:\s*model,\s*signal\s*\}\),\s*model\s*\)/);
  assert.match(qwen, /getQwenClient\(\)\.chat\.completions\.create\([\s\S]*\{\s*signal:\s*options\.signal\s*\}/);
  assert.match(qwen, /Do NOT output[\s\S]*recommendation/);
  const fastPrompt = qwen.match(/const VL_SYSTEM_PROMPT_FAST_FIRST_PASS = `([\s\S]*?)`;/)?.[1] || "";
  assert.match(fastPrompt, /first-paint fields/i);
  assert.match(fastPrompt, /provide ONLY[\s\S]*name_original[\s\S]*name_translated[\s\S]*category[\s\S]*confidence/);
  assert.match(fastPrompt, /Do NOT output description unless it is visibly printed on the menu/i);
  assert.match(fastPrompt, /Do NOT output ingredients, allergens, taste_profile, recommendation, good_for, caution, or menu_metadata/i);
  assert.doesNotMatch(fastPrompt, /included_items: array/);
  assert.doesNotMatch(fastPrompt, /long food advice|rich commentary/);
  assert.match(qwen, /targetLanguageInstruction\(normalizedTargetLang,\s*\{\s*fastFirstPass\s*\}\)/);
  assert.match(aiIndex, /analyzeMenuImageFast/);
  assert.match(route, /FAST_FIRST_PASS/);
  assert.match(route, /analyzeMenuImageFast/);
  assert.match(route, /resultPayload[\s\S]*metadata[\s\S]*enrichment_status:\s*"pending"/);
  assert.match(route, /enrichResultInBackground/);
  assert.match(route, /enrichResultInBackground[\s\S]*generateImagesInBackground\(taskId, enrichedPayload, cacheKeys\)/);
  assert.match(route, /translate:task_first_pass_finished/);
});

test("fast first-pass timing separates model latency from result-building work", async () => {
  const route = await readFile(`${ROOT}/src/app/api/v1/translate/menu/route.ts`, "utf8");

  assert.match(route, /firstPageModelMs\?: number/);
  assert.match(route, /firstPageBuildMs\?: number/);
  assert.match(route, /firstPassModelMs\?: number/);
  assert.match(route, /firstPassModelName\?: string/);
  assert.match(route, /firstPassModelNames\?: string\[\]/);
  assert.match(route, /firstPassModelMsByPage\?: number\[\]/);
  assert.match(route, /firstPassBuildMs\?: number/);
  assert.match(route, /firstPassBuildMsByPage\?: number\[\]/);
  assert.match(route, /const modelStart = Date\.now\(\)/);
  assert.match(route, /const modelMs = Date\.now\(\) - modelStart/);
  assert.match(route, /timings\.firstPassModelMs = \(timings\.firstPassModelMs \|\| 0\) \+ modelMs/);
  assert.match(route, /timings\.firstPassModelMsByPage = timings\.firstPassModelMsByPage \|\| \[\]/);
  assert.match(route, /timings\.firstPassModelMsByPage\[i\] = modelMs/);
  assert.match(route, /timings\.firstPassModelName = raw\._model/);
  assert.match(route, /timings\.firstPassModelNames = timings\.firstPassModelNames \|\| \[\]/);
  assert.match(route, /timings\.firstPassModelNames\[i\] = raw\._model/);
  assert.match(route, /const buildStart = Date\.now\(\)/);
  assert.match(route, /const buildMs = Date\.now\(\) - buildStart/);
  assert.match(route, /timings\.firstPassBuildMs = \(timings\.firstPassBuildMs \|\| 0\) \+ buildMs/);
  assert.match(route, /timings\.firstPassBuildMsByPage = timings\.firstPassBuildMsByPage \|\| \[\]/);
  assert.match(route, /timings\.firstPassBuildMsByPage\[i\] = buildMs/);
  assert.match(route, /firstPageModelMs: timings\.firstPageModelMs/);
  assert.match(route, /firstPageBuildMs: timings\.firstPageBuildMs/);
  assert.match(route, /modelName: raw\._model/);
  assert.match(route, /modelMs,\s*buildMs/);
});

test("fast first-pass uses a smaller model image while preserving normalized cache keys", async () => {
  const route = await readFile(`${ROOT}/src/app/api/v1/translate/menu/route.ts`, "utf8");

  assert.match(route, /MENU_FAST_FIRST_PASS_IMAGE_MAX_DIM/);
  assert.match(route, /MENU_FAST_FIRST_PASS_IMAGE_QUALITY/);
  assert.match(route, /MENU_FAST_FIRST_PASS_IMAGE_TARGET_BYTES/);
  assert.match(route, /firstPassInputOptimizeMs\?: number/);
  assert.match(route, /firstPassOriginalBytes\?: number/);
  assert.match(route, /firstPassModelBytes\?: number/);
  assert.match(route, /firstPassTargetBytes\?: number/);
  assert.match(route, /firstPassCompressionRatio\?: number/);
  assert.match(route, /const FAST_FIRST_PASS_IMAGE_MAX_DIM = Math\.max\(\s*900/);
  assert.match(route, /const FAST_FIRST_PASS_IMAGE_QUALITY = Math\.max\(\s*55/);
  assert.match(route, /const FAST_FIRST_PASS_IMAGE_TARGET_BYTES = Math\.max\(/);
  assert.match(route, /180 \* 1024/);
  assert.match(route, /async function buildFastFirstPassModelImage/);
  assert.match(route, /buildFastFirstPassAttempts/);
  assert.match(route, /Buffer\.from\(item\.base64,\s*"base64"\)/);
  assert.match(route, /\.resize\(\{\s*width: FAST_FIRST_PASS_IMAGE_MAX_DIM,\s*height: FAST_FIRST_PASS_IMAGE_MAX_DIM,\s*fit: "inside",\s*withoutEnlargement: true,\s*\}\)/s);
  assert.match(route, /\.jpeg\(\{\s*quality: FAST_FIRST_PASS_IMAGE_QUALITY,\s*mozjpeg: true\s*\}\)/s);
  assert.match(route, /if \(buffer\.length <= FAST_FIRST_PASS_IMAGE_TARGET_BYTES\) return buffer/);
  assert.match(route, /smallestBuffer/);
  assert.match(route, /const firstPassOptimizeStart = Date\.now\(\)/);
  assert.match(route, /const firstPassImageBuffers = await Promise\.all\(imageBuffers\.map\(buildFastFirstPassModelImage\)\)/);
  assert.match(route, /timings\.firstPassInputOptimizeMs = Date\.now\(\) - firstPassOptimizeStart/);
  assert.match(route, /timings\.firstPassOriginalBytes = imageBuffers\.reduce/);
  assert.match(route, /timings\.firstPassModelBytes = firstPassImageBuffers\.reduce/);
  assert.match(route, /timings\.firstPassTargetBytes = FAST_FIRST_PASS_IMAGE_TARGET_BYTES/);
  assert.match(route, /timings\.firstPassCompressionRatio = Number/);
  assert.match(route, /const cacheKey = imageBuffers\.map\(\(b\) => b\.hash\)/);
  assert.match(route, /const batchItems = firstPassImageBuffers\.slice\(batch,\s*batch \+ FAST_FIRST_PASS_OCR_CONCURRENCY\)/);
  assert.match(route, /enrichResultInBackground\(taskId,\s*imageBuffers/);
  assert.match(route, /firstPassNormalizedSize: item\.normalizedSize/);
});

test("fast first-pass returns text results without waiting for remote image cache lookups", async () => {
  const route = await readFile(`${ROOT}/src/app/api/v1/translate/menu/route.ts`, "utf8");

  assert.match(route, /type DishRecordOptions/);
  assert.match(route, /imageLookup\?:\s*"full" \| "local-only"/);
  assert.match(route, /const imageLookup = options\.imageLookup \|\| "full"/);
  assert.match(route, /imageLookup === "full"[\s\S]*findExistingDishImages/);
  assert.match(route, /imageLookup === "full"[\s\S]*getCachedDishImageUrl/);
  assert.match(route, /processImagesFastFirstPass[\s\S]*buildDishRecords\(raw\.dishes,\s*raw\.page_label,\s*usedImageIds,\s*targetLang,\s*\{\s*imageLookup:\s*"local-only"\s*\}\)/);
  assert.match(route, /MENU_IMAGE_GENERATION_CONCURRENCY \|\| "3"/);
});

test("empty fast menu OCR results retry once with full OCR before completing", async () => {
  const route = await readFile(`${ROOT}/src/app/api/v1/translate/menu/route.ts`, "utf8");

  assert.match(route, /async function analyzeMenuImageWithEmptyRetry/);
  assert.match(route, /analyzeMenuImageFast\(item\.base64/);
  assert.match(route, /raw\.dishes\.length === 0/);
  assert.match(route, /analyzeMenuImage\(item\.base64,\s*false,\s*item\.mimeType,\s*targetLang\)/);
  assert.match(route, /translate:empty_fast_ocr_retry/);
  assert.match(route, /const raw = await analyzeMenuImageWithEmptyRetry\(item, targetLang, taskId, i, startTime, meta\)/);
});

test("fast first-pass waits for enriched dish context before paid image generation", async () => {
  const route = await readFile(`${ROOT}/src/app/api/v1/translate/menu/route.ts`, "utf8");

  assert.match(route, /const activeImageGenerationTasks = new Set<string>\(\)/);
  assert.match(route, /activeImageGenerationTasks\.has\(taskId\)/);
  assert.match(route, /activeImageGenerationTasks\.add\(taskId\)/);
  assert.match(route, /activeImageGenerationTasks\.delete\(taskId\)/);
  const firstPassFinishedIndex = route.indexOf('console.info("translate:task_first_pass_finished"');
  const fullPassFunctionIndex = route.indexOf("async function processImages(");
  const firstPassCompletionBlock = route.slice(firstPassFinishedIndex, fullPassFunctionIndex);
  assert.doesNotMatch(firstPassCompletionBlock, /generateImagesInBackground\(taskId, resultPayload, cacheKeys\)/);
  assert.match(route, /enrichResultInBackground[\s\S]*generateImagesInBackground\(taskId, enrichedPayload, cacheKeys\)/);
});

test("image generation progress merges into the latest task result without overwriting enrichment", async () => {
  const route = await readFile(`${ROOT}/src/app/api/v1/translate/menu/route.ts`, "utf8");

  assert.match(route, /function mergeImageGenerationStateIntoCurrentResult/);
  assert.match(route, /mergeGeneratedDishImagesFromExistingResult\(currentPayload,\s*imagePayload\)/);
  assert.match(route, /image_generation_status/);
  assert.match(route, /image_generation_progress/);
  assert.match(route, /image_generation_failed/);
  assert.match(route, /currentMetadata\.image_generation_queue_total = imageMetadata\.image_generation_queue_total/);
  assert.match(route, /currentMetadata\.image_generation_active_total = imageMetadata\.image_generation_active_total/);
  assert.match(route, /currentMetadata\.image_generation_queued_total = imageMetadata\.image_generation_queued_total/);
  assert.match(route, /currentMetadata\.image_generation_deferred_total = imageMetadata\.image_generation_deferred_total/);
  assert.match(route, /const latestPayload = currentTask\?\.result[\s\S]*mergeImageGenerationStateIntoCurrentResult/);
  assert.match(route, /updateTask\(taskId,\s*\{\s*result:\s*latestPayload\s*\}\)/);
  assert.match(route, /rememberTranslation\(cacheKeys,\s*latestPayload\)/);
});

test("loading screen copy does not imply blocking AI image generation", async () => {
  const loadingPage = await readFile(`${ROOT}/src/components/results/LoadingPage.tsx`, "utf8");

  assert.doesNotMatch(loadingPage, /正在匹配图片/);
  assert.match(loadingPage, /正在准备结果/);
});

test("loading does not open an empty results page when every recognition page fails", async () => {
  const loadingPage = await readFile(`${ROOT}/src/components/results/LoadingPage.tsx`, "utf8");
  const { classifyLoadingResult, resolveLoadingTaskAction } = await loadTsModule(
    `${ROOT}/src/lib/loading-result-routing.ts`,
  );

  assert.equal(classifyLoadingResult({ pages: [] }), "empty");
  assert.equal(classifyLoadingResult({ pages: [{ page_type: "menu", dishes: [] }] }), "empty");
  assert.equal(classifyLoadingResult({ pages: [{ page_type: "info", dishes: [] }] }), "displayable");
  assert.equal(classifyLoadingResult({ pages: [{ page_label: "说明页", dishes: [] }] }), "displayable");
  assert.equal(classifyLoadingResult({ pages: [{ page_type: "menu", dishes: [{ id: "dish-1" }] }] }), "displayable");

  assert.equal(resolveLoadingTaskAction("failed", { pages: [] }), "timeout");
  assert.equal(resolveLoadingTaskAction("done", { pages: [{ page_type: "menu", dishes: [] }] }), "timeout");
  assert.equal(resolveLoadingTaskAction("partial", { pages: [{ page_type: "info", dishes: [] }] }), "complete");
  assert.equal(resolveLoadingTaskAction("failed", { pages: [{ page_type: "menu", dishes: [{ id: "dish-1" }] }] }), "complete");
  assert.equal(resolveLoadingTaskAction("processing", { pages: [{ page_type: "menu", dishes: [{ id: "dish-1" }] }] }), "complete");
  assert.equal(resolveLoadingTaskAction("processing", { pages: [] }), "continue");

  assert.match(loadingPage, /resolveLoadingTaskAction/);
  assert.match(loadingPage, /initialResult/);
  assert.match(loadingPage, /onTimeout\?\.\(\)/);
});

test("loading screen uses app-like readable staged progress", async () => {
  const loadingPage = await readFile(`${ROOT}/src/components/results/LoadingPage.tsx`, "utf8");
  const globals = await readFile(`${ROOT}/src/app/globals.css`, "utf8");

  assert.match(loadingPage, /把照片变成可点菜清单/);
  assert.match(loadingPage, /先返回菜名和推荐，图片会继续在后台补齐/);
  assert.match(loadingPage, /LOADING_STEPS/);
  assert.match(loadingPage, /整理照片/);
  assert.match(loadingPage, /识别菜品/);
  assert.match(loadingPage, /翻译推荐/);
  assert.match(loadingPage, /补齐图片/);
  assert.match(loadingPage, /fontSize:\s*28/);
  assert.match(loadingPage, /minHeight:\s*48/);
  assert.match(globals, /\.loading-food-stage \.food-character-stage/);
});

test("loading screen polls task results aggressively during the first overseas wait window", async () => {
  const loadingPage = await readFile(`${ROOT}/src/components/results/LoadingPage.tsx`, "utf8");

  assert.match(loadingPage, /const LOADING_TASK_POLL_FAST_MS = 700/);
  assert.match(loadingPage, /const LOADING_TASK_POLL_STEADY_MS = 1500/);
  assert.match(loadingPage, /const LOADING_TASK_FAST_POLL_WINDOW_MS = 20_000/);
  assert.match(loadingPage, /const LOADING_TASK_ERROR_RETRY_MS = 2000/);
  assert.match(loadingPage, /function getLoadingTaskPollDelay\(elapsedMs: number\)/);
  assert.match(loadingPage, /elapsedMs < LOADING_TASK_FAST_POLL_WINDOW_MS/);
  assert.match(loadingPage, /setTimeout\(poll,\s*getLoadingTaskPollDelay\(Date\.now\(\) - pollStartTime\)\)/);
  assert.match(loadingPage, /setTimeout\(poll,\s*LOADING_TASK_ERROR_RETRY_MS\)/);
  assert.doesNotMatch(loadingPage, /setTimeout\(poll,\s*1500\)/);
  assert.doesNotMatch(loadingPage, /setTimeout\(poll,\s*2000\)/);
});

test("results page explains background image backfill instead of leaving users with isolated placeholders", async () => {
  const resultsPage = await readFile(`${ROOT}/src/components/results/ResultsPage.tsx`, "utf8");

  assert.match(resultsPage, /isImageBackfillActive/);
  assert.match(resultsPage, /hasDeferredImageBackfill/);
  assert.match(resultsPage, /图片正在后台补齐/);
  assert.match(resultsPage, /首批图片已完成/);
  assert.match(resultsPage, /先看翻译和推荐/);
  assert.match(resultsPage, /imageGenProgress\.done/);
  assert.match(resultsPage, /imageGenProgress\.total/);
});

test("results polling syncs enriched dish advice instead of only image changes", async () => {
  const page = await readFile(`${ROOT}/src/app/page.tsx`, "utf8");

  assert.match(page, /function buildResultSyncSignature/);
  assert.match(page, /recommendation/);
  assert.match(page, /good_for/);
  assert.match(page, /caution/);
  assert.match(page, /description/);
  assert.match(page, /metadata\?\.insight/);
  assert.match(page, /metadata\?\.signature/);
  assert.match(page, /buildResultSyncSignature\(reconciledResult\) !== buildResultSyncSignature\(prev\)/);
  assert.match(page, /return changed \? reconciledResult : prev/);
});

test("results image backfill polling is faster while fresh visible results still have pending images", async () => {
  const page = await readFile(`${ROOT}/src/app/page.tsx`, "utf8");
  const types = await readFile(`${ROOT}/src/types/index.ts`, "utf8");
  const resultsPage = await readFile(`${ROOT}/src/components/results/ResultsPage.tsx`, "utf8");

  assert.match(page, /RESULT_IMAGE_POLL_FAST_MS = 1500/);
  assert.match(page, /RESULT_IMAGE_POLL_STEADY_MS = 4000/);
  assert.match(page, /RESULT_IMAGE_POLL_SLOW_MS = 8000/);
  assert.match(page, /RESULT_IMAGE_FAST_POLL_WINDOW_MS = 30_000/);
  assert.match(page, /image_generation_queue_total/);
  assert.match(page, /image_generation_active_total/);
  assert.match(page, /image_generation_queued_total/);
  assert.match(page, /image_generation_batch_limit/);
  assert.match(types, /image_generation_queue_total\?: number/);
  assert.match(types, /image_generation_active_total\?: number/);
  assert.match(types, /image_generation_queued_total\?: number/);
  assert.match(types, /image_generation_batch_limit\?: number/);
  assert.match(resultsPage, /imageGenerationQueue/);
  assert.match(resultsPage, /activeTotal/);
  assert.match(resultsPage, /queuedTotal/);
  assert.match(resultsPage, /batchLimit/);
  assert.match(resultsPage, /重点图/);
  assert.match(resultsPage, /张正在生成/);
  assert.match(resultsPage, /张排队/);
  assert.match(page, /let latestHasPendingImages = hasPendingImages\(translationResult\)/);
  assert.match(page, /latestHasPendingImages = hasPendingImages\(newResult\)/);
  assert.match(page, /const nextPollDelay = latestHasPendingImages/);
  assert.match(page, /elapsed < RESULT_IMAGE_FAST_POLL_WINDOW_MS/);
  assert.match(page, /setTimeout\(poll,\s*nextPollDelay\)/);
  assert.doesNotMatch(page, /setTimeout\(poll,\s*4000\)/);
});

test("translation API fills dish advice fallbacks before caching results", async () => {
  const route = await readFile(`${ROOT}/src/app/api/v1/translate/menu/route.ts`, "utf8");

  assert.match(route, /import \{ getDishInsight \} from "@\/lib\/dish-presentation"/);
  assert.match(route, /function withDishAdviceFallback/);
  assert.match(route, /const insight = getDishInsight\(dish\)/);
  assert.match(route, /recommendation:\s*dish\.recommendation \|\| insight\.recommendation/);
  assert.match(route, /good_for:\s*dish\.good_for \|\| insight\.goodFor/);
  assert.match(route, /caution:\s*dish\.caution \|\| insight\.caution/);
  assert.match(route, /withDishAdviceFallback\(\{\s*\.\.\.dish/);
});

test("result-page AI fields are requested in fast and enriched menu analysis", async () => {
  const qwen = await readFile(`${ROOT}/src/lib/ai/qwen.ts`, "utf8");

  assert.match(qwen, /process\.env\.QWEN_BASE_URL \|\| "https:\/\/dashscope\.aliyuncs\.com\/compatible-mode\/v1"/);
  assert.match(qwen, /process\.env\.QWEN_VL_MODEL \|\| "qwen-vl-max"/);
  assert.match(qwen, /process\.env\.QWEN_TEXT_MODEL \|\| "qwen-plus"/);

  const fastPrompt = qwen.match(/const VL_SYSTEM_PROMPT_FAST_FIRST_PASS = `([\s\S]*?)`;/)?.[1] || "";
  assert.match(fastPrompt, /category:\s*one of "appetizer","main","staple","dessert","drink"/);
  assert.match(fastPrompt, /Do NOT output[\s\S]*recommendation/);
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

test("matcha dessert formats are not treated as beverages", async () => {
  const { filterDishesByCategory } = await loadTsModule(
    `${ROOT}/src/lib/results-categories.ts`,
  );
  await loadTsModule(`${ROOT}/src/lib/dish-image-match.ts`);
  const { getDishInsight } = await loadTsModule(
    `${ROOT}/src/lib/dish-presentation.ts`,
  );

  const result = {
    task_id: "matcha-dessert",
    status: "done",
    pages: [{
      page_index: 0,
      page_label: "Dessert",
      image_thumbnail: "",
      dishes: [{
        id: "matcha-roll",
        name_original: "MATCHA ROLL",
        name_translated: { zh: "抹茶卷" },
        description: { zh: "抹茶戚风蛋糕与覆盆子夹心。" },
        ingredients: ["抹茶", "戚风蛋糕", "覆盆子"],
        allergens: ["gluten", "egg", "dairy"],
        taste_profile: ["sweet"],
        category: "drink",
        image_source: "ai",
      }],
    }],
    metadata: { source_language: "en", target_language: "zh", total_dishes: 1, cached: false },
  };

  assert.deepEqual(filterDishesByCategory(result, "dessert").map((dish) => dish.id), ["matcha-roll"]);
  assert.deepEqual(filterDishesByCategory(result, "drink").map((dish) => dish.id), []);

  const recommendation = getDishInsight(result.pages[0].dishes[0]).recommendation;
  assert.match(recommendation, /抹茶卷|甜点|餐后|甜度|分享/);
  assert.doesNotMatch(recommendation, /饮品|点一杯|补一杯|冷饮|热饮|单独喝|餐后慢慢喝/);
});

test("placeholder restaurant names fall back to inferred menu identity", async () => {
  const { getRestaurantDisplayMeta } = await loadTsModule(`${ROOT}/src/lib/restaurant-display.ts`);
  const { extractRestaurantMeta } = await loadTsModule(`${ROOT}/src/lib/results-insight-fallback.ts`);

  const fallback = getRestaurantDisplayMeta("en", "zh", {
    display_name: "餐厅名（未显示） - 精致西式料理",
    restaurant_type: "精致西式料理",
    rating_estimate: 4.5,
  });
  assert.equal(fallback.display_name, "纽约小馆 New York Bistro");
  assert.equal(fallback.rating_estimate, 4.0);

  assert.equal(extractRestaurantMeta([{
    menu_metadata: {
      restaurant: {
        display_name: "Restaurant name not shown",
        restaurant_type: "Bistro",
        rating_estimate: 4.5,
      },
    },
  }]), undefined);
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

  const burgerTags = buildDishDisplayTags({
    dish: {
      id: "grain-burger",
      name_original: "GRAIN BURGER L",
      name_translated: { zh: "谷物汉堡" },
      description: { zh: "和牛烟熏胸肉饼，酸黄瓜，奶酪，焦糖洋葱，西班牙辣香肠酱。" },
      ingredients: ["和牛", "汉堡", "奶酪"],
      allergens: ["dairy", "gluten"],
      taste_profile: [],
      category: "dessert",
      image_source: "ai",
    },
    signature: { dish_ids: ["grain-burger"], reason: "招牌推荐" },
    maxTags: 4,
  }).map((tag) => tag.label);
  assert.ok(burgerTags.includes("主食"));
  assert.ok(!burgerTags.includes("甜点"));

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
  assert.match(apiClient, /TRANSLATION_CACHE_PROBE_MAX_IMAGES/);
  assert.match(apiClient, /TRANSLATION_CACHE_PROBE_MAX_BYTES/);
  assert.doesNotMatch(apiClient, /probeTranslationCache/);
  assert.match(apiClient, /AbortController/);
  assert.match(apiClient, /type TranslationClientStage/);
  assert.match(apiClient, /onStage\?:/);
  assert.match(apiClient, /onStage\?\.\("compressing"\)/);
  assert.match(apiClient, /onStage\?\.\("cache"\)/);
  assert.match(apiClient, /onStage\?\.\("uploading"\)/);
  assert.match(apiClient, /CLIENT_MENU_IMAGE_MAX_DIM = 1400/);
  assert.match(apiClient, /CLIENT_MENU_IMAGE_QUALITY = 0\.82/);
  assert.match(aiIndex, /providerOrder/);
  assert.match(aiIndex, /visionProviderOrder/);
  assert.match(aiIndex, /MENU_AI_PROVIDER/);
  assert.match(aiIndex, /options\.vision/);
  assert.match(aiIndex, /provider === "deepseek" && process\.env\.DEEPSEEK_VISION_ENABLED !== "true"/);
  assert.match(aiIndex, /analyzeMenuImage[\s\S]*lastError/);
  assert.match(aiIndex, /Provider \$\{provider\} failed/);
  assert.match(route, /translate:task_started/);
  assert.match(route, /translate:page_failed/);
  assert.match(route, /provider/);
  assert.match(route, /isCacheableTranslationResult/);
  assert.match(route, /result\.status === "failed"/);
  assert.match(route, /result\.status === "partial"/);
  assert.match(route, /translationCache\.delete\(cachedKey\)/);
  assert.match(loadingPage, /MAX_POLLING_MS/);
  assert.match(loadingPage, /onTimeout/);
  assert.match(loadingPage, /clientStage/);
  assert.match(loadingPage, /阶段：/);
  assert.match(appPage, /handleLoadingTimeout/);
  assert.match(appPage, /setLoadingClientStage/);
  assert.match(appPage, /onStage:\s*setLoadingClientStage/);
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

test("task creation falls back quickly when the remote task store is slow", async () => {
  const taskStore = await readFile(`${ROOT}/src/lib/cache/task-store.ts`, "utf8");

  assert.match(taskStore, /TASK_STORE_WRITE_TIMEOUT_MS/);
  assert.match(taskStore, /withTaskStoreTimeout/);
  assert.match(taskStore, /Task store write timed out/);
  assert.match(taskStore, /Number\.parseInt\(process\.env\.MENU_TASK_STORE_WRITE_TIMEOUT_MS/);
  assert.match(taskStore, /Promise\.race/);
  assert.match(taskStore, /withTaskStoreTimeout\(\s*db\(\)\.from\("tasks"\)\.insert/);
  assert.ok(
    taskStore.indexOf("withTaskStoreTimeout(") < taskStore.indexOf("if (error)"),
    "remote insert must be timeout-wrapped before checking task-store errors",
  );
});

test("translation task fallback persists to a local file store across process restarts", async () => {
  const taskStoreSource = await readFile(`${ROOT}/src/lib/cache/task-store.ts`, "utf8");
  const taskFileStoreSource = await readFile(`${ROOT}/src/lib/cache/task-file-store.ts`, "utf8");
  assert.match(taskStoreSource, /setFileTask/);
  assert.match(taskStoreSource, /getFileTask/);
  assert.match(taskStoreSource, /deleteFileTask/);
  assert.match(taskFileStoreSource, /MENU_TASK_FILE_STORE_DIR/);
  assert.match(taskFileStoreSource, /MENU_TASK_FILE_STORE_TTL_MS/);

  const previousDir = process.env.MENU_TASK_FILE_STORE_DIR;
  const previousTtl = process.env.MENU_TASK_FILE_STORE_TTL_MS;
  process.env.MENU_TASK_FILE_STORE_DIR = `${TMP_ROOT}/task-file-store-${Date.now()}`;
  process.env.MENU_TASK_FILE_STORE_TTL_MS = "1000";

  try {
    const { getFileTask, setFileTask, deleteFileTask } = await loadTsModule(
      `${ROOT}/src/lib/cache/task-file-store.ts`,
    );
    const task = {
      status: "processing",
      progress: { current: 1, total: 2 },
      perPageStatus: [{ page_index: 0, status: "done" }, { page_index: 1, status: "processing" }],
      result: { pages: [{ page_index: 0, dishes: [] }] },
      estimatedRemaining: 8,
    };

    await setFileTask("task-1", task, 10_000);
    assert.deepEqual(await getFileTask("task-1", 10_500), task);
    assert.equal(await getFileTask("task-1", 75_000), undefined);

    await setFileTask("task-2", task, 20_000);
    await deleteFileTask("task-2");
    assert.equal(await getFileTask("task-2", 20_100), undefined);
  } finally {
    if (previousDir === undefined) delete process.env.MENU_TASK_FILE_STORE_DIR;
    else process.env.MENU_TASK_FILE_STORE_DIR = previousDir;
    if (previousTtl === undefined) delete process.env.MENU_TASK_FILE_STORE_TTL_MS;
    else process.env.MENU_TASK_FILE_STORE_TTL_MS = previousTtl;
  }
});

test("translation cache survives process restarts through a server file cache", async () => {
  const route = await readFile(`${ROOT}/src/app/api/v1/translate/menu/route.ts`, "utf8");
  const fileCache = await readFile(`${ROOT}/src/lib/cache/translation-file-cache.ts`, "utf8");

  assert.match(route, /getCachedTranslationResult\(key\)/);
  assert.match(route, /task_id:\s*taskId/);
  assert.match(route, /const cachedRawStatus = typeof cached\.result\.status === "string" \? cached\.result\.status : ""/);
  assert.match(route, /const cachedStatus: "done" \| "partial" \| "failed"/);
  assert.match(route, /cachedRawStatus === "partial" \|\| cachedRawStatus === "failed" \? cachedRawStatus : "done"/);
  assert.match(route, /status:\s*cachedStatus/);
  assert.match(route, /const cachedPageStatus = cachedStatus === "failed" \? "failed" : "done"/);
  assert.match(route, /NextResponse\.json\(cachedResult,\s*\{\s*status:\s*200\s*\}\)/);
  assert.doesNotMatch(route, /status:\s*"processing",\s*cached:\s*true/);
  assert.match(route, /rememberTranslation\(cacheKeys,\s*resultPayload\)/);
  assert.match(route, /rememberTranslation\(cacheKeys,\s*enrichedPayload\)/);
  assert.match(route, /const persistentResult = stripMachineLocalGeneratedImagesForPersistentCache\(result\)/);
  assert.match(route, /setCachedTranslationResult\(cacheKey,\s*persistentResult\)/);
  assert.match(fileCache, /MENU_TRANSLATION_FILE_CACHE_DIR/);
  assert.match(fileCache, /MENU_TRANSLATION_FILE_CACHE_TTL_MS/);
  assert.match(fileCache, /createHash\("sha256"\)\.update\(cacheKey\)/);
  assert.match(fileCache, /\.cache", "translation-results"/);
});

test("translation file cache does not persist machine-local generated dish image URLs", async () => {
  const route = await readFile(`${ROOT}/src/app/api/v1/translate/menu/route.ts`, "utf8");

  assert.match(route, /function isMachineLocalGeneratedDishImageUrl/);
  assert.match(route, /function stripMachineLocalGeneratedImagesForPersistentCache/);
  assert.match(route, /value\.startsWith\("\/generated-dishes\/"\)/);
  assert.match(route, /parsed\.pathname\.startsWith\("\/generated-dishes\/"\)/);
  assert.match(route, /delete nextDish\.ai_image_url/);
  assert.match(route, /delete nextDish\.image_url/);
  assert.match(route, /local_generated_images_stripped_count:\s*strippedCount/);
  assert.match(route, /const persistentResult = stripMachineLocalGeneratedImagesForPersistentCache\(result\)/);
  assert.match(route, /translationCache\.set\(cacheKey,\s*\{\s*result,\s*createdAt/);
  assert.match(route, /setCachedTranslationResult\(cacheKey,\s*persistentResult\)/);
  assert.doesNotMatch(route, /setCachedTranslationResult\(cacheKey,\s*result\)/);
});

test("repeat menu uploads use browser cache before a server-verified upload", async () => {
  const apiClient = await readFile(`${ROOT}/src/lib/api-client.ts`, "utf8");
  const cacheRoute = await readFile(`${ROOT}/src/app/api/v1/translate/menu/cache/route.ts`, "utf8");

  assert.match(apiClient, /buildClientImageHash/);
  assert.match(apiClient, /import \{ MAX_MENU_IMAGES,\s*shouldNormalizeClientImage \} from "@\/lib\/image-input"/);
  assert.match(apiClient, /TRANSLATION_CACHE_PROBE_MAX_IMAGES\s*=\s*MAX_MENU_IMAGES/);
  assert.match(apiClient, /TRANSLATION_CACHE_PROBE_MAX_BYTES\s*=\s*5 \* 1024 \* 1024/);
  assert.match(apiClient, /TRANSLATION_RAW_CACHE_PROBE_MAX_BYTES\s*=\s*24 \* 1024 \* 1024/);
  assert.match(apiClient, /function shouldProbeTranslationCache/);
  assert.match(apiClient, /images\.length > TRANSLATION_CACHE_PROBE_MAX_IMAGES/);
  assert.match(apiClient, /maxBytes = TRANSLATION_CACHE_PROBE_MAX_BYTES/);
  assert.match(apiClient, /totalBytes <= maxBytes/);
  assert.match(apiClient, /function normalizeClientHashSets/);
  assert.match(apiClient, /const compressionPromise = Promise\.all\(images\.map\(\(img\) => compressImage\(img\)\)\)/);
  assert.match(apiClient, /shouldProbeTranslationCache\(images,\s*TRANSLATION_RAW_CACHE_PROBE_MAX_BYTES\)/);
  assert.match(apiClient, /const rawHashPromise = canProbeRawImages/);
  assert.match(apiClient, /hashMode:\s*"raw_precompression"/);
  assert.match(apiClient, /compressedHashes = await Promise\.all\(compressed\.map\(\(img\) => buildClientImageHash/);
  assert.match(apiClient, /rawHashes = await rawHashPromise/);
  assert.match(apiClient, /clientHashSets = normalizeClientHashSets\(\[compressedHashes,\s*rawHashes\]\)/);
  assert.match(apiClient, /clientHashes = clientHashSets\[0\] \|\| \[\]/);
  assert.match(apiClient, /formData\.append\("client_hashes",\s*JSON\.stringify\(clientHashes\)\)/);
  assert.match(apiClient, /formData\.append\("client_hash_sets",\s*JSON\.stringify\(clientHashSets\)\)/);
  assert.match(apiClient, /signal:\s*controller\.signal/);
  assert.match(apiClient, /client_cache_probe_skipped/);
  assert.match(apiClient, /reason:\s*"large_upload"/);
  assert.match(apiClient, /compressed\.forEach/);
  assert.doesNotMatch(apiClient, /probeTranslationCache/);
  assert.doesNotMatch(apiClient, /\/api\/v1\/translate\/menu\/cache/);
  assert.doesNotMatch(cacheRoute, /getCachedTranslationResult|generateImagesForDishes/);
});

test("large compressed menu uploads still send raw client hash aliases to the server", async () => {
  const apiClient = await readFile(`${ROOT}/src/lib/api-client.ts`, "utf8");

  assert.match(apiClient, /let rawHashSets:\s*string\[\]\[\]\s*=\s*\[\]/);
  assert.match(apiClient, /rawHashSets = normalizeClientHashSets\(\[rawHashes\]\)/);
  assert.match(apiClient, /if \(rawHashSets\.length > 0\) \{/);
  assert.match(apiClient, /reason:\s*"large_upload"/);
  assert.match(apiClient, /clientHashSets = rawHashSets/);
  assert.match(apiClient, /clientHashes = clientHashSets\[0\] \|\| \[\]/);

  const rawHashSetsIndex = apiClient.indexOf("rawHashSets = normalizeClientHashSets([rawHashes])");
  const largeUploadIndex = apiClient.indexOf('reason: "large_upload"');
  const uploadAliasesIndex = apiClient.indexOf("clientHashSets = rawHashSets");
  const formDataIndex = apiClient.indexOf('formData.append("client_hash_sets"');

  assert.ok(rawHashSetsIndex > 0, "raw hash sets should be built after the raw precompression hash");
  assert.ok(largeUploadIndex > rawHashSetsIndex, "large upload skip path should run after raw hashes are available");
  assert.ok(uploadAliasesIndex > largeUploadIndex, "large upload skip path should preserve raw hash aliases");
  assert.ok(formDataIndex > uploadAliasesIndex, "raw hash aliases should be attached before the upload request is sent");
});

test("repeat menu uploads retain browser hints but refresh server task authorization", async () => {
  const apiClient = await readFile(`${ROOT}/src/lib/api-client.ts`, "utf8");

  assert.match(apiClient, /TRANSLATION_BROWSER_RESULT_CACHE_KEY/);
  assert.match(apiClient, /TRANSLATION_BROWSER_RESULT_CACHE_LIMIT = 8/);
  assert.match(apiClient, /function isBrowserCacheableTranslationResult/);
  assert.match(apiClient, /Array\.isArray\(result\.pages\)/);
  assert.match(apiClient, /result\.pages\.length > 0/);
  assert.match(apiClient, /function readBrowserCachedTranslation/);
  assert.match(apiClient, /function rememberBrowserCachedTranslation/);
  assert.match(apiClient, /parsed\.filter\(.*isBrowserCacheableTranslationResult\(entry\.result\)/s);
  assert.match(apiClient, /localStorage\.getItem\(TRANSLATION_BROWSER_RESULT_CACHE_KEY\)/);
  assert.match(apiClient, /localStorage\.setItem\(\s*TRANSLATION_BROWSER_RESULT_CACHE_KEY/);
  assert.match(apiClient, /const rawBrowserCached = readBrowserCachedTranslation\(rawHashSets,\s*normalizedTargetLang\)/);
  assert.match(apiClient, /if \(rawBrowserCached\) \{/);
  assert.match(apiClient, /translate:browser_cache_hint/);
  assert.doesNotMatch(apiClient, /return rawBrowserCached/);
  assert.match(apiClient, /const compressedBrowserCached = readBrowserCachedTranslation\(clientHashSets,\s*normalizedTargetLang\)/);
  assert.doesNotMatch(apiClient, /return compressedBrowserCached/);
  assert.match(apiClient, /if \(!isBrowserCacheableTranslationResult\(result\)\) return/);
  assert.match(apiClient, /rememberBrowserCachedTranslation\(clientHashSets,\s*normalizedTargetLang,\s*result\)/);
});

test("completed task polling backfills the browser-local upload hash cache", async () => {
  const apiClient = await readFile(`${ROOT}/src/lib/api-client.ts`, "utf8");

  assert.match(apiClient, /TRANSLATION_BROWSER_PENDING_HASHES_KEY/);
  assert.match(apiClient, /function rememberPendingBrowserHashSets/);
  assert.match(apiClient, /function consumePendingBrowserHashSets/);
  assert.match(apiClient, /task_id/);
  assert.match(apiClient, /rememberPendingBrowserHashSets\(result\.task_id,\s*normalizedTargetLang,\s*clientHashSets\)/);
  assert.match(apiClient, /rememberPendingBrowserHashSets\(result\.task_id,\s*normalizedTargetLang,\s*normalizeClientHashSets\(\[rawHashes\]\)\)/);
  assert.match(apiClient, /const pendingHashSets = consumePendingBrowserHashSets\(data\.task_id\)/);
  assert.match(apiClient, /rememberBrowserCachedTranslation\(pendingHashSets\.hashSets,\s*pendingHashSets\.targetLang,\s*data\.result\)/);
  assert.match(apiClient, /data\.status === "failed"/);
});

test("translation upload stores client preflight hashes as cache aliases for repeat speed", async () => {
  const route = await readFile(`${ROOT}/src/app/api/v1/translate/menu/route.ts`, "utf8");

  assert.match(route, /type TranslationCacheKeys = string \| string\[\] \| undefined/);
  assert.match(route, /function normalizeClientImageHashes/);
  assert.match(route, /function normalizeClientImageHashSets/);
  assert.match(route, /formData\.get\("client_hashes"\)/);
  assert.match(route, /formData\.get\("client_hash_sets"\)/);
  assert.match(route, /function buildTranslationCacheKeys/);
  assert.match(route, /function buildClientTranslationCacheKeys/);
  assert.match(route, /const submittedClientHashSets = normalizeClientImageHashSets\(/);
  assert.match(route, /const clientHashSets = verifiedClientImageHashSets\(/);
  assert.match(route, /const clientCacheKeys = buildClientTranslationCacheKeys\(clientHashSets\)/);
  assert.match(route, /const cacheKeys = buildTranslationCacheKeys\(cacheKey,\s*clientHashSets\)/);
  assert.match(route, /for \(const key of clientCacheKeys\)/);
  assert.match(route, /getCachedTranslationResult\(key\)/);
  assert.match(route, /cache_key_source:\s*"client"/);
  assert.match(route, /rememberTranslation\(cacheKeys,\s*resultPayload\)/);
  assert.match(route, /rememberTranslation\(cacheKeys,\s*enrichedPayload\)/);
  assert.match(route, /rememberTranslation\(cacheKeys,\s*latestPayload\)/);
  assert.match(route, /Promise\.all\(keys\.map\(\(cacheKey\) => setCachedTranslationResult\(cacheKey,\s*persistentResult\)\)\)/);
});

test("server verifies client cache hashes against uploaded bytes before cache lookup or alias writes", async () => {
  const route = await readFile(`${ROOT}/src/app/api/v1/translate/menu/route.ts`, "utf8");

  assert.match(route, /function verifiedClientImageHashSets/);
  assert.match(route, /rawImageBuffers\.map\(\(image\) => hashImageContent\(targetLang,\s*image\.buffer\)\)/);
  assert.match(route, /const clientHashSets = verifiedClientImageHashSets\(/);
  assert.doesNotMatch(route, /cache_hit_without_raw_read:\s*true/);

  const rawReadIndex = route.indexOf("const rawReadStart = Date.now()");
  const verifiedHashIndex = route.indexOf("const clientHashSets = verifiedClientImageHashSets(");
  const cacheLookupIndex = route.indexOf("const cachedHit = await findCachedTranslationByClientKeys(");
  assert.ok(rawReadIndex > 0, "uploaded images should be read before hash verification");
  assert.ok(verifiedHashIndex > rawReadIndex, "client hashes should be verified after reading uploaded bytes");
  assert.ok(cacheLookupIndex > verifiedHashIndex, "cache lookup should use only verified client hashes");
});

test("public cache probe cannot return menu data or trigger paid image generation", async () => {
  const cacheRoute = await readFile(`${ROOT}/src/app/api/v1/translate/menu/cache/route.ts`, "utf8");

  assert.match(cacheRoute, /NextResponse\.json\(\s*\{\s*hit:\s*false\s*\}/);
  assert.match(cacheRoute, /"Cache-Control":\s*"no-store"/);
  assert.doesNotMatch(cacheRoute, /getCachedTranslationResult/);
  assert.doesNotMatch(cacheRoute, /generateImagesForDishes/);
  assert.doesNotMatch(cacheRoute, /startCacheProbeImageRefresh/);
});

test("cached menu results refresh stale generated images and missing dish advice in the background", async () => {
  const route = await readFile(`${ROOT}/src/app/api/v1/translate/menu/route.ts`, "utf8");

  assert.match(route, /function shouldRefreshCachedResultInBackground/);
  assert.match(route, /function resultNeedsImageRefresh/);
  assert.match(route, /image_sanitized_count/);
  assert.match(route, /local_generated_images_stripped_count/);
  assert.match(route, /!dish\.ai_image_url && !dish\.image_url && dish\.image_status !== "failed" && dish\.image_status !== "deferred"/);
  assert.match(route, /resultNeedsDishAdviceRefresh/);
  assert.match(route, /function refreshCachedResultInBackground/);
  assert.match(route, /generateImagesInBackground\(taskId,\s*cachedResult,\s*clientCacheKeys\)/);
  assert.match(route, /normalizeMenuImagesForProcessing\(rawImageBuffers,\s*targetLang,\s*timings\)/);
  assert.match(route, /enrichResultInBackground\(taskId,\s*imageBuffers,\s*cachedResult,\s*targetLang,\s*cacheKeys/);
  assert.match(route, /shouldRefreshCachedResultInBackground\(cachedResult\)/);
  assert.match(route, /refreshCachedResultInBackground\(\{\s*taskId,\s*rawImageBuffers,\s*cachedResult,\s*targetLang,\s*clientHashSets,\s*startTime,\s*meta,\s*timings\s*\}/);
  assert.match(route, /metadata\.image_generation_status = "processing"/);
  assert.match(route, /metadata\.enrichment_status = "pending"/);
});

test("large menus skip remote dish image lookup so 200-dish results are not blocked by Supabase", async () => {
  const route = await readFile(`${ROOT}/src/app/api/v1/translate/menu/route.ts`, "utf8");

  assert.match(route, /MENU_REMOTE_IMAGE_LOOKUP_DISH_LIMIT/);
  assert.match(route, /MENU_REMOTE_IMAGE_LOOKUP_CANDIDATE_LIMIT/);
  assert.match(route, /process\.env\.MENU_REMOTE_IMAGE_LOOKUP_DISH_LIMIT \|\| "80"/);
  assert.match(route, /process\.env\.MENU_REMOTE_IMAGE_LOOKUP_CANDIDATE_LIMIT \|\| "240"/);
  assert.match(route, /if \(dishes\.length > MENU_REMOTE_IMAGE_LOOKUP_DISH_LIMIT\) \{/);
  assert.match(route, /translate:remote_image_lookup_skipped/);
  assert.match(route, /reason:\s*"too_many_dishes"/);
  assert.match(route, /if \(candidates\.length > MENU_REMOTE_IMAGE_LOOKUP_CANDIDATE_LIMIT\) \{/);
  assert.match(route, /reason:\s*"too_many_candidates"/);
  assert.match(route, /return new Map\(\)/);
});

test("large result pages render dish cards progressively for 200-dish menus", async () => {
  const resultsPage = await readFile(`${ROOT}/src/components/results/ResultsPage.tsx`, "utf8");

  assert.match(resultsPage, /RESULTS_INITIAL_VISIBLE_DISH_LIMIT = 60/);
  assert.match(resultsPage, /RESULTS_VISIBLE_DISH_INCREMENT = 40/);
  assert.match(resultsPage, /visibleDishLimitState,\s*setVisibleDishLimit/);
  assert.match(resultsPage, /visibleDishScopeKey/);
  assert.match(resultsPage, /current\.scopeKey === visibleDishScopeKey/);
  assert.doesNotMatch(resultsPage, /useEffect\(\(\) => \{\s*setVisibleDishLimit\(RESULTS_INITIAL_VISIBLE_DISH_LIMIT\)/);
  assert.match(resultsPage, /displayedDishes\.slice\(0,\s*visibleDishLimit\)/);
  assert.match(resultsPage, /const hiddenDishCount = Math\.max\(0,\s*displayedDishes\.length - visibleDishes\.length\)/);
  assert.match(resultsPage, /visibleDishes\.map/);
  assert.doesNotMatch(resultsPage, /displayedDishes\.map\(\(dish, i\)/);
  assert.match(resultsPage, /hiddenDishCount > 0/);
  assert.match(resultsPage, /再显示/);
  assert.match(resultsPage, /setVisibleDishLimit\(\(current\) => \(\{/);
  assert.match(resultsPage, /limit:\s*\(current\.scopeKey === visibleDishScopeKey \? current\.limit : RESULTS_INITIAL_VISIBLE_DISH_LIMIT\) \+ RESULTS_VISIBLE_DISH_INCREMENT/);
  assert.match(resultsPage, /deferredDishById[\s\S]*for \(const dish of visibleDishes\)/);
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

test("new uploads clear stale latest results before cached menu completion", async () => {
  const appPage = await readFile(`${ROOT}/src/app/page.tsx`, "utf8");

  assert.match(appPage, /latestResultRef\.current = null;\s*setTranslationResult\(null\)/);
  assert.match(appPage, /const nextResult = preliminary as unknown as TranslationResult;\s*latestResultRef\.current = nextResult;\s*setTranslationResult\(nextResult\)/);
  assert.match(appPage, /const completedResult = latestResultRef\.current \|\| translationResult/);
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
  assert.match(appPage, /createTranslation\(files,\s*settings\.targetLang/);
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
  assert.match(homePage, /event\.currentTarget\.style\.display = "none"/);
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
  const historyPage = await readFile(`${ROOT}/src/components/history/HistoryPage.tsx`, "utf8");
  const appPage = await readFile(`${ROOT}/src/app/page.tsx`, "utf8");
  const localStorage = await readFile(`${ROOT}/src/lib/local-storage.ts`, "utf8");
  const {
    isSafeStoredThumbnail,
    isStableRemoteGeneratedDishImageUrl,
    unwrapNextImageUrl,
  } = await loadTsModule(`${ROOT}/src/lib/safe-image-url.ts`);
  const { pickSafeMenuThumbnail } = await loadTsModule(`${ROOT}/src/lib/recent-menu-records.ts`);

  const nextWrappedTemporary = "/_next/image?url=https%3A%2F%2Fdashscope-result-wlcb-acdr-1.oss-cn-wulanchabu-acdr-1.aliyuncs.com%2Ftemporary.png&w=64&q=75";
  const absoluteNextWrappedGenerated = "https://dishlens.wukongmkt.com/_next/image?url=%2Fgenerated-dishes%2Fmissing.png&w=64&q=75";
  assert.equal(unwrapNextImageUrl(nextWrappedTemporary).includes("dashscope-result"), true);
  assert.equal(unwrapNextImageUrl(absoluteNextWrappedGenerated), "/generated-dishes/missing.png");
  assert.equal(isSafeStoredThumbnail("/dishes/apple-pie.webp"), true);
  assert.equal(isSafeStoredThumbnail("/dishes/apple-pie.png"), true);
  assert.equal(isSafeStoredThumbnail("/dishes/missing-dish-photo.webp"), false);
  assert.equal(isSafeStoredThumbnail("https://dishlens.wukongmkt.com/dishes/apple-pie.webp"), true);
  assert.equal(isSafeStoredThumbnail("https://dishlens.wukongmkt.com/dishes/apple-pie.jpg"), true);
  assert.equal(isSafeStoredThumbnail("https://gbkallzbksmaahzvxezq.supabase.co/storage/v1/object/public/dishes/generated-rare-soup.webp"), true);
  assert.equal(isSafeStoredThumbnail("http://gbkallzbksmaahzvxezq.supabase.co/storage/v1/object/public/dishes/generated-rare-soup.webp"), false);
  assert.equal(isSafeStoredThumbnail("http://bucket.oss-ap-southeast-1.aliyuncs.com/generated-dishes/generated-rare-soup.webp"), false);
  assert.equal(isSafeStoredThumbnail("https://example.com/random-food.jpg"), false);
  assert.equal(isSafeStoredThumbnail("https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=120"), false);
  assert.equal(isSafeStoredThumbnail("/generated-dishes/generated-old-local-only.png"), false);
  assert.equal(isSafeStoredThumbnail("https://dishlens.wukongmkt.com/generated-dishes/generated-old-local-only.png"), false);
  assert.equal(isSafeStoredThumbnail(absoluteNextWrappedGenerated), false);
  assert.equal(isSafeStoredThumbnail(nextWrappedTemporary), false);
  assert.equal(isSafeStoredThumbnail("https://image.pollinations.ai/prompt/professional-food"), false);
  assert.equal(isSafeStoredThumbnail("/_next/image?url=https%3A%2F%2Fimages.unsplash.com%2Fphoto-1504674900247-0877df9cc836&w=64&q=75"), false);
  assert.equal(isStableRemoteGeneratedDishImageUrl("https://bucket.oss-ap-southeast-1.aliyuncs.com/generated-dishes/a.webp"), true);
  assert.equal(isStableRemoteGeneratedDishImageUrl("http://bucket.oss-ap-southeast-1.aliyuncs.com/generated-dishes/a.webp"), false);
  assert.equal(isStableRemoteGeneratedDishImageUrl("/generated-dishes/a.webp"), false);

  const picked = pickSafeMenuThumbnail({
    thumbnail: "https://dishlens.wukongmkt.com/generated-dishes/generated-old-local-only.png",
    result_summary: {
      pages: [{
        dishes: [
          { id: "old", name_original: "Old", ai_image_url: "https://image.pollinations.ai/prompt/old" },
          { id: "missing-local", name_original: "Missing", ai_image_url: "/dishes/missing-dish-photo.webp" },
          { id: "safe", name_original: "Apple Pie", ai_image_url: "/dishes/apple-pie.webp" },
        ],
      }],
    },
  });
  assert.equal(picked, "/dishes/apple-pie.webp");

  assert.match(recentRecords, /pickSafeMenuThumbnail/);
  assert.match(recentRecords, /isSafeStoredThumbnail/);
  assert.match(historyPage, /pickSafeMenuThumbnail\(e\)/);
  assert.match(appPage, /thumbnail:\s*pickSafeMenuThumbnail/);
  assert.match(localStorage, /sanitizeHistoryEntry/);
  assert.match(localStorage, /isUnsafePersistedImageUrl/);
  assert.match(localStorage, /thumbnail\s*=\s*""/);
  assert.match(localStorage, /delete nextDish\.ai_image_url/);
  assert.match(localStorage, /delete nextDish\.image_url/);
  assert.match(localStorage, /sanitizeFavoriteDish/);
  assert.match(localStorage, /const sanitized = favorites\.map\(sanitizeFavoriteDish\)/);
  assert.match(localStorage, /delete next\.image_url/);
  assert.match(localStorage, /write\(KEYS\.favorites,\s*sanitized\)/);

  const favoritesPage = await readFile(`${ROOT}/src/components/favorites/FavoritesPage.tsx`, "utf8");
  assert.match(favoritesPage, /isSafeStoredThumbnail/);
  assert.match(favoritesPage, /failedFavoriteImages/);
  assert.match(favoritesPage, /setFailedFavoriteImages/);
  assert.match(favoritesPage, /onError=\{\(\) => \{/);
  assert.match(favoritesPage, /FoodThumbnailFallback/);

  const homePage = await readFile(`${ROOT}/src/components/home/HomePage.tsx`, "utf8");
  assert.match(homePage, /failedRecentThumbs\[src\]/);
  assert.match(homePage, /FoodThumbnailFallback/);
  assert.match(homePage, /naturalWidth > 0/);
  assert.match(homePage, /event\.currentTarget\.style\.display = "none"/);
  assert.match(homePage, /onError=\{\(event\) => \{/);
  assert.match(homePage, /visibility:\s*loadedRecentThumbs\[src\]/);
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
  const { getDishImageUrl, isDishImagePending } = await loadTsModule(
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
  assert.equal(
    isDishImagePending({
      id: "deferred-1",
      name_original: "Later Large Menu Dish",
      name_translated: { zh: "稍后补图菜" },
      description: { zh: "大菜单后排菜，当前批次不生成图片" },
      ingredients: [],
      allergens: [],
      taste_profile: [],
      category: "main",
      image_source: "ai",
      image_status: "deferred",
    }),
    false,
  );
  assert.equal(
    getDishImageUrl({
      id: "deferred-1",
      name_original: "Later Large Menu Dish",
      name_translated: { zh: "稍后补图菜" },
      description: { zh: "大菜单后排菜，当前批次不生成图片" },
      ingredients: [],
      allergens: [],
      taste_profile: [],
      category: "main",
      image_source: "ai",
      image_status: "deferred",
    }),
    "",
  );
  assert.equal(
    getDishImageUrl({
      id: "deferred-2",
      name_original: "Later Garden Salad",
      name_translated: { zh: "稍后补图沙拉" },
      description: { zh: "命中远程规则图但仍在大菜单后排补图" },
      ingredients: [],
      allergens: [],
      taste_profile: [],
      category: "salad",
      image_status: "deferred",
    }),
    "",
  );
  assert.equal(
    getDishImageUrl({
      id: "unknown-salad-1",
      name_original: "Chef's Very Rare Garden Bowl",
      name_translated: { zh: "少见主厨花园碗" },
      description: { zh: "本地图库暂未覆盖的未知沙拉碗" },
      ingredients: ["greens"],
      allergens: [],
      taste_profile: [],
      category: "salad",
    }),
    "",
  );
});

test("dish image pending UI falls back instead of showing a permanent percent", async () => {
  const component = await readFile(`${ROOT}/src/components/shared/DishImageWithLoading.tsx`, "utf8");

  assert.match(component, /IMAGE_PENDING_STALE_MS/);
  assert.match(component, /hasWaitedLong/);
  assert.match(component, /图片生成较慢，先用示意图/);
  assert.match(component, /pendingActiveTotal\?: number/);
  assert.match(component, /pendingQueuedTotal\?: number/);
  assert.match(component, /pendingQueueLabel/);
  assert.match(component, /排队中/);
  assert.match(component, /生成中/);
  assert.match(component, /clearTimeout/);
});

test("dish detail pending hero image receives image generation queue state", async () => {
  const appPage = await readFile(`${ROOT}/src/app/page.tsx`, "utf8");
  const detailPage = await readFile(`${ROOT}/src/components/dish/DishDetailPage.tsx`, "utf8");

  assert.match(appPage, /image_generation_active_total/);
  assert.match(appPage, /image_generation_queued_total/);
  assert.match(appPage, /activeTotal/);
  assert.match(appPage, /queuedTotal/);
  assert.match(detailPage, /imageGenProgress\?: \{ done: number; total: number; activeTotal\?: number; queuedTotal\?: number; batchLimit\?: number \}/);
  assert.match(detailPage, /pendingActiveTotal=\{imageGenProgress\?\.activeTotal\}/);
  assert.match(detailPage, /pendingQueuedTotal=\{imageGenProgress\?\.queuedTotal\}/);
});

test("deferred dish detail images can be generated on demand without resuming the full menu queue", async () => {
  const apiClient = await readFile(`${ROOT}/src/lib/api-client.ts`, "utf8");
  const appPage = await readFile(`${ROOT}/src/app/page.tsx`, "utf8");
  const detailPage = await readFile(`${ROOT}/src/components/dish/DishDetailPage.tsx`, "utf8");
  const dishImage = await readFile(`${ROOT}/src/components/shared/DishImageWithLoading.tsx`, "utf8");
  const route = await readFile(`${ROOT}/src/app/api/v1/dish/[id]/generate-image/route.ts`, "utf8");

  assert.match(apiClient, /export async function generateDishImageForDish/);
  assert.match(apiClient, /taskId\?: string/);
  assert.match(apiClient, /task_id:\s*taskId/);
  assert.match(apiClient, /\/api\/v1\/dish\/\$\{encodeURIComponent\(dish\.id \|\| "temp"\)\}\/generate-image/);
  assert.match(appPage, /generateDishImageForDish/);
  assert.match(appPage, /selectedDishImageGenerating/);
  assert.match(appPage, /handleGenerateSelectedDishImage/);
  assert.match(appPage, /image_status: "generating"/);
  assert.match(appPage, /image_status: "done"/);
  assert.match(appPage, /setSelectedDish\(\(prev\) => prev && prev\.id === selectedDish\.id/);
  assert.match(appPage, /updateTranslationResultDishImage/);
  assert.match(detailPage, /onGenerateImage\?: \(dish: Dish\) => void/);
  assert.match(detailPage, /onRetry=\{\(\) => onGenerateImage\?\.\(dish\)\}/);
  assert.match(detailPage, /retrying=\{imageGenerating\}/);
  assert.match(dishImage, /dish\.image_status === "deferred"/);
  assert.match(dishImage, /现在生成/);
  assert.match(route, /storageIdForGeneratedDishImage/);
  assert.match(route, /getCachedDishImageUrl/);
  assert.match(route, /const cachedUrl = await getCachedDishImageUrl\(storageId\)/);
  assert.match(route, /cache_hit:\s*true/);
  assert.match(route, /updateGeneratedDishImageInTask/);
  assert.match(route, /await updateTask\(taskId,\s*\{\s*result:/);
  assert.match(route, /if \(!taskId\)/);
  assert.match(route, /findTaskDish/);
  assert.match(route, /consumeDishImageGenerationBudget/);
  assert.match(route, /inFlightDishImageGenerations/);
  assert.match(route, /isStableRemoteGeneratedDishImageUrl/);
  assert.doesNotMatch(route, /const dishInfo = body\.dish \|\| \{\}/);
  assert.doesNotMatch(route, /publicUrl \|\| tempUrl/);
  assert.match(appPage, /mergeClientDishImageState/);
  assert.doesNotMatch(appPage, /dish\.id && previousByKey\.get/);
  assert.doesNotMatch(route, /generateImagesForDishes/);

  const cacheLookupIndex = route.indexOf("const cachedUrl = await getCachedDishImageUrl(storageId)");
  const generationIndex = route.indexOf("generationPromise = generateAndPersistDishImage(storageId, dishInfo)");
  assert.ok(cacheLookupIndex > 0 && generationIndex > cacheLookupIndex, "persisted image cache must be checked before paid generation");
});

test("generated dish image persistence only treats HTTPS remote storage as stable", async () => {
  const route = await readFile(`${ROOT}/src/app/api/v1/dish/[id]/generate-image/route.ts`, "utf8");
  const menuRoute = await readFile(`${ROOT}/src/app/api/v1/translate/menu/route.ts`, "utf8");
  assert.match(route, /if \(!isStableRemoteGeneratedDishImageUrl\(cachedUrl\)\)/);
  assert.match(route, /if \(!isStableRemoteGeneratedDishImageUrl\(publicUrl\)\)/);
  assert.match(menuRoute, /isStableRemoteGeneratedDishImageUrl/);
});

test("results page prewarms visible deferred dish images in small batches", async () => {
  const appPage = await readFile(`${ROOT}/src/app/page.tsx`, "utf8");
  const resultsPage = await readFile(`${ROOT}/src/components/results/ResultsPage.tsx`, "utf8");

  assert.match(resultsPage, /RESULTS_DEFERRED_PREWARM_DEFAULT_LIMIT = 2/);
  assert.match(resultsPage, /RESULTS_DEFERRED_PREWARM_DEFAULT_DELAY_MS = 900/);
  assert.match(resultsPage, /onGenerateImage\?: \(dish: Dish\) => void/);
  assert.match(resultsPage, /generatingDishIds\?: Set<string>/);
  assert.match(resultsPage, /deferredDishCardRefs/);
  assert.match(resultsPage, /deferredPrewarmQueueRef/);
  assert.match(resultsPage, /prewarmedDeferredDishIdsRef/);
  assert.match(resultsPage, /flushDeferredImagePrewarmRef/);
  assert.match(resultsPage, /IntersectionObserver/);
  assert.match(resultsPage, /useEffect\(\(\) => \{\s*observedDeferredDishIdsRef\.current\.clear\(\)/);
  assert.match(resultsPage, /deferredPrewarmQueueRef\.current = \[\]/);
  assert.match(resultsPage, /\}, \[visibleDishScopeKey\]\)/);
  assert.match(resultsPage, /entry\.isIntersecting/);
  assert.match(resultsPage, /requestDeferredImagePrewarm/);
  assert.match(resultsPage, /splice\(0, deferredPrewarmPolicy\.limit\)/);
  assert.match(resultsPage, /window\.setTimeout\(\(\) => flushDeferredImagePrewarmRef\.current\(\), deferredPrewarmPolicy\.delayMs\)/);
  assert.match(resultsPage, /data-deferred-dish-id/);
  assert.match(resultsPage, /generatingDishIds\?\.has\(dish\.id\)/);
  assert.match(appPage, /const \[generatingDishIds, setGeneratingDishIds\]/);
  assert.match(appPage, /generatingDishIdsRef/);
  assert.match(appPage, /setDishImageGenerating/);
  assert.match(appPage, /handleGenerateDishImage/);
  assert.match(appPage, /onGenerateImage=\{handleGenerateDishImage\}/);
  assert.match(appPage, /generatingDishIds=\{generatingDishIds\}/);
  assert.match(appPage, /handleGenerateSelectedDishImage/);
});

test("results page adapts deferred image prewarm to weak overseas networks", async () => {
  const resultsPage = await readFile(`${ROOT}/src/components/results/ResultsPage.tsx`, "utf8");

  assert.match(resultsPage, /type NetworkInformationLike/);
  assert.match(resultsPage, /type NavigatorWithConnection/);
  assert.match(resultsPage, /getDeferredPrewarmPolicy/);
  assert.match(resultsPage, /navigator as NavigatorWithConnection/);
  assert.match(resultsPage, /connection\?\.saveData/);
  assert.match(resultsPage, /effectiveType/);
  assert.match(resultsPage, /return \{ enabled: false, limit: 0, delayMs: 0 \}/);
  assert.match(resultsPage, /effectiveType === "3g"/);
  assert.match(resultsPage, /return \{ enabled: true, limit: 1, delayMs: 1800 \}/);
  assert.match(resultsPage, /RESULTS_DEFERRED_PREWARM_DEFAULT_LIMIT/);
  assert.match(resultsPage, /RESULTS_DEFERRED_PREWARM_DEFAULT_DELAY_MS/);
  assert.match(resultsPage, /deferredPrewarmPolicy/);
  assert.match(resultsPage, /if \(!deferredPrewarmPolicy\.enabled\) return/);
  assert.match(resultsPage, /splice\(0, deferredPrewarmPolicy\.limit\)/);
  assert.match(resultsPage, /deferredPrewarmPolicy\.delayMs/);
});

test("results page updates deferred prewarm policy when network conditions change", async () => {
  const resultsPage = await readFile(`${ROOT}/src/components/results/ResultsPage.tsx`, "utf8");

  assert.match(resultsPage, /const \[deferredPrewarmPolicy, setDeferredPrewarmPolicy\] = useState\(\(\) => getDeferredPrewarmPolicy\(\)\)/);
  assert.match(resultsPage, /const connection = \(navigator as NavigatorWithConnection\)\.connection/);
  assert.match(resultsPage, /const handleNetworkChange = \(\) => \{/);
  assert.match(resultsPage, /setDeferredPrewarmPolicy\(getDeferredPrewarmPolicy\(\)\)/);
  assert.match(resultsPage, /deferredPrewarmQueueRef\.current = \[\]/);
  assert.match(resultsPage, /prewarmedDeferredDishIdsRef\.current\.clear\(\)/);
  assert.match(resultsPage, /window\.clearTimeout\(prewarmTimerRef\.current\)/);
  assert.match(resultsPage, /addConnectionChangeListener\.call\(connection, "change", handleNetworkChange\)/);
  assert.match(resultsPage, /removeConnectionChangeListener\.call\(connection, "change", handleNetworkChange\)/);
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

test("above-fold dish images are prioritized to reduce result-page LCP", async () => {
  const component = await readFile(`${ROOT}/src/components/shared/DishImageWithLoading.tsx`, "utf8");
  const resultsPage = await readFile(`${ROOT}/src/components/results/ResultsPage.tsx`, "utf8");
  const detailPage = await readFile(`${ROOT}/src/components/dish/DishDetailPage.tsx`, "utf8");

  assert.match(component, /priority\?: boolean/);
  assert.match(component, /priority=\{priority\}/);
  assert.match(component, /loading=\{priority \? "eager" : "lazy"\}/);
  assert.match(resultsPage, /priority=\{i === 0\}/);
  assert.match(detailPage, /priority/);
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
  const types = await readFile(`${ROOT}/src/types/index.ts`, "utf8");
  const dishImage = await readFile(`${ROOT}/src/components/shared/DishImageWithLoading.tsx`, "utf8");
  assert.match(route, /getCachedDishImageUrl/);
  assert.match(route, /getSupabaseAdminClient/);
  assert.match(route, /storageIdForGeneratedDishImage/);
  assert.match(route, /findExistingDishImages/);
  assert.match(route, /existingImagesByIndex/);
  assert.doesNotMatch(route, /await findExistingDishImage\(dish\.name_original\)/);
  assert.match(route, /SUPABASE_LOOKUP_COOLDOWN_MS/);
  assert.match(route, /SUPABASE_LOOKUP_TIMEOUT_MS/);
  assert.match(route, /withSupabaseLookupTimeout/);
  assert.match(route, /Supabase lookup timed out/);
  assert.match(route, /Promise\.race/);
  assert.match(route, /Promise\.all\(\[/);
  assert.match(route, /supabaseLookupDisabledUntil/);
  assert.match(route, /isSupabaseLookupUnavailable\(\)/);
  assert.match(route, /markSupabaseLookupUnavailable/);
  assert.match(route, /progress:\s*\{\s*current:\s*images\.length,\s*total:\s*images\.length\s*\}/);
  assert.match(route, /rawCachedGeneratedImageUrl/);
  assert.match(route, /isRuntimeDisplayableGeneratedDishImageUrl/);
  assert.match(route, /const cachedGeneratedImageUrl = isRuntimeDisplayableGeneratedDishImageUrl\(rawCachedGeneratedImageUrl\)/);
  assert.match(route, /existingImageUrl \|\| localMatch \|\| imageLookup !== "full"/);
  assert.match(route, /localMatch\?\.card \|\| existingImageUrl \|\| cachedGeneratedImageUrl/);
  assert.match(storage, /public", "generated-dishes/);
  assert.match(storage, /export function getLocalGeneratedDishImageUrl/);
  assert.match(storage, /existsSync\(localDishImagePath\(dishId,\s*"webp"\)\)\) return localDishImageUrl\(dishId,\s*"webp"\)/);
  assert.match(storage, /STORAGE_UPLOAD_COOLDOWN_MS/);
  assert.match(storage, /storageUploadDisabledUntil/);
  assert.match(storage, /isStorageUploadDisabled\(\)/);
  assert.match(storage, /export function getStorageUploadCooldownRemainingMs/);
  assert.match(storage, /markStorageUploadUnavailable/);
  assert.match(storage, /uploadOptimizedBufferToRemote/);
  assert.match(storage, /readFile\(localDishImagePath\(dishId,\s*"webp"\)\)/);
  assert.match(storage, /return await uploadOptimizedBufferToRemote\(dishId,\s*buffer,\s*localUrl\)/);
  assert.match(storage, /existsSync\(localDishImagePath\(dishId,\s*"webp"\)\)/);
  assert.match(storage, /existsSync\(localDishImagePath\(dishId,\s*"png"\)\)/);
  assert.match(storage, /return localUrl/);
  assert.match(storage, /GENERATED_DISH_MAX_DIM/);
  assert.match(storage, /GENERATED_DISH_WEBP_QUALITY/);
  assert.match(storage, /sharp\(buffer,\s*\{\s*failOn:\s*"none"\s*\}/);
  assert.match(storage, /\.resize\(\{\s*width:\s*GENERATED_DISH_MAX_DIM,\s*height:\s*GENERATED_DISH_MAX_DIM,\s*fit:\s*"inside"/);
  assert.match(storage, /\.webp\(\{\s*quality:\s*GENERATED_DISH_WEBP_QUALITY/);
  assert.match(storage, /localDishImageUrl\(dishId,\s*"webp"\)/);
  assert.match(storage, /contentType:\s*"image\/webp"/);
  const uploadOptimizedBufferToRemoteBody = storage.match(/async function uploadOptimizedBufferToRemote[\s\S]*?\n}\n\nexport async function uploadDishImage/)?.[0] || "";
  const uploadDishImageBody = storage.match(/export async function uploadDishImage[\s\S]*?\n}\n\nexport async function getCachedDishImageUrl/)?.[0] || "";
  assert.match(uploadOptimizedBufferToRemoteBody, /const client = getSupabaseAdminClient\(\)/);
  assert.doesNotMatch(uploadOptimizedBufferToRemoteBody, /getSupabaseAdminClient\(\) \|\| getSupabaseClient\(\)/);
  assert.match(uploadDishImageBody, /uploadOptimizedBufferToRemote\(dishId,\s*buffer,\s*localUrl\)/);
  assert.match(route, /metadata\.image_generation_status = status/);
  assert.match(route, /updateImageGenerationTask\("processing"\)/);
  assert.doesNotMatch(route, /getStorageUploadCooldownRemainingMs/);
  assert.doesNotMatch(route, /image_generation_paused_storage_unavailable/);
  assert.doesNotMatch(route, /Storage upload unavailable; retry image generation later/);
  assert.ok(
    route.indexOf("generateImagesForDishes(") > route.indexOf("await updateImageGenerationTask(\"processing\")"),
    "AI image generation should continue so local generated-dishes cache can be saved even if remote storage is cooling down",
  );
  assert.match(route, /isPersistableGeneratedDishImageUrl/);
  assert.match(route, /hydrateRuntimeGeneratedDishImages/);
  assert.match(route, /if \(persistableImageUrl\)/);
  assert.doesNotMatch(route, /ai_image_url:\s*finalUrl,\s*\n\s*image_source:\s*"ai"/);
  assert.match(route, /hasDeferredImageGeneration = deferredDishesForGeneration\.length > 0/);
  assert.match(route, /finalStatus = failures\.length === 0\s*\n\s*\? \(hasDeferredImageGeneration \? "partial" : "done"\)/);
  assert.match(route, /"failed" : "partial"/);
  assert.match(route, /image_generation_progress/);
  assert.match(route, /image_generation_failed/);
  assert.match(route, /generationOrder/);
  assert.match(route, /canonicalDishNameKey/);
  assert.match(route, /generationGroups/);
  assert.match(route, /representativeDishesForGeneration/);
  assert.match(route, /const ABOVE_FOLD_IMAGE_GENERATION_LIMIT = 4/);
  assert.match(route, /function prioritizeImageGenerationDishes/);
  assert.match(route, /generationOrder\.get\(dish\) \?\? Number\.MAX_SAFE_INTEGER/);
  assert.match(route, /order < ABOVE_FOLD_IMAGE_GENERATION_LIMIT/);
  assert.match(route, /representativeDishesForGeneration = prioritizeImageGenerationDishes/);
  assert.match(route, /MENU_BACKGROUND_IMAGE_GENERATION_LIMIT/);
  assert.match(route, /BACKGROUND_IMAGE_GENERATION_LIMIT/);
  assert.match(route, /function imageGenerationLimitForDishCount/);
  assert.match(route, /MENU_LARGE_MENU_IMAGE_GENERATION_LIMIT/);
  assert.match(route, /MENU_HUGE_MENU_IMAGE_GENERATION_LIMIT/);
  assert.match(route, /totalDishes >= 160/);
  assert.match(route, /totalDishes >= 80/);
  assert.match(route, /const imageGenerationLimit = imageGenerationLimitForDishCount\(allDishes\.length\)/);
  assert.match(route, /const activeDishesForGeneration = representativeDishesForGeneration\.slice\(0,\s*imageGenerationLimit\)/);
  assert.match(route, /const deferredDishesForGeneration = representativeDishesForGeneration\.slice\(imageGenerationLimit\)/);
  assert.match(route, /\.filter\(\(\{ dish \}\) => !dish\.ai_image_url && !dish\.image_url && dish\.image_status !== "deferred"\)/);
  assert.match(route, /metadata\.image_generation_queue_total = activeDishesForGeneration\.length/);
  assert.match(route, /metadata\.image_generation_batch_limit = imageGenerationLimit/);
  assert.match(route, /metadata\.image_generation_deferred_total = deferredDishesForGeneration\.length/);
  assert.match(route, /metadata\.image_generation_queued_total = Math\.max\(0,\s*activeDishesForGeneration\.length - IMAGE_GENERATION_CONCURRENCY\)/);
  assert.match(route, /for \(const deferredDish of deferredDishesForGeneration\)/);
  assert.match(route, /duplicateDish\.image_status = "deferred"/);
  assert.match(route, /generateImagesForDishes\(\s*activeDishesForGeneration/);
  assert.match(route, /for \(const duplicateDish of duplicateDishes\)/);
  assert.match(route, /duplicateDish\.ai_image_url = finalUrl/);
  assert.match(route, /metadata\.image_generation_deduped_count/);
  assert.match(route, /if \(!isRuntimeDisplayableGeneratedDishImageUrl\(publicUrl\)\)/);
  assert.match(route, /Generated image URL could not be saved to a displayable cache/);
  assert.doesNotMatch(route, /if \(!publicUrl\) return/);
  assert.doesNotMatch(route, /publicUrl \|\| tempUrl/);
  assert.doesNotMatch(route, /generateImagesForDishes\([\s\S]*,\s*1,\s*\)/);
  assert.match(types, /image_status\?: "pending" \| "generating" \| "deferred" \| "done" \| "failed"/);
  assert.match(types, /image_generation_deferred_total\?: number/);
  assert.match(types, /image_generation_batch_limit\?: number/);
  assert.match(dishImage, /dish\.image_status === "deferred"/);
  assert.match(dishImage, /稍后补图/);
  assert.match(appPage, /dish\.image_status === "deferred"/);
  assert.match(imageGen, /await onImageReady/);
  assert.match(imageGen, /onImageFailed/);
  assert.match(imageGen, /retries = IMAGE_GENERATION_RETRIES/);
  assert.match(imageGen, /idx >= queue\.length && running === 0\) resolve/);
  assert.doesNotMatch(imageGen, /queue\.length >= idx && running === 0\) resolve/);
  assert.match(appPage, /hasPendingImages/);
  assert.match(appPage, /MAX_IDLE_POLLS/);
  assert.doesNotMatch(appPage, /const MAX_POLLS = 20/);
});

test("AI image generation polling and request spacing are configurable for faster backfill", async () => {
  const imageGen = await readFile(`${ROOT}/src/lib/ai/image-gen.ts`, "utf8");

  assert.match(imageGen, /MENU_IMAGE_GENERATION_POLL_INTERVAL_MS/);
  assert.match(imageGen, /MENU_IMAGE_GENERATION_REQUEST_INTERVAL_MS/);
  assert.match(imageGen, /DEFAULT_POLL_INTERVAL_MS\s*=\s*1500/);
  assert.match(imageGen, /DEFAULT_REQUEST_INTERVAL_MS\s*=\s*1200/);
  assert.match(imageGen, /envInt\(\s*"MENU_IMAGE_GENERATION_POLL_INTERVAL_MS"/);
  assert.match(imageGen, /envInt\(\s*"MENU_IMAGE_GENERATION_REQUEST_INTERVAL_MS"/);
  assert.doesNotMatch(imageGen, /const POLL_INTERVAL = 3000/);
  assert.doesNotMatch(imageGen, /const REQUEST_INTERVAL_MS = 3000/);
});

test("Singapore image generation uses z-image-turbo for fast food-card images", async () => {
  const envExample = await readFile(`${ROOT}/.env.example`, "utf8");
  assert.match(envExample, /ALIBABA_MODEL_STUDIO_WORKSPACE_ID=/);
  assert.match(envExample, /ALIBABA_MODEL_STUDIO_API_KEY=/);
  assert.match(envExample, /ALIBABA_IMAGE_FAST_MODEL=z-image-turbo/);
  assert.match(envExample, /ALIBABA_IMAGE_FALLBACK_MODEL=wan2\.7-image/);
  assert.match(envExample, /ALIBABA_IMAGE_QUALITY_KINDS=drink,soup,seafood,meal/);
  assert.match(envExample, /ALIBABA_IMAGE_REQUEST_INTERVAL_MS=550/);

  const previous = {
    provider: process.env.IMAGE_PROVIDER,
    baseUrl: process.env.ALIBABA_MODEL_STUDIO_BASE_URL,
    apiKey: process.env.ALIBABA_MODEL_STUDIO_API_KEY,
    qualityKinds: process.env.ALIBABA_IMAGE_QUALITY_KINDS,
    fetch: globalThis.fetch,
  };
  const calls = [];
  process.env.IMAGE_PROVIDER = "wan";
  process.env.ALIBABA_MODEL_STUDIO_BASE_URL = "https://workspace.ap-southeast-1.maas.aliyuncs.com/api/v1";
  process.env.ALIBABA_MODEL_STUDIO_API_KEY = "test-singapore-key";
  process.env.ALIBABA_IMAGE_QUALITY_KINDS = "drink,soup,seafood,meal";
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init, body: JSON.parse(String(init?.body || "{}")) });
    return new Response(JSON.stringify({
      output: {
        choices: [{ message: { content: [{ image: "https://dashscope-result-sg.oss-ap-southeast-1.aliyuncs.com/pizza.png" }] } }],
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const { generateDishImage } = await loadTsModule(`${ROOT}/src/lib/ai/image-gen.ts`);
    const url = await generateDishImage({
      name_original: "Pizza Margherita",
      category: "pizza",
      ingredients: ["tomato", "mozzarella", "basil"],
    });

    assert.equal(url, "https://dashscope-result-sg.oss-ap-southeast-1.aliyuncs.com/pizza.png");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://workspace.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation");
    assert.equal(calls[0].body.model, "z-image-turbo");
    assert.equal(calls[0].body.parameters.prompt_extend, false);
    assert.equal(calls[0].body.parameters.size, "1024*1024");
    assert.ok(calls[0].body.input.messages[0].content[0].text.length <= 800);
    assert.equal(calls[0].init.headers.Authorization, "Bearer test-singapore-key");
  } finally {
    if (previous.provider === undefined) delete process.env.IMAGE_PROVIDER;
    else process.env.IMAGE_PROVIDER = previous.provider;
    if (previous.baseUrl === undefined) delete process.env.ALIBABA_MODEL_STUDIO_BASE_URL;
    else process.env.ALIBABA_MODEL_STUDIO_BASE_URL = previous.baseUrl;
    if (previous.apiKey === undefined) delete process.env.ALIBABA_MODEL_STUDIO_API_KEY;
    else process.env.ALIBABA_MODEL_STUDIO_API_KEY = previous.apiKey;
    if (previous.qualityKinds === undefined) delete process.env.ALIBABA_IMAGE_QUALITY_KINDS;
    else process.env.ALIBABA_IMAGE_QUALITY_KINDS = previous.qualityKinds;
    globalThis.fetch = previous.fetch;
  }
});

test("Singapore image generation never reuses a Beijing Qwen key and does not mask authentication errors", async () => {
  const imageGen = await readFile(`${ROOT}/src/lib/ai/image-gen.ts`, "utf8");
  assert.match(imageGen, /Array\.from\(identity\)/);
  assert.match(imageGen, /MODEL_STUDIO_MIN_REQUEST_INTERVAL_MS/);
  assert.doesNotMatch(imageGen, /process\.env\.DASHSCOPE_API_KEY\s*\|\|\s*process\.env\.QWEN_API_KEY/);

  const previous = {
    provider: process.env.IMAGE_PROVIDER,
    baseUrl: process.env.ALIBABA_MODEL_STUDIO_BASE_URL,
    apiKey: process.env.ALIBABA_MODEL_STUDIO_API_KEY,
    qwenKey: process.env.QWEN_API_KEY,
    qualityKinds: process.env.ALIBABA_IMAGE_QUALITY_KINDS,
    interval: process.env.ALIBABA_IMAGE_REQUEST_INTERVAL_MS,
    fetch: globalThis.fetch,
  };
  process.env.IMAGE_PROVIDER = "wan";
  process.env.ALIBABA_MODEL_STUDIO_BASE_URL = "https://workspace.ap-southeast-1.maas.aliyuncs.com/api/v1";
  delete process.env.ALIBABA_MODEL_STUDIO_API_KEY;
  process.env.QWEN_API_KEY = "beijing-key-must-not-be-reused";
  process.env.ALIBABA_IMAGE_QUALITY_KINDS = "drink,soup,seafood,meal";
  process.env.ALIBABA_IMAGE_REQUEST_INTERVAL_MS = "250";
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls++;
    return new Response("unauthorized", { status: 401 });
  };

  try {
    const { generateDishImage } = await loadTsModule(`${ROOT}/src/lib/ai/image-gen.ts`);
    assert.equal(await generateDishImage({ name_original: "Pizza Marinara", category: "pizza" }), null);
    assert.equal(fetchCalls, 0);
  } finally {
    if (previous.provider === undefined) delete process.env.IMAGE_PROVIDER;
    else process.env.IMAGE_PROVIDER = previous.provider;
    if (previous.baseUrl === undefined) delete process.env.ALIBABA_MODEL_STUDIO_BASE_URL;
    else process.env.ALIBABA_MODEL_STUDIO_BASE_URL = previous.baseUrl;
    if (previous.apiKey === undefined) delete process.env.ALIBABA_MODEL_STUDIO_API_KEY;
    else process.env.ALIBABA_MODEL_STUDIO_API_KEY = previous.apiKey;
    if (previous.qwenKey === undefined) delete process.env.QWEN_API_KEY;
    else process.env.QWEN_API_KEY = previous.qwenKey;
    if (previous.qualityKinds === undefined) delete process.env.ALIBABA_IMAGE_QUALITY_KINDS;
    else process.env.ALIBABA_IMAGE_QUALITY_KINDS = previous.qualityKinds;
    if (previous.interval === undefined) delete process.env.ALIBABA_IMAGE_REQUEST_INTERVAL_MS;
    else process.env.ALIBABA_IMAGE_REQUEST_INTERVAL_MS = previous.interval;
    globalThis.fetch = previous.fetch;
  }

  process.env.IMAGE_PROVIDER = "wan";
  process.env.ALIBABA_MODEL_STUDIO_BASE_URL = "https://workspace.ap-southeast-1.maas.aliyuncs.com/api/v1";
  process.env.ALIBABA_MODEL_STUDIO_API_KEY = "test-singapore-key";
  process.env.ALIBABA_IMAGE_QUALITY_KINDS = "drink,soup,seafood,meal";
  process.env.ALIBABA_IMAGE_REQUEST_INTERVAL_MS = "250";
  const models = [];
  globalThis.fetch = async (_url, init) => {
    models.push(JSON.parse(String(init?.body || "{}")).model);
    return new Response(JSON.stringify({ code: "InvalidApiKey", message: "invalid key" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    const { generateDishImage } = await loadTsModule(`${ROOT}/src/lib/ai/image-gen.ts`);
    assert.equal(await generateDishImage({ name_original: "Pizza Marinara", category: "pizza" }), null);
    assert.deepEqual(models, ["z-image-turbo"]);
  } finally {
    if (previous.provider === undefined) delete process.env.IMAGE_PROVIDER;
    else process.env.IMAGE_PROVIDER = previous.provider;
    if (previous.baseUrl === undefined) delete process.env.ALIBABA_MODEL_STUDIO_BASE_URL;
    else process.env.ALIBABA_MODEL_STUDIO_BASE_URL = previous.baseUrl;
    if (previous.apiKey === undefined) delete process.env.ALIBABA_MODEL_STUDIO_API_KEY;
    else process.env.ALIBABA_MODEL_STUDIO_API_KEY = previous.apiKey;
    if (previous.qwenKey === undefined) delete process.env.QWEN_API_KEY;
    else process.env.QWEN_API_KEY = previous.qwenKey;
    if (previous.qualityKinds === undefined) delete process.env.ALIBABA_IMAGE_QUALITY_KINDS;
    else process.env.ALIBABA_IMAGE_QUALITY_KINDS = previous.qualityKinds;
    if (previous.interval === undefined) delete process.env.ALIBABA_IMAGE_REQUEST_INTERVAL_MS;
    else process.env.ALIBABA_IMAGE_REQUEST_INTERVAL_MS = previous.interval;
    globalThis.fetch = previous.fetch;
  }
});

test("Singapore image generation falls back once to wan2.7-image when the fast model fails", async () => {
  const previous = {
    provider: process.env.IMAGE_PROVIDER,
    baseUrl: process.env.ALIBABA_MODEL_STUDIO_BASE_URL,
    apiKey: process.env.ALIBABA_MODEL_STUDIO_API_KEY,
    qualityKinds: process.env.ALIBABA_IMAGE_QUALITY_KINDS,
    fetch: globalThis.fetch,
  };
  const models = [];
  process.env.IMAGE_PROVIDER = "wan";
  process.env.ALIBABA_MODEL_STUDIO_BASE_URL = "https://workspace.ap-southeast-1.maas.aliyuncs.com/api/v1";
  process.env.ALIBABA_MODEL_STUDIO_API_KEY = "test-singapore-key";
  process.env.ALIBABA_IMAGE_QUALITY_KINDS = "drink,soup,seafood,meal";
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body || "{}"));
    models.push(body.model);
    if (body.model === "z-image-turbo") {
      return new Response(JSON.stringify({ code: "ModelBusy", message: "busy" }), { status: 503 });
    }
    return new Response(JSON.stringify({
      output: {
        choices: [{ message: { content: [{ image: "https://dashscope-result-sg.oss-ap-southeast-1.aliyuncs.com/pasta.png" }] } }],
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const { generateDishImage } = await loadTsModule(`${ROOT}/src/lib/ai/image-gen.ts`);
    const url = await generateDishImage({ name_original: "Spaghetti Carbonara", category: "pasta" });
    assert.equal(url, "https://dashscope-result-sg.oss-ap-southeast-1.aliyuncs.com/pasta.png");
    assert.deepEqual(models, ["z-image-turbo", "wan2.7-image"]);
  } finally {
    if (previous.provider === undefined) delete process.env.IMAGE_PROVIDER;
    else process.env.IMAGE_PROVIDER = previous.provider;
    if (previous.baseUrl === undefined) delete process.env.ALIBABA_MODEL_STUDIO_BASE_URL;
    else process.env.ALIBABA_MODEL_STUDIO_BASE_URL = previous.baseUrl;
    if (previous.apiKey === undefined) delete process.env.ALIBABA_MODEL_STUDIO_API_KEY;
    else process.env.ALIBABA_MODEL_STUDIO_API_KEY = previous.apiKey;
    if (previous.qualityKinds === undefined) delete process.env.ALIBABA_IMAGE_QUALITY_KINDS;
    else process.env.ALIBABA_IMAGE_QUALITY_KINDS = previous.qualityKinds;
    globalThis.fetch = previous.fetch;
  }
});

test("known difficult food categories prefer wan2.7-image over the fast model", async () => {
  const previous = {
    provider: process.env.IMAGE_PROVIDER,
    baseUrl: process.env.ALIBABA_MODEL_STUDIO_BASE_URL,
    apiKey: process.env.ALIBABA_MODEL_STUDIO_API_KEY,
    qualityKinds: process.env.ALIBABA_IMAGE_QUALITY_KINDS,
    fetch: globalThis.fetch,
  };
  const calls = [];
  process.env.IMAGE_PROVIDER = "wan";
  process.env.ALIBABA_MODEL_STUDIO_BASE_URL = "https://workspace.ap-southeast-1.maas.aliyuncs.com/api/v1";
  process.env.ALIBABA_MODEL_STUDIO_API_KEY = "test-singapore-key";
  process.env.ALIBABA_IMAGE_QUALITY_KINDS = "drink,soup,seafood,meal";
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body || "{}"));
    calls.push(body);
    return new Response(JSON.stringify({
      output: {
        choices: [{ message: { content: [{ image: "https://dashscope-result-sg.oss-ap-southeast-1.aliyuncs.com/soup.png" }] } }],
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const { generateDishImage } = await loadTsModule(`${ROOT}/src/lib/ai/image-gen.ts`);
    await generateDishImage({ name_original: "Lobster Bisque", category: "soup" });
    assert.deepEqual(calls.map((call) => call.model), ["wan2.7-image"]);
    assert.equal(calls[0].parameters.thinking_mode, false);
  } finally {
    if (previous.provider === undefined) delete process.env.IMAGE_PROVIDER;
    else process.env.IMAGE_PROVIDER = previous.provider;
    if (previous.baseUrl === undefined) delete process.env.ALIBABA_MODEL_STUDIO_BASE_URL;
    else process.env.ALIBABA_MODEL_STUDIO_BASE_URL = previous.baseUrl;
    if (previous.apiKey === undefined) delete process.env.ALIBABA_MODEL_STUDIO_API_KEY;
    else process.env.ALIBABA_MODEL_STUDIO_API_KEY = previous.apiKey;
    if (previous.qualityKinds === undefined) delete process.env.ALIBABA_IMAGE_QUALITY_KINDS;
    else process.env.ALIBABA_IMAGE_QUALITY_KINDS = previous.qualityKinds;
    globalThis.fetch = previous.fetch;
  }
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
    isReusableExistingImageUrl("https://dishlens.wukongmkt.com/generated-dishes/generated-old-local-only.png"),
    false,
  );
  assert.equal(
    isReusableExistingImageUrl("https://bucket.oss-ap-southeast-1.aliyuncs.com/generated-dishes/generated-stable.webp"),
    true,
  );
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
    "/dishes/generated-cache/generated-truffle-pecorino-fries-vg-dfo.webp",
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
  assert.equal(isReusableExistingImageUrl("/dishes/pizza-marinara.webp"), true);
  assert.equal(
    isReusableExistingImageUrl("https://gbkallzbksmaahzvxezq.supabase.co/storage/v1/object/public/dishes/generated-dish-xoismf.png"),
    true,
  );
  assert.equal(
    isReusableExistingImageUrl("https://dashscope-result-wlcb-acdr-1.oss-cn-wulanchabu-acdr-1.aliyuncs.com/temporary.png"),
    false,
  );
});

test("task responses strip machine-local generated dish image URLs before reaching the UI", async () => {
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
          {
            id: "absolute-local",
            name_original: "Absolute local image",
            ai_image_url: "https://dishlens.wukongmkt.com/generated-dishes/generated-old-local-only.png",
            image_status: "done",
            image_source: "ai",
          },
          {
            id: "stable-oss",
            name_original: "Stable OSS image",
            ai_image_url: "https://bucket.oss-ap-southeast-1.aliyuncs.com/generated-dishes/generated-stable.webp",
            image_status: "done",
            image_source: "ai",
          },
          {
            id: "matcha-roll",
            name_original: "MATCHA ROLL",
            name_translated: { zh: "抹茶卷" },
            description: { zh: "抹茶戚风蛋糕与覆盆子夹心" },
            category: "drink",
            ai_image_url: "/dishes/apple-pie.webp",
            image_status: "done",
            image_source: "mixed",
          },
        ],
      },
    ],
  });

  const dishes = sanitized.pages[0].dishes;
  assert.equal(dishes[0].ai_image_url, undefined);
  assert.equal(dishes[0].image_status, "failed");
  assert.equal(dishes[1].ai_image_url, undefined);
  assert.equal(dishes[1].image_status, "failed");
  assert.equal(dishes[2].ai_image_url, undefined);
  assert.equal(dishes[2].image_status, "failed");
  assert.match(dishes[3].ai_image_url, /oss-ap-southeast-1\.aliyuncs\.com/);
  assert.equal(dishes[4].category, "dessert");
  assert.equal(sanitized.metadata.image_sanitized_count, 3);
  assert.equal(sanitized.metadata.category_sanitized_count, 1);
});

test("runtime generated dish images are served outside the build-time public asset manifest", async () => {
  const routePath = `${ROOT}/src/app/generated-dishes/[file]/route.ts`;
  const route = await readFile(routePath, "utf8");
  const sanitizer = await readFile(`${ROOT}/src/lib/server/sanitize-translation-result.ts`, "utf8");
  const diagnostics = await readFile(`${ROOT}/scripts/diagnose-dish-images.mjs`, "utf8");
  const optimizer = await readFile(`${ROOT}/scripts/optimize-generated-dish-images.mjs`, "utf8");

  assert.match(route, /join\(process\.cwd\(\), "public", "generated-dishes"\)/);
  assert.match(route, /params:\s*Promise<\{\s*file:\s*string\s*\}>/);
  assert.match(route, /decodeURIComponent\(params\.file \|\| ""\)/);
  assert.match(route, /allowedTypes/);
  assert.match(route, /\.png/);
  assert.match(route, /\.webp/);
  assert.match(route, /basename\(fileName\) !== fileName/);
  assert.match(route, /readFile\(filePath\)/);
  assert.match(route, /contentType/);
  assert.match(route, /image\/png/);
  assert.match(route, /image\/webp/);
  assert.match(route, /fallbackWebpFileName/);
  assert.match(route, /\.replace\(\/\\\.png\$\/i, "\.webp"\)/);
  assert.match(route, /Cache-Control": "public, max-age=31536000, immutable"/);
  assert.match(sanitizer, /isMachineLocalGeneratedDishUrl/);
  assert.match(sanitizer, /unsafe to preserve across deploys/);
  assert.match(diagnostics, /generatedWebpPath/);
  assert.match(diagnostics, /generatedPngPath/);
  assert.match(optimizer, /sharp\(inputPath, \{ failOn: "none" \}\)/);
  assert.match(optimizer, /\.webp\(\{ quality: WEBP_QUALITY/);
  assert.match(optimizer, /--prune-png/);
});

test("legacy knowledge dish image URLs fall back to optimized webp assets", async () => {
  const routePath = `${ROOT}/src/app/dishes/[file]/route.ts`;
  const route = await readFile(routePath, "utf8");

  assert.match(route, /join\(process\.cwd\(\), "public", "dishes"\)/);
  assert.match(route, /params:\s*Promise<\{\s*file:\s*string\s*\}>/);
  assert.match(route, /decodeURIComponent\(params\.file \|\| ""\)/);
  assert.match(route, /allowedTypes/);
  assert.match(route, /\.jpeg/);
  assert.match(route, /\.jpg/);
  assert.match(route, /\.png/);
  assert.match(route, /\.webp/);
  assert.match(route, /basename\(fileName\) !== fileName/);
  assert.match(route, /fallbackWebpFileName/);
  assert.match(route, /\.replace\(\/\\\.\(png\|jpe\?g\)\$\/i, "\.webp"\)/);
  assert.match(route, /readFile\(filePath\)/);
  assert.match(route, /image\/webp/);
  assert.match(route, /Cache-Control": "public, max-age=31536000, immutable"/);
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

test("shared menu pages use app-readable food card typography", async () => {
  const sharedMenu = await readFile(`${ROOT}/src/components/share/SharedMenuPage.tsx`, "utf8");

  assert.match(sharedMenu, /sharedMenuTextStyles/);
  assert.match(sharedMenu, /cardTitle:[\s\S]*fontSize:\s*18/);
  assert.match(sharedMenu, /cardBody:[\s\S]*fontSize:\s*12\.5/);
  assert.match(sharedMenu, /recommendationBox/);
  assert.match(sharedMenu, /点击菜品查看详情和点单建议/);
  assert.doesNotMatch(sharedMenu, /fontSize:\s*8(?:\.5)?[,}]/);
  assert.doesNotMatch(sharedMenu, /text-\[8px\]|text-\[7px\]/);
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
  assert.match(script, /promoted_generated_cache/);
  assert.match(script, /generated_local_unstable/);
  assert.match(script, /generated_local_promoted_source_files/);
  assert.match(script, /generated_local_unstable_unpromoted/);
  assert.match(script, /supabase_db/);
  assert.match(script, /ai_pending/);
  assert.match(script, /matchDishKnowledgeImage/);
  assert.match(script, /storageIdForGeneratedDishImage/);
  assert.match(script, /sync_to_supabase_for_stable_share_and_deploy/);
  assert.match(script, /local_knowledge_coverage_percent/);
  assert.match(script, /stable_local_with_promoted_coverage_percent/);
  assert.match(script, /stable_local_deduped_coverage_percent/);
  assert.match(script, /promoted_generated_cache_unique_new/);
  assert.match(script, /promoted_generated_cache_duplicate_local/);
  assert.match(script, /pollinations_remote/);
  assert.match(script, /Math\.imul\(31,\s*h\)/);
  assert.doesNotMatch(script, /layer:\s*"generated_local"/);
});

test("dish image diagnostics separates promoted runtime source files from unstable files", async () => {
  const { stdout } = await execFileAsync(
    "node",
    ["scripts/diagnose-dish-images.mjs", "--summary"],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_URL: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
        SUPABASE_ANON_KEY: "",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      },
      timeout: 10_000,
    },
  );
  const summary = JSON.parse(stdout);
  assert.ok(summary.generated_local_promoted_source_files >= 0);
  assert.ok(summary.generated_local_unstable_unpromoted >= 0);
  assert.equal(
    summary.generated_local_unstable,
    summary.generated_local_promoted_source_files + summary.generated_local_unstable_unpromoted,
  );
  assert.ok(summary.promoted_generated_cache_unique_new >= 0);
  assert.ok(summary.promoted_generated_cache_duplicate_local >= 0);
  assert.equal(
    summary.promoted_generated_cache,
    summary.promoted_generated_cache_unique_new + summary.promoted_generated_cache_duplicate_local,
  );
  assert.ok(summary.stable_local_deduped_coverage_percent <= summary.stable_local_with_promoted_coverage_percent);
  assert.ok(summary.promoted_generated_cache_duplicate_local >= 1);
});

test("dish image diagnostics reports deploy-risky local image assets", async () => {
  const script = await readFile(`${ROOT}/scripts/diagnose-dish-images.mjs`, "utf8");
  assert.match(script, /execFileSync/);
  assert.match(script, /git",\s*\["ls-files",\s*"-z"/);
  assert.match(script, /split\("\\0"\)/);
  assert.doesNotMatch(script, /split\(\/\\r\?\\n\/\)/);
  assert.match(script, /local_image_assets_total/);
  assert.match(script, /local_image_assets_missing/);
  assert.match(script, /local_image_assets_untracked/);
  assert.match(script, /local_image_assets_deploy_ready/);
  assert.match(script, /--fail-on-deploy-risk/);
  assert.match(script, /process\.exitCode\s*=\s*1/);
  assert.match(script, /referencedStableLocalImageUrls/);

  const { stdout } = await execFileAsync(
    "node",
    ["scripts/diagnose-dish-images.mjs", "--summary"],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_URL: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
        SUPABASE_ANON_KEY: "",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      },
      timeout: 10_000,
    },
  );
  const summary = JSON.parse(stdout);
  assert.ok(Number.isInteger(summary.local_image_assets_total));
  assert.ok(Number.isInteger(summary.local_image_assets_missing));
  assert.ok(Number.isInteger(summary.local_image_assets_untracked));
  assert.equal(typeof summary.local_image_assets_deploy_ready, "boolean");
  assert.ok(summary.local_image_assets_total >= summary.local_image_assets_missing);
  assert.ok(summary.local_image_assets_total >= summary.local_image_assets_untracked);

  await execFileAsync(
    "node",
    ["scripts/diagnose-dish-images.mjs", "--summary", "--fail-on-deploy-risk"],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_URL: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
        SUPABASE_ANON_KEY: "",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      },
      timeout: 10_000,
    },
  );
});

test("dish image diagnostics mirrors production aliases for local knowledge matches", async () => {
  const { stdout } = await execFileAsync(
    "node",
    ["scripts/diagnose-dish-images.mjs", "Unagi Don", "Warabimochi", "Doenjang Jjigae", "Hainan Chicken Rice", "Japanese Curry", "Tsukemen", "Tteokguk", "Udon", "Yudofu", "Gyudon", "Yukgaejang", "Burrata", "Pizza Burrata e Prosciutto", "Smorrebrod", "Takoyaki", "Taiyaki", "Thai Khao Man Gai", "Japanese Omelette", "Tebasaki", "Tortellini Panna", "tempura-vegetable", "Sydney Rock Oysters, Mignonette", "Mushroom Bruschetta", "Turkish Gozleme", "Middle Eastern Kibbeh", "PROSCIUTTO GFO DF", "LONG PADDOCK DRIFTWOOD LGFO", "BANKSIA LGFO"],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_URL: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
        SUPABASE_ANON_KEY: "",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      },
      timeout: 10_000,
    },
  );
  const rows = JSON.parse(stdout);
  assert.equal(rows[0].layer, "local_knowledge");
  assert.equal(rows[0].id, "unagi-don");
  assert.equal(rows[1].layer, "local_knowledge");
  assert.equal(rows[1].id, "warabimochi");
  assert.equal(rows[2].layer, "local_knowledge");
  assert.equal(rows[2].id, "doenjang-jjigae");
  assert.equal(rows[3].layer, "local_knowledge");
  assert.equal(rows[3].id, "hainanese-chicken-rice");
  assert.equal(rows[4].layer, "local_knowledge");
  assert.equal(rows[4].id, "japanese-curry");
  assert.equal(rows[5].layer, "local_knowledge");
  assert.equal(rows[5].id, "tsukemen");
  assert.equal(rows[6].layer, "local_knowledge");
  assert.equal(rows[6].id, "tteokguk");
  assert.equal(rows[7].layer, "local_knowledge");
  assert.equal(rows[7].id, "udon");
  assert.equal(rows[8].layer, "local_knowledge");
  assert.equal(rows[8].id, "yudofu");
  assert.equal(rows[9].layer, "local_knowledge");
  assert.equal(rows[9].id, "gyudon");
  assert.equal(rows[10].layer, "local_knowledge");
  assert.equal(rows[10].id, "yukgaejang");
  assert.equal(rows[11].layer, "local_knowledge");
  assert.equal(rows[11].id, "burrata-con-pomodorini");
  assert.equal(rows[12].layer, "local_knowledge");
  assert.equal(rows[12].id, "pizza-burrata-prosciutto");
  assert.equal(rows[13].layer, "local_knowledge");
  assert.equal(rows[13].id, "smorrebrod");
  assert.equal(rows[14].layer, "local_knowledge");
  assert.equal(rows[14].id, "takoyaki");
  assert.equal(rows[15].layer, "local_knowledge");
  assert.equal(rows[15].id, "taiyaki");
  assert.equal(rows[16].layer, "local_knowledge");
  assert.equal(rows[16].id, "khao-man-gai-thai");
  assert.equal(rows[17].layer, "local_knowledge");
  assert.equal(rows[17].id, "tamagoyaki");
  assert.equal(rows[18].layer, "local_knowledge");
  assert.equal(rows[18].id, "tebasaki");
  assert.equal(rows[19].layer, "local_knowledge");
  assert.equal(rows[19].id, "tortellini-panna");
  assert.equal(rows[20].layer, "local_knowledge");
  assert.equal(rows[20].id, "tempura-vegetable");
  assert.equal(rows[21].layer, "promoted_generated_cache");
  assert.ok([
    "local-generated-sydney-rock-oysters-mignonette-l-gf-df",
    "local-generated-sydney-rock-oysters-mignonette-lg-of",
  ].includes(rows[21].id));
  assert.equal(rows[22].layer, "local_knowledge");
  assert.equal(rows[22].id, "bruschetta-ai-funghi");
  assert.equal(rows[23].layer, "local_knowledge");
  assert.equal(rows[23].id, "gozleme");
  assert.equal(rows[24].layer, "local_knowledge");
  assert.equal(rows[24].id, "kibbeh-me");
  assert.equal(rows[25].layer, "local_knowledge");
  assert.equal(rows[25].id, "prosciutto-e-melone");
  assert.equal(rows[26].layer, "promoted_generated_cache");
  assert.equal(rows[26].id, "local-generated-long-paddock-driftwood-l-gfo");
  assert.equal(rows[27].layer, "promoted_generated_cache");
  assert.equal(rows[27].id, "local-generated-banksia-l-gfo");
});

test("supabase storage diagnostics reports configuration and upload health without leaking secrets", async () => {
  const scriptPath = `${ROOT}/scripts/diagnose-supabase-storage.mjs`;
  const script = await readFile(scriptPath, "utf8");
  const dbClient = await readFile(`${ROOT}/src/lib/db/supabase.ts`, "utf8");

  assert.match(script, /readLocalEnvFile/);
  assert.match(script, /\.env\.local/);
  assert.match(script, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(script, /SUPABASE_SECRET_KEY/);
  assert.match(script, /diagnoseNetwork/);
  assert.match(script, /lookup\(hostname,\s*\{\s*all:\s*true\s*\}\)/);
  assert.match(script, /isPrivateOrReservedIp/);
  assert.match(script, /198 && \(b === 18 \|\| b === 19\)/);
  assert.match(script, /VPN\/proxy\/DNS routing/);
  assert.match(script, /Not checked because network diagnostics failed/);
  assert.match(script, /storage\.from\(BUCKET\)\.upload/);
  assert.match(script, /contentType:\s*"image\/webp"/);
  assert.match(script, /upsert:\s*true/);
  assert.match(script, /getPublicUrl/);
  assert.match(script, /remove\(\[objectPath\]\)/);
  assert.match(script, /redact/);
  assert.match(script, /service_key_present:\s*Boolean\(SERVICE_KEY\)/);
  assert.doesNotMatch(script, /service_key:\s*redact\(SERVICE_KEY\)/);
  assert.doesNotMatch(script, /console\.log\(process\.env/);
  assert.match(dbClient, /process\.env\.SUPABASE_SERVICE_ROLE_KEY \|\| process\.env\.SUPABASE_SECRET_KEY/);

  const { execFile } = await import("node:child_process");
  const { mkdtemp } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);
  const emptyCwd = await mkdtemp(join(tmpdir(), "dishlens-empty-env-"));
  const { stdout } = await execFileAsync(process.execPath, [scriptPath], {
    cwd: emptyCwd,
    env: {
      PATH: process.env.PATH || "",
      NODE_ENV: "test",
    },
  });
  const report = JSON.parse(stdout);
  assert.equal(report.ok, false);
  assert.equal(report.checks.config.ok, false);
  assert.match(report.checks.config.message, /SUPABASE.*service/i);
  assert.equal(JSON.stringify(report).includes("SUPABASE_SERVICE_ROLE_KEY="), false);
  assert.equal(JSON.stringify(report).includes("sb_secret_"), false);
});

test("AI provider modules defer secret validation until the first real request", async () => {
  const qwen = await readFile(`${ROOT}/src/lib/ai/qwen.ts`, "utf8");

  assert.doesNotMatch(qwen, /const qwen = new OpenAI\(/);
  assert.match(qwen, /function getQwenClient\(\): OpenAI/);
  assert.match(qwen, /QWEN_API_KEY is required/);
  assert.match(qwen, /getQwenClient\(\)\.chat\.completions\.create/);
});

test("generated image persistence keeps stable remote URLs and rejects production-local fallbacks", async () => {
  const translateRoute = await readFile(`${ROOT}/src/app/api/v1/translate/menu/route.ts`, "utf8");
  const hydration = await readFile(`${ROOT}/src/lib/server/runtime-generated-image-hydration.ts`, "utf8");

  assert.match(translateRoute, /if \(isStableRemoteGeneratedDishImageUrl\(value\)\) return false/);
  assert.match(hydration, /url\.startsWith\("\/generated-dishes\/"\)\) return process\.env\.NODE_ENV !== "production"/);
  assert.match(hydration, /if \(process\.env\.NODE_ENV === "production"\) return result/);
});

test("paid image generation uses trusted proxy identity and expires rate buckets", async () => {
  const route = await readFile(`${ROOT}/src/app/api/v1/dish/[id]/generate-image/route.ts`, "utf8");

  assert.match(route, /request\.headers\.get\("x-real-ip"\)/);
  assert.match(route, /\.at\(-1\)/);
  assert.match(route, /function cleanupExpiredRateBuckets/);
  assert.match(route, /dishImageGenerationRateBuckets\.delete\(key\)/);
  assert.match(route, /RATE_BUCKET_MAX_ENTRIES = 5_000/);
  assert.match(route, /function enforceRateBucketLimit/);
  assert.doesNotMatch(route, /lastRateBucketCleanupAt < GLOBAL_WINDOW_MS && dishImageGenerationRateBuckets\.size/);
});

test("browser cache hints never bypass fresh server task authorization", async () => {
  const apiClient = await readFile(`${ROOT}/src/lib/api-client.ts`, "utf8");

  assert.match(apiClient, /translate:browser_cache_hint/);
  assert.doesNotMatch(apiClient, /return rawBrowserCached/);
  assert.doesNotMatch(apiClient, /return compressedBrowserCached/);
});

test("production builds self-host editorial fonts without Google network access", async () => {
  const layout = await readFile(`${ROOT}/src/app/layout.tsx`, "utf8");
  const packageJson = JSON.parse(await readFile(`${ROOT}/package.json`, "utf8"));

  assert.doesNotMatch(layout, /next\/font\/google/);
  assert.match(layout, /@fontsource-variable\/inter\/wght\.css/);
  assert.match(layout, /@fontsource\/poppins\/400\.css/);
  assert.match(layout, /@fontsource\/poppins\/800\.css/);
  assert.match(layout, /@fontsource-variable\/source-serif-4\/wght\.css/);
  assert.match(layout, /@fontsource-variable\/source-serif-4\/wght-italic\.css/);
  assert.equal(packageJson.dependencies["@fontsource-variable/inter"], "5.3.0");
  assert.equal(packageJson.dependencies["@fontsource/poppins"], "5.3.0");
  assert.equal(packageJson.dependencies["@fontsource-variable/source-serif-4"], "5.3.0");
});

test("menu flow benchmark measures upload, first result, text completion, and image backfill", async () => {
  const script = await readFile(`${ROOT}/scripts/benchmark-menu-flow.mjs`, "utf8");

  assert.match(script, /benchmark-menu-flow/);
  assert.match(script, /--base-url/);
  assert.match(script, /--repeat/);
  assert.match(script, /--cache-probe/);
  assert.match(script, /--cache-bust/);
  assert.match(script, /--no-cache-bust/);
  assert.match(script, /--image-timeout-ms/);
  assert.match(script, /function parseIntOption/);
  assert.match(script, /Number\.isFinite\(parsed\) \? parsed : fallback/);
  assert.match(script, /options\.imageTimeoutMs = Math\.max\(0,\s*parseIntOption/);
  assert.match(script, /function bytesToHex/);
  assert.match(script, /async function buildClientImageHash/);
  assert.match(script, /import sharp from "sharp"/);
  assert.match(script, /DEFAULT_SERVER_IMAGE_MAX_DIM = 1400/);
  assert.match(script, /DEFAULT_SERVER_IMAGE_QUALITY = 76/);
  assert.match(script, /async function normalizeBenchmarkImageForServerHash/);
  assert.match(script, /\.resize\(\{\s*width: DEFAULT_SERVER_IMAGE_MAX_DIM,\s*height: DEFAULT_SERVER_IMAGE_MAX_DIM,\s*fit: "inside",\s*withoutEnlargement: true,\s*\}\)/s);
  assert.match(script, /\.jpeg\(\{\s*quality: DEFAULT_SERVER_IMAGE_QUALITY,\s*mozjpeg: true,\s*\}\)/s);
  assert.match(script, /async function buildServerImageHash/);
  assert.match(script, /async function buildServerImageHashes/);
  assert.match(script, /async function buildBenchmarkClientHashSets/);
  assert.match(script, /function normalizeBenchmarkHashSets/);
  assert.match(script, /hashSets\s*\.map\(\(hashes\) => hashes\s*\.map/s);
  assert.match(script, /const preparedHashes = await buildBenchmarkClientHashSets\(options\.images, options\.targetLang\)/);
  assert.match(script, /clientHashSets = preparedHashes\.hashSets/);
  assert.match(script, /clientHashes = preparedHashes\.hashes/);
  assert.match(script, /clientHashSets = normalizeBenchmarkHashSets\(\[serverHashes,\s*rawClientHashes\]\)/);
  assert.match(script, /clientHashes = clientHashSets\[0\] \|\| \[\]/);
  assert.match(script, /rawClientHashes = await buildClientImageHashes\(imagePaths,\s*targetLang\)/);
  assert.match(script, /body: JSON\.stringify\(\{ target_lang: targetLang,\s*hashes,\s*hash_sets: hashSets \}\)/);
  assert.match(script, /server-normalized\+client-raw/);
  assert.match(script, /cache_probe_hash_mode:\s*cacheProbeHashMode \|\| "server-normalized"/);
  assert.match(script, /async function probeTranslationCache/);
  assert.match(script, /\/api\/v1\/translate\/menu\/cache/);
  assert.match(script, /\/api\/v1\/translate\/menu/);
  assert.match(script, /\/api\/v1\/task\/\$\{taskId\}/);
  assert.match(script, /cache_probe_ms/);
  assert.match(script, /cache_probe_hit/);
  assert.match(script, /client_hashes/);
  assert.match(script, /client_hash_sets/);
  assert.match(script, /upload_response_ms/);
  assert.match(script, /first_result_ms/);
  assert.match(script, /text_done_ms/);
  assert.match(script, /image_done_ms/);
  assert.match(script, /cache_bust:\s*options\.cacheBust/);
  assert.match(script, /async function materializeCacheBustedImages/);
  assert.match(script, /cache_bust_image_count/);
  assert.match(script, /cache_bust_enabled/);
  assert.match(script, /cached_immediate:\s*true/);
  assert.match(script, /const imageDoneMs = shouldKeepPollingForImages\(latest\) \? null : Date\.now\(\) - startedAt/);
  assert.match(script, /shouldKeepPollingForImages/);
  assert.match(script, /image_generation_status/);
  assert.match(script, /image_missing/);
  assert.match(script, /metadata\?\.timings/);
  assert.match(script, /const timings = result\?\.metadata\?\.timings \|\| null/);
  assert.match(script, /first_pass_model_name:\s*timings\?\.firstPassModelName \|\| null/);
  assert.match(script, /first_pass_model_names:\s*Array\.isArray\(timings\?\.firstPassModelNames\)/);
  assert.match(script, /first_pass_model_ms_by_page:\s*Array\.isArray\(timings\?\.firstPassModelMsByPage\)/);
  assert.match(script, /first_pass_build_ms_by_page:\s*Array\.isArray\(timings\?\.firstPassBuildMsByPage\)/);
});

test("fast first-pass model benchmark runs isolated local servers per candidate", async () => {
  const script = await readFile(`${ROOT}/scripts/benchmark-fast-first-pass-models.mjs`, "utf8");

  assert.match(script, /benchmark-fast-first-pass-models/);
  assert.match(script, /--models/);
  assert.match(script, /--base-port/);
  assert.match(script, /--server-command/);
  assert.match(script, /Run npm run build before using the default production server command/);
  assert.match(script, /QWEN_FAST_FIRST_PASS_MODELS/);
  assert.match(script, /MENU_FAST_FIRST_PASS=true/);
  assert.match(script, /spawn\("npm", \["run", "start", "--", "--port", String\(port\)\]/);
  assert.doesNotMatch(script, /spawn\("npm", \["run", "dev", "--", "--port", String\(port\)\]/);
  assert.match(script, /waitForServerReady/);
  assert.match(script, /\/scripts\/benchmark-menu-flow\.mjs/);
  assert.match(script, /--image-timeout-ms/);
  assert.match(script, /parseBenchmarkJson/);
  assert.match(script, /summarizeRuns/);
  assert.match(script, /median_first_result_ms/);
  assert.match(script, /median_first_pass_model_ms/);
  assert.match(script, /success_rate/);
  assert.match(script, /best_model/);
  assert.match(script, /continueOnError/);
  assert.match(script, /server\.kill\("SIGTERM"\)/);
  assert.match(script, /--no-cache-bust/);
  assert.match(script, /cacheBust:\s*true/);
  assert.match(script, /const cacheBustSessionId =/);
  assert.match(script, /process\.pid/);
  assert.match(script, /Date\.now\(\)/);
  assert.match(script, /Math\.random\(\)/);
  assert.match(script, /async function materializeCacheBustedImages/);
  assert.match(script, /mkdtemp/);
  assert.match(script, /tmpdir/);
  assert.match(script, /sharp\(imagePath, \{ failOn: "none" \}\)/);
  assert.match(script, /\.composite\(\[\{ input: overlay/);
  assert.match(script, /\.jpeg\(\{ quality: 92, mozjpeg: true \}\)/);
  assert.match(script, /for \(let runIndex = 1; runIndex <= options\.repeat; runIndex\+\+\)/);
  assert.match(script, /const benchmarkOptions = \{ \.\.\.options, repeat: 1, images: cacheBusted\.images \}/);
  assert.match(script, /await cacheBusted\.cleanup\(\)/);
  assert.match(script, /cache_bust_image_count/);
});

test("menu benchmark suite aggregates real-menu first paint metrics across images", async () => {
  const script = await readFile(`${ROOT}/scripts/benchmark-menu-suite.mjs`, "utf8");

  assert.match(script, /benchmark-menu-suite/);
  assert.match(script, /\/scripts\/benchmark-menu-flow\.mjs/);
  assert.match(script, /--base-url/);
  assert.match(script, /--target-lang/);
  assert.match(script, /--repeat/);
  assert.match(script, /--cache-probe/);
  assert.match(script, /--cache-bust/);
  assert.match(script, /--no-cache-bust/);
  assert.match(script, /--image-timeout-ms/);
  assert.match(script, /--continue-on-error/);
  assert.match(script, /async function runBenchmarkFlow/);
  assert.match(script, /execFile\(process\.execPath/);
  assert.match(script, /parseBenchmarkJson/);
  assert.match(script, /function percentile/);
  assert.match(script, /p50_first_result_ms/);
  assert.match(script, /p90_first_result_ms/);
  assert.match(script, /p50_first_pass_model_ms/);
  assert.match(script, /p50_first_pass_model_bytes/);
  assert.match(script, /p50_first_pass_compression_ratio/);
  assert.match(script, /first_pass_target_bytes/);
  assert.match(script, /cache_probe_hit_rate/);
  assert.match(script, /image_missing_total/);
  assert.match(script, /failure_buckets/);
  assert.match(script, /slowest_cases/);
  assert.match(script, /first_pass_model_names/);
  assert.match(script, /cached_immediate/);
  assert.match(script, /cache_bust:\s*options\.cacheBust/);
  assert.match(script, /if \(options\.cacheBust\) args\.push\("--cache-bust"\)/);
  assert.match(script, /function benchmarkChildTimeoutMs/);
  assert.match(script, /\(options\.timeoutMs \+ options\.imageTimeoutMs \+ 30_000\) \* options\.repeat/);
  assert.match(script, /if \(run\?\.cached_immediate\) return null/);
  assert.match(script, /firstPassModelBytesForRun/);
  assert.match(script, /firstPassCompressionRatioForRun/);
  assert.match(script, /recommendations/);
  assert.match(script, /first_result_ms.*12000/s);
  assert.match(script, /first_pass_model_ms.*12000/s);
  assert.match(script, /image_missing_total.*0/s);
});

test("menu benchmark suite excludes cached runs from live model latency summary", async () => {
  const suiteModule = await import(`${pathToFileURL(`${ROOT}/scripts/benchmark-menu-suite.mjs`).href}?cache=${Date.now()}`);

  const summary = suiteModule.summarizeSuite([
    {
      image: "/tmp/cached-menu.jpg",
      image_name: "cached-menu.jpg",
      ok: true,
      report: {
        runs: [
          {
            ok: true,
            cached_immediate: true,
            run: 1,
            first_result_ms: 120,
            text_done_ms: 120,
            cache_probe_hit: true,
            summary: {
              dish_count: 12,
              image_missing: 0,
              first_pass_model_name: "qwen-vl-plus",
              first_pass_model_names: ["qwen-vl-plus"],
              first_pass_model_ms_by_page: [18888],
              timings: { firstPassModelMs: 18888 },
            },
          },
        ],
      },
    },
  ]);

  assert.equal(summary.p50_first_result_ms, 120);
  assert.equal(summary.p50_first_pass_model_ms, null);
  assert.deepEqual(summary.first_pass_model_names, []);
  assert.deepEqual(summary.recommendations, []);
});

test("menu benchmark suite summarizes first-pass image compression metrics for cold runs", async () => {
  const suiteModule = await import(`${pathToFileURL(`${ROOT}/scripts/benchmark-menu-suite.mjs`).href}?cache=${Date.now() + 3}`);

  const summary = suiteModule.summarizeSuite([
    {
      image: "/tmp/cold-menu-a.jpg",
      image_name: "cold-menu-a.jpg",
      ok: true,
      report: {
        runs: [
          {
            ok: true,
            cached_immediate: false,
            run: 1,
            first_result_ms: 11200,
            text_done_ms: 15000,
            summary: {
              dish_count: 24,
              image_missing: 4,
              first_pass_model_ms_by_page: [9300],
              timings: {
                firstPassOriginalBytes: 900000,
                firstPassModelBytes: 180000,
                firstPassTargetBytes: 184320,
                firstPassCompressionRatio: 0.2,
              },
            },
          },
          {
            ok: true,
            cached_immediate: true,
            run: 2,
            first_result_ms: 90,
            text_done_ms: 90,
            summary: {
              dish_count: 24,
              image_missing: 0,
              timings: {
                firstPassModelBytes: 999999,
                firstPassTargetBytes: 184320,
                firstPassCompressionRatio: 0.99,
              },
            },
          },
        ],
      },
    },
    {
      image: "/tmp/cold-menu-b.jpg",
      image_name: "cold-menu-b.jpg",
      ok: true,
      report: {
        runs: [
          {
            ok: true,
            cached_immediate: false,
            run: 1,
            first_result_ms: 12200,
            text_done_ms: 17000,
            summary: {
              dish_count: 42,
              image_missing: 5,
              first_pass_model_ms_by_page: [10100],
              timings: {
                firstPassOriginalBytes: 1200000,
                firstPassModelBytes: 210000,
                firstPassTargetBytes: 184320,
                firstPassCompressionRatio: 0.175,
              },
            },
          },
        ],
      },
    },
  ]);

  assert.equal(summary.p50_first_pass_model_bytes, 180000);
  assert.equal(summary.p90_first_pass_model_bytes, 210000);
  assert.equal(summary.p50_first_pass_compression_ratio, 0.175);
  assert.equal(summary.p90_first_pass_compression_ratio, 0.2);
  assert.equal(summary.first_pass_target_bytes, 184320);
  assert.equal(summary.first_pass_original_bytes_total, 2100000);
  assert.equal(summary.first_pass_model_bytes_total, 390000);
});

test("menu benchmark suite preserves failed child benchmark output for diagnosis", async () => {
  const suiteModule = await import(`${pathToFileURL(`${ROOT}/scripts/benchmark-menu-suite.mjs`).href}?cache=${Date.now() + 1}`);
  const error = new Error("child benchmark failed");
  error.stdout = "{\"ok\":false}";
  error.stderr = "provider timed out";

  const failure = suiteModule.benchmarkFailureForError(error, "/tmp/menu.jpg");

  assert.equal(failure.ok, false);
  assert.equal(failure.error, "child benchmark failed");
  assert.equal(failure.stdout, "{\"ok\":false}");
  assert.equal(failure.stderr, "provider timed out");
  assert.equal(failure.report.runs[0].stdout, "{\"ok\":false}");
  assert.equal(failure.report.runs[0].stderr, "provider timed out");
});

test("menu benchmark suite does not report cache hit rate when cache probe was not run", async () => {
  const suiteModule = await import(`${pathToFileURL(`${ROOT}/scripts/benchmark-menu-suite.mjs`).href}?cache=${Date.now() + 2}`);

  const summary = suiteModule.summarizeSuite([
    {
      image: "/tmp/cold-menu.jpg",
      image_name: "cold-menu.jpg",
      ok: true,
      report: {
        runs: [
          {
            ok: true,
            run: 1,
            cached_immediate: false,
            cache_probe_hit: false,
            cache_probe_ms: null,
            first_result_ms: 15350,
            text_done_ms: 15350,
            summary: {
              dish_count: 15,
              image_missing: 0,
              first_pass_model_ms_by_page: [13962],
            },
          },
        ],
      },
    },
  ]);

  assert.equal(summary.cache_probe_hit_rate, null);
  assert.equal(summary.recommendations.some((item) => item.includes("cache_probe_hit_rate")), false);
});

test("menu benchmarks expose server cache hits that skip raw image reads", async () => {
  const flow = await readFile(`${ROOT}/scripts/benchmark-menu-flow.mjs`, "utf8");
  const suiteModule = await import(`${pathToFileURL(`${ROOT}/scripts/benchmark-menu-suite.mjs`).href}?cache=${Date.now() + 4}`);

  assert.match(flow, /cache_hit_without_raw_read:\s*Boolean\(result\?\.metadata\?\.cache_hit_without_raw_read\)/);
  assert.match(flow, /raw_read_ms:\s*Number\.isFinite\(timings\?\.rawReadMs\)/);

  const summary = suiteModule.summarizeSuite([
    {
      image: "/tmp/menu-a.jpg",
      image_name: "menu-a.jpg",
      ok: true,
      report: {
        runs: [
          {
            ok: true,
            cached_immediate: true,
            run: 1,
            first_result_ms: 80,
            text_done_ms: 80,
            summary: {
              dish_count: 18,
              image_missing: 0,
              cache_hit_without_raw_read: true,
              raw_read_ms: 0,
              timings: { rawReadMs: 0 },
            },
          },
          {
            ok: true,
            cached_immediate: false,
            run: 2,
            first_result_ms: 9200,
            text_done_ms: 11200,
            summary: {
              dish_count: 18,
              image_missing: 2,
              cache_hit_without_raw_read: false,
              raw_read_ms: 112,
              timings: { rawReadMs: 112, firstPassModelMs: 8000 },
            },
          },
        ],
      },
    },
  ]);

  assert.equal(summary.cache_hit_without_raw_read_count, 1);
  assert.equal(summary.cache_hit_without_raw_read_rate, 0.5);
  assert.equal(summary.p50_raw_read_ms, 0);
  assert.equal(summary.p90_raw_read_ms, 112);
});

test("knowledge image downloader can materialize existing files without long network runs", async () => {
  const script = await readFile(`${ROOT}/scripts/download-knowledge-images.mjs`, "utf8");
  assert.match(script, /--existing-only/);
  assert.match(script, /DOWNLOAD_LIMIT/);
  assert.match(script, /fileExists/);
  assert.match(script, /continue/);
});

test("knowledge image downloader reuses exact local dish alias files before network downloads", async () => {
  const script = await readFile(`${ROOT}/scripts/download-knowledge-images.mjs`, "utf8");
  assert.match(script, /function normalizeLocalDishImageKey/);
  assert.match(script, /function buildExistingLocalImageIndex/);
  assert.match(script, /function findExistingLocalDishImagePath/);
  assert.match(script, /entry\.names/);
  assert.match(script, /existingLocalPath \|\| `\/dishes\/\$\{id\}\.webp`/);
  assert.match(script, /Mode: existing-only \(no network downloads\)/);
});

test("knowledge image downloader supports targeted ids for fast local library backfill", async () => {
  const script = await readFile(`${ROOT}/scripts/download-knowledge-images.mjs`, "utf8");
  assert.match(script, /--ids=/);
  assert.match(script, /TARGET_IDS/);
  assert.match(script, /TARGET_ID_SET/);
  assert.match(script, /toDownload\.filter\(\(\{ id \}\) => TARGET_ID_SET\.has\(id\)\)/);
  assert.match(script, /--max-consecutive-failures=/);
  assert.match(script, /MAX_CONSECUTIVE_FAILURES/);
  assert.match(script, /remote image source is likely unhealthy/);
});

test("knowledge image backfill planner prioritizes stable generation over unreliable remote downloads", async () => {
  const script = await readFile(`${ROOT}/scripts/plan-knowledge-image-backfill.mjs`, "utf8");
  const { stdout } = await execFileAsync(
    "node",
    ["scripts/plan-knowledge-image-backfill.mjs", "--limit=30"],
    { cwd: ROOT, timeout: 10_000 },
  );
  const plan = JSON.parse(stdout);

  assert.match(script, /plan-knowledge-image-backfill/);
  assert.match(script, /Pollinations URLs are not reliable enough/);
  assert.match(script, /generate_with_stable_model/);
  assert.match(script, /hasEquivalentLocalImage/);
  assert.match(script, /hasEquivalentPlannedImage/);
  assert.match(script, /task_mentions \* 100/);
  assert.match(script, /commonStapleWeight/);
  assert.match(script, /categoryWeight/);
  assert.match(script, /--format=ids/);
  assert.match(script, /safeLocalDishFilename/);
  assert.match(script, /localDishImagePath/);
  assert.match(script, /output_path: localDishImagePath\(entry\)/);
  assert.equal(plan.candidates.some((entry) => entry.id === "tacos-al-pastor-street"), false);
  assert.equal(plan.candidates.every((entry) => entry.output_path === entry.output_path.toLowerCase()), true);
  assert.equal(plan.candidates.some((entry) => entry.output_path === "/dishes/Sellou.webp"), false);
  assert.ok(
    plan.candidates.filter((entry) => ["amatriciana", "bucatini-amatriciana"].includes(entry.id)).length <= 1,
  );
});

test("Wan knowledge image backfill reuses production image prompts and writes local webp assets", async () => {
  const script = await readFile(`${ROOT}/scripts/backfill-knowledge-images-with-wan.mjs`, "utf8");
  const { stdout } = await execFileAsync(
    "node",
    ["scripts/backfill-knowledge-images-with-wan.mjs", "--ids=Sellou", "--force"],
    { cwd: ROOT, timeout: 10_000 },
  );
  const dryRun = JSON.parse(stdout);

  assert.match(script, /backfill-knowledge-images-with-wan/);
  assert.match(script, /Default is a dry run/);
  assert.match(script, /--apply/);
  assert.match(script, /process\.env\.IMAGE_PROVIDER = "wan"/);
  assert.match(script, /src", "lib", "ai", "image-gen\.ts"/);
  assert.match(script, /ts\.transpileModule/);
  assert.match(script, /generateDishImageWithError/);
  assert.match(script, /QWEN_API_KEY is required/);
  assert.match(script, /sharp\(sourceBuffer, \{ failOn: "none" \}\)/);
  assert.match(script, /\.webp\(\{ quality: WEBP_QUALITY, effort: 5 \}\)/);
  assert.match(script, /safeLocalDishFilename/);
  assert.match(script, /localDishImagePath/);
  assert.match(script, /entry\.card = localPath/);
  assert.match(script, /entry\.hero = localPath/);
  assert.match(script, /saveKnowledgeDb\(db\)/);
  assert.match(script, /isNeedsBackfill/);
  assert.match(script, /pollinations\.ai/);
  assert.match(script, /findEquivalentLocalImage/);
  assert.match(script, /report\.summary\.reused\+\+/);
  assert.match(script, /matched_name/);
  assert.match(script, /!SPECIAL_BACKFILL_IMAGE_HINTS\[entry\.id\]/);
  assert.match(script, /--ids=/);
  assert.match(script, /--force/);
  assert.match(script, /FORCE && TARGET_IDS\.has\(entry\.id\)/);
  assert.match(script, /--item-timeout-ms=/);
  assert.match(script, /ITEM_TIMEOUT_MS/);
  assert.match(script, /withItemTimeout/);
  assert.match(script, /Promise\.race/);
  assert.match(script, /Backfill progress/);
  assert.match(script, /console\.error/);
  assert.match(script, /report\.events/);
  assert.match(script, /SPECIAL_BACKFILL_IMAGE_HINTS/);
  assert.equal(dryRun.candidates.find((entry) => entry.id === "Sellou")?.output_path, "/dishes/sellou.webp");
  assert.match(script, /bal-kaymak/);
  assert.match(script, /Turkish kaymak/i);
  assert.match(script, /thick clotted cream/i);
  assert.match(script, /gado-gado/);
  assert.match(script, /Indonesian gado-gado/i);
  assert.match(script, /peanut sauce/i);
  assert.match(script, /gyoza/);
  assert.match(script, /Japanese gyoza/i);
  assert.match(script, /crescent dumplings/i);
  assert.match(script, /hotteok/);
  assert.match(script, /Korean hotteok/i);
  assert.match(script, /flat griddle pancake/i);
  assert.match(script, /jajangmyeon/);
  assert.match(script, /Korean jajangmyeon/i);
  assert.match(script, /glossy black bean sauce/i);
  assert.match(script, /jokbal/);
  assert.match(script, /Korean jokbal/i);
  assert.match(script, /braised pig's feet/i);
  assert.match(script, /sliced pork trotter/i);
  assert.match(script, /no visible toes/i);
  assert.match(script, /kanom-krok/);
  assert.match(script, /Thai kanom krok/i);
  assert.match(script, /small coconut rice pancakes/i);
  assert.match(script, /kaya-toast/);
  assert.match(script, /Singapore kaya toast/i);
  assert.match(script, /No avocado/i);
  assert.match(script, /no eggs on top/i);
  assert.match(script, /korean-bbq-platter/);
  assert.match(script, /Korean BBQ platter/i);
  assert.match(script, /table grill/i);
  assert.match(script, /korean-fried-chicken/);
  assert.match(script, /Korean fried chicken/i);
  assert.match(script, /glossy red gochujang/i);
  assert.match(script, /kulfi-falooda/);
  assert.match(script, /Indian kulfi falooda/i);
  assert.match(script, /falooda vermicelli/i);
  assert.match(script, /lod-chong/);
  assert.match(script, /Thai lod chong/i);
  assert.match(script, /green pandan jelly noodles/i);
  assert.match(script, /patbingsu/);
  assert.match(script, /Korean patbingsu/i);
  assert.match(script, /wide dessert bowl/i);
  assert.match(script, /red bean paste/i);
  assert.match(script, /not a drink cup/i);
  assert.match(script, /picarones/);
  assert.match(script, /Peruvian picarones/i);
  assert.match(script, /squash and sweet potato ring fritters/i);
  assert.match(script, /Do not show onion rings/i);
  assert.match(script, /princess-cake/);
  assert.match(script, /Swedish princess cake/i);
  assert.match(script, /green marzipan dome/i);
  assert.match(script, /entire outside must be pastel green/i);
  assert.match(script, /Do not show a sandwich bun/i);
  assert.match(script, /roti-prata/);
  assert.match(script, /Singapore roti prata/i);
  assert.match(script, /flaky layered flatbread/i);
  assert.match(script, /Do not show pancakes/i);
  assert.match(script, /semifreddo/);
  assert.match(script, /Italian semifreddo/i);
  assert.match(script, /slice of semi-frozen dessert/i);
  assert.match(script, /Do not show whipped cream/i);
  assert.match(script, /malai-kofta/);
  assert.match(script, /Indian malai kofta/i);
  assert.match(script, /cream sauce/i);
  assert.match(script, /massaman-curry/);
  assert.match(script, /Thai massaman curry/i);
  assert.match(script, /peanuts and potatoes/i);
  assert.match(script, /mole-negro/);
  assert.match(script, /Mexican mole negro/i);
  assert.match(script, /dark black-brown mole sauce/i);
  assert.match(script, /moo-ping/);
  assert.match(script, /Thai moo ping/i);
  assert.match(script, /grilled pork skewers/i);
  assert.match(script, /muhammara-lebanese/);
  assert.match(script, /red pepper walnut dip/i);
  assert.match(script, /mujadara/);
  assert.match(script, /lentils and rice/i);
  assert.match(script, /mutter-paneer/);
  assert.match(script, /paneer cubes and green peas/i);
  assert.match(script, /california-roll/);
  assert.match(script, /black-pepper-crab/);
  assert.match(script, /boquerones-fritos/);
  assert.match(script, /crispy golden fried anchovies/i);
  assert.match(script, /char-kway-teow/);
  assert.match(script, /flat rice noodles/i);
  assert.match(script, /fugu-sashimi/);
  assert.match(script, /translucent pufferfish sashimi/i);
  assert.match(script, /ganjang-gejang/);
  assert.match(script, /soy-marinated raw crab/i);
  assert.match(script, /gray-blue or brown raw crab shell/i);
  assert.match(script, /hokkien-mee/);
  assert.match(script, /yellow egg noodles and rice vermicelli/i);
  assert.match(script, /hoy-tod/);
  assert.match(script, /crispy Thai oyster omelette/i);
  assert.match(script, /haemul-pajeon/);
  assert.match(script, /Korean seafood scallion pancake/i);
  assert.match(script, /kra-pao-gai/);
  assert.match(script, /Thai basil chicken stir-fry/i);
  assert.match(script, /maki-roll/);
  assert.match(script, /classic maki sushi roll/i);
  assert.match(script, /mee-goreng/);
  assert.match(script, /spicy stir-fried yellow noodles/i);
  assert.match(script, /mee-krob/);
  assert.match(script, /crispy Thai sweet-and-sour noodles/i);
  assert.match(script, /nakji-bokkeum/);
  assert.match(script, /Korean spicy stir-fried baby octopus/i);
  assert.match(script, /single plate or bowl/i);
  assert.match(script, /nam-prik-oong/);
  assert.match(script, /Northern Thai tomato and minced pork chili dip/i);
  assert.match(script, /nasi-lemak/);
  assert.match(script, /Malaysian or Singaporean nasi lemak/i);
  assert.match(script, /Do not show plain fried rice, biryani, curry rice, poke bowl, crab, lobster, or nasi goreng/i);
  assert.match(script, /negitoro-roll/);
  assert.match(script, /scallion tuna maki roll/i);
  assert.match(script, /nigiri-assorted/);
  assert.match(script, /assorted nigiri sushi platter/i);
  assert.match(script, /or-suan/);
  assert.match(script, /Thai or suan crispy oyster pancake/i);
  assert.match(script, /oyster-omelette/);
  assert.match(script, /Singapore or Taiwanese oyster omelette/i);
  assert.match(script, /pad-kra-pao/);
  assert.match(script, /Thai pad kra pao/i);
  assert.match(script, /paella-de-marisco/);
  assert.match(script, /Spanish seafood paella/i);
  assert.match(script, /pasta-frutti-di-mare/);
  assert.match(script, /Italian seafood pasta/i);
  assert.match(script, /pickled-herring/);
  assert.match(script, /Scandinavian pickled herring/i);
  assert.match(script, /pulpo-a-la-gallega/);
  assert.match(script, /Galician octopus/i);
  assert.match(script, /puttanesca/);
  assert.match(script, /Italian puttanesca pasta/i);
  assert.match(script, /risotto-ai-frutti-di-mare/);
  assert.match(script, /Italian seafood risotto/i);
  assert.match(script, /risotto-al-nero-di-seppia/);
  assert.match(script, /Italian squid ink risotto/i);
  assert.match(script, /norwegian-salmon/);
  assert.match(script, /Norwegian salmon/i);
  assert.match(script, /pla-rad-prik/);
  assert.match(script, /Thai pla rad prik/i);
  assert.match(script, /prawn-masala/);
  assert.match(script, /Indian prawn masala/i);
  assert.match(script, /rainbow-roll/);
  assert.match(script, /Japanese rainbow roll/i);
  assert.match(script, /risotto-ai-gamberi/);
  assert.match(script, /Italian shrimp risotto/i);
  assert.match(script, /mie-goreng-indonesian/);
  assert.match(script, /Indonesian mie goreng/i);
  assert.match(script, /nasi-goreng-indonesian/);
  assert.match(script, /Indonesian nasi goreng/i);
  assert.match(script, /smorrebrod/);
  assert.match(script, /Danish smorrebrod/i);
  assert.match(script, /spaghetti-alle-vongole/);
  assert.match(script, /Italian spaghetti alle vongole/i);
  assert.match(script, /takoyaki/);
  assert.match(script, /Japanese takoyaki/i);
  assert.match(script, /sashimi":/);
  assert.match(script, /Japanese sashimi as sliced raw fish without rice/i);
  assert.match(script, /sashimi-platter/);
  assert.match(script, /Japanese sashimi platter/i);
  assert.match(script, /spicy-tuna-roll/);
  assert.match(script, /Japanese spicy tuna roll/i);
  assert.match(script, /sushi-nigiri-salmon/);
  assert.match(script, /salmon nigiri sushi/i);
  assert.match(script, /taiyaki/);
  assert.match(script, /Japanese taiyaki/i);
  assert.match(script, /sushi-nigiri-tuna/);
  assert.match(script, /tuna nigiri sushi/i);
  assert.match(script, /sushi-nigiri-shrimp/);
  assert.match(script, /shrimp nigiri sushi/i);
  assert.match(script, /sushi-nigiri-eel/);
  assert.match(script, /eel nigiri sushi/i);
  assert.match(script, /sushi-nigiri-octopus/);
  assert.match(script, /octopus nigiri sushi/i);
  assert.match(script, /tempura-shrimp/);
  assert.match(script, /Japanese shrimp tempura/i);
  assert.match(script, /polpo-alla-lucchese/);
  assert.match(script, /Italian polpo alla Lucchese/i);
  assert.match(script, /rojak/);
  assert.match(script, /Singaporean or Malaysian rojak/i);
  assert.match(script, /smorgasbord/);
  assert.match(script, /Scandinavian smorgasbord/i);
  assert.match(script, /spaghetti-alle-cozze/);
  assert.match(script, /Italian spaghetti alle cozze/i);
  assert.match(script, /tandoori-prawns/);
  assert.match(script, /Indian tandoori prawns/i);
  assert.match(script, /tteokbokki/);
  assert.match(script, /Korean tteokbokki/i);
  assert.match(script, /yakisoba/);
  assert.match(script, /Japanese yakisoba/i);
  assert.match(script, /yam-pla-muk/);
  assert.match(script, /Thai yam pla muk/i);
  assert.match(script, /tempeh-indonesian/);
  assert.match(script, /Indonesian tempeh/i);
  assert.match(script, /whole soybeans/i);
  assert.match(script, /aebleskiver/);
  assert.match(script, /Danish aebleskiver/i);
  assert.match(script, /rakfisk/);
  assert.match(script, /Norwegian rakfisk/i);
  assert.match(script, /albondigas-espanolas/);
  assert.match(script, /Spanish albondigas/i);
  assert.match(script, /anmitsu/);
  assert.match(script, /Japanese anmitsu/i);
  assert.match(script, /baghrir/);
  assert.match(script, /Moroccan baghrir/i);
  assert.match(script, /bebek-bengil/);
  assert.match(script, /Balinese crispy duck/i);
  assert.match(script, /bibim-guksu/);
  assert.match(script, /Korean bibim guksu/i);
  assert.match(script, /bibim-naengmyeon/);
  assert.match(script, /Korean bibim naengmyeon/i);
  assert.match(script, /bingsu/);
  assert.match(script, /Korean bingsu/i);
  assert.match(script, /bo-luc-lac/);
  assert.match(script, /Vietnamese bo luc lac/i);
  assert.match(script, /bruschetta-al-pomodoro/);
  assert.match(script, /Italian tomato bruschetta/i);
  assert.match(script, /bulgogi/);
  assert.match(script, /Korean bulgogi/i);
  assert.match(script, /cao-lau/);
  assert.match(script, /Vietnamese cao lau/i);
  assert.match(script, /cassata-siciliana/);
  assert.match(script, /Sicilian cassata/i);
  assert.match(script, /chebakia/);
  assert.match(script, /Moroccan chebakia/i);
  assert.match(script, /chendol/);
  assert.match(script, /Southeast Asian cendol/i);
  assert.match(script, /chicken-korma/);
  assert.match(script, /Indian chicken korma/i);
  assert.match(script, /chiles-en-nogada/);
  assert.match(script, /Mexican chiles en nogada/i);
  assert.match(script, /churros-con-chocolate/);
  assert.match(script, /Spanish churros con chocolate/i);
  assert.match(script, /cinnamon-roll-scandinavian/);
  assert.match(script, /Swedish cinnamon roll/i);
  assert.match(script, /cochinillo-asado/);
  assert.match(script, /Spanish cochinillo asado/i);
  assert.match(script, /crema-catalana/);
  assert.match(script, /Catalan crema catalana/i);
  assert.match(script, /crostata-di-marmellata/);
  assert.match(script, /Italian crostata di marmellata/i);
  assert.match(script, /dakgalbi/);
  assert.match(script, /Korean dakgalbi/i);
  assert.match(script, /shahi-paneer/);
  assert.match(script, /rich creamy royal curry/i);
  assert.match(script, /tacos-al-pastor/);
  assert.match(script, /open-face small corn tortillas/i);
  assert.match(script, /pineapple chunks/i);
  assert.match(script, /closed wraps/i);
  assert.match(script, /tamagoyaki/);
  assert.match(script, /rectangular rolled omelette/i);
  assert.match(script, /tebasaki/);
  assert.match(script, /Japanese fried chicken wings/i);
  assert.match(script, /teriyaki-chicken/);
  assert.match(script, /glossy dark sweet soy teriyaki sauce/i);
  assert.match(script, /sfiha/);
  assert.match(script, /Mediterranean sfiha/i);
  assert.match(script, /open-faced meat pies/i);
  assert.match(script, /sigeumchi-namul/);
  assert.match(script, /Korean sigeumchi namul/i);
  assert.match(script, /blanched spinach side dish/i);
  assert.match(script, /sunomono/);
  assert.match(script, /Japanese sunomono/i);
  assert.match(script, /thin cucumber slices/i);
  assert.match(script, /sutlac/);
  assert.match(script, /Turkish sutlac/i);
  assert.match(script, /baked rice pudding/i);
  assert.match(script, /yakitori/);
  assert.match(script, /Japanese yakitori/i);
  assert.match(script, /grilled chicken skewers/i);
  assert.match(script, /tavuk-gogsu/);
  assert.match(script, /Turkish tavuk gogsu/i);
  assert.match(script, /milk pudding made with shredded chicken breast/i);
  assert.match(script, /tres-leches-cake/);
  assert.match(script, /Latin American tres leches cake/i);
  assert.match(script, /soaked sponge cake/i);
  assert.match(script, /tub-tim-grob/);
  assert.match(script, /Thai tub tim grob/i);
  assert.match(script, /red ruby water chestnut dessert/i);
  assert.match(script, /umm-ali/);
  assert.match(script, /Middle Eastern Umm Ali/i);
  assert.match(script, /bread pudding/i);
  assert.match(script, /uttapam/);
  assert.match(script, /South Indian uttapam/i);
  assert.match(script, /thick savory rice pancake/i);
  assert.match(script, /yangnyeom-chicken/);
  assert.match(script, /Korean yangnyeom chicken/i);
  assert.match(script, /glossy red sweet spicy sauce/i);
  assert.match(script, /Sellou/);
  assert.match(script, /Moroccan sellou/i);
  assert.match(script, /sesame almond sweet/i);
  assert.match(script, /yokan/);
  assert.match(script, /Japanese yokan/i);
  assert.match(script, /red bean jelly/i);
  assert.match(script, /zeppole/);
  assert.match(script, /Italian zeppole/i);
  assert.match(script, /fried dough pastries/i);
  assert.match(script, /aji-de-gallina/);
  assert.match(script, /Peruvian aji de gallina/i);
  assert.match(script, /creamy yellow chili chicken stew/i);
  assert.match(script, /amatriciana/);
  assert.match(script, /Italian amatriciana pasta/i);
  assert.match(script, /guanciale and tomato sauce/i);
  assert.match(script, /arancini-di-riso/);
  assert.match(script, /Sicilian arancini/i);
  assert.match(script, /fried rice balls/i);
  assert.match(script, /arrabbiata/);
  assert.match(script, /Italian arrabbiata pasta/i);
  assert.match(script, /spicy tomato sauce/i);
  assert.match(script, /bruschetta-ai-funghi/);
  assert.match(script, /Italian mushroom bruschetta/i);
  assert.match(script, /sautéed mushrooms on toasted bread/i);
  assert.match(script, /cacio-e-pepe/);
  assert.match(script, /Italian cacio e pepe/i);
  assert.match(script, /black pepper and pecorino cheese/i);
  assert.match(script, /chicken-lollipop/);
  assert.match(script, /Indian chicken lollipop/i);
  assert.match(script, /frenched chicken winglets/i);
  assert.match(script, /chole-bhature/);
  assert.match(script, /North Indian chole bhature/i);
  assert.match(script, /puffed fried bread/i);
  assert.match(script, /cotoletta-alla-milanese/);
  assert.match(script, /Milanese cotoletta/i);
  assert.match(script, /breaded veal cutlet/i);
  assert.match(script, /crostini-toscani/);
  assert.match(script, /Tuscan crostini/i);
  assert.match(script, /chicken liver pate/i);
  assert.match(script, /danish-rye-bread/);
  assert.match(script, /Danish rye bread/i);
  assert.match(script, /dense dark rye loaf/i);
  assert.match(script, /dumplings-street/);
  assert.match(script, /street dumplings/i);
  assert.match(script, /pleated dumplings/i);
  assert.match(script, /fattoush-salad/);
  assert.match(script, /Levantine fattoush salad/i);
  assert.match(script, /crispy pita chips/i);
  assert.match(script, /gozleme/);
  assert.match(script, /Turkish gozleme/i);
  assert.match(script, /stuffed flatbread/i);
  assert.match(script, /jeera-rice/);
  assert.match(script, /Indian jeera rice/i);
  assert.match(script, /cumin seeds/i);
  assert.match(script, /kanom-jeen/);
  assert.match(script, /Thai kanom jeen/i);
  assert.match(script, /fermented rice noodles/i);
  assert.match(script, /no large shrimp/i);
  assert.match(script, /Do not let seafood dominate/i);
  assert.match(script, /kibbeh-me/);
  assert.match(script, /Middle Eastern kibbeh/i);
  assert.match(script, /bulgur croquettes/i);
  assert.match(script, /kimbap/);
  assert.match(script, /Korean kimbap/i);
  assert.match(script, /seaweed rice rolls/i);
  assert.match(script, /swedish-meatballs/);
  assert.match(script, /Swedish meatballs/i);
  assert.match(script, /lingonberry jam/i);
  assert.match(script, /tempura-vegetable/);
  assert.match(script, /Japanese vegetable tempura/i);
  assert.match(script, /assorted battered vegetables/i);
  assert.match(script, /raw vegetable salad/i);
  assert.match(script, /no raw vegetable sticks/i);
  assert.match(script, /all vegetables must be coated in lumpy pale-gold batter/i);
  assert.match(script, /no shrimp or seafood/i);
  assert.match(script, /thai-spring-rolls/);
  assert.match(script, /Thai fried spring rolls/i);
  assert.match(script, /tortellini-panna/);
  assert.match(script, /ring-shaped stuffed pasta/i);
  assert.match(script, /tortilla-espanola/);
  assert.match(script, /Spanish potato omelette/i);
  assert.match(script, /wedge or round slice/i);
  assert.match(script, /tostada-con-tomate/);
  assert.match(script, /Spanish tomato toast/i);
  assert.match(script, /grated tomato/i);
  assert.match(script, /no diced tomato cubes/i);
  assert.match(script, /image_prompt_hint/);
});

test("generated dish image sync uploads runtime images without unsafe inferred DB writes", async () => {
  const script = await readFile(`${ROOT}/scripts/sync-generated-dish-images.mjs`, "utf8");

  assert.match(script, /Sync runtime-generated dish images/);
  assert.match(script, /readLocalEnvFile/);
  assert.match(script, /\.env\.local/);
  assert.match(script, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(script, /SUPABASE_SECRET_KEY/);
  assert.match(script, /public", "generated-dishes"/);
  assert.match(script, /collectTaskCacheDishMap/);
  assert.match(script, /url\.match\(/);
  assert.match(script, /generated-dishes/);
  assert.match(script, /inferDishNameFromStorageId/);
  assert.match(script, /--apply/);
  assert.match(script, /--write-db/);
  assert.match(script, /--allow-inferred-db/);
  assert.match(script, /source === "task_cache" \|\| ALLOW_INFERRED_DB/);
  assert.match(script, /storage\.from\(BUCKET\)\.upload/);
  assert.match(script, /contentType:\s*"image\/webp"/);
  assert.match(script, /upsert:\s*true/);
  assert.match(script, /\.from\("dishes"\)[\s\S]*\.update\(\{ ai_image_url: publicUrl, image_source: "ai" \}\)/);
  assert.match(script, /\.from\("dishes"\)[\s\S]*\.insert\(row\)/);
  assert.doesNotMatch(script, /NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(script, /console\.log\(process\.env/);
});

test("generated image persistence prefers Alibaba OSS and keeps Supabase as a compatibility fallback", async () => {
  const storage = await readFile(`${ROOT}/src/lib/storage/supabase-storage.ts`, "utf8");
  const ossStorage = await readFile(`${ROOT}/src/lib/storage/oss-storage.ts`, "utf8");
  const safeImageUrl = await readFile(`${ROOT}/src/lib/safe-image-url.ts`, "utf8");
  const runtimeHydration = await readFile(`${ROOT}/src/lib/server/runtime-generated-image-hydration.ts`, "utf8");
  const envExample = await readFile(`${ROOT}/.env.example`, "utf8");
  const nextConfig = await readFile(`${ROOT}/next.config.ts`, "utf8");

  assert.match(storage, /uploadGeneratedDishImageToOss/);
  assert.match(storage, /const ossUrl = await uploadGeneratedDishImageToOss/);
  assert.match(storage, /if \(ossUrl\) return ossUrl/);
  assert.match(storage, /client\.storage\.from\(BUCKET\)\.upload/);
  assert.match(ossStorage, /new OSS\(/);
  assert.match(ossStorage, /ALIYUN_OSS_REGION/);
  assert.match(ossStorage, /ALIYUN_OSS_BUCKET/);
  assert.match(ossStorage, /ALIYUN_OSS_ACCESS_KEY_ID/);
  assert.match(ossStorage, /ALIYUN_OSS_ACCESS_KEY_SECRET/);
  assert.match(ossStorage, /ALIYUN_OSS_PUBLIC_BASE_URL/);
  assert.match(ossStorage, /oss\.put\(/);
  assert.match(ossStorage, /"Cache-Control": "public, max-age=31536000, immutable"/);
  assert.match(safeImageUrl, /isAliyunOssDishUrl/);
  assert.match(runtimeHydration, /isStableRemoteGeneratedDishImageUrl/);
  assert.match(envExample, /ALIYUN_OSS_REGION=oss-ap-southeast-1/);
  assert.match(envExample, /ALIYUN_OSS_PUBLIC_BASE_URL=/);
  assert.match(nextConfig, /serverExternalPackages:\s*\[[^\]]*"ali-oss"/);
  assert.match(nextConfig, /NEXT_PUBLIC_DISH_IMAGE_CDN_HOST/);
  assert.match(nextConfig, /dishImageCdnHost[\s\S]*remotePatterns/);
});

test("generated image downloads reject untrusted hosts and bound response time and size", async () => {
  const storage = await readFile(`${ROOT}/src/lib/storage/supabase-storage.ts`, "utf8");

  assert.match(storage, /GENERATED_IMAGE_FETCH_TIMEOUT_MS/);
  assert.match(storage, /GENERATED_IMAGE_FETCH_MAX_BYTES/);
  assert.match(storage, /function assertTrustedGeneratedImageUrl/);
  assert.match(storage, /image\.pollinations\.ai/);
  assert.match(storage, /hostname\.endsWith\("\.aliyuncs\.com"\)/);
  assert.doesNotMatch(storage, /hostname\.toLowerCase\(\)\.includes\("dashscope-result"\)/);
  assert.match(storage, /new AbortController\(\)/);
  assert.match(storage, /if \(res\.url\) assertTrustedGeneratedImageUrl\(res\.url\)/);
  assert.match(storage, /content-length/);
  assert.match(storage, /exceeds.*byte limit/i);
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

test("results dish cards restore the compact production hierarchy without losing readability", async () => {
  const resultsPage = await readFile(`${ROOT}/src/components/results/ResultsPage.tsx`, "utf8");
  const dishImage = await readFile(`${ROOT}/src/components/shared/DishImageWithLoading.tsx`, "utf8");
  const globals = await readFile(`${ROOT}/src/app/globals.css`, "utf8");

  assert.match(resultsPage, /cardSurface:[\s\S]*background:\s*"var\(--card\)"/);
  assert.match(resultsPage, /borderRadius:\s*28/);
  assert.match(resultsPage, /padding:\s*18/);
  assert.match(resultsPage, /fontSize:\s*20/);
  assert.match(resultsPage, /fontSize:\s*13,\s*color:\s*"var\(--ink-soft\)"/);
  assert.match(resultsPage, /fontSize:\s*13,\s*color:\s*"var\(--primary\)"/);
  assert.doesNotMatch(resultsPage, /borderLeft:\s*"4px solid rgba\(76,175,80,0\.72\)"/);
  assert.match(resultsPage, /fontSize:\s*"11px"/);
  assert.match(resultsPage, /font:\s*"900 13px\/1\.2 var\(--font-body\)"/);
  assert.match(resultsPage, /width:\s*96,\s*height:\s*96/);
  assert.match(globals, /body\s*\{[\s\S]*font-size:\s*13px/);
  assert.match(globals, /\.dish-image-loading\s*\{[\s\S]*font-size:\s*10px/);
  assert.doesNotMatch(dishImage, /fontSize:\s*compact \? 7 : 9/);
  assert.match(dishImage, /fontSize:\s*compact \? 11 : 12/);
  assert.match(dishImage, /const width = compact \? 96 : "100%"/);
  assert.match(dishImage, /sizes=\{compact \? "96px"/);
});

test("results dish cards use the previous quiet surface and plain recommendation treatment", async () => {
  const resultsPage = await readFile(`${ROOT}/src/components/results/ResultsPage.tsx`, "utf8");

  assert.match(resultsPage, /const resultsDishCardStyles =/);
  assert.match(resultsPage, /cardSurface:[\s\S]*boxShadow:\s*"0 14px 34px rgba\(69,48,30,0\.08\)"/);
  assert.doesNotMatch(resultsPage, /radial-gradient\(circle at 18px 18px/);
  assert.doesNotMatch(resultsPage, /dishNumberBadge:\s*\{[^}]*minWidth:\s*34/);
  assert.doesNotMatch(resultsPage, /dishNumberBadge:\s*\{[^}]*border:/);
  assert.doesNotMatch(resultsPage, /recommendationCallout:\s*\{[^}]*borderLeft:/);
  assert.match(resultsPage, /cardImageRail:[\s\S]*display:\s*"none"/);
  assert.match(resultsPage, /\.\.\.resultsDishCardStyles\.cardSurface/);
  assert.match(resultsPage, /\.\.\.resultsDishCardStyles\.recommendationCallout/);
});

test("share surfaces avoid tiny web-style typography", async () => {
  const appPage = await readFile(`${ROOT}/src/app/page.tsx`, "utf8");
  const shareSheet = await readFile(`${ROOT}/src/components/share/ShareSheet.tsx`, "utf8");

  const visibleShareSheet = shareSheet.replace(/<div className="sr-only"[\s\S]*?<\/div>/g, "");
  assert.doesNotMatch(visibleShareSheet, /fontSize:\s*(?:7\.5|8|9)(?:[,}]|px)/);
  assert.doesNotMatch(visibleShareSheet, /letterSpacing:\s*"0\.0[46]em"/);
  assert.match(visibleShareSheet, /fontSize:\s*13,\s*fontWeight:\s*800/);
  assert.match(visibleShareSheet, /fontSize:\s*12,\s*lineHeight:\s*1\.45/);
  assert.match(visibleShareSheet, /minHeight:\s*88/);

  assert.match(appPage, /shareNotice/);
  assert.doesNotMatch(appPage, /fontSize:\s*9/);
  assert.match(appPage, /fontSize:\s*13/);
  assert.match(appPage, /minHeight:\s*40/);
});

test("home screen restores the compact previous hierarchy while preserving resilient thumbnails", async () => {
  const homePage = await readFile(`${ROOT}/src/components/home/HomePage.tsx`, "utf8");

  assert.match(homePage, /FoodThumbnailFallback/);
  assert.doesNotMatch(homePage, /fallbackRecentImage/);
  assert.match(homePage, /fontSize:\s*18/);
  assert.doesNotMatch(homePage, /fontSize:\s*24/);
  assert.match(homePage, /fontSize:\s*15/);
  assert.match(homePage, /fontSize:\s*13/);
  assert.doesNotMatch(homePage, /minHeight:\s*52/);
  assert.match(homePage, /RecentPill/);
  assert.match(homePage, /fontSize:\s*10/);
  assert.match(homePage, /home-content-scroll/);
  assert.match(homePage, /overflow-y-auto/);
  assert.match(homePage, /minHeight:\s*0/);
  assert.match(homePage, /<nav[\s\S]*flex-shrink-0/);
  assert.doesNotMatch(homePage, /<div style=\{\{ flex:\s*1 \}\}/);
});

test("history and favorites screens use app-readable typography", async () => {
  const historyPage = await readFile(`${ROOT}/src/components/history/HistoryPage.tsx`, "utf8");
  const favoritesPage = await readFile(`${ROOT}/src/components/favorites/FavoritesPage.tsx`, "utf8");
  const thumbnailFallback = await readFile(`${ROOT}/src/components/shared/FoodThumbnailFallback.tsx`, "utf8");

  for (const source of [historyPage, favoritesPage]) {
    assert.doesNotMatch(source, /fontSize:\s*(?:7|8|9)(?:[,}]|px|\.5)/);
    assert.doesNotMatch(source, /text-\[(?:7|8|9)px\]/);
    assert.match(source, /FoodThumbnailFallback/);
  }

  assert.doesNotMatch(historyPage, /fallbackHistoryImage/);
  assert.doesNotMatch(favoritesPage, /dish\.name_zh\[0\]/);
  assert.match(thumbnailFallback, /aria-label=\{label\}/);
  assert.match(thumbnailFallback, /linear-gradient\(180deg, rgba\(255,250,242,0\.96\), rgba\(254,230,203,0\.78\)\)/);
  assert.match(thumbnailFallback, /viewBox="0 0 64 64"/);
  assert.match(historyPage, /fontSize:\s*16/);
  assert.match(historyPage, /fontSize:\s*14/);
  assert.match(historyPage, /fontSize:\s*12/);
  assert.match(favoritesPage, /fontSize:\s*16/);
  assert.match(favoritesPage, /fontSize:\s*14/);
  assert.match(favoritesPage, /fontSize:\s*12/);
});

test("ordered detail screen uses app-readable food card typography", async () => {
  const orderedDetailPage = await readFile(`${ROOT}/src/components/order/OrderedDetailPage.tsx`, "utf8");

  assert.doesNotMatch(orderedDetailPage, /fontSize:\s*(?:7|8|9)(?:[,}]|px|\.5)/);
  assert.doesNotMatch(orderedDetailPage, /text-\[(?:7|8|9)px\]/);
  assert.match(orderedDetailPage, /fontSize:\s*18/);
  assert.match(orderedDetailPage, /fontSize:\s*16/);
  assert.match(orderedDetailPage, /fontSize:\s*14/);
  assert.match(orderedDetailPage, /fontSize:\s*12/);
  assert.match(orderedDetailPage, /padding:\s*18/);
  assert.match(orderedDetailPage, /gap-4/);
});

test("dish detail restores the previous calm hierarchy while keeping readable body text", async () => {
  const detailPage = await readFile(`${ROOT}/src/components/dish/DishDetailPage.tsx`, "utf8");

  assert.doesNotMatch(detailPage, /fontSize:\s*30/);
  assert.match(detailPage, /fontSize:\s*22/);
  assert.match(detailPage, /fontSize:\s*16/);
  assert.match(detailPage, /fontSize:\s*14/);
  assert.match(detailPage, /fontSize:\s*13/);
  assert.doesNotMatch(detailPage, /borderLeft:\s*"4px solid rgba\(76,175,80,0\.76\)"/);
  assert.match(detailPage, /padding:\s*"0 16px 16px"/);
  assert.match(detailPage, /minHeight:\s*44/);
});

test("ordered list screen uses app-readable restaurant card typography", async () => {
  const orderedPage = await readFile(`${ROOT}/src/components/order/OrderedPage.tsx`, "utf8");

  assert.doesNotMatch(orderedPage, /fontSize:\s*(?:7|8|9)(?:[,}]|px|\.5)/);
  assert.doesNotMatch(orderedPage, /text-\[(?:7|8|9)px\]/);
  assert.match(orderedPage, /fontSize:\s*18/);
  assert.match(orderedPage, /fontSize:\s*16/);
  assert.match(orderedPage, /fontSize:\s*13/);
  assert.match(orderedPage, /height:\s*26/);
  assert.match(orderedPage, /padding:\s*16/);
});

test("waiter order confirmation uses app-readable handoff typography", async () => {
  const orderConfirmPage = await readFile(`${ROOT}/src/components/order/OrderConfirmPage.tsx`, "utf8");

  assert.doesNotMatch(orderConfirmPage, /fontSize:\s*(?:7|8|8\.5|9|9\.5|10)(?:[,}]|px)/);
  assert.doesNotMatch(orderConfirmPage, /text-\[(?:7|8|9|10)px\]/);
  assert.match(orderConfirmPage, /gridTemplateColumns:\s*"56px minmax\(0, 1fr\) 46px auto"/);
  assert.match(orderConfirmPage, /width:\s*56,\s*height:\s*56/);
  assert.match(orderConfirmPage, /fontSize:\s*18/);
  assert.match(orderConfirmPage, /fontSize:\s*16/);
  assert.match(orderConfirmPage, /fontSize:\s*14/);
  assert.match(orderConfirmPage, /fontSize:\s*12/);
  assert.match(orderConfirmPage, /height:\s*44/);
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
  assert.match(orderConfirmPage, /gridTemplateColumns:\s*"56px minmax\(0, 1fr\) 46px auto"/);
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
