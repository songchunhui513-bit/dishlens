import { canonicalDishNameKey } from "@/lib/dish-name-normalization";

type GeneratedDishImageTarget = {
  id?: string;
  name_original?: string;
  name_translated?: string | Record<string, string>;
};

function localized(value: GeneratedDishImageTarget["name_translated"]): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.en || value.zh || Object.values(value)[0] || "";
}

function slug(value: string): string {
  const cleaned = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u20ac$\u00a3\u00a5\u20b9]\s*\d+(?:[,.]\d+)?|\d+(?:[,.]\d+)?\s*(?:\u20ac|eur|euros?|usd|gbp|\u5143|\u5186|\u20b9)/gi, " ")
    .replace(/[\u00ab\u00bb"\u201c\u201d'\u2019`\u00b4.,;:!?()[\]{}+*/\\|_~^=<>]/g, " ")
    .trim()
    .toLowerCase();
  // Use a short hash suffix to guarantee uniqueness for non-Latin names
  if (!/[a-z0-9]/.test(cleaned)) {
    let h = 0;
    for (let i = 0; i < value.length; i++) h = (Math.imul(31, h) + value.charCodeAt(i)) | 0;
    return `dish-${Math.abs(h).toString(36)}`;
  }
  return cleaned
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

export function storageIdForGeneratedDishImage(dish: GeneratedDishImageTarget): string {
  if (dish.id && !dish.id.startsWith("temp-")) return dish.id;

  const rawName = dish.name_original || localized(dish.name_translated) || dish.id || "dish";
  const nameSlug = slug(canonicalDishNameKey(rawName) || rawName);
  return `generated-${nameSlug || "dish"}`;
}
