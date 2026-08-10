import type { HistoryEntry, FavoriteDish, OrderedVisit, UserSettings } from "@/types";
import type { DishKnowledgeEntry } from "./dish-knowledge-types";
import {
  isGeneratedDishPath,
  isSafeStoredThumbnail,
  isUnsafeTemporaryRemoteImage,
} from "./safe-image-url";

const KEYS = {
  history: "dishlens_history",
  favorites: "dishlens_favorites",
  orderedVisits: "dishlens_ordered_visits",
  settings: "dishlens_settings",
  dailyRec: (date: string) => `dishlens_daily_rec_${date}`,
  weather: (date: string) => `dishlens_weather_${date}`,
} as const;

const MAX_HISTORY = 50;
const MAX_ORDERED_VISITS = 30;
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const DEFAULT_SETTINGS: UserSettings = {
  targetLang: "zh",
  uiLang: "zh",
  showAllergens: false,
  showVeg: false,
  showGlutenFree: false,
};

function getBrowserStorage(): Storage | null {
  return (globalThis as unknown as { localStorage?: Storage }).localStorage ?? null;
}

function getBrowserDocument(): Document | null {
  return (globalThis as unknown as { document?: Document }).document ?? null;
}

function read<T>(key: string, fallback: T): T {
  const storage = getBrowserStorage();
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  const storage = getBrowserStorage();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage full — clear oldest history entries
    const history = read<HistoryEntry[]>(KEYS.history, []);
    if (history.length > 10) {
      history.splice(0, 10);
      try {
        storage.setItem(KEYS.history, JSON.stringify(history));
        storage.setItem(key, JSON.stringify(value));
      } catch {}
    }
  }
}

function readCookie(key: string): unknown | null {
  const doc = getBrowserDocument();
  if (!doc) return null;
  const prefix = `${encodeURIComponent(key)}=`;
  const item = doc.cookie
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
  const doc = getBrowserDocument();
  if (!doc) return;
  const location = (globalThis as unknown as { location?: Location }).location;
  const secure = location?.protocol === "https:" ? "; Secure" : "";
  doc.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(JSON.stringify(value))}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
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

function isUnsafePersistedImageUrl(url: unknown): url is string {
  return typeof url === "string" && (
    isGeneratedDishPath(url) || isUnsafeTemporaryRemoteImage(url)
  );
}

function sanitizeHistoryEntry(entry: HistoryEntry): HistoryEntry {
  let changed = false;
  const next: HistoryEntry = { ...entry };

  if (next.thumbnail && !isSafeStoredThumbnail(next.thumbnail)) {
    next.thumbnail = "";
    changed = true;
  }

  if (next.result_summary?.pages?.length) {
    const pages = next.result_summary.pages.map((page) => {
      let pageChanged = false;
      const dishes = (page.dishes || []).map((dish) => {
        const staleAiUrl = isUnsafePersistedImageUrl(dish.ai_image_url);
        const staleImageUrl = isUnsafePersistedImageUrl((dish as { image_url?: string }).image_url);
        if (!staleAiUrl && !staleImageUrl) return dish;

        pageChanged = true;
        const nextDish = { ...dish } as typeof dish & { image_url?: string };
        if (staleAiUrl) delete nextDish.ai_image_url;
        if (staleImageUrl) delete nextDish.image_url;
        if (!nextDish.ai_image_url && !nextDish.image_url) nextDish.image_status = "failed";
        return nextDish;
      });
      return pageChanged ? { ...page, dishes } : page;
    });

    if (pages.some((page, index) => page !== next.result_summary?.pages[index])) {
      next.result_summary = { ...next.result_summary, pages };
      changed = true;
    }
  }

  return changed ? next : entry;
}

export function getHistory(): HistoryEntry[] {
  const history = read<HistoryEntry[]>(KEYS.history, []);
  const sanitized = history.map(sanitizeHistoryEntry);
  if (sanitized.some((entry, index) => entry !== history[index])) {
    write(KEYS.history, sanitized);
  }
  return sanitized;
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

function sanitizeFavoriteDish(dish: FavoriteDish): FavoriteDish {
  if (!isUnsafePersistedImageUrl(dish.image_url) && (!dish.image_url || isSafeStoredThumbnail(dish.image_url))) {
    return dish;
  }

  const next = { ...dish };
  delete next.image_url;
  return next;
}

export function getFavorites(): FavoriteDish[] {
  const favorites = read<FavoriteDish[]>(KEYS.favorites, []);
  const sanitized = favorites.map(sanitizeFavoriteDish);
  if (sanitized.some((favorite, index) => favorite !== favorites[index])) {
    write(KEYS.favorites, sanitized);
  }
  return sanitized;
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

// ── Ordered Visits ─────────────────────────────────────────────────

export function getOrderedVisits(): OrderedVisit[] {
  return read<OrderedVisit[]>(KEYS.orderedVisits, []);
}

export function addOrderedVisit(visit: OrderedVisit): void {
  const visits = getOrderedVisits();
  const idx = visits.findIndex((v) => v.id === visit.id);
  if (idx >= 0) visits.splice(idx, 1);
  visits.unshift(visit);
  if (visits.length > MAX_ORDERED_VISITS) visits.length = MAX_ORDERED_VISITS;
  write(KEYS.orderedVisits, visits);
}

export function updateOrderedVisit(visit: OrderedVisit): void {
  const visits = getOrderedVisits();
  const idx = visits.findIndex((v) => v.id === visit.id);
  if (idx >= 0) {
    visits[idx] = visit;
  } else {
    visits.unshift(visit);
  }
  if (visits.length > MAX_ORDERED_VISITS) visits.length = MAX_ORDERED_VISITS;
  write(KEYS.orderedVisits, visits);
}

export function markOrderedDishReviewed(visitId: string, dishId: string): void {
  const visits = getOrderedVisits();
  const visit = visits.find((v) => v.id === visitId);
  if (!visit) return;
  visit.items = visit.items.map((item) => (
    item.dish_id === dishId ? { ...item, reviewed: true } : item
  ));
  write(KEYS.orderedVisits, visits);
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
