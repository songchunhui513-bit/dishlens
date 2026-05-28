import type { HistoryEntry, FavoriteDish, UserSettings } from "@/types";
import type { DishKnowledgeEntry } from "./dish-knowledge-types";

const KEYS = {
  history: "dishlens_history",
  favorites: "dishlens_favorites",
  settings: "dishlens_settings",
  dailyRec: (date: string) => `dishlens_daily_rec_${date}`,
  weather: (date: string) => `dishlens_weather_${date}`,
} as const;

const MAX_HISTORY = 50;
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const DEFAULT_SETTINGS: UserSettings = {
  targetLang: "zh",
  uiLang: "zh",
  showAllergens: false,
  showVeg: false,
  showGlutenFree: false,
};

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

function readCookie(key: string): unknown | null {
  if (typeof document === "undefined") return null;
  const prefix = `${encodeURIComponent(key)}=`;
  const item = document.cookie
    .split("; ")
    .find((part) => part.startsWith(prefix));
  if (!item) return null;

  try {
    return JSON.parse(decodeURIComponent(item.slice(prefix.length)));
  } catch {
    return null;
  }
}

function writeCookie(key: string, value: unknown): void {
  if (typeof document === "undefined") return;
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(JSON.stringify(value))}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

function normalizeSettings(value: unknown): UserSettings {
  const source = value && typeof value === "object" ? value as Partial<UserSettings> : {};
  return {
    targetLang: typeof source.targetLang === "string" && source.targetLang ? source.targetLang : DEFAULT_SETTINGS.targetLang,
    uiLang: source.uiLang === "en" ? "en" : "zh",
    showAllergens: source.showAllergens === true,
    showVeg: source.showVeg === true,
    showGlutenFree: source.showGlutenFree === true,
  };
}

// ── Settings ─────────────────────────────────────────────────────

export function getSettings(): UserSettings {
  const localSettings = read<Partial<UserSettings> | null>(KEYS.settings, null);
  if (localSettings) return normalizeSettings(localSettings);

  const cookieSettings = readCookie(KEYS.settings);
  if (cookieSettings) return normalizeSettings(cookieSettings);

  return DEFAULT_SETTINGS;
}

export function setSettings(settings: UserSettings): void {
  const normalized = normalizeSettings(settings);
  write(KEYS.settings, normalized);
  writeCookie(KEYS.settings, normalized);
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
