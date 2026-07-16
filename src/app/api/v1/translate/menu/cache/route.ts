import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCachedTranslationResult } from "@/lib/cache/translation-file-cache";
import { createTask, updateTask } from "@/lib/cache/task-store";
import { normalizeTargetLang } from "@/lib/languages";
import { sanitizeTranslationResultImages } from "@/lib/server/sanitize-translation-result";

type CacheProbeBody = {
  hashes?: unknown;
  target_lang?: unknown;
};

type CachedProbeResult = Record<string, unknown> & {
  pages?: unknown[];
};

function normalizeHashes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => /^[a-f0-9]{32}$/.test(item))
    .slice(0, 20);
}

export async function POST(req: NextRequest) {
  let body: CacheProbeBody = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ hit: false }, { status: 200 });
  }

  const targetLang = normalizeTargetLang(body.target_lang);
  const hashes = normalizeHashes(body.hashes);
  if (hashes.length === 0) {
    return NextResponse.json({ hit: false }, { status: 200 });
  }

  const cacheKey = hashes.slice().sort().join("|");
  const cached = await getCachedTranslationResult(cacheKey);
  if (!cached) {
    return NextResponse.json({ hit: false }, { status: 200 });
  }

  const cachedRawStatus = typeof cached.result.status === "string" ? cached.result.status : "";
  const cachedStatus: "done" | "partial" | "failed" =
    cachedRawStatus === "partial" || cachedRawStatus === "failed" ? cachedRawStatus : "done";
  const taskId = crypto.randomUUID();
  const result = sanitizeTranslationResultImages({
    ...cached.result,
    task_id: taskId,
    status: cachedStatus,
    metadata: {
      ...(cached.result.metadata as Record<string, unknown>),
      cached: true,
      cache_probe: true,
      target_language: targetLang,
    },
  }) as CachedProbeResult;
  const pageCount = Array.isArray(result.pages) ? result.pages.length : 1;
  await createTask(taskId, pageCount, { allowMemoryFallback: true });
  await updateTask(taskId, {
    status: cachedStatus,
    progress: { current: pageCount, total: pageCount },
    perPageStatus: Array.from({ length: pageCount }, (_, index) => ({
      page_index: index,
      status: cachedStatus,
    })),
    result,
    estimatedRemaining: 0,
  });

  return NextResponse.json({ hit: true, result }, { status: 200 });
}
