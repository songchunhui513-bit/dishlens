"use client";

import { useMemo, useState } from "react";
import type { Dish, TranslationResult } from "@/types";
import { getDishIncludedItems, getDishInsight, getDishText, isVegetarianDish } from "@/lib/dish-presentation";
import { buildDishDisplayTags, type DishDisplayTagType } from "@/lib/dish-display-tags";
import { getDishPriceDisplay, stripPriceFromOriginalName } from "@/lib/dish-price-display";
import { targetLanguageName, targetLanguageNativeName } from "@/lib/languages";
import DishImageWithLoading from "@/components/shared/DishImageWithLoading";
import OrderQuantityControl from "@/components/order/OrderQuantityControl";
import SummaryInsightCard from "@/components/results/SummaryInsightCard";
import CategoryTabs from "@/components/results/CategoryTabs";
import { buildCategoryList, filterDishesByCategory, type CategoryKey } from "@/lib/results-categories";
import { resolveMenuSourceLanguage } from "@/lib/menu-source-language";

// ── Pill component ────────────────────────────────────────────────────

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
        fontSize: "11px",
        fontWeight: type === "allergen" || type === "veg" ? 700 : 600,
        padding: "5px 10px",
        borderRadius: 20,
        letterSpacing: 0,
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
  onShare?: () => void;
  loading?: boolean;
  showAllergens?: boolean;
  showVeg?: boolean;
  targetLang?: string;
  uiLang?: "zh" | "en";
  imageGenProgress?: { done: number; total: number };
  orderQuantities?: Record<string, number>;
  onOrderQuantityChange?: (dish: Dish, quantity: number) => void;
  orderTotalQuantity?: number;
  orderTotalLabel?: string;
  onOpenOrderConfirm?: () => void;
}

export default function ResultsPage({
  result,
  onBack,
  onDishDetail,
  onShare,
  loading,
  showAllergens,
  showVeg,
  targetLang = "zh",
  uiLang = "zh",
  imageGenProgress,
  orderQuantities,
  onOrderQuantityChange,
  orderTotalQuantity = 0,
  orderTotalLabel = "价格待核对",
  onOpenOrderConfirm,
}: ResultsPageProps) {
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>("all");
  const categories = useMemo(() => buildCategoryList(result), [result]);
  const filteredDishes = useMemo(
    () => (result ? result.pages.flatMap((page) => (page.dishes || []).map((dish) => ({ dish, pageIndex: page.page_index }))) : []),
    [result]
  );
  const displayedDishes = useMemo(
    () => filterDishesByCategory(result, selectedCategory),
    [result, selectedCategory]
  );
  const dishById = useMemo(() => {
    const map = new Map<string, { dish: Dish; pageIndex: number }>();
    for (const item of filteredDishes) map.set(item.dish.id, item);
    return map;
  }, [filteredDishes]);
  const lookupDishName = (id: string): string | undefined => dishById.get(id)?.dish.name_translated?.zh;

  // ── Loading / Skeleton ──────────────────────────────────
  if (loading) {
    return (
      <div className="h-full flex flex-col" style={{ background: "var(--bg)" }}>
        <div className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0" style={{ borderBottom: "1px solid var(--rule)" }}>
          <button onClick={onBack} className="text-sm cursor-pointer" style={{ color: "var(--ink)", background: "none", border: "none" }}>←</button>
          <span className="text-sm font-bold flex-1" style={{ fontFamily: "var(--font-body)", color: "var(--ink)" }}>加载中...</span>
          <span className="text-[10px] font-bold px-2 py-1 rounded-xl" style={{ fontFamily: "var(--font-ui)", color: "var(--primary)", background: "rgba(76,175,80,0.1)" }}>AI 识别</span>
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
  const isInfoPage = !isReal && pages.some((p) => (p as { page_type?: string }).page_type === "info" || (p as { page_label?: string }).page_label === "说明页");
  const infoDescription = !isReal && pages.length > 0
    ? (pages[0] as { page_description?: string }).page_description || ""
    : "";
  const resolvedSourceLang = resolveMenuSourceLanguage(result);
  const sourceLang = (resolvedSourceLang || "?").toUpperCase();
  const resultTargetLang = result?.metadata?.target_language || targetLang;
  const targetLangLabel = uiLang === "en"
    ? targetLanguageName(resultTargetLang, uiLang)
    : targetLanguageNativeName(resultTargetLang);
  const pageLabel = pages.length > 0 ? pages[0]?.page_label || "菜单" : "菜单";

  const sourceLangNames: Record<string, string> = {
    fr: "法语菜单", ja: "日语菜单", it: "意大利语菜单", es: "西班牙语菜单",
    de: "德语菜单", ko: "韩语菜单", th: "泰语菜单", en: "英语菜单",
    zh: "中文菜单", pt: "葡语菜单", vi: "越南语菜单",
  };
  const titleText = sourceLangNames[resolvedSourceLang || ""] || pageLabel;
  const isImageBackfillActive = Boolean(
    imageGenProgress?.total && imageGenProgress.done < imageGenProgress.total
  );

  return (
    <div className="h-full flex flex-col" style={{ position: "relative", background: "var(--bg)" }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0" style={{ borderBottom: "1px solid var(--rule)" }}>
        <button
          onClick={onBack}
          className="text-sm cursor-pointer transition-opacity hover:opacity-50"
          style={{ minWidth: 44, minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "flex-start", color: "var(--ink)", background: "none", border: "none" }}
        >
          ←
        </button>
        <span className="text-sm font-bold flex-1" style={{ fontFamily: "var(--font-body)", color: "var(--ink)" }}>
          {isReal ? titleText : pageLabel}
        </span>
        <span
          className="text-[10px] font-bold px-2 py-1 rounded-xl"
          style={{ fontFamily: "var(--font-ui)", color: "var(--primary)", background: "rgba(76,175,80,0.1)" }}
        >
          {sourceLang} → {targetLangLabel}
        </span>
        {isReal && onShare ? (
          <button
            onClick={onShare}
            className="inline-flex items-center justify-center transition-opacity hover:opacity-70"
            aria-label="分享菜单"
            style={{ width: 44, height: 44, margin: "-9px", borderRadius: "50%", border: "none", background: "rgba(45,45,45,0.06)", color: "var(--ink)", cursor: "pointer" }}
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
      </div>

      {/* Scroll area */}
      <div className="flex-1 overflow-y-auto" style={{ padding: "0 0 70px", overflowX: "hidden" }}>
        {/* Allergen bar */}
        {isReal && (
          <SummaryInsightCard
            lang={resolvedSourceLang || "en"}
            restaurant={result?.metadata?.restaurant}
            insight={result?.metadata?.insight}
            signature={result?.metadata?.signature}
            dishNameLookup={lookupDishName}
            totalDishes={result?.metadata?.total_dishes || 0}
            pageCount={pages.length}
            dishes={allDishes.map((item) => item.dish)}
            targetLang={resultTargetLang}
          />
        )}

        {isReal && isImageBackfillActive && imageGenProgress ? (
          <div
            role="status"
            aria-live="polite"
            style={{
              margin: "10px 16px 8px",
              padding: "12px 14px",
              borderRadius: 18,
              border: "1px solid rgba(231,205,174,0.72)",
              background: "linear-gradient(135deg, rgba(255,250,242,0.92), rgba(255,238,210,0.72))",
              boxShadow: "0 10px 24px rgba(69,48,30,0.06)",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "rgba(76,175,80,0.12)",
                color: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, stroke: "currentColor", fill: "none", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }}>
                <path d="M4 15c2.4-1.4 4.8-1.4 7.2 0s4.8 1.4 7.2 0" />
                <path d="M5 11c2-1.2 4-1.2 6 0s4 1.2 6 0" />
                <path d="M8 7c1.3-.7 2.7-.7 4 0s2.7.7 4 0" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 10,
                  marginBottom: 5,
                }}
              >
                <span style={{ font: "900 12px var(--font-body)", color: "var(--ink)" }}>
                  图片正在后台补齐
                </span>
                <span style={{ font: "800 11px var(--font-ui)", color: "var(--primary)", whiteSpace: "nowrap" }}>
                  {imageGenProgress.done}/{imageGenProgress.total}
                </span>
              </div>
              <div style={{ font: "600 10px/1.45 var(--font-ui)", color: "var(--muted)" }}>
                先看翻译和推荐，菜品图会自动换成高清版本。
              </div>
              <div style={{ height: 4, marginTop: 8, borderRadius: 999, background: "rgba(45,45,45,0.08)", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${Math.max(8, Math.min(100, Math.round((imageGenProgress.done / imageGenProgress.total) * 100)))}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: "var(--primary)",
                    transition: "width 0.35s ease",
                  }}
                />
              </div>
            </div>
          </div>
        ) : null}

        {isReal && categories.length > 0 && (
          <CategoryTabs
            categories={categories}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />
        )}

        {/* Section label */}
        {isReal && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "10px 16px 6px" }}>
            <span style={{ font: "900 11px var(--font-body)", color: "var(--ink)" }}>
              {categories.find((c) => c.key === selectedCategory)?.label || "全部菜品"}
            </span>
          </div>
        )}

        {/* Allergen bar */}
        <div style={{ margin: "0 16px" }}>
        {showAllergens && (
          <div
            className="flex items-center gap-1.5"
            style={{
              padding: "10px 14px",
              marginBottom: 10,
              background: "var(--allergen-bg)",
              borderRadius: "var(--radius-sm)",
              fontFamily: "var(--font-ui)",
              fontSize: 11,
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
          displayedDishes.map((dish, i) => {
            const dishText = getDishText(dish, resultTargetLang);
            const dishPriceLabel = getDishPriceDisplay(dish);
            const originalNameLabel = stripPriceFromOriginalName(dishText.originalName) || dishText.originalName;
            const insight = getDishInsight(dish, resultTargetLang);
            const includedItems = getDishIncludedItems(dish, resultTargetLang);
            const orderControlOffset = onOrderQuantityChange ? 58 : 0;

            const isVeg = isVegetarianDish(dish);
            const tags = buildDishDisplayTags({
              dish,
              signature: result?.metadata?.signature,
              showAllergens,
              maxTags: 4,
            });

            return (
              <div
                key={dish.id || `dish-${i}`}
                className="relative"
                style={{ marginBottom: 14, animation: `fadeSlideUp 0.35s ease-out ${i * 60}ms both` }}
              >
                <button
                  onClick={() => onDishDetail(dish)}
                  className="flex items-start gap-4 w-full text-left transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
                  style={{
                    background: "var(--card)",
                    borderRadius: 28,
                    padding: 18,
                    paddingRight: 18 + orderControlOffset,
                    boxShadow: "0 14px 34px rgba(69,48,30,0.08)",
                    cursor: "pointer",
                    border: "1px solid rgba(231,205,174,0.42)",
                    fontFamily: "inherit",
                  }}
                >
                  {/* Image */}
                  <DishImageWithLoading dish={dish} size="card" alt={dishText.originalName} pendingDone={imageGenProgress?.done} pendingTotal={imageGenProgress?.total} priority={i === 0}>
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
                  </DishImageWithLoading>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 800, color: "var(--primary)", letterSpacing: 0, marginBottom: 5 }}>
                      {String(i + 1).padStart(2, "0")}
                      {dish.rating_avg ? (
                        <span className="inline-flex items-center gap-0.5 ml-1.5" style={{ fontSize: 12, color: "var(--accent)", fontWeight: 800 }}>
                          ★ {dish.rating_avg}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-start gap-2" style={{ marginBottom: 5 }}>
                      <div className="min-w-0 flex-1" style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: 0, lineHeight: 1.2 }}>
                        {dishText.translatedName}
                      </div>
                      {dishPriceLabel ? (
                        <span
                          style={{
                            flexShrink: 0,
                            paddingTop: 1,
                            fontFamily: "var(--font-body)",
                            fontSize: 15,
                            fontWeight: 800,
                            color: "var(--ink)",
                            lineHeight: 1.2,
                          }}
                        >
                          {dishPriceLabel}
                        </span>
                      ) : null}
                    </div>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: 12.5, color: "var(--muted)", fontStyle: "italic", marginBottom: 7, lineHeight: 1.3 }}>
                      {originalNameLabel}
                    </div>
                    <div style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--ink-soft)", marginBottom: 7, lineHeight: 1.55 }}>
                      {insight.summary}
                    </div>
                    <div style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--primary)", marginBottom: 10, lineHeight: 1.55, fontWeight: 700 }}>
                      {insight.recommendation}
                    </div>
                    {includedItems.length > 0 ? (
                      <div
                        style={{
                          display: "block",
                          width: "100%",
                          boxSizing: "border-box",
                          overflowWrap: "break-word",
                          padding: "4px 8px",
                          borderRadius: 10,
                          background: "rgba(76,175,80,0.07)",
                          marginBottom: 8,
                          fontFamily: "var(--font-ui)",
                          fontSize: 11.5,
                          lineHeight: 1.45,
                          color: "var(--primary)",
                          fontWeight: 700,
                        }}
                      >
                        <span style={{ color: "var(--muted)", marginRight: 4 }}>套餐包含：</span>
                        {includedItems.join(" / ")}
                      </div>
                    ) : null}
                    <div className="flex gap-1 flex-wrap">
                      {tags.map((t, j) => (
                        <Pill key={j} label={t.label} type={t.type} />
                      ))}
                    </div>
                  </div>
                </button>
                {onOrderQuantityChange ? (
                  <div style={{ position: "absolute", right: 12, bottom: 14, zIndex: 2 }}>
                    <OrderQuantityControl
                      compact
                      quantity={orderQuantities?.[dish.id] || 0}
                      onChange={(quantity) => onOrderQuantityChange(dish, quantity)}
                    />
                  </div>
                ) : null}
              </div>
            );
          })
        ) : isInfoPage ? (
          /* Info page — restaurant story/philosophy, not a menu */
          <div className="flex flex-col items-center justify-center text-center" style={{ padding: "40px 20px" }}>
            <div className="flex items-center justify-center" style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--card)", marginBottom: 10 }}>
              <svg viewBox="0 0 24 24" style={{ width: 24, height: 24, stroke: "var(--primary)", fill: "none", strokeWidth: 1.5, strokeLinecap: "round" }}>
                <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
              </svg>
            </div>
            <h4 style={{ fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 800, color: "var(--ink)", marginBottom: 6 }}>
              非菜单页面
            </h4>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.6, maxWidth: 280 }}>
              {infoDescription || "这是餐厅的品牌介绍或食材理念页，不包含可点单的菜品。请翻到带价格和菜品名的菜单页再拍摄。"}
            </p>
          </div>
        ) : (
          /* Empty state — genuine recognition failure */
          <div className="flex flex-col items-center justify-center text-center" style={{ padding: "40px 20px", opacity: 0.45 }}>
            <div className="flex items-center justify-center" style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--card)", marginBottom: 10 }}>
              <svg viewBox="0 0 24 24" style={{ width: 24, height: 24, stroke: "var(--muted)", fill: "none", strokeWidth: 1.5, strokeLinecap: "round" }}>
                <circle cx="12" cy="12" r="9" /><path d="M8 12h8" />
              </svg>
            </div>
            <h4 style={{ fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>
              没有识别到菜品
            </h4>
            <p style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--muted)", opacity: 0.7 }}>
              请重新拍摄清晰的菜单照片
            </p>
          </div>
        )}
        </div>

        {/* Failed pages warning */}
        {result?.failed_pages && result.failed_pages.length > 0 && (
          <div
            style={{
              padding: "8px 12px",
              background: "var(--allergen-bg)",
              borderRadius: "var(--radius-sm)",
              fontFamily: "var(--font-ui)",
              fontSize: 11,
              color: "var(--accent)",
              fontWeight: 600,
            }}
          >
            部分页面识别失败（{result.failed_pages.map((p) => p.page_index + 1).join(", ")}），请重新拍摄
          </div>
        )}
      </div>
      {onOrderQuantityChange && onOpenOrderConfirm && orderTotalQuantity > 0 ? (
        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); onOpenOrderConfirm(); }}
          className="inline-flex items-center gap-2 transition-all duration-150 active:scale-[0.97]"
          style={{
            position: "absolute",
            right: 16,
            bottom: 16,
            zIndex: 7,
            height: 44,
            minHeight: 44,
            padding: "0 12px",
            border: "1px solid rgba(232,213,192,0.84)",
            borderRadius: 18,
            background: "rgba(255,240,221,0.96)",
            color: "var(--ink-soft)",
            boxShadow: "0 10px 24px rgba(45,45,45,0.08)",
            fontFamily: "var(--font-ui)",
            fontSize: 10,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          <span
            style={{
              display: "grid",
              placeItems: "center",
              width: 24,
              height: 24,
              borderRadius: 10,
              background: "rgba(76,175,80,0.08)",
              color: "var(--primary)",
              fontFamily: "var(--font-ui)",
              fontSize: 10,
              fontWeight: 900,
            }}
          >
            {orderTotalQuantity}
          </span>
          <span>已选 · {orderTotalLabel}</span>
        </button>
      ) : null}
    </div>
  );
}
