export const SUPPORTED_TARGET_LANGS = ["zh", "en", "ja", "ko"] as const;

export type TargetLang = (typeof SUPPORTED_TARGET_LANGS)[number];

export const TARGET_LANGUAGE_LABELS: Record<TargetLang, { native: string; zh: string; en: string; prompt: string }> = {
  zh: { native: "中文", zh: "中文", en: "Chinese", prompt: "Chinese (中文)" },
  en: { native: "English", zh: "英语", en: "English", prompt: "English" },
  ja: { native: "日本語", zh: "日语", en: "Japanese", prompt: "Japanese (日本語)" },
  ko: { native: "한국어", zh: "韩语", en: "Korean", prompt: "Korean (한국어)" },
};

export function normalizeTargetLang(value: unknown): TargetLang {
  return SUPPORTED_TARGET_LANGS.includes(value as TargetLang) ? (value as TargetLang) : "zh";
}

export function targetLanguageName(value: unknown, uiLang: "zh" | "en" = "zh"): string {
  const lang = normalizeTargetLang(value);
  return uiLang === "en" ? TARGET_LANGUAGE_LABELS[lang].en : TARGET_LANGUAGE_LABELS[lang].zh;
}

export function targetLanguageNativeName(value: unknown): string {
  return TARGET_LANGUAGE_LABELS[normalizeTargetLang(value)].native;
}

