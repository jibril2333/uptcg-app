import type { Metadata } from "next";
import { LegacyDataMigration } from "./components/LegacyDataMigration";
import { series } from "./series-data";
import "./globals.css";

export const metadata: Metadata = {
  title: "UPTCG｜Union Arena 中文組牌工具",
  description: "Union Arena 全系列繁體中文卡表、智慧組牌與社群牌組工具。",
  icons: {
    icon: "/assets/icon.png",
    shortcut: "/assets/icon.png",
    apple: "/assets/icon.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body><LegacyDataMigration seriesCodes={series.map((item) => item.code)} />{children}</body>
    </html>
  );
}
