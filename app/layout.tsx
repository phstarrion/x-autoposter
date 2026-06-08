import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "X Autoposter — AIで投稿を自動化",
  description: "X (Twitter) 自動投稿・予約投稿ツール。AIエージェントが投稿文を生成。",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "X Autoposter",
  },
  openGraph: {
    title: "X Autoposter — AIで投稿を自動化",
    description: "予約投稿とAI投稿生成で、Xの運用を自動化しよう。",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "X Autoposter — AIで投稿を自動化",
    description: "予約投稿とAI投稿生成で、Xの運用を自動化しよう。",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
