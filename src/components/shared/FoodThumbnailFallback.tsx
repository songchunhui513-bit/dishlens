interface FoodThumbnailFallbackProps {
  label: string;
  size?: number;
  compact?: boolean;
}

export default function FoodThumbnailFallback({ label, size = 56, compact = false }: FoodThumbnailFallbackProps) {
  const strokeWidth = compact ? 2.2 : 2;
  return (
    <span
      aria-label={label}
      role="img"
      style={{
        display: "inline-grid",
        placeItems: "center",
        width: size,
        height: size,
        borderRadius: compact ? 9 : "var(--radius-sm)",
        background: "linear-gradient(180deg, rgba(255,250,242,0.96), rgba(254,230,203,0.78))",
        border: "1px solid rgba(232,213,192,0.78)",
        boxShadow: compact ? "inset 0 1px 0 rgba(255,255,255,0.72)" : "0 6px 16px rgba(89,58,28,0.08)",
        color: "var(--muted)",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <svg
        viewBox="0 0 64 64"
        aria-hidden="true"
        style={{
          width: Math.round(size * 0.68),
          height: Math.round(size * 0.68),
          display: "block",
        }}
      >
        <ellipse cx="32" cy="44" rx="20" ry="7" fill="none" stroke="rgba(211,165,111,0.82)" strokeWidth={strokeWidth} />
        <path d="M20 37c2-10 8-15 15-15 6 0 11 4 12 12" fill="none" stroke="rgba(211,165,111,0.82)" strokeWidth={strokeWidth} strokeLinecap="round" />
        <path d="M24 34c5 3 12 3 18 0" fill="none" stroke="rgba(120,170,103,0.82)" strokeWidth={strokeWidth} strokeLinecap="round" />
        <circle cx="44" cy="20" r="4" fill="rgba(255,159,28,0.88)" />
        <path d="M47 15c1-3 3-5 6-6" fill="none" stroke="rgba(76,175,80,0.78)" strokeWidth={strokeWidth} strokeLinecap="round" />
      </svg>
    </span>
  );
}
