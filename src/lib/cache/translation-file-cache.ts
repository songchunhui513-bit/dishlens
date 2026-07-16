import crypto from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

type CachedTranslation = {
  result: Record<string, unknown>;
  createdAt: number;
};

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_TTL_MS = Math.max(
  5 * 60 * 1000,
  Number.parseInt(process.env.MENU_TRANSLATION_FILE_CACHE_TTL_MS || `${DEFAULT_TTL_MS}`, 10) || DEFAULT_TTL_MS,
);

function cacheDir(): string {
  return process.env.MENU_TRANSLATION_FILE_CACHE_DIR || join(process.cwd(), ".cache", "translation-results");
}

function cachePath(cacheKey: string): string {
  const filename = crypto.createHash("sha256").update(cacheKey).digest("hex");
  return join(cacheDir(), `${filename}.json`);
}

export async function getCachedTranslationResult(cacheKey: string, now = Date.now()): Promise<CachedTranslation | null> {
  try {
    const raw = await readFile(cachePath(cacheKey), "utf8");
    const parsed = JSON.parse(raw) as CachedTranslation;
    if (!parsed?.result || !parsed.createdAt) return null;
    if (now - parsed.createdAt > CACHE_TTL_MS) {
      unlink(cachePath(cacheKey)).catch(() => {});
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function setCachedTranslationResult(cacheKey: string, result: Record<string, unknown>, now = Date.now()): Promise<void> {
  try {
    await mkdir(cacheDir(), { recursive: true });
    await writeFile(
      cachePath(cacheKey),
      JSON.stringify({ result, createdAt: now }),
      "utf8",
    );
  } catch (error) {
    console.warn("Translation file cache write failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
