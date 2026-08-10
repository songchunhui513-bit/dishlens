import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { analyzeMenuImage, analyzeMenuImageFast, refineTranslation, hasChinese } from "@/lib/ai";
import type { Dish } from "@/types";
import { getSupabaseAdminClient, getSupabaseClient, supabase } from "@/lib/db/supabase";
import { createTask, updateTask } from "@/lib/cache/task-store";
import { getCachedTranslationResult, setCachedTranslationResult } from "@/lib/cache/translation-file-cache";
import { generateImagesForDishes } from "@/lib/ai/image-gen";
import { getCachedDishImageUrl, uploadDishImage } from "@/lib/storage/supabase-storage";
import { matchDishKnowledgeImage } from "@/lib/dish-image-match";
import { getDishInsight } from "@/lib/dish-presentation";
import { MAX_MENU_IMAGES, normalizeImageMimeType } from "@/lib/image-input";
import { normalizeTargetLang } from "@/lib/languages";
import { normalizeServerMenuImage } from "@/lib/server-image-normalization";
import { storageIdForGeneratedDishImage } from "@/lib/dish-image-persistence";
import { canonicalDishNameKey, dishNameLookupCandidates } from "@/lib/dish-name-normalization";
import { isReusableExistingImageUrl } from "@/lib/dish-image-url";
import { extractRestaurantMeta, extractMenuInsight, extractSignature } from "@/lib/results-insight-fallback";
import { resolveMenuSourceLanguage } from "@/lib/menu-source-language";
import { sanitizeTranslationResultImages } from "@/lib/server/sanitize-translation-result";
import { hydrateRuntimeGeneratedDishImages, isRuntimeDisplayableGeneratedDishImageUrl } from "@/lib/server/runtime-generated-image-hydration";
import { isStableRemoteGeneratedDishImageUrl } from "@/lib/safe-image-url";

// In-memory translation cache — avoids Supabase schema/RLS issues for anonymous users
const translationCache = new Map<string, { result: Record<string, unknown>; createdAt: number }>();
const activeImageGenerationTasks = new Set<string>();
type TranslationCacheKeys = string | string[] | undefined;
const pendingImageGenerationPayloads = new Map<string, { resultPayload: Record<string, unknown>; cacheKeys?: TranslationCacheKeys }>();
const CACHE_MAX = 50;
const CACHE_TTL = 30 * 60 * 1000; // 30 min

function isCacheableTranslationResult(result: Record<string, unknown>): boolean {
  if (result.status === "failed") return false;
  if (result.status === "partial") return false;
  const pages = Array.isArray(result.pages) ? result.pages : [];
  const metadata = result.metadata as { total_dishes?: unknown } | undefined;
  const totalDishes = typeof metadata?.total_dishes === "number"
    ? metadata.total_dishes
    : pages.reduce((sum, page) => sum + (Array.isArray((page as { dishes?: unknown[] }).dishes) ? (page as { dishes: unknown[] }).dishes.length : 0), 0);
  return pages.length > 0 && totalDishes > 0;
}

function cacheKeyList(cacheKeys: TranslationCacheKeys): string[] {
  if (!cacheKeys) return [];
  return (Array.isArray(cacheKeys) ? cacheKeys : [cacheKeys])
    .map((key) => key.trim())
    .filter((key, index, keys) => key.length > 0 && keys.indexOf(key) === index);
}

async function rememberTranslation(cacheKeys: TranslationCacheKeys, result: Record<string, unknown>): Promise<void> {
  const keys = cacheKeyList(cacheKeys);
  if (keys.length === 0) return;
  if (!isCacheableTranslationResult(result)) return;
  for (const cacheKey of keys) {
    translationCache.set(cacheKey, { result, createdAt: Date.now() });
  }
  const persistentResult = stripMachineLocalGeneratedImagesForPersistentCache(result);
  await Promise.all(keys.map((cacheKey) => setCachedTranslationResult(cacheKey, persistentResult)));
}

function isMachineLocalGeneratedDishImageUrl(url: unknown): url is string {
  if (typeof url !== "string" || !url.trim()) return false;
  const value = url.trim();
  if (isStableRemoteGeneratedDishImageUrl(value)) return false;
  if (value.startsWith("/generated-dishes/")) return true;
  try {
    const parsed = new URL(value);
    return parsed.pathname.startsWith("/generated-dishes/");
  } catch {
    return false;
  }
}

function stripMachineLocalGeneratedImagesForPersistentCache(result: Record<string, unknown>): Record<string, unknown> {
  const pages = (result as { pages?: Array<{ dishes?: Dish[] }> }).pages || [];
  let strippedCount = 0;
  const nextPages = pages.map((page) => {
    let pageChanged = false;
    const dishes = (page.dishes || []).map((dish) => {
      const staleAiUrl = isMachineLocalGeneratedDishImageUrl(dish.ai_image_url);
      const staleImageUrl = isMachineLocalGeneratedDishImageUrl((dish as { image_url?: string }).image_url);
      if (!staleAiUrl && !staleImageUrl) return dish;

      strippedCount += Number(staleAiUrl) + Number(staleImageUrl);
      pageChanged = true;
      const nextDish = { ...dish } as Dish & { image_url?: string };
      if (staleAiUrl) delete nextDish.ai_image_url;
      if (staleImageUrl) delete nextDish.image_url;
      if (!nextDish.ai_image_url && !nextDish.image_url) {
        nextDish.image_status = "pending";
      }
      return nextDish;
    });
    return pageChanged ? { ...page, dishes } : page;
  });

  if (strippedCount === 0) return result;
  const metadata = {
    ...((result.metadata as Record<string, unknown>) || {}),
    local_generated_images_stripped_count: strippedCount,
    image_generation_status: "processing",
  };
  return { ...result, pages: nextPages, metadata };
}

function hashImageContent(targetLang: string, buffer: Buffer): string {
  return crypto
    .createHash("sha256")
    .update(targetLang)
    .update(":")
    .update(buffer)
    .digest("hex")
    .slice(0, 32);
}

function normalizeClientImageHashes(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string" || !value.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => /^[a-f0-9]{32}$/.test(item))
    .slice(0, MAX_MENU_IMAGES);
}

function normalizeClientImageHashSets(value: FormDataEntryValue | null, fallbackHashes: string[] = []): string[][] {
  const sets: string[][] = [];
  const addSet = (hashes: unknown) => {
    const normalized = Array.isArray(hashes)
      ? hashes
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().toLowerCase())
        .filter((item) => /^[a-f0-9]{32}$/.test(item))
        .slice(0, MAX_MENU_IMAGES)
      : [];
    if (normalized.length === 0) return;
    const key = normalized.slice().sort().join("|");
    if (sets.some((existing) => existing.slice().sort().join("|") === key)) return;
    sets.push(normalized);
  };

  addSet(fallbackHashes);
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) {
        for (const hashes of parsed) addSet(hashes);
      }
    } catch {}
  }
  return sets.slice(0, 4);
}

function verifiedClientImageHashSets(
  candidateSets: string[][],
  targetLang: string,
  rawImageBuffers: RawMenuImageInput[],
): string[][] {
  const uploadedHashes = rawImageBuffers.map((image) => hashImageContent(targetLang, image.buffer));
  const uploadedKey = uploadedHashes.slice().sort().join("|");
  if (!uploadedKey) return [];

  const hasVerifiedCandidate = candidateSets.some((hashes) => {
    if (hashes.length !== uploadedHashes.length) return false;
    return hashes.slice().sort().join("|") === uploadedKey;
  });
  if (candidateSets.length > 0 && !hasVerifiedCandidate) {
    console.warn("translate:client_hash_aliases_rejected", {
      candidateSetCount: candidateSets.length,
      imageCount: uploadedHashes.length,
    });
  }

  // The only shared alias is derived from bytes the server actually received.
  // Client candidates are used solely as a consistency signal and never become
  // cache keys on their own.
  return [uploadedHashes];
}

function buildTranslationCacheKeys(primaryCacheKey: string, clientHashSets: string[][]): string[] {
  const keys = [primaryCacheKey];
  for (const hashes of clientHashSets) {
    const clientCacheKey = hashes.slice().sort().join("|");
    if (clientCacheKey && !keys.includes(clientCacheKey)) keys.push(clientCacheKey);
  }
  return keys;
}

function buildClientTranslationCacheKeys(clientHashSets: string[][]): string[] {
  return clientHashSets
    .map((hashes) => hashes.slice().sort().join("|"))
    .filter((key, index, keys) => key && keys.indexOf(key) === index);
}

async function findCachedTranslationByClientKeys(clientCacheKeys: string[]): Promise<{
  cacheKey: string;
  cached: { result: Record<string, unknown>; createdAt: number };
} | null> {
  for (const key of clientCacheKeys) {
    const memoryCached = translationCache.get(key);
    const cached = memoryCached && Date.now() - memoryCached.createdAt < CACHE_TTL
      ? memoryCached
      : await getCachedTranslationResult(key);
    if (!cached) continue;
    if (!isCacheableTranslationResult(cached.result)) {
      const cachedKey = key;
      translationCache.delete(cachedKey);
      continue;
    }
    if (cached !== memoryCached) translationCache.set(key, cached);
    return { cacheKey: key, cached };
  }
  return null;
}

function isPersistableGeneratedDishImageUrl(url: string | null | undefined): url is string {
  return typeof url === "string" && isStableRemoteGeneratedDishImageUrl(url);
}

function dishMergeKeys(dish: Pick<Dish, "id" | "name_original">): string[] {
  return [dish.id, dish.name_original]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

function mergeGeneratedDishImagesFromExistingResult(
  nextPayload: Record<string, unknown>,
  existingPayload: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!existingPayload) return nextPayload;
  const existingPages = (existingPayload as { pages?: Array<{ dishes?: Dish[] }> }).pages || [];
  const nextPages = (nextPayload as { pages?: Array<{ dishes?: Dish[] }> }).pages || [];
  if (!existingPages.length || !nextPages.length) return nextPayload;

  const existingByKey = new Map<string, Dish>();
  for (const page of existingPages) {
    for (const dish of page.dishes || []) {
      if (!dish.ai_image_url && !(dish as { image_url?: string }).image_url && !dish.image_status) continue;
      for (const key of dishMergeKeys(dish)) existingByKey.set(key, dish);
    }
  }

  for (const page of nextPages) {
    for (const dish of page.dishes || []) {
      if (dish.ai_image_url || (dish as { image_url?: string }).image_url) continue;
      const existing = dishMergeKeys(dish)
        .map((key) => existingByKey.get(key))
        .find(Boolean);
      if (!existing) continue;
      if (existing.ai_image_url) dish.ai_image_url = existing.ai_image_url;
      const existingImageUrl = (existing as { image_url?: string }).image_url;
      if (existingImageUrl) (dish as { image_url?: string }).image_url = existingImageUrl;
      if (existing.image_status) dish.image_status = existing.image_status;
      if (existing.image_error) dish.image_error = existing.image_error;
      if (existing.image_source) dish.image_source = existing.image_source;
    }
  }

  return nextPayload;
}

function mergeImageGenerationStateIntoCurrentResult(
  currentPayload: Record<string, unknown>,
  imagePayload: Record<string, unknown>,
): Record<string, unknown> {
  mergeGeneratedDishImagesFromExistingResult(currentPayload, imagePayload);

  const currentMetadata = ((currentPayload.metadata as Record<string, unknown>) || {});
  const imageMetadata = ((imagePayload.metadata as Record<string, unknown>) || {});
  currentMetadata.image_generation_status = imageMetadata.image_generation_status;
  currentMetadata.image_generation_progress = imageMetadata.image_generation_progress;
  currentMetadata.image_generation_queue_total = imageMetadata.image_generation_queue_total;
  currentMetadata.image_generation_active_total = imageMetadata.image_generation_active_total;
  currentMetadata.image_generation_queued_total = imageMetadata.image_generation_queued_total;
  currentMetadata.image_generation_batch_limit = imageMetadata.image_generation_batch_limit;
  currentMetadata.image_generation_deferred_total = imageMetadata.image_generation_deferred_total;
  if (imageMetadata.image_generation_failed) {
    currentMetadata.image_generation_failed = imageMetadata.image_generation_failed;
  } else {
    delete currentMetadata.image_generation_failed;
  }
  currentPayload.metadata = currentMetadata;

  return currentPayload;
}

function resultNeedsDishAdviceRefresh(result: Record<string, unknown>): boolean {
  const pages = (result as { pages?: Array<{ dishes?: Array<Record<string, unknown>> }> }).pages || [];
  return pages
    .flatMap((page) => page.dishes || [])
    .some((dish) => !dish.recommendation || !dish.good_for || !dish.caution);
}

function resultNeedsImageRefresh(result: Record<string, unknown>): boolean {
  const metadata = ((result.metadata as Record<string, unknown>) || {});
  if (Number(metadata.image_sanitized_count || 0) > 0) return true;
  if (Number(metadata.local_generated_images_stripped_count || 0) > 0) return true;

  const pages = (result as { pages?: Array<{ dishes?: Array<Record<string, unknown>> }> }).pages || [];
  return pages
    .flatMap((page) => page.dishes || [])
    .some((dish) => !dish.ai_image_url && !dish.image_url && dish.image_status !== "failed" && dish.image_status !== "deferred");
}

function shouldRefreshCachedResultInBackground(result: Record<string, unknown>): boolean {
  return resultNeedsImageRefresh(result) || resultNeedsDishAdviceRefresh(result);
}

function markCachedResultRefreshPending(cachedResult: Record<string, unknown>): void {
  if (!shouldRefreshCachedResultInBackground(cachedResult)) return;
  const metadata = ((cachedResult.metadata as Record<string, unknown>) || {});
  if (resultNeedsImageRefresh(cachedResult)) {
    metadata.image_generation_status = "processing";
  }
  if (resultNeedsDishAdviceRefresh(cachedResult)) {
    metadata.enrichment_status = "pending";
  }
  cachedResult.metadata = metadata;
}

export const maxDuration = 60;

const OCR_CONCURRENCY = Math.max(
  1,
  Math.min(3, Number.parseInt(process.env.MENU_OCR_CONCURRENCY || "2", 10) || 2),
);
const FAST_FIRST_PASS_OCR_CONCURRENCY = Math.max(
  1,
  Math.min(4, Number.parseInt(process.env.MENU_FAST_FIRST_PASS_OCR_CONCURRENCY || "3", 10) || 3),
);
const FAST_OCR_MODE = process.env.MENU_FAST_OCR_MODE !== "false";
const FULL_PROMPT_PAGE_LIMIT = FAST_OCR_MODE
  ? 0
  : Number.parseInt(process.env.MENU_FULL_PROMPT_PAGE_LIMIT || "4", 10) || 4;
const REFINE_LOW_CONFIDENCE = process.env.MENU_REFINE_LOW_CONFIDENCE === "true";
const FAST_FIRST_PASS = process.env.MENU_FAST_FIRST_PASS !== "false";
const MENU_ENRICHMENT_DELAY_MS = Math.max(
  0,
  Math.min(30_000, Number.parseInt(process.env.MENU_ENRICHMENT_DELAY_MS || "3500", 10) || 3500),
);
const FAST_FIRST_PASS_IMAGE_MAX_DIM = Math.max(
  900,
  Math.min(1400, Number.parseInt(process.env.MENU_FAST_FIRST_PASS_IMAGE_MAX_DIM || "1100", 10) || 1100),
);
const FAST_FIRST_PASS_IMAGE_QUALITY = Math.max(
  55,
  Math.min(76, Number.parseInt(process.env.MENU_FAST_FIRST_PASS_IMAGE_QUALITY || "68", 10) || 68),
);
const FAST_FIRST_PASS_IMAGE_TARGET_BYTES = Math.max(
  96 * 1024,
  Math.min(
    300 * 1024,
    Number.parseInt(process.env.MENU_FAST_FIRST_PASS_IMAGE_TARGET_BYTES || String(180 * 1024), 10) || 180 * 1024,
  ),
);
const IMAGE_GENERATION_CONCURRENCY = Math.max(
  1,
  Math.min(3, Number.parseInt(process.env.MENU_IMAGE_GENERATION_CONCURRENCY || "3", 10) || 3),
);
const ABOVE_FOLD_IMAGE_GENERATION_LIMIT = 4;
const BACKGROUND_IMAGE_GENERATION_LIMIT = Math.max(
  ABOVE_FOLD_IMAGE_GENERATION_LIMIT,
  Math.min(48, Number.parseInt(process.env.MENU_BACKGROUND_IMAGE_GENERATION_LIMIT || "24", 10) || 24),
);
const MENU_LARGE_MENU_IMAGE_GENERATION_LIMIT = Math.max(
  ABOVE_FOLD_IMAGE_GENERATION_LIMIT,
  Math.min(BACKGROUND_IMAGE_GENERATION_LIMIT, Number.parseInt(process.env.MENU_LARGE_MENU_IMAGE_GENERATION_LIMIT || "16", 10) || 16),
);
const MENU_HUGE_MENU_IMAGE_GENERATION_LIMIT = Math.max(
  ABOVE_FOLD_IMAGE_GENERATION_LIMIT,
  Math.min(MENU_LARGE_MENU_IMAGE_GENERATION_LIMIT, Number.parseInt(process.env.MENU_HUGE_MENU_IMAGE_GENERATION_LIMIT || "8", 10) || 8),
);
function imageGenerationLimitForDishCount(totalDishes: number): number {
  if (totalDishes >= 160) return MENU_HUGE_MENU_IMAGE_GENERATION_LIMIT;
  if (totalDishes >= 80) return MENU_LARGE_MENU_IMAGE_GENERATION_LIMIT;
  return BACKGROUND_IMAGE_GENERATION_LIMIT;
}
const SUPABASE_LOOKUP_COOLDOWN_MS = Math.max(
  10_000,
  Math.min(10 * 60_000, Number.parseInt(process.env.SUPABASE_LOOKUP_COOLDOWN_MS || "120000", 10) || 120000),
);
const SUPABASE_LOOKUP_TIMEOUT_MS = Math.max(
  300,
  Math.min(5_000, Number.parseInt(process.env.SUPABASE_LOOKUP_TIMEOUT_MS || "1200", 10) || 1200),
);
const MENU_REMOTE_IMAGE_LOOKUP_DISH_LIMIT = Math.max(
  24,
  Math.min(200, Number.parseInt(process.env.MENU_REMOTE_IMAGE_LOOKUP_DISH_LIMIT || "80", 10) || 80),
);
const MENU_REMOTE_IMAGE_LOOKUP_CANDIDATE_LIMIT = Math.max(
  80,
  Math.min(600, Number.parseInt(process.env.MENU_REMOTE_IMAGE_LOOKUP_CANDIDATE_LIMIT || "240", 10) || 240),
);
let supabaseLookupDisabledUntil = 0;

type ImageGenerationFailure = {
  dish_id: string;
  name_original: string;
  error: string;
};

type RawMenuImageInput = {
  buffer: Buffer;
  mimeType: string;
  name: string;
  size: number;
};

type MenuImageInput = {
  base64: string;
  mimeType: string;
  name: string;
  size: number;
  normalizedSize: number;
  hash: string;
};

type TranslationTimings = {
  formDataMs?: number;
  taskCreateMs?: number;
  rawReadMs?: number;
  normalizationMs?: number;
  intakeMs?: number;
  firstPageMs?: number;
  firstPageModelMs?: number;
  firstPageBuildMs?: number;
  firstPassMs?: number;
  firstPassModelMs?: number;
  firstPassModelName?: string;
  firstPassModelNames?: string[];
  firstPassModelMsByPage?: number[];
  firstPassBuildMs?: number;
  firstPassBuildMsByPage?: number[];
  firstPassInputOptimizeMs?: number;
  firstPassOriginalBytes?: number;
  firstPassModelBytes?: number;
  firstPassTargetBytes?: number;
  firstPassCompressionRatio?: number;
  enrichmentMs?: number;
};

async function normalizeMenuImagesForProcessing(
  rawImages: RawMenuImageInput[],
  targetLang: string,
  timings: TranslationTimings = {},
): Promise<MenuImageInput[]> {
  const normalizationStart = Date.now();
  const imageBuffers = await Promise.all(
    rawImages.map(async (file) => {
      const normalized = await normalizeServerMenuImage({
        buffer: file.buffer,
        mimeType: file.mimeType,
        name: file.name,
      });
      return {
        base64: normalized.buffer.toString("base64"),
        mimeType: normalized.mimeType,
        name: file.name || "menu-photo",
        size: file.size,
        normalizedSize: normalized.buffer.length,
        hash: hashImageContent(targetLang, normalized.buffer),
      };
    })
  );
  timings.normalizationMs = Date.now() - normalizationStart;
  return imageBuffers;
}

function isSupabaseLookupUnavailable(): boolean {
  return Date.now() < supabaseLookupDisabledUntil;
}

function markSupabaseLookupUnavailable(error: unknown): void {
  supabaseLookupDisabledUntil = Date.now() + SUPABASE_LOOKUP_COOLDOWN_MS;
  console.warn("translate:supabase_lookup_unavailable", {
    cooldownMs: SUPABASE_LOOKUP_COOLDOWN_MS,
    error: error instanceof Error ? error.message : String(error),
  });
}

function withSupabaseLookupTimeout<T>(operation: PromiseLike<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error("Supabase lookup timed out")), SUPABASE_LOOKUP_TIMEOUT_MS);
  });
  return Promise.race([Promise.resolve(operation), timeoutPromise])
    .finally(() => {
      if (timeout) clearTimeout(timeout);
    });
}

function requestMeta(req: NextRequest): Record<string, string> {
  return {
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown",
    country: req.headers.get("cf-ipcountry") || req.headers.get("x-vercel-ip-country") || "unknown",
    userAgent: (req.headers.get("user-agent") || "").slice(0, 120),
  };
}

function isLocalTaskFallbackRequest(req: NextRequest): boolean {
  const host = req.headers.get("host") || "";
  return /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host);
}

type ExistingDishImage = {
  id: string;
  name_original: string;
  name_translated?: string | null;
  ai_image_url?: string | null;
  image_source?: string | null;
};

type AnalyzedDish = {
  confidence: number;
  name_original: string;
  name_translated: string;
  description: string;
  recommendation?: string;
  good_for?: string;
  caution?: string;
  _needsRetranslate?: boolean;
  ingredients?: string[];
  included_items?: string[];
  allergens?: string[];
  taste_profile?: string[];
  category?: string;
};

type MenuAnalysisResult = {
  dishes: AnalyzedDish[];
  page_label: string;
  page_type?: "menu" | "info";
  page_description?: string;
  source_language: string;
  _model?: string;
  menu_metadata?: {
    restaurant?: {
      display_name?: string;
      restaurant_type?: string;
      rating_estimate?: number;
    };
    insight?: {
      summary?: string;
      occasion_tags?: string[];
      cuisine_style?: string;
    };
    signature?: {
      dish_indexes?: number[];
      reason?: string;
    };
  };
};

type DishRecordOptions = {
  imageLookup?: "full" | "local-only";
};

function withDishAdviceFallback(dish: Dish): Dish {
  const insight = getDishInsight(dish);
  return {
    ...dish,
    recommendation: dish.recommendation || insight.recommendation,
    good_for: dish.good_for || insight.goodFor,
    caution: dish.caution || insight.caution,
  };
}

function needsTargetLanguageCorrection(dish: AnalyzedDish, targetLang: string): boolean {
  const lang = normalizeTargetLang(targetLang);
  if (dish._needsRetranslate) return true;
  if (lang === "zh") {
    return !hasChinese(dish.name_translated || "") || !hasChinese(dish.description || "");
  }
  return REFINE_LOW_CONFIDENCE && dish.confidence < 0.5;
}

async function refineDishesForTargetLanguage(
  dishes: AnalyzedDish[],
  sourceLanguage: string,
  targetLang: string,
): Promise<AnalyzedDish[]> {
  return Promise.all(
    dishes.map(async (dish) => {
      if (!needsTargetLanguageCorrection(dish, targetLang)) return dish;
      try {
        const refined = await refineTranslation({
          name_original: dish.name_original,
          name_translated: dish.name_translated,
          description: dish.description,
          source_language: sourceLanguage,
        }, targetLang);
        return { ...dish, ...refined };
      } catch {
        return dish;
      }
    })
  );
}

async function findExistingDishImages(
  dishes: Array<{ name_original: string; name_translated?: string | Record<string, string> }>,
): Promise<Map<number, ExistingDishImage>> {
  if (isSupabaseLookupUnavailable()) return new Map();
  if (dishes.length > MENU_REMOTE_IMAGE_LOOKUP_DISH_LIMIT) {
    console.info("translate:remote_image_lookup_skipped", {
      reason: "too_many_dishes",
      dishCount: dishes.length,
      limit: MENU_REMOTE_IMAGE_LOOKUP_DISH_LIMIT,
    });
    return new Map();
  }

  const client = getSupabaseAdminClient() || getSupabaseClient();
  if (!client) return new Map();
  const candidateToIndices = new Map<string, number[]>();

  dishes.forEach((dish, index) => {
    const translated = typeof dish.name_translated === "string"
      ? dish.name_translated
      : dish.name_translated?.zh || dish.name_translated?.en || "";
    const sourceNames = [dish.name_original, translated].filter(Boolean);
    for (const candidate of sourceNames.flatMap((name) => dishNameLookupCandidates(name))) {
      const bucket = candidateToIndices.get(candidate) || [];
      bucket.push(index);
      candidateToIndices.set(candidate, bucket);
    }
  });

  const candidates = Array.from(candidateToIndices.keys());
  if (candidates.length === 0) return new Map();
  if (candidates.length > MENU_REMOTE_IMAGE_LOOKUP_CANDIDATE_LIMIT) {
    console.info("translate:remote_image_lookup_skipped", {
      reason: "too_many_candidates",
      candidateCount: candidates.length,
      limit: MENU_REMOTE_IMAGE_LOOKUP_CANDIDATE_LIMIT,
      dishCount: dishes.length,
    });
    return new Map();
  }

  let originalRows: unknown[] | null = null;
  let translatedRows: unknown[] | null = null;
  try {
    const [originalResponse, translatedResponse] = await withSupabaseLookupTimeout(Promise.all([
      client
        .from("dishes")
        .select("id, name_original, name_translated, ai_image_url, image_source")
        .in("name_original", candidates)
        .limit(200),
      client
        .from("dishes")
        .select("id, name_original, name_translated, ai_image_url, image_source")
        .in("name_translated", candidates)
        .limit(200),
    ]));
    if (originalResponse.error) throw originalResponse.error;
    if (translatedResponse.error) throw translatedResponse.error;
    originalRows = originalResponse.data || null;
    translatedRows = translatedResponse.data || null;
  } catch (error) {
    markSupabaseLookupUnavailable(error);
    return new Map();
  }

  const results = new Map<number, ExistingDishImage>();
  for (const row of ([...(originalRows || []), ...(translatedRows || [])]) as ExistingDishImage[]) {
    const indices = [
      ...(candidateToIndices.get(row.name_original) || []),
      ...(row.name_translated ? candidateToIndices.get(row.name_translated) || [] : []),
    ];
    for (const index of indices) {
      if (!results.has(index)) results.set(index, row);
    }
  }

  return results;
}

async function buildDishRecords(
  dishes: AnalyzedDish[],
  pageLabel: string,
  usedImageIds: Set<string>,
  targetLang: string,
  options: DishRecordOptions = {},
): Promise<Dish[]> {
  const imageLookup = options.imageLookup || "full";
  const localMatches = new Map<number, { card: string; hero: string; id: string } | null>();
  for (let di = 0; di < dishes.length; di++) {
    const dish = dishes[di];
    const match = matchDishKnowledgeImage({ ...dish, page_label: pageLabel });
    if (match && !usedImageIds.has(match.id)) {
      usedImageIds.add(match.id);
      localMatches.set(di, match);
    } else {
      localMatches.set(di, null);
    }
  }

  const existingImagesByIndex = imageLookup === "full"
    ? await findExistingDishImages(dishes)
    : new Map<number, ExistingDishImage>();

  return Promise.all(
    dishes.map(async (dish, di) => {
      const localMatch = localMatches.get(di);
      try {
        const existing = existingImagesByIndex.get(di) || null;
        const existingImageUrl = isReusableExistingImageUrl(existing?.ai_image_url)
          ? existing.ai_image_url
          : null;
        const rawCachedGeneratedImageUrl = existingImageUrl || localMatch || imageLookup !== "full"
          ? null
          : await getCachedDishImageUrl(storageIdForGeneratedDishImage(dish));
        const cachedGeneratedImageUrl = isRuntimeDisplayableGeneratedDishImageUrl(rawCachedGeneratedImageUrl)
          ? rawCachedGeneratedImageUrl
          : null;
        const imageUrl = localMatch?.card || existingImageUrl || cachedGeneratedImageUrl || null;

        return withDishAdviceFallback({
          ...dish,
          id: existing?.id || `temp-${crypto.randomUUID()}`,
          name_translated: { [targetLang]: dish.name_translated },
          description: { [targetLang]: dish.description || "" },
          ai_image_url: imageUrl,
          image_url: imageUrl,
          image_status: imageUrl ? "done" : "pending",
          image_source: localMatch ? "mixed" : (existing?.image_source || "ai"),
        } as Dish);
      } catch {
        const imageUrl = localMatch?.card || null;
        return withDishAdviceFallback({
          ...dish,
          id: `temp-${crypto.randomUUID()}`,
          name_translated: { [targetLang]: dish.name_translated },
          description: { [targetLang]: dish.description || "" },
          ai_image_url: imageUrl,
          image_url: imageUrl,
          image_status: imageUrl ? "done" : "pending",
          image_source: localMatch ? "mixed" : "ai",
        } as Dish);
      }
    })
  );
}

function buildPartialPayload(
  taskId: string,
  pages: Array<Record<string, unknown> | undefined>,
  failed: Array<{ page_index: number; error: string; retry_allowed: boolean }>,
  targetLang: string,
  startTime: number,
  timings: TranslationTimings = {},
): Record<string, unknown> {
  const completed = pages.filter(Boolean) as Array<Record<string, unknown>>;
  const sorted = completed.sort(
    (a, b) => ((a as { page_index: number }).page_index) - ((b as { page_index: number }).page_index),
  );
  return {
    task_id: taskId,
    status: failed.length === pages.length ? "failed"
      : failed.length > 0 ? "partial"
      : completed.length < pages.length ? "partial"
      : "done",
    pages: sorted,
    failed_pages: failed.length > 0 ? failed : undefined,
    metadata: {
      source_language: (sorted[0] as { source_language?: string })?.source_language || "unknown",
      target_language: targetLang,
      total_dishes: sorted.reduce((sum, p) => sum + (((p as { dishes?: unknown[] }).dishes)?.length || 0), 0),
      page_count: sorted.length,
      total_pages: pages.length,
      cached: false,
      processing_time_ms: Date.now() - startTime,
      restaurant: extractRestaurantMeta(sorted),
      insight: extractMenuInsight(sorted),
      signature: extractSignature(sorted),
      timings: {
        ...timings,
        processing_time_ms: Date.now() - startTime,
      },
    },
  };
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const meta = requestMeta(req);
  const timings: TranslationTimings = {};

  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data") && !contentType.includes("application/x-www-form-urlencoded")) {
      return NextResponse.json(
        { error: "Request must be multipart/form-data" },
        { status: 400 }
      );
    }

    const formDataStart = Date.now();
    const formData = await req.formData();
    timings.formDataMs = Date.now() - formDataStart;
    const images = formData
      .getAll("images")
      .filter((item): item is File => item instanceof File && item.size > 0);
    const targetLang = normalizeTargetLang(formData.get("target_lang"));

    if (!images || images.length === 0) {
      return NextResponse.json({ error: "No images provided" }, { status: 400 });
    }

    if (images.length > MAX_MENU_IMAGES) {
      return NextResponse.json({ error: `Max ${MAX_MENU_IMAGES} images` }, { status: 400 });
    }

    const taskId = crypto.randomUUID();
    const preferMemoryTask = isLocalTaskFallbackRequest(req);
    const taskCreateStart = Date.now();
    await createTask(taskId, images.length, {
      allowMemoryFallback: true,
      preferMemory: preferMemoryTask,
    });
    timings.taskCreateMs = Date.now() - taskCreateStart;
    console.info("translate:task_started", {
      taskId,
      imageCount: images.length,
      sizes: images.map((image) => image.size),
      provider: process.env.MENU_AI_PROVIDER || "auto",
      targetLang,
      ...meta,
    });

    // Read file data before trusting client-provided hashes. This is still much
    // cheaper than image normalization or model inference and prevents cache
    // aliases from being forged by a public client.
    const rawReadStart = Date.now();
    const rawImageBuffers = await Promise.all(
      images.map(async (file) => {
        const originalBuffer = Buffer.from(await file.arrayBuffer());
        const mimeType = normalizeImageMimeType(file.type, file.name);
        return {
          buffer: originalBuffer,
          mimeType,
          name: file.name || "menu-photo",
          size: file.size,
        };
      })
    );
    timings.rawReadMs = Date.now() - rawReadStart;
    timings.intakeMs = Date.now() - startTime;
    console.info("translate:task_intake_ready", {
      taskId,
      elapsedMs: timings.intakeMs,
      formDataMs: timings.formDataMs,
      taskCreateMs: timings.taskCreateMs,
      rawReadMs: timings.rawReadMs,
      originalBytes: images.reduce((sum, image) => sum + image.size, 0),
      imageCount: images.length,
      targetLang,
      ...meta,
    });

    const submittedClientHashes = normalizeClientImageHashes(formData.get("client_hashes"));
    const submittedClientHashSets = normalizeClientImageHashSets(
      formData.get("client_hash_sets"),
      submittedClientHashes,
    );
    const clientHashSets = verifiedClientImageHashSets(
      submittedClientHashSets,
      targetLang,
      rawImageBuffers,
    );
    const clientCacheKeys = buildClientTranslationCacheKeys(clientHashSets);

    // Check verified upload-byte hashes before server-side normalization. The
    // normalized cache key is added by the background processor after intake.
    const cachedHit = await findCachedTranslationByClientKeys(clientCacheKeys);
    if (cachedHit) {
      const cached = cachedHit.cached;
      const cachedRawStatus = typeof cached.result.status === "string" ? cached.result.status : "";
      const cachedStatus: "done" | "partial" | "failed" =
        cachedRawStatus === "partial" || cachedRawStatus === "failed" ? cachedRawStatus : "done";
      const cachedPageStatus = cachedStatus === "failed" ? "failed" : "done";
      const cachedResult = hydrateRuntimeGeneratedDishImages(sanitizeTranslationResultImages({
        ...cached.result,
        task_id: taskId,
        status: cachedStatus,
        metadata: {
          ...(cached.result.metadata as Record<string, unknown>),
          cached: true,
          cache_key_source: "client",
          timings: {
            ...(((cached.result.metadata as Record<string, unknown>)?.timings as Record<string, unknown>) || {}),
            ...timings,
          },
        },
      }));
      markCachedResultRefreshPending(cachedResult);
      await updateTask(taskId, {
        status: cachedStatus,
        progress: { current: images.length, total: images.length },
        perPageStatus: images.map((_, i) => ({ page_index: i, status: cachedPageStatus })),
        result: cachedResult,
        estimatedRemaining: 0,
      });
      if (shouldRefreshCachedResultInBackground(cachedResult)) {
        refreshCachedResultInBackground({ taskId, rawImageBuffers, cachedResult, targetLang, clientHashSets, startTime, meta, timings });
      }
      return NextResponse.json(cachedResult, { status: 200 });
    }

    // Evict expired entries
    if (translationCache.size >= CACHE_MAX) {
      for (const [k, v] of translationCache) {
        if (Date.now() - v.createdAt >= CACHE_TTL) translationCache.delete(k);
      }
    }

    // Fire background processing — buffers are in memory, safe to use after response
    const processor = FAST_FIRST_PASS ? processImagesFastFirstPass : processImages;
    processor(taskId, rawImageBuffers, targetLang, startTime, clientHashSets, meta, timings).catch(async (err) => {
      console.error("translate:task_failed", {
        taskId,
        elapsedMs: Date.now() - startTime,
        error: err instanceof Error ? err.message : String(err),
        ...meta,
      });
      const { updateTask, getTask } = await import("@/lib/cache/task-store");
      const task = await getTask(taskId);
      if (task) {
        await updateTask(taskId, {
          status: "failed",
          failedPages: rawImageBuffers.map((_, i) => ({
            page_index: i,
            error: err instanceof Error ? err.message : "Processing error",
            retry_allowed: true,
          })),
        });
      }
    });

    return NextResponse.json(
      { task_id: taskId, status: "processing" },
      { status: 202 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Translation failed";
    console.error("Translate error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function analyzeMenuImageWithEmptyRetry(
  item: MenuImageInput,
  targetLang: string,
  taskId: string,
  pageIndex: number,
  startTime: number,
  meta?: Record<string, string>,
): Promise<MenuAnalysisResult> {
  const raw = await analyzeMenuImageFast(item.base64, false, item.mimeType, targetLang) as MenuAnalysisResult;
  if (raw.dishes.length === 0) {
    console.warn("translate:empty_fast_ocr_retry", {
      taskId,
      pageIndex,
      elapsedMs: Date.now() - startTime,
      normalizedSize: item.normalizedSize,
      pageType: raw.page_type,
      pageLabel: raw.page_label,
      ...meta,
    });
    return await analyzeMenuImage(item.base64, false, item.mimeType, targetLang) as MenuAnalysisResult;
  }
  return raw;
}

type FastFirstPassImageAttempt = {
  width: number;
  quality: number;
};

type FastFirstPassSharpPipeline = {
  rotate(): FastFirstPassSharpPipeline;
  resize(options: {
    width: number;
    height: number;
    fit: "inside";
    withoutEnlargement: true;
  }): FastFirstPassSharpPipeline;
  sharpen(options: { sigma: number; m1: number; m2: number }): FastFirstPassSharpPipeline;
  jpeg(options: { quality: number; mozjpeg: true }): { toBuffer(): Promise<Buffer> };
};

type FastFirstPassSharp = (input: Buffer, options: { failOn: "none" }) => FastFirstPassSharpPipeline;

function buildFastFirstPassAttempts(): FastFirstPassImageAttempt[] {
  const attempts: FastFirstPassImageAttempt[] = [
    { width: FAST_FIRST_PASS_IMAGE_MAX_DIM, quality: FAST_FIRST_PASS_IMAGE_QUALITY },
    { width: FAST_FIRST_PASS_IMAGE_MAX_DIM, quality: Math.min(FAST_FIRST_PASS_IMAGE_QUALITY, 62) },
    { width: Math.max(900, Math.min(1000, FAST_FIRST_PASS_IMAGE_MAX_DIM)), quality: Math.min(FAST_FIRST_PASS_IMAGE_QUALITY, 58) },
    { width: 900, quality: 55 },
  ];
  const seen = new Set<string>();
  return attempts.filter((attempt) => {
    const key = `${attempt.width}:${attempt.quality}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function buildFastFirstPassModelBuffer(
  sharp: FastFirstPassSharp,
  sourceBuffer: Buffer,
): Promise<Buffer> {
  const buffer = await sharp(sourceBuffer, { failOn: "none" })
    .rotate()
    .resize({
      width: FAST_FIRST_PASS_IMAGE_MAX_DIM,
      height: FAST_FIRST_PASS_IMAGE_MAX_DIM,
      fit: "inside",
      withoutEnlargement: true,
    })
    .sharpen({ sigma: 0.6, m1: 0.4, m2: 1.0 })
    .jpeg({ quality: FAST_FIRST_PASS_IMAGE_QUALITY, mozjpeg: true })
    .toBuffer();
  let smallestBuffer = buffer;
  if (buffer.length <= FAST_FIRST_PASS_IMAGE_TARGET_BYTES) return buffer;

  for (const attempt of buildFastFirstPassAttempts().slice(1)) {
    const buffer = await sharp(sourceBuffer, { failOn: "none" })
      .rotate()
      .resize({
        width: attempt.width,
        height: attempt.width,
        fit: "inside",
        withoutEnlargement: true,
      })
      .sharpen({ sigma: 0.6, m1: 0.4, m2: 1.0 })
      .jpeg({ quality: attempt.quality, mozjpeg: true })
      .toBuffer();
    if (buffer.length < smallestBuffer.length) smallestBuffer = buffer;
    if (buffer.length <= FAST_FIRST_PASS_IMAGE_TARGET_BYTES) return buffer;
  }

  return smallestBuffer;
}

async function buildFastFirstPassModelImage(item: MenuImageInput): Promise<MenuImageInput> {
  try {
    const sharp = (await import("sharp")).default;
    const sourceBuffer = Buffer.from(item.base64, "base64");
    const buffer = await buildFastFirstPassModelBuffer(sharp, sourceBuffer);
    return {
      ...item,
      base64: buffer.toString("base64"),
      mimeType: "image/jpeg",
      normalizedSize: buffer.length,
    };
  } catch (err) {
    console.warn("translate:fast_first_pass_image_optimize_failed", {
      name: item.name,
      normalizedSize: item.normalizedSize,
      error: err instanceof Error ? err.message : String(err),
    });
    return item;
  }
}

async function processImagesFastFirstPass(
  taskId: string,
  rawImageBuffers: RawMenuImageInput[],
  targetLang: string,
  startTime: number,
  clientHashSets: string[][] = [],
  meta?: Record<string, string>,
  timings: TranslationTimings = {},
) {
  const imageBuffers = await normalizeMenuImagesForProcessing(rawImageBuffers, targetLang, timings);
  const firstPassOptimizeStart = Date.now();
  const firstPassImageBuffers = await Promise.all(imageBuffers.map(buildFastFirstPassModelImage));
  timings.firstPassInputOptimizeMs = Date.now() - firstPassOptimizeStart;
  timings.firstPassOriginalBytes = imageBuffers.reduce((sum, item) => sum + item.normalizedSize, 0);
  timings.firstPassModelBytes = firstPassImageBuffers.reduce((sum, item) => sum + item.normalizedSize, 0);
  timings.firstPassTargetBytes = FAST_FIRST_PASS_IMAGE_TARGET_BYTES;
  timings.firstPassCompressionRatio = Number(
    (timings.firstPassModelBytes / Math.max(1, timings.firstPassOriginalBytes)).toFixed(3),
  );
  const cacheKey = imageBuffers.map((b) => b.hash).sort().join("|");
  const cacheKeys = buildTranslationCacheKeys(cacheKey, clientHashSets);
  const results: Array<Record<string, unknown>> = [];
  const failedPages: Array<{ page_index: number; error: string; retry_allowed: boolean }> = [];
  const usedImageIds = new Set<string>();

  for (let batch = 0; batch < imageBuffers.length; batch += FAST_FIRST_PASS_OCR_CONCURRENCY) {
    const batchItems = firstPassImageBuffers.slice(batch, batch + FAST_FIRST_PASS_OCR_CONCURRENCY);
    await Promise.all(
      batchItems.map(async (item, batchIdx) => {
        const i = batch + batchIdx;
        try {
          const task = await import("@/lib/cache/task-store").then((m) => m.getTask(taskId));
          if (!task) return;

          await updateTask(taskId, {
            perPageStatus: task.perPageStatus.map((s, idx) =>
              idx === i ? { ...s, status: "processing" } : s
            ),
          });

          const modelStart = Date.now();
          const raw = await analyzeMenuImageWithEmptyRetry(item, targetLang, taskId, i, startTime, meta);
          const modelMs = Date.now() - modelStart;
          timings.firstPassModelMs = (timings.firstPassModelMs || 0) + modelMs;
          timings.firstPassModelMsByPage = timings.firstPassModelMsByPage || [];
          timings.firstPassModelMsByPage[i] = modelMs;
          if (raw._model) {
            timings.firstPassModelName = raw._model;
            timings.firstPassModelNames = timings.firstPassModelNames || [];
            timings.firstPassModelNames[i] = raw._model;
          }
          const buildStart = Date.now();
          const dishRecords = await buildDishRecords(raw.dishes, raw.page_label, usedImageIds, targetLang, { imageLookup: "local-only" });
          const buildMs = Date.now() - buildStart;
          timings.firstPassBuildMs = (timings.firstPassBuildMs || 0) + buildMs;
          timings.firstPassBuildMsByPage = timings.firstPassBuildMsByPage || [];
          timings.firstPassBuildMsByPage[i] = buildMs;

          results[i] = {
            page_index: i,
            page_label: raw.page_label || "未分类",
            page_type: raw.page_type,
            page_description: raw.page_description,
            source_language: raw.source_language,
            dishes: dishRecords,
            menu_metadata: (raw as unknown as Record<string, unknown>).menu_metadata,
          };
          if (!timings.firstPageMs) {
            timings.firstPageMs = Date.now() - startTime;
            timings.firstPageModelMs = modelMs;
            timings.firstPageBuildMs = buildMs;
          }
          console.info("translate:page_first_pass_finished", {
            taskId,
            pageIndex: i,
            elapsedMs: Date.now() - startTime,
            firstPageMs: timings.firstPageMs,
            firstPageModelMs: timings.firstPageModelMs,
            firstPageBuildMs: timings.firstPageBuildMs,
            modelName: raw._model,
            modelMs,
            buildMs,
            dishCount: dishRecords.length,
            normalizedSize: item.normalizedSize,
            firstPassNormalizedSize: item.normalizedSize,
            fastFirstPass: true,
            ...meta,
          });

          const currentTask = await import("@/lib/cache/task-store").then((m) => m.getTask(taskId));
          if (currentTask) {
            currentTask.perPageStatus[i].status = "done";
            currentTask.progress.current = results.filter(Boolean).length;
            currentTask.result = buildPartialPayload(taskId, results, failedPages, targetLang, startTime, timings);
            await updateTask(taskId, {
              perPageStatus: currentTask.perPageStatus,
              progress: currentTask.progress,
              result: currentTask.result,
            });
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Unknown error";
          console.error("translate:page_failed", {
            taskId,
            pageIndex: i,
            elapsedMs: Date.now() - startTime,
            error: message,
            provider: process.env.MENU_AI_PROVIDER || "auto",
            fastFirstPass: true,
            ...meta,
          });
          failedPages.push({ page_index: i, error: message, retry_allowed: true });
          const currentTask = await import("@/lib/cache/task-store").then((m) => m.getTask(taskId));
          if (currentTask) {
            currentTask.perPageStatus[i].status = "failed";
            currentTask.progress.current = results.filter(Boolean).length + failedPages.length;
            currentTask.result = buildPartialPayload(taskId, results, failedPages, targetLang, startTime, timings);
            await updateTask(taskId, {
              perPageStatus: currentTask.perPageStatus,
              progress: currentTask.progress,
              failedPages,
              result: currentTask.result,
            });
          }
        }
      })
    );
  }

  const status = failedPages.length === imageBuffers.length ? "failed"
    : failedPages.length > 0 ? "partial"
    : "done";
  const sorted = results.filter(Boolean).sort(
    (a, b) => (a as { page_index: number }).page_index - (b as { page_index: number }).page_index
  );
  timings.firstPassMs = Date.now() - startTime;
  const resultPayload = {
    task_id: taskId,
    status,
    pages: sorted,
    failed_pages: failedPages.length > 0 ? failedPages : undefined,
    metadata: {
      source_language: (sorted[0] as { source_language?: string })?.source_language || "unknown",
      target_language: targetLang,
      total_dishes: sorted.reduce(
        (sum, p) => sum + (((p as { dishes?: unknown[] }).dishes)?.length || 0), 0
      ),
      cached: false,
      processing_time_ms: Date.now() - startTime,
      enrichment_status: "pending",
      restaurant: extractRestaurantMeta(sorted),
      insight: extractMenuInsight(sorted),
      signature: extractSignature(sorted),
      timings: {
        ...timings,
        processing_time_ms: Date.now() - startTime,
      },
    },
  };
  resultPayload.metadata.source_language = resolveMenuSourceLanguage(resultPayload);

  await updateTask(taskId, {
    status,
    result: resultPayload,
    failedPages: failedPages.length > 0 ? failedPages : undefined,
    estimatedRemaining: 0,
  });

  console.info("translate:task_first_pass_finished", {
    taskId,
    status,
    elapsedMs: Date.now() - startTime,
    pageCount: sorted.length,
    failedCount: failedPages.length,
    dishCount: resultPayload.metadata.total_dishes,
    provider: process.env.MENU_AI_PROVIDER || "auto",
    ...meta,
  });

  await rememberTranslation(cacheKeys, resultPayload);

  setTimeout(() => {
    enrichResultInBackground(taskId, imageBuffers, resultPayload, targetLang, cacheKeys, startTime, meta, timings).catch((err) => {
      console.error("Background menu enrichment failed:", err);
    });
  }, MENU_ENRICHMENT_DELAY_MS);

}

async function processImages(
  taskId: string,
  rawImageBuffers: RawMenuImageInput[],
  targetLang: string,
  startTime: number,
  clientHashSets: string[][] = [],
  meta?: Record<string, string>,
  timings: TranslationTimings = {},
) {
  const imageBuffers = await normalizeMenuImagesForProcessing(rawImageBuffers, targetLang, timings);
  const cacheKey = imageBuffers.map((b) => b.hash).sort().join("|");
  const cacheKeys = buildTranslationCacheKeys(cacheKey, clientHashSets);
  const results: Array<Record<string, unknown>> = [];
  const failedPages: Array<{ page_index: number; error: string; retry_allowed: boolean }> = [];
  const usedImageIds = new Set<string>();

  for (let batch = 0; batch < imageBuffers.length; batch += OCR_CONCURRENCY) {
    const batchItems = imageBuffers.slice(batch, batch + OCR_CONCURRENCY);
    await Promise.all(
      batchItems.map(async (item, batchIdx) => {
        const i = batch + batchIdx;
        try {
          const task = await import("@/lib/cache/task-store").then((m) => m.getTask(taskId));
          if (!task) return;

          await updateTask(taskId, {
            perPageStatus: task.perPageStatus.map((s, idx) =>
              idx === i ? { ...s, status: "processing" } : s
            ),
          });

          let raw;
          const useRichMode = imageBuffers.length <= FULL_PROMPT_PAGE_LIMIT;
          if (useRichMode) {
            try {
              raw = await analyzeMenuImage(item.base64, true, item.mimeType, targetLang);
            } catch (errRich) {
              // Rich mode may exceed max_tokens for dense menus or produce truncated JSON.
              // Log and fallback to simple mode.
              const richMsg = errRich instanceof Error ? errRich.message : String(errRich);
              const isTruncation = /JSON parse failed|Unexpected token|Expected.*JSON|position \d{4,}/i.test(richMsg);
              console.warn("translate:rich_mode_failed", {
                taskId,
                pageIndex: i,
                reason: isTruncation ? "json_truncated" : "api_error",
                error: richMsg.slice(0, 200),
              });
              raw = await analyzeMenuImage(item.base64, false, item.mimeType, targetLang);
            }
          } else {
            raw = await analyzeMenuImage(item.base64, false, item.mimeType, targetLang);
          }

          const refinedDishes = await refineDishesForTargetLanguage(
            raw.dishes,
            raw.source_language,
            targetLang,
          );

          const dishRecords = await buildDishRecords(refinedDishes, raw.page_label, usedImageIds, targetLang);

          results[i] = {
            page_index: i,
            page_label: raw.page_label || "未分类",
            source_language: raw.source_language,
            dishes: dishRecords,
            menu_metadata: (raw as unknown as Record<string, unknown>).menu_metadata,
          };
          if (!timings.firstPageMs) timings.firstPageMs = Date.now() - startTime;
          console.info("translate:page_first_pass_finished", {
            taskId,
            pageIndex: i,
            elapsedMs: Date.now() - startTime,
            firstPageMs: timings.firstPageMs,
            dishCount: dishRecords.length,
            normalizedSize: item.normalizedSize,
            fastFirstPass: false,
            ...meta,
          });

          const currentTask = await import("@/lib/cache/task-store").then((m) => m.getTask(taskId));
          if (currentTask) {
            currentTask.perPageStatus[i].status = "done";
            currentTask.progress.current = results.filter(Boolean).length;
            // Save partial result so frontend shows available pages immediately
            currentTask.result = buildPartialPayload(taskId, results, failedPages, targetLang, startTime, timings);
            await updateTask(taskId, {
              perPageStatus: currentTask.perPageStatus,
              progress: currentTask.progress,
              result: currentTask.result,
            });
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Unknown error";
          console.error("translate:page_failed", {
            taskId,
            pageIndex: i,
            elapsedMs: Date.now() - startTime,
            error: message,
            provider: process.env.MENU_AI_PROVIDER || "auto",
            ...meta,
          });
          failedPages.push({ page_index: i, error: message, retry_allowed: true });
          const currentTask = await import("@/lib/cache/task-store").then((m) => m.getTask(taskId));
          if (currentTask) {
            currentTask.perPageStatus[i].status = "failed";
            currentTask.progress.current = results.filter(Boolean).length + failedPages.length;
            // Save partial result even when some pages failed
            currentTask.result = buildPartialPayload(taskId, results, failedPages, targetLang, startTime, timings);
            await updateTask(taskId, {
              perPageStatus: currentTask.perPageStatus,
              progress: currentTask.progress,
              failedPages,
              result: currentTask.result,
            });
          }
        }
      })
    );
  }

  const task = await import("@/lib/cache/task-store").then((m) => m.getTask(taskId));
  if (!task) return;

  const status = failedPages.length === imageBuffers.length ? "failed"
    : failedPages.length > 0 ? "partial"
    : "done";

  const sorted = results.filter(Boolean).sort(
    (a, b) => (a as { page_index: number }).page_index - (b as { page_index: number }).page_index
  );
  timings.firstPassMs = Date.now() - startTime;

  const resultPayload = {
    task_id: taskId,
    status,
    pages: sorted,
    failed_pages: failedPages.length > 0 ? failedPages : undefined,
    metadata: {
      source_language: (sorted[0] as { source_language?: string })?.source_language || "unknown",
      target_language: targetLang,
      total_dishes: sorted.reduce(
        (sum, p) => sum + (((p as { dishes?: unknown[] }).dishes)?.length || 0), 0
      ),
      cached: false,
      processing_time_ms: Date.now() - startTime,
      restaurant: extractRestaurantMeta(sorted),
      insight: extractMenuInsight(sorted),
      signature: extractSignature(sorted),
      timings: {
        ...timings,
        processing_time_ms: Date.now() - startTime,
      },
    },
  };
  resultPayload.metadata.source_language = resolveMenuSourceLanguage(resultPayload);

  await updateTask(taskId, {
    status,
    result: resultPayload,
    failedPages: failedPages.length > 0 ? failedPages : undefined,
    estimatedRemaining: 0,
  });
  console.info("translate:task_finished", {
    taskId,
    status,
    elapsedMs: Date.now() - startTime,
    pageCount: sorted.length,
    failedCount: failedPages.length,
    dishCount: resultPayload.metadata.total_dishes,
    provider: process.env.MENU_AI_PROVIDER || "auto",
    ...meta,
  });

  // Store result in memory cache for instant repeat lookups
  await rememberTranslation(cacheKeys, resultPayload);

  // Async image generation — runs in background, updates task when done
  generateImagesInBackground(taskId, resultPayload, cacheKeys).catch((err) => {
    console.error("Background image generation failed:", err);
  });
}

async function enrichResultInBackground(
  taskId: string,
  imageBuffers: MenuImageInput[],
  resultPayload: Record<string, unknown>,
  targetLang: string,
  cacheKeys?: TranslationCacheKeys,
  startTime?: number,
  meta?: Record<string, string>,
  timings: TranslationTimings = {},
) {
  const enrichedPages: Array<Record<string, unknown>> = [];
  const usedImageIds = new Set<string>();

  for (let i = 0; i < imageBuffers.length; i++) {
    const item = imageBuffers[i];
    let raw: MenuAnalysisResult;
    const useRichMode = imageBuffers.length <= FULL_PROMPT_PAGE_LIMIT;
    if (useRichMode) {
      try {
        raw = await analyzeMenuImage(item.base64, true, item.mimeType, targetLang) as MenuAnalysisResult;
      } catch {
        raw = await analyzeMenuImage(item.base64, false, item.mimeType, targetLang) as MenuAnalysisResult;
      }
    } else {
      raw = await analyzeMenuImage(item.base64, false, item.mimeType, targetLang) as MenuAnalysisResult;
    }

    const refinedDishes = await refineDishesForTargetLanguage(
      raw.dishes,
      raw.source_language,
      targetLang,
    );

    enrichedPages[i] = {
      page_index: i,
      page_label: raw.page_label || "未分类",
      page_type: raw.page_type,
      page_description: raw.page_description,
      source_language: raw.source_language,
      dishes: await buildDishRecords(refinedDishes, raw.page_label, usedImageIds, targetLang),
      menu_metadata: (raw as unknown as Record<string, unknown>).menu_metadata,
    };
  }

  const pages = enrichedPages.filter(Boolean).sort(
    (a, b) => (a as { page_index: number }).page_index - (b as { page_index: number }).page_index
  );
  if (startTime) timings.enrichmentMs = Date.now() - startTime;
  const enrichedPayload = {
    ...resultPayload,
    pages,
    metadata: {
      ...((resultPayload.metadata as Record<string, unknown>) || {}),
      source_language: (pages[0] as { source_language?: string })?.source_language || "unknown",
      target_language: targetLang,
      total_dishes: pages.reduce(
        (sum, p) => sum + (((p as { dishes?: unknown[] }).dishes)?.length || 0), 0
      ),
      enrichment_status: "done",
      enrichment_time_ms: startTime ? Date.now() - startTime : undefined,
      restaurant: extractRestaurantMeta(pages),
      insight: extractMenuInsight(pages),
      signature: extractSignature(pages),
      timings: {
        ...timings,
        processing_time_ms: startTime ? Date.now() - startTime : undefined,
      },
    },
  };
  (enrichedPayload.metadata as Record<string, unknown>).source_language = resolveMenuSourceLanguage(enrichedPayload);
  const currentTaskBeforeEnrichment = await import("@/lib/cache/task-store").then((m) => m.getTask(taskId));
  mergeGeneratedDishImagesFromExistingResult(enrichedPayload, currentTaskBeforeEnrichment?.result as Record<string, unknown> | undefined);

  await updateTask(taskId, { result: enrichedPayload });
  await rememberTranslation(cacheKeys, enrichedPayload);
  console.info("translate:task_enriched", {
    taskId,
    elapsedMs: startTime ? Date.now() - startTime : undefined,
    pageCount: pages.length,
    dishCount: (enrichedPayload.metadata as { total_dishes?: number }).total_dishes,
    provider: process.env.MENU_AI_PROVIDER || "auto",
    ...meta,
  });

  generateImagesInBackground(taskId, enrichedPayload, cacheKeys).catch((err) => {
    console.error("Background enriched image generation failed:", err);
  });
}

function refreshCachedResultInBackground({
  taskId,
  rawImageBuffers,
  cachedResult,
  targetLang,
  clientHashSets,
  startTime,
  meta,
  timings,
}: {
  taskId: string;
  rawImageBuffers: RawMenuImageInput[];
  cachedResult: Record<string, unknown>;
  targetLang: string;
  clientHashSets: string[][];
  startTime: number;
  meta: Record<string, string>;
  timings: TranslationTimings;
}) {
  const metadata = ((cachedResult.metadata as Record<string, unknown>) || {});
  const needsImageRefresh = resultNeedsImageRefresh(cachedResult);
  const needsAdviceRefresh = resultNeedsDishAdviceRefresh(cachedResult);

  if (needsImageRefresh) {
    metadata.image_generation_status = "processing";
    cachedResult.metadata = metadata;
    const clientCacheKeys = buildClientTranslationCacheKeys(clientHashSets);
    generateImagesInBackground(taskId, cachedResult, clientCacheKeys).catch((err) => {
      console.error("Background cached image refresh failed:", err);
    });
  }

  if (needsAdviceRefresh) {
    metadata.enrichment_status = "pending";
    cachedResult.metadata = metadata;
    normalizeMenuImagesForProcessing(rawImageBuffers, targetLang, timings)
      .then((imageBuffers) => {
        const cacheKey = imageBuffers.map((b) => b.hash).sort().join("|");
        const cacheKeys = buildTranslationCacheKeys(cacheKey, clientHashSets);
        return enrichResultInBackground(taskId, imageBuffers, cachedResult, targetLang, cacheKeys, startTime, meta, timings);
      })
      .catch((err) => {
      console.error("Background cached menu enrichment failed:", err);
      });
  }
}

function prioritizeImageGenerationDishes(
  dishes: Dish[],
  generationOrder: Map<Dish, number>,
): Dish[] {
  const orderForDish = (dish: Dish) => generationOrder.get(dish) ?? Number.MAX_SAFE_INTEGER;
  const isAboveFoldOrder = (order: number) => order < ABOVE_FOLD_IMAGE_GENERATION_LIMIT;
  return [...dishes].sort((a, b) => {
    const orderA = orderForDish(a);
    const orderB = orderForDish(b);
    const aboveFoldA = isAboveFoldOrder(orderA) ? 0 : 1;
    const aboveFoldB = isAboveFoldOrder(orderB) ? 0 : 1;
    if (aboveFoldA !== aboveFoldB) return aboveFoldA - aboveFoldB;
    return orderA - orderB;
  });
}

async function generateImagesInBackground(
  taskId: string,
  resultPayload: Record<string, unknown>,
  cacheKeys?: TranslationCacheKeys,
) {
  if (activeImageGenerationTasks.has(taskId)) {
    pendingImageGenerationPayloads.set(taskId, { resultPayload, cacheKeys });
    return;
  }
  activeImageGenerationTasks.add(taskId);

  try {
  const pages = (resultPayload as { pages: Array<{ dishes: Dish[] }> }).pages;
  const allDishes: Dish[] = pages.flatMap((p) => p.dishes || []);

  // Generate AI images only for dishes that have NO image at all
  // (neither local knowledge DB nor Supabase cached AI image)
  const generationOrder = new Map<Dish, number>();
  const generationKeyByDish = new Map<Dish, string>();
  const generationGroups = new Map<string, Dish[]>();
  const dishesForGeneration = allDishes
    .map((dish, order) => ({ dish, order }))
    .filter(({ dish }) => !dish.ai_image_url && !dish.image_url && dish.image_status !== "deferred")
    .map(({ dish, order }) => {
      generationOrder.set(dish, order);
      dish.image_status = "pending";
      const translatedName = typeof dish.name_translated === "string"
        ? dish.name_translated
        : (dish.name_translated as Record<string, string> | undefined)?.zh || "";
      const generationKey = canonicalDishNameKey(dish.name_original)
        || canonicalDishNameKey(translatedName)
        || dish.id
        || `${dish.name_original}-${order}`;
      generationKeyByDish.set(dish, generationKey);
      const duplicateDishes = generationGroups.get(generationKey) || [];
      duplicateDishes.push(dish);
      generationGroups.set(generationKey, duplicateDishes);
      return dish;
    });
  const representativeDishesForGeneration = prioritizeImageGenerationDishes(
    Array.from(generationGroups.values()).map((group) => group[0]),
    generationOrder,
  );
  const imageGenerationLimit = imageGenerationLimitForDishCount(allDishes.length);
  const activeDishesForGeneration = representativeDishesForGeneration.slice(0, imageGenerationLimit);
  const deferredDishesForGeneration = representativeDishesForGeneration.slice(imageGenerationLimit);

  if (dishesForGeneration.length === 0) return;

  for (const deferredDish of deferredDishesForGeneration) {
    const generationKey = generationKeyByDish.get(deferredDish) || "";
    const duplicateDishes = generationGroups.get(generationKey) || [deferredDish];
    for (const duplicateDish of duplicateDishes) {
      duplicateDish.image_status = "deferred";
    }
  }

  const failures: ImageGenerationFailure[] = [];
  let completed = 0;
  const activeGenerationKeys = new Set(
    activeDishesForGeneration.map((dish) => generationKeyByDish.get(dish) || ""),
  );
  const activeDishesForGenerationTotal = dishesForGeneration.filter((dish) => {
    const generationKey = generationKeyByDish.get(dish) || "";
    return activeGenerationKeys.has(generationKey);
  }).length;

  const updateImageGenerationTask = async (status: "processing" | "done" | "partial" | "failed") => {
    const metadata = ((resultPayload.metadata as Record<string, unknown>) || {});
    metadata.image_generation_status = status;
    metadata.image_generation_progress = {
      current: completed,
      total: activeDishesForGenerationTotal,
    };
      if (failures.length > 0) metadata.image_generation_failed = failures;
      else delete metadata.image_generation_failed;
      metadata.image_generation_deduped_count = dishesForGeneration.length - representativeDishesForGeneration.length;
      metadata.image_generation_queue_total = activeDishesForGeneration.length;
      metadata.image_generation_batch_limit = imageGenerationLimit;
      metadata.image_generation_deferred_total = deferredDishesForGeneration.length;
      metadata.image_generation_active_total = Math.min(IMAGE_GENERATION_CONCURRENCY, activeDishesForGeneration.length);
      metadata.image_generation_queued_total = Math.max(0, activeDishesForGeneration.length - IMAGE_GENERATION_CONCURRENCY);
      resultPayload.metadata = metadata;

    const currentTask = await import("@/lib/cache/task-store").then((m) => m.getTask(taskId));
    const latestPayload = currentTask?.result
      ? mergeImageGenerationStateIntoCurrentResult(currentTask.result as Record<string, unknown>, resultPayload)
      : resultPayload;
    if (currentTask?.result) {
      await updateTask(taskId, { result: latestPayload });
    }
    await rememberTranslation(cacheKeys, latestPayload);
  };

  await updateImageGenerationTask("processing");

  await generateImagesForDishes(
    activeDishesForGeneration,
    async (index, tempUrl) => {
      const dish = activeDishesForGeneration[index];
      const generationKey = generationKeyByDish.get(dish) || "";
      const duplicateDishes = generationGroups.get(generationKey) || [dish];

      const storageId = storageIdForGeneratedDishImage(dish);
      const publicUrl = await uploadDishImage(storageId, tempUrl);
      if (!isRuntimeDisplayableGeneratedDishImageUrl(publicUrl)) {
        throw new Error("Generated image URL could not be saved to a displayable cache");
      }
      const finalUrl = publicUrl;

      const persistableImageUrl = isPersistableGeneratedDishImageUrl(finalUrl) ? finalUrl : null;
      if (persistableImageUrl) {
        const client = getSupabaseAdminClient() || supabase;
        for (const duplicateDish of duplicateDishes) {
          const isNewDish = !duplicateDish.id || duplicateDish.id.startsWith("temp-");
          const translated = typeof duplicateDish.name_translated === "string"
            ? duplicateDish.name_translated
            : (duplicateDish.name_translated as Record<string, string>)?.zh || "";
          const dishRow = {
            name_original: duplicateDish.name_original,
            name_translated: translated,
            ai_image_url: persistableImageUrl,
            image_source: "ai",
          };

          if (isNewDish) {
            const { data: inserted } = await client
              .from("dishes")
              .insert(dishRow)
              .select("id")
              .single()
              .then((r) => r, () => ({ data: null }));
            if (inserted?.id) duplicateDish.id = inserted.id;
          } else {
            await client
              .from("dishes")
              .update({ ai_image_url: persistableImageUrl, image_source: "ai" })
              .eq("id", duplicateDish.id)
              .then(() => {}, () => {});
          }
        }
      }

      // Update in-memory task result so frontend polling picks it up
      for (const duplicateDish of duplicateDishes) {
        duplicateDish.ai_image_url = finalUrl;
        (duplicateDish as unknown as Record<string, unknown>).image_url = finalUrl;
        duplicateDish.image_status = "done";
        delete duplicateDish.image_error;
      }
      completed += duplicateDishes.length;

      await updateImageGenerationTask("processing");
      console.info("translate:image_generated", {
        taskId,
        dishId: dish.id,
        order: generationOrder.get(dish),
        completed,
        total: dishesForGeneration.length,
        deduped: duplicateDishes.length - 1,
        name: dish.name_original,
      });
    },
    IMAGE_GENERATION_CONCURRENCY,
    async (index, error) => {
      const dish = activeDishesForGeneration[index];
      const generationKey = generationKeyByDish.get(dish) || "";
      const duplicateDishes = generationGroups.get(generationKey) || [dish];
      for (const duplicateDish of duplicateDishes) {
        duplicateDish.image_status = "failed";
        duplicateDish.image_error = error;
        failures.push({
          dish_id: duplicateDish.id,
          name_original: duplicateDish.name_original,
          error,
        });
      }
      completed += duplicateDishes.length;
      console.error("translate:image_generation_failed", {
        taskId,
        dishId: dish.id,
        order: generationOrder.get(dish),
        completed,
        total: dishesForGeneration.length,
        name: dish.name_original,
        error,
      });
      await updateImageGenerationTask("processing");
    },
  );

  const hasDeferredImageGeneration = deferredDishesForGeneration.length > 0;
  const finalStatus = failures.length === 0
    ? (hasDeferredImageGeneration ? "partial" : "done")
    : failures.length === activeDishesForGenerationTotal ? "failed" : "partial";
  await updateImageGenerationTask(finalStatus);

  // Update translation cache with generated images so repeat uploads are instant
  if (dishesForGeneration.some((d) => d.ai_image_url)) {
    await rememberTranslation(cacheKeys, resultPayload);
  }
  } finally {
    activeImageGenerationTasks.delete(taskId);
    const pending = pendingImageGenerationPayloads.get(taskId);
    pendingImageGenerationPayloads.delete(taskId);
    if (pending && pending.resultPayload !== resultPayload) {
      setTimeout(() => {
        generateImagesInBackground(taskId, pending.resultPayload, pending.cacheKeys).catch((err) => {
          console.error("Background queued image generation failed:", err);
        });
      }, 0);
    }
  }
}
