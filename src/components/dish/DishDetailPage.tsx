"use client";

import { useState } from "react";
import type { Dish } from "@/types";

// ── Mock review data matching v7 ─────────────────────────────────────

const defaultReviews = [
  {
    text: "牛肉炖得恰到好处，酱汁浓郁不腻，配上烤面包蘸酱汁简直完美",
    author: "美食旅行者",
    time: "3 天前",
  },
  {
    text: "巴黎小馆子里吃到的最好一道菜，翻译准确让我点对了",
    author: "背包客小王",
    time: "1 周前",
  },
];

const altReviews = [
  {
    text: "焦糖微苦配苹果酸甜，加上酸奶油简直绝配。每次来巴黎必点",
    author: "甜点猎人",
    time: "2 天前",
  },
  {
    text: "虽然是素食但完全不觉得在'妥协'，好吃到忘记拍照",
    author: "素食旅行者",
    time: "5 天前",
  },
];

// ── Mock dish data ───────────────────────────────────────────────────

interface MockDetail {
  original: string;
  zh: string;
  stars: number;
  reviewAvg?: number;
  reviewCount: number;
  price: string;
  cuisine: string;
  method: string;
  portion: string;
  heroImg: string;
  ingredients: string;
  tags: { label: string; type: "green" | "warm" | "allergen" | "veg" }[];
  description: string;
  wineNote?: { label: string; body: string };
  allergenRow?: string;
  reviews: { text: string; author: string; time: string }[];
  isVeg?: boolean;
}

const boeufDetail: MockDetail = {
  original: "Boeuf Bourguignon",
  zh: "勃艮第红酒炖牛肉",
  stars: 4.8, reviewAvg: 4.5, reviewCount: 32, price: "18€",
  cuisine: "法式 · 勃艮第", method: "慢炖 3h+", portion: "主菜",
  heroImg: "https://images.unsplash.com/photo-1667396702543-a239efa7a7f2?w=600&h=400&fit=crop&auto=format",
  ingredients: "牛肩肉（Charolais）、勃艮第黑皮诺红酒、珍珠洋葱、白蘑菇、五花培根丁、百里香、月桂叶、大蒜、胡萝卜",
  tags: [
    { label: "牛肉", type: "green" },
    { label: "红酒炖煮", type: "warm" },
    { label: "法式经典", type: "warm" },
    { label: "含酒精", type: "allergen" },
  ],
  description: "酱汁深红浓郁，肉质酥烂至叉可轻易穿透。红酒的果香单宁与牛肉油脂融合，洋葱和蘑菇增添泥土甜味。传统搭配水煮小土豆或宽面条。",
  wineNote: {
    label: "配酒建议",
    body: "推荐搭配同一产区勃艮第黑皮诺（Pinot Noir），酒体中等，果香与菜肴红酒酱汁形成完美和声。若偏好白酒，可尝试橡木桶陈酿霞多丽。",
  },
  reviews: defaultReviews,
};

const tarteDetail: MockDetail = {
  original: "Tarte Tatin",
  zh: "反转焦糖苹果挞",
  stars: 4.6, reviewAvg: 4.7, reviewCount: 45, price: "10€",
  cuisine: "法式 · 甜点", method: "烘焙", portion: "温热",
  heroImg: "https://images.unsplash.com/photo-1616953882462-8a583e0afbb4?w=600&h=400&fit=crop&auto=format",
  ingredients: "苹果（Reine des Reinettes）、焦糖、千层酥皮（小麦粉+黄油）、香草荚、少许海盐",
  tags: [
    { label: "素食友好", type: "veg" },
    { label: "甜点", type: "warm" },
    { label: "⚠ 麸质", type: "allergen" },
    { label: "⚠ 乳制品", type: "allergen" },
  ],
  description: "19 世纪末 Tatin 姐妹在卢瓦尔河谷旅馆意外发明——烤苹果挞时不慎将苹果烧焦，紧急将派皮盖在上面倒扣出炉，反而成就了这道经典法式甜点。",
  allergenRow: "⚠ 过敏原警告：含麸质（千层酥皮）· 含乳制品（黄油）",
  reviews: altReviews,
  isVeg: true,
};

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

// ── Page ──────────────────────────────────────────────────────────────

interface DishDetailPageProps {
  dish: Dish | null;
  onBack: () => void;
  onReview: () => void;
  showAllergens?: boolean;
}

export default function DishDetailPage({ dish, onBack, onReview, showAllergens }: DishDetailPageProps) {
  const [faved, setFaved] = useState(false);

  // Use Boeuf by default, Tarte if dish id matches
  const detail = dish?.id === "3" ? tarteDetail : boeufDetail;

  return (
    <div className="h-full flex flex-col" style={{ background: "var(--bg)" }}>
      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0">
        <button
          onClick={onBack}
          className="text-[11px] cursor-pointer transition-opacity hover:opacity-50"
          style={{ color: "var(--ink)", background: "none", border: "none" }}
        >
          ←
        </button>
        <span className="text-xs font-bold flex-1" style={{ fontFamily: "var(--font-body)", color: "var(--ink)" }}>
          菜品详情
        </span>
        <button
          onClick={() => setFaved(!faved)}
          className={`flex items-center gap-0.5 text-[9px] font-bold transition-all duration-200 ${faved ? "" : ""}`}
          style={{
            fontFamily: "var(--font-body)",
            color: faved ? "var(--accent)" : "var(--primary)",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          <svg viewBox="0 0 24 24" style={{
            width: 16, height: 16,
            stroke: faved ? "var(--accent)" : "var(--primary)",
            fill: faved ? "var(--accent)" : "none",
            strokeWidth: 2,
            strokeLinecap: "round",
            animation: faved ? "heartbeat 0.6s ease-out" : "none",
          }}>
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
            <img src={detail.heroImg} alt={detail.zh} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            {detail.isVeg && (
              <div
                className="absolute flex items-center justify-center"
                style={{
                  bottom: 8, right: 8,
                  width: 24, height: 24,
                  background: "var(--primary)",
                  borderRadius: "50%",
                  animation: "popIn 0.3s ease-out",
                  boxShadow: "0 1px 4px rgba(76,175,80,0.3)",
                }}
              >
                <svg viewBox="0 0 12 12" style={{ width: 14, height: 14, stroke: "#FFF", fill: "none", strokeWidth: 1.3, strokeLinecap: "round", strokeLinejoin: "round" }}>
                  <path d="M8 4C4 5 3 8 3.5 10c.5 1.8 2 2.5 3 1 .7-1.1.5-2.7-.5-4" />
                  <path d="M6 2c0 0 1-1.5 3-1s2 2.5 0 4" />
                </svg>
              </div>
            )}
          </div>

          {/* Title + sub */}
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.01em", marginBottom: 2 }}>
            {detail.zh}
          </div>
          <div style={{ fontFamily: "var(--font-body)", fontSize: 10, color: "var(--muted)", fontStyle: "italic", marginBottom: 8 }}>
            {detail.original} &nbsp;·&nbsp; <span style={{ color: "var(--accent)", fontWeight: 700, fontStyle: "normal" }}>★ {detail.stars}</span> &nbsp;·&nbsp; {detail.price}
          </div>

          {/* Allergen row */}
          {showAllergens && detail.allergenRow && (
            <div
              className="flex flex-wrap items-center gap-1.5"
              style={{
                padding: "10px 14px",
                marginBottom: 12,
                background: "var(--allergen-bg)",
                borderRadius: "var(--radius-sm)",
                fontFamily: "var(--font-ui)",
                fontSize: 8,
                fontWeight: 600,
                color: "var(--accent)",
              }}
            >
              {detail.allergenRow}
            </div>
          )}

          {/* Meta row */}
          <div className="flex gap-3.5" style={{ marginBottom: 12, fontFamily: "var(--font-ui)", fontSize: 8, color: "var(--muted)" }}>
            <span>菜系 <span style={{ fontWeight: 600, color: "var(--ink-soft)" }}>{detail.cuisine}</span></span>
            <span>烹饪 <span style={{ fontWeight: 600, color: "var(--ink-soft)" }}>{detail.method}</span></span>
            <span>分量 <span style={{ fontWeight: 600, color: "var(--ink-soft)" }}>{detail.portion}</span></span>
          </div>

          {/* Ingredients */}
          <div style={{ fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 700, color: "var(--ink)", marginBottom: 6, letterSpacing: "0.02em", marginTop: 4 }}>
            食材
          </div>
          <div style={{ fontFamily: "var(--font-ui)", fontSize: 10, color: "var(--ink-soft)", lineHeight: 1.65, marginBottom: 12 }}>
            {detail.ingredients}
          </div>

          {/* Pills */}
          <div className="flex gap-1.5 flex-wrap" style={{ marginBottom: 12 }}>
            {detail.tags.map((t, i) => (
              <Pill key={i} label={t.label} type={t.type} />
            ))}
          </div>

          {/* Flavor description */}
          <div style={{ fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 700, color: "var(--ink)", marginBottom: 6, letterSpacing: "0.02em", marginTop: 4 }}>
            风味特征
          </div>
          <div style={{ fontFamily: "var(--font-ui)", fontSize: 10, color: "var(--ink-soft)", lineHeight: 1.65, marginBottom: 12 }}>
            {detail.description}
          </div>

          {/* Wine note */}
          {detail.wineNote && (
            <div style={{ padding: "12px 14px", marginBottom: 12, background: "var(--card)", borderRadius: "var(--radius)" }}>
              <div style={{ fontFamily: "var(--font-body)", fontSize: 8, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
                {detail.wineNote.label}
              </div>
              <div style={{ fontFamily: "var(--font-ui)", fontSize: 9, color: "var(--ink-soft)", lineHeight: 1.5 }}>
                {detail.wineNote.body}
              </div>
            </div>
          )}

          {/* Reviews section */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 700, color: "var(--ink)", marginBottom: 6, letterSpacing: "0.02em", marginTop: 4 }}>
              食客评价
            </div>
            <div className="flex items-center gap-2.5" style={{ marginBottom: 10 }}>
              <span style={{ fontSize: 14, color: "var(--accent)", letterSpacing: 1, animation: "fadeIn 0.4s" }}>
                ★★★★★
              </span>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 9, color: "var(--muted)" }}>
                {detail.reviewAvg ?? detail.stars} · {detail.reviewCount} 条评价
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {detail.reviews.map((r, i) => (
                <div
                  key={i}
                  style={{
                    fontFamily: "var(--font-ui)",
                    fontSize: 9,
                    color: "var(--ink-soft)",
                    fontStyle: "italic",
                    lineHeight: 1.5,
                    paddingLeft: 8,
                    borderLeft: "2px solid var(--rule)",
                  }}
                >
                  「{r.text}」
                  <span style={{ display: "block", fontSize: 7, color: "var(--muted)", fontStyle: "normal", marginTop: 2 }}>
                    — {r.author} · {r.time}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10 }}>
              <button
                onClick={onReview}
                className="flex items-center justify-center gap-1 w-full py-2 transition-opacity hover:opacity-70"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 9,
                  fontWeight: 700,
                  color: "var(--primary)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
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
