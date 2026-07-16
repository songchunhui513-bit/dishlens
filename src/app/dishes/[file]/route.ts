import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { NextRequest, NextResponse } from "next/server";

const DISH_DIR = join(process.cwd(), "public", "dishes");
const allowedTypes: Record<string, string> = {
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function extensionForFileName(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".webp")) return ".webp";
  if (lower.endsWith(".png")) return ".png";
  if (lower.endsWith(".jpg")) return ".jpg";
  if (lower.endsWith(".jpeg")) return ".jpeg";
  return "";
}

function fallbackWebpFileName(fileName: string): string | null {
  return /\.(png|jpe?g)$/i.test(fileName)
    ? fileName.replace(/\.(png|jpe?g)$/i, ".webp")
    : null;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ file: string }> },
) {
  const params = await context.params;
  const fileName = decodeURIComponent(params.file || "");
  const extension = extensionForFileName(fileName);

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
      const filePath = join(DISH_DIR, candidate.fileName);
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
