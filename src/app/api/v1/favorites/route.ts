import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase";
import { createSupabaseServerClient } from "@/lib/auth/server";

export async function GET() {
  try {
    const supabaseAuth = await createSupabaseServerClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ favorites: [], total: 0 });
    }

    const { data, error, count } = await supabase
      .from("user_favorites")
      .select("dish_id, dishes(*)", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Favorites fetch error:", error);
      return NextResponse.json({ favorites: [], total: 0 });
    }

    const favorites = (data || []).map((f: Record<string, unknown>) => {
      const dish = f.dishes as Record<string, unknown> | null;
      return dish || {};
    }).filter(Boolean);

    return NextResponse.json({ favorites, total: count || 0 });
  } catch (err) {
    console.error("Favorites error:", err);
    return NextResponse.json({ favorites: [], total: 0 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabaseAuth = await createSupabaseServerClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await req.json();
    const { dish_id } = body;

    if (!dish_id) {
      return NextResponse.json({ error: "dish_id required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("user_favorites")
      .insert({ user_id: user.id, dish_id });

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ success: true }, { status: 200 });
      }
      console.error("Favorite insert error:", error);
      return NextResponse.json({ error: "Failed to add favorite" }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("Favorite add error:", err);
    return NextResponse.json({ error: "Failed to add favorite" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabaseAuth = await createSupabaseServerClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dishId = searchParams.get("dish_id");

    if (!dishId) {
      return NextResponse.json({ error: "dish_id required" }, { status: 400 });
    }

    await supabase
      .from("user_favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("dish_id", dishId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Favorite remove error:", err);
    return NextResponse.json({ error: "Failed to remove favorite" }, { status: 500 });
  }
}
