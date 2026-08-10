import OSS from "ali-oss";

const OSS_OBJECT_PREFIX = "generated-dishes";
const OSS_OPERATION_TIMEOUT_MS = Math.max(
  1_000,
  Math.min(15_000, Number.parseInt(process.env.ALIYUN_OSS_OPERATION_TIMEOUT_MS || "4000", 10) || 4000),
);
const OSS_FAILURE_COOLDOWN_MS = Math.max(
  10_000,
  Math.min(10 * 60_000, Number.parseInt(process.env.ALIYUN_OSS_FAILURE_COOLDOWN_MS || "120000", 10) || 120000),
);

let client: OSS | null | undefined;
let disabledUntil = 0;

function normalizedDishId(dishId: string): string {
  return dishId.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "dish";
}

function objectPath(dishId: string): string {
  return `${OSS_OBJECT_PREFIX}/${normalizedDishId(dishId)}.webp`;
}

function publicBaseUrl(): string {
  const configured = process.env.ALIYUN_OSS_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;

  const bucket = process.env.ALIYUN_OSS_BUCKET?.trim();
  const endpoint = process.env.ALIYUN_OSS_ENDPOINT?.trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
  const region = process.env.ALIYUN_OSS_REGION?.trim();
  if (!bucket) return "";
  if (endpoint) return `https://${bucket}.${endpoint}`;
  if (region) return `https://${bucket}.${region}.aliyuncs.com`;
  return "";
}

function publicObjectUrl(dishId: string): string | null {
  const base = publicBaseUrl();
  return base ? `${base}/${objectPath(dishId)}` : null;
}

function getClient(): OSS | null {
  if (client !== undefined) return client;

  const region = process.env.ALIYUN_OSS_REGION?.trim();
  const bucket = process.env.ALIYUN_OSS_BUCKET?.trim();
  const accessKeyId = process.env.ALIYUN_OSS_ACCESS_KEY_ID?.trim();
  const accessKeySecret = process.env.ALIYUN_OSS_ACCESS_KEY_SECRET?.trim();
  if (!region || !bucket || !accessKeyId || !accessKeySecret || !publicBaseUrl()) {
    client = null;
    return client;
  }

  client = new OSS({
    region,
    bucket,
    accessKeyId,
    accessKeySecret,
    endpoint: process.env.ALIYUN_OSS_ENDPOINT?.trim() || undefined,
    secure: true,
    timeout: OSS_OPERATION_TIMEOUT_MS,
  });
  return client;
}

function markUnavailable(error: unknown): void {
  disabledUntil = Date.now() + OSS_FAILURE_COOLDOWN_MS;
  console.warn("Alibaba OSS generated-image storage unavailable", {
    cooldownMs: OSS_FAILURE_COOLDOWN_MS,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function isAliyunOssImageStorageConfigured(): boolean {
  return Boolean(getClient());
}

export async function uploadGeneratedDishImageToOss(
  dishId: string,
  buffer: Buffer,
): Promise<string | null> {
  if (Date.now() < disabledUntil) return null;
  const oss = getClient();
  const url = publicObjectUrl(dishId);
  if (!oss || !url) return null;

  try {
    await oss.put(objectPath(dishId), buffer, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
    return url;
  } catch (error) {
    markUnavailable(error);
    return null;
  }
}

export async function getCachedGeneratedDishImageFromOss(dishId: string): Promise<string | null> {
  if (Date.now() < disabledUntil) return null;
  const oss = getClient();
  const url = publicObjectUrl(dishId);
  if (!oss || !url) return null;

  try {
    await oss.head(objectPath(dishId));
    return url;
  } catch (error) {
    const status = (error as { status?: number; statusCode?: number }).status
      || (error as { status?: number; statusCode?: number }).statusCode;
    if (status === 404) return null;
    markUnavailable(error);
    return null;
  }
}
