// Client-side API calls for DishLens

import type { TranslationResult, TaskProgress, Review, UserProfile, TranslationRecord, Dish } from "@/types";
import { shouldNormalizeClientImage } from "@/lib/image-input";
import { normalizeTargetLang } from "@/lib/languages";

// ── Image compression (for Vercel 4.5MB body limit) ───────────────

export const TRANSLATION_UPLOAD_TIMEOUT_MS = 45_000;
const CLIENT_MENU_IMAGE_MAX_DIM = 896;
const CLIENT_MENU_IMAGE_QUALITY = 0.58;

export type TranslationClientStage = "compressing" | "cache" | "uploading" | "task";

type TranslationClientOptions = {
  onStage?: (stage: TranslationClientStage) => void;
};

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

async function probeTranslationCache(images: File[], targetLang: string): Promise<TranslationResult | null> {
  if (!globalThis.crypto?.subtle) return null;
  try {
    const hashes = await Promise.all(images.map((img) => buildClientImageHash(img, targetLang)));
    const res = await fetch("/api/v1/translate/menu/cache", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_lang: targetLang, hashes }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { hit?: boolean; result?: TranslationResult };
    return data.hit && data.result ? data.result : null;
  } catch {
    return null;
  }
}

// ── Translation ────────────────────────────────────────────────────

async function postTranslation(images: File[], targetLang = "zh", options: TranslationClientOptions = {}): Promise<TranslationResult> {
  const formData = new FormData();
  const normalizedTargetLang = normalizeTargetLang(targetLang);
  const compressionStart = performance.now();
  const originalBytes = images.reduce((sum, img) => sum + img.size, 0);
  options.onStage?.("compressing");
  const compressed = await Promise.all(images.map((img) => compressImage(img)));
  const compressedBytes = compressed.reduce((sum, img) => sum + img.size, 0);
  console.info("translate:client_upload_prepared", {
    imageCount: images.length,
    originalBytes,
    compressedBytes,
    compressionMs: Math.round(performance.now() - compressionStart),
    targetLang: normalizedTargetLang,
  });
  options.onStage?.("cache");
  const cached = await probeTranslationCache(compressed, normalizedTargetLang);
  if (cached) return cached;

  compressed.forEach((img) => formData.append("images", img));
  formData.append("target_lang", normalizedTargetLang);

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
  return res.json();
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
