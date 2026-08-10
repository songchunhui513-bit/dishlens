import { isStableRemoteGeneratedDishImageUrl } from "@/lib/safe-image-url";

const GENERATED_DISH_PREFIX = "/generated-dishes/";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isMachineLocalGeneratedDishUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  const url = value.trim();
  if (isStableRemoteGeneratedDishImageUrl(url)) return false;
  if (url.startsWith(GENERATED_DISH_PREFIX)) return true;
  try {
    if (!new URL(url).pathname.startsWith(GENERATED_DISH_PREFIX)) return false;
  } catch {
    return false;
  }
  // Runtime generated files are machine-local artifacts. Even when they exist
  // on the current server, they are unsafe to preserve across deploys or share
  // between local, ECS, and future hosting environments.
  return true;
}

function localizedText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!isRecord(value)) return "";
  return [value.zh, value.en, value.ja, value.ko, value.fr, value.it]
    .filter((item): item is string => typeof item === "string")
    .join(" ");
}

function correctedCategory(dish: JsonRecord): string | null {
  const category = typeof dish.category === "string" ? dish.category.toLowerCase() : "";
  if (category !== "drink" && category !== "beverage") return null;

  const text = [
    dish.name_original,
    localizedText(dish.name_translated),
    localizedText(dish.description),
    ...(Array.isArray(dish.ingredients) ? dish.ingredients : []),
  ].filter((item): item is string => typeof item === "string").join(" ").toLowerCase();

  const dessertFormat =
    /\b(?:roll|cake|chiffon|swiss roll|pastry|pudding|mousse|tart|pie|mochi|dorayaki|waffle|pancake|crepe|cheesecake|brownie|cookie|biscuit|fritter)\b|卷|蛋糕|戚风|点心|甜点|甜品|糕点|糕|布丁|慕斯|挞|派|麻薯|大福|铜锣烧|华夫|松饼|可丽饼|芝士蛋糕|曲奇|炸饼/.test(text);
  return dessertFormat ? "dessert" : null;
}

export function sanitizeTranslationResultImages<T extends JsonRecord | null | undefined>(result: T): T {
  if (!isRecord(result) || !Array.isArray(result.pages)) return result;

  let removedCount = 0;
  let categoryCorrectedCount = 0;
  const pages = result.pages.map((page) => {
    if (!isRecord(page) || !Array.isArray(page.dishes)) return page;

    let pageChanged = false;
    const dishes = page.dishes.map((dish) => {
      if (!isRecord(dish)) return dish;

      const staleAiUrl = isMachineLocalGeneratedDishUrl(dish.ai_image_url);
      const staleImageUrl = isMachineLocalGeneratedDishUrl(dish.image_url);
      const nextCategory = correctedCategory(dish);
      if (!staleAiUrl && !staleImageUrl && !nextCategory) return dish;

      pageChanged = true;
      removedCount += Number(staleAiUrl) + Number(staleImageUrl);
      categoryCorrectedCount += nextCategory ? 1 : 0;
      const nextDish = { ...dish };
      if (nextCategory) nextDish.category = nextCategory;
      if (staleAiUrl) delete nextDish.ai_image_url;
      if (staleImageUrl) delete nextDish.image_url;
      if (!nextDish.ai_image_url && !nextDish.image_url) {
        nextDish.image_status = "failed";
      }
      return nextDish;
    });

    return pageChanged ? { ...page, dishes } : page;
  });

  if (removedCount === 0 && categoryCorrectedCount === 0) return result;

  const metadata = isRecord(result.metadata)
    ? { ...result.metadata }
    : {};
  if (removedCount > 0) metadata.image_sanitized_count = removedCount;
  if (categoryCorrectedCount > 0) metadata.category_sanitized_count = categoryCorrectedCount;
  return { ...result, pages, metadata } as T;
}
