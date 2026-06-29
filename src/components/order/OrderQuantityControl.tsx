"use client";

import type { MouseEvent } from "react";

interface OrderQuantityControlProps {
  quantity?: number;
  onChange: (nextQuantity: number) => void;
  compact?: boolean;
  expanded?: boolean;
}

export default function OrderQuantityControl({ quantity = 0, onChange, compact, expanded }: OrderQuantityControlProps) {
  const selected = quantity > 0;
  const addSize = compact ? 44 : 46;
  const stepSize = compact ? 38 : 40;

  const stop = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  if (!selected) {
    return (
      <button
        type="button"
        aria-label="加入点单"
        onClick={(event) => {
          stop(event);
          onChange(1);
        }}
        className="inline-flex items-center justify-center transition-all duration-150 active:scale-95"
        style={{
          minWidth: addSize,
          minHeight: addSize,
          width: addSize,
          height: addSize,
          borderRadius: 999,
          border: "1px solid rgba(76,175,80,0.22)",
          background: "rgba(76,175,80,0.08)",
          color: "var(--primary)",
          fontFamily: "var(--font-ui)",
          fontSize: compact ? 14 : 18,
          fontWeight: 900,
          cursor: "pointer",
        }}
      >
        ＋
      </button>
    );
  }

  return (
    <div
      className="group inline-flex items-center justify-center"
      onClick={stop}
      style={{
        minWidth: expanded ? 104 : compact ? 106 : 112,
        minHeight: 44,
        height: 44,
        borderRadius: 999,
        border: "1px solid rgba(76,175,80,0.22)",
        background: "rgba(76,175,80,0.08)",
        color: "var(--primary)",
        fontFamily: "var(--font-body)",
        fontSize: expanded ? 11 : 10,
        fontWeight: 700,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        aria-label="减少数量"
        onClick={(event) => {
          stop(event);
          onChange(Math.max(0, quantity - 1));
        }}
        className="inline-flex items-center justify-center transition-colors duration-150 active:scale-95"
        style={{ width: stepSize, minWidth: stepSize, height: "100%", border: "none", background: "transparent", color: "var(--primary)", cursor: "pointer", fontSize: 15, fontWeight: 900 }}
      >
        -
      </button>
      <span style={{ minWidth: 24, textAlign: "center", padding: compact ? "0 4px" : "0 6px" }}>{compact ? quantity : `已选 ${quantity}`}</span>
      <button
        type="button"
        aria-label="增加数量"
        onClick={(event) => {
          stop(event);
          onChange(quantity + 1);
        }}
        className="inline-flex items-center justify-center transition-colors duration-150 active:scale-95"
        style={{ width: stepSize, minWidth: stepSize, height: "100%", border: "none", background: "transparent", color: "var(--primary)", cursor: "pointer", fontSize: 15, fontWeight: 900 }}
      >
        +
      </button>
    </div>
  );
}
