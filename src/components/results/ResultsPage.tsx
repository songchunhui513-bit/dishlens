"use client";

import Image from "next/image";
import type { Dish, TranslationResult } from "@/types";

// ── Fallback mock images (only used when no real images) ──────────────

const FOOD_IMG: Record<string, string> = {
  pasta: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=136&h=136&fit=crop&auto=format",
  pizza: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=136&h=136&fit=crop&auto=format",
  salad: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=136&h=136&fit=crop&auto=format",
  soup: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=136&h=136&fit=crop&auto=format",
  beef: "https://images.unsplash.com/photo-1667396702543-a239efa7a7f2?w=136&h=136&fit=crop&auto=format",
  chicken: "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=136&h=136&fit=crop&auto=format",
  fish: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=136&h=136&fit=crop&auto=format",
  seafood: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=136&h=136&fit=crop&auto=format",
  rice: "https://images.unsplash.com/photo-1596560548464-f010549b84d7?w=136&h=136&fit=crop&auto=format",
  noodle: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=136&h=136&fit=crop&auto=format",
  bread: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=136&h=136&fit=crop&auto=format",
  burger: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=136&h=136&fit=crop&auto=format",
  dessert: "https://images.unsplash.com/photo-1616953882462-8a583e0afbb4?w=136&h=136&fit=crop&auto=format",
  cake: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=136&h=136&fit=crop&auto=format",
  icecream: "https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=136&h=136&fit=crop&auto=format",
  drink: "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=136&h=136&fit=crop&auto=format",
  coffee: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=136&h=136&fit=crop&auto=format",
  curry: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=136&h=136&fit=crop&auto=format",
  cheese: "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=136&h=136&fit=crop&auto=format",
  appetizer: "https://images.unsplash.com/photo-1541524324135-9f2a0c4e5466?w=136&h=136&fit=crop&auto=format",
  dip: "https://images.unsplash.com/photo-1541524324135-9f2a0c4e5466?w=136&h=136&fit=crop&auto=format",
  ball: "https://images.unsplash.com/photo-1541524324135-9f2a0c4e5466?w=136&h=136&fit=crop&auto=format",
  fritter: "https://images.unsplash.com/photo-1541524324135-9f2a0c4e5466?w=136&h=136&fit=crop&auto=format",
  grilled: "https://images.unsplash.com/photo-1558030006-450675393462?w=136&h=136&fit=crop&auto=format",
  fried: "https://images.unsplash.com/photo-1541524324135-9f2a0c4e5466?w=136&h=136&fit=crop&auto=format",
  tomato: "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=136&h=136&fit=crop&auto=format",
  pork: "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=136&h=136&fit=crop&auto=format",
  lamb: "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=136&h=136&fit=crop&auto=format",
  veg: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=136&h=136&fit=crop&auto=format",
};

// Deterministic fallback: hash dish name → pick from 8 diverse defaults
const FALLBACKS = [
  "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=136&h=136&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=136&h=136&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1432139555190-2e151ef32842?w=136&h=136&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=136&h=136&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=136&h=136&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=136&h=136&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=136&h=136&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1432139509613-5c4255a1d1a0?w=136&h=136&fit=crop&auto=format",
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function guessImg(dish: Dish): string {
  const text = [
    dish.name_original || "",
    typeof dish.name_translated === "string" ? dish.name_translated : "",
    ...(dish.ingredients || []),
  ]
    .join(" ")
    .toLowerCase();

  for (const [key, url] of Object.entries(FOOD_IMG)) {
    if (text.includes(key)) return url;
  }

  // Fallback by taste profile
  const taste = (dish.taste_profile || []).join(" ").toLowerCase();
  if (taste.includes("sweet")) return FOOD_IMG.dessert;
  if (taste.includes("rich")) return FOOD_IMG.beef;

  // Deterministic diverse fallback
  const idx = hashStr(dish.name_original || "") % FALLBACKS.length;
  return FALLBACKS[idx];
}

// ── Pill component ────────────────────────────────────────────────────

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

// ── Skeleton ──────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div
      className="flex items-center gap-3.5"
      style={{
        background: "var(--card)",
        borderRadius: "var(--radius-lg)",
        padding: "12px 14px",
        marginBottom: 10,
      }}
    >
      <div className="skeleton-shimmer flex-shrink-0" style={{ width: 68, height: 68, borderRadius: "var(--radius)" }} />
      <div className="flex-1 flex flex-col gap-1.5" style={{ paddingTop: 4 }}>
        <div className="skeleton-shimmer" style={{ height: 8, borderRadius: 4, width: "55%" }} />
        <div className="skeleton-shimmer" style={{ height: 8, borderRadius: 4, width: "38%" }} />
        <div className="skeleton-shimmer" style={{ height: 8, borderRadius: 4, width: "25%" }} />
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────

interface ResultsPageProps {
  result: TranslationResult | null;
  photoCount: number;
  useMock?: boolean;
  onBack: () => void;
  onDishDetail: (dish: Dish) => void;
  loading?: boolean;
  showAllergens?: boolean;
  showVeg?: boolean;
}

export default function ResultsPage({
  result,
  onBack,
  onDishDetail,
  loading,
  showAllergens,
  showVeg,
}: ResultsPageProps) {
  // ── Loading / Skeleton ──────────────────────────────────
  if (loading) {
    return (
      <div className="h-full flex flex-col" style={{ background: "var(--bg)" }}>
        <div className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0" style={{ borderBottom: "1px solid var(--rule)" }}>
          <button onClick={onBack} className="text-[11px] cursor-pointer" style={{ color: "var(--ink)", background: "none", border: "none" }}>←</button>
          <span className="text-xs font-bold flex-1" style={{ fontFamily: "var(--font-body)", color: "var(--ink)" }}>加载中...</span>
          <span className="text-[7px] font-bold px-2 py-1 rounded-xl" style={{ fontFamily: "var(--font-ui)", color: "var(--primary)", background: "rgba(76,175,80,0.1)" }}>AI 识别</span>
        </div>
        <div className="flex-1 overflow-auto" style={{ padding: "8px 16px 12px" }}>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </div>
    );
  }

  // ── Build dish list from real result or empty ────────────
  const pages = result?.pages || [];
  const allDishes: { dish: Dish; pageIndex: number }[] = [];
  for (const page of pages) {
    for (const dish of (page.dishes || [])) {
      allDishes.push({ dish, pageIndex: page.page_index });
    }
  }

  const isReal = allDishes.length > 0;
  const sourceLang = (result?.metadata?.source_language || "?").toUpperCase();
  const pageLabel = pages.length > 0 ? pages[0]?.page_label || "菜单" : "菜单";

  const sourceLangNames: Record<string, string> = {
    fr: "法语菜单", ja: "日语菜单", it: "意大利语菜单", es: "西班牙语菜单",
    de: "德语菜单", ko: "韩语菜单", th: "泰语菜单", en: "英语菜单",
    zh: "中文菜单", pt: "葡语菜单", vi: "越南语菜单",
  };
  const titleText = sourceLangNames[result?.metadata?.source_language || ""] || pageLabel;

  return (
    <div className="h-full flex flex-col" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0" style={{ borderBottom: "1px solid var(--rule)" }}>
        <button
          onClick={onBack}
          className="text-[11px] cursor-pointer transition-opacity hover:opacity-50"
          style={{ color: "var(--ink)", background: "none", border: "none" }}
        >
          ←
        </button>
        <span className="text-xs font-bold flex-1" style={{ fontFamily: "var(--font-body)", color: "var(--ink)" }}>
          {isReal ? titleText : pageLabel}
        </span>
        <span
          className="text-[7px] font-bold px-2 py-1 rounded-xl"
          style={{ fontFamily: "var(--font-ui)", color: "var(--primary)", background: "rgba(76,175,80,0.1)" }}
        >
          {sourceLang} → 中文
        </span>
      </div>

      {/* Scroll area */}
      <div className="flex-1 overflow-auto" style={{ padding: "8px 16px 12px" }}>
        {/* Allergen bar */}
        {showAllergens && (
          <div
            className="flex items-center gap-1.5"
            style={{
              padding: "10px 14px",
              marginBottom: 10,
              background: "var(--allergen-bg)",
              borderRadius: "var(--radius-sm)",
              fontFamily: "var(--font-ui)",
              fontSize: 8,
              fontWeight: 600,
              color: "var(--accent)",
              animation: "fadeSlideUp 0.3s ease-out",
            }}
          >
            <span
              style={{
                width: 6, height: 6,
                borderRadius: "50%",
                background: "var(--accent)",
                animation: "breathe 2s infinite",
                flexShrink: 0,
              }}
            />
            {showVeg ? "过敏原标注已开启 · 请注意标签提示" : "已为你标注含过敏原的菜品"}
          </div>
        )}

        {/* Real AI dish cards */}
        {isReal ? (
          allDishes.map(({ dish }, i) => {
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
            const hasImage = !!dish.ai_image_url;

            const tags: { label: string; type: "green" | "warm" | "allergen" | "veg" }[] = [];
            for (const ing of (dish.ingredients || []).slice(0, 2)) {
              tags.push({ label: ing, type: "green" });
            }
            const isVeg = (dish.taste_profile || []).includes("vegetarian") ||
              (dish.ingredients || []).every((ing) =>
                !/肉|鱼|鸡|牛|猪|羊|虾|蟹|贝|蛋|lamb|beef|pork|chicken|fish|meat|seafood|egg/i.test(ing)
              );
            if (isVeg) tags.push({ label: "素食", type: "veg" });

            if (showAllergens && dish.allergens?.length) {
              for (const a of dish.allergens) {
                const labels: Record<string, string> = {
                  dairy: "⚠ 乳制品", egg: "⚠ 蛋", peanut: "⚠ 花生",
                  tree_nut: "⚠ 坚果", soy: "⚠ 大豆", wheat: "⚠ 小麦",
                  gluten: "⚠ 麸质", fish: "⚠ 鱼类", shellfish: "⚠ 贝类",
                  alcohol: "⚠ 酒精", wine: "⚠ 酒精",
                };
                tags.push({ label: labels[a] || `⚠ ${a}`, type: "allergen" });
              }
            }

            return (
              <button
                key={dish.id || `dish-${i}`}
                onClick={() => onDishDetail(dish)}
                className="flex items-start gap-3.5 w-full text-left transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
                style={{
                  background: "var(--card)",
                  borderRadius: "var(--radius-lg)",
                  padding: 14,
                  marginBottom: 10,
                  boxShadow: "var(--shadow)",
                  cursor: "pointer",
                  border: "none",
                  fontFamily: "inherit",
                  animation: `fadeSlideUp 0.35s ease-out ${i * 60}ms both`,
                }}
              >
                {/* Image */}
                <div className="relative flex-shrink-0 overflow-hidden" style={{ width: 68, height: 68, borderRadius: "var(--radius)" }}>
                  <Image
                    src={hasImage ? dish.ai_image_url! : guessImg(dish)}
                    alt={dish.name_original}
                    fill
                    sizes="68px"
                    style={{ objectFit: "cover" }}
                  />
                  {showVeg && isVeg && (
                    <div
                      className="absolute flex items-center justify-center"
                      style={{
                        bottom: 3, right: 3,
                        width: 18, height: 18,
                        background: "var(--primary)",
                        borderRadius: "50%",
                        animation: "popIn 0.3s ease-out",
                        boxShadow: "0 1px 4px rgba(76,175,80,0.3)",
                      }}
                    >
                      <svg viewBox="0 0 12 12" style={{ width: 11, height: 11, stroke: "#FFF", fill: "none", strokeWidth: 1.3, strokeLinecap: "round", strokeLinejoin: "round" }}>
                        <path d="M8 4C4 5 3 8 3.5 10c.5 1.8 2 2.5 3 1 .7-1.1.5-2.7-.5-4" />
                        <path d="M6 2c0 0 1-1.5 3-1s2 2.5 0 4" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div style={{ fontFamily: "var(--font-body)", fontSize: 8, fontWeight: 700, color: "var(--primary)", letterSpacing: "0.04em", marginBottom: 2 }}>
                    {String(i + 1).padStart(2, "0")}
                    {dish.rating_avg ? (
                      <span className="inline-flex items-center gap-0.5 ml-1.5" style={{ fontSize: 8, color: "var(--accent)", fontWeight: 700 }}>
                        ★ {dish.rating_avg}
                      </span>
                    ) : null}
                  </div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700, color: "var(--ink)", letterSpacing: "0.01em", marginBottom: 2 }}>
                    {zhName}
                  </div>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: 9, color: "var(--muted)", fontStyle: "italic", marginBottom: 2 }}>
                    {dish.name_original}
                  </div>
                  <div style={{ fontFamily: "var(--font-ui)", fontSize: 8, color: "var(--ink-soft)", marginBottom: 4, lineHeight: 1.4 }}>
                    {(dish.ingredients || []).join(" · ") || zhDesc}
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {tags.map((t, j) => (
                      <Pill key={j} label={t.label} type={t.type} />
                    ))}
                  </div>
                </div>
              </button>
            );
          })
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center text-center" style={{ padding: "40px 20px", opacity: 0.45 }}>
            <div className="flex items-center justify-center" style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--card)", marginBottom: 10 }}>
              <svg viewBox="0 0 24 24" style={{ width: 24, height: 24, stroke: "var(--muted)", fill: "none", strokeWidth: 1.5, strokeLinecap: "round" }}>
                <circle cx="12" cy="12" r="9" /><path d="M8 12h8" />
              </svg>
            </div>
            <h4 style={{ fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 600, color: "var(--muted)", marginBottom: 2 }}>
              没有识别到菜品
            </h4>
            <p style={{ fontFamily: "var(--font-ui)", fontSize: 8, color: "var(--muted)", opacity: 0.7 }}>
              请重新拍摄清晰的菜单照片
            </p>
          </div>
        )}

        {/* Failed pages warning */}
        {result?.failed_pages && result.failed_pages.length > 0 && (
          <div
            style={{
              padding: "8px 12px",
              background: "var(--allergen-bg)",
              borderRadius: "var(--radius-sm)",
              fontFamily: "var(--font-ui)",
              fontSize: 8,
              color: "var(--accent)",
              fontWeight: 600,
            }}
          >
            部分页面识别失败（{result.failed_pages.map((p) => p.page_index + 1).join(", ")}），请重新拍摄
          </div>
        )}
      </div>
    </div>
  );
}
