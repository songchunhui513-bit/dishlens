import type { DishKnowledgeEntry } from "./dish-knowledge-types";

export type LocationProvider = "amap" | "google";

export interface UserLocation {
  lat: number;
  lon: number;
  country?: string | null;
}

export interface RestaurantSource {
  provider: LocationProvider;
  id: string;
  name: string;
  localizedName?: string;
  cuisineLabel?: string;
  rating?: number;
  distanceMeters?: number;
  distanceLabel?: string;
  latitude: number;
  longitude: number;
  address?: string;
  navigationUrl: string;
}

export interface LocationDailyRecommendation {
  dish: DishKnowledgeEntry;
  restaurant: RestaurantSource | null;
  contextLabel?: string;
  reason?: string;
}

export interface LocationRecommendationEnv {
  AMAP_WEB_SERVICE_KEY?: string;
  GOOGLE_PLACES_API_KEY?: string;
}

interface LocationRecommendationOptions {
  lat: number;
  lon: number;
  country?: string | null;
  locale?: "zh" | "en";
  env?: LocationRecommendationEnv;
  fetcher?: typeof fetch;
}

const CHINA_REGION_CODES = new Set(["CN", "HK", "MO", "TW"]);
const SEARCH_RADII = [2_000, 5_000, 10_000, 20_000, 50_000];

export function chooseLocationProvider(country?: string | null): LocationProvider {
  return country && CHINA_REGION_CODES.has(country.toUpperCase()) ? "amap" : "google";
}

export function shouldShowDistance(distanceMeters?: number | null): boolean {
  return typeof distanceMeters === "number" && Number.isFinite(distanceMeters) && distanceMeters <= 50_000;
}

export function formatDistanceLabel(distanceMeters: number, locale: "zh" | "en" = "zh"): string {
  const km = distanceMeters / 1000;
  if (km < 1) return locale === "en" ? "<1km" : "<1km";
  if (km < 2) return "<2km";
  if (km < 10) return `${Number(km.toFixed(1))}km`;
  return `${Math.round(km)}km`;
}

export function buildNavigationUrl(input: {
  provider: LocationProvider;
  name: string;
  latitude: number;
  longitude: number;
}): string {
  const name = encodeURIComponent(input.name);
  if (input.provider === "amap") {
    const location = `${input.longitude},${input.latitude}`;
    return `https://uri.amap.com/navigation?to=${location},${name}&mode=car&policy=1&src=dishlens`;
  }
  const destination = encodeURIComponent(`${input.latitude},${input.longitude}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&destination_place_id=&travelmode=walking`;
}

export async function getLocationRecommendation(options: LocationRecommendationOptions): Promise<RestaurantSource | null> {
  const provider = chooseLocationProvider(options.country);
  const env = options.env || {};
  const fetcher = options.fetcher || fetch;

  if (provider === "amap") {
    const key = env.AMAP_WEB_SERVICE_KEY;
    if (!key) return null;
    return searchAmapRestaurants({ ...options, key, fetcher });
  }

  const key = env.GOOGLE_PLACES_API_KEY;
  if (!key) return null;
  return searchGoogleRestaurants({ ...options, key, fetcher });
}

async function searchAmapRestaurants(options: LocationRecommendationOptions & { key: string; fetcher: typeof fetch }): Promise<RestaurantSource | null> {
  for (const radius of SEARCH_RADII) {
    const params = new URLSearchParams({
      key: options.key,
      location: `${options.lon},${options.lat}`,
      types: "050000",
      radius: String(radius),
      offset: "12",
      page: "1",
      extensions: "base",
      sortrule: "distance",
    });
    const data = asRecord(await fetchJson(`https://restapi.amap.com/v3/place/around?${params.toString()}`, options.fetcher));
    const pois = Array.isArray(data.pois) ? data.pois : [];
    const best = pois
      .map(parseAmapRestaurant)
      .filter((item: Omit<RestaurantSource, "navigationUrl"> | null): item is Omit<RestaurantSource, "navigationUrl"> => Boolean(item))
      .sort(scoreRestaurantCandidate)[0];
    if (best) {
      return finalizeRestaurant(best, options.locale);
    }
  }
  return null;
}

async function searchGoogleRestaurants(options: LocationRecommendationOptions & { key: string; fetcher: typeof fetch }): Promise<RestaurantSource | null> {
  for (const radius of SEARCH_RADII) {
    const data = asRecord(await fetchJson(
      "https://places.googleapis.com/v1/places:searchNearby",
      options.fetcher,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": options.key,
          "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.types",
        },
        body: JSON.stringify({
          includedPrimaryTypes: ["restaurant"],
          maxResultCount: 12,
          rankPreference: "DISTANCE",
          languageCode: options.locale === "en" ? "en" : "zh-CN",
          locationRestriction: {
            circle: {
              center: { latitude: options.lat, longitude: options.lon },
              radius,
            },
          },
        }),
      },
    ));
    const places = Array.isArray(data.places) ? data.places : [];
    const best = places
      .map((place: unknown) => parseGoogleRestaurant(place, options))
      .filter((item: Omit<RestaurantSource, "navigationUrl"> | null): item is Omit<RestaurantSource, "navigationUrl"> => Boolean(item))
      .sort(scoreRestaurantCandidate)[0];
    if (best) {
      return finalizeRestaurant(best, options.locale);
    }
  }
  return null;
}

async function fetchJson(url: string, fetcher: typeof fetch, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetcher(url, { ...init, signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function parseAmapRestaurant(raw: unknown): Omit<RestaurantSource, "navigationUrl"> | null {
  const poi = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const location = typeof poi.location === "string" ? poi.location.split(",") : [];
  const longitude = Number(location[0]);
  const latitude = Number(location[1]);
  const name = typeof poi.name === "string" ? poi.name : "";
  if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const distanceMeters = Number(typeof poi.distance === "string" || typeof poi.distance === "number" ? poi.distance : NaN);
  const rating = Number(typeof poi.biz_ext === "object" && poi.biz_ext ? (poi.biz_ext as Record<string, unknown>).rating : NaN);
  return {
    provider: "amap",
    id: typeof poi.id === "string" ? poi.id : name,
    name,
    rating: Number.isFinite(rating) ? rating : undefined,
    distanceMeters: Number.isFinite(distanceMeters) ? distanceMeters : undefined,
    latitude,
    longitude,
    address: typeof poi.address === "string" ? poi.address : undefined,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function parseGoogleRestaurant(raw: unknown, origin: { lat: number; lon: number }): Omit<RestaurantSource, "navigationUrl"> | null {
  const place = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const location = place.location && typeof place.location === "object" ? place.location as Record<string, unknown> : {};
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  const displayName = place.displayName && typeof place.displayName === "object" ? place.displayName as Record<string, unknown> : {};
  const name = typeof displayName.text === "string" ? displayName.text : "";
  if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const distanceMeters = haversineMeters(origin.lat, origin.lon, latitude, longitude);
  const rating = Number(place.rating);
  return {
    provider: "google",
    id: typeof place.id === "string" ? place.id : name,
    name,
    rating: Number.isFinite(rating) ? rating : undefined,
    distanceMeters,
    latitude,
    longitude,
    address: typeof place.formattedAddress === "string" ? place.formattedAddress : undefined,
  };
}

function finalizeRestaurant(candidate: Omit<RestaurantSource, "navigationUrl">, locale: "zh" | "en" = "zh"): RestaurantSource {
  return {
    ...candidate,
    distanceLabel: shouldShowDistance(candidate.distanceMeters) ? formatDistanceLabel(candidate.distanceMeters || 0, locale) : undefined,
    navigationUrl: buildNavigationUrl(candidate),
  };
}

function scoreRestaurantCandidate(a: Omit<RestaurantSource, "navigationUrl">, b: Omit<RestaurantSource, "navigationUrl">): number {
  const aRating = a.rating || 0;
  const bRating = b.rating || 0;
  if (Math.abs(aRating - bRating) >= 0.3) return bRating - aRating;
  return (a.distanceMeters || Number.MAX_SAFE_INTEGER) - (b.distanceMeters || Number.MAX_SAFE_INTEGER);
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earth = 6_371_000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return Math.round(earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function toRadians(value: number): number {
  return value * Math.PI / 180;
}
