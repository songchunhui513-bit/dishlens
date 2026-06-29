"use client";

import type { Dish, OrderedVisit } from "@/types";
import DishImageWithLoading from "@/components/shared/DishImageWithLoading";
import { getDishInsight, getDishText } from "@/lib/dish-presentation";
import { formatOrderPrice, sourceLanguageName, summarizeOrder } from "@/lib/order-state";
import { getRestaurantDisplayMeta } from "@/lib/restaurant-display";

interface OrderedDetailPageProps {
  visit: OrderedVisit | null;
  onBack: () => void;
  onDishDetail: (dish: Dish) => void;
  onReviewDish: (dish: Dish) => void;
}

export default function OrderedDetailPage({ visit, onBack, onDishDetail, onReviewDish }: OrderedDetailPageProps) {
  if (!visit) {
    return (
      <div className="h-full flex flex-col items-center justify-center" style={{ background: "var(--bg)" }}>
        <div style={{ fontFamily: "var(--font-body)", fontSize: 10, color: "var(--muted)" }}>暂无点过记录</div>
        <button onClick={onBack} style={{ marginTop: 12, fontFamily: "var(--font-ui)", fontSize: 9, color: "var(--primary)", background: "none", border: "none", cursor: "pointer" }}>← 返回</button>
      </div>
    );
  }

  const summary = summarizeOrder(visit.items);
  const restaurantMeta = getRestaurantDisplayMeta(
    visit.source_lang,
    visit.target_lang,
    visit.result_summary?.metadata?.restaurant,
  );
  const isLegacyMenuName = visit.restaurant_name === `${sourceLanguageName(visit.source_lang)}菜单`;
  const restaurantName = visit.restaurant_name && !isLegacyMenuName ? visit.restaurant_name : restaurantMeta.display_name;

  return (
    <div className="h-full flex flex-col" style={{ background: "var(--bg)" }}>
      <div className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0" style={{ borderBottom: "1px solid var(--rule)" }}>
        <button onClick={onBack} className="text-[11px] cursor-pointer transition-opacity hover:opacity-50" style={{ color: "var(--ink)", background: "none", border: "none" }}>←</button>
        <span className="text-xs font-bold flex-1" style={{ fontFamily: "var(--font-body)", color: "var(--ink)" }}>{restaurantName}</span>
        <span className="text-[7px] font-bold px-2 py-1 rounded-xl" style={{ fontFamily: "var(--font-ui)", color: "var(--primary)", background: "rgba(76,175,80,0.1)" }}>
          {sourceLanguageName(visit.source_lang)}
        </span>
      </div>
      <div className="flex-1 overflow-auto" style={{ padding: "8px 16px 12px" }}>
        <div style={{ padding: "8px 2px 10px", fontFamily: "var(--font-ui)", fontSize: 8, color: "var(--muted)", fontWeight: 700 }}>
          {new Date(visit.date).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} · 预计 {formatOrderPrice(summary)}
        </div>
        {visit.items.map((item, i) => {
          const dishText = getDishText(item.dish, visit.target_lang);
          const insight = getDishInsight(item.dish, visit.target_lang);
          return (
            <div
              key={item.dish_id}
              className="relative flex items-start gap-3.5 w-full text-left transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
              onClick={() => onDishDetail(item.dish)}
              style={{
                background: "var(--card)",
                borderRadius: "var(--radius-lg)",
                padding: 14,
                marginBottom: 10,
                boxShadow: "var(--shadow)",
                cursor: "pointer",
                animation: `fadeSlideUp 0.35s ease-out ${i * 60}ms both`,
              }}
            >
              <DishImageWithLoading dish={item.dish} size="card" alt={dishText.originalName} />
              <div className="flex-1 min-w-0" style={{ paddingRight: 40 }}>
                <div style={{ fontFamily: "var(--font-body)", fontSize: 8, fontWeight: 700, color: "var(--primary)", letterSpacing: "0.04em", marginBottom: 2 }}>
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700, color: "var(--ink)", letterSpacing: "0.01em", marginBottom: 2 }}>
                  {dishText.translatedName}
                </div>
                <div style={{ fontFamily: "var(--font-body)", fontSize: 9, color: "var(--muted)", fontStyle: "italic", marginBottom: 2 }}>
                  {dishText.originalName}
                </div>
                <div style={{ fontFamily: "var(--font-ui)", fontSize: 8, color: "var(--ink-soft)", marginBottom: 4, lineHeight: 1.4 }}>
                  {item.quantity} 份 · {item.unitPrice ? `${item.unitPrice.amount * item.quantity}${item.unitPrice.currency}` : "价格待核对"}
                </div>
                <div style={{ fontFamily: "var(--font-ui)", fontSize: 8, color: "var(--primary)", lineHeight: 1.4, fontWeight: 600 }}>
                  {insight.recommendation}
                </div>
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (!item.reviewed) onReviewDish(item.dish);
                }}
                style={{
                  position: "absolute",
                  right: 12,
                  top: 12,
                  border: "none",
                  borderRadius: 999,
                  background: item.reviewed ? "rgba(76,175,80,0.10)" : "rgba(255,159,28,0.12)",
                  color: item.reviewed ? "var(--primary)" : "var(--accent)",
                  padding: "4px 8px",
                  fontFamily: "var(--font-ui)",
                  fontSize: 7.5,
                  fontWeight: 800,
                  cursor: item.reviewed ? "default" : "pointer",
                }}
              >
                {item.reviewed ? "已评" : "评价"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
