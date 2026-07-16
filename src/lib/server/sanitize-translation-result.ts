import { existsSync } from "node:fs";
import { basename, join } from "node:path";

const GENERATED_DISH_PREFIX = "/generated-dishes/";
const GENERATED_DISH_DIR = join(process.cwd(), "public", "generated-dishes");

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isMissingGeneratedDishUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.startsWith(GENERATED_DISH_PREFIX)) return false;
  const fileName = basename(value.split("?")[0] || "");
  if (!fileName || fileName.includes("..")) return true;
  return !existsSync(join(GENERATED_DISH_DIR, fileName));
}

export function sanitizeTranslationResultImages<T extends JsonRecord | null | undefined>(result: T): T {
  if (!isRecord(result) || !Array.isArray(result.pages)) return result;

  let removedCount = 0;
  const pages = result.pages.map((page) => {
    if (!isRecord(page) || !Array.isArray(page.dishes)) return page;

    let pageChanged = false;
    const dishes = page.dishes.map((dish) => {
      if (!isRecord(dish)) return dish;

      const staleAiUrl = isMissingGeneratedDishUrl(dish.ai_image_url);
      const staleImageUrl = isMissingGeneratedDishUrl(dish.image_url);
      if (!staleAiUrl && !staleImageUrl) return dish;

      pageChanged = true;
      removedCount += Number(staleAiUrl) + Number(staleImageUrl);
      const nextDish = { ...dish };
      if (staleAiUrl) delete nextDish.ai_image_url;
      if (staleImageUrl) delete nextDish.image_url;
      if (!nextDish.ai_image_url && !nextDish.image_url) {
        nextDish.image_status = "failed";
      }
      return nextDish;
    });

    return pageChanged ? { ...page, dishes } : page;
  });

  if (removedCount === 0) return result;

  const metadata = isRecord(result.metadata)
    ? { ...result.metadata, image_sanitized_count: removedCount }
    : { image_sanitized_count: removedCount };
  return { ...result, pages, metadata } as T;
}
