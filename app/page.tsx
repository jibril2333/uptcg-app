import Link from "next/link";
import type { CSSProperties } from "react";
import { LiquidGlassAccent } from "./components/LiquidGlassAccent";
import { PinnedSeries } from "./components/PinnedSeries";
import { SiteNavigation } from "./components/SiteNavigation";
import { buildWorks } from "./card-data";
import { series } from "./series-data";

export default function Home() {
  const knownCodes = new Set(series.map((item) => item.code));
  const newlyDiscovered = buildWorks()
    .filter((work) => !knownCodes.has(work.code))
    .map((work) => ({ code: work.code, ext: "jpg" as const, image: work.image, name: work.name }));
  const allSeries = [...newlyDiscovered, ...series];
  const featuredSeries = allSeries.slice(0, 3);

  return (
    <div className="site-shell" id="top">
      <SiteNavigation active="home" />

      <main className="main-content">
        <section className="spatial-home" aria-label="UPTCG 首頁">
          <div className="spatial-home__aurora" aria-hidden="true" />
          <header className="spatial-home__welcome">
            <p>YOUR UNION ARENA SPACE</p>
            <h1>你的卡牌，<br /><span>都在這裡。</span></h1>
            <small>查卡、組牌與收藏，以更直覺的方式集中管理。</small>
            <LiquidGlassAccent href="/cards" />
          </header>

          <div className="spatial-home__windows">
            <Link className="spatial-window spatial-window--cards" href="/cards">
              <div className="spatial-window__heading"><span>官方卡表</span><small>完整資料庫 ↗</small></div>
              <div className="spatial-card-stack" aria-hidden="true">
                {featuredSeries.map((item, index) => (
                  <img
                    key={item.code}
                    src={item.image ?? `/assets/series/${item.code}.${item.ext}`}
                    alt=""
                    referrerPolicy="no-referrer"
                    style={{ "--spatial-card-index": index } as CSSProperties}
                  />
                ))}
              </div>
              <strong>探索所有作品</strong>
              <p>從作品進入卡表，查看卡面、分類與詳細資料。</p>
            </Link>

            <Link className="spatial-window spatial-window--decks" href="/decks">
              <div className="spatial-window__heading"><span>我的牌组</span><small>DECK SPACE</small></div>
              <div className="spatial-deck-orbit" aria-hidden="true"><span>50<small>張</small></span></div>
              <strong>構築你的牌組</strong>
              <p>先選作品與顏色，再進入專屬組牌空間。</p>
            </Link>

            <Link className="spatial-window spatial-window--collection" href="/collection">
              <div className="spatial-window__heading"><span>我的收集</span><small>COLLECTION</small></div>
              <div className="spatial-collection-bars" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
              <strong>記錄每一張擁有的卡</strong>
              <p>按作品整理收藏，並隨時調整擁有數量。</p>
            </Link>
          </div>
        </section>

        <div className="content-wrap spatial-series-wrap">
          <PinnedSeries items={allSeries} />
        </div>
      </main>

    </div>
  );
}
