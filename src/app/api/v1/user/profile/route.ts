import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase";
import { createSupabaseServerClient } from "@/lib/auth/server";

export async function GET() {
  try {
    const supabaseAuth = await createSupabaseServerClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({
        id: "",
        name: "食客",
        preferred_lang: "zh",
        dietary_tags: [],
        allergens: [],
      });
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, avatar_url, preferred_lang, dietary_tags, allergens")
      .eq("id", user.id)
      .single();

    if (error || !data) {
      return NextResponse.json({
        id: user.id,
        email: user.email,
        name: "食客",
        preferred_lang: "zh",
        dietary_tags: [],
        allergens: [],
      });
    }

    return NextResponse.json({
      id: data.id,
      email: user.email,
      name: data.name || "食客",
      avatar_url: data.avatar_url || undefined,
      preferred_lang: data.preferred_lang || "zh",
      dietary_tags: data.dietary_tags || [],
      allergens: data.allergens || [],
    });
  } catch (err) {
    console.error("Profile fetch error:", err);
    return NextResponse.json({
      id: "",
      name: "食客",
      preferred_lang: "zh",
      dietary_tags: [],
      allergens: [],
    });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabaseAuth = await createSupabaseServerClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await req.json();
    const allowedFields = ["preferred_lang", "dietary_tags", "allergens", "name"];
    const updates: Record<string, unknown> = {};

    for (const key of allowedFields) {
      if (key in body) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, ...updates, updated_at: new Date().toISOString() });

    if (error) {
      console.error("Profile update error:", error);
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }

    const { data } = await supabase
      .from("profiles")
      .select("id, name, avatar_url, preferred_lang, dietary_tags, allergens")
      .eq("id", user.id)
      .single();

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: data?.name || "食客",
      avatar_url: data?.avatar_url || undefined,
      preferred_lang: data?.preferred_lang || "zh",
      dietary_tags: data?.dietary_tags || [],
      allergens: data?.allergens || [],
    });
  } catch (err) {
    console.error("Profile update error:", err);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
