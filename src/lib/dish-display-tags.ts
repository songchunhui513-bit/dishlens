import type { Dish, SignatureRecommendation } from "@/types";
import { classifyDish, type CategoryKey } from "@/lib/results-categories";
import { isVegetarianDish } from "@/lib/dish-presentation";

export type DishDisplayTagType = "green" | "warm" | "allergen" | "veg";

export interface DishDisplayTag {
  label: string;
  type: DishDisplayTagType;
}

const CATEGORY_TAG_LABELS: Partial<Record<CategoryKey, string>> = {
  must_order: "本店必点",
  ai_recommend: "AI 推荐",
  girl_favorite: "女生喜欢",
  appetizer: "前菜",
  main: "主菜",
  staple: "主食",
  dessert: "甜点",
  drink: "饮品",
  safe_pick: "稳妥选择",
  shareable: "适合分享",
  light: "清爽",
  rich: "浓郁",
  spicy: "辣味",
  seafood: "海鲜",
  meat: "肉食",
  vegetarian: "素食",
  cheese: "奶酪",
  local_special: "当地特色",
};

const PRIMARY_CATEGORY_TAG_ORDER: CategoryKey[] = [
  "must_order",
  "ai_recommend",
  "girl_favorite",
];

const SECONDARY_CATEGORY_TAG_ORDER: CategoryKey[] = [
  "appetizer",
  "main",
  "staple",
  "dessert",
  "drink",
  "safe_pick",
  "shareable",
  "light",
  "rich",
  "spicy",
  "seafood",
  "meat",
  "vegetarian",
  "cheese",
  "local_special",
];

const ALLERGEN_LABELS: Record<string, string> = {
  dairy: "⚠ 乳制品",
  egg: "⚠ 蛋",
  peanut: "⚠ 花生",
  tree_nut: "⚠ 坚果",
  soy: "⚠ 大豆",
  wheat: "⚠ 小麦",
  gluten: "⚠ 麸质",
  fish: "⚠ 鱼类",
  shellfish: "⚠ 贝类",
  alcohol: "⚠ 酒精",
  wine: "⚠ 酒精",
};

function pushUnique(tags: DishDisplayTag[], label: string, type: DishDisplayTagType): void {
  const clean = label.trim();
  if (!clean || tags.some((tag) => tag.label === clean)) return;
  tags.push({ label: clean, type });
}

export function buildDishDisplayTags({
  dish,
  signature,
  showAllergens = false,
  maxTags = 4,
}: {
  dish: Dish;
  signature?: SignatureRecommendation;
  showAllergens?: boolean;
  maxTags?: number;
}): DishDisplayTag[] {
  const tags: DishDisplayTag[] = [];
  const categories = classifyDish(dish, signature);

  for (const key of PRIMARY_CATEGORY_TAG_ORDER) {
    if (tags.length >= maxTags) break;
    if (!categories.has(key)) continue;
    const label = CATEGORY_TAG_LABELS[key];
    if (label) pushUnique(tags, label, "green");
  }

  if (tags.length < maxTags && isVegetarianDish(dish)) {
    pushUnique(tags, "素食", "veg");
  }

  if (showAllergens && dish.allergens?.length) {
    for (const allergen of dish.allergens) {
      if (tags.length >= maxTags) break;
      pushUnique(tags, ALLERGEN_LABELS[allergen] || `⚠ ${allergen}`, "allergen");
    }
  }

  for (const key of SECONDARY_CATEGORY_TAG_ORDER) {
    if (tags.length >= maxTags) break;
    if (!categories.has(key)) continue;
    const label = CATEGORY_TAG_LABELS[key];
    if (label) pushUnique(tags, label, key === "vegetarian" ? "veg" : "green");
  }

  for (const ingredient of dish.ingredients || []) {
    if (tags.length >= maxTags) break;
    pushUnique(tags, ingredient, "green");
  }

  return tags;
}
