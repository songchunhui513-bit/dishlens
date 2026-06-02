type DishLike = {
  name_original?: string;
  description?: string;
  ingredients?: unknown[];
  allergens?: unknown[];
  taste_profile?: unknown[];
  confidence?: number;
};

function cleanLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeExtractedDishFields<T extends DishLike>(dish: T): T {
  const name = typeof dish.name_original === "string" ? dish.name_original.trim() : "";
  const description = typeof dish.description === "string" ? dish.description.trim() : "";

  if (name.includes("\n")) {
    const lines = name
      .split(/\n+/)
      .map(cleanLine)
      .filter(Boolean);
    if (lines.length > 1) {
      dish.name_original = lines[0];
      dish.description = description || lines.slice(1).join(" ");
    }
  } else if (name) {
    dish.name_original = cleanLine(name);
  }

  if (typeof dish.description === "string") {
    dish.description = cleanLine(dish.description);
  }
  if (!Array.isArray(dish.ingredients)) dish.ingredients = [];
  if (!Array.isArray(dish.allergens)) dish.allergens = [];
  if (!Array.isArray(dish.taste_profile)) dish.taste_profile = [];
  if (dish.confidence === undefined) dish.confidence = 0.7;

  return dish;
}
