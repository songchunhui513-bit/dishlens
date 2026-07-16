import type { RestaurantMeta, MenuInsight, SignatureRecommendation } from "@/types";
import { isPlaceholderRestaurantName } from "@/lib/restaurant-display";

interface PageLike {
  source_language?: string;
  dishes?: Array<{
    id: string;
    rating_avg?: number;
    category?: string;
    description?: Record<string, string> | string;
    taste_profile?: string[];
  }>;
  menu_metadata?: {
    restaurant?: Partial<RestaurantMeta>;
    insight?: Partial<MenuInsight>;
    signature?: { dish_indexes?: number[]; reason?: string };
  };
}

export function extractRestaurantMeta(pages: PageLike[]): RestaurantMeta | undefined {
  for (const page of pages) {
    const m = page.menu_metadata?.restaurant;
    if (m && m.display_name && !isPlaceholderRestaurantName(m.display_name)) {
      return {
        display_name: String(m.display_name).slice(0, 60),
        restaurant_type: String(m.restaurant_type || "").slice(0, 30),
        rating_estimate: typeof m.rating_estimate === "number" ? m.rating_estimate : 0,
      };
    }
  }
  return undefined;
}

export function extractMenuInsight(pages: PageLike[]): MenuInsight | undefined {
  for (const page of pages) {
    const i = page.menu_metadata?.insight;
    if (i && i.summary) {
      return {
        summary: String(i.summary).slice(0, 120),
        occasion_tags: Array.isArray(i.occasion_tags)
          ? i.occasion_tags.filter((t): t is string => typeof t === "string").slice(0, 6)
          : [],
        cuisine_style: String(i.cuisine_style || "").slice(0, 40),
      };
    }
  }
  return undefined;
}

export function extractSignature(
  pages: PageLike[],
  primaryMetadata?: { menu_metadata?: { signature?: { dish_indexes?: number[]; reason?: string } } }
): SignatureRecommendation | undefined {
  const findSignature = (pageMetadata: { menu_metadata?: { signature?: { dish_indexes?: number[]; reason?: string } } } | undefined) => {
    const sig = pageMetadata?.menu_metadata?.signature;
    if (!sig) return undefined;
    const indexes = Array.isArray(sig.dish_indexes) ? sig.dish_indexes : [];
    if (!indexes.length) return undefined;
    const flatDishes = pages.flatMap(p => p.dishes || []);
    const dishIds: string[] = [];
    for (const idx of indexes) {
      const found = flatDishes[idx];
      if (found?.id) dishIds.push(found.id);
    }
    if (!dishIds.length) return undefined;
    return { dish_ids: dishIds, reason: String(sig.reason || "").slice(0, 60) };
  };

  if (primaryMetadata) {
    const fromPrimary = findSignature(primaryMetadata);
    if (fromPrimary) return fromPrimary;
  }
  // Walk pages in order until we find a signature with at least one valid dish
  for (const page of pages) {
    const fromPage = findSignature(page);
    if (fromPage && fromPage.dish_ids.length) return fromPage;
  }
  // No AI signature → recommend from top rated dishes
  const all = pages.flatMap(p => p.dishes || []);
  const rated = all
    .filter(d => typeof d.rating_avg === "number" && d.rating_avg >= 4.0)
    .sort((a, b) => (b.rating_avg || 0) - (a.rating_avg || 0))
    .slice(0, 2);
  if (rated.length > 0) {
    return {
      dish_ids: rated.map(d => d.id),
      reason: "基于食客评分推荐",
    };
  }
  // Last resort: pick first 2 dishes (still useful)
  const firstTwo = all.slice(0, 2);
  if (firstTwo.length > 0) {
    return {
      dish_ids: firstTwo.map(d => d.id),
      reason: "菜单精选推荐",
    };
  }
  return undefined;
}
