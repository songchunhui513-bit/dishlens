// Client-side API calls for DishLens

import type { TranslationResult, TaskProgress, Review, UserProfile, TranslationRecord, Dish } from "@/types";
import { MAX_MENU_IMAGES, shouldNormalizeClientImage } from "@/lib/image-input";
import { normalizeTargetLang } from "@/lib/languages";

// ── Image compression (for Vercel 4.5MB body limit) ───────────────

export const TRANSLATION_UPLOAD_TIMEOUT_MS = 45_000;
export const TRANSLATION_CACHE_PROBE_MAX_IMAGES = MAX_MENU_IMAGES;
export const TRANSLATION_CACHE_PROBE_MAX_BYTES = 5 * 1024 * 1024;
export const TRANSLATION_RAW_CACHE_PROBE_MAX_BYTES = 24 * 1024 * 1024;
export const TRANSLATION_BROWSER_RESULT_CACHE_KEY = "dishlens_translation_hash_cache_v1";
export const TRANSLATION_BROWSER_RESULT_CACHE_LIMIT = 8;
export const TRANSLATION_BROWSER_PENDING_HASHES_KEY = "dishlens_translation_pending_hashes_v1";
const TRANSLATION_BROWSER_PENDING_HASHES_LIMIT = 8;
const TRANSLATION_BROWSER_RESULT_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const CLIENT_MENU_IMAGE_MAX_DIM = 1400;
const CLIENT_MENU_IMAGE_QUALITY = 0.82;

export type TranslationClientStage = "compressing" | "cache" | "uploading" | "task";

type TranslationClientOptions = {
  onStage?: (stage: TranslationClientStage) => void;
};

type BrowserTranslationCacheEntry = {
  key: string;
  createdAt: number;
  result: TranslationResult;
};

type PendingBrowserHashEntry = {
  task_id: string;
  targetLang: string;
  hashSets: string[][];
  createdAt: number;
};

function isBrowserCacheableTranslationResult(result: TranslationResult | null): result is TranslationResult {
  return Boolean(result && Array.isArray(result.pages) && result.pages.length > 0);
}

async function compressImage(file: File, maxDim = CLIENT_MENU_IMAGE_MAX_DIM, quality = CLIENT_MENU_IMAGE_QUALITY): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const exceedsMaxDim = width > maxDim || height > maxDim;
      // Keep genuinely small JPEG/PNG files untouched for OCR. Large dimensions,
      // WebP, or heavy files are normalized before upload so the server and vision
      // model receive a predictable image quickly.
      if (!shouldNormalizeClientImage(file) && !exceedsMaxDim) {
        resolve(file);
        return;
      }
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Compression failed"));
          const compressed = new File([blob], file.name, { type: "image/jpeg" });
          resolve(compressed);
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = url;
  });
}

function bytesToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function buildClientImageHash(file: File, targetLang: string): Promise<string> {
  const prefix = new TextEncoder().encode(`${targetLang}:`);
  const imageBytes = new Uint8Array(await file.arrayBuffer());
  const bytes = new Uint8Array(prefix.length + imageBytes.length);
  bytes.set(prefix, 0);
  bytes.set(imageBytes, prefix.length);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return bytesToHex(digest).slice(0, 32);
}

function normalizeClientHashSets(hashSets: string[][]): string[][] {
  const seen = new Set<string>();
  return hashSets
    .map((hashes) => hashes
      .map((hash) => hash.trim().toLowerCase())
      .filter((hash) => /^[a-f0-9]{32}$/.test(hash))
      .slice(0, TRANSLATION_CACHE_PROBE_MAX_IMAGES))
    .filter((hashes) => hashes.length > 0)
    .filter((hashes) => {
      const key = hashes.slice().sort().join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function getBrowserLocalStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function browserTranslationCacheKey(hashes: string[], targetLang: string): string {
  return `${targetLang}:${hashes.slice().sort().join("|")}`;
}

function parseBrowserTranslationCache(): BrowserTranslationCacheEntry[] {
  const localStorage = getBrowserLocalStorage();
  if (!localStorage) return [];
  try {
    const raw = localStorage.getItem(TRANSLATION_BROWSER_RESULT_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BrowserTranslationCacheEntry[];
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed.filter((entry) =>
      entry &&
      typeof entry.key === "string" &&
      typeof entry.createdAt === "number" &&
      now - entry.createdAt <= TRANSLATION_BROWSER_RESULT_CACHE_TTL_MS &&
      isBrowserCacheableTranslationResult(entry.result)
    );
  } catch {
    return [];
  }
}

function saveBrowserTranslationCache(entries: BrowserTranslationCacheEntry[]): void {
  const localStorage = getBrowserLocalStorage();
  if (!localStorage) return;
  try {
    localStorage.setItem(
      TRANSLATION_BROWSER_RESULT_CACHE_KEY,
      JSON.stringify(entries.slice(0, TRANSLATION_BROWSER_RESULT_CACHE_LIMIT)),
    );
  } catch {
    // Storage can be full or disabled; network/server cache still covers the flow.
  }
}

function parsePendingBrowserHashSets(): PendingBrowserHashEntry[] {
  const localStorage = getBrowserLocalStorage();
  if (!localStorage) return [];
  try {
    const raw = localStorage.getItem(TRANSLATION_BROWSER_PENDING_HASHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingBrowserHashEntry[];
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed
      .map((entry) => ({
        ...entry,
        hashSets: normalizeClientHashSets(Array.isArray(entry?.hashSets) ? entry.hashSets : []),
      }))
      .filter((entry) =>
        entry &&
        typeof entry.task_id === "string" &&
        entry.task_id.length > 0 &&
        typeof entry.targetLang === "string" &&
        entry.targetLang.length > 0 &&
        typeof entry.createdAt === "number" &&
        now - entry.createdAt <= TRANSLATION_BROWSER_RESULT_CACHE_TTL_MS &&
        entry.hashSets.length > 0
      );
  } catch {
    return [];
  }
}

function savePendingBrowserHashSets(entries: PendingBrowserHashEntry[]): void {
  const localStorage = getBrowserLocalStorage();
  if (!localStorage) return;
  try {
    localStorage.setItem(
      TRANSLATION_BROWSER_PENDING_HASHES_KEY,
      JSON.stringify(entries.slice(0, TRANSLATION_BROWSER_PENDING_HASHES_LIMIT)),
    );
  } catch {
    // Pending aliases are an optimization only; uploading and server polling still work.
  }
}

function rememberPendingBrowserHashSets(task_id: string | undefined, targetLang: string, hashSets: string[][]): void {
  if (!task_id) return;
  const normalizedHashSets = normalizeClientHashSets(hashSets);
  if (normalizedHashSets.length === 0) return;
  const entries = parsePendingBrowserHashSets().filter((entry) => entry.task_id !== task_id);
  entries.unshift({
    task_id,
    targetLang,
    hashSets: normalizedHashSets,
    createdAt: Date.now(),
  });
  savePendingBrowserHashSets(entries);
}

function consumePendingBrowserHashSets(task_id: string): Pick<PendingBrowserHashEntry, "targetLang" | "hashSets"> | null {
  if (!task_id) return null;
  const entries = parsePendingBrowserHashSets();
  const index = entries.findIndex((entry) => entry.task_id === task_id);
  if (index < 0) return null;
  const [entry] = entries.splice(index, 1);
  savePendingBrowserHashSets(entries);
  return { targetLang: entry.targetLang, hashSets: entry.hashSets };
}

function readBrowserCachedTranslation(hashSets: string[][], targetLang: string): TranslationResult | null {
  const entries = parseBrowserTranslationCache();
  if (entries.length === 0) return null;
  for (const hashes of hashSets) {
    const key = browserTranslationCacheKey(hashes, targetLang);
    const hit = entries.find((entry) => entry.key === key);
    if (hit) return hit.result;
  }
  return null;
}

function rememberBrowserCachedTranslation(hashSets: string[][], targetLang: string, result: TranslationResult | null): void {
  if (!isBrowserCacheableTranslationResult(result)) return;
  if (hashSets.length === 0) return;
  const entries = parseBrowserTranslationCache();
  const nextEntries = [...entries];
  const now = Date.now();
  for (const hashes of hashSets) {
    const key = browserTranslationCacheKey(hashes, targetLang);
    const existingIndex = nextEntries.findIndex((entry) => entry.key === key);
    if (existingIndex >= 0) nextEntries.splice(existingIndex, 1);
    nextEntries.unshift({ key, createdAt: now, result });
  }
  saveBrowserTranslationCache(nextEntries);
}

function shouldProbeTranslationCache(images: File[], maxBytes = TRANSLATION_CACHE_PROBE_MAX_BYTES): boolean {
  if (!globalThis.crypto?.subtle) return false;
  if (images.length > TRANSLATION_CACHE_PROBE_MAX_IMAGES) return false;
  const totalBytes = images.reduce((sum, img) => sum + img.size, 0);
  return totalBytes <= maxBytes;
}

// ── Translation ────────────────────────────────────────────────────

async function postTranslation(images: File[], targetLang = "zh", options: TranslationClientOptions = {}): Promise<TranslationResult> {
  const normalizedTargetLang = normalizeTargetLang(targetLang);
  const compressionStart = performance.now();
  const originalBytes = images.reduce((sum, img) => sum + img.size, 0);
  const canProbeRawImages = shouldProbeTranslationCache(images, TRANSLATION_RAW_CACHE_PROBE_MAX_BYTES);
  options.onStage?.("compressing");
  const compressionPromise = Promise.all(images.map((img) => compressImage(img)));
  const rawHashPromise = canProbeRawImages
    ? Promise.all(images.map((img) => buildClientImageHash(img, normalizedTargetLang)))
    : Promise.resolve([] as string[]);

  let rawHashes: string[] = [];
  let rawHashSets: string[][] = [];
  if (canProbeRawImages) {
    options.onStage?.("cache");
    rawHashes = await rawHashPromise;
    rawHashSets = normalizeClientHashSets([rawHashes]);
    if (rawHashSets.length > 0) {
      const rawBrowserCached = readBrowserCachedTranslation(rawHashSets, normalizedTargetLang);
      if (rawBrowserCached) {
        console.info("translate:browser_cache_hint", {
          hashSets: rawHashSets.length,
          hashMode: "raw_precompression",
          targetLang: normalizedTargetLang,
        });
      }
    }
  }

  const compressed = await compressionPromise;
  const compressedBytes = compressed.reduce((sum, img) => sum + img.size, 0);
  console.info("translate:client_upload_prepared", {
    imageCount: images.length,
    originalBytes,
    compressedBytes,
    compressionMs: Math.round(performance.now() - compressionStart),
    targetLang: normalizedTargetLang,
  });
  let clientHashes: string[] = [];
  let clientHashSets: string[][] = [];
  if (shouldProbeTranslationCache(compressed)) {
    options.onStage?.("cache");
    const compressedHashes = await Promise.all(compressed.map((img) => buildClientImageHash(img, normalizedTargetLang)));
    clientHashSets = normalizeClientHashSets([compressedHashes, rawHashes]);
    clientHashes = clientHashSets[0] || [];
    const compressedBrowserCached = readBrowserCachedTranslation(clientHashSets, normalizedTargetLang);
    if (compressedBrowserCached) {
      console.info("translate:browser_cache_hint", {
        hashSets: clientHashSets.length,
        targetLang: normalizedTargetLang,
      });
    }
  } else {
    console.info("translate:client_cache_probe_skipped", {
      reason: "large_upload",
      imageCount: compressed.length,
      compressedBytes,
      maxImages: TRANSLATION_CACHE_PROBE_MAX_IMAGES,
      maxBytes: TRANSLATION_CACHE_PROBE_MAX_BYTES,
      targetLang: normalizedTargetLang,
    });
    if (rawHashSets.length > 0) {
      clientHashSets = rawHashSets;
      clientHashes = clientHashSets[0] || [];
    }
  }
  const formData = new FormData();
  compressed.forEach((img) => formData.append("images", img));
  formData.append("target_lang", normalizedTargetLang);
  if (clientHashes.length > 0) {
    formData.append("client_hashes", JSON.stringify(clientHashes));
  }
  if (clientHashSets.length > 0) {
    formData.append("client_hash_sets", JSON.stringify(clientHashSets));
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), TRANSLATION_UPLOAD_TIMEOUT_MS);

  options.onStage?.("uploading");
  const res = await fetch("/api/v1/translate/menu", {
    method: "POST",
    body: formData,
    signal: controller.signal,
  }).catch((err: unknown) => {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Upload timed out. Overseas networks may be slow; please retry on Wi-Fi or a stronger connection.");
    }
    throw err;
  }).finally(() => {
    window.clearTimeout(timeout);
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  options.onStage?.("task");
  const result = await res.json() as TranslationResult;
  if (clientHashSets.length > 0) {
    rememberBrowserCachedTranslation(clientHashSets, normalizedTargetLang, result);
    rememberPendingBrowserHashSets(result.task_id, normalizedTargetLang, clientHashSets);
  } else {
    rememberBrowserCachedTranslation(normalizeClientHashSets([rawHashes]), normalizedTargetLang, result);
    rememberPendingBrowserHashSets(result.task_id, normalizedTargetLang, normalizeClientHashSets([rawHashes]));
  }
  return result;
}

export async function createTranslation(images: File[], targetLang = "zh", options: TranslationClientOptions = {}): Promise<TranslationResult> {
  return postTranslation(images, targetLang, options);
}

export async function translateMenu(images: File[], targetLang = "zh", options: TranslationClientOptions = {}): Promise<TranslationResult> {
  return postTranslation(images, targetLang, options);
}

export async function pollTask(taskId: string): Promise<TaskProgress> {
  const res = await fetch(`/api/v1/task/${taskId}`);

  if (!res.ok) {
    throw new Error(`Task ${res.status}`);
  }

  const data = await res.json() as TaskProgress;
  if (data.result && isBrowserCacheableTranslationResult(data.result)) {
    const pendingHashSets = consumePendingBrowserHashSets(data.task_id);
    if (pendingHashSets) {
      rememberBrowserCachedTranslation(pendingHashSets.hashSets, pendingHashSets.targetLang, data.result);
    }
  } else if (data.status === "failed") {
    consumePendingBrowserHashSets(data.task_id);
  }
  return data;
}

// ── Dish Images ────────────────────────────────────────────────────

export async function generateDishImageForDish(
  dish: Dish,
  taskId?: string,
): Promise<{ url: string; storage_id?: string }> {
  const res = await fetch(`/api/v1/dish/${encodeURIComponent(dish.id || "temp")}/generate-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dish, task_id: taskId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Image generation failed" }));
    throw new Error(err.error || `Generate dish image ${res.status}`);
  }

  return res.json();
}

// ── Reviews ────────────────────────────────────────────────────────

export async function submitReview(
  dishId: string,
  data: { rating: number; content: string; photos: string[] }
): Promise<{ review_id: string }> {
  const res = await fetch(`/api/v1/dish/${dishId}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function getReviews(
  dishId: string,
  page = 1,
  sort: "recent" | "helpful" = "recent",
  lang?: string
): Promise<{ reviews: Review[]; total: number; has_more: boolean }> {
  const params = new URLSearchParams({ page: String(page), sort });
  if (lang) params.set("lang", lang);

  const res = await fetch(`/api/v1/dish/${dishId}/reviews?${params}`);

  if (!res.ok) {
    throw new Error(`Reviews ${res.status}`);
  }

  return res.json();
}

// ── User Profile ───────────────────────────────────────────────────

export async function getUserProfile(): Promise<UserProfile> {
  const res = await fetch("/api/v1/user/profile");

  if (!res.ok) {
    throw new Error(`Profile ${res.status}`);
  }

  return res.json();
}

export async function updateUserProfile(data: Partial<UserProfile>): Promise<UserProfile> {
  const res = await fetch("/api/v1/user/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(`Profile update ${res.status}`);
  }

  return res.json();
}

// ── History ────────────────────────────────────────────────────────

export async function getHistory(): Promise<{ translations: TranslationRecord[] }> {
  const res = await fetch("/api/v1/history");

  if (!res.ok) {
    throw new Error(`History ${res.status}`);
  }

  return res.json();
}

// ── Favorites ──────────────────────────────────────────────────────

export async function getFavorites(): Promise<{ favorites: Dish[]; total: number }> {
  const res = await fetch("/api/v1/favorites");

  if (!res.ok) {
    throw new Error(`Favorites ${res.status}`);
  }

  return res.json();
}

export async function addFavorite(dishId: string): Promise<{ success: boolean }> {
  const res = await fetch("/api/v1/favorites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dish_id: dishId }),
  });

  if (!res.ok) {
    throw new Error(`Add favorite ${res.status}`);
  }

  return res.json();
}

export async function removeFavorite(dishId: string): Promise<{ success: boolean }> {
  const res = await fetch(`/api/v1/favorites?dish_id=${dishId}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    throw new Error(`Remove favorite ${res.status}`);
  }

  return res.json();
}
