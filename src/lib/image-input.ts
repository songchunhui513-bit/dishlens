export const MAX_MENU_IMAGES = 20;
export const DEFAULT_SERVER_IMAGE_MAX_DIM = 1400;
export const DEFAULT_SERVER_IMAGE_QUALITY = 76;

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

function envInt(name: string, fallback: number, min: number, max: number): number {
  const value = Number.parseInt(process.env[name] || "", 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

export function getServerImageMaxDim(): number {
  return envInt("MENU_SERVER_IMAGE_MAX_DIM", DEFAULT_SERVER_IMAGE_MAX_DIM, 768, 1600);
}

export function getServerImageQuality(): number {
  return envInt("MENU_SERVER_IMAGE_QUALITY", DEFAULT_SERVER_IMAGE_QUALITY, 45, 82);
}
