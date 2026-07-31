import { PinnedSeries } from "./components/PinnedSeries";
import { SiteNavigation } from "./components/SiteNavigation";
import { series } from "./series-data";

export default function Home() {
  return (
    <div className="site-shell" id="top">
      <SiteNavigation active="home" />

      <main className="main-content">
        <section className="hero" aria-label="UPTCG 首頁">
          <div className="hero__glow hero__glow--one" />
          <div className="hero__glow hero__glow--two" />
          <img className="hero__logo" src="/assets/union-arena.png" alt="UNION ARENA TCG" />
          <div className="hero__actions">
            <a className="button button--primary" href="/cards">瀏覽官方卡表</a>
            <a className="button button--secondary" href="/decks">我的牌組</a>
          </div>
        </section>

        <div className="content-wrap">
          <PinnedSeries items={series} />
        </div>
      </main>

    </div>
  );
}
