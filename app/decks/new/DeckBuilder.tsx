"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { UaCard, UaWork } from "../../cards/CardCatalog";
import { loadDecks, storeDecks, type SavedDeck, type SavedDeckCard } from "../deck-storage";

const DECK_COLORS = [
  { code: "赤", label: "红色", hex: "#d84c45" },
  { code: "青", label: "蓝色", hex: "#3288d1" },
  { code: "黄", label: "黄色", hex: "#dcae27" },
  { code: "緑", label: "绿色", hex: "#43a269" },
  { code: "紫", label: "紫色", hex: "#9561c7" },
];

function unique(values: Array<string | undefined>) {
  return [...new Set(values.filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "ja"));
}

function cardColor(card: UaCard) {
  return card.needEnergy?.match(/^[赤青黄緑紫]/)?.[0] ?? "";
}

function colorLabel(code: string) {
  return DECK_COLORS.find((color) => color.code === code)?.label ?? code;
}

function cardCost(card: UaCard) {
  return Number.parseInt(card.needEnergy?.match(/\d+/)?.[0] || "0", 10);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

export function DeckBuilder({ works }: { works: UaWork[] }) {
  const [hasStarted, setHasStarted] = useState(false);
  const [activeWorkCode, setActiveWorkCode] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [activeProduct, setActiveProduct] = useState("");
  const [cards, setCards] = useState<UaCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [rarity, setRarity] = useState("all");
  const [parallelOnly, setParallelOnly] = useState(false);
  const [deckName, setDeckName] = useState("我的牌組");
  const [deckId, setDeckId] = useState("");
  const [deckEntries, setDeckEntries] = useState<Record<string, SavedDeckCard>>({});
  const [notice, setNotice] = useState("");
  const cardCache = useRef(new Map<string, UaCard[]>());

  const activeWork = works.find((work) => work.code === activeWorkCode);
  const allDatasets = useMemo(() => activeWork?.datasets ?? [], [activeWork]);
  const datasets = selectedColor
    ? allDatasets.filter((dataset) => !dataset.colors.length || dataset.colors.includes(selectedColor))
    : allDatasets;
  const activeDataset = datasets.find((dataset) => dataset.productKey === activeProduct) ?? datasets[0];
  const availableColors = useMemo(() => {
    const values = new Set(allDatasets.flatMap((dataset) => dataset.colors));
    return DECK_COLORS.filter((color) => values.has(color.code));
  }, [allDatasets]);
  const deckItems = useMemo(
    () => Object.values(deckEntries).sort((a, b) => a.card.cardNo.localeCompare(b.card.cardNo, "ja")),
    [deckEntries],
  );
  const totalCount = useMemo(() => deckItems.reduce((total, item) => total + item.count, 0), [deckItems]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const requestedSeries = params.get("series")?.toUpperCase();
    const requestedWork = works.find((work) => work.code === requestedSeries);
    if (requestedWork) {
      setActiveWorkCode(requestedWork.code);
      setActiveProduct(requestedWork.datasets[0]?.productKey ?? "");
      const requestedColor = params.get("color");
      if (requestedColor && requestedWork.datasets.some((dataset) => dataset.colors.includes(requestedColor))) {
        setSelectedColor(requestedColor);
      }
    }

    const requestedDeck = params.get("id");
    if (!requestedDeck) return;
    void loadDecks().then((decks) => {
      const saved = decks.find((deck) => deck.id === requestedDeck);
      if (!saved || cancelled) return;
      const savedWork = works.find((work) => work.code === saved.seriesCode);
      const savedColor = saved.color || (saved.cards[0] ? cardColor(saved.cards[0].card) : "");
      const savedProductKey = saved.cards[0]?.card.image.split("/")[2];
      setDeckId(saved.id);
      setDeckName(saved.name);
      setDeckEntries(Object.fromEntries(saved.cards.map((item) => [item.card.image, item])));
      setSelectedColor(savedColor);
      setHasStarted(true);
      if (savedWork) {
        const compatibleDatasets = savedWork.datasets.filter((dataset) => !savedColor || dataset.colors.includes(savedColor));
        setActiveWorkCode(savedWork.code);
        setActiveProduct(
          compatibleDatasets.find((dataset) => dataset.productKey === savedProductKey)?.productKey
            ?? compatibleDatasets[0]?.productKey
            ?? savedWork.datasets[0]?.productKey
            ?? "",
        );
      }
    });
    return () => { cancelled = true; };
  }, [works]);

  useEffect(() => {
    if (!hasStarted || !activeDataset) {
      setCards([]);
      setIsLoading(false);
      return;
    }
    const cached = cardCache.current.get(activeDataset.productKey);
    if (cached) {
      setCards(cached);
      setLoadError("");
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
        if (!data.cards?.length) throw new Error("empty");
        cardCache.current.set(activeDataset.productKey, data.cards);
        if (!cancelled) setCards(data.cards);
      })
      .catch(() => {
        if (!cancelled) setLoadError("暂时无法读取这个产品的卡牌资料。");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeDataset, hasStarted]);

  const categoryOptions = useMemo(() => unique(cards.map((card) => card.category)), [cards]);
  const rarityOptions = useMemo(() => unique(cards.map((card) => card.rarity)), [cards]);
  const filteredCards = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ja");
    return cards.filter((card) => {
      const searchable = [card.name, card.ruby, card.cardNo, card.effect].filter(Boolean).join(" ").toLocaleLowerCase("ja");
      const color = cardColor(card);
      return (
        (!needle || searchable.includes(needle)) &&
        (category === "all" || card.category === category) &&
        (!color || color === selectedColor) &&
        (rarity === "all" || card.rarity === rarity) &&
        (!parallelOnly || card.rarity?.includes("★") || card.imageFileName.includes("_p"))
      );
    });
  }, [cards, category, parallelOnly, query, rarity, selectedColor]);

  const energyCurve = useMemo(() => {
    const values = [0, 0, 0, 0, 0, 0];
    for (const item of deckItems) values[Math.min(cardCost(item.card), 5)] += item.count;
    return values;
  }, [deckItems]);
  const maxCurve = Math.max(...energyCurve, 1);
  const apCount = deckItems.filter((item) => item.card.category === "アクションポイント").reduce((total, item) => total + item.count, 0);
  const triggerCount = deckItems.filter((item) => item.card.trigger && item.card.trigger !== "-").reduce((total, item) => total + item.count, 0);

  const resetFilters = () => {
    setQuery("");
    setCategory("all");
    setRarity("all");
    setParallelOnly(false);
  };

  const selectProduct = (productKey: string) => {
    if (productKey === activeDataset?.productKey) {
      const cached = cardCache.current.get(productKey);
      if (cached?.length) setCards(cached);
      return;
    }
    setActiveProduct(productKey);
    setCards([]);
    resetFilters();
  };

  const selectSetupWork = (code: string) => {
    const work = works.find((item) => item.code === code);
    if (!work) return;
    setActiveWorkCode(work.code);
    setActiveProduct(work.datasets[0]?.productKey ?? "");
    setSelectedColor("");
  };

  const startBuilding = () => {
    if (!activeWork || !selectedColor) return;
    const compatibleDataset = allDatasets.find(
      (dataset) => dataset.productKey === activeProduct && dataset.colors.includes(selectedColor),
    ) ?? allDatasets.find((dataset) => dataset.colors.includes(selectedColor));
    if (!compatibleDataset) return;
    setActiveProduct(compatibleDataset.productKey);
    setCards([]);
    setHasStarted(true);
    resetFilters();
    const url = new URL(window.location.href);
    url.searchParams.set("series", activeWork.code);
    url.searchParams.set("color", selectedColor);
    url.searchParams.delete("id");
    window.history.replaceState({}, "", url);
  };

  const returnToSetup = () => {
    if (totalCount && !window.confirm("重新选择作品或颜色会清空当前牌组，是否继续？")) return;
    setDeckEntries({});
    setDeckId("");
    setCards([]);
    setNotice("");
    setHasStarted(false);
    resetFilters();
    const url = new URL(window.location.href);
    url.searchParams.delete("id");
    window.history.replaceState({}, "", url);
  };

  const addCard = (card: UaCard) => {
    const color = cardColor(card);
    if (color && color !== selectedColor) return setNotice(`当前牌组只能加入${colorLabel(selectedColor)}卡牌。`);
    const sameNumberCount = deckItems.filter((item) => item.card.cardNo === card.cardNo).reduce((total, item) => total + item.count, 0);
    if (totalCount >= 50) return setNotice("牌组已经达到 50 张上限。");
    if (sameNumberCount >= 4) return setNotice("同一卡号最多加入 4 张。 ");
    setDeckEntries((current) => ({
      ...current,
      [card.image]: { card, count: (current[card.image]?.count || 0) + 1 },
    }));
    setNotice(`${card.name} 已加入牌组`);
  };

  const removeCard = (image: string) => {
    setDeckEntries((current) => {
      const item = current[image];
      if (!item) return current;
      const next = { ...current };
      if (item.count <= 1) delete next[image];
      else next[image] = { ...item, count: item.count - 1 };
      return next;
    });
  };

  const saveDeck = async () => {
    if (!totalCount) return setNotice("请先加入至少一张卡牌。");
    if (!activeWork) return setNotice("请选择一个作品。");
    const id = deckId || window.crypto.randomUUID();
    const deck: SavedDeck = {
      id,
      name: deckName.trim() || "我的牌組",
      seriesCode: activeWork.code,
      seriesName: activeWork.name,
      color: selectedColor,
      cards: deckItems,
      updatedAt: new Date().toISOString(),
    };
    setNotice("正在保存到数据库…");
    try {
      const saved = await loadDecks();
      await storeDecks([deck, ...saved.filter((item) => item.id !== id)]);
      window.location.href = "/decks";
    } catch {
      setNotice("数据库保存失败，请稍后重试。");
    }
  };

  const exportDeck = async () => {
    if (!totalCount || !activeWork) return setNotice("牌组为空，暂时无法导出。");
    setNotice("正在生成牌组图片…");
    const expanded = deckItems.flatMap((item) => Array.from({ length: item.count }, () => item.card));
    try {
      const images = await Promise.all(expanded.map((card) => loadImage(card.image)));
      const canvas = document.createElement("canvas");
      canvas.width = 1680;
      canvas.height = 1120;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("canvas");
      context.fillStyle = "#0b0c0f";
      context.fillRect(0, 0, canvas.width, canvas.height);
      const glow = context.createRadialGradient(1400, 130, 20, 1400, 130, 700);
      glow.addColorStop(0, "rgba(243,164,32,.18)");
      glow.addColorStop(1, "rgba(13,14,16,0)");
      context.fillStyle = glow;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#f2a51f";
      context.font = "700 28px sans-serif";
      context.fillText("UPTCG · UNION ARENA", 52, 52);
      context.fillStyle = "#f5f5f4";
      context.font = "800 46px sans-serif";
      context.fillText(deckName.trim() || "我的牌組", 52, 105);
      context.fillStyle = "#8a8a91";
      context.font = "22px sans-serif";
      context.fillText(`${activeWork.name} · ${colorLabel(selectedColor)} · ${totalCount}/50 张`, 52, 142);
      const cardWidth = 145;
      const cardHeight = 203;
      const gap = 14;
      images.forEach((image, index) => {
        const column = index % 10;
        const row = Math.floor(index / 10);
        context.drawImage(image, 52 + column * (cardWidth + gap), 176 + row * (cardHeight + gap), cardWidth, cardHeight);
      });
      canvas.toBlob((blob) => {
        if (!blob) return setNotice("导出失败，请重试。");
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${deckName.trim() || "uptcg-deck"}.png`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        setNotice("牌组图片已生成。");
      }, "image/png");
    } catch {
      setNotice("导出失败，请重试。");
    }
  };

  if (!hasStarted) {
    return (
      <section className="deck-setup">
        <header className="deck-setup__hero">
          <div>
            <p>NEW DECK</p>
            <h1>新建牌组</h1>
            <span>先选择作品和颜色，再开始挑选卡牌</span>
          </div>
          <ol aria-label="新建牌组步骤">
            <li className={activeWork ? "is-complete" : "is-current"}><b>1</b><span>选择作品</span></li>
            <li className={activeWork && !selectedColor ? "is-current" : selectedColor ? "is-complete" : ""}><b>2</b><span>选择颜色</span></li>
            <li><b>3</b><span>选择卡牌</span></li>
          </ol>
        </header>

        <div className="deck-setup__content">
          <section className="deck-setup-section">
            <div className="deck-setup-section__heading"><div><span>STEP 01</span><h2>选择作品</h2></div><p>每个牌组只能使用同一部作品的卡牌</p></div>
            <div className="deck-setup-work-grid">
              {works.map((work) => (
                <button
                  className={`deck-setup-work${work.code === activeWorkCode ? " is-selected" : ""}`}
                  key={work.code}
                  type="button"
                  aria-pressed={work.code === activeWorkCode}
                  onClick={() => selectSetupWork(work.code)}
                >
                  <img src={work.image} alt="" loading="lazy" />
                  <span className="deck-setup-work__shade" />
                  <span className="deck-setup-work__meta"><strong>{work.name}</strong><small>{work.code} · {work.datasets.reduce((total, dataset) => total + dataset.cardCount, 0)} 张</small></span>
                  <span className="deck-setup-work__check">✓</span>
                </button>
              ))}
            </div>
          </section>

          <section className={`deck-setup-section deck-setup-colors${activeWork ? " is-ready" : ""}`}>
            <div className="deck-setup-section__heading"><div><span>STEP 02</span><h2>选择颜色</h2></div><p>{activeWork ? `选择「${activeWork.name}」牌组的颜色` : "请先在上方选择作品"}</p></div>
            <div className="deck-color-grid">
              {DECK_COLORS.map((color) => {
                const isAvailable = availableColors.some((item) => item.code === color.code);
                return (
                  <button
                    className={color.code === selectedColor ? "is-selected" : ""}
                    style={{ "--deck-color": color.hex } as CSSProperties}
                    key={color.code}
                    type="button"
                    disabled={!activeWork || !isAvailable}
                    aria-pressed={color.code === selectedColor}
                    onClick={() => setSelectedColor(color.code)}
                  >
                    <i /><span><strong>{color.label}</strong><small>{isAvailable && activeWork ? "可用于这个作品" : "这个作品暂无此颜色"}</small></span><b>✓</b>
                  </button>
                );
              })}
            </div>
          </section>

          <footer className="deck-setup-footer">
            <div>
              <span>当前选择</span>
              <strong>{activeWork ? activeWork.name : "尚未选择作品"}{selectedColor ? ` · ${colorLabel(selectedColor)}` : ""}</strong>
            </div>
            <button type="button" disabled={!activeWork || !selectedColor} onClick={startBuilding}>开始选择卡牌 <span>→</span></button>
          </footer>
        </div>
      </section>
    );
  }

  return (
    <div className="deck-builder-layout">
      <section className="deck-builder-main">
        <header className="deck-builder-header" style={{ "--deck-series-cover": `url(${activeWork?.image})` } as CSSProperties}>
          <div>
            <p>DECK BUILDER</p>
            <h1>{activeWork?.name}</h1>
            <span>{colorLabel(selectedColor)} · {activeDataset?.productName}</span>
          </div>
          <button className="deck-builder-change-setup" type="button" onClick={returnToSetup}><i style={{ "--deck-color": DECK_COLORS.find((color) => color.code === selectedColor)?.hex } as CSSProperties} />更改作品 / 颜色</button>
        </header>

        <div className="deck-builder-controls">
          <div className="deck-builder-product-tabs">
            {datasets.map((dataset) => (
              <button className={dataset.productKey === activeDataset?.productKey ? "is-active" : ""} key={dataset.productKey} type="button" onClick={() => selectProduct(dataset.productKey)}>
                <strong>{dataset.setCode}</strong><span>{dataset.cardCount} 张</span>
              </button>
            ))}
          </div>
          <div className="deck-builder-filters">
            <label className="deck-builder-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索卡名、编号或效果…" /></label>
            <select aria-label="卡牌类型" value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">全部类型</option>{categoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>
            <select aria-label="稀有度" value={rarity} onChange={(event) => setRarity(event.target.value)}><option value="all">全部稀有度</option>{rarityOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>
            <label className="deck-builder-parallel"><input type="checkbox" checked={parallelOnly} onChange={(event) => setParallelOnly(event.target.checked)} />平行卡</label>
          </div>
          <div className="deck-builder-results"><p>显示 <strong>{filteredCards.length}</strong> / {cards.length} 张 {colorLabel(selectedColor)}卡牌 · 点击卡牌加入牌组</p>{(query || category !== "all" || rarity !== "all" || parallelOnly) && <button type="button" onClick={resetFilters}>清除筛选</button>}</div>
        </div>

        {isLoading ? (
          <div className="card-loading" role="status"><span /><p>正在读取 {activeDataset?.setCode} 卡牌资料…</p></div>
        ) : loadError ? (
          <div className="card-empty"><span>!</span><h2>读取失败</h2><p>{loadError}</p></div>
        ) : (
          <div className="builder-card-grid">
            {filteredCards.map((card) => {
              const quantity = deckEntries[card.image]?.count || 0;
              return (
                <button className="builder-card" data-color={cardColor(card)} key={card.image} type="button" onClick={() => addCard(card)} aria-label={`加入 ${card.name}`}>
                  <span className="builder-card__image"><img src={card.image} alt={`${card.cardNo} ${card.name}`} loading="lazy" /><span className="builder-card__add">＋</span>{quantity > 0 && <span className="builder-card__quantity">×{quantity}</span>}</span>
                  <span className="builder-card__meta"><strong>{card.name}</strong><small>{card.cardNo} · {card.rarity}</small></span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <aside className="deck-editor" aria-label="牌组编辑器">
        <header><div><strong>牌組編輯器</strong><span>{activeWork?.name} · {colorLabel(selectedColor)}</span></div><a href="/decks" aria-label="关闭编辑器">×</a></header>
        <div className="deck-editor__scroll">
          <section className="deck-summary-card">
            <label><span>牌组名称</span><input value={deckName} maxLength={40} onChange={(event) => setDeckName(event.target.value)} /></label>
            <div className="deck-count"><strong>{totalCount}</strong><span>/ 50</span><div><i style={{ width: `${Math.min(totalCount / 50, 1) * 100}%` }} /></div></div>
            <div className="deck-badges"><span>{colorLabel(selectedColor)}</span><span>AP {apCount}</span><span>触发 {triggerCount}</span><span>{deckItems.length} 种卡</span></div>
            <div className="energy-curve" aria-label="能量曲线">
              {energyCurve.map((value, index) => <span key={index}><i style={{ height: `${Math.max((value / maxCurve) * 42, value ? 5 : 1)}px` }} /><strong>{value}</strong><small>{index === 5 ? "5+" : index}</small></span>)}
            </div>
          </section>

          <div className="deck-editor__list-heading"><strong>牌组内容</strong><span>{totalCount ? "点击卡牌减少数量" : "从左侧选择卡牌"}</span></div>
          {deckItems.length ? (
            <div className="deck-editor-card-grid">
              {deckItems.map((item) => <button key={item.card.image} type="button" onClick={() => removeCard(item.card.image)} aria-label={`移除一张 ${item.card.name}`}><img src={item.card.image} alt="" /><span>×{item.count}</span></button>)}
            </div>
          ) : (
            <div className="deck-editor-empty"><span>♧</span><p>牌组还是空的</p><small>点击左侧卡牌加入牌组</small></div>
          )}
        </div>
        <div className="deck-editor__actions">
          {notice && <p role="status">{notice}</p>}
          <button className="deck-save-button" type="button" onClick={saveDeck}>▣ 保存牌組</button>
          <div><button type="button" onClick={exportDeck}>⇩ 导出图片</button><button type="button" onClick={() => { setDeckEntries({}); setNotice("牌组已清空。"); }}>⌫ 清空</button></div>
        </div>
      </aside>
    </div>
  );
}
