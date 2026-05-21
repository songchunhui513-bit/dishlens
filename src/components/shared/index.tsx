// Shared editorial design components — v7 Warm Editorial

import { type FC, type ReactNode } from "react";

// ── Rule (Editorial Divider) ──────────────────────────────────────

export const Rule: FC<{ className?: string }> = ({ className = "" }) => (
  <hr className={`border-0 h-px my-4 ${className}`} style={{ background: "var(--rule)" }} />
);

// ── StarRating (Read-only Display) ─────────────────────────────────

export const StarDisplay: FC<{
  rating: number;
  count?: number;
  size?: "sm" | "md";
}> = ({ rating, count, size = "sm" }) => {
  const full = Math.round(rating);
  const sizeClass = size === "md" ? "text-sm" : "text-[11px]";
  return (
    <span
      className={`font-semibold tracking-wide ${sizeClass}`}
      style={{ fontFamily: "var(--font-body)", color: "var(--accent)" }}
    >
      {"★".repeat(full)}
      {"☆".repeat(5 - full)}{" "}
      <span style={{ color: "var(--ink)" }}>{rating}</span>
      {count != null && (
        <span style={{ color: "var(--muted)", fontWeight: 400 }}> ({count})</span>
      )}
    </span>
  );
};

// ── StarPicker (Interactive Rating) ────────────────────────────────

export const StarPicker: FC<{
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map((n) => (
      <button
        key={n}
        type="button"
        disabled={disabled}
        onClick={() => onChange(n)}
        className="text-2xl transition-transform duration-150 p-0.5"
        style={{
          color: n <= value ? "var(--accent)" : "var(--rule)",
          fontFamily: "var(--font-body)",
          cursor: disabled ? "default" : "pointer",
          transform: n === value ? "scale(1.15)" : "scale(1)",
        }}
      >
        {n <= value ? "★" : "☆"}
      </button>
    ))}
  </div>
);

// ── AllergenTag ────────────────────────────────────────────────────

export const AllergenTag: FC<{ label: string }> = ({ label }) => (
  <span
    className="inline-block font-medium"
    style={{
      fontFamily: "var(--font-ui)",
      fontSize: 7.5,
      fontWeight: 600,
      color: "var(--accent)",
      background: "var(--allergen-bg)",
      padding: "3px 9px",
      borderRadius: 20,
    }}
  >
    ⚠ {label}
  </span>
);

// ── VegTag ─────────────────────────────────────────────────────────

export const VegTag: FC = () => (
  <span
    className="inline-block font-medium"
    style={{
      fontFamily: "var(--font-ui)",
      fontSize: 7.5,
      fontWeight: 600,
      color: "var(--primary)",
      background: "var(--veg-bg)",
      padding: "3px 9px",
      borderRadius: 20,
    }}
  >
    素食友好
  </span>
);

// ── Button ─────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary";

export const Button: FC<{
  children: ReactNode;
  variant?: ButtonVariant;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}> = ({ children, variant = "primary", onClick, disabled, loading, className = "" }) => {
  const base =
    variant === "primary"
      ? { background: "var(--primary)", color: "#FFF", fontFamily: "var(--font-body)" }
      : {
          background: "transparent",
          color: "var(--ink)",
          border: "1px solid var(--ink)",
          fontFamily: "var(--font-body)",
        };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`w-full text-center font-semibold tracking-wider transition-all duration-150 active:scale-[0.97] active:opacity-90 disabled:opacity-40 ${className}`}
      style={{
        ...base,
        padding: "12px 0",
        fontSize: 14,
        letterSpacing: "0.06em",
        borderRadius: "var(--radius)",
        boxShadow: variant === "primary" ? "0 4px 20px rgba(76,175,80,0.25)" : "none",
      }}
    >
      {loading ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        children
      )}
    </button>
  );
};

// ── Toast ──────────────────────────────────────────────────────────

export const Toast: FC<{ message: string; visible: boolean }> = ({ message, visible }) => (
  <div
    className="fixed top-0 left-0 right-0 z-50 flex justify-center transition-all duration-250 pointer-events-none"
    style={{
      transform: visible ? "translateY(60px)" : "translateY(-60px)",
      opacity: visible ? 1 : 0,
    }}
  >
    <div
      className="px-6 py-3 text-sm font-medium shadow-lg"
      style={{
        background: "var(--ink)",
        color: "#FFF",
        fontFamily: "var(--font-body)",
        borderRadius: 8,
      }}
    >
      {message}
    </div>
  </div>
);

// ── Skeleton ───────────────────────────────────────────────────────

export const Skeleton: FC<{ width?: string; height?: string; className?: string }> = ({
  width = "100%",
  height = "14px",
  className = "",
}) => (
  <div
    className={`skeleton-shimmer ${className}`}
    style={{ width, height, borderRadius: "var(--radius-sm)" }}
  />
);

export const DishCardSkeleton: FC = () => (
  <div className="flex gap-3 p-3.5" style={{ background: "var(--card)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow)" }}>
    <Skeleton width="68px" height="68px" />
    <div className="flex-1 flex flex-col gap-1.5">
      <Skeleton width="55%" height="10px" />
      <Skeleton width="75%" height="14px" />
      <Skeleton width="38%" height="10px" />
    </div>
  </div>
);

// ── EmptyState ─────────────────────────────────────────────────────

export const EmptyState: FC<{
  title: string;
  description: string;
  cta?: string;
  onCta?: () => void;
  icon?: ReactNode;
}> = ({ title, description, cta, onCta, icon }) => (
  <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
    {icon ? (
      <div className="mb-4 opacity-50">{icon}</div>
    ) : (
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
        style={{ background: "var(--card)", color: "var(--muted)", fontSize: 20 }}
      >
        —
      </div>
    )}
    <h3
      className="text-[15px] font-bold mb-2"
      style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}
    >
      {title}
    </h3>
    <p
      className="text-xs mb-6 leading-relaxed max-w-[240px]"
      style={{ fontFamily: "var(--font-body)", color: "var(--muted)" }}
    >
      {description}
    </p>
    {cta && onCta && <Button variant="primary" onClick={onCta}>{cta}</Button>}
  </div>
);

// ── ErrorState ─────────────────────────────────────────────────────

export const ErrorState: FC<{
  title: string;
  description: string;
  cta?: string;
  secondaryCta?: string;
  onCta?: () => void;
  onSecondary?: () => void;
}> = ({ title, description, cta, secondaryCta, onCta, onSecondary }) => (
  <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
    <div
      className="w-12 h-12 rounded-full flex items-center justify-center mb-4 text-xl"
      style={{ background: "var(--allergen-bg)", color: "var(--accent)" }}
    >
      !
    </div>
    <h3
      className="text-[15px] font-bold mb-2"
      style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}
    >
      {title}
    </h3>
    <p
      className="text-xs mb-6 leading-relaxed max-w-[240px]"
      style={{ fontFamily: "var(--font-body)", color: "var(--muted)" }}
    >
      {description}
    </p>
    <div className="flex flex-col gap-2 w-full max-w-[280px]">
      {cta && onCta && <Button variant="primary" onClick={onCta}>{cta}</Button>}
      {secondaryCta && onSecondary && (
        <button
          onClick={onSecondary}
          className="text-xs font-medium tracking-wide"
          style={{ color: "var(--primary)", fontFamily: "var(--font-body)" }}
        >
          {secondaryCta}
        </button>
      )}
    </div>
  </div>
);

// ── Modal ──────────────────────────────────────────────────────────

export const Modal: FC<{
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}> = ({ open, onClose, children }) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-400"
      style={{ background: "var(--overlay)" }}
      onClick={onClose}
    >
      <div
        className="relative mx-6 p-6 max-w-sm w-full shadow-lg"
        style={{ background: "var(--bg)", borderRadius: "var(--radius-xl)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-lg leading-none w-7 h-7 flex items-center justify-center rounded-full"
          style={{
            fontFamily: "var(--font-body)",
            color: "var(--muted)",
            border: "1px solid var(--rule)",
          }}
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
};
