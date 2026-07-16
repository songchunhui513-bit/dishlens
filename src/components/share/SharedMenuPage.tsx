"use client";

import { useMemo, useState } from "react";
import type { Dish, TranslationResult } from "@/types";
import DishImageWithLoading from "@/components/shared/DishImageWithLoading";
import { getDishInsight, getDishText, isVegetarianDish } from "@/lib/dish-presentation";
import ShareSheet from "@/components/share/ShareSheet";
import { buildShareMenuMeta, sourceTitle } from "@/lib/share-menu";
import { resolveMenuSourceLanguage } from "@/lib/menu-source-language";

type SharedMenuPageProps = {
  result: TranslationResult;
};

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

const sharedMenuTextStyles = {
  screenTitle: { fontFamily: "var(--font-body)", fontSize: 15, fontWeight: 850, color: "var(--ink)" },
  headerMeta: { fontFamily: "var(--font-ui)", fontSize: 11, fontWeight: 800, color: "var(--primary)", lineHeight: 1.2 },
  action: { fontFamily: "var(--font-ui)", fontSize: 11, fontWeight: 850 },
  cardIndex: { fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 850, color: "var(--primary)", letterSpacing: 0 },
  cardTitle: { fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 850, color: "var(--ink)", lineHeight: 1.18 },
  cardOriginal: { fontFamily: "var(--font-body)", fontSize: 12, color: "var(--muted)", fontStyle: "italic", lineHeight: 1.35 },
  cardBody: { fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.55 },
  detailTitle: { fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 850, color: "var(--ink)", lineHeight: 1.15 },
  sectionTitle: { fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 850, color: "var(--ink)" },
  sectionBody: { fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.65 },
} as const;

const recommendationBox = {
  padding: "10px 12px",
  borderRadius: 16,
  background: "rgba(76,175,80,0.09)",
  color: "var(--primary)",
  border: "1px solid rgba(76,175,80,0.12)",
  fontWeight: 750,
} as const;

export default function SharedMenuPage({ result }: SharedMenuPageProps) {
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  const allDishes = useMemo(() => result.pages.flatMap((page) => page.dishes || []), [result.pages]);
  const sourceLang = resolveMenuSourceLanguage(result) || result.metadata?.source_language || "";
  const currentOrigin = typeof window === "undefined" ? undefined : window.location.origin;
  const shareMeta = useMemo(() => buildShareMenuMeta(result, currentOrigin, result.task_id), [currentOrigin, result]);

  function onDishDetail(dish: Dish) {
    setSelectedDish(dish);
  }

  function showShareStatus(message: string) {
    setShareStatus(message);
    window.setTimeout(() => setShareStatus(""), 1800);
  }

  function shareCurrentMenu() {
    setShareSheetOpen(true);
  }

  if (selectedDish) {
    const dishText = getDishText(selectedDish);
    const insight = getDishInsight(selectedDish);
    const ingredients = (selectedDish.ingredients || []).join("、");
    const isVeg = isVegetarianDish(selectedDish);

    return (
      <div className="h-full flex flex-col" style={{ background: "var(--bg)" }}>
        <div className="flex items-center gap-2 flex-shrink-0" style={{ padding: "12px 16px", borderBottom: "1px solid var(--rule)" }}>
          <button onClick={() => setSelectedDish(null)} className="cursor-pointer" style={{ width: 42, height: 42, color: "var(--ink)", background: "none", border: "none", fontSize: 18, textAlign: "left" }}>←</button>
          <span className="flex-1" style={sharedMenuTextStyles.screenTitle}>菜品详情</span>
          <button onClick={shareCurrentMenu} className="inline-flex items-center gap-1.5" style={{ ...sharedMenuTextStyles.action, color: "var(--primary)", background: "rgba(76,175,80,0.1)", border: "none", borderRadius: 18, padding: "9px 12px" }}>
            <ShareIcon /> 分享
          </button>
        </div>
        <div className="flex-1 overflow-auto" style={{ padding: "14px 16px 22px" }}>
          <div style={{ marginBottom: 16 }}>
            <DishImageWithLoading dish={selectedDish} size="hero" alt={dishText.translatedName} />
          </div>
          <div style={{ ...sharedMenuTextStyles.detailTitle, marginBottom: 4 }}>
            {dishText.translatedName}
          </div>
          <div style={{ ...sharedMenuTextStyles.cardOriginal, marginBottom: 12 }}>
            {dishText.originalName}
          </div>
          <div className="flex gap-1.5 flex-wrap" style={{ marginBottom: 12 }}>
            {isVeg ? <span style={{ fontFamily: "var(--font-ui)", fontSize: 11, fontWeight: 800, padding: "6px 11px", borderRadius: 20, color: "var(--primary)", background: "rgba(76,175,80,0.12)" }}>素食</span> : null}
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 11, fontWeight: 800, padding: "6px 11px", borderRadius: 20, color: "var(--muted)", background: "rgba(45,45,45,0.06)" }}>{insight.confidenceLabel}</span>
          </div>
          {ingredients ? (
            <>
              <div style={{ ...sharedMenuTextStyles.sectionTitle, marginBottom: 6 }}>食材</div>
              <div style={{ ...sharedMenuTextStyles.sectionBody, marginBottom: 14 }}>{ingredients}</div>
            </>
          ) : null}
          <div style={{ ...sharedMenuTextStyles.sectionTitle, marginBottom: 6 }}>风味特征</div>
          <div style={{ ...sharedMenuTextStyles.sectionBody, marginBottom: 14 }}>{insight.summary}</div>
          <div style={{ ...sharedMenuTextStyles.sectionTitle, marginBottom: 6 }}>点单建议</div>
          <div style={{ ...sharedMenuTextStyles.sectionBody, ...recommendationBox, marginBottom: 14 }}>{insight.recommendation}</div>
          <div style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>{insight.goodFor} {insight.caution}</div>
        </div>
        <ShareSheet open={shareSheetOpen} meta={shareMeta} onClose={() => setShareSheetOpen(false)} onStatus={showShareStatus} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ background: "var(--bg)" }}>
      <div className="flex items-center gap-2 flex-shrink-0" style={{ padding: "12px 16px", borderBottom: "1px solid var(--rule)" }}>
        <span className="flex-1" style={sharedMenuTextStyles.screenTitle}>朋友分享的菜单</span>
        <span style={{ ...sharedMenuTextStyles.headerMeta, padding: "6px 9px", borderRadius: 16, background: "rgba(76,175,80,0.1)" }}>
          {sourceTitle(sourceLang)} · {allDishes.length || result.metadata?.total_dishes || 0} 道
        </span>
        <button onClick={shareCurrentMenu} className="inline-flex items-center gap-1.5" style={{ ...sharedMenuTextStyles.action, color: "var(--primary)", background: "rgba(76,175,80,0.1)", border: "none", borderRadius: 18, padding: "9px 12px" }}>
          <ShareIcon /> 分享菜单
        </button>
      </div>
      <div className="flex-1 overflow-auto" style={{ padding: "12px 16px 18px" }}>
        {shareStatus ? (
          <div style={{ padding: "10px 12px", marginBottom: 12, borderRadius: "var(--radius-sm)", background: "rgba(76,175,80,0.1)", color: "var(--primary)", fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 800 }}>
            {shareStatus}
          </div>
        ) : null}
        {allDishes.length ? (
          <div style={{ padding: "12px 14px", marginBottom: 12, borderRadius: 18, background: "var(--card-alt)", border: "1px solid rgba(231,205,174,0.52)", fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.55 }}>
            这是一份只读翻译菜单，适合一起决定点什么。点击菜品查看详情和点单建议。
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
              style={{ background: "var(--card)", borderRadius: 24, padding: 16, marginBottom: 12, boxShadow: "0 12px 28px rgba(69,48,30,0.08)", border: "1px solid rgba(231,205,174,0.42)", cursor: "pointer", fontFamily: "inherit" }}
            >
              <DishImageWithLoading dish={dish} size="card" alt={dishText.translatedName} />
              <div className="flex-1 min-w-0">
                <div style={{ ...sharedMenuTextStyles.cardIndex, marginBottom: 4 }}>{String(i + 1).padStart(2, "0")}</div>
                <div style={{ ...sharedMenuTextStyles.cardTitle, marginBottom: 4 }}>{dishText.translatedName}</div>
                <div style={{ ...sharedMenuTextStyles.cardOriginal, marginBottom: 6 }}>{dishText.originalName}</div>
                <div style={{ ...sharedMenuTextStyles.cardBody, marginBottom: 8 }}>{insight.summary}</div>
                <div style={{ ...sharedMenuTextStyles.cardBody, ...recommendationBox }}>{insight.recommendation}</div>
              </div>
            </button>
          );
        }) : (
          <div style={{ padding: "46px 20px", textAlign: "center", fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--muted)" }}>
            这份分享菜单暂时没有可展示的菜品
          </div>
        )}
      </div>
      <ShareSheet open={shareSheetOpen} meta={shareMeta} onClose={() => setShareSheetOpen(false)} onStatus={showShareStatus} />
    </div>
  );
}
