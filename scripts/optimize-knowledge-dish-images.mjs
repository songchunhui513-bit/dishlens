#!/usr/bin/env node

/**
 * Convert committed local dish knowledge images to compact WebP files and
 * rewrite public/dish-knowledge-db.json references.
 *
 * Usage:
 *   node scripts/optimize-knowledge-dish-images.mjs --dry-run
 *   node scripts/optimize-knowledge-dish-images.mjs
 *   node scripts/optimize-knowledge-dish-images.mjs --prune-source
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const DISH_DIR = join(ROOT, "public", "dishes");
const DB_PATH = join(ROOT, "public", "dish-knowledge-db.json");
const MAX_DIM = Number.parseInt(process.env.KNOWLEDGE_DISH_MAX_DIM || "768", 10) || 768;
const WEBP_QUALITY = Number.parseInt(process.env.KNOWLEDGE_DISH_WEBP_QUALITY || "82", 10) || 82;
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const pruneSource = args.has("--prune-source");
const supportedExts = new Set([".png", ".jpg", ".jpeg"]);

function isLocalDishImage(value) {
  return typeof value === "string" && value.startsWith("/dishes/") && supportedExts.has(extname(value).toLowerCase());
}

function sourcePathForUrl(url) {
  return join(ROOT, "public", url);
}

function webpUrlForSourceUrl(url) {
  return url.replace(/\.(png|jpe?g)$/i, ".webp");
}

function webpPathForSourceUrl(url) {
  return sourcePathForUrl(webpUrlForSourceUrl(url));
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function fileSize(path) {
  try {
    return (await stat(path)).size;
  } catch {
    return 0;
  }
}

async function optimizeImage(sourceUrl) {
  const sourcePath = sourcePathForUrl(sourceUrl);
  const outputPath = webpPathForSourceUrl(sourceUrl);
  const before = await fileSize(sourcePath);
  const existingWebp = await fileSize(outputPath);

  if (!dryRun && existingWebp === 0) {
    await mkdir(DISH_DIR, { recursive: true });
    await sharp(sourcePath, { failOn: "none" })
      .rotate()
      .resize({
        width: MAX_DIM,
        height: MAX_DIM,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY, effort: 5 })
      .toFile(outputPath);
  }

  const after = dryRun ? existingWebp : await fileSize(outputPath);
  let pruned = false;
  if (pruneSource && after > 0 && !dryRun) {
    await unlink(sourcePath);
    pruned = true;
  }

  return {
    source: sourceUrl,
    webp: webpUrlForSourceUrl(sourceUrl),
    before,
    after,
    saved: after > 0 ? Math.max(0, before - after) : 0,
    converted: existingWebp === 0,
    pruned,
  };
}

async function listUnreferencedLocalSources(referenced) {
  const files = await readdir(DISH_DIR);
  return files
    .filter((file) => supportedExts.has(extname(file).toLowerCase()))
    .map((file) => `/dishes/${file}`)
    .filter((url) => !referenced.has(url));
}

async function main() {
  if (!existsSync(DISH_DIR)) {
    console.error(`Missing dish image directory: ${DISH_DIR}`);
    process.exit(1);
  }
  const db = JSON.parse(await readFile(DB_PATH, "utf8"));
  const referenced = new Set();

  for (const entry of db) {
    if (isLocalDishImage(entry.card)) referenced.add(entry.card);
    if (isLocalDishImage(entry.hero)) referenced.add(entry.hero);
  }

  const unreferenced = await listUnreferencedLocalSources(referenced);
  const targets = Array.from(new Set([...referenced, ...unreferenced]))
    .filter((url) => existsSync(sourcePathForUrl(url)))
    .sort();

  let beforeTotal = 0;
  let afterTotal = 0;
  let savedTotal = 0;
  let converted = 0;
  let pruned = 0;
  const rows = [];

  for (const target of targets) {
    const row = await optimizeImage(target);
    beforeTotal += row.before;
    afterTotal += row.after;
    savedTotal += row.saved;
    converted += row.converted ? 1 : 0;
    pruned += row.pruned ? 1 : 0;
    rows.push(row);
  }

  if (!dryRun) {
    for (const entry of db) {
      if (isLocalDishImage(entry.card)) entry.card = webpUrlForSourceUrl(entry.card);
      if (isLocalDishImage(entry.hero)) entry.hero = webpUrlForSourceUrl(entry.hero);
    }
    await writeFile(DB_PATH, JSON.stringify(db), "utf8");
  }

  rows.sort((a, b) => b.saved - a.saved);
  console.log(JSON.stringify({
    dishDir: DISH_DIR,
    dryRun,
    pruneSource,
    maxDim: MAX_DIM,
    quality: WEBP_QUALITY,
    referencedSources: referenced.size,
    unreferencedSources: unreferenced.length,
    processed: targets.length,
    converted,
    pruned,
    before: formatBytes(beforeTotal),
    afterWebp: formatBytes(afterTotal),
    saved: formatBytes(savedTotal),
    largestSavings: rows.slice(0, 12).map((item) => ({
      source: item.source,
      webp: item.webp,
      before: formatBytes(item.before),
      after: formatBytes(item.after),
      saved: formatBytes(item.saved),
    })),
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
