import type { Metadata } from "next";
import { buildWorks } from "../card-data";
import { SiteNavigation } from "../components/SiteNavigation";
import { CollectionCatalog } from "./CollectionCatalog";

export const metadata: Metadata = {
  title: "我的收集｜UPTCG",
  description: "记录拥有的 UNION ARENA 卡牌及数量。",
};

export default function CollectionPage() {
  return (
    <div className="site-shell">
      <SiteNavigation active="collection" />
      <main className="main-content collection-page">
        <CollectionCatalog works={buildWorks()} />
      </main>
    </div>
  );
}
