import type { Dish } from "@/types";
import { parseDishPrice } from "@/lib/order-state";

const PRICE_FIELDS = ["price", "price_text", "price_original", "original_price", "amount", "menu_price"] as const;
const PRICE_TEXT_PATTERN = /([$€£¥]\s*[0-9]+(?:[.,][0-9]+)?|[0-9]+(?:[.,][0-9]+)?\s*(?:[$€£¥円]|USD|EUR|JPY|CNY|RMB))/i;
const TRAILING_PRICE_PATTERN = new RegExp(
  String.raw`(?:\s*(?:[·•|｜-]\s*)?)(${PRICE_TEXT_PATTERN.source})\s*$`,
  "i",
);

export function getDishPriceDisplay(dish: Dish): string {
  const source = dish as unknown as Record<string, unknown>;

  for (const field of PRICE_FIELDS) {
    const value = source[field];
    const label = extractPriceLabel(value);
    if (label) return label;
  }

  const originalLabel = extractPriceLabel(dish.name_original);
  if (originalLabel) return originalLabel;

  const parsed = parseDishPrice(dish);
  return parsed ? `${formatPriceNumber(parsed.amount)}${parsed.currency}` : "";
}

export function stripPriceFromOriginalName(value: string): string {
  return value.replace(TRAILING_PRICE_PATTERN, "").trim();
}

function extractPriceLabel(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return formatPriceNumber(value);
  if (typeof value !== "string") return "";
  const match = value.trim().match(TRAILING_PRICE_PATTERN) || value.trim().match(PRICE_TEXT_PATTERN);
  return match?.[1] ? match[1].replace(/\s+/g, "") : "";
}

function formatPriceNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}
