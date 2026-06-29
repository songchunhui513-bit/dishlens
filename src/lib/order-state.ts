import type {
  Dish,
  OrderedDishItem,
  OrderedVisit,
  OrderNote,
  OrderPrice,
  OrderQuantityMap,
  TranslationResult,
} from "@/types";
import { getRestaurantDisplayMeta } from "@/lib/restaurant-display";
import { resolveMenuSourceLanguage } from "@/lib/menu-source-language";

export interface OrderSummary {
  totalQuantity: number;
  knownTotal: number;
  hasUnknownPrices: boolean;
  currency: string;
}

const PRICE_FIELDS = ["price", "price_text", "price_original", "original_price", "amount", "menu_price"] as const;

function extractPriceFromText(raw: string): OrderPrice | undefined {
  if (!raw || !raw.trim()) return undefined;
  const text = raw.trim();
  // Try: number followed by currency symbol or word (e.g. "14€", "1200円", "1200 JPY")
  const matchWithCurrency = text.match(/([0-9]+(?:[.,][0-9]+)?)\s*([$€£¥円]|USD|EUR|JPY|CNY|RMB)/i);
  // Try: currency symbol first (e.g. "€14", "¥1200")
  const matchCurrencyFirst = text.match(/([$€£¥]|USD|EUR|JPY|CNY|RMB)\s*([0-9]+(?:[.,][0-9]+)?)/i);
  // Try: bare number (last resort, e.g. "14")
  const matchBare = text.match(/([0-9]+(?:[.,][0-9]+)?)/);
  let match: RegExpMatchArray | null = null;
  if (matchWithCurrency && matchWithCurrency[2]) {
    match = matchWithCurrency;
  } else if (matchCurrencyFirst) {
    match = matchCurrencyFirst;
  } else if (matchBare) {
    match = matchBare;
  }
  if (!match) return undefined;
  const amountPart = match.find((part, idx) => idx > 0 && part && /[0-9]/.test(part));
  const currencyPart = match.find((part, idx) => idx > 0 && part && /[$€£¥円]|USD|EUR|JPY|CNY|RMB/i.test(part)) || "";
  if (!amountPart) return undefined;
  const amount = Number(amountPart.replace(",", "."));
  if (!Number.isFinite(amount)) return undefined;
  const currency = normalizeCurrency(currencyPart);
  return { amount, currency, raw: text };
}

export function getDishOrderId(dish: Pick<Dish, "id" | "name_original">): string {
  return dish.id || dish.name_original;
}

export function changeOrderQuantity(map: OrderQuantityMap, dish: Pick<Dish, "id" | "name_original">, delta: number): OrderQuantityMap {
  const id = getDishOrderId(dish);
  const next = { ...map };
  const quantity = Math.max(0, (next[id] || 0) + delta);
  if (quantity === 0) {
    delete next[id];
  } else {
    next[id] = quantity;
  }
  return next;
}

export function setOrderQuantity(map: OrderQuantityMap, dish: Pick<Dish, "id" | "name_original">, quantity: number): OrderQuantityMap {
  const id = getDishOrderId(dish);
  const next = { ...map };
  const safeQuantity = Math.max(0, Math.floor(quantity));
  if (safeQuantity === 0) {
    delete next[id];
  } else {
    next[id] = safeQuantity;
  }
  return next;
}

export function parseDishPrice(dish: Dish): OrderPrice | undefined {
  const source = dish as unknown as Record<string, unknown>;
  // Try dedicated price fields first
  for (const field of PRICE_FIELDS) {
    const value = source[field];
    if (typeof value === "number" && Number.isFinite(value)) {
      return { amount: value, currency: "", raw: String(value) };
    }
    if (typeof value !== "string") continue;
    const price = extractPriceFromText(value);
    if (price) return price;
  }
  // Fallback: extract price from name_original (AI embeds price in dish names)
  return extractPriceFromText(dish.name_original) || undefined;
}

export function buildOrderItems(result: TranslationResult | null, quantityMap: OrderQuantityMap): OrderedDishItem[] {
  if (!result) return [];
  const items: OrderedDishItem[] = [];
  for (const page of result.pages || []) {
    for (const dish of page.dishes || []) {
      const quantity = quantityMap[getDishOrderId(dish)] || 0;
      if (quantity <= 0) continue;
      items.push({
        dish_id: getDishOrderId(dish),
        dish,
        quantity,
        unitPrice: parseDishPrice(dish),
        reviewed: false,
      });
    }
  }
  return items;
}

export function summarizeOrder(items: OrderedDishItem[]): OrderSummary {
  let totalQuantity = 0;
  let knownTotal = 0;
  let hasUnknownPrices = false;
  let currency = "";

  for (const item of items) {
    totalQuantity += item.quantity;
    if (item.unitPrice) {
      knownTotal += item.unitPrice.amount * item.quantity;
      if (!currency && item.unitPrice.currency) currency = item.unitPrice.currency;
    } else {
      hasUnknownPrices = true;
    }
  }

  return { totalQuantity, knownTotal, hasUnknownPrices, currency };
}

export function formatOrderPrice(summary: OrderSummary): string {
  const total = summary.knownTotal > 0 ? `${formatNumber(summary.knownTotal)}${summary.currency}` : "价格待核对";
  if (summary.knownTotal > 0 && summary.hasUnknownPrices) return `${total} + 部分待核价`;
  return total;
}

export function buildOrderedVisit(
  result: TranslationResult,
  items: OrderedDishItem[],
  notes: OrderNote[],
  targetLang: string,
): OrderedVisit {
  const summary = summarizeOrder(items);
  const sourceLang = resolveMenuSourceLanguage(result) || result.metadata?.source_language || "";
  const restaurant = getRestaurantDisplayMeta(sourceLang, targetLang, result.metadata?.restaurant);
  return {
    id: `ordered-${result.task_id}-${Date.now()}`,
    restaurant_name: restaurant.display_name,
    country: restaurant.country,
    city: restaurant.city,
    source_lang: sourceLang,
    target_lang: targetLang,
    date: new Date().toISOString(),
    items,
    notes,
    totalAmount: summary.knownTotal,
    hasUnknownPrices: summary.hasUnknownPrices,
    result_summary: result,
  };
}

export function sourceLanguageName(lang: string): string {
  const names: Record<string, string> = {
    fr: "法国",
    it: "意大利",
    ja: "日本",
    de: "德国",
    es: "西班牙",
    th: "泰国",
    en: "英文",
    zh: "中文",
  };
  return names[lang] || lang.toUpperCase();
}

function normalizeCurrency(value: string): string {
  const upper = value.toUpperCase();
  if (upper === "EUR") return "€";
  if (upper === "JPY" || value === "円") return "円";
  if (upper === "CNY" || upper === "RMB") return "¥";
  if (value === "¥") return "¥";
  if (upper === "USD") return "$";
  return value;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}
