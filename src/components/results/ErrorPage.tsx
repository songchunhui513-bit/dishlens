"use client";

interface ErrorPageProps {
  onRetry: () => void;
  onSwitchModel?: () => void;
}

export default function ErrorPage({ onRetry, onSwitchModel }: ErrorPageProps) {
  return (
    <div
      className="h-full flex flex-col items-center justify-center px-8 text-center"
      style={{ background: "var(--bg)" }}
    >
      {/* Icon */}
      <div
        className="flex items-center justify-center"
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          background: "var(--card)",
          marginBottom: 18,
        }}
      >
        <svg
          viewBox="0 0 36 36"
          style={{
            width: 30,
            height: 30,
            stroke: "var(--accent)",
            fill: "none",
            strokeWidth: 2,
            strokeLinecap: "round",
          }}
        >
          <circle cx="18" cy="18" r="12" />
          <line x1="18" y1="10" x2="18" y2="20" />
          <circle cx="18" cy="24" r="1" fill="var(--accent)" />
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
        翻译失败
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
        无法解析菜单内容，请检查图片清晰度后重试，或切换 AI 模型再试
      </p>

      <button
        onClick={onRetry}
        className="transition-all duration-150 active:scale-[0.96]"
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 11,
          fontWeight: 700,
          color: "#FFF",
          background: "var(--primary)",
          border: "none",
          borderRadius: "var(--radius)",
          padding: "10px 28px",
          cursor: "pointer",
          boxShadow: "0 4px 16px rgba(76,175,80,0.2)",
        }}
      >
        重新拍摄
      </button>
      {onSwitchModel && (
        <button
          onClick={onSwitchModel}
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: 10,
            fontWeight: 600,
            color: "var(--primary)",
            background: "none",
            border: "none",
            cursor: "pointer",
            marginTop: 10,
          }}
        >
          切换到备用模型
        </button>
      )}
    </div>
  );
}
