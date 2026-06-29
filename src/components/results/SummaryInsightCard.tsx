"use client";

import CuisineIllustration from "@/components/shared/CuisineIllustration";
import type { Dish, MenuInsight, RestaurantMeta, SignatureRecommendation } from "@/types";
import { sourceLanguageName } from "@/lib/order-state";
import { buildMenuSmartTags } from "@/lib/results-menu-tags";
import { getRestaurantDisplayMeta } from "@/lib/restaurant-display";

interface Props {
  lang: string;
  restaurant?: RestaurantMeta;
  insight?: MenuInsight;
  signature?: SignatureRecommendation;
  dishNameLookup: (id: string) => string | undefined;
  totalDishes: number;
  pageCount: number;
  dishes?: Dish[];
  targetLang?: string;
}

const CUISINE_INSIGHT: Record<string, string> = {
  fr: "经典法式料理，注重酱汁与食材本味的平衡，前菜和甜点是法餐的灵魂所在。",
  it: "传统意大利风味，橄榄油、番茄和新鲜香料是基调，面食和开胃菜选择丰富。",
  ja: "日式料理讲究季节感和食材原味，摆盘精致，从刺身到煮物各有层次。",
  ko: "韩式料理以发酵调味为核心，小菜丰富，烤肉和汤品是桌上的主角。",
  es: "西班牙美食热情奔放，橄榄油和海鲜是灵魂，Tapas 文化让人一次尝遍多样风味。",
  th: "泰式料理酸辣鲜香层次分明，椰奶、香茅和鱼露构建出独特的东南亚味觉。",
  de: "德式料理扎实饱足，香肠和啤酒是经典搭配，酱汁浓郁适合大快朵颐。",
  zh: "中式料理讲究火候和调味平衡，炒菜为主，一桌人分享最是热闹。",
  en: "经典西式料理，分量扎实，从开胃菜到甜点一应俱全，适合轻松聚餐。",
};

const FALLBACK_INSIGHT = (lang: string, total: number): MenuInsight => ({
  summary: CUISINE_INSIGHT[lang] || `这份菜单包含 ${total} 道菜品，种类丰富。`,
  occasion_tags: [],
  cuisine_style: sourceLanguageName(lang),
});

export default function SummaryInsightCard({
  lang,
  restaurant,
  insight,
  signature,
  dishNameLookup,
  totalDishes,
  pageCount,
  dishes = [],
  targetLang = "zh",
}: Props) {
  const r = getRestaurantDisplayMeta(lang, targetLang, restaurant);
  const i = insight || FALLBACK_INSIGHT(lang, totalDishes);
  const smartTags = buildMenuSmartTags({ sourceLang: lang, dishes, aiTags: i.occasion_tags });
  const sigNames = signature?.dish_ids?.map(dishNameLookup).filter(Boolean) as string[] | undefined;
  const sigDishes = sigNames?.length ? sigNames.join("、") : null;
  const sigReason = signature?.reason || (sigDishes ? "值得一试" : "");
  const hasInsight = !!(i.summary);
  const hasSignature = !!sigDishes;
  const hasContent = hasInsight || smartTags.length > 0 || hasSignature;

  return (
    <div
      style={{
        margin: "10px 16px 0",
        padding: 14,
        borderRadius: "var(--radius-lg)",
        background: "var(--card)",
        boxShadow: "var(--shadow)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{ width: 36, height: 36, borderRadius: 14, background: "var(--card-alt)", border: "1px solid rgba(232,213,192,0.62)", display: "grid", placeItems: "center", flexShrink: 0, overflow: "hidden" }}>
          <CuisineIllustration lang={lang} size={32} />
        </div>
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
          <span style={{ font: "800 13px var(--font-display)", color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {r.display_name}
          </span>
          <span style={{ font: "800 11px var(--font-ui)", color: "var(--accent)", whiteSpace: "nowrap", flexShrink: 0 }}>
            {r.rating_estimate > 0 ? `★ ${r.rating_estimate.toFixed(1)}` : ""}
          </span>
        </div>
      </div>
      <div style={{ font: "700 7.5px var(--font-ui)", color: "var(--muted)", marginBottom: hasContent ? 8 : 0 }}>
        {pageCount} 页菜单 · {totalDishes} 道菜品
      </div>

      {hasInsight && (
        <p
          style={{
            font: "650 8.5px/1.6 var(--font-ui)",
            color: "var(--ink-soft)",
            padding: "8px 0 0",
            borderTop: "1px solid var(--rule)",
            margin: "0 0 10px",
          }}
        >
          {i.summary}
        </p>
      )}

      {smartTags.length > 0 && (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: hasSignature ? 10 : 0 }}>
          {smartTags.map((tag) => (
            <span
              key={tag}
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: 20,
                padding: "0 8px",
                borderRadius: 999,
                background: "rgba(45,45,45,0.06)",
                color: "var(--ink-soft)",
                font: "760 7.5px var(--font-ui)",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {hasSignature && (
        <div
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            background: "var(--veg-bg)",
            display: "flex",
            alignItems: "flex-start",
            gap: 6,
          }}
        >
          <span style={{ font: "700 7.5px var(--font-ui)", color: "var(--primary)", whiteSpace: "nowrap" }}>
            招牌推荐
          </span>
          <span style={{ font: "650 7.5px/1.5 var(--font-ui)", color: "var(--ink-soft)" }}>
            {sigDishes} — {sigReason}
          </span>
        </div>
      )}
    </div>
  );
}
