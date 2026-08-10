import { storageIdForGeneratedDishImage } from "@/lib/dish-image-persistence";
import { isStableRemoteGeneratedDishImageUrl } from "@/lib/safe-image-url";
import { getLocalGeneratedDishImageUrl } from "@/lib/storage/supabase-storage";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isRuntimeDisplayableGeneratedDishImageUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  if (url.startsWith("/generated-dishes/")) return process.env.NODE_ENV !== "production";
  if (url.startsWith("/")) return false;
  try {
    const parsed = new URL(url);
    return isStableRemoteGeneratedDishImageUrl(parsed);
  } catch {
    return false;
  }
}

export function hydrateRuntimeGeneratedDishImages<T extends JsonRecord | null | undefined>(result: T): T {
  if (!isRecord(result) || !Array.isArray(result.pages)) return result;
  if (process.env.NODE_ENV === "production") return result;

  let restoredCount = 0;
  let missingCount = 0;
  const pages = result.pages.map((page) => {
    if (!isRecord(page) || !Array.isArray(page.dishes)) return page;

    let pageChanged = false;
    const dishes = page.dishes.map((dish) => {
      if (!isRecord(dish)) return dish;
      if (dish.ai_image_url || dish.image_url) return dish;

      const localUrl = getLocalGeneratedDishImageUrl(storageIdForGeneratedDishImage(dish));
      if (!localUrl) {
        missingCount++;
        return dish;
      }

      restoredCount++;
      pageChanged = true;
      return {
        ...dish,
        ai_image_url: localUrl,
        image_url: localUrl,
        image_status: "done",
      };
    });

    return pageChanged ? { ...page, dishes } : page;
  });

  if (restoredCount === 0) return result;

  const metadata = isRecord(result.metadata) ? { ...result.metadata } : {};
  metadata.runtime_generated_images_restored_count = restoredCount;
  if (missingCount === 0) {
    delete metadata.image_sanitized_count;
    delete metadata.local_generated_images_stripped_count;
    delete metadata.image_generation_failed;
    delete metadata.image_generation_retry_after_ms;
    metadata.image_generation_status = "done";
    if (isRecord(metadata.image_generation_progress)) {
      const total = typeof metadata.image_generation_progress.total === "number"
        ? metadata.image_generation_progress.total
        : restoredCount;
      metadata.image_generation_progress = { ...metadata.image_generation_progress, current: total, total };
    }
  }
  return { ...result, pages, metadata } as T;
}
