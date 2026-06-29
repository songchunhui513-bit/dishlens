import type { RestaurantMeta } from "@/types";

type RestaurantFallback = {
  country: string;
  city: string;
  names: Record<string, string>;
};

const FALLBACK_RESTAURANTS: Record<string, RestaurantFallback> = {
  fr: { country: "法国", city: "巴黎", names: { zh: "巴黎小馆", en: "Le Petit Bistro", ja: "パリ食堂", ko: "파리 비스트로" } },
  it: { country: "意大利", city: "罗马", names: { zh: "罗马小馆", en: "Roma Trattoria", ja: "ローマ食堂", ko: "로마 트라토리아" } },
  es: { country: "西班牙", city: "巴塞罗那", names: { zh: "巴塞罗那小馆", en: "Barcelona Tapas", ja: "バルセロナ食堂", ko: "바르셀로나 타파스" } },
  ja: { country: "日本", city: "东京", names: { zh: "东京小馆", en: "Tokyo Shokudo", ja: "東京食堂", ko: "도쿄 식당" } },
  ko: { country: "韩国", city: "首尔", names: { zh: "首尔小馆", en: "Seoul Kitchen", ja: "ソウル食堂", ko: "서울 식당" } },
  th: { country: "泰国", city: "曼谷", names: { zh: "曼谷小馆", en: "Bangkok Bistro", ja: "バンコク食堂", ko: "방콕 비스트로" } },
  de: { country: "德国", city: "柏林", names: { zh: "柏林小馆", en: "Berlin Stube", ja: "ベルリン食堂", ko: "베를린 슈투베" } },
  zh: { country: "中国", city: "江南", names: { zh: "江南小馆", en: "Jiangnan Kitchen", ja: "江南食堂", ko: "강남 식당" } },
  en: { country: "美国", city: "纽约", names: { zh: "纽约小馆", en: "New York Bistro", ja: "ニューヨーク食堂", ko: "뉴욕 비스트로" } },
};

export function getFallbackRestaurantMeta(sourceLang: string, targetLang = "zh"): RestaurantMeta & { country: string; city: string } {
  const fallback = FALLBACK_RESTAURANTS[sourceLang] || FALLBACK_RESTAURANTS.en;
  const targetName = localizedFallbackName(sourceLang, targetLang);
  const displayName = targetLang === "en" ? fallback.names.en : `${targetName} ${fallback.names.en}`;

  return {
    display_name: displayName,
    restaurant_type: "餐厅",
    rating_estimate: 4.0,
    country: fallback.country,
    city: fallback.city,
  };
}

export function getRestaurantDisplayMeta(
  sourceLang: string,
  targetLang = "zh",
  restaurant?: RestaurantMeta,
): RestaurantMeta & { country: string; city: string } {
  const fallback = getFallbackRestaurantMeta(sourceLang, targetLang);
  const displayName = restaurant?.display_name?.trim();
  if (!displayName) return fallback;
  const shouldUseOriginalOnly = targetLang === "en" || hasCjkText(displayName);
  const localizedDisplayName = shouldUseOriginalOnly
    ? displayName
    : `${localizedFallbackName(sourceLang, targetLang)} ${displayName}`;

  return {
    ...fallback,
    ...restaurant,
    display_name: localizedDisplayName,
    country: fallback.country,
    city: fallback.city,
  };
}

function localizedFallbackName(sourceLang: string, targetLang: string): string {
  const fallback = FALLBACK_RESTAURANTS[sourceLang] || FALLBACK_RESTAURANTS.en;
  return fallback.names[targetLang] || fallback.names.zh;
}

function hasCjkText(value: string): boolean {
  return /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(value);
}
