import { PinnedSeries } from "./components/PinnedSeries";
import { SiteNavigation } from "./components/SiteNavigation";
import { series } from "./series-data";

export default function Home() {
  return (
    <div className="site-shell" id="top">
      <SiteNavigation active="home" />

      <main className="main-content">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero__glow hero__glow--one" />
          <div className="hero__glow hero__glow--two" />
          <img className="hero__logo" src="/assets/union-arena.png" alt="UNION ARENA TCG" />
          <h1 id="hero-title">最強大的中文組牌神器</h1>
          <p>即時翻譯 · 智能篩選 · 社群分享 · Build your deck like a Pro.</p>
          <div className="hero__actions">
            <a className="button button--primary" href="/cards">瀏覽官方卡表</a>
            <a className="button button--secondary" href="/decks">我的牌組</a>
          </div>
        </section>

        <div className="content-wrap">
          <PinnedSeries items={series} />
        </div>

        <footer className="footer" id="about">
          <p className="footer__intro">
            UPTCG 由熱愛 Union Arena 的台灣玩家自發建立，致力於打造最完整的繁體中文 TCG 資源平台。本地版本保留原站的核心首頁體驗，並移除輪播橫幅、廣告與追蹤程式。
          </p>
          <div className="footer__bottom">
            <div className="footer__brand"><span>UP</span><p><strong>UPTCG 資料庫 — 非官方粉絲社群工具</strong><small>© 2025 UPTCG. 卡片版權歸 BANDAI NAMCO 所有</small></p></div>
            <nav aria-label="頁尾選單"><a href="#about">關於我們</a><a href="#about">免責聲明</a><a href="#about">隱私政策</a><a href="#about">服務條款</a></nav>
          </div>
        </footer>
      </main>

    </div>
  );
}
