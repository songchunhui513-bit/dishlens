import { getSupabaseAdminClient, getSupabaseClient } from "@/lib/db/supabase";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BUCKET = "dishes";
const LOCAL_GENERATED_DIR = join(process.cwd(), "public", "generated-dishes");

function localDishImagePath(dishId: string): string {
  return join(LOCAL_GENERATED_DIR, `${dishId}.png`);
}

function localDishImageUrl(dishId: string): string {
  return `/generated-dishes/${dishId}.png`;
}

async function fetchImageBuffer(imageUrl: string): Promise<Buffer> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`fetch image failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function saveLocalDishImage(dishId: string, buffer: Buffer): Promise<string | null> {
  try {
    await mkdir(LOCAL_GENERATED_DIR, { recursive: true });
    await writeFile(localDishImagePath(dishId), buffer);
    return localDishImageUrl(dishId);
  } catch (err) {
    console.error("saveLocalDishImage error:", err);
    return null;
  }
}

export async function uploadDishImage(
  dishId: string,
  imageUrl: string,
): Promise<string | null> {
  let localUrl: string | null = null;

  try {
    const buffer = await fetchImageBuffer(imageUrl);
    localUrl = await saveLocalDishImage(dishId, buffer);

    const client = getSupabaseAdminClient() || getSupabaseClient();
    if (!client) return localUrl;

    const path = `${dishId}.png`;

    const { error } = await client.storage.from(BUCKET).upload(path, buffer, {
      contentType: "image/png",
      upsert: true,
    });

    if (error) {
      console.error("uploadDishImage storage error:", error);
      return localUrl;
    }

    const { data } = client.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl || localUrl;
  } catch (err) {
    console.error("uploadDishImage error:", err);
    return localUrl;
  }
}

export async function getCachedDishImageUrl(dishId: string): Promise<string | null> {
  if (existsSync(localDishImagePath(dishId))) {
    return localDishImageUrl(dishId);
  }

  const client = getSupabaseAdminClient() || getSupabaseClient();
  if (!client) return null;

  const path = `${dishId}.png`;
  const { data } = client.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = data.publicUrl;
  if (!publicUrl) return null;

  try {
    const res = await fetch(publicUrl, { method: "HEAD" });
    return res.ok ? publicUrl : null;
  } catch {
    return null;
  }
}
