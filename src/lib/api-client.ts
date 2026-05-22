// Client-side API calls for DishLens

import type { TranslationResult, TaskProgress, Review, UserProfile, TranslationRecord, Dish } from "@/types";

// ── Image compression (for Vercel 4.5MB body limit) ───────────────

async function compressImage(file: File, maxDim = 2000, quality = 0.85): Promise<File> {
  // Skip if already small enough (under 500KB) — preserve text quality for OCR
  if (file.size < 500 * 1024) return file;

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

export async function createTranslation(images: File[]): Promise<{ task_id: string; status: string }> {
  const formData = new FormData();
  const compressed = await Promise.all(images.map((img) => compressImage(img)));
  compressed.forEach((img) => formData.append("images", img));
  formData.append("target_lang", "zh");

  const res = await fetch("/api/v1/translate/menu", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function translateMenu(images: File[]): Promise<TranslationResult> {
  const formData = new FormData();
  const compressed = await Promise.all(images.map((img) => compressImage(img)));
  compressed.forEach((img) => formData.append("images", img));
  formData.append("target_lang", "zh");

  const res = await fetch("/api/v1/translate/menu", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
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
