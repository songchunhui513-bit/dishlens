"use client";

import { useMemo, useState } from "react";
import type { Dish, TranslationResult } from "@/types";
import DishImageWithLoading from "@/components/shared/DishImageWithLoading";
import { getDishInsight, getDishText, isVegetarianDish } from "@/lib/dish-presentation";

type SharedMenuPageProps = {
  result: TranslationResult;
};

function sourceTitle(lang?: string): string {
  const sourceLangNames: Record<string, string> = {
    fr: "法语菜单",
    ja: "日语菜单",
    it: "意大利语菜单",
    es: "西班牙语菜单",
    de: "德语菜单",
    ko: "韩语菜单",
    th: "泰语菜单",
    en: "英语菜单",
    zh: "中文菜单",
    pt: "葡语菜单",
    vi: "越南语菜单",
  };
  return sourceLangNames[lang || ""] || "分享菜单";
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 16, height: 16, stroke: "currentColor", fill: "none", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 10.7 15.4 6.3" />
      <path d="M8.6 13.3 15.4 17.7" />
    </svg>
  );
}

export default function SharedMenuPage({ result }: SharedMenuPageProps) {
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [shareStatus, setShareStatus] = useState("");
  const allDishes = useMemo(() => result.pages.flatMap((page) => page.dishes || []), [result.pages]);
  const sourceLang = result.metadata?.source_language || "";

  function onDishDetail(dish: Dish) {
    setSelectedDish(dish);
  }

  async function shareCurrentMenu() {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    const title = "DishLens 分享菜单";
    const text = "这是一份用 DishLens 翻译好的菜单，可以查看菜品列表和详情。";

    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        setShareStatus("已打开分享面板");
      } else {
        await navigator.clipboard.writeText(url);
        setShareStatus("链接已复制");
      }
    } catch {
      setShareStatus("分享未完成");
    }
    window.setTimeout(() => setShareStatus(""), 1800);
  }

  if (selectedDish) {
    const dishText = getDishText(selectedDish);
    const insight = getDishInsight(selectedDish);
    const ingredients = (selectedDish.ingredients || []).join("、");
    const isVeg = isVegetarianDish(selectedDish);

    return (
      <div className="h-full flex flex-col" style={{ background: "var(--bg)" }}>
        <div className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0" style={{ borderBottom: "1px solid var(--rule)" }}>
          <button onClick={() => setSelectedDish(null)} className="text-[11px] cursor-pointer" style={{ color: "var(--ink)", background: "none", border: "none" }}>←</button>
          <span className="text-xs font-bold flex-1" style={{ fontFamily: "var(--font-body)", color: "var(--ink)" }}>菜品详情</span>
          <button onClick={shareCurrentMenu} className="inline-flex items-center gap-1 text-[8px] font-bold" style={{ fontFamily: "var(--font-ui)", color: "var(--primary)", background: "rgba(76,175,80,0.1)", border: "none", borderRadius: 18, padding: "6px 9px" }}>
            <ShareIcon /> 分享
          </button>
        </div>
        <div className="flex-1 overflow-auto" style={{ padding: "12px 16px 18px" }}>
          <div style={{ marginBottom: 16 }}>
            <DishImageWithLoading dish={selectedDish} size="hero" alt={dishText.translatedName} />
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 800, color: "var(--ink)", marginBottom: 2 }}>
            {dishText.translatedName}
          </div>
          <div style={{ fontFamily: "var(--font-body)", fontSize: 10, color: "var(--muted)", fontStyle: "italic", marginBottom: 10 }}>
            {dishText.originalName}
          </div>
          <div className="flex gap-1.5 flex-wrap" style={{ marginBottom: 12 }}>
            {isVeg ? <span style={{ fontFamily: "var(--font-ui)", fontSize: 8, fontWeight: 700, padding: "4px 10px", borderRadius: 20, color: "var(--primary)", background: "rgba(76,175,80,0.12)" }}>素食</span> : null}
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 8, fontWeight: 700, padding: "4px 10px", borderRadius: 20, color: "var(--muted)", background: "rgba(45,45,45,0.06)" }}>{insight.confidenceLabel}</span>
          </div>
          {ingredients ? (
            <>
              <div style={{ fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>食材</div>
              <div style={{ fontFamily: "var(--font-ui)", fontSize: 10, color: "var(--ink-soft)", lineHeight: 1.65, marginBottom: 12 }}>{ingredients}</div>
            </>
          ) : null}
          <div style={{ fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>风味特征</div>
          <div style={{ fontFamily: "var(--font-ui)", fontSize: 10, color: "var(--ink-soft)", lineHeight: 1.65, marginBottom: 12 }}>{insight.summary}</div>
          <div style={{ fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>点单建议</div>
          <div style={{ fontFamily: "var(--font-ui)", fontSize: 10, color: "var(--ink-soft)", lineHeight: 1.65, marginBottom: 12 }}>{insight.recommendation}</div>
          <div style={{ fontFamily: "var(--font-ui)", fontSize: 9, color: "var(--muted)", lineHeight: 1.55 }}>{insight.goodFor} {insight.caution}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ background: "var(--bg)" }}>
      <div className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0" style={{ borderBottom: "1px solid var(--rule)" }}>
        <span className="text-xs font-bold flex-1" style={{ fontFamily: "var(--font-body)", color: "var(--ink)" }}>{sourceTitle(sourceLang)}</span>
        <button onClick={shareCurrentMenu} className="inline-flex items-center gap-1 text-[8px] font-bold" style={{ fontFamily: "var(--font-ui)", color: "var(--primary)", background: "rgba(76,175,80,0.1)", border: "none", borderRadius: 18, padding: "6px 9px" }}>
          <ShareIcon /> 分享菜单
        </button>
      </div>
      <div className="flex-1 overflow-auto" style={{ padding: "8px 16px 14px" }}>
        {shareStatus ? (
          <div style={{ padding: "8px 12px", marginBottom: 10, borderRadius: "var(--radius-sm)", background: "rgba(76,175,80,0.1)", color: "var(--primary)", fontFamily: "var(--font-ui)", fontSize: 8, fontWeight: 700 }}>
            {shareStatus}
          </div>
        ) : null}
        {allDishes.length ? allDishes.map((dish, i) => {
          const dishText = getDishText(dish);
          const insight = getDishInsight(dish);
          return (
            <button
              key={dish.id || `${dish.name_original}-${i}`}
              onClick={() => onDishDetail(dish)}
              className="flex items-start gap-3.5 w-full text-left transition-all duration-200 active:scale-[0.98]"
              style={{ background: "var(--card)", borderRadius: "var(--radius-lg)", padding: 14, marginBottom: 10, boxShadow: "var(--shadow)", border: "none", cursor: "pointer", fontFamily: "inherit" }}
            >
              <DishImageWithLoading dish={dish} size="card" alt={dishText.translatedName} />
              <div className="flex-1 min-w-0">
                <div style={{ fontFamily: "var(--font-body)", fontSize: 8, fontWeight: 700, color: "var(--primary)", letterSpacing: "0.04em", marginBottom: 2 }}>{String(i + 1).padStart(2, "0")}</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>{dishText.translatedName}</div>
                <div style={{ fontFamily: "var(--font-body)", fontSize: 9, color: "var(--muted)", fontStyle: "italic", marginBottom: 3 }}>{dishText.originalName}</div>
                <div style={{ fontFamily: "var(--font-ui)", fontSize: 8, color: "var(--ink-soft)", marginBottom: 4, lineHeight: 1.4 }}>{insight.summary}</div>
                <div style={{ fontFamily: "var(--font-ui)", fontSize: 8, color: "var(--primary)", lineHeight: 1.4, fontWeight: 600 }}>{insight.recommendation}</div>
              </div>
            </button>
          );
        }) : (
          <div style={{ padding: "46px 20px", textAlign: "center", fontFamily: "var(--font-ui)", fontSize: 10, color: "var(--muted)" }}>
            这份分享菜单暂时没有可展示的菜品
          </div>
        )}
      </div>
    </div>
  );
}
