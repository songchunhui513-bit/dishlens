#!/usr/bin/env node

/**
 * Download images from pollinations.ai URLs in dish-knowledge-db.json
 * and update the JSON to point to compact local /dishes/<slug>.webp paths.
 *
 * IMPORTANT: pollinations.ai limits to 1 concurrent request per IP.
 * This script processes strictly sequentially with rate-limit-aware retries.
 * Saves JSON incrementally every 25 entries.
 *
 * Usage:
 *   node scripts/download-knowledge-images.mjs
 *   node scripts/download-knowledge-images.mjs --existing-only
 *   DOWNLOAD_LIMIT=20 node scripts/download-knowledge-images.mjs
 *   node scripts/download-knowledge-images.mjs --limit=20
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const JSON_PATH = join(PROJECT_ROOT, 'public', 'dish-knowledge-db.json');
const DISHES_DIR = join(PROJECT_ROOT, 'public', 'dishes');

const args = process.argv.slice(2);
const EXISTING_ONLY = args.includes('--existing-only');
const limitArg = args.find((arg) => arg.startsWith('--limit='));
const DOWNLOAD_LIMIT = Number.parseInt(
  process.env.DOWNLOAD_LIMIT || (limitArg ? limitArg.split('=')[1] : '') || '0',
  10,
) || 0;

const DELAY_MS = 3000; // 3s between downloads (pollinations needs it)
const DOWNLOAD_TIMEOUT_MS = 120000; // 120 seconds - pollinations generates on-the-fly
const RATE_LIMIT_INITIAL_DELAY_MS = 30000; // 30 seconds initial wait on rate limit
const MAX_RATE_LIMIT_RETRIES = 5;
const SAVE_EVERY_N = 25;
const USER_AGENT = 'DishLensImageDownloader/1.0 (contact@dishlens.app)';
const KNOWLEDGE_DISH_MAX_DIM = Number.parseInt(process.env.KNOWLEDGE_DISH_MAX_DIM || '768', 10) || 768;
const KNOWLEDGE_DISH_WEBP_QUALITY = Number.parseInt(process.env.KNOWLEDGE_DISH_WEBP_QUALITY || '82', 10) || 82;

// Ensure dishes directory exists
if (!existsSync(DISHES_DIR)) {
  mkdirSync(DISHES_DIR, { recursive: true });
}

// Read and parse JSON
console.log('Reading JSON file...');
const raw = readFileSync(JSON_PATH, 'utf8');
const data = JSON.parse(raw);
const entries = Array.isArray(data) ? data : data.dishes || data.entries || Object.values(data);
console.log(`Total entries: ${entries.length}`);

// Find entries that need downloading
const toDownload = [];
for (const entry of entries) {
  const id = entry.id;
  if (!id) continue;

  const cardNeedsDownload = entry.card && entry.card.includes('pollinations.ai');
  const heroNeedsDownload = entry.hero && entry.hero.includes('pollinations.ai');

  if (cardNeedsDownload || heroNeedsDownload) {
    toDownload.push({
      id,
      entry,
      cardNeedsDownload,
      heroNeedsDownload,
    });
  }
}

console.log(`Entries with pollinations.ai URLs: ${toDownload.length}`);
if (EXISTING_ONLY) {
  console.log('Mode: existing-only (no network downloads)');
}
if (DOWNLOAD_LIMIT > 0) {
  console.log(`Download limit: ${DOWNLOAD_LIMIT}`);
}

if (toDownload.length === 0) {
  console.log('Nothing to download. Exiting.');
  process.exit(0);
}

const workItems = DOWNLOAD_LIMIT > 0 ? toDownload.slice(0, DOWNLOAD_LIMIT) : toDownload;

// Helper: delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper: download image with exponential-backoff rate-limit retries
async function downloadImage(url, destPath) {
  let retry = 0;

  while (retry <= MAX_RATE_LIMIT_RETRIES) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      });

      // Check for rate limiting (402 Payment Required or 429 Too Many Requests)
      if (response.status === 402 || response.status === 429) {
        retry++;
        if (retry <= MAX_RATE_LIMIT_RETRIES) {
          // Exponential backoff: 30s, 60s, 120s, 240s, 480s
          const waitMs = RATE_LIMIT_INITIAL_DELAY_MS * Math.pow(2, retry - 1);
          console.log(`  Rate limited (${response.status}), waiting ${waitMs / 1000}s (retry ${retry}/${MAX_RATE_LIMIT_RETRIES})...`);
          await delay(waitMs);
          continue;
        }
        throw new Error(`Rate limited after ${MAX_RATE_LIMIT_RETRIES} retries (HTTP ${response.status})`);
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      // Check content type - should be an image
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        throw new Error(`Got JSON response instead of image (${contentType})`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length < 1000) {
        throw new Error(`Response too small (${buffer.length} bytes)`);
      }

      const optimized = await sharp(buffer, { failOn: 'none' })
        .rotate()
        .resize({
          width: KNOWLEDGE_DISH_MAX_DIM,
          height: KNOWLEDGE_DISH_MAX_DIM,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: KNOWLEDGE_DISH_WEBP_QUALITY, effort: 5 })
        .toBuffer();
      writeFileSync(destPath, optimized);
      return { ok: true };
    } catch (err) {
      if (err.name === 'AbortError' || err.message.includes('timeout')) {
        retry++;
        if (retry <= MAX_RATE_LIMIT_RETRIES) {
          const waitMs = RATE_LIMIT_INITIAL_DELAY_MS * Math.pow(2, retry - 1);
          console.log(`  Timeout, waiting ${waitMs / 1000}s (retry ${retry}/${MAX_RATE_LIMIT_RETRIES})...`);
          await delay(waitMs);
          continue;
        }
      }
      throw err;
    }
  }

  return { ok: false, error: 'Max rate limit retries exceeded' };
}

// Save JSON
function saveJson() {
  const output = JSON.stringify(data);
  writeFileSync(JSON_PATH, output, 'utf8');
}

// Process entries sequentially
let succeeded = 0;
let skipped = 0;
let missingExistingOnly = 0;
let failed = 0;
let processedSinceLastSave = 0;
const errors = [];

const startTime = Date.now();

for (let i = 0; i < workItems.length; i++) {
  const { id, entry, cardNeedsDownload, heroNeedsDownload } = workItems[i];
  const localPath = `/dishes/${id}.webp`;
  const destPath = join(DISHES_DIR, `${id}.webp`);

  const fileExists = existsSync(destPath);

  // Show progress with ETA
  const elapsed = (Date.now() - startTime) / 1000;
  const rate = i > 0 ? i / elapsed : 0;
  const remaining = rate > 0 ? (workItems.length - i) / rate : 0;
  const etaMin = Math.round(remaining / 60);

  console.log(
    `[${i + 1}/${workItems.length}] ${id}` +
      (fileExists ? ' (exists)' : '') +
      (i > 0 ? ` | ~${etaMin}min remaining` : '')
  );

  if (!fileExists) {
    if (EXISTING_ONLY) {
      console.log('  Missing local file, existing-only mode skips network download');
      missingExistingOnly++;
      continue;
    }

    const downloadUrl = cardNeedsDownload ? entry.card : heroNeedsDownload ? entry.hero : null;

    if (downloadUrl) {
      try {
        await downloadImage(downloadUrl, destPath);
        succeeded++;
      } catch (err) {
        console.error(`  FAILED: ${err.message}`);
        failed++;
        errors.push({ id, error: err.message });
        // Don't update JSON for failed entries
        await delay(DELAY_MS);
        continue;
      }
    }
  } else {
    skipped++;
  }

  // Update JSON entry
  if (cardNeedsDownload) {
    entry.card = localPath;
  }
  if (heroNeedsDownload) {
    entry.hero = localPath;
  }

  processedSinceLastSave++;

  // Incremental save
  if (processedSinceLastSave >= SAVE_EVERY_N) {
    console.log(`  Saving progress (${i + 1} processed, ${failed} failed)...`);
    saveJson();
    processedSinceLastSave = 0;
  }

  // Rate limit delay between requests
  if (!fileExists && i < workItems.length - 1) {
    await delay(DELAY_MS);
  }
}

// Final save
console.log('\nSaving final JSON...');
saveJson();
console.log('JSON saved.');

// Summary
const totalTime = Math.round((Date.now() - startTime) / 1000);
console.log('\n========== SUMMARY ==========');
console.log(`Total time:       ${Math.round(totalTime / 60)}m ${totalTime % 60}s`);
console.log(`Total entries:    ${workItems.length}`);
console.log(`Downloaded:       ${succeeded}`);
console.log(`Already existed:  ${skipped}`);
if (EXISTING_ONLY) {
  console.log(`Missing skipped:   ${missingExistingOnly}`);
}
console.log(`Failed:           ${failed}`);
if (errors.length > 0) {
  console.log(`\nFailed entries (${errors.length}):`);
  for (const e of errors) {
    console.log(`  - ${e.id}: ${e.error}`);
  }
}
console.log('=============================');
