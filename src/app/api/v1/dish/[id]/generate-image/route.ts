import { NextRequest, NextResponse } from "next/server";
import { generateDishImage } from "@/lib/ai/image-gen";
import { uploadDishImage } from "@/lib/storage/supabase-storage";
import { storageIdForGeneratedDishImage } from "@/lib/dish-image-persistence";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing dish id" }, { status: 400 });

  const body = await _req.json().catch(() => ({}));
  const dishInfo = body.dish || {};
  if (!dishInfo.name_original) {
    return NextResponse.json({ error: "Missing dish name_original" }, { status: 400 });
  }

  try {
    const tempUrl = await generateDishImage({
      name_original: dishInfo.name_original,
      name_translated: dishInfo.name_translated,
      description: dishInfo.description,
      ingredients: dishInfo.ingredients,
      included_items: dishInfo.included_items,
      category: dishInfo.category,
    });

    if (!tempUrl) {
      return NextResponse.json({ error: "Image generation returned no URL" }, { status: 502 });
    }

    // Upload to Supabase and get permanent URL
    const storageId = storageIdForGeneratedDishImage({
      name_original: dishInfo.name_original,
      name_translated: dishInfo.name_translated,
    });
    const publicUrl = await uploadDishImage(storageId, tempUrl);

    return NextResponse.json({
      url: publicUrl || tempUrl,
      storage_id: storageId,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Image generation failed" },
      { status: 500 },
    );
  }
}
