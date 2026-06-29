"use client";

import type { CategoryDef, CategoryKey } from "@/lib/results-categories";

interface Props {
  categories: CategoryDef[];
  selected: CategoryKey;
  onSelect: (key: CategoryKey) => void;
}

const WIDE_LABELS = new Set<string>(["本店必点", "女生喜欢"]);

export default function CategoryTabs({ categories, selected, onSelect }: Props) {
  const shouldFillWidth = categories.length <= 6;
  return (
    <div
      style={{
        display: "flex",
        gap: 0,
        margin: "10px 16px",
        borderRadius: "var(--radius)",
        overflowX: "auto",
        overflowY: "hidden",
        border: "1px solid var(--rule)",
        scrollbarWidth: "none",
        width: "calc(100% - 32px)",
      }}
    >
      {categories.map((cat, idx) => {
        const isActive = cat.key === selected;
        const isLast = idx === categories.length - 1;
        const isWide = cat.key === "all" || WIDE_LABELS.has(cat.label);
        const minWidth = shouldFillWidth ? 0 : cat.key === "all" ? 64 : WIDE_LABELS.has(cat.label) ? 68 : 60;
        return (
          <button
            key={cat.key}
            type="button"
            onClick={() => onSelect(cat.key)}
            style={{
              flex: shouldFillWidth ? "1 1 0" : "0 0 auto",
              flexShrink: shouldFillWidth ? 1 : 0,
              minWidth,
              textAlign: "center",
              padding: isWide ? "10px 8px" : "10px 6px",
              background: isActive ? "var(--veg-bg)" : "transparent",
              border: "none",
              borderRight: isLast ? "none" : "1px solid var(--rule)",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
            }}
          >
            <span
              style={{
                font: `${isActive ? "800" : "700"} 8px var(--font-ui)`,
                color: isActive ? "var(--primary)" : "var(--muted)",
                whiteSpace: "nowrap",
              }}
            >
              {cat.label}
            </span>
            <span
              style={{
                font: "700 7px var(--font-ui)",
                color: isActive ? "var(--primary)" : "var(--muted)",
                opacity: isActive ? 0.8 : 0.7,
              }}
            >
              {cat.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
