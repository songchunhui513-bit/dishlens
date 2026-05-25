import { getSupabaseClient } from "@/lib/db/supabase";

const BUCKET = "dishes";

export async function uploadDishImage(
  dishId: string,
  imageUrl: string,
): Promise<string | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error(`fetch image failed: ${res.status}`);

    const buffer = Buffer.from(await res.arrayBuffer());
    const path = `${dishId}.png`;

    const { error } = await client.storage.from(BUCKET).upload(path, buffer, {
      contentType: "image/png",
      upsert: true,
    });

    if (error) throw error;

    const { data } = client.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.error("uploadDishImage error:", err);
    return null;
  }
}
