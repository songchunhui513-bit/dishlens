import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { NextRequest, NextResponse } from "next/server";

const GENERATED_DISH_DIR = join(process.cwd(), "public", "generated-dishes");
const allowedTypes: Record<string, string> = {
  ".png": "image/png",
  ".webp": "image/webp",
};

function fallbackWebpFileName(fileName: string): string | null {
  return fileName.toLowerCase().endsWith(".png")
    ? fileName.replace(/\.png$/i, ".webp")
    : null;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ file: string }> },
) {
  const params = await context.params;
  const fileName = decodeURIComponent(params.file || "");
  const extension = fileName.toLowerCase().endsWith(".webp") ? ".webp"
    : fileName.toLowerCase().endsWith(".png") ? ".png"
      : "";

  const contentType = allowedTypes[extension];
  if (!contentType || basename(fileName) !== fileName) {
    return new NextResponse("Not found", { status: 404 });
  }

  const candidates = [
    { fileName, contentType },
    ...(fallbackWebpFileName(fileName)
      ? [{ fileName: fallbackWebpFileName(fileName)!, contentType: allowedTypes[".webp"] }]
      : []),
  ];

  for (const candidate of candidates) {
    try {
      const filePath = join(GENERATED_DISH_DIR, candidate.fileName);
      const body = await readFile(filePath);
      return new NextResponse(body, {
        headers: {
          "Content-Type": candidate.contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch {}
  }

  return new NextResponse("Not found", { status: 404 });
}
