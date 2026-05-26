import { NextRequest, NextResponse } from "next/server";
import { analyzeMenuImage, refineTranslation, hasChinese } from "@/lib/ai";
import type { Dish } from "@/types";
import { getSupabaseAdminClient, supabase } from "@/lib/db/supabase";
import { createTask, updateTask } from "@/lib/cache/task-store";
import { generateImagesForDishes } from "@/lib/ai/image-gen";
import { getCachedDishImageUrl, uploadDishImage } from "@/lib/storage/supabase-storage";
import { matchDishKnowledgeImage } from "@/lib/dish-image-match";
import { MAX_MENU_IMAGES, normalizeImageMimeType } from "@/lib/image-input";
import { storageIdForGeneratedDishImage } from "@/lib/dish-image-persistence";
import { dishNameLookupCandidates } from "@/lib/dish-name-normalization";

// In-memory translation cache — avoids Supabase schema/RLS issues for anonymous users
const translationCache = new Map<string, { result: Record<string, unknown>; createdAt: number }>();
const CACHE_MAX = 50;
const CACHE_TTL = 30 * 60 * 1000; // 30 min

function hashImageName(name: string, size: number): string {
  // Lightweight cache key: filename + size is stable across re-encodes
  let h = 0;
  const key = `${name}:${size}`;
  for (let i = 0; i < key.length; i++) h = (Math.imul(31, h) + key.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
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
const BACKGROUND_IMAGE_LIMIT = Number.parseInt(process.env.MENU_IMAGE_GENERATION_LIMIT || "16", 10) || 16;
const IMAGE_GENERATION_CONCURRENCY = Math.max(
  1,
  Math.min(3, Number.parseInt(process.env.MENU_IMAGE_GENERATION_CONCURRENCY || "2", 10) || 2),
);

type MenuImageInput = {
  base64: string;
  mimeType: string;
  name: string;
  size: number;
};

type ExistingDishImage = {
  id: string;
  name_original: string;
  ai_image_url?: string | null;
  image_source?: string | null;
};

function isReusableExistingImageUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  if (/images\.unsplash\.com|image\.pollinations\.ai|aliyuncs\.com/i.test(url)) return false;
  return true;
}

async function findExistingDishImages(
  dishes: Array<{ name_original: string }>,
): Promise<Map<number, ExistingDishImage>> {
  const client = getSupabaseAdminClient() || supabase;
  const candidateToIndices = new Map<string, number[]>();

  dishes.forEach((dish, index) => {
    for (const candidate of dishNameLookupCandidates(dish.name_original)) {
      const bucket = candidateToIndices.get(candidate) || [];
      bucket.push(index);
      candidateToIndices.set(candidate, bucket);
    }
  });

  const candidates = Array.from(candidateToIndices.keys());
  if (candidates.length === 0) return new Map();

  const { data } = await client
    .from("dishes")
    .select("id, name_original, ai_image_url, image_source")
    .in("name_original", candidates)
    .limit(200)
    .then((r) => r, () => ({ data: null }));

  const results = new Map<number, ExistingDishImage>();
  for (const row of (data || []) as ExistingDishImage[]) {
    const indices = candidateToIndices.get(row.name_original) || [];
    for (const index of indices) {
      if (!results.has(index)) results.set(index, row);
    }
  }

  return results;
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data") && !contentType.includes("application/x-www-form-urlencoded")) {
      return NextResponse.json(
        { error: "Request must be multipart/form-data" },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const images = formData
      .getAll("images")
      .filter((item): item is File => item instanceof File && item.size > 0);
    const targetLang = (formData.get("target_lang") as string) || "zh";

    if (!images || images.length === 0) {
      return NextResponse.json({ error: "No images provided" }, { status: 400 });
    }

    if (images.length > MAX_MENU_IMAGES) {
      return NextResponse.json({ error: `Max ${MAX_MENU_IMAGES} images` }, { status: 400 });
    }

    const taskId = crypto.randomUUID();
    await createTask(taskId, images.length);

    // Read ALL file data into memory BEFORE returning response
    const imageBuffers = await Promise.all(
      images.map(async (file) => ({
        base64: Buffer.from(await file.arrayBuffer()).toString("base64"),
        mimeType: normalizeImageMimeType(file.type, file.name),
        name: file.name || "menu-photo",
        size: file.size,
      }))
    );

    // Build stable cache key from filenames + sizes (survives re-encoding)
    const cacheKey = imageBuffers.map((b) => hashImageName(b.name, b.size)).sort().join("|");

    // Check in-memory cache
    const cached = translationCache.get(cacheKey);
    if (cached && Date.now() - cached.createdAt < CACHE_TTL) {
      const cachedResult = { ...cached.result, metadata: { ...(cached.result.metadata as Record<string, unknown>), cached: true } };
      await updateTask(taskId, { status: "done", result: cachedResult });
      return NextResponse.json({ task_id: taskId, status: "processing", cached: true }, { status: 202 });
    }

    // Evict expired entries
    if (translationCache.size >= CACHE_MAX) {
      for (const [k, v] of translationCache) {
        if (Date.now() - v.createdAt >= CACHE_TTL) translationCache.delete(k);
      }
    }

    // Fire background processing — buffers are in memory, safe to use after response
    processImages(taskId, imageBuffers, targetLang, startTime, cacheKey).catch(async (err) => {
      console.error("Background processing failed:", err);
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

async function processImages(
  taskId: string,
  imageBuffers: MenuImageInput[],
  targetLang: string,
  startTime: number,
  cacheKey?: string
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
              raw = await analyzeMenuImage(item.base64, true, item.mimeType);
            } catch {
              // Rich mode may exceed max_tokens for dense menus, fallback to simple.
              raw = await analyzeMenuImage(item.base64, false, item.mimeType);
            }
          } else {
            raw = await analyzeMenuImage(item.base64, false, item.mimeType);
          }

          const shouldRefine = raw.dishes.length <= 10;
          const refinedDishes = shouldRefine
            ? await Promise.all(
                raw.dishes.map(
                  async (dish: {
                    confidence: number;
                    name_original: string;
                    name_translated: string;
                    description: string;
                    _needsRetranslate?: boolean;
                  }) => {
                    const needsRefine =
                      dish._needsRetranslate ||
                      !hasChinese(dish.name_translated || "") ||
                      (REFINE_LOW_CONFIDENCE && dish.confidence < 0.5);
                    if (!needsRefine) return dish;
                    try {
                      const refined = await refineTranslation({
                        name_original: dish.name_original,
                        name_translated: dish.name_translated,
                        description: dish.description,
                        source_language: raw.source_language,
                      });
                      return { ...dish, ...refined };
                    } catch {
                      return dish;
                    }
                  }
                )
              )
            : raw.dishes;

          // Pre-match local images with dedup — same knowledge DB image used only once per menu.
          const localMatches = new Map<number, { card: string; hero: string; id: string } | null>();
          for (let di = 0; di < refinedDishes.length; di++) {
            const dish = refinedDishes[di];
            const match = matchDishKnowledgeImage({ ...dish, page_label: raw.page_label });
            if (match && !usedImageIds.has(match.id)) {
              usedImageIds.add(match.id);
              localMatches.set(di, match);
            } else {
              localMatches.set(di, null);
            }
          }

          const existingImagesByIndex = await findExistingDishImages(refinedDishes);

          const dishRecords = await Promise.all(
            refinedDishes.map(async (dish: {
              name_original: string;
              name_translated?: string | Record<string, string>;
              description?: string | Record<string, string>;
              ingredients?: string[];
              category?: string;
            }, di: number) => {
              const localMatch = localMatches.get(di);
              try {
                const existing = existingImagesByIndex.get(di) || null;
                const existingImageUrl = isReusableExistingImageUrl(existing?.ai_image_url)
                  ? existing.ai_image_url
                  : null;
                const cachedGeneratedImageUrl = localMatch
                  ? null
                  : await getCachedDishImageUrl(storageIdForGeneratedDishImage(dish));
                // Priority: local knowledge DB > deterministic generated-image cache > DB cached AI image > null
                const imageUrl = localMatch?.card || cachedGeneratedImageUrl || existingImageUrl || null;

                return {
                  ...dish,
                  id: existing?.id || `temp-${crypto.randomUUID()}`,
                  ai_image_url: imageUrl,
                  image_url: imageUrl,
                  image_source: localMatch ? "mixed" : (existing?.image_source || "ai"),
                };
              } catch {
                const imageUrl = localMatch?.card || null;
                return {
                  ...dish,
                  id: `temp-${crypto.randomUUID()}`,
                  ai_image_url: imageUrl,
                  image_url: imageUrl,
                  image_source: localMatch ? "mixed" : "ai",
                };
              }
            })
          );

          results[i] = {
            page_index: i,
            page_label: raw.page_label || "未分类",
            source_language: raw.source_language,
            dishes: dishRecords,
          };

          const currentTask = await import("@/lib/cache/task-store").then((m) => m.getTask(taskId));
          if (currentTask) {
            currentTask.perPageStatus[i].status = "done";
            currentTask.progress.current = results.filter(Boolean).length;
            await updateTask(taskId, {
              perPageStatus: currentTask.perPageStatus,
              progress: currentTask.progress,
            });
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Unknown error";
          failedPages.push({ page_index: i, error: message, retry_allowed: true });
          const currentTask = await import("@/lib/cache/task-store").then((m) => m.getTask(taskId));
          if (currentTask) {
            currentTask.perPageStatus[i].status = "failed";
            currentTask.progress.current = results.filter(Boolean).length + failedPages.length;
            await updateTask(taskId, {
              perPageStatus: currentTask.perPageStatus,
              progress: currentTask.progress,
              failedPages,
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

  const resultPayload = {
    task_id: taskId,
    status,
    pages: sorted,
    failed_pages: failedPages.length > 0 ? failedPages : undefined,
    metadata: {
      source_language: (sorted[0] as { source_language?: string })?.source_language || "unknown",
      total_dishes: sorted.reduce(
        (sum, p) => sum + (((p as { dishes?: unknown[] }).dishes)?.length || 0), 0
      ),
      cached: false,
      processing_time_ms: Date.now() - startTime,
    },
  };

  await updateTask(taskId, {
    status,
    result: resultPayload,
    failedPages: failedPages.length > 0 ? failedPages : undefined,
    estimatedRemaining: 0,
  });

  // Store result in memory cache for instant repeat lookups
  if (cacheKey) {
    translationCache.set(cacheKey, { result: resultPayload, createdAt: Date.now() });
  }

  // Async image generation — runs in background, updates task when done
  generateImagesInBackground(taskId, resultPayload, cacheKey).catch((err) => {
    console.error("Background image generation failed:", err);
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
  const dishesForGeneration = allDishes
    .filter((dish) => !dish.ai_image_url)
    .slice(0, Math.max(0, BACKGROUND_IMAGE_LIMIT));

  if (dishesForGeneration.length === 0) return;

  await generateImagesForDishes(
    dishesForGeneration,
    async (index, tempUrl) => {
      const dish = dishesForGeneration[index];
      const isNewDish = !dish.id || dish.id.startsWith("temp-");

      const storageId = storageIdForGeneratedDishImage(dish);
      const publicUrl = await uploadDishImage(storageId, tempUrl);
      const finalUrl = publicUrl || tempUrl;

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

      const currentTask = await import("@/lib/cache/task-store").then((m) => m.getTask(taskId));
      if (currentTask?.result) {
        await updateTask(taskId, { result: resultPayload });
      }
    },
    IMAGE_GENERATION_CONCURRENCY,
  );

  // Update translation cache with generated images so repeat uploads are instant
  if (cacheKey && dishesForGeneration.some((d) => d.ai_image_url)) {
    translationCache.set(cacheKey, { result: resultPayload, createdAt: Date.now() });
  }
}
