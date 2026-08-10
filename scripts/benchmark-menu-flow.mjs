#!/usr/bin/env node

/**
 * Benchmark the real menu recognition flow against a running DishLens server.
 *
 * Examples:
 *   node scripts/benchmark-menu-flow.mjs --base-url http://localhost:3000 public/sample-menus/english-menu-snacks-meat-sea.jpg
 *   node scripts/benchmark-menu-flow.mjs --base-url https://dishlens.wukongmkt.com --repeat 2 public/sample-menus/*.jpg
 */

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { basename, extname, join, resolve } from "node:path";
import sharp from "sharp";

const DEFAULT_BASE_URL = process.env.DISH_LENS_BASE_URL || "http://localhost:3000";
const DEFAULT_TARGET_LANG = process.env.DISH_LENS_TARGET_LANG || "zh";
const DEFAULT_POLL_MS = 1500;
const DEFAULT_TIMEOUT_MS = 180_000;
const DEFAULT_IMAGE_TIMEOUT_MS = 90_000;
const DEFAULT_SERVER_IMAGE_MAX_DIM = 1400;
const DEFAULT_SERVER_IMAGE_QUALITY = 76;
const DEFAULT_SERVER_IMAGE_NORMALIZE_BYTES = 300 * 1024;

function usage() {
  console.error([
    "Usage: node scripts/benchmark-menu-flow.mjs [options] <image...>",
    "",
    "Options:",
    "  --base-url <url>        Server base URL (default: http://localhost:3000)",
    "  --target-lang <lang>    Target language (default: zh)",
    "  --repeat <n>            Run the same upload multiple times (default: 1)",
    "  --cache-probe           Probe the client hash cache before uploading images",
    "  --cache-bust            Use temporary image copies with tiny markers to force cold-cache runs",
    "  --no-cache-bust         Reuse input images as-is (default)",
    "  --poll-ms <n>           Task polling interval in ms (default: 1500)",
    "  --timeout-ms <n>        Text-result timeout in ms (default: 180000)",
    "  --image-timeout-ms <n>  Extra image-backfill wait in ms (default: 90000)",
  ].join("\n"));
}

function parseArgs(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    targetLang: DEFAULT_TARGET_LANG,
    repeat: 1,
    pollMs: DEFAULT_POLL_MS,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    imageTimeoutMs: DEFAULT_IMAGE_TIMEOUT_MS,
    cacheProbe: false,
    cacheBust: false,
    images: [],
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
    if (arg === "--base-url") options.baseUrl = argv[++i] || options.baseUrl;
    else if (arg === "--target-lang") options.targetLang = argv[++i] || options.targetLang;
    else if (arg === "--repeat") options.repeat = Math.max(1, parseIntOption(argv[++i], 1));
    else if (arg === "--cache-probe") options.cacheProbe = true;
    else if (arg === "--cache-bust") options.cacheBust = true;
    else if (arg === "--no-cache-bust") options.cacheBust = false;
    else if (arg === "--poll-ms") options.pollMs = Math.max(250, parseIntOption(argv[++i], DEFAULT_POLL_MS));
    else if (arg === "--timeout-ms") options.timeoutMs = Math.max(5000, parseIntOption(argv[++i], DEFAULT_TIMEOUT_MS));
    else if (arg === "--image-timeout-ms") options.imageTimeoutMs = Math.max(0, parseIntOption(argv[++i], DEFAULT_IMAGE_TIMEOUT_MS));
    else if (arg.startsWith("--")) throw new Error(`Unknown option: ${arg}`);
    else options.images.push(arg);
  }

  if (options.images.length === 0) {
    usage();
    process.exit(1);
  }
  options.baseUrl = options.baseUrl.replace(/\/+$/, "");
  return options;
}

function parseIntOption(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mimeForPath(path) {
  const ext = extname(path).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function cacheBustColor(runIndex, imageIndex) {
  let hash = 2166136261;
  const key = `${process.pid}:${Date.now()}:${runIndex}:${imageIndex}`;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return {
    r: 32 + (hash & 0x7f),
    g: 32 + ((hash >> 8) & 0x7f),
    b: 32 + ((hash >> 16) & 0x7f),
  };
}

async function materializeCacheBustedImages(imagePaths, runIndex) {
  if (!imagePaths.length) return { images: [], cleanup: async () => {} };
  const dir = await mkdtemp(join(tmpdir(), "dishlens-menu-flow-"));
  const images = [];

  try {
    for (let imageIndex = 0; imageIndex < imagePaths.length; imageIndex++) {
      const imagePath = resolve(imagePaths[imageIndex]);
      const color = cacheBustColor(runIndex, imageIndex);
      const overlay = Buffer.from(
        `<svg width="6" height="6" xmlns="http://www.w3.org/2000/svg"><rect width="6" height="6" fill="rgb(${color.r},${color.g},${color.b})" opacity="0.72"/></svg>`,
      );
      const safeName = basename(imagePath).replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]+/g, "-");
      const outputPath = join(dir, `${runIndex}-${imageIndex}-${safeName || "menu"}.jpg`);
      await sharp(imagePath, { failOn: "none" })
        .rotate()
        .composite([{ input: overlay, gravity: "northwest" }])
        .jpeg({ quality: 92, mozjpeg: true })
        .toFile(outputPath);
      images.push(outputPath);
    }

    return {
      images,
      cleanup: async () => {
        await rm(dir, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw error;
  }
}

function bytesToHex(buffer) {
  return Buffer.from(buffer).toString("hex");
}

async function buildClientImageHash(imagePath, targetLang) {
  const absolute = resolve(imagePath);
  const bytes = await readFile(absolute);
  return bytesToHex(
    createHash("sha256")
      .update(`${targetLang}:`)
      .update(bytes)
      .digest(),
  ).slice(0, 32);
}

async function buildClientImageHashes(imagePaths, targetLang) {
  return Promise.all(imagePaths.map((imagePath) => buildClientImageHash(imagePath, targetLang)));
}

async function normalizeBenchmarkImageForServerHash(imagePath) {
  const absolute = resolve(imagePath);
  const bytes = await readFile(absolute);
  const mimeType = mimeForPath(absolute);
  const image = sharp(bytes, { failOn: "none" }).rotate();
  const metadata = await image.metadata();
  const exceedsMaxDim = Boolean(
    (metadata.width && metadata.width > DEFAULT_SERVER_IMAGE_MAX_DIM) ||
    (metadata.height && metadata.height > DEFAULT_SERVER_IMAGE_MAX_DIM),
  );
  const shouldNormalize =
    mimeType === "image/webp" ||
    bytes.length >= DEFAULT_SERVER_IMAGE_NORMALIZE_BYTES ||
    exceedsMaxDim;

  if (!shouldNormalize) return bytes;

  return sharp(bytes, { failOn: "none" })
    .rotate()
    .resize({
      width: DEFAULT_SERVER_IMAGE_MAX_DIM,
      height: DEFAULT_SERVER_IMAGE_MAX_DIM,
      fit: "inside",
      withoutEnlargement: true,
    })
    .sharpen({ sigma: 0.8, m1: 0.5, m2: 1.2 })
    .jpeg({
      quality: DEFAULT_SERVER_IMAGE_QUALITY,
      mozjpeg: true,
    })
    .toBuffer();
}

async function buildServerImageHash(imagePath, targetLang) {
  const bytes = await normalizeBenchmarkImageForServerHash(imagePath);
  return bytesToHex(
    createHash("sha256")
      .update(`${targetLang}:`)
      .update(bytes)
      .digest(),
  ).slice(0, 32);
}

async function buildServerImageHashes(imagePaths, targetLang) {
  return Promise.all(imagePaths.map((imagePath) => buildServerImageHash(imagePath, targetLang)));
}

async function buildBenchmarkClientHashSets(imagePaths, targetLang) {
  const serverHashes = await buildServerImageHashes(imagePaths, targetLang);
  const rawClientHashes = await buildClientImageHashes(imagePaths, targetLang);
  const clientHashSets = normalizeBenchmarkHashSets([serverHashes, rawClientHashes]);
  const clientHashes = clientHashSets[0] || [];
  return {
    hashes: clientHashes,
    hashSets: clientHashSets,
    hashMode: clientHashSets.length > 1 ? "server-normalized+client-raw" : "server-normalized",
  };
}

function normalizeBenchmarkHashSets(hashSets) {
  const seen = new Set();
  return hashSets
    .map((hashes) => hashes
      .map((hash) => String(hash || "").trim().toLowerCase())
      .filter((hash) => /^[a-f0-9]{32}$/.test(hash)))
    .filter((hashes) => hashes.length > 0)
    .filter((hashes) => {
      const key = hashes.slice().sort().join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function collectDishes(result) {
  const pages = Array.isArray(result?.pages) ? result.pages : [];
  return pages.flatMap((page) => Array.isArray(page?.dishes) ? page.dishes : []);
}

function countReadyImages(result) {
  const dishes = collectDishes(result);
  return dishes.filter((dish) => Boolean(dish?.ai_image_url || dish?.image_url)).length;
}

function summarizeResult(result) {
  const dishes = collectDishes(result);
  const imageReady = countReadyImages(result);
  const timings = result?.metadata?.timings || null;
  return {
    status: result?.status || null,
    page_count: Array.isArray(result?.pages) ? result.pages.length : 0,
    dish_count: dishes.length,
    image_ready: imageReady,
    image_missing: Math.max(0, dishes.length - imageReady),
    enrichment_status: result?.metadata?.enrichment_status || null,
    image_generation_status: result?.metadata?.image_generation_status || null,
    image_generation_progress: result?.metadata?.image_generation_progress || null,
    cache_hit_without_raw_read: Boolean(result?.metadata?.cache_hit_without_raw_read),
    raw_read_ms: Number.isFinite(timings?.rawReadMs) ? timings.rawReadMs : null,
    first_pass_model_name: timings?.firstPassModelName || null,
    first_pass_model_names: Array.isArray(timings?.firstPassModelNames)
      ? timings.firstPassModelNames
      : null,
    first_pass_model_ms_by_page: Array.isArray(timings?.firstPassModelMsByPage)
      ? timings.firstPassModelMsByPage
      : null,
    first_pass_build_ms_by_page: Array.isArray(timings?.firstPassBuildMsByPage)
      ? timings.firstPassBuildMsByPage
      : null,
    timings,
  };
}

function shouldKeepPollingForImages(result) {
  const summary = summarizeResult(result);
  if (summary.dish_count === 0) return false;
  if (summary.image_missing === 0) return false;
  return !["done", "partial", "failed"].includes(String(summary.image_generation_status || ""));
}

async function createFormData(imagePaths, targetLang) {
  const formData = new FormData();
  for (const imagePath of imagePaths) {
    const absolute = resolve(imagePath);
    const bytes = await readFile(absolute);
    formData.append("images", new Blob([bytes], { type: mimeForPath(absolute) }), basename(absolute));
  }
  formData.append("target_lang", targetLang);
  return formData;
}

async function probeTranslationCache(baseUrl, hashes, hashSets, targetLang) {
  const startedAt = Date.now();
  const response = await fetch(`${baseUrl}/api/v1/translate/menu/cache`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target_lang: targetLang, hashes, hash_sets: hashSets }),
  });
  const elapsedMs = Date.now() - startedAt;
  const data = await response.json().catch(() => ({}));
  return {
    ok: response.ok,
    hit: Boolean(response.ok && data?.hit && data?.result),
    result: response.ok && data?.hit ? data.result : null,
    task_id: data?.result?.task_id || null,
    status: response.status,
    elapsed_ms: elapsedMs,
  };
}

async function pollTask(baseUrl, taskId) {
  const response = await fetch(`${baseUrl}/api/v1/task/${taskId}`);
  if (!response.ok) throw new Error(`Task poll failed: HTTP ${response.status}`);
  return response.json();
}

async function runOnce(options, runIndex) {
  const startedAt = Date.now();
  let clientHashes = [];
  let clientHashSets = [];
  let cacheProbeMs = null;
  let cacheProbeHit = null;
  let cacheProbeHashMode = options.cacheProbe ? "server-normalized" : null;
  const preparedHashes = await buildBenchmarkClientHashSets(options.images, options.targetLang);
  clientHashSets = preparedHashes.hashSets;
  clientHashes = preparedHashes.hashes;

  if (options.cacheProbe) {
    cacheProbeHashMode = preparedHashes.hashMode;
    const cacheProbe = await probeTranslationCache(options.baseUrl, clientHashes, clientHashSets, options.targetLang);
    cacheProbeMs = cacheProbe.elapsed_ms;
    cacheProbeHit = cacheProbe.hit;
    if (cacheProbe.hit) {
      return {
        ok: true,
        run: runIndex,
        cached_immediate: true,
        cache_probe_hit: cacheProbeHit,
        cache_probe_ms: cacheProbeMs,
        cache_probe_hash_mode: cacheProbeHashMode || "server-normalized",
        task_id: cacheProbe.task_id,
        upload_response_ms: 0,
        first_result_ms: Date.now() - startedAt,
        text_done_ms: Date.now() - startedAt,
        image_done_ms: null,
        summary: summarizeResult(cacheProbe.result),
      };
    }
  }

  const formData = await createFormData(options.images, options.targetLang);
  if (clientHashes.length > 0) {
    formData.append("client_hashes", JSON.stringify(clientHashes));
  }
  if (clientHashSets.length > 0) {
    formData.append("client_hash_sets", JSON.stringify(clientHashSets));
  }
  const uploadStart = Date.now();
  const response = await fetch(`${options.baseUrl}/api/v1/translate/menu`, {
    method: "POST",
    body: formData,
  });
  const uploadResponseMs = Date.now() - uploadStart;

  const initial = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      run: runIndex,
      http_status: response.status,
      cache_probe_hit: cacheProbeHit,
      cache_probe_ms: cacheProbeMs,
      cache_probe_hash_mode: cacheProbeHashMode,
      upload_response_ms: uploadResponseMs,
      error: initial?.error || `HTTP ${response.status}`,
    };
  }

  if (response.status === 200 && initial?.pages) {
    let latest = initial;
    const taskId = initial?.task_id;
    const imageDeadline = Date.now() + options.imageTimeoutMs;
    while (
      taskId &&
      options.imageTimeoutMs > 0 &&
      shouldKeepPollingForImages(latest) &&
      Date.now() < imageDeadline
    ) {
      await sleep(options.pollMs);
      const task = await pollTask(options.baseUrl, taskId);
      latest = task.result || latest;
    }
    const imageDoneMs = shouldKeepPollingForImages(latest) ? null : Date.now() - startedAt;
    return {
      ok: true,
      run: runIndex,
      cached_immediate: true,
      cache_probe_hit: cacheProbeHit,
      cache_probe_ms: cacheProbeMs,
      cache_probe_hash_mode: cacheProbeHashMode,
      task_id: taskId || null,
      upload_response_ms: uploadResponseMs,
      first_result_ms: Date.now() - startedAt,
      text_done_ms: Date.now() - startedAt,
      image_done_ms: imageDoneMs,
      summary: summarizeResult(latest),
    };
  }

  const taskId = initial?.task_id;
  if (!taskId) {
    return {
      ok: false,
      run: runIndex,
      http_status: response.status,
      cache_probe_hit: cacheProbeHit,
      cache_probe_ms: cacheProbeMs,
      cache_probe_hash_mode: cacheProbeHashMode,
      upload_response_ms: uploadResponseMs,
      error: "Translation response did not include task_id",
      response: initial,
    };
  }

  let firstResultMs = null;
  let textDoneMs = null;
  let imageDoneMs = null;
  let latest = null;
  const textDeadline = startedAt + options.timeoutMs;
  while (Date.now() < textDeadline) {
    const task = await pollTask(options.baseUrl, taskId);
    latest = task.result || latest;
    if (latest && firstResultMs === null) firstResultMs = Date.now() - startedAt;
    if (["done", "partial", "failed"].includes(task.status)) {
      textDoneMs = Date.now() - startedAt;
      break;
    }
    await sleep(options.pollMs);
  }

  const imageDeadline = Date.now() + options.imageTimeoutMs;
  while (latest && options.imageTimeoutMs > 0 && shouldKeepPollingForImages(latest) && Date.now() < imageDeadline) {
    await sleep(options.pollMs);
    const task = await pollTask(options.baseUrl, taskId);
    latest = task.result || latest;
  }
  if (latest && !shouldKeepPollingForImages(latest)) imageDoneMs = Date.now() - startedAt;

  return {
    ok: Boolean(latest),
    run: runIndex,
    cached_immediate: false,
    cache_probe_hit: cacheProbeHit,
    cache_probe_ms: cacheProbeMs,
    cache_probe_hash_mode: cacheProbeHashMode,
    task_id: taskId,
    upload_response_ms: uploadResponseMs,
    first_result_ms: firstResultMs,
    text_done_ms: textDoneMs,
    image_done_ms: imageDoneMs,
    total_elapsed_ms: Date.now() - startedAt,
    timed_out: !latest || textDoneMs === null,
    summary: summarizeResult(latest),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = {
    ok: true,
    base_url: options.baseUrl,
    target_lang: options.targetLang,
    image_count: options.images.length,
    images: options.images.map((image) => resolve(image)),
    repeat: options.repeat,
    cache_bust: options.cacheBust,
    runs: [],
  };

  for (let i = 1; i <= options.repeat; i++) {
    const cacheBusted = options.cacheBust
      ? await materializeCacheBustedImages(options.images, i)
      : { images: options.images, cleanup: async () => {} };

    try {
      const runOptions = { ...options, images: cacheBusted.images };
      const run = await runOnce(runOptions, i);
      if (options.cacheBust) {
        run.cache_bust_enabled = true;
        run.cache_bust_image_count = cacheBusted.images.length;
      }
      report.runs.push(run);
      if (!run.ok) report.ok = false;
    } finally {
      await cacheBusted.cleanup();
    }
  }

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.log(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exitCode = 1;
});
