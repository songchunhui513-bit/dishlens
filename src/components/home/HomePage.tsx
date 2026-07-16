"use client";

import Image from "next/image";
import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import type { CapturedPhoto } from "@/types";
import type { RestaurantSource } from "@/lib/location-recommendation";
import RegionLandmarkIcon from "@/components/shared/RegionLandmarkIcon";
import { getDefaultRecentMenuRecords, type RecentMenuRecord } from "@/lib/recent-menu-records";

interface DailyDishData {
  id: string;
  name_en: string;
  name_zh: string;
  cuisine: string;
  category: string;
  image_url: string;
  description_zh: string;
  taste_profile: string[];
  calories: number | null;
  spice_level: number | null;
  rating: number;
}

interface HomePageProps {
  onNavigate?: (screen: string) => void;
  onCapture?: () => void;
  onAlbumAnalyze?: (photos: CapturedPhoto[]) => void;
  onDailyDishDetail?: () => void;
  onRecentClick?: (id: string) => void;
  recentHistory?: RecentMenuRecord[];
  dailyDish?: DailyDishData;
  recommendationContext?: string;
  recommendationReason?: string;
  restaurantSource?: RestaurantSource | null;
  uiLang?: "zh" | "en";
}

const fallbackRecentImage = "/dishes/pizza-margherita.png";
const fallbackDailyDishImage = "/dishes/boeuf-bourguignon.png";

const CUISINE_LABELS: Record<string, string> = {
  french: "法式料理", japanese: "日式料理", italian: "意式料理", chinese: "中式料理",
  korean: "韩式料理", thai: "泰式料理", mexican: "墨西哥料理", spanish: "西班牙料理",
  indian: "印度料理", turkish: "土耳其料理", vietnamese: "越南料理", american: "美式料理",
};

const CUISINE_LABELS_EN: Record<string, string> = {
  french: "French cuisine", japanese: "Japanese cuisine", italian: "Italian cuisine", chinese: "Chinese cuisine",
  korean: "Korean cuisine", thai: "Thai cuisine", mexican: "Mexican cuisine", spanish: "Spanish cuisine",
  indian: "Indian cuisine", turkish: "Turkish cuisine", vietnamese: "Vietnamese cuisine", american: "American cuisine",
  brazilian: "Brazilian cuisine", german: "German cuisine", british: "British cuisine", greek: "Greek cuisine",
  international: "International cuisine",
};

const CATEGORY_LABELS_ZH: Record<string, string> = {
  appetizer: "前菜", main: "主菜", dessert: "甜点", drink: "饮品", soup: "汤品",
  bread: "面包", side: "配菜", snack: "小食", noodle: "面食", rice: "米饭", pasta: "意面", stew: "炖菜",
};

const CATEGORY_LABELS_EN: Record<string, string> = {
  appetizer: "Appetizer", main: "Main", dessert: "Dessert", drink: "Drink", soup: "Soup",
  bread: "Bread", side: "Side", snack: "Snack", noodle: "Noodles", rice: "Rice", pasta: "Pasta", stew: "Stew",
};

const TASTE_LABELS_EN: Record<string, string> = {
  甜: "Sweet", 奶香: "Creamy", 浓郁: "Rich", 鲜香: "Savory", 清爽: "Fresh",
  酸: "Sour", 辣: "Spicy", 咸: "Salty", 苦: "Bitter", 酥脆: "Crisp",
};

const homeCopy = {
  zh: {
    recommendationContextFallback: "按当前时段推荐",
    recommendationReasonLabel: "今日推荐理由：",
    recommendationReasonFallback: "根据当前时间，从本地知识库为你挑选一道适合现在点的菜。",
    todayPick: "今日推荐",
    cuisineFallback: "法式料理",
    categoryFallback: "主菜",
    albumAria: "从相册选择菜单照片",
    captureCta: "拍摄菜单 · 开始翻译",
    albumCta: "↑ 从相册选择",
    recentTitle: "最近翻译",
    viewAll: "查看全部 →",
    emptyTitle: "还没有翻译记录",
    emptySubtitle: "拍下第一张菜单，开启你的美食之旅",
    navHistory: "历史",
    navFavorites: "收藏",
    navOrdered: "点过",
    navSettings: "设置",
    restaurantFallback: "附近小馆",
  },
  en: {
    recommendationContextFallback: "Recommended for now",
    recommendationReasonLabel: "Today's reason: ",
    recommendationReasonFallback: "Based on the time of day, DishLens picked something that fits this moment.",
    todayPick: "Today's pick",
    cuisineFallback: "French cuisine",
    categoryFallback: "Main",
    albumAria: "Choose menu photos from album",
    captureCta: "Scan menu · Start translating",
    albumCta: "Choose from album",
    recentTitle: "Recent translations",
    viewAll: "View all →",
    emptyTitle: "No translations yet",
    emptySubtitle: "Take your first menu photo to start exploring.",
    navHistory: "History",
    navFavorites: "Favorites",
    navOrdered: "Ordered",
    navSettings: "Settings",
    restaurantFallback: "Nearby restaurant",
  },
};

export default function HomePage({
  onNavigate,
  onCapture,
  onAlbumAnalyze,
  onDailyDishDetail,
  onRecentClick,
  recentHistory,
  dailyDish,
  recommendationContext,
  recommendationReason,
  restaurantSource,
  uiLang = "zh",
}: HomePageProps) {
  const albumInputRef = useRef<HTMLInputElement>(null);
  const copy = homeCopy[uiLang === "en" ? "en" : "zh"];
  const recentItems = recentHistory && recentHistory.length > 0 ? recentHistory : getDefaultRecentMenuRecords();
  const hasHistory = recentHistory !== undefined && recentHistory.length >= 0;
  const isEmpty = hasHistory && recentHistory!.length === 0;
  const [failedRecentThumbs, setFailedRecentThumbs] = useState<Record<string, true>>({});

  const handleAlbumPick = () => {
    albumInputRef.current?.click();
  };

  const handleAlbumFilesChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const timestamp = Date.now();
    const photos = await Promise.all(
      files.map(
        (file, index) =>
          new Promise<CapturedPhoto>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              resolve({
                id: `album-${timestamp}-${index}`,
                dataUrl: reader.result as string,
                file,
                timestamp: timestamp + index,
              });
            };
            reader.onerror = () => reject(new Error("Image read failed"));
            reader.readAsDataURL(file);
          }),
      ),
    );

    event.target.value = "";
    onAlbumAnalyze?.(photos);
  };

  return (
    <div className="h-full flex flex-col" style={{ background: "var(--bg)" }}>
      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-shrink-0" style={{ padding: "44px 20px 8px" }}>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 17,
            fontWeight: 700,
            letterSpacing: "0.06em",
            color: "var(--ink)",
          }}
        >
          DishLens
          <span
            className="inline-block align-middle"
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--primary)",
              marginLeft: 1,
              animation: "breathe 2s infinite",
            }}
          />
        </span>
        <div
          className="flex items-center justify-center"
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "var(--card)",
            fontFamily: "var(--font-body)",
            fontSize: 14,
            fontWeight: 600,
            color: "var(--primary)",
          }}
        >
          D
        </div>
      </div>

      <div
        className="inline-flex items-center gap-1 flex-shrink-0"
        style={{
          alignSelf: "flex-start",
          fontFamily: "var(--font-ui)",
          fontSize: 8,
          fontWeight: 600,
          color: "var(--ink-soft)",
          padding: "4px 10px",
          borderRadius: 20,
          background: "var(--card-alt)",
          margin: "0 20px 4px",
        }}
      >
        <svg viewBox="0 0 24 24" style={{ width: 12, height: 12, stroke: "currentColor", fill: "none", strokeWidth: 2 }}>
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
        </svg>
        {recommendationContext || copy.recommendationContextFallback}
      </div>

      <div
        className="flex-shrink-0"
        style={{
          margin: "0 20px 8px",
          padding: "8px 14px",
          background: "var(--card-alt)",
          borderRadius: "var(--radius-sm)",
          fontFamily: "var(--font-body)",
          fontSize: 9,
          color: "var(--ink-soft)",
          lineHeight: 1.5,
        }}
      >
        <strong style={{ fontWeight: 700 }}>{copy.recommendationReasonLabel}</strong>
        {recommendationReason || dailyDish?.description_zh || copy.recommendationReasonFallback}
      </div>

      {/* ── Hero Carousel ─────────────────────────────────── */}
      <div style={{ padding: "0 20px 10px" }}>
        <div
          className="relative overflow-hidden"
          onClick={onDailyDishDetail}
          style={{
            background: "var(--card)",
            borderRadius: "var(--radius-xl)",
            padding: "18px 18px 18px 20px",
            boxShadow: "var(--shadow-lg)",
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr) 112px",
            alignItems: "center",
            gap: 14,
            animation: "fadeSlideUp 0.4s ease-out",
            cursor: onDailyDishDetail ? "pointer" : "default",
            minHeight: 150,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              className="inline-flex items-center"
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: 7,
                fontWeight: 700,
                letterSpacing: "0.05em",
                color: "#FFF",
                background: "var(--accent)",
                padding: "4px 10px",
                borderRadius: 14,
                marginBottom: 8,
              }}
            >
              {copy.todayPick}
            </div>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 8,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--primary)",
                marginBottom: restaurantSource ? 8 : 4,
              }}
            >
              {formatCuisine(dailyDish?.cuisine || "french", uiLang) || copy.cuisineFallback} · {formatCategory(dailyDish?.category, uiLang) || copy.categoryFallback}
            </div>
            {restaurantSource ? (
              <div
                className="flex items-center"
                style={{
                  gap: 7,
                  marginBottom: 8,
                  color: "var(--ink-soft)",
                  fontFamily: "var(--font-body)",
                  fontSize: 9,
                  fontWeight: 700,
                  minWidth: 0,
                }}
              >
                <RestaurantIcon />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                  {restaurantSource.localizedName || restaurantSource.name || copy.restaurantFallback}
                </span>
                {restaurantSource.distanceLabel ? (
                  <span
                    style={{
                      flexShrink: 0,
                      padding: "2px 7px",
                      borderRadius: 12,
                      background: "rgba(76,175,80,0.10)",
                      color: "var(--primary)",
                      fontFamily: "var(--font-ui)",
                      fontSize: 7,
                      fontWeight: 800,
                    }}
                  >
                    {restaurantSource.distanceLabel}
                  </span>
                ) : null}
              </div>
            ) : null}
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 18,
                fontWeight: 800,
                color: "var(--ink)",
                letterSpacing: "-0.01em",
                marginBottom: 4,
                lineHeight: 1.18,
              }}
            >
              {dailyDish?.name_en || "Boeuf Bourguignon"}
            </h2>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 9,
                color: "var(--muted)",
                marginBottom: 10,
                fontStyle: "italic",
              }}
            >
              {dailyDish?.name_zh || "勃艮第红酒炖牛肉"}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Pill type="orange">{`★ ${dailyDish?.rating ?? 4.8}`}</Pill>
              {dailyDish?.taste_profile?.slice(0, 2).map((t, i) => (
                <Pill key={i} type="green">{formatTaste(t, uiLang)}</Pill>
              )) || (<><Pill type="green">{uiLang === "en" ? "Beef" : "牛肉"}</Pill><Pill type="warm">{uiLang === "en" ? "Red wine stew" : "红酒炖煮"}</Pill></>)}
            </div>
          </div>
          <div
            className="relative flex-shrink-0 overflow-hidden"
            style={{ width: 112, height: 112, borderRadius: "var(--radius-lg)", justifySelf: "end" }}
          >
            <Image
              src={dailyDish?.image_url || fallbackDailyDishImage}
              alt={dailyDish?.name_en || "Boeuf"}
              fill
              loading="eager"
              sizes="112px"
              style={{ objectFit: "cover" }}
            />
          </div>
        </div>
      </div>

      {/* ── Camera CTA ────────────────────────────────────── */}
      <input
        ref={albumInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleAlbumFilesChange}
        className="hidden"
        aria-label={copy.albumAria}
      />

      <button
        onClick={onCapture}
        className="flex items-center justify-center gap-2.5 mx-5 my-1.5 transition-all duration-150 active:scale-[0.97] active:opacity-90"
        style={{
          padding: 16,
          background: "var(--primary)",
          color: "#FFF",
          border: "none",
          borderRadius: "var(--radius)",
          fontFamily: "var(--font-body)",
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.03em",
          cursor: "pointer",
          boxShadow: "0 4px 20px rgba(76,175,80,0.25)",
          width: "calc(100% - 40px)",
          alignSelf: "center",
        }}
      >
        <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, stroke: "#FFF", fill: "none", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }}>
          <rect x="2" y="5" width="20" height="15" rx="3" />
          <circle cx="12" cy="12.5" r="4.5" />
          <circle cx="12" cy="12.5" r="2" />
        </svg>
        {copy.captureCta}
      </button>

      <button
        onClick={handleAlbumPick}
        className="flex items-center justify-center gap-1 mx-auto py-1 transition-opacity hover:opacity-70"
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 10,
          fontWeight: 500,
          color: "var(--muted)",
          background: "none",
          border: "none",
          cursor: "pointer",
        }}
      >
        {copy.albumCta}
      </button>

      {/* ── Recent Translations ───────────────────────────── */}
      <div className="flex items-center justify-between flex-shrink-0" style={{ padding: "8px 20px 6px" }}>
        <h3
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.02em",
            color: "var(--ink)",
          }}
        >
          {copy.recentTitle}
        </h3>
        <span
          aria-hidden={isEmpty}
          onClick={() => {
            if (!isEmpty) onNavigate?.("history");
          }}
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: 9,
            fontWeight: 600,
            color: "var(--primary)",
            cursor: isEmpty ? "default" : "pointer",
            pointerEvents: isEmpty ? "none" : "auto",
            visibility: isEmpty ? "hidden" : "visible",
          }}
        >
          {copy.viewAll}
        </span>
      </div>

      {isEmpty ? (
        /* Empty state — matches v7 screen #2 */
        <div
          className="flex flex-col items-center flex-shrink-0 text-center"
          style={{ padding: "20px 20px", opacity: 0.45 }}
        >
          <div
            className="flex items-center justify-center"
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "var(--card)",
              marginBottom: 10,
            }}
          >
            <svg viewBox="0 0 24 24" style={{ width: 24, height: 24, stroke: "var(--muted)", fill: "none", strokeWidth: 1.5, strokeLinecap: "round" }}>
              <circle cx="12" cy="12" r="9" />
              <path d="M8 12h8" />
            </svg>
          </div>
          <h4 style={{ fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 600, color: "var(--muted)", marginBottom: 2 }}>
            {copy.emptyTitle}
          </h4>
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 8, color: "var(--muted)", opacity: 0.7 }}>
            {copy.emptySubtitle}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 flex-shrink-0" style={{ padding: "4px 20px 10px" }}>
          {recentItems.slice(0, 3).map((item, i) => (
            <button
              key={`${item.id || item.restaurantName}-${i}`}
              className="w-full text-left transition-all duration-150 active:scale-[0.99]"
              onClick={() => item.id && onRecentClick?.(item.id)}
              style={{
                display: "grid",
                gridTemplateColumns: i === 0 ? "54px minmax(0,1fr)" : "42px minmax(0,1fr)",
                gap: i === 0 ? 12 : 10,
                alignItems: "center",
                padding: i === 0 ? "12px 13px" : "10px 12px",
                borderRadius: i === 0 ? 24 : 20,
                border: "1px solid rgba(232,213,192,0.78)",
                background: i === 0 ? "rgba(254,230,203,0.64)" : "rgba(255,240,221,0.55)",
                boxShadow: i === 0 ? "0 6px 22px rgba(0,0,0,0.035)" : "none",
                cursor: item.id ? "pointer" : "default",
              }}
            >
              <RegionLandmarkIcon landmarkKey={item.landmarkKey} size={i === 0 ? 52 : 40} />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: i === 0 ? 13.5 : 11.5,
                    fontWeight: 800,
                    color: "var(--ink)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    lineHeight: 1.25,
                    marginBottom: 5,
                  }}
                >
                  {item.restaurantName}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <RecentPill>{item.sourceLabel} → {item.targetLabel}</RecentPill>
                  <span style={{ font: "700 8px var(--font-ui)", color: "var(--muted)" }}>
                    {item.dishCount} 道菜 · {item.timeLabel}
                  </span>
                </div>
                {i === 0 ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, minWidth: 0 }}>
                    {item.thumbnails.slice(0, 3).map((src, index) => (
                      !src || failedRecentThumbs[src] ? null : (
                        <span key={`${src}-${index}`} className="relative overflow-hidden" style={{ width: 26, height: 26, borderRadius: 9, border: "1px solid rgba(255,255,255,0.65)", flexShrink: 0, background: "rgba(255,247,235,0.72)" }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={src || fallbackRecentImage}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                            onError={() => setFailedRecentThumbs((prev) => ({ ...prev, [src]: true }))}
                          />
                        </span>
                      )
                    ))}
                    <span style={{ font: "650 8px/1.35 var(--font-ui)", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.summary}
                    </span>
                  </div>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* ── Bottom Nav ────────────────────────────────────── */}
      <nav
        className="flex justify-around items-center flex-shrink-0"
        style={{
          padding: "8px 16px 12px",
          background: "var(--bg)",
          borderTop: "1px solid var(--rule)",
        }}
      >
        {[
          {
            label: copy.navHistory,
            screen: "history",
            icon: (
              <svg viewBox="0 0 24 24" style={{ width: 20, height: 20 }}>
                <rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth="1.8" />
                <line x1="8" y1="21" x2="8" y2="9" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            ),
          },
          {
            label: copy.navFavorites,
            screen: "favorites",
            icon: (
              <svg viewBox="0 0 24 24" style={{ width: 20, height: 20 }}>
                <path
                  d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ),
          },
          {
            label: copy.navOrdered,
            screen: "ordered",
            icon: (
              <svg viewBox="0 0 24 24" style={{ width: 20, height: 20 }}>
                <path d="M7 8h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M7 12h7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M5 4h14a2 2 0 0 1 2 2v13l-4-2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ),
          },
          {
            label: copy.navSettings,
            screen: "settings",
            icon: (
              <svg viewBox="0 0 24 24" style={{ width: 20, height: 20 }}>
                <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .3-1A7 7 0 0 0 8 9.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            ),
          },
        ].map(({ label, screen, icon }) => (
          <button
            key={screen}
            onClick={() => onNavigate?.(screen)}
            className="flex flex-col items-center gap-0.5 transition-all duration-150"
            style={{
              minWidth: 56,
              minHeight: 44,
              fontFamily: "var(--font-body)",
              fontSize: 8,
              fontWeight: 500,
              color: "var(--muted)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "5px 8px",
            }}
          >
            {icon}
            {label}
            <div
              style={{
                width: 4,
                height: 4,
                borderRadius: "50%",
                background: "var(--primary)",
                opacity: 0,
              }}
            />
          </button>
        ))}
      </nav>

    </div>
  );
}

// ── Pill ──────────────────────────────────────────────────────────────

function Pill({ type, children }: { type: "green" | "orange" | "warm"; children: string }) {
  const bgMap = {
    green: "rgba(76,175,80,0.12)",
    orange: "rgba(255,159,28,0.12)",
    warm: "rgba(45,45,45,0.06)",
  };
  const colorMap = {
    green: "var(--primary)",
    orange: "var(--accent)",
    warm: "var(--muted)",
  };
  return (
    <span
      className="inline-flex items-center gap-0.5"
      style={{
        fontFamily: "var(--font-ui)",
        fontSize: "7.5px",
        fontWeight: 600,
        padding: "3px 9px",
        borderRadius: 20,
        letterSpacing: "0.03em",
        background: bgMap[type],
        color: colorMap[type],
      }}
    >
      {children}
    </span>
  );
}

function RecentPill({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 18,
        padding: "0 7px",
        borderRadius: 999,
        background: "rgba(76,175,80,0.10)",
        color: "var(--primary)",
        fontFamily: "var(--font-ui)",
        fontSize: 7,
        fontWeight: 800,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function RestaurantIcon() {
  return (
    <span
      className="inline-flex items-center justify-center"
      aria-hidden="true"
      style={{
        width: 18,
        height: 18,
        flex: "0 0 18px",
        borderRadius: 7,
        background: "rgba(255,159,28,0.10)",
        color: "var(--accent)",
      }}
    >
      <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" }}>
        <path d="M5 11.5h14l-1 7H6l-1-7Z" />
        <path d="M7 11.5V8.8C7 6.7 9.2 5 12 5s5 1.7 5 3.8v2.7" />
        <path d="M9 15h.1M12 15h.1M15 15h.1" />
        <path d="M4 19h16" />
      </svg>
    </span>
  );
}

function formatCuisine(cuisine: string | undefined, uiLang: "zh" | "en"): string {
  if (!cuisine) return "";
  if (uiLang === "en") return CUISINE_LABELS_EN[cuisine] || titleCase(cuisine);
  return CUISINE_LABELS[cuisine] || cuisine;
}

function formatCategory(category: string | undefined, uiLang: "zh" | "en"): string {
  if (!category) return "";
  if (uiLang === "en") return CATEGORY_LABELS_EN[category] || titleCase(category);
  return CATEGORY_LABELS_ZH[category] || category;
}

function formatTaste(taste: string, uiLang: "zh" | "en"): string {
  if (uiLang === "en") return TASTE_LABELS_EN[taste] || titleCase(taste);
  return taste;
}

function titleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
