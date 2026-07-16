"use client";

import Image from "next/image";
import { useState } from "react";
import type { HistoryEntry } from "@/types";
import { sourceLanguageName } from "@/lib/order-state";
import { getRestaurantDisplayMeta } from "@/lib/restaurant-display";

const fallbackHistoryImage = "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=120&h=120&fit=crop&auto=format";

interface HistoryItem {
  id: string;
  restaurant: string;
  city: string;
  lang: string;
  dishCount: number;
  pageCount: number;
  date: string;
  img: string;
}

function toHistoryItems(entries: HistoryEntry[]): HistoryItem[] {
  return entries.map((e) => {
    const restaurantMeta = getRestaurantDisplayMeta(
      e.source_lang,
      e.target_lang,
      e.result_summary?.metadata?.restaurant,
    );
    const legacyNames = [
      `${sourceLanguageName(e.source_lang)}菜单`,
      "菜单翻译",
    ];
    const isLegacyName = legacyNames.includes(e.restaurant_name) || /^翻译 #[a-z0-9]+$/i.test(e.restaurant_name);
    return {
      id: e.id,
      restaurant: e.restaurant_name && !isLegacyName ? e.restaurant_name : restaurantMeta.display_name,
      city: e.city || restaurantMeta.city,
      lang: e.source_lang,
      dishCount: e.dish_count,
      pageCount: e.page_count,
      date: e.date,
      img: e.thumbnail,
    };
  });
}

function groupByMonth(items: HistoryItem[]) {
  const months: Record<string, HistoryItem[]> = {};
  for (const item of items) {
    const key = item.date.slice(0, 7);
    if (!months[key]) months[key] = [];
    months[key].push(item);
  }
  return Object.entries(months).map(([key, items]) => ({
    label: `${key.replace("-", "年")}月`,
    items,
  }));
}

// ── Page ──────────────────────────────────────────────────────────────

interface HistoryPageProps {
  onBack: () => void;
  onSelect?: (id: string) => void;
  loading?: boolean;
  history?: HistoryEntry[];
}

export default function HistoryPage({ onBack, onSelect, loading, history }: HistoryPageProps) {
  const [failedThumbs, setFailedThumbs] = useState<Record<string, true>>({});

  if (loading) {
    return (
      <div className="h-full flex flex-col" style={{ background: "var(--bg)" }}>
        <div className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0" style={{ borderBottom: "1px solid var(--rule)" }}>
          <button onClick={onBack} className="text-[11px] cursor-pointer" style={{ color: "var(--ink)", background: "none", border: "none" }}>←</button>
          <h2 style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>历史记录</h2>
        </div>
        <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton-shimmer rounded" style={{ height: 56, background: "var(--card)", borderRadius: "var(--radius)" }} />
          ))}
        </div>
      </div>
    );
  }

  const items = toHistoryItems(history || []);
  const groups = groupByMonth(items);
  const isEmpty = items.length === 0;

  return (
    <div className="h-full flex flex-col" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <div className="flex items-center gap-2 flex-shrink-0" style={{ padding: "48px 20px 10px" }}>
        <button
          onClick={onBack}
          className="text-[11px] cursor-pointer transition-opacity hover:opacity-50"
          style={{ color: "var(--ink)", background: "none", border: "none" }}
        >
          ←
        </button>
        <h2 style={{ fontFamily: "var(--font-body)", fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
          翻译历史
        </h2>
        <span style={{ fontFamily: "var(--font-ui)", fontSize: 7, fontWeight: 600, color: "var(--primary)", background: "rgba(76,175,80,0.08)", padding: "2px 8px", borderRadius: 10 }}>
          本地存储
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto" style={{ padding: "0 20px" }}>
        {isEmpty ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center text-center" style={{ padding: "60px 30px" }}>
            <div
              className="flex items-center justify-center"
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                background: "var(--card)",
                marginBottom: 18,
              }}
            >
              <svg viewBox="0 0 48 48" style={{ width: 40, height: 40, stroke: "var(--muted)", fill: "none", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" }}>
                <circle cx="24" cy="24" r="18" />
                <line x1="24" y1="14" x2="24" y2="28" />
                <circle cx="24" cy="34" r="1.5" fill="var(--muted)" stroke="none" />
              </svg>
            </div>
            <h3 style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>
              还没有翻译记录
            </h3>
            <p style={{ fontFamily: "var(--font-ui)", fontSize: 9, color: "var(--muted)", opacity: 0.7, marginBottom: 20, maxWidth: 200, lineHeight: 1.5 }}>
              拍摄第一份菜单，AI 即刻为你翻译
            </p>
            <button
              onClick={onBack}
              className="transition-all duration-150 active:scale-[0.96]"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 10,
                fontWeight: 700,
                color: "#FFF",
                background: "var(--primary)",
                border: "none",
                borderRadius: "var(--radius)",
                padding: "10px 28px",
                cursor: "pointer",
                boxShadow: "0 4px 16px rgba(76,175,80,0.2)",
              }}
            >
              开始翻译
            </button>
          </div>
        ) : (
        <>
        {/* Search hint */}
        <div
          className="flex items-center gap-1.5"
          style={{
            padding: "10px 14px",
            marginBottom: 14,
            background: "var(--card)",
            borderRadius: "var(--radius)",
            fontFamily: "var(--font-ui)",
            fontSize: 9,
            color: "var(--muted)",
          }}
        >
          <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, stroke: "var(--muted)", fill: "none", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" }}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          搜索餐厅或菜系...
        </div>

        {groups.map((group) => (
          <div key={group.label} style={{ marginBottom: 4 }}>
            <div
              style={{
                fontFamily: "var(--font-body)",
            fontSize: 9,
            fontWeight: 700,
            color: "var(--muted)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: 6,
            padding: "12px 0 6px",
            borderBottom: "1px solid var(--rule)",
              }}
            >
              {group.label}
            </div>
            {group.items.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelect?.(item.id)}
                className="flex items-center gap-2.5 w-full text-left transition-all duration-150 hover:pl-1 active:opacity-50"
                style={{
                  padding: "10px 0",
                  borderBottom: "1px solid var(--rule)",
                  cursor: "pointer",
                  background: "none",
                  fontFamily: "inherit",
                  borderTop: "none",
                  borderLeft: "none",
                  borderRight: "none",
                }}
              >
                <div
                  className="relative flex-shrink-0 flex items-center justify-center overflow-hidden"
                  style={{ width: 44, height: 44, borderRadius: "var(--radius-sm)", background: "var(--card)" }}
                >
                  <Image
                    src={failedThumbs[item.img] ? fallbackHistoryImage : item.img || fallbackHistoryImage}
                    alt={item.restaurant}
                    fill
                    sizes="44px"
                    style={{ objectFit: "cover" }}
                    onError={() => {
                      if (item.img) setFailedThumbs((prev) => ({ ...prev, [item.img]: true }));
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div style={{ fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 600, color: "var(--ink)", marginBottom: 2 }}>
                    {item.restaurant}
                  </div>
                  <div className="flex gap-2.5" style={{ fontFamily: "var(--font-ui)", fontSize: 8, color: "var(--muted)", fontWeight: 500 }}>
                    <span>{item.city} · {item.lang}</span>
                    <span>{item.dishCount} 道菜</span>
                    <span>{item.pageCount} 页</span>
                  </div>
                </div>
                <span className="flex-shrink-0" style={{ fontFamily: "var(--font-ui)", fontSize: 8, color: "var(--muted)", fontWeight: 500 }}>
                  {parseInt(item.date.slice(5, 7))}月{parseInt(item.date.slice(8, 10))}日
                </span>
              </button>
            ))}
          </div>
        ))}
        </>
        )}
      </div>
    </div>
  );
}
