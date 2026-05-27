"use client";

import type { ShareMenuMeta, ShareTargetId } from "@/lib/share-menu";
import { buildShareHref, buildShareMessage, SHARE_TARGETS } from "@/lib/share-menu";
import { useState, type CSSProperties } from "react";

interface ShareSheetProps {
  open: boolean;
  meta: ShareMenuMeta | null;
  onClose: () => void;
  onStatus?: (message: string) => void;
}

const roundStroke: CSSProperties = { strokeLinecap: "round", strokeLinejoin: "round" };

function ShareIllustrationIcon({ targetId, featured = false }: { targetId: ShareTargetId; featured?: boolean }) {
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
        {targetId === "native" ? (
          <>
            <ellipse cx="42" cy="70" rx="26" ry="6" fill="#FEE6CB" stroke="#D4A574" strokeWidth="2" />
            <path d="M24 57 Q42 68 60 57 L56 68 Q42 76 28 68Z" fill="#FFF5E9" stroke="#D4A574" strokeWidth="2.3" />
            <circle cx="39" cy="52" r="5" fill="#FFB74D" style={{ animation: "cherryBob 1.8s ease-in-out infinite" }} />
            <path d="M51 52 q8 2 12-4" stroke="#4CAF50" strokeWidth="3" fill="none" style={roundStroke} />
            <path d="M55 30 L77 22 L69 56 L61 43 L47 50Z" fill="#4CAF50" stroke="#2F8F45" strokeWidth="2.3" style={roundStroke} />
            <circle cx="24" cy="27" r="3" fill="#FF9F1C" style={{ animation: "sparkleA 2s ease-out infinite .3s" }} />
          </>
        ) : null}
        {targetId === "copy" ? (
          <>
            <rect x="24" y="23" width="38" height="48" rx="9" fill="#FFF5E9" stroke="#D4A574" strokeWidth="2.4" />
            <path d="M34 36 h19 M34 47 h14 M34 58 h18" stroke="#C49660" strokeWidth="2.2" style={roundStroke} />
            <path d="M56 39 q6-6 12 0 q6 6 0 12 l-5 5 q-6 6-12 0" fill="none" stroke="#4CAF50" strokeWidth="4" style={roundStroke} />
            <path d="M46 57 q-6 6-12 0 q-6-6 0-12 l5-5 q6-6 12 0" fill="none" stroke="#FF9F1C" strokeWidth="4" style={roundStroke} />
            <circle cx="67" cy="25" r="3" fill="#4CAF50" style={{ animation: "sparkleA 2.1s ease-out infinite" }} />
          </>
        ) : null}
        {targetId === "wechat" ? (
          <>
            <ellipse cx="40" cy="64" rx="24" ry="6" fill="#E8D5C0" opacity="0.45" />
            <path d="M20 44 q0-18 22-18 q22 0 22 18 q0 17-22 17 q-4 0-8-.9 l-11 6 l4-10 q-7-5-7-12Z" fill="#7ED36D" stroke="#3CA94E" strokeWidth="2.3" />
            <path d="M44 51 q0-15 18-15 q17 0 17 15 q0 13-17 13 q-3 0-6-.6 l-8 5 l3-8 q-7-4-7-9.4Z" fill="#F6FFE9" stroke="#4CAF50" strokeWidth="2.1" />
            <circle cx="36" cy="43" r="2.7" fill="#2D2D2D" />
            <circle cx="48" cy="43" r="2.7" fill="#2D2D2D" />
            <circle cx="58" cy="51" r="2.2" fill="#2D2D2D" />
            <circle cx="68" cy="51" r="2.2" fill="#2D2D2D" />
          </>
        ) : null}
        {targetId === "whatsapp" ? (
          <>
            <circle cx="48" cy="48" r="28" fill="#5BD36A" stroke="#2FA84A" strokeWidth="2.5" />
            <path d="M29 71 l4-13 q-4-6-4-12 q0-18 19-18 q19 0 19 18 q0 19-19 19 q-6 0-11-3Z" fill="#F6FFE9" stroke="#2FA84A" strokeWidth="2.4" style={roundStroke} />
            <path d="M40 38 q5 14 18 19 q4-2 6-6 l-7-5 l-4 4 q-6-3-9-9 l4-4 l-5-7 q-4 2-3 8Z" fill="#4CAF50" />
          </>
        ) : null}
        {targetId === "telegram" ? (
          <>
            <ellipse cx="48" cy="69" rx="24" ry="6" fill="#D5EAFE" />
            <path d="M18 44 L78 20 L66 74 L50 59 L39 68 L41 53Z" fill="#49A4E8" stroke="#2677B8" strokeWidth="2.3" style={roundStroke} />
            <path d="M41 53 L78 20 L50 59" fill="none" stroke="#DDF4FF" strokeWidth="2.3" style={roundStroke} />
            <circle cx="27" cy="24" r="3" fill="#FFB74D" style={{ animation: "sparkleA 2.2s ease-out infinite .4s" }} />
          </>
        ) : null}
        {targetId === "line" ? (
          <>
            <path d="M19 45 q0-22 29-22 q29 0 29 22 q0 21-29 21 q-5 0-10-.9 L27 73 l4-12 q-12-6-12-16Z" fill="#72D96A" stroke="#39A94C" strokeWidth="2.5" style={roundStroke} />
            <path d="M35 44 h24 M35 52 h17" stroke="#F6FFE9" strokeWidth="5" style={roundStroke} />
            <circle cx="32" cy="31" r="3" fill="#FFB74D" style={{ animation: "sparkleA 2.1s ease-out infinite .2s" }} />
          </>
        ) : null}
        {targetId === "facebook" ? (
          <>
            <rect x="24" y="20" width="48" height="54" rx="16" fill="#4D8CE8" stroke="#2B65B8" strokeWidth="2.4" />
            <path d="M53 74 V48 h9 l2-11 h-11 v-6 q0-5 6-5 h5 V16 q-4-.7-9-.7 q-15 0-15 15 V37 h-9 v11 h9 v26Z" fill="#FFF5E9" />
            <ellipse cx="47" cy="78" rx="22" ry="5" fill="#D5EAFE" />
          </>
        ) : null}
        {targetId === "x" ? (
          <>
            <rect x="22" y="22" width="52" height="52" rx="17" fill="#2D2D2D" stroke="#111" strokeWidth="2.4" />
            <path d="M34 34 l28 28 M62 34 L34 62" stroke="#FFF5E9" strokeWidth="8" style={roundStroke} />
            <circle cx="70" cy="24" r="3" fill="#FF9F1C" style={{ animation: "sparkleA 2s ease-out infinite .3s" }} />
          </>
        ) : null}
      </svg>
    </span>
  );
}

export default function ShareSheet({ open, meta, onClose, onStatus }: ShareSheetProps) {
  const [localStatus, setLocalStatus] = useState("");

  if (!open || !meta) return null;
  const shareMeta: ShareMenuMeta = meta;

  const mainTargets = SHARE_TARGETS.filter((target) => target.id === "native" || target.id === "copy");
  const channelTargets = SHARE_TARGETS.filter((target) => target.id !== "native" && target.id !== "copy");

  function showStatus(message: string) {
    setLocalStatus(message);
    onStatus?.(message);
    window.setTimeout(() => setLocalStatus(""), 1800);
  }

  async function copyLink(message = "菜单链接已复制") {
    try {
      await navigator.clipboard.writeText(shareMeta.url);
      showStatus(message);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = shareMeta.url;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);
      showStatus(copied ? message : "复制失败，请长按链接手动复制");
    }
  }

  async function shareNative(fallbackMessage = "浏览器无法打开分享菜单，链接已复制") {
    try {
      const nativeShare = navigator.share as ((data: ShareData) => Promise<void>) | undefined;
      if (nativeShare) {
        await nativeShare.call(navigator, { title: shareMeta.title, text: shareMeta.text, url: shareMeta.url });
        showStatus("已打开分享菜单");
        onClose();
        return;
      }
      await copyLink(fallbackMessage);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      await copyLink("分享未完成，链接已复制");
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
      const nativeShare = navigator.share as ((data: ShareData) => Promise<void>) | undefined;
      if (nativeShare) {
        await shareNative("链接已复制，可粘贴到微信/微信群");
      } else {
        await copyLink("链接已复制，可粘贴到微信/微信群");
      }
      return;
    }

    const href = buildShareHref(targetId, shareMeta);
    if (!href) {
      await copyLink();
      return;
    }

    window.open(href, "_blank", "noopener,noreferrer");
    const target = SHARE_TARGETS.find((item) => item.id === targetId);
    showStatus(target ? `已打开 ${target.label}` : "已打开分享渠道");
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
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 9, color: "var(--muted)", lineHeight: 1.5, marginTop: 4 }}>
              发到群聊或私聊，对方点开链接就能一起看菜。
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
          <ShareIllustrationIcon targetId="native" featured />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2" style={{ marginBottom: 7 }}>
              <div style={{ fontFamily: "var(--font-ui)", fontSize: 8, fontWeight: 800, color: "var(--primary)", letterSpacing: "0.04em" }}>
                DISHLENS MENU
              </div>
              <div style={{ fontFamily: "var(--font-ui)", fontSize: 8, fontWeight: 800, color: "var(--accent)", background: "rgba(255,159,28,0.12)", padding: "3px 8px", borderRadius: 20, flexShrink: 0 }}>
                {shareMeta.dishCount || "多"} 道菜
              </div>
            </div>
            <div style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 800, color: "var(--ink)", marginBottom: 4 }}>
              {shareMeta.sourceTitle}
            </div>
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 9, color: "var(--ink-soft)", lineHeight: 1.55, marginBottom: 7 }}>
              {shareMeta.previewDishes.length ? shareMeta.previewDishes.join("、") : "打开后查看菜品列表和详情"}
            </div>
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 8, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
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
                  padding: 10,
                  minHeight: 72,
                  cursor: "pointer",
                  boxShadow: featured ? "0 10px 22px rgba(76,175,80,0.22)" : "none",
                }}
              >
                <ShareIllustrationIcon targetId={target.id} />
                <span className="min-w-0">
                  <span style={{ display: "block", fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 800 }}>{target.label}</span>
                  <span style={{ display: "block", fontFamily: "var(--font-ui)", fontSize: 7.5, lineHeight: 1.35, opacity: 0.82 }}>{target.description}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
          <div style={{ fontFamily: "var(--font-ui)", fontSize: 8, fontWeight: 800, color: "var(--muted)", letterSpacing: "0.06em" }}>
            常用 App
          </div>
          <div style={{ fontFamily: "var(--font-ui)", fontSize: 8, color: "var(--muted)" }}>
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
              <span style={{ fontFamily: "var(--font-body)", fontSize: 9, fontWeight: 800, lineHeight: 1.15, textAlign: "center" }}>{target.label}</span>
            </button>
          ))}
        </div>

        <div style={{ fontFamily: "var(--font-ui)", fontSize: 8, color: "var(--muted)", lineHeight: 1.55, marginTop: 12 }}>
          {localStatus || "微信无法从普通网页直接发群时，会自动复制链接；粘贴到聊天窗口即可。"}
        </div>
        <div className="sr-only">支持微信、WhatsApp、Telegram、LINE、Facebook、X 和复制链接</div>
        <div className="sr-only">{buildShareMessage(shareMeta)}</div>
      </div>
    </div>
  );
}
