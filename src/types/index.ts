// ── Core Dish Type ────────────────────────────────────────────────

export interface Dish {
  id: string;
  name_original: string;
  name_translated: Record<string, string>; // { zh: "xx", en: "xx", ... }
  description: Record<string, string>;
  ingredients: string[];
  allergens: string[];
  taste_profile: string[];
  cuisine_region?: string;
  category?: string; // 'appetizer' | 'main' | 'dessert' | 'drink'
  ai_image_url?: string;
  image_source: "ai" | "user" | "mixed";
  rating_avg?: number;
  review_count?: number;
}

// ── Translation Types ──────────────────────────────────────────────

export interface MenuPage {
  page_index: number;
  page_label: string; // "前菜/主菜" etc.
  image_thumbnail: string;
  dishes: Dish[];
}

export interface TranslationResult {
  task_id: string;
  status: "done" | "processing" | "partial" | "failed";
  pages: MenuPage[];
  metadata: {
    source_language: string;
    total_dishes: number;
    cached: boolean;
  };
  failed_pages?: { page_index: number; error: string; retry_allowed: boolean }[];
}

export interface TaskProgress {
  task_id: string;
  type: "translate" | "image_generation";
  status: "pending" | "processing" | "done" | "partial" | "failed";
  progress: { current: number; total: number };
  per_page_status: { page_index: number; status: string }[];
  result?: TranslationResult;
  failed_pages?: { page_index: number; error: string; retry_allowed: boolean }[];
  estimated_remaining_seconds?: number;
}

// ── Review Types ───────────────────────────────────────────────────

export interface Review {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar?: string;
  dish_id: string;
  rating: number; // 1-5
  content: string;
  photos: string[];
  lang: string;
  helpful_count: number;
  created_at: string;
}

export interface ReviewSubmission {
  rating: number;
  content: string;
  photos: File[];
}

// ── User Types ─────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email?: string;
  name?: string;
  avatar_url?: string;
  preferred_lang: string;
  dietary_tags: string[];
  allergens: string[];
}

export interface UserSettings {
  targetLang: string;
  uiLang: "zh" | "en";
  showAllergens: boolean;
  showVeg: boolean;
  showGlutenFree: boolean;
}

// ── History / Favorites Types ──────────────────────────────────────

export interface TranslationRecord {
  id: string;
  restaurant_name: string;
  city: string;
  source_lang: string;
  target_lang: string;
  dish_count: number;
  page_count: number;
  created_at: string;
}

// ── Camera Types ───────────────────────────────────────────────────

export interface CapturedPhoto {
  id: string;
  dataUrl: string; // base64 for preview
  file?: File; // original file for upload
  timestamp: number;
}
