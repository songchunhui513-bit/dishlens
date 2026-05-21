import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase";
import { createSupabaseServerClient } from "@/lib/auth/server";

export async function GET() {
  try {
    const supabaseAuth = await createSupabaseServerClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ translations: [] });
    }

    const { data, error } = await supabase
      .from("translations")
      .select("id, restaurant_name, city, source_lang, target_lang, dish_count, page_count, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("History fetch error:", error);
      return NextResponse.json({ translations: [] });
    }

    return NextResponse.json({ translations: data || [] });
  } catch (err) {
    console.error("History error:", err);
    return NextResponse.json({ translations: [] });
  }
}
