"use client";

import { useState } from "react";
import type { UserSettings } from "@/types";
import { TARGET_LANGUAGE_LABELS } from "@/lib/languages";

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

const settingsCopy = {
  zh: {
    title: "设置",
    languageGroup: "语言偏好",
    targetLang: "翻译目标语言",
    targetLangSub: "菜单翻译显示的语言",
    uiLang: "界面语言",
    uiLangSub: "应用显示语言",
    dietaryGroup: "饮食偏好",
    allergens: "显示过敏原标注",
    allergensSub: "在菜品卡片中高亮过敏原",
    allergensNote: "开启后，含过敏原的菜品以橙色标签高亮，结果页顶部显示过敏原提示条，详情页显示具体过敏物警告。支持：麸质、乳制品、坚果、甲壳类、酒精、亚硫酸盐。",
    veg: "素食优先提示",
    vegSub: "标记适合素食者的菜品",
    vegNote: "开启后，素食菜品图片右下角显示绿色叶片标识，卡片增加「素食友好」绿色标签，方便快速识别可食用菜品。",
    glutenFree: "无麸质优先",
    glutenFreeSub: "优先显示无麸质菜品",
    aboutGroup: "关于",
    version: "版本",
    privacy: "隐私政策",
    view: "查看 →",
    on: "开启",
    off: "关闭",
  },
  en: {
    title: "Settings",
    languageGroup: "Language",
    targetLang: "Translation language",
    targetLangSub: "Language used for translated menu text",
    uiLang: "Interface language",
    uiLangSub: "Language used for app controls",
    dietaryGroup: "Dietary preferences",
    allergens: "Show allergen labels",
    allergensSub: "Highlight allergens on dish cards",
    allergensNote: "When enabled, dishes with allergens are highlighted with a warm label, with reminders on the result and detail pages. Supports gluten, dairy, nuts, shellfish, alcohol, and sulfites.",
    veg: "Vegetarian hints",
    vegSub: "Mark dishes suitable for vegetarians",
    vegNote: "When enabled, vegetarian dishes show a green leaf marker and a vegetarian-friendly tag for quick scanning.",
    glutenFree: "Gluten-free first",
    glutenFreeSub: "Prioritize gluten-free dishes",
    aboutGroup: "About",
    version: "Version",
    privacy: "Privacy policy",
    view: "View →",
    on: "On",
    off: "Off",
  },
};

export default function SettingsPage({ onBack, settings, onChange }: SettingsPageProps) {
  const [s, setS] = useState<UserSettings>(settings || defaultSettings);
  const copy = settingsCopy[s.uiLang];

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
          {copy.title}
        </h2>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto" style={{ padding: "14px 16px" }}>
        {/* Group 1: Language */}
        <div style={{ marginBottom: 20 }}>
          <div className="uppercase" style={{ fontFamily: "var(--font-body)", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 8, paddingLeft: 2 }}>
            {copy.languageGroup}
          </div>

          <SettingRow label={copy.targetLang} sublabel={copy.targetLangSub} last={false}>
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
              <option value="zh">{TARGET_LANGUAGE_LABELS.zh.native}</option>
              <option value="en">{TARGET_LANGUAGE_LABELS.en.native}</option>
              <option value="ja">{TARGET_LANGUAGE_LABELS.ja.native}</option>
              <option value="ko">{TARGET_LANGUAGE_LABELS.ko.native}</option>
            </select>
          </SettingRow>

          <SettingRow label={copy.uiLang} sublabel={copy.uiLangSub} last={true}>
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
            {copy.dietaryGroup}
          </div>

          <SettingRow label={copy.allergens} sublabel={copy.allergensSub} last={false}>
            <Toggle active={s.showAllergens} onToggle={(v) => update({ showAllergens: v })} onLabel={copy.on} offLabel={copy.off} />
          </SettingRow>
          {s.showAllergens && (
            <EffectNote>
              {copy.allergensNote}
            </EffectNote>
          )}

          <SettingRow label={copy.veg} sublabel={copy.vegSub} last={false}>
            <Toggle active={s.showVeg} onToggle={(v) => update({ showVeg: v })} onLabel={copy.on} offLabel={copy.off} />
          </SettingRow>
          {s.showVeg && (
            <EffectNote>
              {copy.vegNote}
            </EffectNote>
          )}

          <SettingRow label={copy.glutenFree} sublabel={copy.glutenFreeSub} last={true}>
            <Toggle active={s.showGlutenFree} onToggle={(v) => update({ showGlutenFree: v })} onLabel={copy.on} offLabel={copy.off} />
          </SettingRow>
        </div>

        {/* Group 3: About */}
        <div style={{ marginBottom: 20 }}>
          <div className="uppercase" style={{ fontFamily: "var(--font-body)", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 8, paddingLeft: 2 }}>
            {copy.aboutGroup}
          </div>

          <SettingRow label={copy.version} last={false}>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 9, color: "var(--muted)" }}>v7.0.0</span>
          </SettingRow>

          <SettingRow label={copy.privacy} last={true}>
            <span style={{ fontSize: 10, color: "var(--primary)", cursor: "pointer" }}>{copy.view}</span>
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

function Toggle({ active, onToggle, onLabel = "开启", offLabel = "关闭" }: { active: boolean; onToggle: (v: boolean) => void; onLabel?: string; offLabel?: string }) {
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
      aria-label={active ? onLabel : offLabel}
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
