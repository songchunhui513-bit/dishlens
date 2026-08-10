"use client";

import type { ShareMenuMeta, ShareTargetId } from "@/lib/share-menu";
import { buildShareHref, buildShareMessage, SHARE_TARGETS } from "@/lib/share-menu";
import { useRef, useState, type CSSProperties } from "react";

interface ShareSheetProps {
  open: boolean;
  meta: ShareMenuMeta | null;
  onClose: () => void;
  onStatus?: (message: string) => void;
}

type ShareIllustrationTarget = ShareTargetId | "menu";

const roundStroke: CSSProperties = { strokeLinecap: "round", strokeLinejoin: "round" };
const CLIPBOARD_TIMEOUT_MS = 350;

function ShareIllustrationIcon({ targetId, featured = false }: { targetId: ShareIllustrationTarget; featured?: boolean }) {
  const size = featured ? 62 : 50;
  const shellBackground = featured
    ? "linear-gradient(135deg, rgba(255,245,233,0.98), rgba(254,230,203,0.9))"
    : "linear-gradient(135deg, rgba(255,245,233,0.92), rgba(255,240,221,0.74))";

  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: featured ? 22 : 18,
        background: shellBackground,
        border: "1px solid rgba(212,165,116,0.38)",
        boxShadow: featured ? "inset 0 1px 0 rgba(255,255,255,0.72), 0 10px 22px rgba(45,45,45,0.08)" : "inset 0 1px 0 rgba(255,255,255,0.62)",
        flexShrink: 0,
      }}
    >
      <svg viewBox="0 0 96 96" style={{ width: featured ? 50 : 40, height: featured ? 50 : 40 }} aria-hidden="true">
        {targetId === "menu" ? (
          <>
            <path d="M28 18 h35 q7 0 7 7 v43 q0 8-8 8 H28 q-7 0-7-7 V25 q0-7 7-7Z" fill="#FFF5E9" stroke="#D4A574" strokeWidth="2.6" style={roundStroke} />
            <path d="M34 31 h22 M34 42 h28 M34 53 h20" stroke="#C49660" strokeWidth="2.5" opacity="0.78" style={roundStroke} />
            <path d="M64 24 q7 5 6 13 q-1 8-9 11" fill="none" stroke="#4CAF50" strokeWidth="3.6" style={roundStroke} />
            <path d="M32 72 q17 8 36 0" fill="none" stroke="#FFB74D" strokeWidth="5" style={roundStroke} />
            <circle cx="25" cy="32" r="3" fill="#FF9F1C" style={{ animation: "sparkleA 2s ease-out infinite .25s" }} />
            <circle cx="69" cy="54" r="2.8" fill="#4CAF50" />
          </>
        ) : null}
        {targetId === "native" ? (
          <>
            <path d="M19 42 q0-15 19-15 q19 0 19 15 q0 14-19 14 q-3 0-7-.6 l-9 6 l3-9 q-6-4-6-10Z" fill="#FEE6CB" stroke="#D4A574" strokeWidth="2.5" style={roundStroke} />
            <path d="M49 33 q0-13 17-13 q17 0 17 13 q0 13-17 13 q-3 0-6-.5 l-8 5 l3-8 q-6-4-6-9.5Z" fill="#FFF5E9" stroke="#D4A574" strokeWidth="2.5" style={roundStroke} />
            <path d="M31 70 Q48 79 66 70" fill="none" stroke="#FFB74D" strokeWidth="5" style={roundStroke} />
            <circle cx="33" cy="42" r="2.6" fill="#FF9F1C" />
            <circle cx="43" cy="42" r="2.6" fill="#FF9F1C" />
            <path d="M61 32 h12 M61 39 h7" stroke="#4CAF50" strokeWidth="2.7" style={roundStroke} />
          </>
        ) : null}
        {targetId === "copy" ? (
          <>
            <path d="M30 22 h29 q7 0 7 7 v38 q0 7-7 7 H30 q-7 0-7-7 V29 q0-7 7-7Z" fill="#FFF5E9" stroke="#D4A574" strokeWidth="2.6" style={roundStroke} />
            <path d="M36 37 h20 M36 48 h13 M36 59 h17" stroke="#C49660" strokeWidth="2.4" style={roundStroke} opacity="0.7" />
            <path d="M55 31 q10-8 20 0" fill="none" stroke="#4CAF50" strokeWidth="4" style={roundStroke} />
            <path d="M51 70 q-10 8-20 0" fill="none" stroke="#FF9F1C" strokeWidth="4" style={roundStroke} />
            <circle cx="71" cy="26" r="3" fill="#FF9F1C" style={{ animation: "sparkleA 2.1s ease-out infinite" }} />
          </>
        ) : null}
        {targetId === "wechat" ? (
          <>
            <ellipse cx="46" cy="70" rx="27" ry="6" fill="#FEE6CB" stroke="#D4A574" strokeWidth="1.8" opacity="0.65" />
            <path d="M17 43 q0-17 21-17 q21 0 21 17 q0 16-21 16 q-4 0-8-.8 l-10 6 l4-10 q-7-5-7-11.2Z" fill="#FEE6CB" stroke="#D4A574" strokeWidth="2.4" style={roundStroke} />
            <path d="M43 50 q0-14 17-14 q17 0 17 14 q0 13-17 13 q-3 0-6-.6 l-8 5 l3-8 q-6-4-6-9.4Z" fill="#FFF5E9" stroke="#4CAF50" strokeWidth="2.3" style={roundStroke} />
            <circle cx="33" cy="42" r="2.5" fill="#FF9F1C" />
            <circle cx="44" cy="42" r="2.5" fill="#FF9F1C" />
            <circle cx="56" cy="50" r="2.1" fill="#4CAF50" />
            <circle cx="66" cy="50" r="2.1" fill="#4CAF50" />
          </>
        ) : null}
        {targetId === "whatsapp" ? (
          <>
            <path d="M24 70 l4-12 q-5-7-5-16 q0-22 24-22 q24 0 24 22 q0 23-24 23 q-7 0-13-3Z" fill="#FFF5E9" stroke="#D4A574" strokeWidth="2.7" style={roundStroke} />
            <path d="M40 35 q4 13 17 20 q4-2 6-6 l-7-5 l-4 4 q-5-3-8-9 l4-4 l-5-6 q-4 2-3 6Z" fill="#4CAF50" opacity="0.88" />
            <circle cx="27" cy="24" r="3" fill="#FF9F1C" style={{ animation: "sparkleA 2s ease-out infinite .3s" }} />
          </>
        ) : null}
        {targetId === "telegram" ? (
          <>
            <ellipse cx="48" cy="71" rx="25" ry="6" fill="#FEE6CB" stroke="#D4A574" strokeWidth="1.8" opacity="0.7" />
            <path d="M19 45 L77 22 L65 73 L50 58 L39 67 L41 53Z" fill="#FFF5E9" stroke="#D4A574" strokeWidth="2.5" style={roundStroke} />
            <path d="M41 53 L77 22 L50 58" fill="none" stroke="#4CAF50" strokeWidth="2.5" style={roundStroke} />
            <circle cx="27" cy="24" r="3" fill="#FF9F1C" style={{ animation: "sparkleA 2.2s ease-out infinite .4s" }} />
          </>
        ) : null}
        {targetId === "line" ? (
          <>
            <path d="M19 45 q0-22 29-22 q29 0 29 22 q0 21-29 21 q-5 0-10-.9 L27 73 l4-12 q-12-6-12-16Z" fill="#FFF5E9" stroke="#D4A574" strokeWidth="2.5" style={roundStroke} />
            <path d="M35 44 h24 M35 52 h17" stroke="#4CAF50" strokeWidth="5" style={roundStroke} />
            <circle cx="32" cy="31" r="3" fill="#FF9F1C" style={{ animation: "sparkleA 2.1s ease-out infinite .2s" }} />
          </>
        ) : null}
        {targetId === "facebook" ? (
          <>
            <path d="M28 22 h35 q8 0 8 8 v38 q0 8-8 8 H28 q-8 0-8-8 V30 q0-8 8-8Z" fill="#FFF5E9" stroke="#D4A574" strokeWidth="2.5" style={roundStroke} />
            <path d="M53 75 V50 h8 l2-10 H53 v-6 q0-5 6-5 h5 v-9 q-4-.7-9-.7 q-14 0-14 15V40h-8v10h8v25Z" fill="#4CAF50" opacity="0.9" />
            <ellipse cx="47" cy="80" rx="22" ry="5" fill="#FEE6CB" stroke="#D4A574" strokeWidth="1.5" />
          </>
        ) : null}
        {targetId === "x" ? (
          <>
            <path d="M24 26 h48 q8 0 8 8 v30 q0 8-8 8 H52 l-13 8 4-8H24 q-8 0-8-8 V34 q0-8 8-8Z" fill="#FFF5E9" stroke="#D4A574" strokeWidth="2.5" style={roundStroke} />
            <path d="M35 39 l25 22 M61 39 L35 61" stroke="#4CAF50" strokeWidth="5.5" style={roundStroke} />
            <circle cx="70" cy="24" r="3" fill="#FF9F1C" style={{ animation: "sparkleA 2s ease-out infinite .3s" }} />
          </>
        ) : null}
      </svg>
    </span>
  );
}

export default function ShareSheet({ open, meta, onClose, onStatus }: ShareSheetProps) {
  const [localStatus, setLocalStatus] = useState("");
  const [statusTone, setStatusTone] = useState<"success" | "info" | "error">("success");
  const statusTimerRef = useRef<number | null>(null);

  if (!open || !meta) return null;
  const shareMeta: ShareMenuMeta = meta;

  const mainTargets = SHARE_TARGETS.filter((target) => target.id === "native" || target.id === "copy");
  const channelTargets = SHARE_TARGETS.filter((target) => target.id !== "native" && target.id !== "copy");

  function showStatus(message: string, tone: "success" | "info" | "error" = "success") {
    if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current);
    setStatusTone(tone);
    setLocalStatus(message);
    onStatus?.(message);
    statusTimerRef.current = window.setTimeout(() => setLocalStatus(""), 2400);
  }

  async function writeClipboardWithTimeout(text: string) {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");

    await Promise.race([
      navigator.clipboard.writeText(text),
      new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error("Clipboard write timed out")), CLIPBOARD_TIMEOUT_MS);
      }),
    ]);
  }

  async function copyLink(message = "菜单链接已复制") {
    try {
      await writeClipboardWithTimeout(shareMeta.url);
      showStatus(message);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = shareMeta.url;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      try {
        document.body.appendChild(textarea);
        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length);
        const copied = document.execCommand("copy");
        showStatus(copied ? message : "已显示链接，请长按上方链接复制", copied ? "success" : "info");
      } catch {
        showStatus("已显示链接，请长按上方链接复制", "info");
      } finally {
        textarea.remove();
      }
    }
  }

  async function shareNative(fallbackMessage = "浏览器无法打开分享菜单，链接已复制") {
    try {
      const nativeShare = navigator.share as ((data: ShareData) => Promise<void>) | undefined;
      if (nativeShare) {
        await nativeShare.call(navigator, { title: shareMeta.title, text: buildShareMessage(shareMeta), url: shareMeta.url });
        showStatus("已打开分享菜单");
        onClose();
        return;
      }
      await copyLink(fallbackMessage);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      await copyLink(fallbackMessage);
    }
  }

  async function handleTarget(targetId: ShareTargetId) {
    if (targetId === "native") {
      await shareNative();
      return;
    }

    if (targetId === "copy") {
      await copyLink();
      return;
    }

    if (targetId === "wechat") {
      await shareNative("微信分享未打开，链接已复制");
      return;
    }

    const href = buildShareHref(targetId, shareMeta);
    if (!href) {
      await copyLink();
      return;
    }

    window.location.assign(href);
    const target = SHARE_TARGETS.find((item) => item.id === targetId);
    showStatus(target ? `正在打开 ${target.label}` : "正在打开分享渠道", "info");
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="分享这份菜单"
      className="absolute inset-0"
      style={{ zIndex: 40 }}
    >
      <button
        aria-label="关闭分享面板"
        onClick={onClose}
        className="absolute inset-0 cursor-pointer"
        style={{ border: "none", background: "var(--overlay)" }}
      />
      <div
        className="absolute left-0 right-0 bottom-0"
        style={{
          maxHeight: "86%",
          overflow: "auto",
          background: "var(--bg)",
          borderTopLeftRadius: "var(--radius-xl)",
          borderTopRightRadius: "var(--radius-xl)",
          boxShadow: "0 -12px 36px rgba(45,45,45,0.18)",
          padding: "16px 16px 18px",
          animation: "fadeSlideUp 0.25s ease-out",
        }}
      >
        <div className="flex items-start gap-3" style={{ marginBottom: 12 }}>
          <div className="flex-1 min-w-0">
            <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 800, color: "var(--ink)", lineHeight: 1.15 }}>
              分享这份菜单
            </div>
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--muted)", lineHeight: 1.5, marginTop: 5 }}>
              发到群聊或私聊，朋友不用登录，点开就能一起看菜。
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="关闭"
            className="inline-flex items-center justify-center"
            style={{ width: 34, height: 34, borderRadius: "50%", border: "none", background: "rgba(45,45,45,0.06)", color: "var(--ink)", cursor: "pointer", flexShrink: 0, fontSize: 18, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <div
          className="flex items-center gap-3"
          style={{
            borderRadius: "var(--radius-lg)",
            background: "linear-gradient(135deg, var(--card), rgba(255,240,221,0.9))",
            boxShadow: "var(--shadow)",
            padding: 14,
            marginBottom: 12,
          }}
        >
          <ShareIllustrationIcon targetId="menu" featured />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2" style={{ marginBottom: 7 }}>
              <div style={{ fontFamily: "var(--font-ui)", fontSize: 11, fontWeight: 800, color: "var(--primary)", letterSpacing: 0 }}>
                DISHLENS MENU
              </div>
              <div style={{ fontFamily: "var(--font-ui)", fontSize: 11, fontWeight: 800, color: "var(--accent)", background: "rgba(255,159,28,0.12)", padding: "4px 9px", borderRadius: 20, flexShrink: 0 }}>
                {shareMeta.dishCount || "多"} 道菜
              </div>
            </div>
            <div style={{ fontFamily: "var(--font-body)", fontSize: 16, fontWeight: 850, color: "var(--ink)", marginBottom: 5, lineHeight: 1.25 }}>
              {shareMeta.sourceTitle}
            </div>
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.55, marginBottom: 8 }}>
              {shareMeta.previewDishes.length ? shareMeta.previewDishes.join("、") : "打开后查看菜品列表和详情"}
            </div>
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {shareMeta.url}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2" style={{ marginBottom: 12 }}>
          {mainTargets.map((target) => {
            const featured = target.id === "native";
            return (
              <button
                key={target.id}
                onClick={() => void handleTarget(target.id)}
                className="flex items-center gap-2 text-left transition-all duration-200 active:scale-[0.98]"
                style={{
                  border: featured ? "none" : "1px solid rgba(212,165,116,0.42)",
                  borderRadius: "var(--radius)",
                  background: featured ? "linear-gradient(135deg, var(--primary), var(--primary-soft))" : "rgba(255,240,221,0.82)",
                  color: featured ? "#FFF" : "var(--ink)",
                  padding: 12,
                  minHeight: 82,
                  cursor: "pointer",
                  boxShadow: featured ? "0 10px 22px rgba(76,175,80,0.22)" : "none",
                }}
              >
                <ShareIllustrationIcon targetId={target.id} />
                <span className="min-w-0">
                  <span style={{ display: "block", fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 800 }}>{target.label}</span>
                  <span style={{ display: "block", fontFamily: "var(--font-ui)", fontSize: 12, lineHeight: 1.45, opacity: 0.82 }}>{target.description}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
          <div style={{ fontFamily: "var(--font-ui)", fontSize: 11, fontWeight: 800, color: "var(--muted)", letterSpacing: 0 }}>
            常用 App
          </div>
          <div style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--muted)" }}>
            国内外都能接住
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {channelTargets.map((target) => (
            <button
              key={target.id}
              onClick={() => void handleTarget(target.id)}
              className="flex flex-col items-center justify-center gap-1.5 transition-all duration-200 active:scale-[0.98]"
              style={{
                border: "1px solid rgba(212,165,116,0.48)",
                borderRadius: "var(--radius)",
                background: "rgba(255,240,221,0.68)",
                color: "var(--ink)",
                padding: "10px 6px",
                minHeight: 88,
                cursor: "pointer",
              }}
            >
              <ShareIllustrationIcon targetId={target.id} />
              <span style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 800, lineHeight: 1.15, textAlign: "center" }}>{target.label}</span>
            </button>
          ))}
        </div>

        <div style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--muted)", lineHeight: 1.55, marginTop: 12 }}>
          {localStatus || "点发给朋友或微信会打开原生分享页；其他 App 会打开对应分享页，复制链接后可在聊天里粘贴链接。"}
        </div>
        <div className="sr-only">支持微信、WhatsApp、Telegram、LINE、Facebook、X 和复制链接</div>
        <div className="sr-only">{buildShareMessage(shareMeta)}</div>
      </div>
      {localStatus ? (
        <div
          role="status"
          aria-live="polite"
          className="absolute left-1/2 top-1/2 flex items-center gap-2"
          style={{
            transform: "translate(-50%, -50%)",
            zIndex: 60,
            maxWidth: "calc(100% - 48px)",
            borderRadius: 18,
            background: statusTone === "error" ? "rgba(131,42,42,0.94)" : "rgba(45,45,45,0.92)",
            color: "#FFF",
            boxShadow: "0 16px 36px rgba(45,45,45,0.24)",
            padding: "12px 15px",
            fontFamily: "var(--font-ui)",
            fontSize: 13,
            fontWeight: 800,
            lineHeight: 1.35,
            textAlign: "left",
          }}
        >
          <span
            aria-hidden="true"
            className="inline-flex items-center justify-center"
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: statusTone === "info" ? "rgba(255,183,77,0.22)" : "rgba(76,175,80,0.28)",
              color: statusTone === "info" ? "#FFB74D" : "#B8F0BA",
              flexShrink: 0,
            }}
          >
            {statusTone === "info" ? "…" : "✓"}
          </span>
          <span>{localStatus}</span>
        </div>
      ) : null}
    </div>
  );
}
