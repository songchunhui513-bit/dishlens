#!/usr/bin/env node

/**
 * Convert runtime AI-generated dish PNGs to compact WebP files.
 *
 * Usage:
 *   node scripts/optimize-generated-dish-images.mjs
 *   node scripts/optimize-generated-dish-images.mjs --dry-run
 *   node scripts/optimize-generated-dish-images.mjs --prune-png
 *   GENERATED_DISH_MAX_DIM=768 GENERATED_DISH_WEBP_QUALITY=82 node scripts/optimize-generated-dish-images.mjs
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, stat, unlink } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const GENERATED_DIR = join(ROOT, "public", "generated-dishes");
const MAX_DIM = Number.parseInt(process.env.GENERATED_DISH_MAX_DIM || "768", 10) || 768;
const WEBP_QUALITY = Number.parseInt(process.env.GENERATED_DISH_WEBP_QUALITY || "82", 10) || 82;
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const prunePng = args.has("--prune-png");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Math.max(0, Number.parseInt(limitArg.split("=")[1] || "0", 10) || 0) : 0;

function webpPathForPng(fileName) {
  return join(GENERATED_DIR, fileName.replace(/\.png$/i, ".webp"));
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

async function optimizePng(fileName) {
  const inputPath = join(GENERATED_DIR, fileName);
  const outputPath = webpPathForPng(fileName);
  const pngBytes = await fileSize(inputPath);
  const existingWebpBytes = await fileSize(outputPath);

  if (!dryRun && existingWebpBytes === 0) {
    await sharp(inputPath, { failOn: "none" })
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

  const webpBytes = dryRun ? existingWebpBytes : await fileSize(outputPath);
  let pruned = false;
  if (prunePng && webpBytes > 0 && !dryRun) {
    await unlink(inputPath);
    pruned = true;
  }

  return {
    file: fileName,
    webp: basename(outputPath),
    pngBytes,
    webpBytes,
    savedBytes: webpBytes > 0 ? Math.max(0, pngBytes - webpBytes) : 0,
    converted: existingWebpBytes === 0,
    pruned,
  };
}

async function main() {
  if (!existsSync(GENERATED_DIR)) {
    console.error(`Missing generated image directory: ${GENERATED_DIR}`);
    process.exit(1);
  }

  await mkdir(GENERATED_DIR, { recursive: true });
  const files = (await readdir(GENERATED_DIR))
    .filter((file) => extname(file).toLowerCase() === ".png" && basename(file) === file)
    .sort();
  const targets = limit > 0 ? files.slice(0, limit) : files;

  let pngTotal = 0;
  let webpTotal = 0;
  let savedTotal = 0;
  let converted = 0;
  let pruned = 0;
  const largest = [];

  for (const file of targets) {
    const result = await optimizePng(file);
    pngTotal += result.pngBytes;
    webpTotal += result.webpBytes;
    savedTotal += result.savedBytes;
    converted += result.converted ? 1 : 0;
    pruned += result.pruned ? 1 : 0;
    largest.push(result);
  }

  largest.sort((a, b) => b.savedBytes - a.savedBytes);
  console.log(JSON.stringify({
    generatedDir: GENERATED_DIR,
    dryRun,
    prunePng,
    maxDim: MAX_DIM,
    quality: WEBP_QUALITY,
    scannedPng: files.length,
    processed: targets.length,
    converted,
    pruned,
    before: formatBytes(pngTotal),
    afterWebp: formatBytes(webpTotal),
    saved: formatBytes(savedTotal),
    largestSavings: largest.slice(0, 12).map((item) => ({
      file: item.file,
      webp: item.webp,
      png: formatBytes(item.pngBytes),
      webpSize: formatBytes(item.webpBytes),
      saved: formatBytes(item.savedBytes),
    })),
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
