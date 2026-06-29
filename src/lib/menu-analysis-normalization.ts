type DishLike = {
  name_original?: string;
  name_translated?: string | Record<string, string>;
  description?: string;
  category?: string;
  ingredients?: unknown[];
  included_items?: unknown[];
  allergens?: unknown[];
  taste_profile?: unknown[];
  confidence?: number;
};

function cleanLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function appendDescription(existing: string, addition: string): string {
  const cleanExisting = cleanLine(existing);
  const cleanAddition = cleanLine(addition);
  if (!cleanAddition) return cleanExisting;
  if (!cleanExisting) return cleanAddition;
  if (cleanExisting.includes(cleanAddition)) return cleanExisting;
  return `${cleanExisting} ${cleanAddition}`;
}

function splitLongOriginalName(value: string): { name: string; detail: string } | null {
  const clean = cleanLine(value);
  if (clean.length < 48) return null;

  let name = clean;
  let detail = "";
  const commaIndex = clean.search(/[,，；;]/);
  if (commaIndex > 12) {
    name = clean.slice(0, commaIndex).trim();
    detail = clean.slice(commaIndex + 1).trim();
  }

  const connectorMatch = name.match(
    /^(.{8,}?)\s+\b(marinated|served|with|accompanied|topped|finished|paired)\b\s+(.+)$/i,
  );
  if (connectorMatch) {
    name = connectorMatch[1].trim();
    detail = appendDescription(`${connectorMatch[2]} ${connectorMatch[3]}`, detail);
  }

  if (!detail || name.length < 4 || name.length > clean.length * 0.8) return null;
  return { name, detail };
}

function splitLongTranslatedName(value: string): { name: string; detail: string } | null {
  const clean = cleanLine(value);
  if (clean.length < 18) return null;

  const connectorMatch = clean.match(/^(.{4,}?)(配以|佐以|搭配|配|佐|伴)(.+)$/);
  if (connectorMatch) {
    return {
      name: connectorMatch[1].trim(),
      detail: `${connectorMatch[2]}${connectorMatch[3]}`.trim(),
    };
  }

  const punctuationIndex = clean.search(/[，,；;]/);
  if (punctuationIndex > 4) {
    return {
      name: clean.slice(0, punctuationIndex).trim(),
      detail: clean.slice(punctuationIndex + 1).trim(),
    };
  }

  return null;
}

function maybeNormalizeTranslatedName(dish: DishLike): string {
  const translated = dish.name_translated;
  if (typeof translated !== "string") return "";
  const split = splitLongTranslatedName(translated);
  if (!split) {
    dish.name_translated = cleanLine(translated);
    return "";
  }
  dish.name_translated = split.name;
  return split.detail;
}

function inferFoodCategory(dish: DishLike): string | undefined {
  const text = [
    dish.name_original,
    typeof dish.name_translated === "string" ? dish.name_translated : "",
    dish.description,
    ...(Array.isArray(dish.ingredients) ? dish.ingredients : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const drink = /饮品|饮料|鸡尾酒|果汁|咖啡|茶|wine|beer|cocktail|mocktail|juice|coffee|tea|lemonade|cider/.test(text);
  const food =
    /鹅肝|鸭肝|扇贝|鱼|虾|蟹|贝|蘑菇|芦笋|南瓜|鱼子|面包|肉|鸡|鸭|牛|羊|猪|foie gras|scallop|oyster|mushroom|asparagus|pumpkin|roe|brioche|fish|shrimp|crab|duck|beef|lamb|pork|chicken/.test(
      text,
    );
  if (drink && !food) return "drink";
  if (/甜点|甜品|冰沙|雪葩|蛋糕|dessert|sorbet|cake|mousse|tart|panna cotta/.test(text)) return "dessert";
  if (/鹅肝|鸭肝|扇贝|生蚝|沙拉|前菜|foie gras|scallop|oyster|salad|starter|appetizer/.test(text)) {
    return "appetizer";
  }
  if (/披萨|意面|米饭|面包|pizza|pasta|rice|noodle|burger|sandwich/.test(text)) return "staple";
  if (food) return "main";
  return undefined;
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
    const split = splitLongOriginalName(name);
    if (split) {
      dish.name_original = split.name;
      dish.description = appendDescription(description, split.detail);
    } else {
      dish.name_original = cleanLine(name);
    }
  }

  const translatedDetail = maybeNormalizeTranslatedName(dish);
  if (translatedDetail) {
    dish.description = appendDescription(typeof dish.description === "string" ? dish.description : "", translatedDetail);
  }

  if (typeof dish.description === "string") {
    dish.description = cleanLine(dish.description);
  }
  if (!Array.isArray(dish.ingredients)) dish.ingredients = [];
  if (!Array.isArray(dish.included_items)) dish.included_items = [];
  if (!Array.isArray(dish.allergens)) dish.allergens = [];
  if (!Array.isArray(dish.taste_profile)) dish.taste_profile = [];
  if (dish.confidence === undefined) dish.confidence = 0.7;

  const inferredCategory = inferFoodCategory(dish);
  if (inferredCategory && inferredCategory !== dish.category) {
    const current = (dish.category || "").toLowerCase();
    if (!current || current === "drink" || current === "dessert" || inferredCategory === "drink") {
      dish.category = inferredCategory;
    }
  }

  return dish;
}
