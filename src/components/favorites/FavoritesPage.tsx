"use client";

import Image from "next/image";

interface FavoriteDish {
  id: string;
  name_original: string;
  name_zh: string;
  cuisine: string;
  image_url?: string;
}

const mockFavorites: FavoriteDish[] = [
  {
    id: "1", name_original: "Boeuf Bourguignon", name_zh: "勃艮第红酒炖牛肉", cuisine: "法式",
    image_url: "https://images.unsplash.com/photo-1667396702543-a239efa7a7f2?w=112&h=112&fit=crop&auto=format",
  },
  {
    id: "3", name_original: "Tarte Tatin", name_zh: "反转焦糖苹果挞", cuisine: "甜点",
    image_url: "https://images.unsplash.com/photo-1616953882462-8a583e0afbb4?w=112&h=112&fit=crop&auto=format",
  },
  {
    id: "5", name_original: "Sole Meunière", name_zh: "法式黄油煎鳎鱼", cuisine: "海鲜",
    image_url: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=112&h=112&fit=crop&auto=format",
  },
];

interface FavoritesPageProps {
  onBack: () => void;
  onDishDetail?: (id: string) => void;
  favorites?: FavoriteDish[];
}

export default function FavoritesPage({ onBack, onDishDetail, favorites }: FavoritesPageProps) {
  const items = favorites?.length ? favorites : mockFavorites;
  const isEmpty = items.length === 0;

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
        <h2 style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
          我的收藏
        </h2>
        {!isEmpty && (
          <span
            className="ml-auto font-semibold"
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 9,
              color: "var(--muted)",
            }}
          >
            {items.length} 道
          </span>
        )}
      </div>

      {isEmpty ? (
        /* Empty state */
        <div className="flex-1 flex flex-col items-center justify-center text-center" style={{ padding: "60px 30px" }}>
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
              <path d="M24 36C14 28 8 22 8 14C8 8 14 4 19 4C22 4 26 6 28 9C30 6 34 4 37 4C42 4 48 8 48 14C48 22 38 28 24 36Z" />
            </svg>
          </div>
          <h3 style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>
            还没有收藏
          </h3>
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 9, color: "var(--muted)", opacity: 0.7, marginBottom: 20, maxWidth: 200, lineHeight: 1.5 }}>
            浏览翻译结果时，点击心形图标即可收藏喜欢的菜品
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
            开始探索
          </button>
        </div>
      ) : (
        /* Filled state */
        <div className="flex-1 overflow-auto" style={{ padding: "10px 16px" }}>
          {items.map((dish, i) => (
            <button
              key={dish.id}
              onClick={() => onDishDetail?.(dish.id)}
              className="flex items-center gap-3 w-full text-left py-3 transition-all duration-150 hover:pl-1 active:opacity-50"
              style={{
                borderBottom: i < items.length - 1 ? "1px solid var(--rule)" : "none",
                cursor: "pointer",
                background: "none",
                fontFamily: "inherit",
                borderTop: "none",
                borderLeft: "none",
                borderRight: "none",
              }}
            >
              <div className="relative flex-shrink-0 overflow-hidden" style={{ width: 56, height: 56, borderRadius: "var(--radius-sm)" }}>
                {dish.image_url ? (
                  <Image src={dish.image_url} alt={dish.name_zh} fill sizes="56px" style={{ objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "100%", height: "100%", background: "var(--card)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-ui)", fontSize: 8, color: "var(--muted)" }}>
                    {dish.name_zh[0]}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div style={{ fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>
                  {dish.name_zh}
                </div>
                <div className="flex gap-2.5" style={{ fontFamily: "var(--font-ui)", fontSize: 8, color: "var(--muted)", fontWeight: 500 }}>
                  <span>{dish.name_original}</span>
                  <span>· {dish.cuisine}</span>
                </div>
              </div>
              <svg viewBox="0 0 20 18" style={{ width: 18, height: 16, fill: "var(--accent)", stroke: "var(--accent)", strokeWidth: 0.8, flexShrink: 0 }}>
                <path d="M10 16C4 12 2 10 2 7 2 4 4 2 6.5 2 8 2 9 3 10 5 11 3 12 2 13.5 2 16 2 18 4 18 7 18 10 16 12 10 16Z" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
