"use client";

import { useState, useEffect } from "react";
import type { Dish } from "@/types";
import { getReviews } from "@/lib/api-client";

// ── Image guess (same logic as ResultsPage) ────────────────────────

const FOOD_IMG: Record<string, string> = {
  pasta: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=600&h=400&fit=crop&auto=format",
  beef: "https://images.unsplash.com/photo-1667396702543-a239efa7a7f2?w=600&h=400&fit=crop&auto=format",
  chicken: "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=600&h=400&fit=crop&auto=format",
  fish: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600&h=400&fit=crop&auto=format",
  salad: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&h=400&fit=crop&auto=format",
  soup: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&h=400&fit=crop&auto=format",
  pizza: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&h=400&fit=crop&auto=format",
  dessert: "https://images.unsplash.com/photo-1616953882462-8a583e0afbb4?w=600&h=400&fit=crop&auto=format",
  rice: "https://images.unsplash.com/photo-1596560548464-f010549b84d7?w=600&h=400&fit=crop&auto=format",
  noodle: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&h=400&fit=crop&auto=format",
  bread: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&h=400&fit=crop&auto=format",
  seafood: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&h=400&fit=crop&auto=format",
  curry: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&h=400&fit=crop&auto=format",
  cheese: "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=600&h=400&fit=crop&auto=format",
  default: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&h=400&fit=crop&auto=format",
};

function guessHeroImg(dish: Dish): string {
  const text = [dish.name_original || "", ...(dish.ingredients || [])].join(" ").toLowerCase();
  for (const [key, url] of Object.entries(FOOD_IMG)) {
    if (key === "default") continue;
    if (text.includes(key)) return url;
  }
  return FOOD_IMG.default;
}

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
}

export default function DishDetailPage({ dish, onBack, onReview, showAllergens }: DishDetailPageProps) {
  const [faved, setFaved] = useState(false);
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

  // Extract real dish data
  const zhName = typeof dish.name_translated === "string"
    ? dish.name_translated
    : typeof dish.name_translated === "object"
    ? (dish.name_translated as Record<string, string>).zh || dish.name_original
    : dish.name_original;

  const zhDesc = typeof dish.description === "string"
    ? dish.description
    : typeof dish.description === "object"
    ? (dish.description as Record<string, string>).zh || ""
    : "";

  const heroImg = dish.ai_image_url || guessHeroImg(dish);
  const ingredients = (dish.ingredients || []).join("、");

  // Build tags
  const tags: { label: string; type: "green" | "warm" | "allergen" | "veg" }[] = [];
  for (const ing of (dish.ingredients || []).slice(0, 3)) {
    tags.push({ label: ing, type: "green" });
  }
  const isVeg = (dish.taste_profile || []).includes("vegetarian") ||
    (dish.ingredients || []).every((ing) =>
      !/肉|鱼|鸡|牛|猪|羊|虾|蟹|贝|蛋|lamb|beef|pork|chicken|fish|meat|seafood|egg/i.test(ing)
    );
  if (isVeg) tags.push({ label: "素食", type: "veg" });
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
        <button
          onClick={() => setFaved(!faved)}
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
          <div className="relative overflow-hidden" style={{ width: "100%", height: 200, borderRadius: "var(--radius-lg)", marginBottom: 16 }}>
            <img src={heroImg} alt={zhName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            {isVeg && (
              <div className="absolute flex items-center justify-center" style={{ bottom: 8, right: 8, width: 24, height: 24, background: "var(--primary)", borderRadius: "50%", animation: "popIn 0.3s ease-out", boxShadow: "0 1px 4px rgba(76,175,80,0.3)" }}>
                <svg viewBox="0 0 12 12" style={{ width: 14, height: 14, stroke: "#FFF", fill: "none", strokeWidth: 1.3, strokeLinecap: "round", strokeLinejoin: "round" }}>
                  <path d="M8 4C4 5 3 8 3.5 10c.5 1.8 2 2.5 3 1 .7-1.1.5-2.7-.5-4" />
                  <path d="M6 2c0 0 1-1.5 3-1s2 2.5 0 4" />
                </svg>
              </div>
            )}
          </div>

          {/* Title + sub */}
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.01em", marginBottom: 2 }}>
            {zhName}
          </div>
          <div style={{ fontFamily: "var(--font-body)", fontSize: 10, color: "var(--muted)", fontStyle: "italic", marginBottom: 8 }}>
            {dish.name_original}
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
          {zhDesc ? (
            <>
              <div style={{ fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 700, color: "var(--ink)", marginBottom: 6, letterSpacing: "0.02em", marginTop: 4 }}>风味特征</div>
              <div style={{ fontFamily: "var(--font-ui)", fontSize: 10, color: "var(--ink-soft)", lineHeight: 1.65, marginBottom: 12 }}>{zhDesc}</div>
            </>
          ) : null}

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
