"use client";

import type { OrderedVisit } from "@/types";
import { formatOrderPrice, sourceLanguageName, summarizeOrder } from "@/lib/order-state";
import { getRestaurantDisplayMeta } from "@/lib/restaurant-display";
import CuisineIllustration from "@/components/shared/CuisineIllustration";

interface OrderedPageProps {
  visits: OrderedVisit[];
  onBack: () => void;
  onSelect: (visit: OrderedVisit) => void;
  onReviewRestaurant?: (visit: OrderedVisit) => void;
}

export default function OrderedPage({ visits, onBack, onSelect, onReviewRestaurant }: OrderedPageProps) {
  const isEmpty = visits.length === 0;

  return (
    <div className="h-full flex flex-col" style={{ background: "var(--bg)" }}>
      <div className="flex items-center gap-2 flex-shrink-0" style={{ padding: "48px 20px 10px", borderBottom: "1px solid var(--rule)" }}>
        <button onClick={onBack} className="text-[11px] cursor-pointer transition-opacity hover:opacity-50" style={{ color: "var(--ink)", background: "none", border: "none" }}>←</button>
        <h2 style={{ fontFamily: "var(--font-body)", fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>点过</h2>
      </div>

      <div className="flex-1 overflow-auto" style={{ padding: "14px 16px" }}>
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center text-center" style={{ padding: "70px 24px" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--card)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
              <svg viewBox="0 0 24 24" style={{ width: 28, height: 28, stroke: "var(--primary)", fill: "none", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" }}>
                <path d="M5 12l4 4L19 6" />
              </svg>
            </div>
            <h3 style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>还没有点过记录</h3>
            <p style={{ fontFamily: "var(--font-ui)", fontSize: 9, color: "var(--muted)", lineHeight: 1.5 }}>翻译菜单后选择菜品，确认已点就会保存在这里。</p>
          </div>
        ) : visits.map((visit) => {
          const summary = summarizeOrder(visit.items);
          const date = new Date(visit.date);
          const restaurantMeta = getRestaurantDisplayMeta(
            visit.source_lang,
            visit.target_lang,
            visit.result_summary?.metadata?.restaurant,
          );
          const isLegacyMenuName = visit.restaurant_name === `${sourceLanguageName(visit.source_lang)}菜单`;
          const restaurantName = visit.restaurant_name && !isLegacyMenuName ? visit.restaurant_name : restaurantMeta.display_name;
          const countryName = visit.country || restaurantMeta.country || sourceLanguageName(visit.source_lang);
          const cityLabel = visit.city || restaurantMeta.city || "";
          const locationMeta = [countryName, cityLabel, date.toLocaleDateString("zh-CN"), `${summary.totalQuantity} 道`].filter(Boolean).join(" · ");

          // Derive flavor/ingredient tags from dishes (up to 4 unique)
          const flavorTags: string[] = [];
          for (const item of visit.items) {
            const ingredients = item.dish.ingredients || [];
            for (const ing of ingredients) {
              if (!flavorTags.includes(ing) && flavorTags.length < 4) {
                flavorTags.push(ing);
              }
            }
          }
          // Fallback to dish names if no ingredients
          if (flavorTags.length === 0) {
            for (const item of visit.items.slice(0, 3)) {
              const name = item.dish.name_translated?.zh || item.dish.name_original;
              if (!flavorTags.includes(name)) flavorTags.push(name);
            }
          }

          return (
            <button
              key={visit.id}
              onClick={() => onSelect(visit)}
              className="w-full text-left transition-all duration-150 active:scale-[0.99]"
              style={{
                padding: 13,
                borderRadius: 22,
                border: "1px solid var(--rule)",
                background: "rgba(254,230,203,0.72)",
                boxShadow: "0 1px 10px rgba(0,0,0,0.025)",
                marginBottom: 10,
                cursor: "pointer",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "42px 1fr auto", gap: 10, alignItems: "center" }}>
                <CuisineIllustration lang={visit.source_lang} size={42} />
                <div className="min-w-0">
                  <h3 style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 800, color: "var(--ink)", margin: "0 0 3px", lineHeight: 1.15 }}>
                    {restaurantName}
                  </h3>
                  <div style={{ fontFamily: "var(--font-ui)", fontSize: 8.5, color: "var(--muted)", fontWeight: 600, lineHeight: 1.35 }}>
                    {locationMeta}
                  </div>
                </div>
                <div style={{ fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 800, color: "var(--ink)", whiteSpace: "nowrap" }}>
                  {formatOrderPrice(summary)}
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {flavorTags.map((tag) => (
                  <span key={tag} className="inline-flex items-center" style={{ height: 20, padding: "0 8px", borderRadius: 999, background: "rgba(76,175,80,0.12)", color: "var(--primary)", fontFamily: "var(--font-ui)", fontSize: 7.5, fontWeight: 700 }}>
                    {tag}
                  </span>
                ))}
                <span className="inline-flex items-center" style={{ height: 20, padding: "0 8px", borderRadius: 999, background: "rgba(45,45,45,0.06)", color: "var(--muted)", fontFamily: "var(--font-ui)", fontSize: 7.5, fontWeight: 700 }}>
                  {visit.restaurant_rating ? `餐厅 ${visit.restaurant_rating}` : "待评价餐厅"}
                </span>
              </div>
              {onReviewRestaurant ? (
                <div style={{ marginTop: 11 }}>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onReviewRestaurant(visit);
                    }}
                    style={{
                      height: 30,
                      padding: "0 11px",
                      border: "1px solid rgba(232,213,192,0.88)",
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.3)",
                      color: "var(--ink-soft)",
                      fontFamily: "var(--font-ui)",
                      fontSize: 8.5,
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    {visit.restaurant_rating ? "改餐厅评价" : "评价餐厅"}
                  </button>
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
