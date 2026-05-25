#!/usr/bin/env node

import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const DB_PATH = join(ROOT, "public", "dish-knowledge-db.json");
const DISH_DIR = join(ROOT, "public", "dishes");

const args = new Set(process.argv.slice(2));
const force = args.has("--force");
const dryRun = args.has("--dry-run");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const concurrencyArg = process.argv.find((arg) => arg.startsWith("--concurrency="));
const sourceArg = process.argv.find((arg) => arg.startsWith("--source="));
const idsArg = process.argv.find((arg) => arg.startsWith("--ids="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : 0;
const concurrency = concurrencyArg ? Number(concurrencyArg.split("=")[1]) : 4;
const source = sourceArg ? sourceArg.split("=")[1] : "wikimedia";
const onlyIds = idsArg ? new Set(idsArg.split("=")[1].split(",").map((id) => id.trim()).filter(Boolean)) : null;

function isRemote(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

function extFromType(contentType) {
  if (contentType?.includes("png")) return "png";
  if (contentType?.includes("webp")) return "webp";
  return "jpg";
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options, attempts = 3) {
  let lastError = null;
  for (let i = 0; i < attempts; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      if (res.status !== 429 && res.status !== 503) return res;
      lastError = new Error(`HTTP ${res.status}`);
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) ? retryAfter * 1000 : 1500 * (i + 1));
    } catch (err) {
      lastError = err;
      if (i === attempts - 1) throw err;
      await sleep(1000 * (i + 1));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError || new Error("fetch failed");
}

async function findExistingLocal(id) {
  for (const ext of ["png", "jpg", "jpeg", "webp"]) {
    const path = join(DISH_DIR, `${id}.${ext}`);
    if (await exists(path)) return `/dishes/${id}.${ext}`;
  }
  return null;
}

function stableUrl(url, id) {
  if (!url.includes("image.pollinations.ai")) return url;
  const parsed = new URL(url);
  if (!parsed.searchParams.has("seed")) {
    const seed = createHash("sha1").update(id).digest("hex").slice(0, 8);
    parsed.searchParams.set("seed", String(Number.parseInt(seed, 16)));
  }
  parsed.searchParams.set("nologo", "true");
  parsed.searchParams.set("safe", "true");
  return parsed.toString();
}

async function downloadDish(entry) {
  const existing = await findExistingLocal(entry.id);
  if (existing && !force) {
    entry.card = existing;
    entry.hero = existing;
    return { status: "existing", id: entry.id };
  }

  const remoteSource = source === "pollinations"
    ? stableUrl(entry.hero || entry.card, entry.id)
    : await findWikimediaImage(entry);

  if (!isRemote(remoteSource)) {
    return { status: "local", id: entry.id };
  }

  if (dryRun) {
    return { status: "would-download", id: entry.id };
  }

  const res = await fetchWithRetry(remoteSource, {
    headers: {
      Accept: "image/avif,image/webp,image/png,image/jpeg,*/*",
      "User-Agent": "DishLens/1.0 (local prototype image cache)",
    },
  });
  if (!res.ok) {
    throw new Error(`${entry.id} download failed ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) {
    throw new Error(`${entry.id} returned ${contentType || "non-image"}`);
  }

  const bytes = Buffer.from(await res.arrayBuffer());
  const ext = extFromType(contentType);
  const publicPath = `/dishes/${entry.id}.${ext}`;
  await writeFile(join(DISH_DIR, `${entry.id}.${ext}`), bytes);

  entry.card = publicPath;
  entry.hero = publicPath;
  return { status: "downloaded", id: entry.id, bytes: bytes.length };
}

function latinNames(entry) {
  return entry.names
    .filter((name) => !/[一-鿿]/.test(name))
    .map((name) => name.replace(/\([^)]*\)/g, "").trim())
    .filter(Boolean);
}

async function findWikimediaImage(entry) {
  const names = latinNames(entry);
  const queries = [
    names[1],
    names[0],
    `${names[0] || entry.id} food`,
    entry.id.replaceAll("-", " "),
  ].filter(Boolean);

  for (const query of queries) {
    const url = new URL("https://commons.wikimedia.org/w/api.php");
    url.searchParams.set("action", "query");
    url.searchParams.set("generator", "search");
    url.searchParams.set("gsrnamespace", "6");
    url.searchParams.set("gsrlimit", "8");
    url.searchParams.set("gsrsearch", query);
    url.searchParams.set("prop", "imageinfo");
    url.searchParams.set("iiprop", "url|mime|size");
    url.searchParams.set("iiurlwidth", "1024");
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");

    try {
      const res = await fetchWithRetry(url, {
        headers: { "User-Agent": "DishLens/1.0 (local prototype image cache)" },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const pages = Object.values(data?.query?.pages || {});
      const candidates = pages
        .map((page) => page?.imageinfo?.[0])
        .filter((info) =>
          (info?.url || info?.thumburl) &&
          /^image\/(jpeg|png|webp)$/i.test(info.mime || "") &&
          !/logo|map|diagram|icon|svg/i.test(info.url || info.thumburl)
        )
        .sort((a, b) => (b.width || 0) * (b.height || 0) - (a.width || 0) * (a.height || 0));
      if (candidates[0]?.url || candidates[0]?.thumburl) {
        return candidates[0].url || candidates[0].thumburl;
      }
    } catch {}
  }

  return source === "wikimedia" ? null : stableUrl(entry.hero || entry.card, entry.id);
}

async function mapLimit(items, worker, max) {
  let cursor = 0;
  let done = 0;
  const totals = new Map();

  async function run() {
    while (cursor < items.length) {
      const item = items[cursor++];
      try {
        const result = await worker(item);
        totals.set(result.status, (totals.get(result.status) || 0) + 1);
        done++;
        if (done % 25 === 0 || done === items.length) {
          console.log(`[${done}/${items.length}]`, Object.fromEntries(totals));
        }
      } catch (err) {
        totals.set("failed", (totals.get("failed") || 0) + 1);
        console.error(`✗ ${item.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, max) }, run));
  return totals;
}

await mkdir(DISH_DIR, { recursive: true });

const db = JSON.parse(await readFile(DB_PATH, "utf8"));
let targets = db.filter((entry) => isRemote(entry.card) || isRemote(entry.hero));
if (onlyIds) targets = targets.filter((entry) => onlyIds.has(entry.id));
if (limit > 0) targets = targets.slice(0, limit);

console.log(`Dish images: ${db.length} entries, ${targets.length} remote entries to materialize via ${source}.`);
const totals = await mapLimit(targets, downloadDish, concurrency);

if (!dryRun) {
  await writeFile(DB_PATH, `${JSON.stringify(db, null, 2)}\n`);
}

console.log("Done:", Object.fromEntries(totals));
