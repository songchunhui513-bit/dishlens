"use client";

import Image from "next/image";

interface RecentItem {
  id: string;
  zh: string;
  en: string;
  img: string;
}

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
  onDailyDishDetail?: () => void;
  onRecentClick?: (id: string) => void;
  recentHistory?: RecentItem[];
  dailyDish?: DailyDishData;
  recommendationContext?: string;
  recommendationReason?: string;
}

const defaultRecent: RecentItem[] = [
  { id: "", zh: "马赛鱼汤", en: "Bouillabaisse", img: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=120&h=120&fit=crop&auto=format" },
  { id: "", zh: "油封鸭腿", en: "Confit de Canard", img: "https://images.unsplash.com/photo-1544025162-d76694265947?w=120&h=120&fit=crop&auto=format" },
  { id: "", zh: "焦糖苹果挞", en: "Tarte Tatin", img: "https://images.unsplash.com/photo-1616953882462-8a583e0afbb4?w=120&h=120&fit=crop&auto=format" },
];
const fallbackRecentImage = "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=120&h=120&fit=crop&auto=format";

const CUISINE_LABELS: Record<string, string> = {
  french: "法式料理", japanese: "日式料理", italian: "意式料理", chinese: "中式料理",
  korean: "韩式料理", thai: "泰式料理", mexican: "墨西哥料理", spanish: "西班牙料理",
  indian: "印度料理", turkish: "土耳其料理", vietnamese: "越南料理", american: "美式料理",
};

export default function HomePage({
  onNavigate,
  onCapture,
  onDailyDishDetail,
  onRecentClick,
  recentHistory,
  dailyDish,
  recommendationContext,
  recommendationReason,
}: HomePageProps) {
  const recentItems = recentHistory && recentHistory.length > 0 ? recentHistory : defaultRecent;
  const hasHistory = recentHistory !== undefined && recentHistory.length >= 0;
  const isEmpty = hasHistory && recentHistory!.length === 0;

  const handleAlbumPick = () => {
    onCapture?.();
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
        {recommendationContext || "按当前时段推荐"}
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
        <strong style={{ fontWeight: 700 }}>今日推荐理由：</strong>
        {recommendationReason || dailyDish?.description_zh || "根据当前时间，从本地知识库为你挑选一道适合现在点的菜。"}
      </div>

      {/* ── Hero Carousel ─────────────────────────────────── */}
      <div style={{ padding: "0 20px 10px" }}>
        <div
          className="relative overflow-hidden"
          onClick={onDailyDishDetail}
          style={{
            background: "var(--card)",
            borderRadius: "var(--radius-xl)",
            padding: 16,
            boxShadow: "var(--shadow-lg)",
            display: "flex",
            alignItems: "center",
            gap: 16,
            animation: "fadeSlideUp 0.4s ease-out",
            cursor: onDailyDishDetail ? "pointer" : "default",
          }}
        >
          <div
            className="absolute z-[1]"
            style={{
              top: 10,
              left: 12,
              fontFamily: "var(--font-ui)",
              fontSize: 7,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#FFF",
              background: "var(--accent)",
              padding: "3px 10px",
              borderRadius: 12,
              animation: "gentleGlow 3s infinite",
            }}
          >
            今日推荐
          </div>
          <div style={{ flex: 1, paddingTop: 18 }}>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 8,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--primary)",
                marginBottom: 4,
              }}
            >
                {CUISINE_LABELS[dailyDish?.cuisine || "french"] || dailyDish?.cuisine || "法式料理"} · {dailyDish?.category || "主菜"}
            </div>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 18,
                fontWeight: 800,
                color: "var(--ink)",
                letterSpacing: "-0.01em",
                marginBottom: 4,
                lineHeight: 1.2,
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
                <Pill key={i} type="green">{t}</Pill>
              )) || (<><Pill type="green">牛肉</Pill><Pill type="warm">红酒炖煮</Pill></>)}
            </div>
          </div>
          <div
            className="relative flex-shrink-0 overflow-hidden"
            style={{ width: 100, height: 100, borderRadius: "var(--radius-lg)" }}
          >
            <Image
              src={dailyDish?.image_url || "https://images.unsplash.com/photo-1667396702543-a239efa7a7f2?w=200&h=200&fit=crop&auto=format"}
              alt={dailyDish?.name_en || "Boeuf"}
              fill
              loading="eager"
              sizes="100px"
              style={{ objectFit: "cover" }}
            />
          </div>
        </div>
      </div>

      {/* ── Camera CTA ────────────────────────────────────── */}
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
        拍摄菜单 · 开始翻译
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
        ↑ 从相册选择
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
          最近翻译
        </h3>
        {!isEmpty && (
          <span
            onClick={() => onNavigate?.("history")}
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 9,
              fontWeight: 600,
              color: "var(--primary)",
              cursor: "pointer",
            }}
          >
            查看全部 →
          </span>
        )}
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
            还没有翻译记录
          </h4>
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 8, color: "var(--muted)", opacity: 0.7 }}>
            拍下第一张菜单，开启你的美食之旅
          </p>
        </div>
      ) : (
        <div
          className="flex gap-2.5 overflow-x-auto flex-shrink-0"
          style={{ padding: "4px 20px 10px", scrollbarWidth: "none" }}
        >
          {recentItems.map((item, i) => (
            <div
              key={i}
              className="flex-shrink-0 flex flex-col items-center gap-1.5 cursor-pointer transition-all duration-200"
              style={{
                width: 88,
                textAlign: "center",
                animation: "popIn 0.3s ease-out",
              }}
              onClick={() => onRecentClick?.(item.id)}
            >
              <div
                className="relative overflow-hidden"
                style={{ width: 68, height: 68, borderRadius: "var(--radius)" }}
              >
                <Image
                  src={item.img || fallbackRecentImage}
                  alt={item.zh}
                  fill
                  loading={i === 0 ? "eager" : "lazy"}
                  sizes="60px"
                  style={{ objectFit: "cover" }}
                />
              </div>
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 9,
                  fontWeight: 600,
                  color: "var(--ink)",
                  letterSpacing: "0.02em",
                  lineHeight: 1.3,
                }}
              >
                {item.zh}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: 7,
                  fontWeight: 500,
                  color: "var(--muted)",
                }}
              >
                {item.en}
              </span>
            </div>
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
            label: "历史",
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
            label: "收藏",
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
            label: "设置",
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
              fontFamily: "var(--font-body)",
              fontSize: 8,
              fontWeight: 500,
              color: "var(--muted)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "2px 8px",
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
