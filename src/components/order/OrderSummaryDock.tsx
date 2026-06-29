"use client";

import OrderQuantityControl from "@/components/order/OrderQuantityControl";

interface OrderSummaryDockProps {
  currentQuantity: number;
  totalQuantity: number;
  totalLabel: string;
  onCurrentQuantityChange: (nextQuantity: number) => void;
  onOpenConfirm: () => void;
}

export default function OrderSummaryDock({
  currentQuantity,
  totalQuantity,
  totalLabel,
  onCurrentQuantityChange,
  onOpenConfirm,
}: OrderSummaryDockProps) {
  return (
    <div
      style={{
        position: "absolute",
        right: 18,
        bottom: "calc(18px + env(safe-area-inset-bottom))",
        zIndex: 8,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 8,
        maxWidth: "calc(100% - 36px)",
      }}
    >
      <div
        aria-label="当前菜品数量"
        className="inline-flex items-center gap-2"
        style={{
          minHeight: 44,
          padding: "0 5px",
          borderRadius: 999,
          border: "1px solid var(--rule)",
          background: "rgba(255,250,242,0.96)",
          boxShadow: "0 10px 24px rgba(97,64,28,0.08)",
          color: "var(--ink-muted)",
          fontFamily: "var(--font-body)",
          fontSize: 10,
          fontWeight: 800,
        }}
      >
        <OrderQuantityControl quantity={currentQuantity} onChange={onCurrentQuantityChange} compact expanded />
      </div>

      {totalQuantity > 0 ? (
        <button
          type="button"
          aria-label="查看点单"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onOpenConfirm();
          }}
          className="inline-flex items-center gap-2 transition-all duration-150 active:scale-[0.97]"
          style={{
            minHeight: 44,
            padding: "7px 12px 7px 8px",
            borderRadius: 999,
            border: "1px solid var(--rule)",
            background: "rgba(255,250,242,0.96)",
            boxShadow: "0 10px 24px rgba(97,64,28,0.10)",
            color: "var(--ink-soft)",
            fontFamily: "var(--font-body)",
            fontSize: 10,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          <span
            style={{
              display: "grid",
              placeItems: "center",
              width: 24,
              height: 24,
              flex: "0 0 24px",
              borderRadius: 10,
              background: "rgba(76,175,80,0.08)",
              color: "var(--primary)",
              fontFamily: "var(--font-ui)",
              fontSize: 10,
              fontWeight: 900,
              lineHeight: 1,
            }}
          >
            {totalQuantity}
          </span>
          <span style={{ whiteSpace: "nowrap" }}>{`已选 · ${totalLabel}`}</span>
        </button>
      ) : null}
    </div>
  );
}
