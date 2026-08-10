import { NextResponse } from "next/server";

/**
 * Public hash-only cache probes are intentionally disabled. A content hash is
 * not proof that the caller owns the uploaded menu, and the old endpoint could
 * also trigger paid image generation without receiving an image. Repeat scans
 * still use the browser cache first, then the upload endpoint verifies hashes
 * against the uploaded bytes before returning a shared server cache entry.
 */
export async function POST() {
  return NextResponse.json(
    { hit: false },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
