import { getSupabaseAdminClient, getSupabaseClient } from "@/lib/db/supabase";
import {
  getCachedGeneratedDishImageFromOss,
  uploadGeneratedDishImageToOss,
} from "@/lib/storage/oss-storage";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const BUCKET = "dishes";
const LOCAL_GENERATED_DIR = join(process.cwd(), "public", "generated-dishes");
const ENABLE_REMOTE_CACHE_HEAD = process.env.ENABLE_REMOTE_IMAGE_CACHE_HEAD === "true";
const GENERATED_DISH_MAX_DIM = Number.parseInt(process.env.GENERATED_DISH_MAX_DIM || "768", 10) || 768;
const GENERATED_DISH_WEBP_QUALITY = Number.parseInt(process.env.GENERATED_DISH_WEBP_QUALITY || "82", 10) || 82;
const GENERATED_IMAGE_FETCH_TIMEOUT_MS = Math.max(
  2_000,
  Math.min(30_000, Number.parseInt(process.env.GENERATED_IMAGE_FETCH_TIMEOUT_MS || "12000", 10) || 12000),
);
const GENERATED_IMAGE_FETCH_MAX_BYTES = Math.max(
  1 * 1024 * 1024,
  Math.min(30 * 1024 * 1024, Number.parseInt(process.env.GENERATED_IMAGE_FETCH_MAX_BYTES || `${12 * 1024 * 1024}`, 10) || 12 * 1024 * 1024),
);
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

export function getLocalGeneratedDishImageUrl(dishId: string): string | null {
  if (existsSync(localDishImagePath(dishId, "webp"))) return localDishImageUrl(dishId, "webp");
  if (existsSync(localDishImagePath(dishId, "png"))) return localDishImageUrl(dishId, "png");
  return null;
}

function isStorageUploadDisabled(): boolean {
  return Date.now() < storageUploadDisabledUntil;
}

export function getStorageUploadCooldownRemainingMs(): number {
  return Math.max(0, storageUploadDisabledUntil - Date.now());
}

function markStorageUploadUnavailable(error: unknown): void {
  storageUploadDisabledUntil = Date.now() + STORAGE_UPLOAD_COOLDOWN_MS;
  console.warn("uploadDishImage storage unavailable", {
    cooldownMs: STORAGE_UPLOAD_COOLDOWN_MS,
    error: error instanceof Error ? error.message : String(error),
  });
}

function assertTrustedGeneratedImageUrl(imageUrl: string): URL {
  const parsed = new URL(imageUrl);
  const trustedPollinations = parsed.hostname === "image.pollinations.ai";
  // Model Studio result buckets are provider-controlled but their exact OSS
  // hostnames can change. Restrict downloads to Alibaba Cloud HTTPS domains.
  const trustedDashScope = parsed.hostname.endsWith(".aliyuncs.com");
  if (parsed.protocol !== "https:" || (!trustedPollinations && !trustedDashScope)) {
    throw new Error(`untrusted generated image URL host: ${parsed.hostname}`);
  }
  return parsed;
}

async function fetchImageBuffer(imageUrl: string): Promise<Buffer> {
  const trustedUrl = assertTrustedGeneratedImageUrl(imageUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GENERATED_IMAGE_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(trustedUrl, { signal: controller.signal });
    if (res.url) assertTrustedGeneratedImageUrl(res.url);
    if (!res.ok) throw new Error(`fetch image failed: ${res.status}`);
    const declaredSize = Number.parseInt(res.headers.get("content-length") || "0", 10);
    if (declaredSize > GENERATED_IMAGE_FETCH_MAX_BYTES) {
      throw new Error(`generated image exceeds ${GENERATED_IMAGE_FETCH_MAX_BYTES} byte limit`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > GENERATED_IMAGE_FETCH_MAX_BYTES) {
      throw new Error(`generated image exceeds ${GENERATED_IMAGE_FETCH_MAX_BYTES} byte limit`);
    }
    return buffer;
  } finally {
    clearTimeout(timeout);
  }
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

async function uploadOptimizedBufferToRemote(dishId: string, buffer: Buffer, localUrl: string | null): Promise<string | null> {
  const ossUrl = await uploadGeneratedDishImageToOss(dishId, buffer);
  if (ossUrl) return ossUrl;
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

  return uploadOptimizedBufferToRemote(dishId, buffer, localUrl);
}

export async function getCachedDishImageUrl(dishId: string): Promise<string | null> {
  if (existsSync(localDishImagePath(dishId, "webp"))) {
    const localUrl = localDishImageUrl(dishId, "webp");
    try {
      const buffer = await readFile(localDishImagePath(dishId, "webp"));
      return await uploadOptimizedBufferToRemote(dishId, buffer, localUrl);
    } catch {
      return localUrl;
    }
  }
  if (existsSync(localDishImagePath(dishId, "png"))) {
    const localUrl = localDishImageUrl(dishId, "png");
    try {
      const source = await readFile(localDishImagePath(dishId, "png"));
      const buffer = await optimizeGeneratedDishImage(source);
      return await uploadOptimizedBufferToRemote(dishId, buffer, localUrl);
    } catch {
      return localUrl;
    }
  }

  // OSS object names are deterministic, so this recovers generated images even when
  // the metadata database is unavailable or the request lands on another app host.
  const ossUrl = await getCachedGeneratedDishImageFromOss(dishId);
  if (ossUrl) return ossUrl;

  // Supabase HEAD checks remain opt-in because the legacy database row normally
  // carries its public URL and one extra request per dish slows dense menus.
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
