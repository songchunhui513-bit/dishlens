"use client";

import { useEffect, useRef, useState } from "react";
import { FoodCharacters, FOOD_CHARACTER_HINTS } from "./FoodCharacters";

interface LoadingPageProps {
  photoCount: number;
  taskId?: string;
  taskStatus?: string;
  useMock?: boolean;
  onComplete: () => void;
  onCancel: () => void;
  onResult?: (result: Record<string, unknown>) => void;
}

const FOOD_CHARACTER_ROTATE_MS = 4000;

const statusTimeline = [
  { t: 0, text: "正在压缩图片..." },
  { t: 3, text: "正在上传菜单..." },
  { t: 6, text: "AI 正在识别菜品..." },
  { t: 12, text: "正在翻译菜名..." },
  { t: 20, text: "正在优化描述..." },
  { t: 28, text: "正在匹配图片..." },
  { t: 35, text: "即将完成..." },
];

export default function LoadingPage({
  onCancel,
}: LoadingPageProps) {
  const [progress, setProgress] = useState(3);
  const [statusText, setStatusText] = useState("正在压缩图片...");
  const [statusKey, setStatusKey] = useState(0);
  const [foodCharacterIndex, setFoodCharacterIndex] = useState(0);
  const [startMs] = useState(() => Date.now());

  // Food character rotation
  useEffect(() => {
    const interval = setInterval(() => {
      setFoodCharacterIndex((i) => (i + 1) % FOOD_CHARACTER_HINTS.length);
    }, FOOD_CHARACTER_ROTATE_MS);
    return () => clearInterval(interval);
  }, []);

  // Time-driven progress + status text
  useEffect(() => {
    const interval = setInterval(() => {
      const ms = Date.now() - startMs;
      const sec = ms / 1000;

      // Progress: exponential approach to 90%, ~60s to get close
      const pct = Math.min(90, Math.round(3 + 87 * (1 - Math.exp(-sec / 30))));
      setProgress(pct);

      // Status text from timeline
      let current = statusTimeline[0].text;
      for (const entry of statusTimeline) {
        if (sec >= entry.t) current = entry.text;
      }
      setStatusText((prev) => {
        if (prev !== current) {
          setStatusKey((k) => k + 1);
          return current;
        }
        return prev;
      });
    }, 500);
    return () => clearInterval(interval);
  }, [startMs]);

  const pctNum = Math.min(Math.round(progress), 100);
  const isNearDone = pctNum > 80;

  return (
    <div
      className="h-full flex flex-col items-center justify-center flex-1"
      style={{ background: "var(--bg)", padding: "30px 20px" }}
    >
      {/* Food character */}
      <div data-testid="loading-food-character">
        <FoodCharacters activeIndex={foodCharacterIndex} />
      </div>

      {/* Progress bar */}
      <div style={{ width: 200, marginBottom: 12 }}>
        <div
          className="w-full overflow-hidden"
          style={{ height: 4, borderRadius: 2, background: "var(--rule)" }}
        >
          <div
            className="h-full"
            style={{
              width: `${Math.max(pctNum, 3)}%`,
              borderRadius: 2,
              background: isNearDone
                ? "linear-gradient(90deg, var(--accent), var(--accent-soft))"
                : "linear-gradient(90deg, var(--primary), var(--primary-soft))",
              transition: "width 300ms ease-out",
            }}
          />
        </div>
      </div>

      {/* Status text */}
      <div
        key={`status-${statusKey}`}
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 11,
          fontWeight: 600,
          color: "var(--ink)",
          marginBottom: 4,
          animation: "fadeIn 0.5s ease-out",
        }}
      >
        {statusText}
      </div>

      {/* Food hint */}
      <div
        key={`food-hint-${foodCharacterIndex}`}
        style={{
          fontFamily: "var(--font-ui)",
          fontSize: 9,
          color: "var(--muted)",
          marginBottom: 14,
          animation: "fadeIn 0.5s ease-out",
        }}
      >
        {FOOD_CHARACTER_HINTS[foodCharacterIndex]}
      </div>

      {/* Percentage */}
      <div
        key={`pct-${Math.floor(pctNum / 10)}`}
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 40,
          fontWeight: 800,
          color: isNearDone ? "var(--primary)" : "var(--ink)",
          letterSpacing: 0,
          marginBottom: 18,
          animation: "fadeIn 0.5s ease-out",
        }}
      >
        {pctNum}%
      </div>

      {/* Cancel */}
      <button
        onClick={onCancel}
        className="transition-opacity hover:opacity-70"
        style={{
          fontFamily: "var(--font-ui)",
          fontSize: 10,
          fontWeight: 600,
          color: "var(--muted)",
          background: "none",
          border: "none",
          cursor: "pointer",
        }}
      >
        取消
      </button>
    </div>
  );
}
