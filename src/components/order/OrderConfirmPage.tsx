"use client";

import { useState } from "react";
import type { OrderedDishItem, OrderNote, TranslationResult } from "@/types";
import { formatOrderPrice, summarizeOrder } from "@/lib/order-state";
import DishImageWithLoading from "@/components/shared/DishImageWithLoading";

interface OrderConfirmPageProps {
  items: OrderedDishItem[];
  sourceLang?: string;
  result?: TranslationResult | null;
  notes: OrderNote[];
  selectedNoteIds: string[];
  onToggleNote: (noteId: string) => void;
  onBack: () => void;
  onSave: () => void;
  onBackToResults?: () => void;
}

const GREETINGS: Record<string, { phrase: string; zh: string }> = {
  fr: { phrase: "Bonjour, je voudrais commander ceci, s'il vous plaît.", zh: "你好，我想点下面这些。" },
  it: { phrase: "Buongiorno, vorrei ordinare questo, per favore.", zh: "你好，我想点下面这些。" },
  ja: { phrase: "すみません、これをお願いします。", zh: "你好，我想点下面这些。" },
  es: { phrase: "Hola, quisiera pedir esto, por favor.", zh: "你好，我想点下面这些。" },
  de: { phrase: "Hallo, ich würde gerne dies bestellen, bitte.", zh: "你好，我想点下面这些。" },
  th: { phrase: "สวัสดีครับ/ค่ะ ขอสั่งเมนูนี้หน่อยครับ/ค่ะ", zh: "你好，我想点下面这些。" },
  ko: { phrase: "안녕하세요, 이것을 주문하려고 합니다.", zh: "你好，我想点下面这些。" },
  pt: { phrase: "Olá, gostaria de pedir isto, por favor.", zh: "你好，我想点下面这些。" },
  vi: { phrase: "Xin chào, tôi muốn gọi món này.", zh: "你好，我想点下面这些。" },
  en: { phrase: "Hello, I would like to order these, please.", zh: "你好，我想点下面这些。" },
};

function findDishIndex(items: OrderedDishItem[], dishId: string, result?: TranslationResult | null): number | null {
  if (!result?.pages) return null;
  let index = 0;
  for (const page of result.pages) {
    for (const dish of page.dishes || []) {
      index++;
      if (dish.id === dishId || dish.name_original === items.find((i) => i.dish_id === dishId)?.dish.name_original) {
        return index;
      }
    }
  }
  return null;
}

export default function OrderConfirmPage({ items, sourceLang, result, notes, selectedNoteIds, onToggleNote, onBack, onSave, onBackToResults }: OrderConfirmPageProps) {
  const summary = summarizeOrder(items);
  const selectedNotes = notes.filter((note) => selectedNoteIds.includes(note.id));
  const greeting = GREETINGS[sourceLang || ""] || GREETINGS["en"];
  const [previewDish, setPreviewDish] = useState<OrderedDishItem["dish"] | null>(null);

  return (
    <div className="h-full flex flex-col" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <div className="flex items-center gap-2 flex-shrink-0" style={{ padding: "10px 16px", borderBottom: "1px solid var(--rule)", background: "rgba(255,245,233,0.96)" }}>
        <button
          onClick={onBack}
          className="w-[30px] h-[30px] inline-flex items-center justify-start border-0 rounded-full bg-transparent text-[var(--ink)] flex-shrink-0 cursor-pointer transition-opacity hover:opacity-50"
          style={{ fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 900 }}
        >
          ←
        </button>
        <span className="flex-1 min-w-0 overflow-hidden whitespace-nowrap text-ellipsis" style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 900, color: "var(--ink)" }}>
          给店员核对
        </span>
        {sourceLang ? (
          <span
            className="inline-flex items-center h-[27px] px-[10px] rounded-full"
            style={{ background: "rgba(76,175,80,0.08)", color: "var(--primary)", fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 900 }}
          >
            {sourceLang.toUpperCase()} → 中文
          </span>
        ) : null}
      </div>

      <div className="flex-1 overflow-auto" style={{ padding: "8px 16px 96px" }}>
        {/* Card 1: Greeting + phrase */}
        <div
          style={{
            padding: 14,
            marginBottom: 10,
            borderRadius: 20,
            background: "rgba(255,240,221,0.48)",
            border: "1px solid rgba(232,213,192,0.58)",
            boxShadow: "0 1px 8px rgba(45,45,45,0.025)",
          }}
        >
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 800, color: "var(--ink)", margin: "0 0 6px", lineHeight: 1.1 }}>
            给店员核对
          </h2>
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", margin: "0 0 12px", lineHeight: 1.62 }}>
            把这一页给店员看。菜名使用菜单原文；若价格未识别，请以店内菜单为准。
          </p>
          <div
            style={{
              padding: "11px 12px",
              borderRadius: 16,
              background: "rgba(255,245,233,0.72)",
              border: "1px solid rgba(232,213,192,0.58)",
              fontFamily: "var(--font-ui)",
              fontSize: 14,
              fontWeight: 700,
              color: "var(--ink)",
              lineHeight: 1.45,
            }}
          >
            {greeting.phrase}
            <span style={{ display: "block", marginTop: 5, color: "var(--muted)", fontSize: 12, fontWeight: 700 }}>
              {greeting.zh}
            </span>
          </div>
        </div>

        {/* Card 2: Order lines */}
        <div
          style={{
            padding: "11px 14px",
            marginBottom: 10,
            borderRadius: 20,
            background: "rgba(255,240,221,0.48)",
            border: "1px solid rgba(232,213,192,0.58)",
            boxShadow: "0 1px 8px rgba(45,45,45,0.025)",
          }}
        >
          {items.map((item, idx) => {
            const menuIdx = findDishIndex(items, item.dish_id, result);
            return (
              <div
                key={item.dish_id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "56px minmax(0, 1fr) 46px auto",
                  gap: 10,
                  alignItems: "center",
                  padding: "11px 0",
                  borderBottom: idx < items.length - 1 ? "1px solid rgba(232,213,192,0.76)" : "none",
                }}
              >
                <button
                  type="button"
                  className="order-confirm-thumb"
                  aria-label={`查看 ${item.dish.name_translated?.zh || item.dish.name_original} 大图`}
                  onClick={() => setPreviewDish(item.dish)}
                  style={{
                    position: "relative",
                    width: 56,
                    height: 56,
                    borderRadius: 16,
                    overflow: "hidden",
                    border: "1px solid rgba(232,213,192,0.68)",
                    background: "rgba(255,245,233,0.68)",
                    padding: 0,
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      transform: "scale(0.59)",
                      transformOrigin: "top left",
                    }}
                  >
                    <DishImageWithLoading dish={item.dish} size="card" alt={item.dish.name_translated?.zh || item.dish.name_original} />
                  </div>
                </button>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ display: "block", fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 800, color: "var(--ink)", lineHeight: 1.25 }}>
                    {item.dish.name_original}
                  </strong>
                  <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 700, color: "var(--muted)", lineHeight: 1.35 }}>
                    {item.dish.name_translated?.zh || item.dish.name_original}
                    {menuIdx ? ` · 原菜单第 ${String(menuIdx).padStart(2, "0")} 项` : ""}
                  </span>
                </div>
                <div
                  style={{
                    justifySelf: "end",
                    fontFamily: "var(--font-ui)",
                    fontSize: 13,
                    fontWeight: 900,
                    color: "var(--muted)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.quantity}份
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-ui)",
                    fontSize: 14,
                    fontWeight: 900,
                    color: item.unitPrice ? "var(--ink)" : "var(--muted)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.unitPrice
                    ? `${item.unitPrice.amount * item.quantity}${item.unitPrice.currency}`
                    : "价格未识别"}
                </div>
              </div>
            );
          })}
          <div
            style={{
              marginTop: 11,
              padding: "10px 11px",
              borderRadius: 15,
              background: "rgba(255,245,233,0.68)",
              border: "1px solid rgba(232,213,192,0.42)",
              fontFamily: "var(--font-ui)",
              fontSize: 12,
              fontWeight: 700,
              color: "var(--ink-soft)",
              lineHeight: 1.52,
            }}
          >
            合计参考：{formatOrderPrice(summary)}。实际金额请以餐厅菜单或店员确认为准。
          </div>
        </div>

        {/* Card 3: Notes + actions */}
        <div
          style={{
            padding: 14,
            marginBottom: 10,
            borderRadius: 20,
            background: "rgba(255,240,221,0.48)",
            border: "1px solid rgba(232,213,192,0.58)",
            boxShadow: "0 1px 8px rgba(45,45,45,0.025)",
          }}
        >
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 800, color: "var(--ink)", margin: "0 0 6px" }}>
            备注
          </h2>
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", margin: "0 0 11px", lineHeight: 1.62 }}>
            选择后自动翻译给店员，可多选。
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {notes.map((note) => {
              const active = selectedNoteIds.includes(note.id);
              return (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => onToggleNote(note.id)}
                  style={{
                    height: 36,
                    padding: "0 12px",
                    borderRadius: 999,
                    border: active ? "1px solid rgba(76,175,80,0.22)" : "1px solid rgba(232,213,192,0.7)",
                    background: active ? "rgba(76,175,80,0.08)" : "rgba(255,245,233,0.58)",
                    color: active ? "var(--primary)" : "var(--ink-soft)",
                    fontFamily: "var(--font-ui)",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {note.zh}
                </button>
              );
            })}
          </div>
          {selectedNotes.length > 0 ? (
            <div
              style={{
                marginTop: 11,
                padding: "10px 11px",
                borderRadius: 15,
                background: "rgba(255,245,233,0.68)",
                border: "1px solid rgba(232,213,192,0.42)",
                fontFamily: "var(--font-ui)",
                fontSize: 12,
                fontWeight: 700,
                color: "var(--ink-soft)",
                lineHeight: 1.52,
              }}
            >
              <div style={{ display: "grid", gap: 7 }}>
                {selectedNotes.map((note) => (
                  <div
                    key={note.id}
                    style={{
                      paddingBottom: 7,
                      borderBottom: "1px solid rgba(232,213,192,0.5)",
                    }}
                  >
                    <span style={{ display: "block", color: "var(--ink-soft)", fontWeight: 800, lineHeight: 1.45 }}>
                      {note.original}
                    </span>
                    <span style={{ display: "block", marginTop: 2, color: "var(--muted)", fontSize: 12, fontWeight: 700, lineHeight: 1.45 }}>
                      {note.zh}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <button
            type="button"
            onClick={onSave}
            disabled={items.length === 0}
            className="w-full transition-all duration-150 active:scale-[0.98] disabled:opacity-45"
            style={{
              height: 44,
              marginTop: 12,
              border: "1px solid rgba(76,175,80,0.28)",
              borderRadius: 17,
              background: "rgba(76,175,80,0.1)",
              color: "var(--primary)",
              fontFamily: "var(--font-ui)",
              fontSize: 14,
              fontWeight: 800,
              cursor: items.length > 0 ? "pointer" : "default",
            }}
          >
            我已点好，保存到点过
          </button>
          {onBackToResults ? (
            <button
              type="button"
              onClick={onBackToResults}
              className="w-full transition-all duration-150 active:scale-[0.98]"
              style={{
                height: 44,
                marginTop: 9,
                border: "1px solid rgba(232,213,192,0.88)",
                borderRadius: 17,
                background: "rgba(255,255,255,0.28)",
                color: "var(--ink)",
                fontFamily: "var(--font-ui)",
                fontSize: 13,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              返回菜单继续选
            </button>
          ) : null}
        </div>
      </div>
      {previewDish ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewDish(null)}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 18,
            background: "rgba(45,45,45,0.48)",
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 360,
              borderRadius: 22,
              background: "var(--bg)",
              padding: 12,
              boxShadow: "0 18px 42px rgba(45,45,45,0.22)",
            }}
          >
            <div style={{ marginBottom: 10 }}>
              <DishImageWithLoading dish={previewDish} size="hero" alt={previewDish.name_translated?.zh || previewDish.name_original} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="min-w-0 flex-1">
                <div style={{ fontFamily: "var(--font-body)", fontSize: 16, fontWeight: 900, color: "var(--ink)", lineHeight: 1.25 }}>
                  {previewDish.name_original}
                </div>
                <div style={{ marginTop: 3, fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 700, color: "var(--muted)", lineHeight: 1.35 }}>
                  {previewDish.name_translated?.zh || previewDish.name_original}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDish(null)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  border: "1px solid rgba(232,213,192,0.7)",
                  background: "rgba(255,245,233,0.72)",
                  color: "var(--ink)",
                  fontFamily: "var(--font-ui)",
                  fontSize: 16,
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
