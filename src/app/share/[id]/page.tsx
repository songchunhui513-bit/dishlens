import SharedMenuPage from "@/components/share/SharedMenuPage";
import { getTask } from "@/lib/cache/task-store";
import { appShareOrigin, buildShareMenuMeta } from "@/lib/share-menu";
import type { Metadata } from "next";
import type { TranslationResult } from "@/types";

type SharePageProps = {
  params: Promise<{ id: string }>;
};

const SHARE_PREVIEW_IMAGE = "/icons/share-preview-20260527.png";

export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  const { id } = await params;
  const task = await getTask(id);
  const result = task?.result as TranslationResult | undefined;
  const shareUrl = `${appShareOrigin()}/share/${encodeURIComponent(id)}`;
  const shareImage = {
    url: new URL(SHARE_PREVIEW_IMAGE, appShareOrigin()).href,
    width: 1200,
    height: 630,
    alt: "DishLens 一起看菜",
  };

  if (!result?.pages) {
    return {
      title: "DishLens 分享菜单已不可用",
      description: "这份菜单可能仍在处理，或分享链接已经过期。",
      alternates: { canonical: `/share/${id}` },
      openGraph: {
        title: "DishLens 分享菜单已不可用",
        description: "这份菜单可能仍在处理，或分享链接已经过期。",
        url: shareUrl,
        siteName: "DishLens",
        images: [shareImage],
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title: "DishLens 分享菜单已不可用",
        description: "这份菜单可能仍在处理，或分享链接已经过期。",
        images: [shareImage.url],
      },
    };
  }

  const shareMeta = buildShareMenuMeta(result, appShareOrigin(), id);

  return {
    title: shareMeta.title,
    description: shareMeta.text,
    alternates: { canonical: `/share/${id}` },
    openGraph: {
      title: shareMeta.title,
      description: shareMeta.text,
      url: shareMeta.url,
      siteName: "DishLens",
      images: [shareImage],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: shareMeta.title,
      description: shareMeta.text,
      images: [shareImage.url],
    },
  };
}

export default async function SharePage({ params }: SharePageProps) {
  const { id } = await params;
  const task = await getTask(id);
  const result = task?.result as TranslationResult | undefined;

  if (!result?.pages) {
    return (
      <div className="w-full flex justify-center" style={{ minHeight: "100dvh", background: "#F0EBE3" }}>
        <div className="w-full relative flex flex-col items-center justify-center text-center" style={{ maxWidth: 430, minHeight: "100dvh", background: "var(--bg)", padding: 24 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 800, color: "var(--ink)", marginBottom: 8 }}>分享菜单已不可用</div>
          <div style={{ fontFamily: "var(--font-ui)", fontSize: 10, lineHeight: 1.6, color: "var(--muted)" }}>这份菜单可能仍在处理，或分享链接已经过期。请让分享者重新打开菜单后再分享一次。</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex justify-center" style={{ minHeight: "100dvh", background: "#F0EBE3" }}>
      <div className="w-full relative flex flex-col overflow-hidden" style={{ maxWidth: 430, height: "100dvh", background: "var(--bg)" }}>
        <SharedMenuPage result={result} />
      </div>
    </div>
  );
}
