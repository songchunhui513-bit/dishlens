// Client-side API calls for DishLens

import type { TranslationResult, TaskProgress, Review, UserProfile, TranslationRecord, Dish } from "@/types";
import { shouldNormalizeClientImage } from "@/lib/image-input";
import { normalizeTargetLang } from "@/lib/languages";

// ── Image compression (for Vercel 4.5MB body limit) ───────────────

export const TRANSLATION_UPLOAD_TIMEOUT_MS = 45_000;

async function compressImage(file: File, maxDim = 1280, quality = 0.68): Promise<File> {
  // Keep small JPEG/PNG files untouched for OCR, but normalize WebP/large files
  // so the server and vision model receive a predictable browser-readable image.
  if (!shouldNormalizeClientImage(file)) return file;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
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

// ── Translation ────────────────────────────────────────────────────

async function postTranslation(images: File[], targetLang = "zh"): Promise<TranslationResult> {
  const formData = new FormData();
  const compressed = await Promise.all(images.map((img) => compressImage(img)));
  compressed.forEach((img) => formData.append("images", img));
  formData.append("target_lang", normalizeTargetLang(targetLang));

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), TRANSLATION_UPLOAD_TIMEOUT_MS);

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

  return res.json();
}

export async function createTranslation(images: File[], targetLang = "zh"): Promise<TranslationResult> {
  return postTranslation(images, targetLang);
}

export async function translateMenu(images: File[], targetLang = "zh"): Promise<TranslationResult> {
  return postTranslation(images, targetLang);
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
