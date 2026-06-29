"use client";

import { useEffect, useRef, useState } from "react";
import { pollTask } from "@/lib/api-client";
import { FoodCharacters, FOOD_CHARACTER_HINTS } from "./FoodCharacters";

interface LoadingPageProps {
  photoCount: number;
  taskId?: string;
  taskStatus?: string;
  useMock?: boolean;
  onComplete: () => void;
  onCancel: () => void;
  onTimeout?: () => void;
  onResult?: (result: Record<string, unknown>) => void;
}

const basePhases = [
  "识别菜单布局...",
  "翻译菜品名称...",
  "整理菜品信息...",
  "准备结果页...",
];

const FOOD_CHARACTER_ROTATE_MS = 4000;
const MAX_POLLING_MS = 180_000;

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
  onTimeout,
  onResult,
}: LoadingPageProps) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState(0);
  const completedRef = useRef(false);
  const phaseList = buildPhases(photoCount);

  const isPending = !useMock && !taskId;
  const isPolling = !useMock && !!taskId && initialTaskStatus !== "done" && initialTaskStatus !== "partial" && initialTaskStatus !== "failed";
  const isDone = initialTaskStatus === "done" || initialTaskStatus === "partial";
  const isFailed = initialTaskStatus === "failed";
  const isMock = !!useMock;

  const [pendingStart] = useState(() => Date.now());
  const [pendingElapsed, setPendingElapsed] = useState(0);

  // Track last poll result for timeout fallback
  const lastResultRef = useRef<unknown | null>(null);
  // Track when polling started for sub-phase text
  const pollingStartRef = useRef(0);
  const [pollingElapsed, setPollingElapsed] = useState(0);

  // Track previous status text for animation key
  const [statusKey, setStatusKey] = useState(0);
  const [foodCharacterIndex, setFoodCharacterIndex] = useState(0);

  useEffect(() => {
    if (isFailed) return;
    const interval = setInterval(() => {
      setFoodCharacterIndex((index) => (index + 1) % FOOD_CHARACTER_HINTS.length);
    }, FOOD_CHARACTER_ROTATE_MS);
    return () => clearInterval(interval);
  }, [isFailed]);

  // Pending progress: exponential approach to 95%, never hard-stops
  useEffect(() => {
    if (!isPending) return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - pendingStart;
      setPendingElapsed(elapsed);
      const pct = Math.min(95, Math.round(5 + 90 * (1 - Math.exp(-elapsed / 25000))));
      setProgress(pct);
    }, 500);
    return () => clearInterval(interval);
  }, [isPending, pendingStart]);

  // Polling elapsed timer (for sub-phase status text)
  useEffect(() => {
    if (!isPolling) return;
    pollingStartRef.current = Date.now();
    const interval = setInterval(() => {
      setPollingElapsed(Date.now() - pollingStartRef.current);
    }, 1000);
    return () => clearInterval(interval);
  }, [isPolling, taskId]); // reset on new taskId

  // Polling progress: real data from API, with time-based floor so bar never stalls at 0%
  useEffect(() => {
    if (!isPolling || !taskId) return;
    const pollStartTime = Date.now();
    let cancelled = false;

    // Time-driven floor: slowly approaches 85% over ~60s, never drops below it
    const floorInterval = setInterval(() => {
      if (cancelled) return;
      const elapsed = Date.now() - pollStartTime;
      const floor = Math.min(85, Math.round(3 + 82 * (1 - Math.exp(-elapsed / 30000))));
      setProgress((prev) => Math.max(prev, floor));
    }, 800);

    const poll = async () => {
      try {
        if (Date.now() - pollStartTime > MAX_POLLING_MS) {
          if (!cancelled && !completedRef.current) {
            // Even on timeout, try to show whatever partial results we have
            const saved = lastResultRef.current as Record<string, unknown> | null;
            if (saved?.pages && onResult) {
              completedRef.current = true;
              onResult(saved);
              setTimeout(() => onComplete(), 300);
              return;
            }
            completedRef.current = true;
            onTimeout?.();
          }
          return;
        }
        const t = await pollTask(taskId);
        if (cancelled) return;
        // Save latest result for timeout fallback
        if (t.result) lastResultRef.current = t.result as unknown;
        const apiPct = t.progress.total > 0
          ? Math.round((t.progress.current / t.progress.total) * 100)
          : 0;
        setProgress((prev) => Math.max(prev, apiPct));
        if (t.per_page_status) {
          const doneCount = t.per_page_status.filter((s) => s.status === "done").length;
          const total = t.per_page_status.length;
          setPhase(Math.min(doneCount * basePhases.length - 1, basePhases.length * total - 1));
        }
        // Show results as soon as ANY page is available (streaming approach)
        const hasPartialResult = t.result && (t.result as unknown as Record<string, unknown>).pages
          && Array.isArray((t.result as unknown as Record<string, unknown>).pages)
          && ((t.result as unknown as Record<string, unknown>).pages as unknown[]).length > 0;
        if (t.status === "done" || t.status === "partial" || t.status === "failed") {
          if (!completedRef.current) {
            completedRef.current = true;
            if (t.result && onResult) onResult(t.result as unknown as Record<string, unknown>);
            if (t.status === "failed") {
              setProgress(0);
            } else {
              setProgress(100);
            }
            setTimeout(() => onComplete(), 500);
          }
        } else if (hasPartialResult && !completedRef.current) {
          // Transition to results immediately with available pages, keep polling
          completedRef.current = true;
          setProgress(100);
          if (t.result && onResult) onResult(t.result as unknown as Record<string, unknown>);
          setTimeout(() => onComplete(), 300);
        } else {
          setTimeout(poll, 1500);
        }
      } catch {
        if (!cancelled) setTimeout(poll, 2000);
      }
    };
    poll();
    return () => {
      cancelled = true;
      clearInterval(floorInterval);
    };
  }, [isPolling, taskId, onComplete, onResult, onTimeout]);

  // Mock mode
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

  // Done effect — only for success states, not failed
  useEffect(() => {
    if (isDone && !completedRef.current) {
      completedRef.current = true;
      const t = setTimeout(() => onComplete(), 300);
      return () => clearTimeout(t);
    }
  }, [isDone, onComplete]);

  // Failed effect — show error state, don't auto-navigate
  useEffect(() => {
    if (isFailed && !completedRef.current) {
      completedRef.current = true;
      setProgress(0);
    }
  }, [isFailed]);

  // Phase-aware status text
  function getStatusText(): string {
    if (isFailed) return "识别失败，请重试";
    if (isPolling) {
      // Per-page phase from actual API progress
      if (phase > 0) return `AI 正在分析...（${Math.floor(phase / basePhases.length) + 1}/${photoCount} 页）`;
      // Sub-phase text based on elapsed time during polling
      const sec = pollingElapsed / 1000;
      if (sec < 5) return "AI 正在识别菜品...";
      if (sec < 10) return "正在翻译菜名...";
      if (sec < 18) return "正在整理菜品...";
      if (sec < 25) return "正在准备结果...";
      return "即将完成...";
    }
    if (isDone) return "分析完成";
    if (isMock) return phaseList[Math.min(phase, phaseList.length - 1)];
    const sec = pendingElapsed / 1000;
    if (sec < 3) return "正在压缩图片...";
    if (sec < 8) return "正在上传...";
    if (sec < 20) return "等待 AI 响应...";
    return "AI 正在处理...";
  }

  const statusText = getStatusText();

  // Bump status key whenever text changes → re-triggers fadeIn animation
  const prevStatusRef = useRef(statusText);
  useEffect(() => {
    if (prevStatusRef.current !== statusText) {
      prevStatusRef.current = statusText;
      setStatusKey((k) => k + 1);
    }
  }, [statusText]);

  const pctNum = Math.min(Math.round(progress), 100);
  const isNearDone = pctNum > 90;

  return (
    <div
      className="h-full flex flex-col items-center justify-center flex-1"
      style={{ background: "var(--bg)", padding: "30px 20px" }}
    >
      {/* Failed state */}
      {isFailed ? (
        <>
          <div
            className="flex items-center justify-center"
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "var(--allergen-bg)",
              marginBottom: 20,
              animation: "popIn 0.3s ease-out",
            }}
          >
            <svg viewBox="0 0 24 24" style={{ width: 24, height: 24, stroke: "var(--accent)", fill: "none", strokeWidth: 2, strokeLinecap: "round" }}>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4M12 16h0" />
            </svg>
          </div>
          <div
            key={`status-${statusKey}`}
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--ink)",
              marginBottom: 4,
              animation: "fadeIn 0.5s ease-out",
            }}
          >
            {statusText}
          </div>
          <div
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 9,
              color: "var(--muted)",
              marginBottom: 18,
              animation: "fadeIn 0.5s ease-out",
            }}
          >
            请检查图片是否清晰，或稍后再试
          </div>
          <div className="flex gap-3">
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
              返回首页
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Pulsing dots */}
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

          {/* Status text — key forces re-mount on text change → fadeIn replays */}
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

          {/* Percentage — re-animate when crossing 90% threshold */}
          <div
            key={`pct-${isNearDone ? "near" : "far"}-${Math.floor(pctNum / 10)}`}
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
        </>
      )}
    </div>
  );
}
