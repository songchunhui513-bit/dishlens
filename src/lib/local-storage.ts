import type { HistoryEntry, FavoriteDish } from "@/types";
import type { DishKnowledgeEntry } from "./dish-knowledge-types";

const KEYS = {
  history: "dishlens_history",
  favorites: "dishlens_favorites",
  dailyRec: (date: string) => `dishlens_daily_rec_${date}`,
  weather: (date: string) => `dishlens_weather_${date}`,
} as const;

const MAX_HISTORY = 100;

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage full — clear oldest history entries
    const history = read<HistoryEntry[]>(KEYS.history, []);
    if (history.length > 10) {
      history.splice(0, 10);
      try {
        localStorage.setItem(KEYS.history, JSON.stringify(history));
        localStorage.setItem(key, JSON.stringify(value));
      } catch {}
    }
  }
}

// ── History ──────────────────────────────────────────────────────

export function getHistory(): HistoryEntry[] {
  return read<HistoryEntry[]>(KEYS.history, []);
}

export function addHistory(entry: HistoryEntry): void {
  const history = getHistory();
  // Deduplicate by id
  const idx = history.findIndex((h) => h.id === entry.id);
  if (idx >= 0) history.splice(idx, 1);
  history.unshift(entry);
  // Trim to max
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  write(KEYS.history, history);
}

// ── Favorites ────────────────────────────────────────────────────

export function getFavorites(): FavoriteDish[] {
  return read<FavoriteDish[]>(KEYS.favorites, []);
}

export function addFavorite(dish: FavoriteDish): void {
  const favorites = getFavorites();
  if (favorites.some((f) => f.id === dish.id)) return;
  favorites.unshift(dish);
  write(KEYS.favorites, favorites);
}

export function removeFavorite(dishId: string): void {
  const favorites = getFavorites().filter((f) => f.id !== dishId);
  write(KEYS.favorites, favorites);
}

export function isFavorited(dishId: string): boolean {
  return getFavorites().some((f) => f.id === dishId);
}

// ── Recommendation Cache ─────────────────────────────────────────

export function getCachedRecommendation(date: string): DishKnowledgeEntry | null {
  return read<DishKnowledgeEntry | null>(KEYS.dailyRec(date), null);
}

export function setCachedRecommendation(date: string, dish: DishKnowledgeEntry): void {
  write(KEYS.dailyRec(date), dish);
}

// ── Weather Cache ────────────────────────────────────────────────

export interface WeatherData {
  temperature: number;
  weatherCode: number;
}

export function getCachedWeather(date: string): WeatherData | null {
  return read<WeatherData | null>(KEYS.weather(date), null);
}

export function setCachedWeather(date: string, weather: WeatherData): void {
  write(KEYS.weather(date), weather);
}
