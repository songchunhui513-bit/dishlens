"use client";

import type { Dish, TranslationResult } from "@/types";

// ── v7 Unsplash image URLs ──────────────────────────────────────────

const FOOD_IMG: Record<string, string> = {
  boeuf: "https://images.unsplash.com/photo-1667396702543-a239efa7a7f2?w=136&h=136&fit=crop&auto=format",
  sole: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=136&h=136&fit=crop&auto=format",
  tarte: "https://images.unsplash.com/photo-1616953882462-8a583e0afbb4?w=136&h=136&fit=crop&auto=format",
};

// ── Mock data matching v7 prototype ──────────────────────────────────

interface MockDish {
  id: string;
  zh: string;
  original: string;
  ingredients: string;
  stars: number;
  tags: { label: string; type: "green" | "warm" | "allergen" | "veg" }[];
  img: string;
  isVeg: boolean;
  page: number;
  pageLabel: string;
}

const mockDishes: MockDish[] = [
  {
    id: "1", zh: "勃艮第红酒炖牛肉", original: "Boeuf Bourguignon",
    ingredients: "牛肩肉 · 勃艮第红酒 · 珍珠洋葱 · 蘑菇 · 百里香",
    stars: 4.8, tags: [{ label: "牛肉", type: "green" }, { label: "红酒炖煮", type: "warm" }, { label: "法式经典", type: "warm" }],
    img: FOOD_IMG.boeuf, isVeg: false, page: 1, pageLabel: "前菜/主菜",
  },
  {
    id: "2", zh: "法式黄油煎鳎鱼", original: "Sole Meunière",
    ingredients: "新鲜鳎鱼 · 澄清黄油 · 柠檬 · 欧芹 · 刺山柑",
    stars: 4.5, tags: [{ label: "海鲜", type: "green" }, { label: "黄油", type: "warm" }, { label: "经典法式", type: "warm" }],
    img: FOOD_IMG.sole, isVeg: false, page: 1, pageLabel: "前菜/主菜",
  },
  {
    id: "3", zh: "反转焦糖苹果挞", original: "Tarte Tatin",
    ingredients: "苹果 · 焦糖 · 千层酥皮 · 黄油 · 香草荚",
    stars: 4.6, tags: [{ label: "素食", type: "veg" }, { label: "甜点", type: "warm" }, { label: "法式经典", type: "warm" }],
    img: FOOD_IMG.tarte, isVeg: true, page: 1, pageLabel: "前菜/主菜",
  },
];

function getAllergenTags(dish: MockDish): { label: string; type: "allergen" }[] {
  if (dish.id === "1") return [{ label: "⚠ 酒精", type: "allergen" }, { label: "⚠ 亚硫酸盐", type: "allergen" }];
  if (dish.id === "2") return [{ label: "⚠ 乳制品", type: "allergen" }, { label: "⚠ 鱼类", type: "allergen" }];
  if (dish.id === "3") return [{ label: "⚠ 麸质", type: "allergen" }, { label: "⚠ 乳制品", type: "allergen" }];
  return [];
}

// ── Pill ──────────────────────────────────────────────────────────────

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
  const fw = type === "allergen" || type === "veg" ? 700 : 600;
  return (
    <span
      className="inline-flex items-center gap-0.5"
      style={{
        fontFamily: "var(--font-ui)",
        fontSize: "7.5px",
        fontWeight: fw,
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

// ── Skeleton Row ──────────────────────────────────────────────────────

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
      <div
        className="skeleton-shimmer flex-shrink-0"
        style={{ width: 68, height: 68, borderRadius: "var(--radius)" }}
      />
      <div className="flex-1 flex flex-col gap-1.5" style={{ paddingTop: 4 }}>
        <div className="skeleton-shimmer" style={{ height: 8, borderRadius: 4, width: "55%" }} />
        <div className="skeleton-shimmer" style={{ height: 8, borderRadius: 4, width: "38%" }} />
        <div className="skeleton-shimmer" style={{ height: 8, borderRadius: 4, width: "25%" }} />
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────

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
          <span className="text-[7px] font-bold px-2 py-1 rounded-xl" style={{ fontFamily: "var(--font-ui)", color: "var(--primary)", background: "rgba(76,175,80,0.1)" }}>FR → 中文</span>
        </div>
        <div className="flex-1 overflow-auto" style={{ padding: "8px 16px 12px" }}>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </div>
    );
  }

  // ── Normal / Mock Render ────────────────────────────────
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
          法语菜单
        </span>
        <span
          className="text-[7px] font-bold px-2 py-1 rounded-xl"
          style={{ fontFamily: "var(--font-ui)", color: "var(--primary)", background: "rgba(76,175,80,0.1)" }}
        >
          FR → 中文
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

        {/* Dish cards */}
        {mockDishes.map((dish, i) => {
          const allTags = showAllergens
            ? [...dish.tags, ...getAllergenTags(dish)]
            : dish.tags;

          return (
            <button
              key={dish.id}
              onClick={() => onDishDetail({
                id: dish.id,
                name_original: dish.original,
                name_translated: { zh: dish.zh },
                description: { zh: "" },
                ingredients: dish.ingredients.split(" · "),
                allergens: [],
                taste_profile: [],
                image_source: "ai" as const,
              })}
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
                <img src={dish.img} alt={dish.original} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                {showVeg && dish.isVeg && (
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
                  {dish.stars > 0 && (
                    <span className="inline-flex items-center gap-0.5 ml-1.5" style={{ fontSize: 8, color: "var(--accent)", fontWeight: 700 }}>
                      ★ {dish.stars}
                    </span>
                  )}
                </div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700, color: "var(--ink)", letterSpacing: "0.01em", marginBottom: 2 }}>
                  {dish.zh}
                </div>
                <div style={{ fontFamily: "var(--font-body)", fontSize: 9, color: "var(--muted)", fontStyle: "italic", marginBottom: 2 }}>
                  {dish.original}
                </div>
                <div style={{ fontFamily: "var(--font-ui)", fontSize: 8, color: "var(--ink-soft)", marginBottom: 4, lineHeight: 1.4 }}>
                  {dish.ingredients}
                </div>
                <div className="flex gap-1 flex-wrap">
                  {allTags.map((t, j) => (
                    <Pill key={j} label={t.label} type={t.type} />
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
