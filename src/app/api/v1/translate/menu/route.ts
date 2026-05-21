import { NextRequest, NextResponse } from "next/server";
import { analyzeMenuImage, refineTranslation } from "@/lib/ai";
import { supabase } from "@/lib/db/supabase";
import { createTask, updateTask } from "@/lib/cache/task-store";
import type { TaskState } from "@/lib/cache/task-store";

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const formData = await req.formData();
    const images = formData.getAll("images") as File[];
    const targetLang = (formData.get("target_lang") as string) || "zh";

    if (!images || images.length === 0) {
      return NextResponse.json({ error: "No images provided" }, { status: 400 });
    }

    if (images.length > 10) {
      return NextResponse.json({ error: "Max 10 images" }, { status: 400 });
    }

    const taskId = crypto.randomUUID();
    const task = await createTask(taskId, images.length);

    const results: Array<Record<string, unknown>> = [];
    const failedPages: Array<{ page_index: number; error: string; retry_allowed: boolean }> = [];

    await Promise.all(
      images.map(async (file, i) => {
        try {
          task.perPageStatus[i].status = "processing";

          const buffer = Buffer.from(await file.arrayBuffer());
          const base64 = buffer.toString("base64");

          const raw = await analyzeMenuImage(base64);

          const refinedDishes = await Promise.all(
            raw.dishes.map(async (dish: { confidence: number; name_original: string; name_translated: string; description: string }) => {
              if (dish.confidence < 0.5) return dish;
              const refined = await refineTranslation({
                name_original: dish.name_original,
                name_translated: dish.name_translated,
                description: dish.description,
                source_language: raw.source_language,
              });
              return { ...dish, ...refined };
            })
          );

          const dishRecords = await Promise.all(
            refinedDishes.map(async (dish: { name_original: string }) => {
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
            })
          );

          results[i] = {
            page_index: i,
            page_label: raw.page_label || "未分类",
            source_language: raw.source_language,
            dishes: dishRecords,
          };

          task.perPageStatus[i].status = "done";
          task.progress.current = results.filter(Boolean).length;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Unknown error";
          task.perPageStatus[i].status = "failed";
          failedPages.push({ page_index: i, error: message, retry_allowed: true });
        }
      })
    );

    if (failedPages.length === images.length) task.status = "failed";
    else if (failedPages.length > 0) task.status = "partial";
    else task.status = "done";

    const sorted = results.filter(Boolean).sort(
      (a, b) => (a as { page_index: number }).page_index - (b as { page_index: number }).page_index
    );

    const resultPayload = {
      task_id: taskId,
      status: task.status,
      pages: sorted,
      failed_pages: failedPages.length > 0 ? failedPages : undefined,
      errors: failedPages.map((f) => `${f.page_index}: ${f.error}`),
      metadata: {
        source_language: (sorted[0] as { source_language?: string })?.source_language || "unknown",
        total_dishes: sorted.reduce(
          (sum, p) => sum + (((p as { dishes?: unknown[] }).dishes)?.length || 0),
          0
        ),
        cached: false,
        processing_time_ms: Date.now() - startTime,
      },
    };

    task.result = resultPayload;
    task.failedPages = failedPages.length > 0 ? failedPages : undefined;
    task.estimatedRemaining = 0;

    await updateTask(taskId, task);

    // Persist to DB (fire-and-forget)
    supabase.from("translations").insert({
      image_hashes: [],
      photo_count: images.length,
      source_lang: resultPayload.metadata.source_language,
      target_lang: targetLang,
      dish_count: resultPayload.metadata.total_dishes,
      page_count: images.length,
      status: task.status,
      result_json: resultPayload,
    }).then(
      () => {},
      () => {}
    );

    return NextResponse.json(resultPayload, {
      status: task.status === "done" || task.status === "partial" ? 200 : 202,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Translation failed";
    console.error("Translate error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
