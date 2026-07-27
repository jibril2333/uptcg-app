import type { Metadata } from "next";
import { buildWorks } from "../card-data";
import { SiteNavigation } from "../components/SiteNavigation";
import { CardCatalog } from "./CardCatalog";

export const metadata: Metadata = {
  title: "系列卡表｜UPTCG",
  description: "选择 UNION ARENA 作品，浏览各系列的官方卡牌资料及高清卡图。",
};

export default function CardsPage() {
  const works = buildWorks();

  return (
    <div className="site-shell cards-site">
      <SiteNavigation active="cards" />
      <main className="main-content card-library">
        <CardCatalog works={works} />

        <footer className="card-library__footer">
          <p>资料来源：UNION ARENA 官方卡表。本站为非官方本地资料工具，卡图及卡牌内容版权归 BANDAI 与各作品权利方所有。</p>
          <a href="https://www.unionarena-tcg.com/jp/cardlist/" target="_blank" rel="noreferrer">UNION ARENA 官方卡表 ↗</a>
        </footer>
      </main>
    </div>
  );
}
