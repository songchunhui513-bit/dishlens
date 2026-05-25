import { NextRequest, NextResponse } from "next/server";
import { analyzeMenuImage, refineTranslation, hasChinese } from "@/lib/ai";
import type { Dish } from "@/types";
import { supabase } from "@/lib/db/supabase";
import { createTask, updateTask } from "@/lib/cache/task-store";
import { generateImagesForDishes } from "@/lib/ai/image-gen";
import { uploadDishImage } from "@/lib/storage/supabase-storage";
import { matchDishKnowledgeImage } from "@/lib/dish-image-match";
import { MAX_MENU_IMAGES, normalizeImageMimeType } from "@/lib/image-input";
import { storageIdForGeneratedDishImage } from "@/lib/dish-image-persistence";

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

type MenuImageInput = {
  base64: string;
  mimeType: string;
  name: string;
  size: number;
};

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

    // Fire background processing — buffers are in memory, safe to use after response
    processImages(taskId, imageBuffers, targetLang, startTime).catch(async (err) => {
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
  startTime: number
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
                const { data: existing } = await supabase
                  .from("dishes")
                  .select("id, ai_image_url, image_source")
                  .eq("name_original", dish.name_original)
                  .single();
                const imageUrl = existing?.ai_image_url || localMatch?.card || null;

                return {
                  ...dish,
                  id: existing?.id || `temp-${crypto.randomUUID()}`,
                  ai_image_url: imageUrl,
                  image_url: imageUrl,
                  image_source: existing?.image_source || (localMatch ? "mixed" : "ai"),
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

  supabase
    .from("translations")
    .insert({
      image_hashes: [],
      photo_count: imageBuffers.length,
      source_lang: resultPayload.metadata.source_language,
      target_lang: targetLang,
      dish_count: resultPayload.metadata.total_dishes,
      page_count: imageBuffers.length,
      status,
      result_json: resultPayload,
    })
    .then(() => {}, () => {});

  // Async image generation — runs in background, updates task when done
  generateImagesInBackground(taskId, resultPayload).catch((err) => {
    console.error("Background image generation failed:", err);
  });
}

async function generateImagesInBackground(
  taskId: string,
  resultPayload: Record<string, unknown>,
) {
  const pages = (resultPayload as { pages: Array<{ dishes: Dish[] }> }).pages;
  const allDishes: Dish[] = pages.flatMap((p) => p.dishes || []);
  const dishesForGeneration = allDishes
    .filter((dish) => !dish.ai_image_url)
    .slice(0, Math.max(0, BACKGROUND_IMAGE_LIMIT));

  if (dishesForGeneration.length === 0) return;

  await generateImagesForDishes(
    dishesForGeneration,
    async (index, tempUrl) => {
      const dish = dishesForGeneration[index];
      const canUpdateDishRow = dish.id && !dish.id.startsWith("temp-");

      const storageId = storageIdForGeneratedDishImage(dish);
      const publicUrl = await uploadDishImage(storageId, tempUrl);
      const finalUrl = publicUrl || tempUrl;

      if (canUpdateDishRow) {
        // Update dish in DB
        await supabase
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
    1,
  );
}
