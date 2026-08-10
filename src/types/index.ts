// ── Core Dish Type ────────────────────────────────────────────────

export interface Dish {
  id: string;
  name_original: string;
  name_translated: Record<string, string>; // { zh: "xx", en: "xx", ... }
  description: Record<string, string>;
  ingredients: string[];
  included_items?: string[];
  allergens: string[];
  taste_profile: string[];
  cuisine_region?: string;
  category?: string; // 'appetizer' | 'main' | 'dessert' | 'drink'
  recommendation?: string;
  good_for?: string;
  caution?: string;
  ai_image_url?: string;
  image_url?: string;
  image_status?: "pending" | "generating" | "deferred" | "done" | "failed";
  image_error?: string;
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

export interface RestaurantMeta {
  display_name: string;
  restaurant_type: string;
  rating_estimate: number;
}

export interface MenuInsight {
  summary: string;
  occasion_tags: string[];
  cuisine_style: string;
}

export interface SignatureRecommendation {
  dish_ids: string[];
  reason: string;
}

export interface TranslationResult {
  task_id: string;
  status: "done" | "processing" | "partial" | "failed";
  pages: MenuPage[];
  metadata: {
    source_language: string;
    target_language?: string;
    total_dishes: number;
    cached: boolean;
    processing_time_ms?: number;
    enrichment_status?: string;
    enrichment_time_ms?: number;
    image_generation_status?: "pending" | "processing" | "done" | "partial" | "failed";
    image_generation_progress?: { current: number; total: number };
    image_generation_queue_total?: number;
    image_generation_active_total?: number;
    image_generation_queued_total?: number;
    image_generation_batch_limit?: number;
    image_generation_deferred_total?: number;
    image_generation_failed?: Array<{ dish_id: string; name_original: string; error: string }>;
    restaurant?: RestaurantMeta;
    insight?: MenuInsight;
    signature?: SignatureRecommendation;
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

// ── Local Storage Types ────────────────────────────────────────────

export interface HistoryEntry {
  id: string;
  restaurant_name: string;
  city: string;
  dish_count: number;
  page_count: number;
  date: string;
  thumbnail: string;
  source_lang: string;
  target_lang: string;
  result_summary?: TranslationResult;
}

export interface FavoriteDish {
  id: string;
  name_original: string;
  name_zh: string;
  cuisine: string;
  image_url?: string;
  saved_at: string;
}

// ── Ordering Types ──────────────────────────────────────────────────

export type OrderQuantityMap = Record<string, number>;

export interface OrderPrice {
  amount: number;
  currency: string;
  raw: string;
}

export interface OrderNote {
  id: string;
  zh: string;
  original: string;
  target_lang?: string;
}

export interface OrderedDishItem {
  dish_id: string;
  dish: Dish;
  quantity: number;
  unitPrice?: OrderPrice;
  reviewed?: boolean;
}

export interface OrderedVisit {
  id: string;
  restaurant_name: string;
  country?: string;
  city?: string;
  source_lang: string;
  target_lang: string;
  date: string;
  items: OrderedDishItem[];
  notes: OrderNote[];
  totalAmount: number;
  hasUnknownPrices: boolean;
  result_summary?: TranslationResult;
  restaurant_rating?: number;
}

// ── Camera Types ───────────────────────────────────────────────────

export interface CapturedPhoto {
  id: string;
  dataUrl: string; // base64 for preview
  file?: File; // original file for upload
  timestamp: number;
}
