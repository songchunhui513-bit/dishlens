import type { HistoryEntry } from "@/types";
import { getDishImageUrl } from "@/lib/dish-presentation";
import { getRestaurantDisplayMeta } from "@/lib/restaurant-display";
import { resolveRegionLandmark, type RegionLandmarkKey } from "@/lib/region-landmarks";
import { isSafeStoredThumbnail } from "@/lib/safe-image-url";

export interface RecentMenuRecord {
  id: string;
  restaurantName: string;
  sourceLang: string;
  targetLang: string;
  sourceLabel: string;
  targetLabel: string;
  dishCount: number;
  pageCount: number;
  timeLabel: string;
  summary: string;
  thumbnails: string[];
  landmarkKey: RegionLandmarkKey;
}

const TARGET_LANGUAGE_LABELS: Record<string, string> = {
  zh: "中文",
  en: "EN",
  ja: "日本語",
  ko: "한국어",
  fr: "FR",
  it: "IT",
  de: "DE",
  es: "ES",
};

const SOURCE_LANGUAGE_LABELS: Record<string, string> = {
  fr: "FR",
  it: "IT",
  ja: "JA",
  ko: "KO",
  th: "TH",
  de: "DE",
  es: "ES",
  zh: "中文",
  en: "EN",
  hi: "HI",
  vi: "VI",
  tr: "TR",
  pt: "PT",
};

const DEFAULT_RECORDS: RecentMenuRecord[] = [
  {
    id: "",
    restaurantName: "Roma Trattoria",
    sourceLang: "it",
    targetLang: "zh",
    sourceLabel: "IT",
    targetLabel: "中文",
    dishCount: 17,
    pageCount: 1,
    timeLabel: "示例",
    summary: "含披萨、主菜、甜点",
    thumbnails: [
      "/dishes/pizza-margherita.png",
      "/dishes/steak-frites-hero.jpg",
      "/dishes/creme-brulee.png",
    ],
    landmarkKey: "it",
  },
  {
    id: "",
    restaurantName: "Le Petit Bistro",
    sourceLang: "fr",
    targetLang: "zh",
    sourceLabel: "FR",
    targetLabel: "中文",
    dishCount: 9,
    pageCount: 1,
    timeLabel: "示例",
    summary: "含前菜、主菜、甜点",
    thumbnails: [],
    landmarkKey: "fr",
  },
  {
    id: "",
    restaurantName: "Tokyo Shokudo",
    sourceLang: "ja",
    targetLang: "zh",
    sourceLabel: "JA",
    targetLabel: "中文",
    dishCount: 12,
    pageCount: 1,
    timeLabel: "示例",
    summary: "含寿司、拉面、定食",
    thumbnails: [],
    landmarkKey: "ja",
  },
];

export function getDefaultRecentMenuRecords(): RecentMenuRecord[] {
  return DEFAULT_RECORDS;
}

function getStoredDishImageUrl(dish: NonNullable<HistoryEntry["result_summary"]>["pages"][number]["dishes"][number]): string {
  return dish.ai_image_url || (dish as { image_url?: string }).image_url || "";
}

export function pickSafeMenuThumbnail(entry: Pick<HistoryEntry, "thumbnail" | "result_summary">): string {
  const pages = entry.result_summary?.pages || [];
  const dishes = pages.flatMap((page) => page.dishes || []);
  return [
    entry.thumbnail,
    ...dishes.map((dish) => getStoredDishImageUrl(dish)),
    ...dishes.map((dish) => getDishImageUrl(dish)),
  ].find((url): url is string => typeof url === "string" && isSafeStoredThumbnail(url)) || "";
}

export function buildRecentMenuRecords(
  entries: HistoryEntry[],
  options: { targetLang?: string; now?: Date } = {},
): RecentMenuRecord[] {
  const now = options.now || new Date();
  return entries
    .filter((entry) => entry.result_summary?.pages?.some((page) => page.dishes?.length))
    .map((entry) => {
      const result = entry.result_summary;
      const pages = result?.pages || [];
      const dishes = pages.flatMap((page) => page.dishes || []);
      const sourceLang = entry.source_lang || result?.metadata?.source_language || "";
      const targetLang = entry.target_lang || result?.metadata?.target_language || options.targetLang || "zh";
      const restaurantMeta = getRestaurantDisplayMeta(sourceLang, targetLang, result?.metadata?.restaurant);
      const restaurantName = resolveRestaurantName(entry.restaurant_name, sourceLang, restaurantMeta.display_name);
      const thumbnails = Array.from(
        new Set([
          pickSafeMenuThumbnail(entry),
          ...dishes.map((dish) => getDishImageUrl(dish)).filter(Boolean),
        ].filter((url): url is string => typeof url === "string" && isSafeStoredThumbnail(url))),
      ).slice(0, 3);
      const landmark = resolveRegionLandmark({
        sourceLang,
        country: entry.city || restaurantMeta.country,
        cuisine: result?.metadata?.insight?.cuisine_style,
        restaurantName,
      });

      return {
        id: entry.id,
        restaurantName,
        sourceLang,
        targetLang,
        sourceLabel: languageLabel(sourceLang, "source"),
        targetLabel: languageLabel(targetLang, "target"),
        dishCount: entry.dish_count || result?.metadata?.total_dishes || dishes.length,
        pageCount: entry.page_count || pages.length,
        timeLabel: formatRecentTime(entry.date, now),
        summary: summarizeMenuContent(pages),
        thumbnails,
        landmarkKey: landmark.key,
      };
    })
    .slice(0, 8);
}

function resolveRestaurantName(entryName: string, sourceLang: string, fallbackName: string): string {
  const legacyNames = [`${sourceLanguageName(sourceLang)}菜单`, "菜单翻译"];
  const isLegacy = legacyNames.includes(entryName) || /^翻译 #[a-z0-9]+$/i.test(entryName || "");
  return entryName && !isLegacy ? entryName : fallbackName;
}

function summarizeMenuContent(pages: NonNullable<HistoryEntry["result_summary"]>["pages"]): string {
  const labels = Array.from(new Set(
    pages
      .flatMap((page) => page.dishes || [])
      .map((dish) => dish.category || dish.cuisine_region || "")
      .filter(Boolean)
      .map((value) => CATEGORY_LABELS[value] || value),
  ));
  if (labels.length === 0) return "菜单记录";
  return `含${labels.slice(0, 3).join("、")}`;
}

function formatRecentTime(value: string, now: Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = now.getTime() - date.getTime();
  const day = 24 * 60 * 60 * 1000;
  if (diff >= 0 && diff < day) return "今天";
  if (diff >= day && diff < day * 2) return "昨天";
  return date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

function languageLabel(value: string, type: "source" | "target"): string {
  const normalized = value.trim().toLowerCase().replace(/^([a-z]{2})[-_].*$/, "$1");
  if (type === "target") return TARGET_LANGUAGE_LABELS[normalized] || normalized.toUpperCase();
  return SOURCE_LANGUAGE_LABELS[normalized] || normalized.toUpperCase();
}

function sourceLanguageName(lang: string): string {
  const names: Record<string, string> = {
    fr: "法国",
    it: "意大利",
    ja: "日本",
    de: "德国",
    es: "西班牙",
    th: "泰国",
    ko: "韩国",
    en: "英文",
    zh: "中文",
  };
  return names[lang] || lang.toUpperCase();
}

const CATEGORY_LABELS: Record<string, string> = {
  appetizer: "前菜",
  main: "主菜",
  staple: "主食",
  dessert: "甜点",
  drink: "饮品",
  soup: "汤品",
  bread: "面包",
  side: "配菜",
  snack: "小食",
  noodle: "面食",
  rice: "米饭",
  pasta: "意面",
  stew: "炖菜",
};
