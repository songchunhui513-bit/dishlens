const UNSAFE_REMOTE_IMAGE_RE = /dashscope-result.*aliyuncs\.com|image\.pollinations\.ai/i;

export function unwrapNextImageUrl(url: string): string {
  if (!url.startsWith("/_next/image?")) return url;
  try {
    const params = new URLSearchParams(url.slice(url.indexOf("?") + 1));
    return params.get("url") || url;
  } catch {
    return url;
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
