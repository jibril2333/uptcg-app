"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

export type UaCard = {
  ap?: string;
  attributes?: string;
  bp?: string;
  cardNo: string;
  category?: string;
  detailOfficialUrl: string;
  effect?: string;
  generatedEnergy?: string[];
  image: string;
  imageFileName: string;
  name: string;
  needEnergy?: string;
  product?: string;
  rarity?: string;
  ruby?: string;
  title?: string;
  trigger?: string;
};

export type UaDataset = {
  cardCount: number;
  colors: string[];
  dataUrl: string;
  officialListUrl: string;
  productKey: string;
  productName: string;
  seriesId: string;
  setCode: string;
  syncedAt: string;
  workCode: string;
};

export type UaWork = {
  code: string;
  datasets: UaDataset[];
  image: string;
  name: string;
  originalName: string;
};

function unique(values: Array<string | undefined>) {
  return [...new Set(values.filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "ja"));
}

function cardColor(card: UaCard) {
  return card.needEnergy?.match(/^[赤青黄緑紫]/)?.[0] ?? "";
}

export function CardCatalog({ works }: { works: UaWork[] }) {
  const [activeWork, setActiveWork] = useState("");
  const [activeProduct, setActiveProduct] = useState("");
  const [cards, setCards] = useState<UaCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState("all");
  const [color, setColor] = useState("all");
  const [category, setCategory] = useState("all");
  const [parallelOnly, setParallelOnly] = useState(false);
  const [selected, setSelected] = useState<UaCard | null>(null);
  const cardCache = useRef(new Map<string, UaCard[]>());
  const selectedWork = works.find((work) => work.code === activeWork);
  const datasets = selectedWork?.datasets ?? [];
  const activeDataset = datasets.find((dataset) => dataset.productKey === activeProduct) ?? datasets[0];
  const totalCards = works.reduce(
    (workTotal, work) => workTotal + work.datasets.reduce((total, dataset) => total + dataset.cardCount, 0),
    0,
  );
  const selectedCardTotal = datasets.reduce((total, dataset) => total + dataset.cardCount, 0);

  const resetCatalog = () => {
    setQuery("");
    setRarity("all");
    setColor("all");
    setCategory("all");
    setParallelOnly(false);
    setSelected(null);
  };

  const selectWork = (work: UaWork) => {
    setActiveWork(work.code);
    setActiveProduct(work.datasets[0]?.productKey ?? "");
    setCards([]);
    const url = new URL(window.location.href);
    url.searchParams.set("series", work.code);
    window.history.replaceState({}, "", url);
    resetCatalog();
  };

  const selectDataset = (productKey: string) => {
    if (productKey === activeDataset?.productKey) {
      const cached = cardCache.current.get(productKey);
      if (cached?.length) setCards(cached);
      return;
    }
    setActiveProduct(productKey);
    setCards([]);
    resetCatalog();
  };

  const returnToWorks = () => {
    setActiveWork("");
    setActiveProduct("");
    setCards([]);
    const url = new URL(window.location.href);
    url.searchParams.delete("series");
    window.history.replaceState({}, "", url);
    resetCatalog();
  };

  useEffect(() => {
    const requestedCode = new URLSearchParams(window.location.search).get("series")?.toUpperCase();
    const requestedWork = works.find((work) => work.code === requestedCode);
    if (!requestedWork) return;
    setActiveWork(requestedWork.code);
    setActiveProduct(requestedWork.datasets[0]?.productKey ?? "");
  }, [works]);

  useEffect(() => {
    if (!activeDataset) {
      setCards([]);
      setIsLoading(false);
      return;
    }

    const cached = cardCache.current.get(activeDataset.productKey);
    if (cached) {
      setCards(cached);
      setLoadError("");
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setLoadError("");
    fetch(activeDataset.dataUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<{ cards?: UaCard[] }>;
      })
      .then((data) => {
        if (!data.cards?.length) throw new Error("卡牌数据为空");
        cardCache.current.set(activeDataset.productKey, data.cards);
        if (!cancelled) setCards(data.cards);
      })
      .catch(() => {
        if (!cancelled) setLoadError("暂时无法读取这个产品的本地卡牌资料，请重新选择后再试。");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeDataset]);

  const rarityOptions = useMemo(() => unique(cards.map((card) => card.rarity)), [cards]);
  const categoryOptions = useMemo(() => unique(cards.map((card) => card.category)), [cards]);
  const colorOptions = useMemo(() => unique(cards.map(cardColor)), [cards]);

  const filteredCards = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ja");
    return cards.filter((card) => {
      const searchable = [card.name, card.ruby, card.cardNo, card.effect, card.trigger]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("ja");
      return (
        (!needle || searchable.includes(needle)) &&
        (rarity === "all" || card.rarity === rarity) &&
        (color === "all" || cardColor(card) === color) &&
        (category === "all" || card.category === category) &&
        (!parallelOnly || card.rarity?.includes("★") || card.imageFileName.includes("_p"))
      );
    });
  }, [cards, category, color, parallelOnly, query, rarity]);

  useEffect(() => {
    if (!selected) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selected]);

  return (
    <>
      <header
        className={`series-library__header catalog-context-hero${selectedWork ? " is-series" : ""}`}
        data-series-code={selectedWork?.code}
        style={selectedWork ? { "--catalog-series-cover": `url("${selectedWork.image}")` } as CSSProperties : undefined}
      >
        <div>
          {selectedWork ? (
            <>
              <button className="catalog-hero-back" type="button" onClick={returnToWorks}>← 所有作品</button>
              <p className="series-library__kicker">{selectedWork.code} · UNION ARENA CARD LIST</p>
              <h1>{selectedWork.name}</h1>
              <p>{selectedWork.originalName}</p>
            </>
          ) : (
            <>
              <p className="series-library__kicker">UNION ARENA CARD LIST</p>
              <h1>系列卡表</h1>
              <p>选择作品后查看已收录的官方产品、卡牌资料与高清卡图。</p>
            </>
          )}
        </div>
        <div className="series-library__summary" aria-label={selectedWork ? "当前作品统计" : "资料库统计"}>
          {selectedWork ? (
            <>
              <span><strong>{datasets.length}</strong> 个产品</span>
              <span><strong>{selectedCardTotal}</strong> 张卡牌</span>
            </>
          ) : (
            <>
              <span><strong>{works.length}</strong> 个作品</span>
              <span><strong>{totalCards}</strong> 张卡牌</span>
            </>
          )}
        </div>
      </header>

      <section className={`card-catalog${selectedWork ? "" : " card-catalog--series"}`} aria-label={selectedWork ? `${selectedWork.name}卡牌目录` : "作品目录"}>
        {!selectedWork ? (
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
                const cardCount = work.datasets.reduce((total, dataset) => total + dataset.cardCount, 0);
                return (
                  <button className="series-choice" key={work.code} type="button" onClick={() => selectWork(work)} aria-label={`查看${work.name}卡表`}>
                    <img src={work.image} alt="" />
                    <span className="series-choice__shade" />
                    <span className="series-choice__code">{work.code}</span>
                    <span className="series-choice__meta">
                      <strong>{work.name}</strong>
                      <small>{work.datasets.length} 个产品 · {cardCount} 张卡牌</small>
                    </span>
                    <span className="series-choice__arrow" aria-hidden="true">›</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <>
        <div className="card-toolbar">
          <div className="card-toolbar__products">
            <div className="card-toolbar__products-head">
              <span>卡牌产品</span>
              {activeDataset && <a href={activeDataset.officialListUrl} target="_blank" rel="noreferrer">官方卡表 ↗</a>}
            </div>
            <div className="card-product-tabs" role="tablist" aria-label="卡牌产品">
              {datasets.map((dataset) => (
                <button
                  className={dataset.productKey === activeDataset?.productKey ? "is-active" : ""}
                  key={dataset.productKey}
                  title={dataset.productName}
                  type="button"
                  role="tab"
                  aria-selected={dataset.productKey === activeDataset?.productKey}
                  onClick={() => selectDataset(dataset.productKey)}
                >
                  <strong>{dataset.setCode}</strong>
                  <span>{dataset.cardCount} 张</span>
                </button>
              ))}
            </div>
          </div>
          <label className="card-search">
            <span>搜索卡牌</span>
            <span className="card-search__field">
              <i aria-hidden="true">⌕</i>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={cards[0] ? `例如：${cards[0].name} / ${cards[0].cardNo}` : "输入关键词"} />
            </span>
          </label>
          <label>
            <span>稀有度</span>
            <select value={rarity} onChange={(event) => setRarity(event.target.value)}>
              <option value="all">全部</option>
              {rarityOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            <span>颜色</span>
            <select value={color} onChange={(event) => setColor(event.target.value)}>
              <option value="all">全部</option>
              {colorOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            <span>卡牌类型</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="all">全部</option>
              {categoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="parallel-filter">
            <input type="checkbox" checked={parallelOnly} onChange={(event) => setParallelOnly(event.target.checked)} />
            <span>仅看平行卡</span>
          </label>
        </div>

        {isLoading ? (
          <div className="card-loading" role="status"><span /><p>正在读取 {activeDataset?.setCode} 卡牌资料…</p></div>
        ) : loadError ? (
          <div className="card-empty"><span>!</span><h2>卡牌资料读取失败</h2><p>{loadError}</p></div>
        ) : (
          <>
        <div className="card-results-heading">
          <p><span>{activeDataset?.setCode}</span> · 显示 <strong>{filteredCards.length}</strong> / {cards.length} 张</p>
          {(query || rarity !== "all" || color !== "all" || category !== "all" || parallelOnly) && (
            <button type="button" onClick={() => { setQuery(""); setRarity("all"); setColor("all"); setCategory("all"); setParallelOnly(false); }}>清除筛选</button>
          )}
        </div>

        {filteredCards.length ? (
          <div className="official-card-grid">
            {filteredCards.map((card) => (
              <button className="official-card" data-color={cardColor(card)} key={card.image} type="button" onClick={() => setSelected(card)}>
                <span className="official-card__image">
                  <img src={card.image} alt={`${card.cardNo} ${card.name}`} loading="lazy" />
                  {card.rarity && <span className="official-card__rarity">{card.rarity}</span>}
                </span>
                <span className="official-card__meta">
                  <strong>{card.name}</strong>
                  <small>{card.cardNo}</small>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="card-empty"><span>⌕</span><h2>没有符合条件的卡牌</h2><p>试试缩短关键词或清除筛选条件。</p></div>
        )}
          </>
        )}
          </>
        )}
      </section>

      {selected && (
        <div className="card-modal" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelected(null); }}>
          <section className="card-modal__panel" role="dialog" aria-modal="true" aria-labelledby="card-modal-title">
            <button className="card-modal__close" type="button" aria-label="关闭卡牌详情" onClick={() => setSelected(null)}>×</button>
            <div className="card-modal__image"><img src={selected.image} alt={`${selected.cardNo} ${selected.name}`} /></div>
            <div className="card-modal__content">
              <p className="card-modal__eyebrow">{selected.cardNo} · {selected.rarity || "-"}</p>
              <h2 id="card-modal-title">{selected.name}</h2>
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
