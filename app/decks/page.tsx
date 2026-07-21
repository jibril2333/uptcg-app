import type { Metadata } from "next";
import { SiteNavigation } from "../components/SiteNavigation";
import { DeckLibrary } from "./DeckLibrary";

export const metadata: Metadata = {
  title: "我的牌組｜UPTCG",
  description: "建立、保存与管理 UNION ARENA 牌组。",
};

export default function DecksPage() {
  return (
    <div className="site-shell">
      <SiteNavigation active="decks" />
      <main className="main-content deck-library-page">
        <DeckLibrary />
      </main>
    </div>
  );
}
