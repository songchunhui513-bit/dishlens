export const MAX_MENU_IMAGES = 20;
export const SERVER_IMAGE_MAX_DIM = 1280;
export const SERVER_IMAGE_QUALITY = 68;

const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function normalizeImageMimeType(type?: string, name?: string): string {
  const normalizedType = (type || "").toLowerCase();
  if (SUPPORTED_IMAGE_MIME_TYPES.has(normalizedType)) return normalizedType;

  const ext = (name?.split(".").pop() || "").toLowerCase();
  return MIME_BY_EXTENSION[ext] || "image/jpeg";
}

export function shouldNormalizeClientImage(
  file: { name?: string; type?: string; size: number },
  maxRawBytes = 300 * 1024,
): boolean {
  const mimeType = normalizeImageMimeType(file.type, file.name);
  if (mimeType === "image/webp") return true;
  return file.size >= maxRawBytes;
}
