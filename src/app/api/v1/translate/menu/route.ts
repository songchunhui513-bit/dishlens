import { NextRequest, NextResponse } from "next/server";
import { analyzeMenuImage, refineTranslation, hasChinese } from "@/lib/ai";
import { supabase } from "@/lib/db/supabase";
import { createTask, updateTask } from "@/lib/cache/task-store";

export const maxDuration = 60;

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

    if (images.length > 10) {
      return NextResponse.json({ error: "Max 10 images" }, { status: 400 });
    }

    const taskId = crypto.randomUUID();
    await createTask(taskId, images.length);

    // Read ALL file data into memory BEFORE returning response
    const imageBuffers = await Promise.all(
      images.map(async (file) => ({
        base64: Buffer.from(await file.arrayBuffer()).toString("base64"),
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
  imageBuffers: Array<{ base64: string }>,
  targetLang: string,
  startTime: number
) {
  const results: Array<Record<string, unknown>> = [];
  const failedPages: Array<{ page_index: number; error: string; retry_allowed: boolean }> = [];

  for (let batch = 0; batch < imageBuffers.length; batch += 2) {
    const batchItems = imageBuffers.slice(batch, batch + 2);
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

          const raw = await analyzeMenuImage(item.base64);

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
                    const needsRefine = dish.confidence < 0.5 || dish._needsRetranslate || !hasChinese(dish.name_translated || "");
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

          const dishRecords = await Promise.all(
            refinedDishes.map(async (dish: { name_original: string }) => {
              try {
                const { data: existing } = await supabase
                  .from("dishes")
                  .select("id, ai_image_url, image_source")
                  .eq("name_original", dish.name_original)
                  .single();
                return {
                  ...dish,
                  id: existing?.id,
                  image_url: existing?.ai_image_url || null,
                  image_source: existing?.image_source || "ai",
                };
              } catch {
                return { ...dish, image_url: null, image_source: "ai" };
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
            await updateTask(taskId, { perPageStatus: currentTask.perPageStatus });
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
}
