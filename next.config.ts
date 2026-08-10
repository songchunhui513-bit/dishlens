import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const dishImageCdnHost = process.env.NEXT_PUBLIC_DISH_IMAGE_CDN_HOST?.trim();

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "images.pexels.com" },
      { protocol: "https", hostname: "image.pollinations.ai" },
      { protocol: "https", hostname: "dashscope-result-bj.oss-cn-beijing.aliyuncs.com" },
      { protocol: "https", hostname: "**.aliyuncs.com" },
      ...(dishImageCdnHost ? [{ protocol: "https" as const, hostname: dishImageCdnHost }] : []),
    ],
  },
  serverExternalPackages: ["@supabase/supabase-js", "ali-oss"],
};

export default nextConfig;
