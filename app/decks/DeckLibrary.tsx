"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { cardImageUrl } from "../card-image";
import { deckCardCount, loadDecks, storeDecks, type SavedDeck } from "./deck-storage";

export function DeckLibrary() {
  const [decks, setDecks] = useState<SavedDeck[]>([]);
  const [query, setQuery] = useState("");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadDecks().then((value) => {
      if (!cancelled) setDecks(value);
    }).finally(() => {
      if (!cancelled) setIsReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  const filteredDecks = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return decks.filter((deck) => [deck.name, deck.seriesName, deck.seriesCode].join(" ").toLocaleLowerCase().includes(needle));
  }, [decks, query]);

  const removeDeck = async (id: string) => {
    if (!window.confirm("确定删除这个牌组吗？")) return;
    const previous = decks;
    const next = decks.filter((deck) => deck.id !== id);
    setDecks(next);
    try {
      await storeDecks(next);
    } catch {
      setDecks(previous);
      window.alert("数据库保存失败，请稍后重试。");
    }
  };

  return (
    <>
      <header className="deck-page-hero">
        <div className="deck-page-hero__glow" />
        <p>MY UNION ARENA DECKS</p>
        <h1>我的牌組</h1>
        <span>牌组保存在这台 Mac 的数据库中，本机与域名访问同一份资料。</span>
      </header>

      <section className="deck-library-content">
        <div className="deck-library-heading">
          <div>
            <h2>我的牌組庫</h2>
            <p>{decks.length ? `已保存 ${decks.length} 副牌组` : "开始建立你的第一副牌组"}</p>
          </div>
          <div className="deck-library-actions">
            <label className="deck-search">
              <span aria-hidden="true">⌕</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索牌组…" />
            </label>
            <a className="new-deck-button" href="/decks/new"><span>＋</span> 新建牌組</a>
          </div>
        </div>

        {!isReady ? (
          <div className="deck-library-empty" role="status"><span className="deck-library-empty__loader" /><p>正在读取牌组数据库…</p></div>
        ) : filteredDecks.length ? (
          <div className="saved-deck-grid">
            {filteredDecks.map((deck) => {
              const previews = deck.cards.slice(0, 4);
              return (
                <article className="saved-deck-card" key={deck.id}>
                  <a className="saved-deck-card__cover" href={`/decks/new?id=${encodeURIComponent(deck.id)}&series=${deck.seriesCode}`}>
                    {previews.length ? previews.map((item, index) => (
                      <img key={`${item.card.image}-${index}`} src={cardImageUrl(item.card)} alt="" referrerPolicy="no-referrer" style={{ "--deck-card-index": index } as CSSProperties} />
                    )) : <span>UP</span>}
                    <span className="saved-deck-card__series">{deck.seriesCode}</span>
                  </a>
                  <div className="saved-deck-card__body">
                    <div><h3>{deck.name}</h3><p>{deck.seriesName} · {deckCardCount(deck)} / 50 张</p></div>
                    <div className="saved-deck-card__actions">
                      <a href={`/decks/new?id=${encodeURIComponent(deck.id)}&series=${deck.seriesCode}`}>编辑</a>
                      <button type="button" onClick={() => removeDeck(deck.id)}>删除</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="deck-library-empty">
            <span className="deck-library-empty__folder" aria-hidden="true">▱</span>
            <h2>{query ? "没有符合条件的牌组" : "尚無儲存的牌組"}</h2>
            <p>{query ? "换个关键词试试。" : "从已收录的 10,265 张卡牌中组建并保存你的第一副牌组。"}</p>
            {!query && <a href="/decks/new">＋ 新建牌組</a>}
          </div>
        )}
      </section>
    </>
  );
}
