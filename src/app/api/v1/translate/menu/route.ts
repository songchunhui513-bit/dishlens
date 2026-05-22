import { NextRequest, NextResponse } from "next/server";
import { analyzeMenuImage, refineTranslation, hasChinese } from "@/lib/ai";
import { supabase } from "@/lib/db/supabase";

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

    // Synchronous processing — works in serverless without external state store
    const results: Array<Record<string, unknown>> = [];
    const failedPages: Array<{ page_index: number; error: string }> = [];

    for (let batch = 0; batch < images.length; batch += 2) {
      const batchImages = images.slice(batch, batch + 2);
      const batchResults = await Promise.all(
        batchImages.map(async (file, batchIdx) => {
          const i = batch + batchIdx;
          try {
            const buffer = Buffer.from(await file.arrayBuffer());
            const base64 = buffer.toString("base64");
            const mimeType = file.type || "image/jpeg";

            const raw = await analyzeMenuImage(base64, mimeType);

            const refinedDishes = await Promise.all(
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
            );

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

            return {
              page_index: i,
              page_label: raw.page_label || "未分类",
              source_language: raw.source_language,
              dishes: dishRecords,
            };
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Unknown error";
            failedPages.push({ page_index: i, error: message });
            return null;
          }
        })
      );

      for (const r of batchResults) {
        if (r) results.push(r);
      }
    }

    const sorted = results
      .filter(Boolean)
      .sort((a, b) => (a as { page_index: number }).page_index - (b as { page_index: number }).page_index);

    const status = failedPages.length === images.length ? "failed"
      : failedPages.length > 0 ? "partial"
      : "done";

    const resultPayload = {
      status,
      pages: sorted,
      failed_pages: failedPages.length > 0 ? failedPages : undefined,
      metadata: {
        source_language: (sorted[0] as { source_language?: string })?.source_language || "unknown",
        total_dishes: sorted.reduce(
          (sum, p) => sum + (((p as { dishes?: unknown[] }).dishes)?.length || 0),
          0
        ),
        processing_time_ms: Date.now() - startTime,
      },
    };

    // Persist to DB (fire-and-forget)
    supabase
      .from("translations")
      .insert({
        image_hashes: [],
        photo_count: images.length,
        source_lang: resultPayload.metadata.source_language,
        target_lang: targetLang,
        dish_count: resultPayload.metadata.total_dishes,
        page_count: images.length,
        status,
        result_json: resultPayload,
      })
      .then(() => {}, () => {});

    return NextResponse.json(resultPayload);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Translation failed";
    console.error("Translate error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
