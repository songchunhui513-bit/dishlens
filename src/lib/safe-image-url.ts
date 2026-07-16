import dishKnowledgeDb from "../../public/dish-knowledge-db.json";
import type { DishKnowledgeEntry } from "./dish-knowledge-types";

const UNSAFE_REMOTE_IMAGE_RE = /dashscope-result.*aliyuncs\.com|image\.pollinations\.ai|images\.unsplash\.com/i;
const APP_IMAGE_HOSTS = new Set(["dishlens.wukongmkt.com", "localhost", "127.0.0.1"]);
const KNOWN_LOCAL_DISH_IMAGE_PATHS = new Set(
  (dishKnowledgeDb as DishKnowledgeEntry[])
    .flatMap((entry) => [entry.card, entry.hero])
    .filter((url): url is string => typeof url === "string" && url.startsWith("/dishes/")),
);

export function unwrapNextImageUrl(url: string): string {
  const trimmed = url.trim();
  let query = "";
  if (trimmed.startsWith("/_next/image?")) {
    query = trimmed.slice(trimmed.indexOf("?") + 1);
  } else {
    try {
      const parsed = new URL(trimmed);
      if (parsed.pathname !== "/_next/image") return trimmed;
      query = parsed.search.slice(1);
    } catch {
      return trimmed;
    }
  }
  try {
    const params = new URLSearchParams(query);
    return params.get("url") || trimmed;
  } catch {
    return trimmed;
  }
}

function pathForImageUrl(url: string): string {
  const normalizedUrl = unwrapNextImageUrl(url.trim());
  if (!normalizedUrl) return "";
  if (normalizedUrl.startsWith("/")) return normalizedUrl;

  try {
    return new URL(normalizedUrl).pathname;
  } catch {
    return normalizedUrl;
  }
}

export function isUnsafeTemporaryRemoteImage(url: string | null | undefined): boolean {
  if (!url) return false;
  return UNSAFE_REMOTE_IMAGE_RE.test(unwrapNextImageUrl(url));
}

export function isGeneratedDishPath(url: string | null | undefined): boolean {
  if (!url) return false;
  return pathForImageUrl(url).startsWith("/generated-dishes/");
}

function isKnownLocalDishPath(pathname: string): boolean {
  if (!pathname.startsWith("/dishes/")) return false;
  if (KNOWN_LOCAL_DISH_IMAGE_PATHS.has(pathname)) return true;

  const webpPathname = pathname.replace(/\.(png|jpe?g)$/i, ".webp");
  return webpPathname !== pathname && KNOWN_LOCAL_DISH_IMAGE_PATHS.has(webpPathname);
}

function isSupabaseStorageDishUrl(url: URL): boolean {
  return url.hostname.endsWith(".supabase.co")
    && url.pathname.startsWith("/storage/v1/object/public/dishes/");
}

export function isSafeStoredThumbnail(url: string | null | undefined): url is string {
  if (!url) return false;
  if (isGeneratedDishPath(url)) return false;
  if (isUnsafeTemporaryRemoteImage(url)) return false;

  const normalizedUrl = unwrapNextImageUrl(url.trim());
  if (normalizedUrl.startsWith("/")) {
    return isKnownLocalDishPath(normalizedUrl);
  }

  try {
    const parsed = new URL(normalizedUrl);
    if (isSupabaseStorageDishUrl(parsed)) return true;
    if (APP_IMAGE_HOSTS.has(parsed.hostname)) {
      return isKnownLocalDishPath(parsed.pathname);
    }
  } catch {
    return false;
  }

  return false;
}
