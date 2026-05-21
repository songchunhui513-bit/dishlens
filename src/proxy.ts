import { updateSession } from "@/lib/auth/middleware";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Protect API routes that need auth
    "/api/v1/dish/:path*/review",
    "/api/v1/favorites/:path*",
    "/api/v1/history/:path*",
    "/api/v1/user/:path*",
  ],
};
