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
const LOADING_STEPS = [
  { label: "整理照片", detail: "压缩并上传菜单" },
  { label: "识别菜品", detail: "读取菜名、价格和描述" },
  { label: "翻译推荐", detail: "生成适合点菜的中文说明" },
  { label: "补齐图片", detail: "优先匹配本地图，缺失再生成" },
] as const;

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
  const activeStep = Math.min(LOADING_STEPS.length - 1, Math.floor((pctNum / 100) * LOADING_STEPS.length));
  const currentHint = FOOD_CHARACTER_HINTS[foodCharacterIndex];
  const elapsedSeconds = Math.round(((isPolling ? pollingElapsed : pendingElapsed) || 0) / 1000);
  const elapsedLabel = elapsedSeconds > 0 ? `${elapsedSeconds}s` : "刚刚开始";

  return (
    <div
      className="h-full flex flex-col flex-1"
      style={{
        background: "linear-gradient(180deg, #FFF8EE 0%, var(--bg) 48%, #F6E5CF 100%)",
        padding: "calc(34px + env(safe-area-inset-top)) 18px calc(24px + env(safe-area-inset-bottom))",
      }}
    >
      {/* Failed state */}
      {isFailed ? (
        <div
          className="flex flex-1 flex-col items-center justify-center text-center"
          style={{
            border: "1px solid rgba(212,165,116,0.34)",
            borderRadius: 28,
            background: "rgba(255,245,233,0.72)",
            padding: "32px 24px",
            boxShadow: "0 18px 42px rgba(94, 56, 18, 0.08)",
          }}
        >
          <div
            className="flex items-center justify-center"
            style={{
              width: 68,
              height: 68,
              borderRadius: "50%",
              background: "var(--allergen-bg)",
              marginBottom: 22,
              animation: "popIn 0.3s ease-out",
            }}
          >
            <svg viewBox="0 0 24 24" style={{ width: 30, height: 30, stroke: "var(--accent)", fill: "none", strokeWidth: 2, strokeLinecap: "round" }}>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4M12 16h0" />
            </svg>
          </div>
          <div
            key={`status-${statusKey}`}
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 22,
              fontWeight: 800,
              color: "var(--ink)",
              marginBottom: 8,
              letterSpacing: 0,
              animation: "fadeIn 0.5s ease-out",
            }}
          >
            {statusText}
          </div>
          <div
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 14,
              lineHeight: 1.55,
              color: "var(--muted)",
              marginBottom: 24,
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
                fontSize: 15,
                fontWeight: 800,
                color: "#FFF",
                background: "var(--ink)",
                border: "1px solid rgba(45,45,45,0.12)",
                borderRadius: 999,
                minHeight: 46,
                padding: "0 24px",
                cursor: "pointer",
              }}
            >
              返回首页
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col" style={{ gap: 16, minHeight: 0 }}>
          <div style={{ flex: 1, minHeight: 8 }} />

          <div
            style={{
              textAlign: "center",
              animation: "fadeSlideUp 420ms ease-out both",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: 12,
                fontWeight: 800,
                color: "var(--primary)",
                marginBottom: 8,
              }}
            >
              DishLens 正在读菜单
            </div>
            <h1
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 28,
                lineHeight: 1.16,
                fontWeight: 900,
                color: "var(--ink)",
                letterSpacing: 0,
                margin: 0,
              }}
            >
              把照片变成可点菜清单
            </h1>
            <p
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: 14,
                lineHeight: 1.55,
                color: "var(--muted)",
                margin: "10px auto 0",
                maxWidth: 280,
              }}
            >
              先返回菜名和推荐，图片会继续在后台补齐。
            </p>
          </div>

          <div
            style={{
              border: "1px solid rgba(212,165,116,0.34)",
              borderRadius: 30,
              background: "linear-gradient(180deg, rgba(255,255,255,0.44), rgba(254,230,203,0.5))",
              boxShadow: "0 20px 52px rgba(94, 56, 18, 0.1)",
              padding: "20px 18px 18px",
              animation: "fadeSlideUp 520ms ease-out both",
            }}
          >
            <div
              data-testid="loading-food-character"
              className="loading-food-stage"
              style={{
                width: 172,
                height: 142,
                margin: "0 auto 10px",
                borderRadius: 28,
                background: "radial-gradient(circle at 50% 30%, rgba(255,255,255,0.9), rgba(255,245,233,0.42) 58%, rgba(255,159,28,0.08))",
                border: "1px solid rgba(255,255,255,0.7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FoodCharacters activeIndex={foodCharacterIndex} />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 12,
                marginBottom: 10,
              }}
            >
              <div
                key={`status-${statusKey}`}
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 20,
                  fontWeight: 850,
                  color: "var(--ink)",
                  lineHeight: 1.25,
                  animation: "fadeIn 0.5s ease-out",
                }}
              >
                {statusText}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 30,
                  fontWeight: 900,
                  color: isNearDone ? "var(--primary)" : "var(--ink)",
                  lineHeight: 1,
                  letterSpacing: 0,
                }}
              >
                {pctNum}%
              </div>
            </div>

            <div
              key={`food-hint-${foodCharacterIndex}`}
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: 13,
                color: "var(--muted)",
                marginBottom: 14,
                lineHeight: 1.45,
                animation: "fadeIn 0.5s ease-out",
              }}
            >
              {currentHint} · 已等待 {elapsedLabel}
            </div>

            <div
              className="w-full overflow-hidden"
              style={{ height: 10, borderRadius: 999, background: "rgba(212,165,116,0.26)" }}
            >
              <div
                className="h-full"
                style={{
                  width: `${Math.max(pctNum, 3)}%`,
                  borderRadius: 999,
                  background: isNearDone
                    ? "linear-gradient(90deg, var(--accent), var(--accent-soft))"
                    : "linear-gradient(90deg, var(--primary), var(--primary-soft))",
                  transition: "width 300ms ease-out",
                  boxShadow: "0 0 18px rgba(76,175,80,0.22)",
                }}
              />
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              animation: "fadeSlideUp 620ms ease-out both",
            }}
          >
            {LOADING_STEPS.map((step, index) => {
              const complete = pctNum >= ((index + 1) / LOADING_STEPS.length) * 100;
              const active = index === activeStep && !complete;
              return (
                <div
                  key={step.label}
                  style={{
                    borderRadius: 20,
                    background: complete || active ? "rgba(76,175,80,0.1)" : "rgba(255,255,255,0.34)",
                    border: `1px solid ${complete || active ? "rgba(76,175,80,0.22)" : "rgba(212,165,116,0.28)"}`,
                    padding: "12px 12px 11px",
                    minHeight: 76,
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-ui)",
                      fontSize: 11,
                      fontWeight: 900,
                      color: complete || active ? "var(--primary)" : "var(--muted)",
                      marginBottom: 4,
                    }}
                  >
                    {complete ? "完成" : active ? "进行中" : "排队中"}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: 15,
                      lineHeight: 1.25,
                      fontWeight: 850,
                      color: "var(--ink)",
                      marginBottom: 3,
                    }}
                  >
                    {step.label}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-ui)",
                      fontSize: 11,
                      lineHeight: 1.35,
                      color: "var(--muted)",
                    }}
                  >
                    {step.detail}
                  </div>
                </div>
              );
            })}
          </div>

          <div
            style={{
              borderRadius: 22,
              background: "rgba(45,45,45,0.06)",
              border: "1px solid rgba(45,45,45,0.07)",
              padding: "13px 14px",
              fontFamily: "var(--font-ui)",
              fontSize: 12,
              lineHeight: 1.55,
              color: "var(--ink-soft)",
              animation: "fadeSlideUp 720ms ease-out both",
            }}
          >
            菜名识别完成后会直接进入结果页；图片和更细的推荐会继续自动更新，不需要一直停在这里。
          </div>

          <button
            onClick={onCancel}
            className="transition-all duration-150 active:scale-[0.98]"
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 15,
              fontWeight: 850,
              color: "var(--muted)",
              background: "rgba(255,255,255,0.45)",
              border: "1px solid rgba(212,165,116,0.34)",
              borderRadius: 999,
              minHeight: 48,
              width: "100%",
              cursor: "pointer",
            }}
          >
            取消
          </button>

          <div style={{ flex: 1, minHeight: 8 }} />
        </div>
      )}
    </div>
  );
}
