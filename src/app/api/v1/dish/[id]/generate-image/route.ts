import { NextRequest, NextResponse } from "next/server";
import { generateDishImage } from "@/lib/ai/image-gen";
import { getCachedDishImageUrl, uploadDishImage } from "@/lib/storage/supabase-storage";
import { storageIdForGeneratedDishImage } from "@/lib/dish-image-persistence";
import { getTask, updateTask } from "@/lib/cache/task-store";
import { isStableRemoteGeneratedDishImageUrl } from "@/lib/safe-image-url";

type GeneratedDishUpdate = {
  id?: string;
  name_original?: string;
};

type DishImageRecord = GeneratedDishUpdate & Record<string, unknown>;
type RateBucket = { count: number; resetAt: number };

const inFlightDishImageGenerations = new Map<string, Promise<string | null>>();
const dishImageGenerationRateBuckets = new Map<string, RateBucket>();
const CLIENT_WINDOW_MS = 10 * 60_000;
const TASK_WINDOW_MS = 24 * 60 * 60_000;
const GLOBAL_WINDOW_MS = 60_000;
const CLIENT_LIMIT = 30;
const TASK_LIMIT = 100;
const GLOBAL_LIMIT = 120;
const RATE_BUCKET_MAX_ENTRIES = 5_000;
let lastRateBucketCleanupAt = 0;

function findTaskDish(
  result: Record<string, unknown> | undefined,
  routeDishId: string,
  requestedName: string,
): DishImageRecord | null {
  if (!result || !Array.isArray(result.pages)) return null;
  let nameMatch: DishImageRecord | null = null;
  for (const page of result.pages) {
    if (!page || typeof page !== "object") continue;
    const dishes = (page as { dishes?: unknown }).dishes;
    if (!Array.isArray(dishes)) continue;
    for (const dish of dishes) {
      if (!dish || typeof dish !== "object") continue;
      const record = dish as DishImageRecord;
      if (record.id === routeDishId) return record;
      if (requestedName && record.name_original === requestedName) nameMatch = record;
    }
  }
  return nameMatch;
}

function requestClientId(request: NextRequest): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  const forwarded = request.headers.get("x-forwarded-for")
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .at(-1);
  return realIp || forwarded || "unknown";
}

function cleanupExpiredRateBuckets(now: number): void {
  if (now - lastRateBucketCleanupAt < GLOBAL_WINDOW_MS) return;
  for (const [key, bucket] of dishImageGenerationRateBuckets) {
    if (bucket.resetAt <= now) dishImageGenerationRateBuckets.delete(key);
  }
  lastRateBucketCleanupAt = now;
}

function enforceRateBucketLimit(): void {
  if (dishImageGenerationRateBuckets.size <= RATE_BUCKET_MAX_ENTRIES) return;
  for (const key of dishImageGenerationRateBuckets.keys()) {
    if (key === "global") continue;
    dishImageGenerationRateBuckets.delete(key);
    if (dishImageGenerationRateBuckets.size <= RATE_BUCKET_MAX_ENTRIES) return;
  }
}

function consumeDishImageGenerationBudget(
  request: NextRequest,
  taskId: string,
): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const now = Date.now();
  cleanupExpiredRateBuckets(now);
  const limits = [
    { key: `client:${requestClientId(request)}`, limit: CLIENT_LIMIT, windowMs: CLIENT_WINDOW_MS },
    { key: `task:${taskId}`, limit: TASK_LIMIT, windowMs: TASK_WINDOW_MS },
    { key: "global", limit: GLOBAL_LIMIT, windowMs: GLOBAL_WINDOW_MS },
  ];
  const buckets = limits.map(({ key, windowMs }) => {
    const current = dishImageGenerationRateBuckets.get(key);
    if (!current || current.resetAt <= now) return { key, bucket: { count: 0, resetAt: now + windowMs } };
    return { key, bucket: current };
  });
  const denied = buckets.find(({ bucket }, index) => bucket.count >= limits[index].limit);
  if (denied) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((denied.bucket.resetAt - now) / 1000)),
    };
  }
  for (const { key, bucket } of buckets) {
    bucket.count++;
    dishImageGenerationRateBuckets.set(key, bucket);
  }
  enforceRateBucketLimit();
  return { allowed: true };
}

function isLocalDevelopmentGeneratedImageUrl(url: string): boolean {
  return process.env.NODE_ENV !== "production" && url.startsWith("/generated-dishes/");
}

async function generateAndPersistDishImage(
  storageId: string,
  dishInfo: DishImageRecord,
): Promise<string | null> {
  const tempUrl = await generateDishImage({
    name_original: String(dishInfo.name_original || ""),
    name_translated: dishInfo.name_translated as string | Record<string, string> | undefined,
    description: dishInfo.description as string | Record<string, string> | undefined,
    ingredients: Array.isArray(dishInfo.ingredients) ? dishInfo.ingredients as string[] : undefined,
    included_items: Array.isArray(dishInfo.included_items) ? dishInfo.included_items as string[] : undefined,
    category: typeof dishInfo.category === "string" ? dishInfo.category : undefined,
  });
  if (!tempUrl) return null;

  const publicUrl = await uploadDishImage(storageId, tempUrl);
  if (!publicUrl) return null;
  if (!isStableRemoteGeneratedDishImageUrl(publicUrl)) {
    return isLocalDevelopmentGeneratedImageUrl(publicUrl) ? publicUrl : null;
  }
  return publicUrl;
}

async function updateGeneratedDishImageInTask(
  taskId: string,
  dishInfo: GeneratedDishUpdate,
  url: string,
): Promise<void> {
  const task = await getTask(taskId);
  if (!task?.result || !Array.isArray(task.result.pages)) return;

  let changed = false;
  const pages = task.result.pages.map((page) => {
    if (!page || typeof page !== "object" || !Array.isArray((page as { dishes?: unknown[] }).dishes)) return page;
    const dishes = (page as { dishes: Array<Record<string, unknown>> }).dishes.map((dish) => {
      const matchesId = Boolean(dishInfo.id && dish.id === dishInfo.id);
      const matchesName = Boolean(dishInfo.name_original && dish.name_original === dishInfo.name_original);
      if (!matchesId && !matchesName) return dish;
      changed = true;
      return {
        ...dish,
        ai_image_url: url,
        image_url: url,
        image_status: "done",
        image_source: "ai",
        image_error: undefined,
      };
    });
    return { ...(page as Record<string, unknown>), dishes };
  });

  if (changed) await updateTask(taskId, { result: { ...task.result, pages } });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing dish id" }, { status: 400 });

  const body = await _req.json().catch(() => ({}));
  const taskId = typeof body.task_id === "string" ? body.task_id.trim() : "";
  if (!taskId) return NextResponse.json({ error: "Missing task_id" }, { status: 401 });

  const task = await getTask(taskId);
  if (!task?.result) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  const requestedName = typeof body.dish?.name_original === "string" ? body.dish.name_original : "";
  const dishInfo = findTaskDish(task.result, id, requestedName);
  if (!dishInfo?.name_original) return NextResponse.json({ error: "Dish is not part of this task" }, { status: 403 });

  try {
    const storageId = storageIdForGeneratedDishImage({
      name_original: dishInfo.name_original,
      name_translated: dishInfo.name_translated as string | Record<string, string> | undefined,
    });
    const cachedUrl = await getCachedDishImageUrl(storageId);
    if (cachedUrl) {
      if (!isStableRemoteGeneratedDishImageUrl(cachedUrl)) {
        if (!isLocalDevelopmentGeneratedImageUrl(cachedUrl)) {
          return NextResponse.json({ error: "Cached image is not remotely persisted" }, { status: 503 });
        }
      }
      await updateGeneratedDishImageInTask(taskId, {
        id: dishInfo.id || id,
        name_original: dishInfo.name_original,
      }, cachedUrl);
      return NextResponse.json({
        url: cachedUrl,
        storage_id: storageId,
        cache_hit: true,
      });
    }

    let generationPromise = inFlightDishImageGenerations.get(storageId);
    if (!generationPromise) {
      const budget = consumeDishImageGenerationBudget(_req, taskId);
      if (!budget.allowed) {
        return NextResponse.json(
          { error: "Image generation rate limit exceeded" },
          { status: 429, headers: { "Retry-After": String(budget.retryAfterSeconds) } },
        );
      }
      generationPromise = generateAndPersistDishImage(storageId, dishInfo);
      inFlightDishImageGenerations.set(storageId, generationPromise);
      const clearInFlight = () => {
        if (inFlightDishImageGenerations.get(storageId) === generationPromise) {
          inFlightDishImageGenerations.delete(storageId);
        }
      };
      void generationPromise.then(clearInFlight, clearInFlight);
    }

    const publicUrl = await generationPromise;
    if (!publicUrl) {
      return NextResponse.json({ error: "Generated image could not be persisted" }, { status: 502 });
    }
    if (!isStableRemoteGeneratedDishImageUrl(publicUrl)) {
      if (!isLocalDevelopmentGeneratedImageUrl(publicUrl)) {
        return NextResponse.json({ error: "Generated image is not remotely persisted" }, { status: 502 });
      }
    }

    await updateGeneratedDishImageInTask(taskId, {
      id: dishInfo.id || id,
      name_original: dishInfo.name_original,
    }, publicUrl);

    return NextResponse.json({
      url: publicUrl,
      storage_id: storageId,
      cache_hit: false,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Image generation failed" },
      { status: 500 },
    );
  }
}
