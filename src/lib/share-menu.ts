import type { Dish, TranslationResult } from "@/types";

export type ShareTargetId =
  | "native"
  | "copy"
  | "wechat"
  | "whatsapp"
  | "telegram"
  | "line"
  | "facebook"
  | "x";

export interface ShareTarget {
  id: ShareTargetId;
  label: string;
  shortLabel: string;
  description: string;
}

export interface ShareMenuMeta {
  taskId: string;
  url: string;
  title: string;
  text: string;
  sourceTitle: string;
  dishCount: number;
  previewDishes: string[];
}

const FALLBACK_APP_ORIGIN = "https://dishlens.wukongmkt.com";

export const SHARE_TARGETS: ShareTarget[] = [
  { id: "native", label: "发给朋友", shortLabel: "SEND", description: "发到聊天里一起看菜" },
  { id: "copy", label: "复制链接", shortLabel: "LINK", description: "适合粘到任何群聊" },
  { id: "wechat", label: "微信", shortLabel: "WX", description: "打开原生分享页" },
  { id: "whatsapp", label: "WhatsApp", shortLabel: "WA", description: "海外旅行常用群聊" },
  { id: "telegram", label: "Telegram", shortLabel: "TG", description: "发给 Telegram 聊天" },
  { id: "line", label: "LINE", shortLabel: "LN", description: "日本、泰国等地区常用" },
  { id: "facebook", label: "Facebook", shortLabel: "FB", description: "分享到动态或社群" },
  { id: "x", label: "X", shortLabel: "X", description: "发到 X / Twitter" },
];

const SOURCE_LANG_NAMES: Record<string, string> = {
  fr: "法语菜单",
  ja: "日语菜单",
  it: "意大利语菜单",
  es: "西班牙语菜单",
  de: "德语菜单",
  ko: "韩语菜单",
  th: "泰语菜单",
  en: "英语菜单",
  zh: "中文菜单",
  pt: "葡语菜单",
  vi: "越南语菜单",
};

function normalizeOrigin(origin?: string): string {
  const raw = origin || process.env.NEXT_PUBLIC_APP_URL || FALLBACK_APP_ORIGIN;
  return raw.replace(/\/+$/, "");
}

export function appShareOrigin(): string {
  return normalizeOrigin();
}

export function sourceTitle(lang?: string): string {
  return SOURCE_LANG_NAMES[lang || ""] || "翻译菜单";
}

export function getDishShareName(dish: Dish): string {
  const translated = dish.name_translated;
  if (typeof translated === "string") return translated;
  return translated?.zh || translated?.en || dish.name_original || "一道菜";
}

export function buildShareMenuMeta(
  result: TranslationResult,
  origin?: string,
  taskId = result.task_id,
): ShareMenuMeta {
  const allDishes = (result.pages || []).flatMap((page) => page.dishes || []);
  const dishCount = result.metadata?.total_dishes || allDishes.length;
  const previewDishes = allDishes.slice(0, 3).map(getDishShareName).filter(Boolean);
  const currentSourceTitle = sourceTitle(result.metadata?.source_language);
  const safeTaskId = encodeURIComponent(taskId || result.task_id || "");
  const url = `${normalizeOrigin(origin)}/share/${safeTaskId}`;
  const previewText = previewDishes.length ? `：${previewDishes.join("、")}` : "";
  const title = `DishLens 分享菜单 · ${dishCount || "多"} 道菜`;
  const text = `朋友分享了一份${currentSourceTitle}${previewText}。点开查看菜品列表和详情。`;

  return {
    taskId: taskId || result.task_id,
    url,
    title,
    text,
    sourceTitle: currentSourceTitle,
    dishCount,
    previewDishes,
  };
}

export function buildShareMessage(meta: ShareMenuMeta): string {
  return `${meta.text}\n${meta.url}`;
}

export function buildShareHref(targetId: ShareTargetId, meta: ShareMenuMeta): string | null {
  const encodedUrl = encodeURIComponent(meta.url);
  const encodedText = encodeURIComponent(meta.text);
  const encodedMessage = encodeURIComponent(buildShareMessage(meta));

  switch (targetId) {
    case "whatsapp":
      return `https://wa.me/?text=${encodedMessage}`;
    case "telegram":
      return `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
    case "line":
      return `https://social-plugins.line.me/lineit/share?url=${encodedUrl}`;
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
    case "x":
      return `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
    case "native":
    case "copy":
    case "wechat":
      return null;
  }
}
