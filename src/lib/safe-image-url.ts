const UNSAFE_REMOTE_IMAGE_RE = /dashscope-result.*aliyuncs\.com|image\.pollinations\.ai/i;

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

export function isSafeStoredThumbnail(url: string | null | undefined): url is string {
  if (!url) return false;
  if (isGeneratedDishPath(url)) return false;
  if (isUnsafeTemporaryRemoteImage(url)) return false;
  return true;
}
