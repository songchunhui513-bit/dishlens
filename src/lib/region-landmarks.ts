export type RegionLandmarkKey =
  | "fr"
  | "it"
  | "ja"
  | "zh"
  | "ko"
  | "th"
  | "de"
  | "es"
  | "en"
  | "in"
  | "mx"
  | "vn"
  | "tr"
  | "gr"
  | "br"
  | "international";

export type RegionLandmark = {
  key: RegionLandmarkKey;
  labelZh: string;
  labelEn: string;
  landmarkZh: string;
  landmarkEn: string;
};

const LANDMARKS: Record<RegionLandmarkKey, RegionLandmark> = {
  fr: { key: "fr", labelZh: "法国", labelEn: "France", landmarkZh: "埃菲尔铁塔", landmarkEn: "Eiffel Tower" },
  it: { key: "it", labelZh: "意大利", labelEn: "Italy", landmarkZh: "比萨斜塔", landmarkEn: "Tower of Pisa" },
  ja: { key: "ja", labelZh: "日本", labelEn: "Japan", landmarkZh: "鸟居", landmarkEn: "Torii Gate" },
  zh: { key: "zh", labelZh: "中国", labelEn: "China", landmarkZh: "天坛", landmarkEn: "Temple of Heaven" },
  ko: { key: "ko", labelZh: "韩国", labelEn: "Korea", landmarkZh: "韩屋门楼", landmarkEn: "Hanok Gate" },
  th: { key: "th", labelZh: "泰国", labelEn: "Thailand", landmarkZh: "泰式寺塔", landmarkEn: "Thai Temple" },
  de: { key: "de", labelZh: "德国", labelEn: "Germany", landmarkZh: "勃兰登堡门", landmarkEn: "Brandenburg Gate" },
  es: { key: "es", labelZh: "西班牙", labelEn: "Spain", landmarkZh: "圣家堂", landmarkEn: "Sagrada Familia" },
  en: { key: "en", labelZh: "美国", labelEn: "United States", landmarkZh: "自由女神像", landmarkEn: "Statue of Liberty" },
  in: { key: "in", labelZh: "印度", labelEn: "India", landmarkZh: "泰姬陵", landmarkEn: "Taj Mahal" },
  mx: { key: "mx", labelZh: "墨西哥", labelEn: "Mexico", landmarkZh: "玛雅金字塔", landmarkEn: "Mayan Pyramid" },
  vn: { key: "vn", labelZh: "越南", labelEn: "Vietnam", landmarkZh: "会安来远桥", landmarkEn: "Japanese Covered Bridge" },
  tr: { key: "tr", labelZh: "土耳其", labelEn: "Turkey", landmarkZh: "蓝色清真寺", landmarkEn: "Blue Mosque" },
  gr: { key: "gr", labelZh: "希腊", labelEn: "Greece", landmarkZh: "帕特农神庙", landmarkEn: "Parthenon" },
  br: { key: "br", labelZh: "巴西", labelEn: "Brazil", landmarkZh: "基督像", landmarkEn: "Christ Statue" },
  international: { key: "international", labelZh: "国际", labelEn: "International", landmarkZh: "环球地标", landmarkEn: "Global Landmark" },
};

const LANGUAGE_TO_REGION: Record<string, RegionLandmarkKey> = {
  fr: "fr",
  it: "it",
  ja: "ja",
  jp: "ja",
  zh: "zh",
  cn: "zh",
  ko: "ko",
  kr: "ko",
  th: "th",
  de: "de",
  es: "es",
  en: "en",
  hi: "in",
  in: "in",
  mx: "mx",
  vi: "vn",
  vn: "vn",
  tr: "tr",
  el: "gr",
  gr: "gr",
  pt: "br",
  br: "br",
};

const CUISINE_TO_REGION: Array<[RegExp, RegionLandmarkKey]> = [
  [/法式|法国|french|france|paris|bistro/i, "fr"],
  [/意式|意大利|披萨|比萨|pizza|pasta|italian|italy|roma|trattoria|pizzeria/i, "it"],
  [/日式|日本|寿司|拉面|sushi|ramen|japanese|japan|tokyo/i, "ja"],
  [/中式|中国|川菜|粤菜|江南|chinese|china|sichuan|cantonese/i, "zh"],
  [/韩式|韩国|korean|korea|seoul|kimchi/i, "ko"],
  [/泰式|泰国|thai|thailand|bangkok/i, "th"],
  [/德式|德国|german|germany|berlin|stube/i, "de"],
  [/西班牙|spanish|spain|tapas|barcelona/i, "es"],
  [/美式|美国|burger|american|usa|new york/i, "en"],
  [/印度|indian|india|curry|paneer|masala/i, "in"],
  [/墨西哥|mexican|mexico|taco|burrito/i, "mx"],
  [/越南|vietnamese|vietnam|pho|banh/i, "vn"],
  [/土耳其|turkish|turkey|kebab/i, "tr"],
  [/希腊|greek|greece|gyro/i, "gr"],
  [/巴西|brazil|brazilian|churrasco/i, "br"],
];

export function resolveRegionLandmark(input: {
  sourceLang?: string | null;
  country?: string | null;
  cuisine?: string | null;
  restaurantName?: string | null;
}): RegionLandmark {
  const text = [input.cuisine, input.restaurantName, input.country].filter(Boolean).join(" ");
  const cuisineMatch = CUISINE_TO_REGION.find(([pattern]) => pattern.test(text));
  if (cuisineMatch) return LANDMARKS[cuisineMatch[1]];

  const sourceKey = normalizeCode(input.sourceLang);
  if (sourceKey && LANGUAGE_TO_REGION[sourceKey]) return LANDMARKS[LANGUAGE_TO_REGION[sourceKey]];

  const countryKey = normalizeCode(input.country);
  if (countryKey && LANGUAGE_TO_REGION[countryKey]) return LANDMARKS[LANGUAGE_TO_REGION[countryKey]];

  return LANDMARKS.international;
}

export function getRegionLandmark(key: RegionLandmarkKey): RegionLandmark {
  return LANDMARKS[key] || LANDMARKS.international;
}

function normalizeCode(value?: string | null): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^([a-z]{2})[-_].*$/, "$1");
}
