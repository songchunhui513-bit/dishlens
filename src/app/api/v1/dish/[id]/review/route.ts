import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase";
import { ReviewSchema } from "@/lib/validators/translate";
import { createSupabaseServerClient } from "@/lib/auth/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: dishId } = await params;

  try {
    const body = await req.json();
    const parsed = ReviewSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid review", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { rating, content, photos = [] } = parsed.data;

    const supabaseAuth = await createSupabaseServerClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("reviews")
      .insert({
        user_id: user.id,
        dish_id: dishId,
        rating,
        content,
        photos,
        lang: "zh",
      })
      .select("id")
      .single();

    if (error) {
      // Handle duplicate review (unique constraint)
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "You have already reviewed this dish" },
          { status: 409 }
        );
      }
      console.error("Review insert error:", error);
      return NextResponse.json(
        { error: "Failed to submit review" },
        { status: 500 }
      );
    }

    return NextResponse.json({ review_id: data.id }, { status: 201 });
  } catch (err) {
    console.error("Review submit error:", err);
    return NextResponse.json(
      { error: "Failed to submit review" },
      { status: 500 }
    );
  }
}
