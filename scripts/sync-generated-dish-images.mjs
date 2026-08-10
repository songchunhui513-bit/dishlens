#!/usr/bin/env node

/**
 * Sync runtime-generated dish images to Supabase Storage and optionally record
 * stable image URLs in public.dishes.
 *
 * Default mode is a dry run. Use --apply to upload files and --write-db to
 * update/insert dish rows for files that are mapped by task cache evidence.
 * Add --allow-inferred-db only when reviewed filename-derived names are safe.
 */

import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import sharp from "sharp";

const ROOT = join(import.meta.dirname, "..");
const GENERATED_DIR = join(ROOT, "public", "generated-dishes");
const TASK_CACHE_DIR = join(ROOT, ".cache", "tasks");
const BUCKET = process.env.DISH_IMAGE_BUCKET || "dishes";
const MAX_DIM = Number.parseInt(process.env.GENERATED_DISH_MAX_DIM || "768", 10) || 768;
const WEBP_QUALITY = Number.parseInt(process.env.GENERATED_DISH_WEBP_QUALITY || "82", 10) || 82;

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const WRITE_DB = args.includes("--write-db");
const ALLOW_INFERRED_DB = args.includes("--allow-inferred-db");
const VERBOSE = args.includes("--verbose");
const limitArg = args.find((arg) => arg.startsWith("--limit="));
const idsArg = args.find((arg) => arg.startsWith("--ids="));
const LIMIT = Number.parseInt(limitArg?.split("=")[1] || "0", 10) || 0;
const TARGET_IDS = new Set(
  (idsArg?.split("=")[1] || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
);

async function readLocalEnvFile() {
  try {
    const raw = await readFile(join(ROOT, ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const index = trimmed.indexOf("=");
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // .env.local is optional for dry-run usage.
  }
}

function redact(value) {
  if (!value) return "";
  if (value.length <= 10) return "***";
  return `${value.slice(0, 5)}...${value.slice(-4)}`;
}

function fileStorageId(file) {
  return basename(file, extname(file));
}

function isGeneratedImageFile(file) {
  return /\.(png|webp|jpe?g)$/i.test(file);
}

function normalizePublicGeneratedUrl(value) {
  if (typeof value !== "string") return "";
  try {
    const parsed = value.startsWith("http") ? new URL(value) : null;
    return parsed?.pathname || value;
  } catch {
    return value;
  }
}

function localizedName(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.en || value.zh || Object.values(value)[0] || "";
}

function collectDishes(result) {
  if (!result || !Array.isArray(result.pages)) return [];
  return result.pages.flatMap((page) => Array.isArray(page?.dishes) ? page.dishes : []);
}

function collectTaskCacheDishMap() {
  const map = new Map();
  if (!existsSync(TASK_CACHE_DIR)) return map;

  for (const file of readdirSync(TASK_CACHE_DIR)) {
    if (!file.endsWith(".json")) continue;
    try {
      const parsed = JSON.parse(readFileSync(join(TASK_CACHE_DIR, file), "utf8"));
      const result = parsed?.task?.result || parsed?.result;
      for (const dish of collectDishes(result)) {
        const url = normalizePublicGeneratedUrl(dish?.ai_image_url || dish?.image_url);
        const match = url.match(/\/generated-dishes\/([^/?#]+\.(?:webp|png|jpe?g))/i);
        if (!match) continue;
        const id = fileStorageId(match[1]);
        if (!id || map.has(id)) continue;
        map.set(id, {
          name_original: dish.name_original || "",
          name_translated: localizedName(dish.name_translated),
          category: dish.category || null,
        });
      }
    } catch {
      continue;
    }
  }

  return map;
}

function inferDishNameFromStorageId(storageId) {
  if (!storageId.startsWith("generated-")) return "";
  const raw = storageId.slice("generated-".length);
  if (!raw || /^dish-[a-z0-9]+$/i.test(raw)) return "";
  return raw.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function optimizeImage(filePath) {
  const buffer = await readFile(filePath);
  return sharp(buffer, { failOn: "none" })
    .rotate()
    .resize({
      width: MAX_DIM,
      height: MAX_DIM,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY, effort: 5 })
    .toBuffer();
}

function publicUrlFor(client, storageId) {
  const { data } = client.storage.from(BUCKET).getPublicUrl(`${storageId}.webp`);
  return data?.publicUrl || "";
}

async function upsertDishImageRow(client, dishInfo, publicUrl) {
  if (!dishInfo.name_original) return { status: "skipped_no_name" };

  const row = {
    name_original: dishInfo.name_original,
    name_translated: dishInfo.name_translated || dishInfo.name_original,
    category: dishInfo.category || null,
    ai_image_url: publicUrl,
    image_source: "ai",
  };

  const { data: updated, error: updateError } = await client
    .from("dishes")
    .update({ ai_image_url: publicUrl, image_source: "ai" })
    .eq("name_original", dishInfo.name_original)
    .select("id")
    .limit(1);

  if (updateError) throw updateError;
  if (Array.isArray(updated) && updated.length > 0) return { status: "updated", id: updated[0].id };

  const { data: inserted, error: insertError } = await client
    .from("dishes")
    .insert(row)
    .select("id")
    .single();
  if (insertError) throw insertError;
  return { status: "inserted", id: inserted?.id || null };
}

async function syncOne(client, file, cacheDishMap) {
  const storageId = fileStorageId(file);
  const cachedDish = cacheDishMap.get(storageId);
  const inferredName = inferDishNameFromStorageId(storageId);
  const dishInfo = cachedDish || {
    name_original: inferredName,
    name_translated: inferredName,
    category: null,
  };
  const source = cachedDish ? "task_cache" : (inferredName ? "storage_id" : "unmapped");
  const canWriteDb = Boolean(dishInfo.name_original) && (source === "task_cache" || ALLOW_INFERRED_DB);
  const objectPath = `${storageId}.webp`;
  const localPath = join(GENERATED_DIR, file);
  const publicUrl = client ? publicUrlFor(client, storageId) : "";

  if (!APPLY) {
    return {
      status: "dry_run",
      storage_id: storageId,
      object_path: objectPath,
      can_write_db: canWriteDb,
      name_original: dishInfo.name_original || null,
      source,
    };
  }

  const bytes = await optimizeImage(localPath);
  const digest = createHash("sha1").update(bytes).digest("hex").slice(0, 12);
  const { error } = await client.storage.from(BUCKET).upload(objectPath, bytes, {
    contentType: "image/webp",
    upsert: true,
  });
  if (error) throw error;

  const result = {
    status: "uploaded",
    storage_id: storageId,
    object_path: objectPath,
    public_url: publicUrl,
    bytes: bytes.length,
    sha1: digest,
    can_write_db: canWriteDb,
    name_original: dishInfo.name_original || null,
    source,
  };

  if (WRITE_DB && canWriteDb) {
    result.db = await upsertDishImageRow(client, dishInfo, publicUrl);
  } else if (WRITE_DB) {
    result.db = { status: "skipped_no_name" };
  }

  return result;
}

async function main() {
  await mkdir(GENERATED_DIR, { recursive: true });
  await readLocalEnvFile();

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
  const requiresSupabase = APPLY || WRITE_DB;

  if (requiresSupabase && (!SUPABASE_URL || !SERVICE_KEY)) {
    console.log(JSON.stringify({
      ok: false,
      error: "Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY",
      supabase_url_present: Boolean(SUPABASE_URL),
      service_key_present: Boolean(SERVICE_KEY),
    }, null, 2));
    process.exitCode = 1;
    return;
  }

  const client = SUPABASE_URL && SERVICE_KEY
    ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

  const cacheDishMap = collectTaskCacheDishMap();
  let files = readdirSync(GENERATED_DIR).filter(isGeneratedImageFile).sort();
  if (TARGET_IDS.size > 0) files = files.filter((file) => TARGET_IDS.has(fileStorageId(file)));
  if (LIMIT > 0) files = files.slice(0, LIMIT);

  const report = {
    ok: true,
    dry_run: !APPLY,
    write_db: WRITE_DB,
    allow_inferred_db: ALLOW_INFERRED_DB,
    bucket: BUCKET,
    supabase_url: redact(SUPABASE_URL),
    total_candidates: files.length,
    task_cache_mapped_images: cacheDishMap.size,
    summary: {
      dry_run: 0,
      uploaded: 0,
      failed: 0,
      db_updated: 0,
      db_inserted: 0,
      db_skipped_no_name: 0,
      unmapped: 0,
    },
    results: [],
  };

  for (const file of files) {
    try {
      const result = await syncOne(client, file, cacheDishMap);
      report.summary[result.status] = (report.summary[result.status] || 0) + 1;
      if (result.source === "unmapped") report.summary.unmapped++;
      if (result.db?.status === "updated") report.summary.db_updated++;
      if (result.db?.status === "inserted") report.summary.db_inserted++;
      if (result.db?.status === "skipped_no_name") report.summary.db_skipped_no_name++;
      if (VERBOSE || result.source === "unmapped" || result.db?.status === "skipped_no_name") {
        report.results.push(result);
      }
    } catch (error) {
      report.ok = false;
      report.summary.failed++;
      report.results.push({
        status: "failed",
        file,
        error: error instanceof Error ? error.message : String(error),
      });
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
