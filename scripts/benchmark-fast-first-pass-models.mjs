#!/usr/bin/env node

/**
 * benchmark-fast-first-pass-models
 *
 * Runs the real menu benchmark against isolated local Next.js servers, one
 * server per fast first-pass model candidate. This keeps QWEN model selection
 * honest because src/lib/ai/qwen.ts reads QWEN_FAST_FIRST_PASS_MODELS at
 * process startup.
 *
 * Example:
 *   npm run build
 *   node scripts/benchmark-fast-first-pass-models.mjs \
 *     --models qwen-vl-plus,qwen-vl-max \
 *     --target-lang zh \
 *     --repeat 2 \
 *     --image-timeout-ms 0 \
 *     '/Users/julian/Documents/菜单/20260522-184232.jpg'
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import sharp from "sharp";

const DEFAULT_MODELS = process.env.QWEN_FAST_FIRST_PASS_MODELS || "qwen-vl-plus,qwen-vl-max";
const DEFAULT_BASE_PORT = 3210;
const DEFAULT_TARGET_LANG = process.env.DISH_LENS_TARGET_LANG || "zh";
const DEFAULT_REPEAT = 1;
const DEFAULT_TIMEOUT_MS = 180_000;
const DEFAULT_IMAGE_TIMEOUT_MS = 0;
const DEFAULT_POLL_MS = 1500;
const DEFAULT_SERVER_READY_TIMEOUT_MS = 60_000;
const BENCHMARK_SCRIPT_RELATIVE_PATH = "/scripts/benchmark-menu-flow.mjs";
const cacheBustSessionId = `${process.pid}:${Date.now()}:${Math.random().toString(16).slice(2)}`;

function usage() {
  console.error([
    "Usage: node scripts/benchmark-fast-first-pass-models.mjs [options] <image...>",
    "",
    "Options:",
    "  --models <a,b>                 Fast first-pass models to compare",
    "  --base-port <n>                First local port to use (default: 3210)",
    "  --target-lang <lang>           Target language (default: zh)",
    "  --repeat <n>                   Benchmark repeats per model (default: 1)",
    "  --poll-ms <n>                  Task polling interval passed to benchmark-menu-flow",
    "  --timeout-ms <n>               Text-result timeout per run (default: 180000)",
    "  --image-timeout-ms <n>         Image wait per run; default 0 for OCR/model A/B",
    "  --server-ready-timeout-ms <n>  Local server startup timeout (default: 60000)",
    "  --server-command <cmd>         Custom command; receives PORT in env",
    "  --no-cache-bust                Reuse input images as-is; faster but can pollute A/B results",
    "  --continue-on-error            Keep benchmarking remaining models after failures",
    "",
    "Run npm run build before using the default production server command.",
  ].join("\n"));
}

function parseIntOption(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseModels(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseArgs(argv) {
  const options = {
    models: parseModels(DEFAULT_MODELS),
    basePort: DEFAULT_BASE_PORT,
    targetLang: DEFAULT_TARGET_LANG,
    repeat: DEFAULT_REPEAT,
    pollMs: DEFAULT_POLL_MS,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    imageTimeoutMs: DEFAULT_IMAGE_TIMEOUT_MS,
    serverReadyTimeoutMs: DEFAULT_SERVER_READY_TIMEOUT_MS,
    serverCommand: "",
    cacheBust: true,
    continueOnError: true,
    images: [],
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else if (arg === "--models") {
      options.models = parseModels(argv[++i]);
    } else if (arg === "--base-port") {
      options.basePort = Math.max(1024, parseIntOption(argv[++i], DEFAULT_BASE_PORT));
    } else if (arg === "--target-lang") {
      options.targetLang = argv[++i] || options.targetLang;
    } else if (arg === "--repeat") {
      options.repeat = Math.max(1, parseIntOption(argv[++i], DEFAULT_REPEAT));
    } else if (arg === "--poll-ms") {
      options.pollMs = Math.max(250, parseIntOption(argv[++i], DEFAULT_POLL_MS));
    } else if (arg === "--timeout-ms") {
      options.timeoutMs = Math.max(5000, parseIntOption(argv[++i], DEFAULT_TIMEOUT_MS));
    } else if (arg === "--image-timeout-ms") {
      options.imageTimeoutMs = Math.max(0, parseIntOption(argv[++i], DEFAULT_IMAGE_TIMEOUT_MS));
    } else if (arg === "--server-ready-timeout-ms") {
      options.serverReadyTimeoutMs = Math.max(5000, parseIntOption(argv[++i], DEFAULT_SERVER_READY_TIMEOUT_MS));
    } else if (arg === "--server-command") {
      options.serverCommand = argv[++i] || "";
    } else if (arg === "--no-cache-bust") {
      options.cacheBust = false;
    } else if (arg === "--continue-on-error") {
      options.continueOnError = true;
    } else if (arg === "--stop-on-error") {
      options.continueOnError = false;
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      options.images.push(arg);
    }
  }

  if (options.models.length === 0) throw new Error("At least one model is required");
  if (options.images.length === 0) {
    usage();
    process.exit(1);
  }

  return options;
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function startServer({ model, port, serverCommand }) {
  const env = {
    ...process.env,
    PORT: String(port),
    // MENU_FAST_FIRST_PASS=true keeps every candidate on the lightweight first-paint path.
    MENU_FAST_FIRST_PASS: "true",
    QWEN_FAST_FIRST_PASS_MODELS: model,
  };

  if (serverCommand) {
    return spawn(serverCommand, {
      cwd: process.cwd(),
      env,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
  }

  return spawn("npm", ["run", "start", "--", "--port", String(port)], {
    cwd: process.cwd(),
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function waitForServerReady(baseUrl, timeoutMs, server) {
  const startedAt = Date.now();
  let lastError = "";

  while (Date.now() - startedAt < timeoutMs) {
    if (server.exitCode !== null) {
      throw new Error(`Server exited before ready with code ${server.exitCode}`);
    }
    try {
      const response = await fetch(baseUrl, { method: "GET" });
      if (response.status < 500) return Date.now() - startedAt;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(500);
  }

  throw new Error(`Server did not become ready in ${timeoutMs}ms${lastError ? `: ${lastError}` : ""}`);
}

function parseBenchmarkJson(stdout) {
  const trimmed = String(stdout || "").trim();
  if (!trimmed) throw new Error("benchmark-menu-flow produced no stdout");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) throw new Error("benchmark-menu-flow stdout did not contain JSON");
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

async function runBenchmarkForServer({ baseUrl, options }) {
  const args = [
    resolve(`.${BENCHMARK_SCRIPT_RELATIVE_PATH}`),
    "--base-url", baseUrl,
    "--target-lang", options.targetLang,
    "--repeat", String(options.repeat),
    "--poll-ms", String(options.pollMs),
    "--timeout-ms", String(options.timeoutMs),
    "--image-timeout-ms", String(options.imageTimeoutMs),
    ...options.images,
  ];

  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  const [code] = await once(child, "exit");
  const report = parseBenchmarkJson(stdout);
  if (code !== 0 && report.ok !== false) {
    report.ok = false;
    report.error = stderr.trim() || `benchmark-menu-flow exited with ${code}`;
  }
  return report;
}

function cacheBustColor(model, runIndex, imageIndex) {
  let hash = 2166136261;
  const key = `${cacheBustSessionId}:${model}:${runIndex}:${imageIndex}`;
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

async function materializeCacheBustedImages(imagePaths, model, runIndex) {
  if (!imagePaths.length) return { images: [], cleanup: async () => {} };
  const dir = await mkdtemp(join(tmpdir(), "dishlens-model-ab-"));
  const images = [];

  try {
    for (let imageIndex = 0; imageIndex < imagePaths.length; imageIndex++) {
      const imagePath = resolve(imagePaths[imageIndex]);
      const color = cacheBustColor(model, runIndex, imageIndex);
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

function median(values) {
  const sorted = values.filter((value) => Number.isFinite(value)).slice().sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function summarizeRuns(benchmarkReport) {
  const runs = Array.isArray(benchmarkReport?.runs) ? benchmarkReport.runs : [];
  const successfulRuns = runs.filter((run) => run?.ok);
  const firstResultMs = successfulRuns.map((run) => run.first_result_ms);
  const firstPassModelMs = successfulRuns.flatMap((run) => {
    const byPage = run?.summary?.first_pass_model_ms_by_page;
    if (Array.isArray(byPage)) return byPage.filter((value) => Number.isFinite(value));
    const total = run?.summary?.timings?.firstPassModelMs;
    return Number.isFinite(total) ? [total] : [];
  });

  return {
    run_count: runs.length,
    ok_count: successfulRuns.length,
    success_rate: runs.length ? successfulRuns.length / runs.length : 0,
    median_first_result_ms: median(firstResultMs),
    median_first_pass_model_ms: median(firstPassModelMs),
    first_result_ms: firstResultMs,
    first_pass_model_ms: firstPassModelMs,
  };
}

function pickBestModel(results) {
  const ranked = results
    .filter((item) => item.ok && item.summary?.median_first_result_ms !== null)
    .sort((a, b) => {
      const first = a.summary.median_first_result_ms - b.summary.median_first_result_ms;
      if (first !== 0) return first;
      return (b.summary.success_rate || 0) - (a.summary.success_rate || 0);
    });
  return ranked[0]?.model || null;
}

async function stopServer(server) {
  if (!server || server.exitCode !== null) return;
  server.kill("SIGTERM");
  const exit = once(server, "exit");
  await Promise.race([exit, sleep(5000)]);
  if (server.exitCode === null) server.kill("SIGKILL");
}

async function benchmarkModel(model, index, options) {
  const port = options.basePort + index;
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = startServer({ model, port, serverCommand: options.serverCommand });
  let serverLog = "";
  server.stdout.on("data", (chunk) => { serverLog += chunk.toString(); });
  server.stderr.on("data", (chunk) => { serverLog += chunk.toString(); });

  try {
    const server_ready_ms = await waitForServerReady(baseUrl, options.serverReadyTimeoutMs, server);
    const benchmarkReports = [];

    for (let runIndex = 1; runIndex <= options.repeat; runIndex++) {
      const cacheBusted = options.cacheBust
        ? await materializeCacheBustedImages(options.images, model, runIndex)
        : { images: options.images, cleanup: async () => {} };

      try {
        const benchmarkOptions = { ...options, repeat: 1, images: cacheBusted.images };
        const benchmark = await runBenchmarkForServer({ baseUrl, options: benchmarkOptions });
        benchmarkReports.push(benchmark);
      } finally {
        await cacheBusted.cleanup();
      }
    }

    const benchmark = {
      ok: benchmarkReports.every((report) => report.ok),
      runs: benchmarkReports.flatMap((report) => Array.isArray(report?.runs) ? report.runs : []),
      reports: benchmarkReports,
    };

    return {
      ok: Boolean(benchmark.ok),
      model,
      port,
      base_url: baseUrl,
      server_ready_ms,
      cache_bust: options.cacheBust,
      cache_bust_image_count: options.cacheBust ? options.images.length * options.repeat : 0,
      summary: summarizeRuns(benchmark),
      benchmark,
    };
  } catch (error) {
    return {
      ok: false,
      model,
      port,
      base_url: baseUrl,
      error: error instanceof Error ? error.message : String(error),
      server_log_tail: serverLog.slice(-2000),
    };
  } finally {
    await stopServer(server);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const results = [];

  for (let i = 0; i < options.models.length; i++) {
    const result = await benchmarkModel(options.models[i], i, options);
    results.push(result);
    if (!result.ok && !options.continueOnError) break;
  }

  const report = {
    ok: results.some((item) => item.ok),
    target_lang: options.targetLang,
    images: options.images.map((image) => resolve(image)),
    models: options.models,
    repeat: options.repeat,
    cache_bust: options.cacheBust,
    best_model: pickBestModel(results),
    results,
    continueOnError: options.continueOnError,
  };

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
