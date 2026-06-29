"use client";

import { useState, useEffect } from "react";
import type { Dish } from "@/types";
import { getReviews } from "@/lib/api-client";
import { getDishIncludedItems, getDishInsight, getDishText, isVegetarianDish } from "@/lib/dish-presentation";
import type { DishDisplayTag, DishDisplayTagType } from "@/lib/dish-display-tags";
import { getDishPriceDisplay, stripPriceFromOriginalName } from "@/lib/dish-price-display";
import DishImageWithLoading from "@/components/shared/DishImageWithLoading";
import OrderSummaryDock from "@/components/order/OrderSummaryDock";
import type { RestaurantSource } from "@/lib/location-recommendation";

// ── Pill ────────────────────────────────────────────────────────────

function Pill({ label, type }: { label: string; type: DishDisplayTagType }) {
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

function RestaurantSourceIcon() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center"
      style={{
        width: 34,
        height: 34,
        flex: "0 0 34px",
        borderRadius: 14,
        background: "rgba(255,159,28,0.10)",
        color: "var(--accent)",
      }}
    >
      <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" }}>
        <path d="M5 11.5h14l-1 7H6l-1-7Z" />
        <path d="M7 11.5V8.8C7 6.7 9.2 5 12 5s5 1.7 5 3.8v2.7" />
        <path d="M9 15h.1M12 15h.1M15 15h.1" />
        <path d="M4 19h16" />
      </svg>
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
  smartTags?: DishDisplayTag[];
  orderQuantity?: number;
  orderTotalQuantity?: number;
  orderTotalLabel?: string;
  restaurantSource?: RestaurantSource | null;
  onOrderQuantityChange?: (dish: Dish, quantity: number) => void;
  onOpenOrderConfirm?: () => void;
}

export default function DishDetailPage({ dish, onBack, onReview, showAllergens, targetLang = "zh", uiLang = "zh", isFavorited, onToggleFavorite, onShare, imageGenProgress, smartTags = [], orderQuantity = 0, orderTotalQuantity = 0, orderTotalLabel = "价格待核对", restaurantSource, onOrderQuantityChange, onOpenOrderConfirm }: DishDetailPageProps) {
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
  const dishPriceLabel = getDishPriceDisplay(dish);
  const originalNameLabel = stripPriceFromOriginalName(dishText.originalName) || dishText.originalName;
  const insight = getDishInsight(dish, targetLang);
  const ingredients = (dish.ingredients || []).join("、");
  const includedItems = getDishIncludedItems(dish, targetLang);

  const isVeg = isVegetarianDish(dish);
  const tags = smartTags;

  const allergenRow = showAllergens && dish.allergens?.length
    ? `⚠ 过敏原：${dish.allergens.join("、")}`
    : "";

  const cuisine = dish.cuisine_region || dish.category || "";
  const tasteStr = (dish.taste_profile || []).join(" · ");

  return (
    <div className="h-full flex flex-col relative" style={{ background: "var(--bg)" }}>
      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0">
        <button onClick={onBack} className="text-[11px] cursor-pointer transition-opacity hover:opacity-50" style={{ minWidth: 44, minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "flex-start", color: "var(--ink)", background: "none", border: "none" }}>←</button>
        <span className="text-xs font-bold flex-1" style={{ fontFamily: "var(--font-body)", color: "var(--ink)" }}>菜品详情</span>
        {onShare ? (
          <button
            onClick={onShare}
            className="inline-flex items-center justify-center transition-opacity hover:opacity-70"
            aria-label="分享菜单"
            style={{ width: 44, height: 44, borderRadius: "50%", border: "none", background: "rgba(45,45,45,0.06)", color: "var(--ink)", cursor: "pointer" }}
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
          style={{ minHeight: 44, padding: "0 2px 0 6px", fontFamily: "var(--font-body)", color: faved ? "var(--accent)" : "var(--primary)", background: "none", border: "none", cursor: "pointer" }}
        >
          <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, stroke: faved ? "var(--accent)" : "var(--primary)", fill: faved ? "var(--accent)" : "none", strokeWidth: 2, strokeLinecap: "round", animation: faved ? "heartbeat 0.6s ease-out" : "none" }}>
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z" />
          </svg>
          {faved ? "已收藏" : "收藏"}
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-auto" style={{ paddingBottom: onOrderQuantityChange ? 120 : 0 }}>
        {/* Keep the existing detail content visible above the ordering dock. */}
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
          <div className="flex items-start gap-2" style={{ marginBottom: 2 }}>
            <div className="min-w-0 flex-1" style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.01em" }}>
              {dishText.translatedName}
            </div>
            {dishPriceLabel ? (
              <span
                style={{
                  flexShrink: 0,
                  paddingTop: 4,
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  fontWeight: 800,
                  color: "var(--ink)",
                  lineHeight: 1.2,
                }}
              >
                {dishPriceLabel}
              </span>
            ) : null}
          </div>
          <div style={{ fontFamily: "var(--font-body)", fontSize: 10, color: "var(--muted)", fontStyle: "italic", marginBottom: 8 }}>
            {originalNameLabel}
            {dish.rating_avg ? (
              <span> &nbsp;·&nbsp; <span style={{ color: "var(--accent)", fontWeight: 700, fontStyle: "normal" }}>★ {dish.rating_avg}</span></span>
            ) : null}
          </div>

          {restaurantSource ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                margin: "10px 0 14px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--rule)",
                background: "rgba(255,250,242,0.72)",
              }}
            >
              <RestaurantSourceIcon />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 10,
                    fontWeight: 800,
                    color: "var(--ink)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {restaurantSource.localizedName || restaurantSource.name}
                </div>
                <div style={{ fontFamily: "var(--font-ui)", fontSize: 8, color: "var(--muted)", marginTop: 2 }}>
                  {[restaurantSource.distanceLabel, restaurantSource.rating ? `餐馆 ${restaurantSource.rating}` : null, restaurantSource.address].filter(Boolean).join(" · ")}
                </div>
              </div>
              <a
                href={restaurantSource.navigationUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
                style={{
                  flexShrink: 0,
                  minWidth: 58,
                  minHeight: 36,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 18,
                  border: "1px solid rgba(76,175,80,0.25)",
                  background: "rgba(76,175,80,0.08)",
                  color: "var(--primary)",
                  fontFamily: "var(--font-body)",
                  fontSize: 9,
                  fontWeight: 800,
                  textDecoration: "none",
                }}
              >
                {uiLang === "en" ? "Route" : "导航"}
              </a>
            </div>
          ) : null}

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

          {includedItems.length > 0 ? (
            <>
              <div style={{ fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 700, color: "var(--ink)", marginBottom: 6, letterSpacing: "0.02em", marginTop: 4 }}>套餐包含</div>
              <div className="flex gap-1.5 flex-wrap" style={{ marginBottom: 12 }}>
                {includedItems.map((item) => (
                  <span
                    key={item}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      minHeight: 22,
                      padding: "3px 10px",
                      borderRadius: 18,
                      background: "rgba(76,175,80,0.10)",
                      color: "var(--primary)",
                      fontFamily: "var(--font-ui)",
                      fontSize: 8,
                      fontWeight: 700,
                    }}
                  >
                    {item}
                  </span>
                ))}
              </div>
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
      {onOrderQuantityChange && onOpenOrderConfirm ? (
        <OrderSummaryDock
          currentQuantity={orderQuantity}
          totalQuantity={orderTotalQuantity}
          totalLabel={orderTotalLabel}
          onCurrentQuantityChange={(quantity) => onOrderQuantityChange(dish, quantity)}
          onOpenConfirm={onOpenOrderConfirm}
        />
      ) : null}
    </div>
  );
}
