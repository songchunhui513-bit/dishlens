import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { analyzeMenuImage, analyzeMenuImageFast, refineTranslation, hasChinese } from "@/lib/ai";
import type { Dish } from "@/types";
import { getSupabaseAdminClient, supabase } from "@/lib/db/supabase";
import { createTask, updateTask } from "@/lib/cache/task-store";
import { getCachedTranslationResult, setCachedTranslationResult } from "@/lib/cache/translation-file-cache";
import { generateImagesForDishes } from "@/lib/ai/image-gen";
import { getCachedDishImageUrl, uploadDishImage } from "@/lib/storage/supabase-storage";
import { matchDishKnowledgeImage } from "@/lib/dish-image-match";
import { MAX_MENU_IMAGES, normalizeImageMimeType } from "@/lib/image-input";
import { normalizeTargetLang } from "@/lib/languages";
import { normalizeServerMenuImage } from "@/lib/server-image-normalization";
import { storageIdForGeneratedDishImage } from "@/lib/dish-image-persistence";
import { dishNameLookupCandidates } from "@/lib/dish-name-normalization";
import { isReusableExistingImageUrl } from "@/lib/dish-image-url";
import { extractRestaurantMeta, extractMenuInsight, extractSignature } from "@/lib/results-insight-fallback";
import { resolveMenuSourceLanguage } from "@/lib/menu-source-language";
import { sanitizeTranslationResultImages } from "@/lib/server/sanitize-translation-result";

// In-memory translation cache — avoids Supabase schema/RLS issues for anonymous users
const translationCache = new Map<string, { result: Record<string, unknown>; createdAt: number }>();
const CACHE_MAX = 50;
const CACHE_TTL = 30 * 60 * 1000; // 30 min

async function rememberTranslation(cacheKey: string | undefined, result: Record<string, unknown>): Promise<void> {
  if (!cacheKey) return;
  translationCache.set(cacheKey, { result, createdAt: Date.now() });
  await setCachedTranslationResult(cacheKey, result);
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

export const maxDuration = 60;

const OCR_CONCURRENCY = Math.max(
  1,
  Math.min(2, Number.parseInt(process.env.MENU_OCR_CONCURRENCY || "1", 10) || 1),
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
const IMAGE_GENERATION_CONCURRENCY = Math.max(
  1,
  Math.min(3, Number.parseInt(process.env.MENU_IMAGE_GENERATION_CONCURRENCY || "2", 10) || 2),
);

type ImageGenerationFailure = {
  dish_id: string;
  name_original: string;
  error: string;
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
  normalizationMs?: number;
  intakeMs?: number;
  firstPageMs?: number;
  firstPassMs?: number;
  enrichmentMs?: number;
};

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
  const client = getSupabaseAdminClient() || supabase;
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

  const { data: originalRows } = await client
    .from("dishes")
    .select("id, name_original, name_translated, ai_image_url, image_source")
    .in("name_original", candidates)
    .limit(200)
    .then((r) => r, () => ({ data: null }));

  const { data: translatedRows } = await client
    .from("dishes")
    .select("id, name_original, name_translated, ai_image_url, image_source")
    .in("name_translated", candidates)
    .limit(200)
    .then((r) => r, () => ({ data: null }));

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
        const cachedGeneratedImageUrl = localMatch || imageLookup !== "full"
          ? null
          : await getCachedDishImageUrl(storageIdForGeneratedDishImage(dish));
        const imageUrl = localMatch?.card || cachedGeneratedImageUrl || existingImageUrl || null;

        return {
          ...dish,
          id: existing?.id || `temp-${crypto.randomUUID()}`,
          name_translated: { [targetLang]: dish.name_translated },
          description: { [targetLang]: dish.description || "" },
          ai_image_url: imageUrl,
          image_url: imageUrl,
          image_status: imageUrl ? "done" : "pending",
          image_source: localMatch ? "mixed" : (existing?.image_source || "ai"),
        } as Dish;
      } catch {
        const imageUrl = localMatch?.card || null;
        return {
          ...dish,
          id: `temp-${crypto.randomUUID()}`,
          name_translated: { [targetLang]: dish.name_translated },
          description: { [targetLang]: dish.description || "" },
          ai_image_url: imageUrl,
          image_url: imageUrl,
          image_status: imageUrl ? "done" : "pending",
          image_source: localMatch ? "mixed" : "ai",
        } as Dish;
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

    // Read ALL file data into memory BEFORE returning response
    const normalizationStart = Date.now();
    const imageBuffers = await Promise.all(
      images.map(async (file) => {
        const originalBuffer = Buffer.from(await file.arrayBuffer());
        const mimeType = normalizeImageMimeType(file.type, file.name);
        const normalized = await normalizeServerMenuImage({
          buffer: originalBuffer,
          mimeType,
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
    timings.intakeMs = Date.now() - startTime;
    console.info("translate:task_intake_ready", {
      taskId,
      elapsedMs: timings.intakeMs,
      formDataMs: timings.formDataMs,
      taskCreateMs: timings.taskCreateMs,
      normalizationMs: timings.normalizationMs,
      originalBytes: images.reduce((sum, image) => sum + image.size, 0),
      normalizedBytes: imageBuffers.reduce((sum, image) => sum + image.normalizedSize, 0),
      imageCount: images.length,
      targetLang,
      ...meta,
    });

    // Build stable cache key from normalized image content so repeated uploads hit reliably.
    const cacheKey = imageBuffers.map((b) => b.hash).sort().join("|");

    // Check fast in-memory cache first, then the filesystem cache that survives restarts.
    const memoryCached = translationCache.get(cacheKey);
    const cached = memoryCached && Date.now() - memoryCached.createdAt < CACHE_TTL
      ? memoryCached
      : await getCachedTranslationResult(cacheKey);
    if (cached) {
      if (cached !== memoryCached) translationCache.set(cacheKey, cached);
      const cachedResult = sanitizeTranslationResultImages({
        ...cached.result,
        task_id: taskId,
        status: "done",
        metadata: {
          ...(cached.result.metadata as Record<string, unknown>),
          cached: true,
          timings: {
            ...(((cached.result.metadata as Record<string, unknown>)?.timings as Record<string, unknown>) || {}),
            ...timings,
          },
        },
      });
      await updateTask(taskId, {
        status: "done",
        progress: { current: images.length, total: images.length },
        perPageStatus: images.map((_, i) => ({ page_index: i, status: "done" })),
        result: cachedResult,
        estimatedRemaining: 0,
      });
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
    processor(taskId, imageBuffers, targetLang, startTime, cacheKey, meta, timings).catch(async (err) => {
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
          failedPages: imageBuffers.map((_, i) => ({
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

async function processImagesFastFirstPass(
  taskId: string,
  imageBuffers: MenuImageInput[],
  targetLang: string,
  startTime: number,
  cacheKey?: string,
  meta?: Record<string, string>,
  timings: TranslationTimings = {},
) {
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

          const raw = await analyzeMenuImageFast(item.base64, false, item.mimeType, targetLang) as MenuAnalysisResult;
          const dishRecords = await buildDishRecords(raw.dishes, raw.page_label, usedImageIds, targetLang, { imageLookup: "local-only" });

          results[i] = {
            page_index: i,
            page_label: raw.page_label || "未分类",
            page_type: raw.page_type,
            page_description: raw.page_description,
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

  await rememberTranslation(cacheKey, resultPayload);

  setTimeout(() => {
    enrichResultInBackground(taskId, imageBuffers, resultPayload, targetLang, cacheKey, startTime, meta, timings).catch((err) => {
      console.error("Background menu enrichment failed:", err);
    });
  }, MENU_ENRICHMENT_DELAY_MS);

}

async function processImages(
  taskId: string,
  imageBuffers: MenuImageInput[],
  targetLang: string,
  startTime: number,
  cacheKey?: string,
  meta?: Record<string, string>,
  timings: TranslationTimings = {},
) {
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
  await rememberTranslation(cacheKey, resultPayload);

  // Async image generation — runs in background, updates task when done
  generateImagesInBackground(taskId, resultPayload, cacheKey).catch((err) => {
    console.error("Background image generation failed:", err);
  });
}

async function enrichResultInBackground(
  taskId: string,
  imageBuffers: MenuImageInput[],
  resultPayload: Record<string, unknown>,
  targetLang: string,
  cacheKey?: string,
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

  await updateTask(taskId, { result: enrichedPayload });
  await rememberTranslation(cacheKey, enrichedPayload);
  console.info("translate:task_enriched", {
    taskId,
    elapsedMs: startTime ? Date.now() - startTime : undefined,
    pageCount: pages.length,
    dishCount: (enrichedPayload.metadata as { total_dishes?: number }).total_dishes,
    provider: process.env.MENU_AI_PROVIDER || "auto",
    ...meta,
  });

  generateImagesInBackground(taskId, enrichedPayload, cacheKey).catch((err) => {
    console.error("Background enriched image generation failed:", err);
  });
}

async function generateImagesInBackground(
  taskId: string,
  resultPayload: Record<string, unknown>,
  cacheKey?: string,
) {
  const pages = (resultPayload as { pages: Array<{ dishes: Dish[] }> }).pages;
  const allDishes: Dish[] = pages.flatMap((p) => p.dishes || []);

  // Generate AI images only for dishes that have NO image at all
  // (neither local knowledge DB nor Supabase cached AI image)
  const generationOrder = new Map<Dish, number>();
  const dishesForGeneration = allDishes
    .map((dish, order) => ({ dish, order }))
    .filter(({ dish }) => !dish.ai_image_url)
    .map(({ dish, order }) => {
      generationOrder.set(dish, order);
      dish.image_status = "pending";
      return dish;
    });

  if (dishesForGeneration.length === 0) return;

  const failures: ImageGenerationFailure[] = [];
  let completed = 0;

  const updateImageGenerationTask = async (status: "processing" | "done" | "partial" | "failed") => {
    const metadata = ((resultPayload.metadata as Record<string, unknown>) || {});
    metadata.image_generation_status = status;
    metadata.image_generation_progress = {
      current: completed,
      total: dishesForGeneration.length,
    };
    if (failures.length > 0) metadata.image_generation_failed = failures;
    else delete metadata.image_generation_failed;
    resultPayload.metadata = metadata;

    const currentTask = await import("@/lib/cache/task-store").then((m) => m.getTask(taskId));
    if (currentTask?.result) {
      await updateTask(taskId, { result: resultPayload });
    }
    await rememberTranslation(cacheKey, resultPayload);
  };

  await updateImageGenerationTask("processing");

  await generateImagesForDishes(
    dishesForGeneration,
    async (index, tempUrl) => {
      const dish = dishesForGeneration[index];
      const isNewDish = !dish.id || dish.id.startsWith("temp-");

      const storageId = storageIdForGeneratedDishImage(dish);
      const publicUrl = await uploadDishImage(storageId, tempUrl);
      if (!publicUrl) {
        throw new Error("Generated image URL could not be downloaded or stored");
      }
      const finalUrl = publicUrl;

      // Persist image: upsert into dishes table so next translation reuses it
      const translated = typeof dish.name_translated === "string"
        ? dish.name_translated
        : (dish.name_translated as Record<string, string>)?.zh || "";
      const dishRow = {
        name_original: dish.name_original,
        name_translated: translated,
        ai_image_url: finalUrl,
        image_source: "ai",
      };

      if (isNewDish) {
        // Insert new dish row with generated image
        const client = getSupabaseAdminClient() || supabase;
        const { data: inserted } = await client
          .from("dishes")
          .insert(dishRow)
          .select("id")
          .single()
          .then((r) => r, () => ({ data: null }));
        if (inserted?.id) dish.id = inserted.id;
      } else {
        // Update existing dish row
        const client = getSupabaseAdminClient() || supabase;
        await client
          .from("dishes")
          .update({ ai_image_url: finalUrl, image_source: "ai" })
          .eq("id", dish.id)
          .then(() => {}, () => {});
      }

      // Update in-memory task result so frontend polling picks it up
      dish.ai_image_url = finalUrl;
      (dish as unknown as Record<string, unknown>).image_url = finalUrl;
      dish.image_status = "done";
      delete dish.image_error;
      completed++;

      await updateImageGenerationTask("processing");
      console.info("translate:image_generated", {
        taskId,
        dishId: dish.id,
        order: generationOrder.get(dish),
        completed,
        total: dishesForGeneration.length,
        name: dish.name_original,
      });
    },
    IMAGE_GENERATION_CONCURRENCY,
    async (index, error) => {
      const dish = dishesForGeneration[index];
      dish.image_status = "failed";
      dish.image_error = error;
      completed++;
      failures.push({
        dish_id: dish.id,
        name_original: dish.name_original,
        error,
      });
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

  const finalStatus = failures.length === 0
    ? "done"
    : failures.length === dishesForGeneration.length ? "failed" : "partial";
  await updateImageGenerationTask(finalStatus);

  // Update translation cache with generated images so repeat uploads are instant
  if (dishesForGeneration.some((d) => d.ai_image_url)) {
    await rememberTranslation(cacheKey, resultPayload);
  }
}
