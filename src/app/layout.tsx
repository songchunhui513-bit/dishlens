import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/source-serif-4/wght.css";
import "@fontsource-variable/source-serif-4/wght-italic.css";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@fontsource/poppins/800.css";
import "./globals.css";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://dishlens.wukongmkt.com";
const sharePreviewImage = "/icons/share-preview-20260527.png";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: "DishLens — AI Menu Translator",
  description: "拍菜单，秒懂天下菜。AI 翻译菜单、生成菜品图片、社区评价。",
  applicationName: "DishLens",
  appleWebApp: {
    capable: true,
    title: "DishLens",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [
      { url: "/apple-touch-icon.png?v=20260527", sizes: "180x180", type: "image/png" },
      { url: "/icons/apple-touch-icon.png?v=20260527", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    title: "DishLens — AI Menu Translator",
    description: "拍菜单，秒懂天下菜。AI 翻译菜单、生成菜品图片、社区评价。",
    url: appUrl,
    siteName: "DishLens",
    images: [{ url: sharePreviewImage, width: 1200, height: 630, alt: "DishLens 一起看菜" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DishLens — AI Menu Translator",
    description: "拍菜单，秒懂天下菜。AI 翻译菜单、生成菜品图片、社区评价。",
    images: [sharePreviewImage],
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#FFF5E9",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="antialiased">
      <body className="flex flex-col">{children}</body>
    </html>
  );
}
