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
  const totalCards = works.reduce(
    (workTotal, work) => workTotal + work.datasets.reduce((total, dataset) => total + dataset.cardCount, 0),
    0,
  );

  return (
    <div className="site-shell cards-site">
      <SiteNavigation active="cards" />
      <main className="main-content card-library">
        <header className="series-library__header">
          <div>
            <p className="series-library__kicker">UNION ARENA CARD LIST</p>
            <h1>系列卡表</h1>
            <p>选择作品后查看已收录的官方产品、卡牌资料与高清卡图。</p>
          </div>
          <div className="series-library__summary" aria-label="资料库统计">
            <span><strong>{works.length}</strong> 个作品</span>
            <span><strong>{totalCards}</strong> 张卡牌</span>
          </div>
        </header>

        <CardCatalog works={works} />

        <footer className="card-library__footer">
          <p>资料来源：UNION ARENA 官方卡表。本站为非官方本地资料工具，卡图及卡牌内容版权归 BANDAI 与各作品权利方所有。</p>
          <a href="https://www.unionarena-tcg.com/jp/cardlist/" target="_blank" rel="noreferrer">UNION ARENA 官方卡表 ↗</a>
        </footer>
      </main>
    </div>
  );
}
