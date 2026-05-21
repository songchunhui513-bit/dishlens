"use client";

import { useState } from "react";

interface UserSettings {
  targetLang: string;
  uiLang: "zh" | "en";
  showAllergens: boolean;
  showVeg: boolean;
  showGlutenFree: boolean;
}

interface SettingsPageProps {
  onBack: () => void;
  settings?: UserSettings;
  onChange?: (s: UserSettings) => void;
}

const defaultSettings: UserSettings = {
  targetLang: "zh",
  uiLang: "zh",
  showAllergens: false,
  showVeg: false,
  showGlutenFree: false,
};

export default function SettingsPage({ onBack, settings, onChange }: SettingsPageProps) {
  const [s, setS] = useState<UserSettings>(settings || defaultSettings);

  const update = (patch: Partial<UserSettings>) => {
    const next = { ...s, ...patch };
    setS(next);
    onChange?.(next);
  };

  return (
    <div className="h-full flex flex-col" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0" style={{ borderBottom: "1px solid var(--rule)" }}>
        <button
          onClick={onBack}
          className="text-[11px] cursor-pointer transition-opacity hover:opacity-50"
          style={{ color: "var(--ink)", background: "none", border: "none" }}
        >
          ←
        </button>
        <h2 style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
          设置
        </h2>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto" style={{ padding: "14px 16px" }}>
        {/* Group 1: Language */}
        <div style={{ marginBottom: 20 }}>
          <div className="uppercase" style={{ fontFamily: "var(--font-body)", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 8, paddingLeft: 2 }}>
            语言偏好
          </div>

          <SettingRow label="翻译目标语言" sublabel="菜单翻译显示的语言" last={false}>
            <select
              value={s.targetLang}
              onChange={(e) => update({ targetLang: e.target.value })}
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: 9,
                padding: "4px 8px",
                borderRadius: 6,
                border: "1px solid var(--rule)",
                background: "var(--bg)",
                color: "var(--ink)",
              }}
            >
              <option value="zh">中文</option>
              <option value="en">English</option>
              <option value="ja">日本語</option>
              <option value="ko">한국어</option>
            </select>
          </SettingRow>

          <SettingRow label="界面语言" sublabel="应用显示语言" last={true}>
            <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--rule)" }}>
              <button
                onClick={() => update({ uiLang: "zh" })}
                className="transition-colors"
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: 9,
                  fontWeight: 600,
                  padding: "4px 10px",
                  border: "none",
                  background: s.uiLang === "zh" ? "var(--ink)" : "transparent",
                  color: s.uiLang === "zh" ? "#FFF" : "var(--muted)",
                  cursor: "pointer",
                }}
              >
                中文
              </button>
              <button
                onClick={() => update({ uiLang: "en" })}
                className="transition-colors"
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: 9,
                  fontWeight: 600,
                  padding: "4px 10px",
                  border: "none",
                  background: s.uiLang === "en" ? "var(--ink)" : "transparent",
                  color: s.uiLang === "en" ? "#FFF" : "var(--muted)",
                  cursor: "pointer",
                }}
              >
                EN
              </button>
            </div>
          </SettingRow>
        </div>

        {/* Group 2: Dietary */}
        <div style={{ marginBottom: 20 }}>
          <div className="uppercase" style={{ fontFamily: "var(--font-body)", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 8, paddingLeft: 2 }}>
            饮食偏好
          </div>

          <SettingRow label="显示过敏原标注" sublabel="在菜品卡片中高亮过敏原" last={false}>
            <Toggle active={s.showAllergens} onToggle={(v) => update({ showAllergens: v })} />
          </SettingRow>
          {s.showAllergens && (
            <EffectNote>
              开启后，含过敏原的菜品以橙色 ⚠ 标签高亮，结果页顶部显示过敏原提示条，详情页显示具体过敏物警告。支持：麸质、乳制品、坚果、甲壳类、酒精、亚硫酸盐。
            </EffectNote>
          )}

          <SettingRow label="素食优先提示" sublabel="标记适合素食者的菜品" last={false}>
            <Toggle active={s.showVeg} onToggle={(v) => update({ showVeg: v })} />
          </SettingRow>
          {s.showVeg && (
            <EffectNote>
              开启后，素食菜品图片右下角显示绿色叶片标识，卡片增加「素食友好」绿色标签，方便快速识别可食用菜品。
            </EffectNote>
          )}

          <SettingRow label="无麸质优先" sublabel="优先显示无麸质菜品" last={true}>
            <Toggle active={s.showGlutenFree} onToggle={(v) => update({ showGlutenFree: v })} />
          </SettingRow>
        </div>

        {/* Group 3: About */}
        <div style={{ marginBottom: 20 }}>
          <div className="uppercase" style={{ fontFamily: "var(--font-body)", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 8, paddingLeft: 2 }}>
            关于
          </div>

          <SettingRow label="版本" last={false}>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 9, color: "var(--muted)" }}>v7.0.0</span>
          </SettingRow>

          <SettingRow label="隐私政策" last={true}>
            <span style={{ fontSize: 10, color: "var(--primary)", cursor: "pointer" }}>查看 →</span>
          </SettingRow>
        </div>
      </div>
    </div>
  );
}

// ── Setting Row ─────────────────────────────────────────────────────

function SettingRow({
  label,
  sublabel,
  children,
  last,
}: {
  label: string;
  sublabel?: string;
  children: React.ReactNode;
  last: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between"
      style={{
        padding: "12px 14px",
        background: "var(--card)",
        borderRadius: "var(--radius)",
        marginBottom: last ? 0 : 6,
        boxShadow: "var(--shadow)",
      }}
    >
      <div>
        <div style={{ fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 600, color: "var(--ink)" }}>
          {label}
        </div>
        {sublabel && (
          <div style={{ fontFamily: "var(--font-ui)", fontSize: 8, color: "var(--muted)", marginTop: 1 }}>
            {sublabel}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Toggle Switch ───────────────────────────────────────────────────

function Toggle({ active, onToggle }: { active: boolean; onToggle: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onToggle(!active)}
      className="relative flex-shrink-0 transition-colors duration-200"
      style={{
        width: 40,
        height: 24,
        borderRadius: 12,
        background: active ? "var(--primary)" : "var(--rule)",
        border: "none",
        cursor: "pointer",
        padding: 0,
        marginLeft: 14,
      }}
      aria-label={active ? "开启" : "关闭"}
    >
      <div
        className="absolute rounded-full transition-transform duration-200"
        style={{
          width: 20,
          height: 20,
          top: 2,
          left: 2,
          background: "#FFF",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          transform: active ? "translateX(16px)" : "translateX(0)",
        }}
      />
    </button>
  );
}

// ── Effect Note ─────────────────────────────────────────────────────

function EffectNote({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-ui)",
        fontSize: 8,
        fontWeight: 500,
        fontStyle: "italic",
        color: "var(--primary)",
        padding: "8px 14px",
        marginBottom: 6,
        background: "rgba(76,175,80,0.04)",
        borderRadius: "var(--radius-sm)",
        lineHeight: 1.5,
        animation: "fadeSlideUp 0.3s ease-out",
      }}
    >
      {children}
    </div>
  );
}
