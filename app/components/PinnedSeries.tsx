"use client";

import { useEffect, useMemo, useState } from "react";
import type { SeriesItem } from "../series-data";
import { loadPinnedCodes, storePinnedCodes } from "./pinned-series-storage";

const MAX_PINNED = 10;

function SeriesTile({ item, isPinned, onToggle }: { item: SeriesItem; isPinned: boolean; onToggle: () => void }) {
  return (
    <article className="series-card-wrap">
      <a className="series-card" href={`/cards?series=${item.code}`} aria-label={`查看 ${item.name} 卡表`}>
        <img src={item.image ?? `/assets/series/${item.code}.${item.ext}`} alt={item.name} loading="lazy" referrerPolicy="no-referrer" />
        <span className="series-card__shade" />
        <span className="series-card__code">{item.code}</span>
        <span className="series-card__name">{item.name}</span>
      </a>
      <button className={`series-pin-button${isPinned ? " is-pinned" : ""}`} type="button" aria-pressed={isPinned} aria-label={isPinned ? `取消置顶 ${item.name}` : `置顶 ${item.name}`} title={isPinned ? "取消置顶" : "添加到我的置顶"} onClick={onToggle}>★</button>
    </article>
  );
}

export function PinnedSeries({ items }: { items: SeriesItem[] }) {
  const [pinnedCodes, setPinnedCodes] = useState<string[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    void loadPinnedCodes(new Set(items.map((item) => item.code)), MAX_PINNED).then((codes) => {
      if (!cancelled) setPinnedCodes(codes);
    }).finally(() => {
      if (!cancelled) setIsReady(true);
    });
    return () => { cancelled = true; };
  }, [items]);

  const pinnedItems = useMemo(
    () => pinnedCodes.map((code) => items.find((item) => item.code === code)).filter(Boolean) as SeriesItem[],
    [items, pinnedCodes],
  );

  const togglePinned = async (code: string) => {
    const exists = pinnedCodes.includes(code);
    if (!exists && pinnedCodes.length >= MAX_PINNED) {
      setNotice(`最多可以置顶 ${MAX_PINNED} 个系列。`);
      return;
    }
    const previous = pinnedCodes;
    const next = exists ? pinnedCodes.filter((item) => item !== code) : [...pinnedCodes, code];
    setPinnedCodes(next);
    setNotice("正在保存…");
    try {
      await storePinnedCodes(next);
      setNotice(exists ? "已取消置顶。" : "已添加到我的置顶。 ");
    } catch {
      setPinnedCodes(previous);
      setNotice("数据库保存失败，请重试。");
    }
  };

  return (
    <>
      <section className="series-section pinned-series-section" id="pinned" aria-labelledby="pinned-title">
        <div className="section-heading">
          <h2 id="pinned-title"><span aria-hidden="true">★</span> 我的置顶</h2>
          <span>{pinnedCodes.length} / {MAX_PINNED}</span>
        </div>
        {!isReady ? (
          <div className="pinned-series-empty"><span className="deck-library-empty__loader" /><p>正在读取置顶系列…</p></div>
        ) : pinnedItems.length ? (
          <div className="popular-row">
            {pinnedItems.map((item) => <SeriesTile item={item} isPinned key={item.code} onToggle={() => togglePinned(item.code)} />)}
          </div>
        ) : (
          <div className="pinned-series-empty"><span aria-hidden="true">☆</span><div><strong>还没有置顶系列</strong><p>在下方“所有系列”中点击 ★，常用系列就会显示在这里。</p></div></div>
        )}
        {notice && <p className="pinned-series-notice" role="status">{notice}</p>}
      </section>

      <section className="series-section" id="series" aria-labelledby="series-title">
        <div className="section-heading">
          <h2 id="series-title"><span aria-hidden="true">▦</span> 所有系列</h2>
          <span>共 {items.length} 个作品 · 点击 ★ 置顶</span>
        </div>
        <div className="series-grid">
          {items.map((item) => <SeriesTile item={item} isPinned={pinnedCodes.includes(item.code)} key={item.code} onToggle={() => togglePinned(item.code)} />)}
        </div>
      </section>
    </>
  );
}
