"use client";

import { useState, useEffect } from "react";
import type { Dish } from "@/types";
import { getReviews } from "@/lib/api-client";
import { getDishInsight, getDishText, isVegetarianDish } from "@/lib/dish-presentation";
import DishImageWithLoading from "@/components/shared/DishImageWithLoading";

// ── Pill ────────────────────────────────────────────────────────────

function Pill({ label, type }: { label: string; type: "green" | "warm" | "allergen" | "veg" }) {
  const bgMap: Record<string, string> = {
    green: "rgba(76,175,80,0.12)",
    warm: "rgba(45,45,45,0.06)",
    allergen: "var(--allergen-bg)",
    veg: "var(--veg-bg)",
  };
  const colorMap: Record<string, string> = {
    green: "var(--primary)",
    warm: "var(--muted)",
    allergen: "var(--accent)",
    veg: "var(--primary)",
  };
  return (
    <span
      className="inline-flex items-center gap-0.5"
      style={{
        fontFamily: "var(--font-ui)",
        fontSize: "7.5px",
        fontWeight: type === "allergen" || type === "veg" ? 700 : 600,
        padding: "3px 9px",
        borderRadius: 20,
        letterSpacing: "0.03em",
        background: bgMap[type],
        color: colorMap[type],
      }}
    >
      {label}
    </span>
  );
}

// ── Page ────────────────────────────────────────────────────────────

interface DishDetailPageProps {
  dish: Dish | null;
  onBack: () => void;
  onReview: () => void;
  showAllergens?: boolean;
  targetLang?: string;
  uiLang?: "zh" | "en";
  isFavorited?: boolean;
  onToggleFavorite?: (dishId: string, faved: boolean) => void;
  onShare?: () => void;
  imageGenProgress?: { done: number; total: number };
}

export default function DishDetailPage({ dish, onBack, onReview, showAllergens, targetLang = "zh", isFavorited, onToggleFavorite, onShare, imageGenProgress }: DishDetailPageProps) {
  const [faved, setFaved] = useState(isFavorited ?? false);
  const [reviews, setReviews] = useState<Array<{ text: string; author: string; time: string }>>([]);

  useEffect(() => {
    if (dish?.id) {
      getReviews(dish.id, 1, "recent").then((data) => {
        setReviews(
          data.reviews.slice(0, 3).map((r) => ({
            text: r.content,
            author: r.user_name || "匿名",
            time: r.created_at ? new Date(r.created_at).toLocaleDateString("zh-CN") : "",
          }))
        );
      }).catch(() => {});
    }
  }, [dish?.id]);

  if (!dish) {
    return (
      <div className="h-full flex flex-col items-center justify-center" style={{ background: "var(--bg)" }}>
        <div style={{ fontFamily: "var(--font-body)", fontSize: 10, color: "var(--muted)" }}>暂无菜品数据</div>
        <button onClick={onBack} style={{ marginTop: 12, fontFamily: "var(--font-ui)", fontSize: 9, color: "var(--primary)", background: "none", border: "none", cursor: "pointer" }}>← 返回</button>
      </div>
    );
  }

  const dishText = getDishText(dish, targetLang);
  const insight = getDishInsight(dish, targetLang);
  const ingredients = (dish.ingredients || []).join("、");

  // Build tags
  const tags: { label: string; type: "green" | "warm" | "allergen" | "veg" }[] = [];
  for (const ing of (dish.ingredients || []).slice(0, 3)) {
    tags.push({ label: ing, type: "green" });
  }
  const isVeg = isVegetarianDish(dish);
  if (isVeg) tags.push({ label: "素食", type: "veg" });
  tags.push({ label: insight.confidenceLabel, type: "warm" });
  if (showAllergens && dish.allergens?.length) {
    const labels: Record<string, string> = {
      dairy: "⚠ 乳制品", egg: "⚠ 蛋", peanut: "⚠ 花生", tree_nut: "⚠ 坚果",
      soy: "⚠ 大豆", wheat: "⚠ 小麦", gluten: "⚠ 麸质", fish: "⚠ 鱼类",
      shellfish: "⚠ 贝类", alcohol: "⚠ 酒精",
    };
    for (const a of dish.allergens) {
      tags.push({ label: labels[a] || `⚠ ${a}`, type: "allergen" });
    }
  }

  const allergenRow = showAllergens && dish.allergens?.length
    ? `⚠ 过敏原：${dish.allergens.join("、")}`
    : "";

  const cuisine = dish.cuisine_region || dish.category || "";
  const tasteStr = (dish.taste_profile || []).join(" · ");

  return (
    <div className="h-full flex flex-col" style={{ background: "var(--bg)" }}>
      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0">
        <button onClick={onBack} className="text-[11px] cursor-pointer transition-opacity hover:opacity-50" style={{ color: "var(--ink)", background: "none", border: "none" }}>←</button>
        <span className="text-xs font-bold flex-1" style={{ fontFamily: "var(--font-body)", color: "var(--ink)" }}>菜品详情</span>
        {onShare ? (
          <button
            onClick={onShare}
            className="inline-flex items-center justify-center transition-opacity hover:opacity-70"
            aria-label="分享菜单"
            style={{ width: 28, height: 28, borderRadius: "50%", border: "none", background: "rgba(45,45,45,0.06)", color: "var(--ink)", cursor: "pointer" }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 14, height: 14, stroke: "currentColor", fill: "none", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }}>
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <path d="M8.6 10.7 15.4 6.3" />
              <path d="M8.6 13.3 15.4 17.7" />
            </svg>
          </button>
        ) : null}
        <button
          onClick={() => {
              const next = !faved;
              setFaved(next);
              if (dish?.id) onToggleFavorite?.(dish.id, next);
            }}
          className="flex items-center gap-0.5 text-[9px] font-bold transition-all duration-200"
          style={{ fontFamily: "var(--font-body)", color: faved ? "var(--accent)" : "var(--primary)", background: "none", border: "none", cursor: "pointer" }}
        >
          <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, stroke: faved ? "var(--accent)" : "var(--primary)", fill: faved ? "var(--accent)" : "none", strokeWidth: 2, strokeLinecap: "round", animation: faved ? "heartbeat 0.6s ease-out" : "none" }}>
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z" />
          </svg>
          {faved ? "已收藏" : "收藏"}
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-auto">
        <div style={{ padding: "0 16px 16px" }}>
          {/* Hero image */}
          <div style={{ marginBottom: 16 }}>
            <DishImageWithLoading dish={dish} size="hero" alt={dishText.translatedName} pendingDone={imageGenProgress?.done} pendingTotal={imageGenProgress?.total}>
            {isVeg && (
              <div className="absolute flex items-center justify-center" style={{ bottom: 8, right: 8, width: 24, height: 24, background: "var(--primary)", borderRadius: "50%", animation: "popIn 0.3s ease-out", boxShadow: "0 1px 4px rgba(76,175,80,0.3)" }}>
                <svg viewBox="0 0 12 12" style={{ width: 14, height: 14, stroke: "#FFF", fill: "none", strokeWidth: 1.3, strokeLinecap: "round", strokeLinejoin: "round" }}>
                  <path d="M8 4C4 5 3 8 3.5 10c.5 1.8 2 2.5 3 1 .7-1.1.5-2.7-.5-4" />
                  <path d="M6 2c0 0 1-1.5 3-1s2 2.5 0 4" />
                </svg>
              </div>
            )}
            </DishImageWithLoading>
          </div>

          {/* Title + sub */}
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.01em", marginBottom: 2 }}>
            {dishText.translatedName}
          </div>
          <div style={{ fontFamily: "var(--font-body)", fontSize: 10, color: "var(--muted)", fontStyle: "italic", marginBottom: 8 }}>
            {dishText.originalName}
            {dish.rating_avg ? (
              <span> &nbsp;·&nbsp; <span style={{ color: "var(--accent)", fontWeight: 700, fontStyle: "normal" }}>★ {dish.rating_avg}</span></span>
            ) : null}
          </div>

          {/* Allergen row */}
          {allergenRow && (
            <div className="flex flex-wrap items-center gap-1.5" style={{ padding: "10px 14px", marginBottom: 12, background: "var(--allergen-bg)", borderRadius: "var(--radius-sm)", fontFamily: "var(--font-ui)", fontSize: 8, fontWeight: 600, color: "var(--accent)" }}>
              {allergenRow}
            </div>
          )}

          {/* Meta row */}
          {cuisine ? (
            <div className="flex gap-3.5" style={{ marginBottom: 12, fontFamily: "var(--font-ui)", fontSize: 8, color: "var(--muted)" }}>
              <span>菜系 <span style={{ fontWeight: 600, color: "var(--ink-soft)" }}>{cuisine}</span></span>
              {tasteStr ? <span>风味 <span style={{ fontWeight: 600, color: "var(--ink-soft)" }}>{tasteStr}</span></span> : null}
            </div>
          ) : null}

          {/* Ingredients */}
          {ingredients ? (
            <>
              <div style={{ fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 700, color: "var(--ink)", marginBottom: 6, letterSpacing: "0.02em", marginTop: 4 }}>食材</div>
              <div style={{ fontFamily: "var(--font-ui)", fontSize: 10, color: "var(--ink-soft)", lineHeight: 1.65, marginBottom: 12 }}>{ingredients}</div>
            </>
          ) : null}

          {/* Pills */}
          {tags.length > 0 && (
            <div className="flex gap-1.5 flex-wrap" style={{ marginBottom: 12 }}>
              {tags.map((t, i) => <Pill key={i} label={t.label} type={t.type} />)}
            </div>
          )}

          {/* Flavor description */}
          <div style={{ fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 700, color: "var(--ink)", marginBottom: 6, letterSpacing: "0.02em", marginTop: 4 }}>风味特征</div>
          <div style={{ fontFamily: "var(--font-ui)", fontSize: 10, color: "var(--ink-soft)", lineHeight: 1.65, marginBottom: 12 }}>{insight.summary}</div>

          <div style={{ fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 700, color: "var(--ink)", marginBottom: 6, letterSpacing: "0.02em", marginTop: 4 }}>点单建议</div>
          <div style={{ fontFamily: "var(--font-ui)", fontSize: 10, color: "var(--ink-soft)", lineHeight: 1.65, marginBottom: 8 }}>{insight.recommendation}</div>
          <div style={{ fontFamily: "var(--font-ui)", fontSize: 9, color: "var(--muted)", lineHeight: 1.55, marginBottom: 12 }}>
            {insight.goodFor} {insight.caution}
          </div>

          {/* Reviews section */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 700, color: "var(--ink)", marginBottom: 6, letterSpacing: "0.02em", marginTop: 4 }}>食客评价</div>
            {reviews.length > 0 ? (
              <>
                <div className="flex items-center gap-2.5" style={{ marginBottom: 10 }}>
                  <span style={{ fontSize: 14, color: "var(--accent)", letterSpacing: 1 }}>★★★★★</span>
                  <span style={{ fontFamily: "var(--font-ui)", fontSize: 9, color: "var(--muted)" }}>{dish.review_count || reviews.length} 条评价</span>
                </div>
                <div className="flex flex-col gap-2">
                  {reviews.map((r, i) => (
                    <div key={i} style={{ fontFamily: "var(--font-ui)", fontSize: 9, color: "var(--ink-soft)", fontStyle: "italic", lineHeight: 1.5, paddingLeft: 8, borderLeft: "2px solid var(--rule)" }}>
                      「{r.text}」
                      <span style={{ display: "block", fontSize: 7, color: "var(--muted)", fontStyle: "normal", marginTop: 2 }}>— {r.author}{r.time ? ` · ${r.time}` : ""}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ fontFamily: "var(--font-ui)", fontSize: 9, color: "var(--muted)", fontStyle: "italic", padding: "12px 0" }}>
                暂无评价，成为第一个评价的人
              </div>
            )}
            <div style={{ marginTop: 10 }}>
              <button
                onClick={onReview}
                className="flex items-center justify-center gap-1 w-full py-2 transition-opacity hover:opacity-70"
                style={{ fontFamily: "var(--font-body)", fontSize: 9, fontWeight: 700, color: "var(--primary)", background: "none", border: "none", cursor: "pointer" }}
              >
                我吃过这道菜，去评价 →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
