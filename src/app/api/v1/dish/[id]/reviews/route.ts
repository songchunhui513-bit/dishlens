import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: dishId } = await params;
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const sort = searchParams.get("sort") || "recent";
  const pageSize = 20;

  try {
    let query = supabase
      .from("reviews")
      .select("id, user_id, rating, content, photos, lang, helpful_count, created_at, profiles(name, avatar_url)", { count: "exact" })
      .eq("dish_id", dishId);

    if (sort === "helpful") {
      query = query.order("helpful_count", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    const from = (page - 1) * pageSize;
    query = query.range(from, from + pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("Reviews fetch error:", error);
      return NextResponse.json({ reviews: [], total: 0, has_more: false });
    }

    const reviews = (data || []).map((r: Record<string, unknown>) => ({
      id: r.id,
      user_id: r.user_id,
      user_name: (r.profiles as Record<string, string>)?.name || "食客",
      user_avatar: (r.profiles as Record<string, string>)?.avatar_url || undefined,
      dish_id: dishId,
      rating: r.rating,
      content: r.content,
      photos: r.photos || [],
      lang: r.lang || "zh",
      helpful_count: r.helpful_count || 0,
      created_at: r.created_at,
    }));

    const total = count || 0;
    return NextResponse.json({
      reviews,
      total,
      has_more: from + pageSize < total,
    });
  } catch (err) {
    console.error("Reviews error:", err);
    return NextResponse.json({ reviews: [], total: 0, has_more: false });
  }
}
