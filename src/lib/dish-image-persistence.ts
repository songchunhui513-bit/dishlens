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
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[€$£¥₹]\s*\d+(?:[,.]\d+)?|\d+(?:[,.]\d+)?\s*(?:€|eur|euros?|usd|gbp|元|円|₹)/gi, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

export function storageIdForGeneratedDishImage(dish: GeneratedDishImageTarget): string {
  if (dish.id && !dish.id.startsWith("temp-")) return dish.id;

  const nameSlug = slug(dish.name_original || localized(dish.name_translated) || dish.id || "dish");
  return `generated-${nameSlug || "dish"}`;
}
