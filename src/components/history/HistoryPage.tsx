"use client";

// ── Mock data matching v7 prototype ──────────────────────────────────

const cuisineImages: Record<string, string> = {
  french: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=80&h=80&fit=crop&auto=format",
  sushi: "https://images.unsplash.com/photo-1553621042-f6e147245754?w=80&h=80&fit=crop&auto=format",
  pasta: "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=80&h=80&fit=crop&auto=format",
  paella: "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=80&h=80&fit=crop&auto=format",
};

const mockHistory = [
  {
    id: "1", restaurant: "Le Comptoir du Marché",
    city: "巴黎", lang: "法语", dishCount: 9, pageCount: 3,
    date: "2026-05-20", img: cuisineImages.french,
  },
  {
    id: "2", restaurant: "銀座 すきやばし 次郎",
    city: "东京", lang: "日语", dishCount: 12, pageCount: 2,
    date: "2026-05-18", img: cuisineImages.sushi,
  },
  {
    id: "3", restaurant: "Trattoria da Mario",
    city: "罗马", lang: "意大利语", dishCount: 8, pageCount: 2,
    date: "2026-04-28", img: cuisineImages.pasta,
  },
  {
    id: "4", restaurant: "Casa Paco",
    city: "巴塞罗那", lang: "西班牙语", dishCount: 6, pageCount: 1,
    date: "2026-04-15", img: cuisineImages.paella,
  },
];

function groupByMonth(items: typeof mockHistory) {
  const months: Record<string, typeof mockHistory> = {};
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
}

export default function HistoryPage({ onBack, onSelect, loading }: HistoryPageProps) {
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

  const groups = groupByMonth(mockHistory);

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
          历史记录
        </h2>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto" style={{ padding: "10px 16px" }}>
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
                fontSize: 10,
                fontWeight: 700,
                color: "var(--ink)",
                marginBottom: 8,
                paddingBottom: 4,
                borderBottom: "1px solid var(--rule)",
              }}
            >
              {group.label}
            </div>
            {group.items.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelect?.(item.id)}
                className="flex items-center gap-3 w-full text-left py-3 transition-all duration-150 hover:pl-1 active:opacity-50"
                style={{
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
                  className="flex-shrink-0 flex items-center justify-center overflow-hidden"
                  style={{ width: 40, height: 40, borderRadius: "var(--radius-sm)", background: "var(--card)" }}
                >
                  <img src={item.img} alt={item.restaurant} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>
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
      </div>
    </div>
  );
}
