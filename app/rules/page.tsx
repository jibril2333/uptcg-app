import type { Metadata } from "next";
import { SiteNavigation } from "../components/SiteNavigation";
import {
  liftedRestrictions,
  restrictedCards,
  restrictionEffectiveDate,
  restrictionUpdatedAt,
} from "./rules-data";

export const metadata: Metadata = {
  title: "規則與禁卡表｜UPTCG",
  description: "UNION ARENA 基本规则、赛事牌组规范及日文版现行禁限卡表。",
};

const officialRulesUrl = "https://www.unionarena-tcg.com/jp/rules/";
const officialRestrictionsUrl = "https://www.unionarena-tcg.com/jp/rules/limited.php";
const officialFaqUrl = "https://www.unionarena-tcg.com/jp/faq/list.php?type=0";
const championshipRegulationUrl = "https://www.unionarena-tcg.com/jp/pdf/cs2026-27_regulation.pdf";

const deckRules = [
  { value: "50", label: "主牌组张数", detail: "必须正好 50 张" },
  { value: "3", label: "AP 卡", detail: "与主牌组分开放置" },
  { value: "4", label: "同一卡号上限", detail: "异图也视为同一卡号" },
  { value: "1", label: "作品代码", detail: "牌组只能使用同一作品代码" },
];

const triggerRules = [
  { name: "Special Trigger", label: "特殊触发", limit: "合计最多 4 张" },
  { name: "Color Trigger", label: "颜色触发", limit: "合计最多 4 张" },
  { name: "Final Trigger", label: "最终触发", limit: "合计最多 4 张" },
];

function officialCardUrl(cardNo: string) {
  return `https://www.unionarena-tcg.com/jp/cardlist/detail.php?card_no=${encodeURIComponent(cardNo)}`;
}

export default function RulesPage() {
  const oneCopyCount = restrictedCards.filter((card) => card.limit === 1).length;
  const twoCopyCount = restrictedCards.filter((card) => card.limit === 2).length;

  return (
    <div className="site-shell">
      <SiteNavigation active="rules" />
      <main className="main-content rules-page">
        <header className="rules-hero">
          <div className="rules-hero__copy">
            <p>UNION ARENA RULES &amp; RESTRICTIONS</p>
            <h1>規則與禁卡表</h1>
            <span>快速确认牌组是否合法，并查看日文版当前生效的卡牌使用限制。</span>
          </div>
          <div className="rules-hero__status">
            <span>官方页面更新</span>
            <strong>{restrictionUpdatedAt.replaceAll("-", ".")}</strong>
            <small>{restrictionEffectiveDate.replaceAll("-", ".")} 起生效</small>
          </div>
        </header>

        <div className="rules-content">
          <section className="rules-section" aria-labelledby="deck-rules-title">
            <div className="rules-section__heading">
              <div>
                <p>DECK CONSTRUCTION</p>
                <h2 id="deck-rules-title">牌组构筑规则</h2>
              </div>
              <a href={championshipRegulationUrl} target="_blank" rel="noreferrer">查看赛事规章 ↗</a>
            </div>

            <div className="rule-stat-grid">
              {deckRules.map((rule) => (
                <article className="rule-stat-card" key={rule.label}>
                  <strong>{rule.value}</strong>
                  <div><b>{rule.label}</b><span>{rule.detail}</span></div>
                </article>
              ))}
            </div>

            <div className="rule-detail-grid">
              <article className="rule-panel">
                <span className="rule-panel__number">01</span>
                <div>
                  <h3>作品必须统一</h3>
                  <p>以卡号斜线后的作品代码为准。牌组中的 50 张卡必须拥有相同作品代码，例如 EVA 牌组不能混入 MST 卡牌。</p>
                </div>
              </article>
              <article className="rule-panel">
                <span className="rule-panel__number">02</span>
                <div>
                  <h3>同一卡号最多 4 张</h3>
                  <p>判断时看斜线后的完整卡号。普通版、平行版及其他异图只要卡号相同，就共同计算在 4 张上限内。</p>
                </div>
              </article>
              <article className="rule-panel">
                <span className="rule-panel__number">03</span>
                <div>
                  <h3>胜利条件</h3>
                  <p>让对手生命区变为 0；或让对手牌库为 0，并在其开始阶段无法抽牌，即可获胜。</p>
                </div>
              </article>
              <article className="rule-panel">
                <span className="rule-panel__number">04</span>
                <div>
                  <h3>赛事以现场裁定优先</h3>
                  <p>大型赛事通常采用 30 分钟、一场一局。若规则有疑问，应暂停游戏并立即呼叫裁判。</p>
                </div>
              </article>
            </div>

            <div className="trigger-rule-row" aria-label="特殊触发卡数量限制">
              {triggerRules.map((trigger) => (
                <div key={trigger.name}>
                  <span>{trigger.name}</span>
                  <strong>{trigger.label}</strong>
                  <small>{trigger.limit}</small>
                </div>
              ))}
            </div>
          </section>

          <section className="rules-section restriction-section" aria-labelledby="restriction-title">
            <div className="rules-section__heading">
              <div>
                <p>CARD RESTRICTIONS</p>
                <h2 id="restriction-title">现行禁限卡表</h2>
              </div>
              <a href={officialRestrictionsUrl} target="_blank" rel="noreferrer">核对官方原文 ↗</a>
            </div>

            <div className="restriction-summary">
              <div><strong>0</strong><span>完全禁止</span><small>当前没有限 0 卡牌</small></div>
              <div><strong>{oneCopyCount}</strong><span>限制 1 张</span><small>牌组内最多放 1 张</small></div>
              <div><strong>{twoCopyCount}</strong><span>限制 2 张</span><small>牌组内最多放 2 张</small></div>
            </div>

            <div className="restriction-notice">
              <span aria-hidden="true">!</span>
              <p><strong>以下限制适用于日文版官方／公认赛事。</strong>相同卡号的平行版与异图也共享同一上限；参加特定赛事前仍应再次核对该赛事规章。</p>
            </div>

            <div className="restriction-table-wrap">
              <table className="restriction-table">
                <thead>
                  <tr>
                    <th>卡牌</th>
                    <th>作品</th>
                    <th>状态</th>
                    <th>生效日期</th>
                    <th><span className="sr-only">操作</span></th>
                  </tr>
                </thead>
                <tbody>
                  {restrictedCards.map((card) => (
                    <tr key={card.fullCardNo}>
                      <td>
                        <div className="restriction-card">
                          <img src={card.image} alt="" referrerPolicy="no-referrer" />
                          <span><strong>{card.name}</strong><small>{card.shortCardNo}</small></span>
                        </div>
                      </td>
                      <td><span className="restriction-series">{card.seriesName}</span></td>
                      <td><span className={`restriction-badge restriction-badge--${card.limit}`}>限制 {card.limit} 张</span></td>
                      <td><time dateTime={card.effectiveDate}>{card.effectiveDate.replaceAll("-", ".")}</time></td>
                      <td><a href={officialCardUrl(card.fullCardNo)} target="_blank" rel="noreferrer">卡片资料 ↗</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="restriction-lifted">
              <span>限制解除</span>
              {liftedRestrictions.map((card) => (
                <p key={card.cardNo}>
                  <strong>{card.cardNo} {card.name}</strong>
                  <small>{card.seriesName} · {card.effectiveDate.replaceAll("-", ".")} 起恢复为最多 4 张</small>
                </p>
              ))}
            </div>
          </section>

          <section className="rules-section official-rule-links" aria-labelledby="official-links-title">
            <div className="rules-section__heading">
              <div>
                <p>OFFICIAL SOURCES</p>
                <h2 id="official-links-title">官方规则入口</h2>
              </div>
            </div>
            <div>
              <a href={officialRulesUrl} target="_blank" rel="noreferrer"><span>01</span><strong>官方规则中心</strong><small>规则手册、教学与裁定更新</small><b>↗</b></a>
              <a href={officialFaqUrl} target="_blank" rel="noreferrer"><span>02</span><strong>规则 Q&amp;A</strong><small>按卡牌与情境检索官方回答</small><b>↗</b></a>
              <a href={championshipRegulationUrl} target="_blank" rel="noreferrer"><span>03</span><strong>赛事规章</strong><small>CHAMPIONSHIP 26-27 最新版本</small><b>↗</b></a>
            </div>
            <p className="rules-disclaimer">本站内容为方便查阅的中文摘要；官方页面、赛事规章及现场裁判的最新判定具有优先效力。</p>
          </section>
        </div>
      </main>
    </div>
  );
}
