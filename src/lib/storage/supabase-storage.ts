import { getSupabaseAdminClient, getSupabaseClient } from "@/lib/db/supabase";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const BUCKET = "dishes";
const LOCAL_GENERATED_DIR = join(process.cwd(), "public", "generated-dishes");
const ENABLE_REMOTE_CACHE_HEAD = process.env.ENABLE_REMOTE_IMAGE_CACHE_HEAD === "true";
const GENERATED_DISH_MAX_DIM = Number.parseInt(process.env.GENERATED_DISH_MAX_DIM || "768", 10) || 768;
const GENERATED_DISH_WEBP_QUALITY = Number.parseInt(process.env.GENERATED_DISH_WEBP_QUALITY || "82", 10) || 82;
const STORAGE_UPLOAD_COOLDOWN_MS = Math.max(
  10_000,
  Math.min(10 * 60_000, Number.parseInt(process.env.STORAGE_UPLOAD_COOLDOWN_MS || "120000", 10) || 120000),
);
let storageUploadDisabledUntil = 0;

type GeneratedDishFormat = "webp" | "png";

function localDishImagePath(dishId: string, format: GeneratedDishFormat = "webp"): string {
  return join(LOCAL_GENERATED_DIR, `${dishId}.${format}`);
}

function localDishImageUrl(dishId: string, format: GeneratedDishFormat = "webp"): string {
  return `/generated-dishes/${dishId}.${format}`;
}

function isStorageUploadDisabled(): boolean {
  return Date.now() < storageUploadDisabledUntil;
}

function markStorageUploadUnavailable(error: unknown): void {
  storageUploadDisabledUntil = Date.now() + STORAGE_UPLOAD_COOLDOWN_MS;
  console.warn("uploadDishImage storage unavailable", {
    cooldownMs: STORAGE_UPLOAD_COOLDOWN_MS,
    error: error instanceof Error ? error.message : String(error),
  });
}

async function fetchImageBuffer(imageUrl: string): Promise<Buffer> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`fetch image failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function optimizeGeneratedDishImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer, { failOn: "none" })
    .rotate()
    .resize({
      width: GENERATED_DISH_MAX_DIM,
      height: GENERATED_DISH_MAX_DIM,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({
      quality: GENERATED_DISH_WEBP_QUALITY,
      effort: 5,
    })
    .toBuffer();
}

async function saveLocalDishImage(dishId: string, buffer: Buffer, format: GeneratedDishFormat = "webp"): Promise<string | null> {
  try {
    await mkdir(LOCAL_GENERATED_DIR, { recursive: true });
    await writeFile(localDishImagePath(dishId, format), buffer);
    return localDishImageUrl(dishId, format);
  } catch (err) {
    console.error("saveLocalDishImage error:", err);
    return null;
  }
}

export async function uploadDishImage(
  dishId: string,
  imageUrl: string,
): Promise<string | null> {
  let localUrl: string | null = null;
  let buffer: Buffer;

  try {
    const sourceBuffer = await fetchImageBuffer(imageUrl);
    buffer = await optimizeGeneratedDishImage(sourceBuffer);
    localUrl = await saveLocalDishImage(dishId, buffer, "webp");
  } catch (err) {
    console.error("uploadDishImage error:", err);
    return localUrl;
  }

  if (isStorageUploadDisabled()) return localUrl;

  const client = getSupabaseAdminClient();
  if (!client) return localUrl;

  const path = `${dishId}.webp`;

  try {
    const { error } = await client.storage.from(BUCKET).upload(path, buffer, {
      contentType: "image/webp",
      upsert: true,
    });

    if (error) {
      markStorageUploadUnavailable(error);
      return localUrl;
    }

    const { data } = client.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl || localUrl;
  } catch (err) {
    markStorageUploadUnavailable(err);
    return localUrl;
  }
}

export async function getCachedDishImageUrl(dishId: string): Promise<string | null> {
  if (existsSync(localDishImagePath(dishId, "webp"))) {
    return localDishImageUrl(dishId, "webp");
  }
  if (existsSync(localDishImagePath(dishId, "png"))) {
    return localDishImageUrl(dishId, "png");
  }

  // Keep the translation result fast: the DB row already carries stable remote URLs.
  // Remote Storage HEAD checks are opt-in because one network request per missing dish
  // noticeably delays dense menus.
  if (!ENABLE_REMOTE_CACHE_HEAD) return null;

  const client = getSupabaseAdminClient() || getSupabaseClient();
  if (!client) return null;

  for (const format of ["webp", "png"] as const) {
    const path = `${dishId}.${format}`;
    const { data } = client.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = data.publicUrl;
    if (!publicUrl) continue;

    try {
      const res = await fetch(publicUrl, { method: "HEAD" });
      if (res.ok) return publicUrl;
    } catch {
      continue;
    }
  }

  return null;
}
