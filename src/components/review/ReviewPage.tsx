"use client";

import { useState } from "react";
import type { Dish } from "@/types";

interface ReviewPageProps {
  dish?: Dish;
  onBack: () => void;
  onConfirm: () => void;
}

export default function ReviewPage({ dish, onBack, onConfirm }: ReviewPageProps) {
  const [rating, setRating] = useState(4);
  const [text, setText] = useState("牛肉炖得恰到好处，酱汁浓郁不腻...");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = () => {
    if (rating === 0) return;
    setSubmitting(true);
    setTimeout(() => onConfirm(), 1200);
  };

  const original = dish?.name_original || "Boeuf Bourguignon";
  const zhName = dish?.name_translated?.zh || "勃艮第红酒炖牛肉";

  if (submitting) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-10" style={{ background: "var(--bg)" }}>
        <div className="w-12 h-12 rounded-full mb-5 animate-spin" style={{ border: "3px solid var(--rule)", borderTopColor: "var(--primary)" }} />
        <div className="text-sm italic" style={{ fontFamily: "var(--font-display)", color: "var(--muted)" }}>正在发布评价...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ background: "var(--bg)" }}>
      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0">
        <button
          onClick={onBack}
          className="text-[11px] cursor-pointer transition-opacity hover:opacity-50"
          style={{ color: "var(--ink)", background: "none", border: "none" }}
        >
          ←
        </button>
        <span className="text-xs font-bold flex-1" style={{ fontFamily: "var(--font-body)", color: "var(--ink)" }}>
          写评价
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto" style={{ padding: "14px 16px" }}>
        {/* Dish badge */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 11, fontStyle: "italic", color: "var(--muted)", marginBottom: 1 }}>
            {original}
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>
            {zhName}
          </div>
        </div>

        {/* Star rating */}
        <div style={{ fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>
          评分
        </div>
        <div className="flex gap-2" style={{ marginBottom: 20 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setRating(n)}
              className="p-0 leading-none transition-all duration-150 hover:scale-120"
              style={{
                fontSize: 28,
                color: n <= rating ? "var(--accent)" : "var(--rule)",
                cursor: "pointer",
                background: "none",
                border: "none",
                animation: n <= rating ? "popIn 0.2s ease-out" : "none",
              }}
            >
              {n <= rating ? "★" : "☆"}
            </button>
          ))}
        </div>

        {/* Text area */}
        <div style={{ fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>
          评价
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="写下你对这道菜的感受..."
          className="w-full resize-none outline-none transition-colors"
          style={{
            height: 100,
            border: "1px solid var(--rule)",
            borderRadius: "var(--radius-sm)",
            padding: 10,
            fontFamily: "var(--font-ui)",
            fontSize: 10,
            color: "var(--muted)",
            background: "var(--card)",
            lineHeight: 1.6,
            marginBottom: 18,
          }}
        />

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={rating === 0}
          className="w-full transition-all duration-150 active:scale-[0.97] disabled:opacity-40"
          style={{
            padding: 12,
            fontFamily: "var(--font-body)",
            fontSize: 11,
            fontWeight: 700,
            color: "#FFF",
            background: "var(--primary)",
            border: "none",
            borderRadius: "var(--radius)",
            cursor: rating === 0 ? "default" : "pointer",
            boxShadow: "0 4px 16px rgba(76,175,80,0.2)",
          }}
        >
          提交评价
        </button>
      </div>
    </div>
  );
}
