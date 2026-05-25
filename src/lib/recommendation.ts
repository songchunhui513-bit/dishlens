import type { DishKnowledgeEntry } from "./dish-knowledge-types";

export interface RecommendationContext {
  hour: number;
  dayOfWeek: number;
  dateStr: string;
  temperature?: number;
  country?: string;
}

const TIME_CATEGORIES: Record<string, string[]> = {
  morning: ["breakfast", "appetizer", "soup", "bread", "side"],
  lunch: ["main", "soup", "noodle", "rice", "pasta", "stew"],
  afternoon: ["dessert", "snack", "drink", "appetizer", "side"],
  dinner: ["main", "soup", "noodle", "rice", "pasta", "stew"],
};

const COLD_CATEGORIES = new Set(["soup", "stew", "bread", "main", "noodle"]);
const HOT_CATEGORIES = new Set(["salad", "drink", "dessert", "appetizer", "side"]);

const COUNTRY_CUISINE: Record<string, string[]> = {
  FR: ["french"], JP: ["japanese"], IT: ["italian"], CN: ["chinese"],
  KR: ["korean"], TH: ["thai"], MX: ["mexican"], ES: ["spanish"],
  IN: ["indian"], TR: ["turkish"], VN: ["vietnamese"], BR: ["brazilian"],
  DE: ["german"], GB: ["british"], GR: ["greek"], PE: ["peruvian"],
  SG: ["singaporean", "chinese"], PH: ["filipino"], ID: ["indonesian"],
  MA: ["moroccan"], ET: ["ethiopian"],
};

function getTimeSlot(hour: number): keyof typeof TIME_CATEGORIES {
  if (hour >= 6 && hour < 10) return "morning";
  if (hour >= 10 && hour < 15) return "lunch";
  if (hour >= 15 && hour < 18) return "afternoon";
  return "dinner";
}

function hashDate(dateStr: string): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    const ch = dateStr.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return Math.abs(hash);
}

// Lazy-load from static JSON — avoids 1.6MB+ TS compilation
let _db: DishKnowledgeEntry[] | null = null;
let _dbPromise: Promise<DishKnowledgeEntry[]> | null = null;

function getDb(): Promise<DishKnowledgeEntry[]> {
  if (_db) return Promise.resolve(_db);
  if (_dbPromise) return _dbPromise;

  _dbPromise = fetch("/dish-knowledge-db.json")
    .then((r) => r.json())
    .then((data: DishKnowledgeEntry[]) => {
      _db = data;
      return data;
    })
    .catch(() => {
      _dbPromise = null;
      return [] as DishKnowledgeEntry[];
    });

  return _dbPromise;
}

export async function getDailyRecommendation(ctx: RecommendationContext): Promise<DishKnowledgeEntry> {
  const db = await getDb();
  if (db.length === 0) {
    // Fallback: return a minimal placeholder
    return {
      id: "fallback", names: ["Dish of the Day"], cuisine: "international",
      category: "main", description: { zh: "", en: "" },
      recommendation: { zh: "", en: "" }, good_for: "", caution: "",
      ingredients: [], allergens: [], taste_profile: [],
      calories: null, spice_level: null, reviews: [], card: "", hero: "",
    };
  }

  const timeSlot = getTimeSlot(ctx.hour);
  const timeCategories = TIME_CATEGORIES[timeSlot];
  const isWeekend = ctx.dayOfWeek === 0 || ctx.dayOfWeek === 6;

  let pool = db.filter((d) => timeCategories.some((cat) => d.category === cat));

  if (ctx.temperature != null) {
    if (ctx.temperature < 10) {
      const cold = pool.filter((d) => COLD_CATEGORIES.has(d.category));
      if (cold.length >= 5) pool = cold;
    } else if (ctx.temperature > 28) {
      const hot = pool.filter((d) => HOT_CATEGORIES.has(d.category));
      if (hot.length >= 5) pool = hot;
    }
  }

  if (isWeekend) {
    const indulgent = pool.filter(
      (d) =>
        d.category === "dessert" ||
        d.category === "main" ||
        d.taste_profile.some((t) => ["浓郁", "奶香", "甜"].includes(t))
    );
    if (indulgent.length >= 5) pool = indulgent;
  }

  if (ctx.country) {
    const preferredCuisines = COUNTRY_CUISINE[ctx.country.toUpperCase()];
    if (preferredCuisines) {
      const local = pool.filter((d) =>
        preferredCuisines.some((c) => d.cuisine === c)
      );
      if (local.length >= 3) pool = local;
    }
  }

  if (pool.length === 0) pool = db;

  const withImage = pool.filter((d) => (d.card || d.hero)?.startsWith("/"));
  if (withImage.length >= 5) pool = withImage;

  const idx = hashDate(ctx.dateStr) % pool.length;
  return pool[idx];
}
