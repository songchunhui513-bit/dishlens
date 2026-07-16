import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { NextRequest, NextResponse } from "next/server";

const GENERATED_DISH_DIR = join(process.cwd(), "public", "generated-dishes");

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ file: string }> },
) {
  const params = await context.params;
  const fileName = decodeURIComponent(params.file || "");

  if (!fileName.endsWith(".png") || basename(fileName) !== fileName) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const filePath = join(GENERATED_DISH_DIR, fileName);
    const body = await readFile(filePath);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
