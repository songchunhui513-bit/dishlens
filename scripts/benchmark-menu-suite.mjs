#!/usr/bin/env node

/**
 * benchmark-menu-suite
 *
 * Runs the real menu recognition benchmark across multiple representative menu
 * photos and aggregates first-paint, model, cache, and image-backfill metrics.
 */

import { execFile } from "node:child_process";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const FLOW_SCRIPT_LABEL = "/scripts/benchmark-menu-flow.mjs";
const FLOW_SCRIPT = resolve(import.meta.dirname, "benchmark-menu-flow.mjs");
const DEFAULT_BASE_URL = process.env.DISH_LENS_BASE_URL || "http://localhost:3000";
const DEFAULT_TARGET_LANG = process.env.DISH_LENS_TARGET_LANG || "zh";
const DEFAULT_TIMEOUT_MS = 180_000;
const DEFAULT_IMAGE_TIMEOUT_MS = 0;
const DEFAULT_POLL_MS = 1500;

function usage() {
  console.error([
    "Usage: node scripts/benchmark-menu-suite.mjs [options] <image...>",
    "",
    "Options:",
    "  --base-url <url>          Server base URL (default: http://localhost:3000)",
    "  --target-lang <lang>      Target language (default: zh)",
    "  --repeat <n>              Runs per image (default: 1)",
    "  --cache-probe             Probe cache before each upload",
    "  --cache-bust              Ask benchmark-menu-flow to force cold-cache image uploads",
    "  --no-cache-bust           Reuse input images as-is (default)",
    "  --poll-ms <n>             Task polling interval in ms (default: 1500)",
    "  --timeout-ms <n>          Text-result timeout in ms (default: 180000)",
    "  --image-timeout-ms <n>    Extra image-backfill wait in ms (default: 0)",
    "  --continue-on-error       Continue when one image benchmark fails",
  ].join("\n"));
}

function parseIntOption(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseArgs(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    targetLang: DEFAULT_TARGET_LANG,
    repeat: 1,
    cacheProbe: false,
    cacheBust: false,
    pollMs: DEFAULT_POLL_MS,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    imageTimeoutMs: DEFAULT_IMAGE_TIMEOUT_MS,
    continueOnError: false,
    images: [],
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else if (arg === "--base-url") options.baseUrl = argv[++i] || options.baseUrl;
    else if (arg === "--target-lang") options.targetLang = argv[++i] || options.targetLang;
    else if (arg === "--repeat") options.repeat = Math.max(1, parseIntOption(argv[++i], 1));
    else if (arg === "--cache-probe") options.cacheProbe = true;
    else if (arg === "--cache-bust") options.cacheBust = true;
    else if (arg === "--no-cache-bust") options.cacheBust = false;
    else if (arg === "--poll-ms") options.pollMs = Math.max(250, parseIntOption(argv[++i], DEFAULT_POLL_MS));
    else if (arg === "--timeout-ms") options.timeoutMs = Math.max(5000, parseIntOption(argv[++i], DEFAULT_TIMEOUT_MS));
    else if (arg === "--image-timeout-ms") options.imageTimeoutMs = Math.max(0, parseIntOption(argv[++i], DEFAULT_IMAGE_TIMEOUT_MS));
    else if (arg === "--continue-on-error") options.continueOnError = true;
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

function parseBenchmarkJson(stdout) {
  const text = String(stdout || "").trim();
  if (!text) throw new Error("benchmark-menu-flow produced empty output");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("benchmark-menu-flow output did not contain JSON");
  return JSON.parse(text.slice(start, end + 1));
}

function benchmarkChildTimeoutMs(options) {
  return (options.timeoutMs + options.imageTimeoutMs + 30_000) * options.repeat;
}

async function runBenchmarkFlow(options, image) {
  const args = [
    FLOW_SCRIPT,
    "--base-url",
    options.baseUrl,
    "--target-lang",
    options.targetLang,
    "--repeat",
    String(options.repeat),
    "--poll-ms",
    String(options.pollMs),
    "--timeout-ms",
    String(options.timeoutMs),
    "--image-timeout-ms",
    String(options.imageTimeoutMs),
  ];
  if (options.cacheProbe) args.push("--cache-probe");
  if (options.cacheBust) args.push("--cache-bust");
  args.push(image);

  const { stdout, stderr } = await new Promise((resolveRun, rejectRun) => {
    execFile(process.execPath, args, {
      cwd: resolve(import.meta.dirname, ".."),
      maxBuffer: 30 * 1024 * 1024,
      timeout: benchmarkChildTimeoutMs(options),
    }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        rejectRun(error);
        return;
      }
      resolveRun({ stdout, stderr });
    });
  });
  const report = parseBenchmarkJson(stdout);
  return {
    image: resolve(image),
    image_name: basename(image),
    ok: Boolean(report.ok),
    stderr: stderr ? String(stderr).trim() : "",
    report,
  };
}

function numbers(values) {
  return values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
}

function percentile(values, rank) {
  const sorted = numbers(values);
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((rank / 100) * sorted.length) - 1));
  return sorted[index];
}

function median(values) {
  return percentile(values, 50);
}

function firstPassModelMsForRun(run) {
  if (run?.cached_immediate) return null;
  const byPage = run?.summary?.first_pass_model_ms_by_page;
  if (Array.isArray(byPage)) {
    const values = numbers(byPage);
    if (values.length > 0) return Math.max(...values);
  }
  const timings = run?.summary?.timings || {};
  return Number.isFinite(timings.firstPassModelMs) ? timings.firstPassModelMs : null;
}

function firstPassOriginalBytesForRun(run) {
  if (run?.cached_immediate) return null;
  const timings = run?.summary?.timings || {};
  return Number.isFinite(timings.firstPassOriginalBytes) ? timings.firstPassOriginalBytes : null;
}

function firstPassModelBytesForRun(run) {
  if (run?.cached_immediate) return null;
  const timings = run?.summary?.timings || {};
  return Number.isFinite(timings.firstPassModelBytes) ? timings.firstPassModelBytes : null;
}

function firstPassCompressionRatioForRun(run) {
  if (run?.cached_immediate) return null;
  const timings = run?.summary?.timings || {};
  return Number.isFinite(timings.firstPassCompressionRatio) ? timings.firstPassCompressionRatio : null;
}

function firstPassTargetBytesForRun(run) {
  if (run?.cached_immediate) return null;
  const timings = run?.summary?.timings || {};
  return Number.isFinite(timings.firstPassTargetBytes) ? timings.firstPassTargetBytes : null;
}

function rawReadMsForRun(run) {
  if (Number.isFinite(run?.summary?.raw_read_ms)) return run.summary.raw_read_ms;
  const timings = run?.summary?.timings || {};
  return Number.isFinite(timings.rawReadMs) ? timings.rawReadMs : null;
}

function firstPassModelNamesForRun(run) {
  if (run?.cached_immediate) return [];
  const names = new Set();
  if (run?.summary?.first_pass_model_name) names.add(run.summary.first_pass_model_name);
  if (Array.isArray(run?.summary?.first_pass_model_names)) {
    for (const name of run.summary.first_pass_model_names) {
      if (name) names.add(name);
    }
  }
  return Array.from(names);
}

function flattenRuns(results) {
  return results.flatMap((result) =>
    (result.report?.runs || []).map((run) => ({
      ...run,
      image: result.image,
      image_name: result.image_name,
    })),
  );
}

function bucketFailure(run) {
  if (run.ok) return null;
  if (run.timed_out) return "timeout";
  if (run.http_status) return `http_${run.http_status}`;
  if (run.error) return String(run.error).slice(0, 80);
  return "unknown";
}

export function summarizeSuite(results) {
  const runs = flattenRuns(results);
  const successfulRuns = runs.filter((run) => run.ok);
  const firstResultMs = successfulRuns.map((run) => run.first_result_ms);
  const textDoneMs = successfulRuns.map((run) => run.text_done_ms);
  const firstPassModelMs = successfulRuns.map(firstPassModelMsForRun);
  const firstPassOriginalBytes = successfulRuns.map(firstPassOriginalBytesForRun);
  const firstPassModelBytes = successfulRuns.map(firstPassModelBytesForRun);
  const firstPassCompressionRatios = successfulRuns.map(firstPassCompressionRatioForRun);
  const firstPassTargetBytes = numbers(successfulRuns.map(firstPassTargetBytesForRun));
  const rawReadMs = successfulRuns.map(rawReadMsForRun);
  const cacheHitWithoutRawReadCount = successfulRuns.filter((run) => run.summary?.cache_hit_without_raw_read).length;
  const imageMissingTotal = successfulRuns.reduce((sum, run) => sum + (run.summary?.image_missing || 0), 0);
  const cacheProbeRuns = runs.filter((run) => Number.isFinite(run.cache_probe_ms));
  const cacheProbeHits = cacheProbeRuns.filter((run) => run.cache_probe_hit).length;
  const failureBuckets = {};
  for (const run of runs) {
    const bucket = bucketFailure(run);
    if (bucket) failureBuckets[bucket] = (failureBuckets[bucket] || 0) + 1;
  }
  const firstPassModelNames = Array.from(new Set(successfulRuns.flatMap(firstPassModelNamesForRun))).filter(Boolean);
  const slowestCases = successfulRuns
    .slice()
    .sort((a, b) => (b.first_result_ms || 0) - (a.first_result_ms || 0))
    .slice(0, 5)
    .map((run) => ({
      image: run.image,
      run: run.run,
      first_result_ms: run.first_result_ms,
      text_done_ms: run.text_done_ms,
      first_pass_model_ms: firstPassModelMsForRun(run),
      first_pass_model_bytes: firstPassModelBytesForRun(run),
      first_pass_compression_ratio: firstPassCompressionRatioForRun(run),
      dish_count: run.summary?.dish_count || 0,
      image_missing: run.summary?.image_missing || 0,
    }));

  const summary = {
    total_images: results.length,
    total_runs: runs.length,
    successful_runs: successfulRuns.length,
    success_rate: runs.length ? successfulRuns.length / runs.length : 0,
    cache_probe_hit_rate: cacheProbeRuns.length ? cacheProbeHits / cacheProbeRuns.length : null,
    p50_first_result_ms: median(firstResultMs),
    p90_first_result_ms: percentile(firstResultMs, 90),
    p50_text_done_ms: median(textDoneMs),
    p90_text_done_ms: percentile(textDoneMs, 90),
    p50_first_pass_model_ms: median(firstPassModelMs),
    p90_first_pass_model_ms: percentile(firstPassModelMs, 90),
    p50_first_pass_model_bytes: median(firstPassModelBytes),
    p90_first_pass_model_bytes: percentile(firstPassModelBytes, 90),
    p50_first_pass_compression_ratio: median(firstPassCompressionRatios),
    p90_first_pass_compression_ratio: percentile(firstPassCompressionRatios, 90),
    first_pass_target_bytes: firstPassTargetBytes[0] || null,
    first_pass_original_bytes_total: numbers(firstPassOriginalBytes).reduce((sum, value) => sum + value, 0),
    first_pass_model_bytes_total: numbers(firstPassModelBytes).reduce((sum, value) => sum + value, 0),
    cache_hit_without_raw_read_count: cacheHitWithoutRawReadCount,
    cache_hit_without_raw_read_rate: successfulRuns.length ? cacheHitWithoutRawReadCount / successfulRuns.length : null,
    p50_raw_read_ms: median(rawReadMs),
    p90_raw_read_ms: percentile(rawReadMs, 90),
    image_missing_total: imageMissingTotal,
    first_pass_model_names: firstPassModelNames,
    failure_buckets: failureBuckets,
    slowest_cases: slowestCases,
  };
  summary.recommendations = buildRecommendations(summary);
  return summary;
}

export function benchmarkFailureForError(error, image) {
  const message = error instanceof Error ? error.message : String(error);
  const stdout = typeof error?.stdout === "string" ? error.stdout.trim() : "";
  const stderr = typeof error?.stderr === "string" ? error.stderr.trim() : "";
  return {
    image: resolve(image),
    image_name: basename(image),
    ok: false,
    error: message,
    stdout,
    stderr,
    report: {
      ok: false,
      runs: [{ ok: false, error: message, stdout, stderr }],
    },
  };
}

function buildRecommendations(summary) {
  const recommendations = [];
  if ((summary.p50_first_result_ms || 0) > 12000) {
    recommendations.push("p50 first_result_ms is above 12000ms; benchmark faster fast-first-pass provider or shorter prompt.");
  }
  if ((summary.p50_first_pass_model_ms || 0) > 12000) {
    recommendations.push("p50 first_pass_model_ms is above 12000ms; bottleneck is visual model latency rather than local parsing.");
  }
  if (
    Number.isFinite(summary.p50_first_pass_model_bytes) &&
    Number.isFinite(summary.first_pass_target_bytes) &&
    summary.p50_first_pass_model_bytes > summary.first_pass_target_bytes
  ) {
    recommendations.push("p50 first_pass_model_bytes is above the target; inspect tiny-text accuracy before lowering the byte target further.");
  }
  if ((summary.image_missing_total || 0) > 0) {
    recommendations.push("image_missing_total is above 0; continue local image coverage and generated-cache promotion.");
  }
  if (summary.cache_probe_hit_rate !== null && summary.cache_probe_hit_rate < 0.8) {
    recommendations.push("cache_probe_hit_rate is below 80%; inspect client_hash_sets and server-normalized cache aliases.");
  }
  return recommendations;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const results = [];
  const report = {
    ok: true,
    base_url: options.baseUrl,
    target_lang: options.targetLang,
    flow_script: FLOW_SCRIPT_LABEL,
    repeat: options.repeat,
    cache_probe: options.cacheProbe,
    cache_bust: options.cacheBust,
    image_timeout_ms: options.imageTimeoutMs,
    images: options.images.map((image) => resolve(image)),
    results,
    summary: null,
  };

  for (const image of options.images) {
    try {
      const result = await runBenchmarkFlow(options, image);
      results.push(result);
      if (!result.ok) report.ok = false;
    } catch (error) {
      const failure = benchmarkFailureForError(error, image);
      results.push(failure);
      report.ok = false;
      if (!options.continueOnError) break;
    }
  }

  report.summary = summarizeSuite(results);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => {
    console.log(JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, null, 2));
    process.exitCode = 1;
  });
}
