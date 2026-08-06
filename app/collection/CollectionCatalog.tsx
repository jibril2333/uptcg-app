"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { UaCard, UaWork } from "../cards/CardCatalog";
import { loadCollection, storeCollectionEntry, type CollectionEntries, type CollectionEntry } from "./collection-storage";

const EMPTY_DATASETS: UaWork["datasets"] = [];

function unique(values: Array<string | undefined>) {
  return [...new Set(values.filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "ja"));
}

function cardColor(card: UaCard) {
  return card.needEnergy?.match(/^[赤青黄緑紫]/)?.[0] ?? "";
}

export function CollectionCatalog({ works }: { works: UaWork[] }) {
  const [activeWorkCode, setActiveWorkCode] = useState("");
  const [cards, setCards] = useState<UaCard[]>([]);
  const [entries, setEntries] = useState<CollectionEntries>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [storageNotice, setStorageNotice] = useState("");
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState("all");
  const [color, setColor] = useState("all");
  const [category, setCategory] = useState("all");
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [selected, setSelected] = useState<UaCard | null>(null);
  const cardCache = useRef(new Map<string, UaCard[]>());

  const activeWork = works.find((work) => work.code === activeWorkCode);
  const datasets = activeWork?.datasets ?? EMPTY_DATASETS;
  const collectionItems = useMemo(() => Object.values(entries).filter((entry) => entry.count > 0), [entries]);
  const totalCopies = useMemo(() => collectionItems.reduce((total, entry) => total + entry.count, 0), [collectionItems]);
  const collectionByWork = useMemo(() => {
    const summaries = new Map<string, { copies: number; kinds: number }>();
    for (const entry of collectionItems) {
      const summary = summaries.get(entry.workCode) ?? { copies: 0, kinds: 0 };
      summary.copies += entry.count;
      summary.kinds += 1;
      summaries.set(entry.workCode, summary);
    }
    return summaries;
  }, [collectionItems]);
  const activeWorkOwned = collectionByWork.get(activeWorkCode) ?? { copies: 0, kinds: 0 };
  const currentOwnedKinds = useMemo(() => cards.filter((card) => (entries[card.image]?.count || 0) > 0).length, [cards, entries]);
  const currentOwnedCopies = useMemo(() => cards.reduce((total, card) => total + (entries[card.image]?.count || 0), 0), [cards, entries]);

  useEffect(() => {
    let cancelled = false;
    void loadCollection().then((value) => {
      if (!cancelled) setEntries(value);
    });
    const requestedCode = new URLSearchParams(window.location.search).get("series")?.toUpperCase();
    const requestedWork = works.find((work) => work.code === requestedCode);
    if (requestedWork) {
      setActiveWorkCode(requestedWork.code);
    }
    return () => { cancelled = true; };
  }, [works]);

  useEffect(() => {
    if (!datasets.length) {
      setCards([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setLoadError("");
    Promise.all(datasets.map(async (dataset) => {
      const cached = cardCache.current.get(dataset.productKey);
      if (cached) return cached;
      const response = await fetch(dataset.dataUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as { cards?: UaCard[] };
      if (!data.cards?.length) throw new Error("empty");
      cardCache.current.set(dataset.productKey, data.cards);
      return data.cards;
    }))
      .then((cardGroups) => {
        if (cancelled) return;
        const combined = new Map<string, UaCard>();
        for (const card of cardGroups.flat()) combined.set(card.image, card);
        setCards([...combined.values()]);
      })
      .catch(() => {
        if (!cancelled) setLoadError("暂时无法读取这个系列的本地卡牌资料。");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [datasets]);

  useEffect(() => {
    if (!selected) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selected]);

  const rarityOptions = useMemo(() => unique(cards.map((card) => card.rarity)), [cards]);
  const colorOptions = useMemo(() => unique(cards.map(cardColor)), [cards]);
  const categoryOptions = useMemo(() => unique(cards.map((card) => card.category)), [cards]);
  const filteredCards = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ja");
    return cards.filter((card) => {
      const searchable = [card.name, card.ruby, card.cardNo, card.effect].filter(Boolean).join(" ").toLocaleLowerCase("ja");
      return (
        (!needle || searchable.includes(needle)) &&
        (rarity === "all" || card.rarity === rarity) &&
        (color === "all" || cardColor(card) === color) &&
        (category === "all" || card.category === category) &&
        (!ownedOnly || (entries[card.image]?.count || 0) > 0)
      );
    });
  }, [cards, category, color, entries, ownedOnly, query, rarity]);

  const resetFilters = () => {
    setQuery("");
    setRarity("all");
    setColor("all");
    setCategory("all");
    setOwnedOnly(false);
  };

  const selectWork = (code: string) => {
    const work = works.find((item) => item.code === code);
    if (!work) return;
    setActiveWorkCode(work.code);
    setCards([]);
    setSelected(null);
    resetFilters();
    const url = new URL(window.location.href);
    url.searchParams.set("series", work.code);
    window.history.replaceState({}, "", url);
  };

  const returnToWorks = () => {
    setActiveWorkCode("");
    setCards([]);
    setSelected(null);
    resetFilters();
    const url = new URL(window.location.href);
    url.searchParams.delete("series");
    window.history.replaceState({}, "", url);
  };

  const setCardCount = (card: UaCard, count: number) => {
    const nextCount = Math.max(0, Math.min(99, Number.isFinite(count) ? count : 0));
    const next = { ...entries };
    let entry: CollectionEntry | null = null;
    if (!nextCount) {
      delete next[card.image];
    } else {
      entry = {
        card,
        count: nextCount,
        updatedAt: new Date().toISOString(),
        workCode: activeWork?.code ?? "",
        workName: activeWork?.name ?? "",
      };
      next[card.image] = entry;
    }
    setEntries(next);
    setStorageNotice("正在保存…");
    void storeCollectionEntry(card.image, entry, next)
      .then(() => setStorageNotice("已保存到数据库"))
      .catch(() => setStorageNotice("保存失败，请重试"));
  };

  return (
    <>
      <header
        className={`collection-hero catalog-context-hero${activeWork ? " is-series" : ""}`}
        data-series-code={activeWork?.code}
        style={activeWork ? { "--catalog-series-cover": `url("${activeWork.image}")` } as CSSProperties : undefined}
      >
        <div>
          {activeWork ? (
            <>
              <button className="catalog-hero-back" type="button" onClick={returnToWorks}>← 所有作品</button>
              <p>{activeWork.code} · MY UNION ARENA COLLECTION</p>
              <h1>{activeWork.name}</h1>
              <span>{activeWork.originalName}</span>
            </>
          ) : (
            <>
              <p>MY UNION ARENA COLLECTION</p>
              <h1>我的收集</h1>
              <span>记录你已经拥有的卡牌和数量，资料保存在这台 Mac 的数据库中。</span>
            </>
          )}
        </div>
        <div className="collection-summary" aria-label={activeWork ? "当前作品收集统计" : "收集统计"}>
          <span><strong>{activeWork ? activeWorkOwned.kinds : collectionItems.length}</strong><small>{activeWork ? "本作种类" : "种卡牌"}</small></span>
          <span><strong>{activeWork ? activeWorkOwned.copies : totalCopies}</strong><small>{activeWork ? "本作张数" : "张总数"}</small></span>
        </div>
      </header>

      <section className={`collection-catalog${activeWork ? "" : " collection-catalog--series"}`} aria-label={activeWork ? `${activeWork.name}收藏目录` : "收藏作品目录"}>
        {!activeWork ? (
          <div className="series-picker">
            <div className="series-picker__heading">
              <div>
                <p>SELECT A SERIES</p>
                <h2>先选择作品</h2>
              </div>
              <span>目前收录 {works.length} 个作品</span>
            </div>
            <div className="series-picker__grid">
              {works.map((work) => {
                const owned = collectionByWork.get(work.code) ?? { copies: 0, kinds: 0 };
                return (
                  <button className="series-choice" key={work.code} type="button" onClick={() => selectWork(work.code)} aria-label={`查看${work.name}收藏`}>
                    <img src={work.image} alt="" />
                    <span className="series-choice__shade" />
                    <span className="series-choice__code">{work.code}</span>
                    <span className="series-choice__meta">
                      <strong>{work.name}</strong>
                      <small>已拥有 {owned.kinds} 种 · {owned.copies} 张</small>
                    </span>
                    <span className="series-choice__arrow" aria-hidden="true">›</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <>
        {isLoading ? (
          <div className="card-loading" role="status"><span /><p>正在读取 {activeWork?.name} 全系列卡牌资料…</p></div>
        ) : loadError ? (
          <div className="card-empty"><span>!</span><h2>读取失败</h2><p>{loadError}</p></div>
        ) : (
          <>
            <div className="collection-filters">
              <label className="collection-search"><span>搜索卡名、编号或效果</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="输入关键词…" /></label>
              <label><span>稀有度</span><select value={rarity} onChange={(event) => setRarity(event.target.value)}><option value="all">全部</option>{rarityOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
              <label><span>颜色</span><select value={color} onChange={(event) => setColor(event.target.value)}><option value="all">全部</option>{colorOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
              <label><span>卡牌类型</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">全部</option>{categoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
              <label className="collection-owned-filter"><input type="checkbox" checked={ownedOnly} onChange={(event) => setOwnedOnly(event.target.checked)} /><span>只看已拥有</span></label>
            </div>

            <div className="collection-results">
              <p><span>{activeWork?.code}</span> · 全系列 · 已拥有 <strong>{currentOwnedKinds}</strong> / {cards.length} 种，共 <strong>{currentOwnedCopies}</strong> 张 · 当前显示 {filteredCards.length} 张</p>
              <div>{storageNotice && <span className="collection-sync-status" role="status">{storageNotice}</span>}{(query || rarity !== "all" || color !== "all" || category !== "all" || ownedOnly) && <button type="button" onClick={resetFilters}>清除筛选</button>}</div>
            </div>

            {filteredCards.length ? (
              <div className="collection-card-grid">
                {filteredCards.map((card) => {
                  const count = entries[card.image]?.count || 0;
                  return (
                    <article className={`collection-card${count ? " is-owned" : ""}`} data-color={cardColor(card)} key={card.image}>
                      <div className="collection-card__image">
                        <button className="collection-card__detail-trigger" type="button" onClick={() => setSelected(card)} aria-label={`查看${card.name}卡牌详情`}>
                          <img src={card.image} alt={`${card.cardNo} ${card.name}`} loading="lazy" />
                        </button>
                        {count > 0 && <span className="collection-card__owned">已拥有 ×{count}</span>}
                        <div className="collection-card__controls" aria-label={`${card.name}拥有数量`}>
                          <button type="button" disabled={!count} onClick={() => setCardCount(card, count - 1)} aria-label={`减少一张${card.name}`}>−</button>
                          <input type="number" min="0" max="99" inputMode="numeric" value={count} onChange={(event) => setCardCount(card, Number.parseInt(event.target.value || "0", 10))} aria-label={`${card.name}数量`} />
                          <button type="button" onClick={() => setCardCount(card, count + 1)} aria-label={`增加一张${card.name}`}>＋</button>
                        </div>
                      </div>
                      <div className="collection-card__meta"><strong>{card.name}</strong><small>{card.cardNo} · {card.rarity || "-"}</small></div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="card-empty"><span>⌕</span><h2>{ownedOnly ? "这个系列还没有已拥有的卡牌" : "没有符合条件的卡牌"}</h2><p>{ownedOnly ? "取消“只看已拥有”后开始记录。" : "试试缩短关键词或清除筛选条件。"}</p></div>
            )}
          </>
        )}
          </>
        )}
      </section>

      {selected && (
        <div className="card-modal" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelected(null); }}>
          <section className="card-modal__panel" role="dialog" aria-modal="true" aria-labelledby="collection-card-modal-title">
            <button className="card-modal__close" type="button" aria-label="关闭卡牌详情" onClick={() => setSelected(null)}>×</button>
            <div className="card-modal__image"><img src={selected.image} alt={`${selected.cardNo} ${selected.name}`} /></div>
            <div className="card-modal__content">
              <p className="card-modal__eyebrow">{selected.cardNo} · {selected.rarity || "-"}</p>
              <h2 id="collection-card-modal-title">{selected.name}</h2>
              {selected.ruby && <p className="card-modal__ruby">{selected.ruby}</p>}
              <div className="card-stat-row">
                <span><small>颜色 / 能量</small><strong>{selected.needEnergy || "-"}</strong></span>
                <span><small>AP</small><strong>{selected.ap || "-"}</strong></span>
                <span><small>BP</small><strong>{selected.bp || "-"}</strong></span>
                <span><small>类型</small><strong>{selected.category || "-"}</strong></span>
              </div>
              <dl className="card-detail-list">
                <div><dt>特征</dt><dd>{selected.attributes || "-"}</dd></div>
                <div><dt>产生能量</dt><dd>{selected.generatedEnergy?.join(" · ") || "-"}</dd></div>
                <div><dt>效果</dt><dd>{selected.effect || "-"}</dd></div>
                <div><dt>触发</dt><dd>{selected.trigger || "-"}</dd></div>
              </dl>
              <a className="official-source-button" href={selected.detailOfficialUrl} target="_blank" rel="noreferrer">在 UA 官方网站查看 ↗</a>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
