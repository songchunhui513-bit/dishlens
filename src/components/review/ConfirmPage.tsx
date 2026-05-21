"use client";

import { useEffect, useState } from "react";

interface ConfirmPageProps {
  onBackToMenu: () => void;
  onKeepBrowsing: () => void;
}

export default function ConfirmPage({ onBackToMenu, onKeepBrowsing }: ConfirmPageProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="h-full flex flex-col items-center justify-center px-8 text-center"
      style={{ background: "var(--bg)" }}
    >
      {/* Check circle */}
      <div
        className="flex items-center justify-center"
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          background: "var(--primary)",
          marginBottom: 18,
          animation: show ? "popIn 0.4s ease-out" : "none",
        }}
      >
        <svg viewBox="0 0 24 24" style={{ width: 36, height: 36 }}>
          <polyline
            points="4,12 10,18 20,6"
            fill="none"
            stroke="#FFF"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 24,
              strokeDashoffset: show ? 0 : 24,
              transition: "stroke-dashoffset 0.5s ease-out 0.2s",
            }}
          />
        </svg>
      </div>

      <h3
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 14,
          fontWeight: 800,
          color: "var(--ink)",
          marginBottom: 4,
        }}
      >
        感谢你的评价
      </h3>
      <p
        style={{
          fontFamily: "var(--font-ui)",
          fontSize: 10,
          color: "var(--muted)",
          maxWidth: 220,
          lineHeight: 1.5,
          marginBottom: 22,
        }}
      >
        你的反馈将帮助更多旅行者做出更好的选择，也帮助餐厅改进品质
      </p>

      <div className="flex gap-2.5" style={{ marginTop: 4 }}>
        <button
          onClick={onKeepBrowsing}
          className="transition-all duration-150 active:scale-[0.96]"
          style={{
            padding: "10px 20px",
            borderRadius: "var(--radius)",
            fontFamily: "var(--font-body)",
            fontSize: 10,
            fontWeight: 600,
            cursor: "pointer",
            background: "var(--ink)",
            color: "#FFF",
            border: "none",
          }}
        >
          继续浏览
        </button>
        <button
          onClick={onBackToMenu}
          className="transition-all duration-150 active:scale-[0.96]"
          style={{
            padding: "10px 20px",
            borderRadius: "var(--radius)",
            fontFamily: "var(--font-body)",
            fontSize: 10,
            fontWeight: 600,
            cursor: "pointer",
            background: "transparent",
            color: "var(--ink)",
            border: "1px solid var(--ink)",
          }}
        >
          返回首页
        </button>
      </div>
    </div>
  );
}
