"use client";

import { useState } from "react";
import Image from "next/image";
import FoodThumbnailFallback from "@/components/shared/FoodThumbnailFallback";
import { isSafeStoredThumbnail } from "@/lib/safe-image-url";

interface FavoriteDish {
  id: string;
  name_original: string;
  name_zh: string;
  cuisine: string;
  image_url?: string;
}

interface FavoritesPageProps {
  onBack: () => void;
  onDishDetail?: (id: string) => void;
  favorites?: FavoriteDish[];
  onRemoveFavorite?: (id: string) => void;
}

export default function FavoritesPage({ onBack, onDishDetail, favorites, onRemoveFavorite }: FavoritesPageProps) {
  const [failedFavoriteImages, setFailedFavoriteImages] = useState<Record<string, true>>({});
  const items = favorites?.length ? favorites : [];
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
        <h2 style={{ fontFamily: "var(--font-body)", fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>
          我的收藏
        </h2>
        {!isEmpty && (
          <span
            className="ml-auto font-semibold"
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 12,
              color: "var(--muted)",
            }}
          >
            {items.length} 道
          </span>
        )}
        <span style={{ fontFamily: "var(--font-ui)", fontSize: 11, fontWeight: 750, color: "var(--primary)", background: "rgba(76,175,80,0.08)", padding: "4px 10px", borderRadius: 999 }}>
          本地
        </span>
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
          <h3 style={{ fontFamily: "var(--font-body)", fontSize: 16, fontWeight: 800, color: "var(--muted)", marginBottom: 6 }}>
            还没有收藏
          </h3>
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--muted)", opacity: 0.76, marginBottom: 22, maxWidth: 250, lineHeight: 1.55 }}>
            浏览翻译结果时，点击心形图标即可收藏喜欢的菜品
          </p>
          <button
            onClick={onBack}
            className="transition-all duration-150 active:scale-[0.96]"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 14,
              fontWeight: 700,
              color: "#FFF",
              background: "var(--primary)",
              border: "none",
              borderRadius: "var(--radius)",
              padding: "13px 30px",
              cursor: "pointer",
              boxShadow: "0 4px 16px rgba(76,175,80,0.2)",
            }}
          >
            开始探索
          </button>
        </div>
      ) : (
        /* Filled state */
        <div className="flex-1 overflow-auto" style={{ padding: "0 20px" }}>
          {items.map((dish, i) => {
            const imageUrl = isSafeStoredThumbnail(dish.image_url) ? dish.image_url : "";
            const showImage = imageUrl && !failedFavoriteImages[imageUrl];

            return (
              <button
                key={dish.id}
                onClick={() => onDishDetail?.(dish.id)}
                className="flex items-center gap-3 w-full text-left transition-all duration-150 hover:pl-1 active:opacity-50"
                style={{
                  padding: "13px 0",
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
                  {showImage ? (
                    <Image
                      src={imageUrl}
                      alt={dish.name_zh}
                      fill
                      sizes="56px"
                      style={{ objectFit: "cover" }}
                      onError={() => {
                        setFailedFavoriteImages((prev) => ({ ...prev, [imageUrl]: true }));
                      }}
                    />
                  ) : (
                    <FoodThumbnailFallback label={`${dish.name_zh} 暂无图片`} size={56} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 750, color: "var(--ink)", marginBottom: 4, lineHeight: 1.25 }}>
                    {dish.name_zh}
                  </div>
                  <div className="flex gap-2.5" style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--muted)", fontWeight: 650, lineHeight: 1.35 }}>
                    <span>{dish.name_original}</span>
                    <span>· {dish.cuisine}</span>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onRemoveFavorite?.(dish.id); }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}
                >
                  <svg viewBox="0 0 20 18" style={{ width: 18, height: 16, fill: "var(--accent)", stroke: "var(--accent)", strokeWidth: 0.8 }}>
                    <path d="M10 16C4 12 2 10 2 7 2 4 4 2 6.5 2 8 2 9 3 10 5 11 3 12 2 13.5 2 16 2 18 4 18 7 18 10 16 12 10 16Z" />
                  </svg>
                </button>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
