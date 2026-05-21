"use client";

import { useEffect, useRef, useState } from "react";
import { pollTask } from "@/lib/api-client";

interface LoadingPageProps {
  photoCount: number;
  taskId?: string;
  taskStatus?: string;
  useMock?: boolean;
  onComplete: () => void;
  onCancel: () => void;
}

const basePhases = [
  "识别菜单布局...",
  "翻译菜品名称...",
  "生成菜品描述...",
  "匹配参考图片...",
];

function buildPhases(count: number): string[] {
  if (count <= 1) return basePhases;
  const expanded: string[] = [];
  for (let page = 0; page < Math.min(count, 4); page++) {
    for (const p of basePhases) {
      expanded.push(`${p}（第${page + 1}页）`);
    }
  }
  return expanded;
}

export default function LoadingPage({
  photoCount,
  taskId,
  taskStatus: initialTaskStatus,
  useMock,
  onComplete,
  onCancel,
}: LoadingPageProps) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState(0);
  const completedRef = useRef(false);
  const phaseList = buildPhases(photoCount);

  const isPending = !useMock && !taskId;
  const isPolling = !useMock && !!taskId && initialTaskStatus !== "done" && initialTaskStatus !== "partial" && initialTaskStatus !== "failed";
  const isDone = initialTaskStatus === "done" || initialTaskStatus === "partial" || initialTaskStatus === "failed";
  const isMock = !!useMock;

  useEffect(() => {
    if (!isPending) return;
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      // Logarithmic growth: fast start, gradually slowing, approaching 85%
      const pct = Math.min(85, Math.round(15 + 70 * Math.log10(1 + elapsed / 1000)));
      setProgress(pct);
    }, 400);
    return () => clearInterval(interval);
  }, [isPending]);

  useEffect(() => {
    if (!isPolling || !taskId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const t = await pollTask(taskId);
        if (cancelled) return;
        const pct = t.progress.total > 0
          ? Math.round((t.progress.current / t.progress.total) * 100)
          : 0;
        setProgress(pct);
        if (t.per_page_status) {
          const doneCount = t.per_page_status.filter((s) => s.status === "done").length;
          const total = t.per_page_status.length;
          setPhase(Math.min(doneCount * basePhases.length - 1, basePhases.length * total - 1));
        }
        if (t.status === "done" || t.status === "partial" || t.status === "failed") {
          if (!completedRef.current) {
            completedRef.current = true;
            setTimeout(() => onComplete(), 500);
          }
        } else {
          setTimeout(poll, 1500);
        }
      } catch {
        if (!cancelled) setTimeout(poll, 2000);
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [isPolling, taskId, onComplete]);

  useEffect(() => {
    if (!isMock) return;
    const totalSteps = phaseList.length;
    const duration = Math.max(3000, totalSteps * 800);
    const perStep = duration / totalSteps;
    const timers: ReturnType<typeof setTimeout>[] = [];
    phaseList.forEach((_, i) => {
      const t = setTimeout(() => {
        const pct = Math.min(Math.round(((i + 1) / totalSteps) * 100), 100);
        setProgress(pct);
        setPhase(i);
        if (i === totalSteps - 1) {
          const tDone = setTimeout(() => {
            if (!completedRef.current) {
              completedRef.current = true;
              onComplete();
            }
          }, 500);
          timers.push(tDone);
        }
      }, (i + 1) * perStep);
      timers.push(t);
    });
    return () => timers.forEach(clearTimeout);
  }, [isMock, phaseList, onComplete]);

  useEffect(() => {
    if (isDone && !completedRef.current) {
      completedRef.current = true;
      const t = setTimeout(() => onComplete(), 300);
      return () => clearTimeout(t);
    }
  }, [isDone, onComplete]);

  const statusText = isPending ? "正在上传图片..."
    : isPolling ? "AI 正在分析菜单..."
    : isDone ? "分析完成"
    : isMock ? phaseList[Math.min(phase, phaseList.length - 1)]
    : "AI 正在分析菜单...";

  const pctNum = Math.min(Math.round(progress), 100);
  const isNearDone = pctNum > 90;

  return (
    <div
      className="h-full flex flex-col items-center justify-center flex-1"
      style={{ background: "var(--bg)", padding: "30px 20px" }}
    >
      {/* Pulsing dots */}
      <div className="flex" style={{ gap: 10, marginBottom: 24 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-full"
            style={{
              width: 12,
              height: 12,
              background: "var(--rule)",
              animation: `pulse-dot 1.4s infinite ${i * 0.2}s`,
            }}
          />
        ))}
      </div>

      {/* Progress bar */}
      <div style={{ width: 200, marginBottom: 12 }}>
        <div
          className="w-full overflow-hidden"
          style={{ height: 4, borderRadius: 2, background: "var(--rule)" }}
        >
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${Math.max(pctNum, 3)}%`,
              borderRadius: 2,
              background: isNearDone
                ? "linear-gradient(90deg, var(--accent), var(--accent-soft))"
                : "linear-gradient(90deg, var(--primary), var(--primary-soft))",
            }}
          />
        </div>
      </div>

      {/* Status text */}
      <div
        className="animate-[fadeIn_0.5s]"
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 11,
          fontWeight: 600,
          color: "var(--ink)",
          marginBottom: 4,
        }}
      >
        {statusText}
      </div>

      {/* Percentage */}
      <div
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 40,
          fontWeight: 800,
          color: isNearDone ? "var(--primary)" : "var(--ink)",
          letterSpacing: "-0.02em",
          marginBottom: 18,
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
