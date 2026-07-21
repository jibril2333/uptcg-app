import type { Metadata } from "next";
import { buildWorks } from "../../card-data";
import { SiteNavigation } from "../../components/SiteNavigation";
import { DeckBuilder } from "./DeckBuilder";

export const metadata: Metadata = {
  title: "新建牌組｜UPTCG",
  description: "使用本地官方卡表建立 UNION ARENA 牌组。",
};

export default function NewDeckPage() {
  return (
    <div className="site-shell">
      <SiteNavigation active="decks" />
      <main className="main-content deck-builder-page">
        <DeckBuilder works={buildWorks()} />
      </main>
    </div>
  );
}
