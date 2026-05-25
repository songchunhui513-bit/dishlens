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
  const { storageIdForGeneratedDishImage } = await loadTsModule(
    `${ROOT}/src/lib/dish-image-persistence.ts`,
  );

  assert.equal(storageIdForGeneratedDishImage({ id: "db-dish-1" }), "db-dish-1");
  assert.equal(
    storageIdForGeneratedDishImage({ id: "temp-123", name_original: "LA MARINARA 11,50€" }),
    "generated-la-marinara-11-50",
  );
  assert.equal(
    storageIdForGeneratedDishImage({ name_original: "Crème brûlée" }),
    "generated-creme-brulee",
  );
});

test("next image config allows DashScope result hosts", async () => {
  const config = await readFile(`${ROOT}/next.config.ts`, "utf8");
  assert.match(config, /\*\*\.aliyuncs\.com/);
});
