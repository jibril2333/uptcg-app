"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mergeDecks, storeDecks, type SavedDeck } from "../decks/deck-storage";
import {
  storeCollectionEntries,
  type CollectionEntries,
  type CollectionEntry,
} from "../collection/collection-storage";
import { storePinnedCodes } from "../components/pinned-series-storage";

type BackupFile = {
  data: {
    collection: CollectionEntries;
    decks: SavedDeck[];
    pinnedSeries: string[];
  };
  exportedAt: string;
  format: "uptcg-backup";
  version: 1;
};

type Snapshot = BackupFile["data"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSavedDeck(value: unknown): value is SavedDeck {
  if (!isRecord(value)) return false;
  return typeof value.id === "string"
    && typeof value.name === "string"
    && typeof value.seriesCode === "string"
    && typeof value.seriesName === "string"
    && typeof value.updatedAt === "string"
    && Array.isArray(value.cards);
}

function isCollectionEntry(value: unknown): value is CollectionEntry {
  if (!isRecord(value)) return false;
  return isRecord(value.card)
    && typeof value.count === "number"
    && Number.isInteger(value.count)
    && Number(value.count) > 0
    && Number(value.count) <= 99
    && typeof value.updatedAt === "string"
    && typeof value.workCode === "string"
    && typeof value.workName === "string";
}

function parseBackup(value: unknown): BackupFile | null {
  if (!isRecord(value) || value.format !== "uptcg-backup" || value.version !== 1 || typeof value.exportedAt !== "string") return null;
  if (!isRecord(value.data)) return null;
  const { collection, decks, pinnedSeries } = value.data;
  if (!Array.isArray(decks) || decks.length > 100 || !decks.every(isSavedDeck)) return null;
  if (!isRecord(collection)) return null;
  const collectionEntries = Object.entries(collection);
  if (collectionEntries.length > 10_000 || collectionEntries.some(([key, entry]) => !key || key.length > 500 || !isCollectionEntry(entry))) return null;
  if (!Array.isArray(pinnedSeries)
    || pinnedSeries.length > 10
    || pinnedSeries.some((code) => typeof code !== "string" || !code || code.length > 30)
    || new Set(pinnedSeries).size !== pinnedSeries.length) return null;
  return value as BackupFile;
}

function mergeCollection(current: CollectionEntries, imported: CollectionEntries) {
  const merged = { ...current };
  for (const [key, entry] of Object.entries(imported)) {
    const existing = merged[key];
    if (!existing || Date.parse(entry.updatedAt) >= Date.parse(existing.updatedAt)) merged[key] = entry;
  }
  return merged;
}

function backupDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "日期未知";
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tokyo" }).format(date);
}

async function readDatabaseSnapshot(): Promise<Snapshot> {
  const [deckResponse, collectionResponse, pinnedResponse] = await Promise.all([
    fetch("/api/decks", { cache: "no-store" }),
    fetch("/api/collection", { cache: "no-store" }),
    fetch("/api/pinned-series", { cache: "no-store" }),
  ]);
  if (!deckResponse.ok || !collectionResponse.ok || !pinnedResponse.ok) throw new Error("database_read_failed");
  const [deckData, collectionData, pinnedData] = await Promise.all([
    deckResponse.json() as Promise<{ decks?: SavedDeck[] }>,
    collectionResponse.json() as Promise<{ entries?: CollectionEntries }>,
    pinnedResponse.json() as Promise<{ codes?: string[] }>,
  ]);
  if (!Array.isArray(deckData.decks)
    || !isRecord(collectionData.entries)
    || !Array.isArray(pinnedData.codes)) throw new Error("database_read_failed");
  return {
    collection: collectionData.entries as CollectionEntries,
    decks: deckData.decks,
    pinnedSeries: pinnedData.codes.filter((code): code is string => typeof code === "string"),
  };
}

function snapshotStats(snapshot: Snapshot) {
  return {
    collectionCopies: Object.values(snapshot.collection).reduce((total, entry) => total + entry.count, 0),
    collectionKinds: Object.keys(snapshot.collection).length,
    decks: snapshot.decks.length,
    pinned: snapshot.pinnedSeries.length,
  };
}

export function SettingsPanel({
  cardCount,
  productCount,
  seriesCodes,
  syncedAt,
  workCount,
}: {
  cardCount: number;
  productCount: number;
  seriesCodes: string[];
  syncedAt: string;
  workCount: number;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [pendingBackup, setPendingBackup] = useState<BackupFile | null>(null);
  const [notice, setNotice] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const validCodes = useMemo(() => new Set(seriesCodes), [seriesCodes]);

  const refreshSnapshot = useCallback(async () => {
    try {
      setSnapshot(await readDatabaseSnapshot());
      setNotice("");
    } catch {
      setNotice("暂时无法读取本机数据库，请稍后重试。");
    }
  }, []);

  useEffect(() => {
    void refreshSnapshot();
  }, [refreshSnapshot]);

  const exportBackup = async () => {
    setIsBusy(true);
    setNotice("正在整理备份…");
    try {
      const current = await readDatabaseSnapshot();
      const backup: BackupFile = {
        data: current,
        exportedAt: new Date().toISOString(),
        format: "uptcg-backup",
        version: 1,
      };
      const blob = new Blob([`${JSON.stringify(backup, null, 2)}\n`], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `uptcg-backup-${backup.exportedAt.slice(0, 10)}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setSnapshot(current);
      setNotice("备份文件已下载。请把它保存在安全的位置。");
    } catch {
      setNotice("备份失败，数据库没有被修改。请稍后重试。");
    } finally {
      setIsBusy(false);
    }
  };

  const chooseBackup = async (file: File | undefined) => {
    if (!file) return;
    setNotice("");
    try {
      if (file.size > 100 * 1024 * 1024) throw new Error("backup_too_large");
      const parsed = parseBackup(JSON.parse(await file.text()));
      if (!parsed) throw new Error("invalid_backup");
      setPendingBackup(parsed);
    } catch {
      setPendingBackup(null);
      setNotice("无法识别这个备份文件。请选择由本设置页导出的 JSON 文件。");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const restoreBackup = async () => {
    if (!pendingBackup) return;
    setIsBusy(true);
    setNotice("正在安全合并备份…");
    try {
      const current = await readDatabaseSnapshot();
      const nextDecks = mergeDecks(current.decks, pendingBackup.data.decks);
      const nextCollection = mergeCollection(current.collection, pendingBackup.data.collection);
      const nextPinned = [
        ...pendingBackup.data.pinnedSeries,
        ...current.pinnedSeries.filter((code) => !pendingBackup.data.pinnedSeries.includes(code)),
      ].filter((code) => validCodes.has(code)).slice(0, 10);

      await storeDecks(nextDecks);
      await storeCollectionEntries(nextCollection);
      await storePinnedCodes(nextPinned);
      setSnapshot({ collection: nextCollection, decks: nextDecks, pinnedSeries: nextPinned });
      setPendingBackup(null);
      setNotice("备份已合并恢复。现有较新的资料和备份中没有的资料都已保留。");
    } catch {
      setNotice("恢复没有完整完成。现有资料不会被清空，请重新读取页面后再试。");
    } finally {
      setIsBusy(false);
    }
  };

  const stats = snapshot ? snapshotStats(snapshot) : null;
  const pendingStats = pendingBackup ? snapshotStats(pendingBackup.data) : null;

  return (
    <div className="settings-content">
      <section className="settings-section" aria-labelledby="settings-data-title">
        <div className="settings-section__heading">
          <div><p>YOUR DATA</p><h2 id="settings-data-title">个人资料</h2></div>
          <button type="button" onClick={() => void refreshSnapshot()} disabled={isBusy}>重新读取</button>
        </div>
        <div className="settings-stat-grid" aria-live="polite">
          <article><span>牌组</span><strong>{stats?.decks ?? "—"}</strong><small>副</small></article>
          <article><span>收藏种类</span><strong>{stats?.collectionKinds ?? "—"}</strong><small>种</small></article>
          <article><span>收藏数量</span><strong>{stats?.collectionCopies ?? "—"}</strong><small>张</small></article>
          <article><span>置顶作品</span><strong>{stats?.pinned ?? "—"}</strong><small>个</small></article>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="settings-backup-title">
        <div className="settings-section__heading">
          <div><p>BACKUP &amp; RESTORE</p><h2 id="settings-backup-title">备份与恢复</h2></div>
        </div>
        <div className="settings-action-grid">
          <article className="settings-action-card">
            <span className="settings-action-card__icon" aria-hidden="true">↓</span>
            <div><h3>导出完整备份</h3><p>下载牌组、收藏数量和首页置顶。卡牌图片与官方卡表不会写入备份。</p></div>
            <button className="settings-primary-button" type="button" disabled={isBusy} onClick={() => void exportBackup()}>导出 JSON</button>
          </article>
          <article className="settings-action-card">
            <span className="settings-action-card__icon" aria-hidden="true">↑</span>
            <div><h3>从备份恢复</h3><p>安全合并 JSON 备份，不会删除备份中没有的现有资料，也不会用旧记录覆盖较新记录。</p></div>
            <input ref={fileInput} hidden type="file" accept="application/json,.json" onChange={(event) => void chooseBackup(event.target.files?.[0])} />
            <button type="button" disabled={isBusy} onClick={() => fileInput.current?.click()}>选择备份</button>
          </article>
        </div>

        {pendingBackup && pendingStats && (
          <div className="settings-restore-preview" role="status">
            <div>
              <span>等待确认的备份</span>
              <strong>{backupDate(pendingBackup.exportedAt)}</strong>
              <small>{pendingStats.decks} 副牌组 · {pendingStats.collectionKinds} 种／{pendingStats.collectionCopies} 张收藏 · {pendingStats.pinned} 个置顶</small>
            </div>
            <div>
              <button type="button" disabled={isBusy} onClick={() => setPendingBackup(null)}>取消</button>
              <button className="settings-primary-button" type="button" disabled={isBusy} onClick={() => void restoreBackup()}>确认合并恢复</button>
            </div>
          </div>
        )}
        {notice && <p className="settings-notice" role="status">{notice}</p>}
      </section>

      <section className="settings-section" aria-labelledby="settings-system-title">
        <div className="settings-section__heading">
          <div><p>CATALOG &amp; SYSTEM</p><h2 id="settings-system-title">卡表与运行环境</h2></div>
        </div>
        <div className="settings-info-grid">
          <article>
            <span>官方卡表缓存</span>
            <strong>{workCount} 个作品 · {productCount} 个分类</strong>
            <small>{cardCount.toLocaleString("zh-CN")} 张卡牌{syncedAt ? ` · 最近同步 ${backupDate(syncedAt)}` : ""}</small>
            <a href="/cards">浏览官方卡表 <b>→</b></a>
          </article>
          <article>
            <span>本机服务</span>
            <strong>Docker · SQLite</strong>
            <small>服务端口 3002 · Cloudflare Tunnel 对外访问 · GitHub Actions 自动部署</small>
            <a href="/decks">管理我的牌组 <b>→</b></a>
          </article>
          <article>
            <span>资料位置</span>
            <strong>持久化储存</strong>
            <small>数据库与卡表位于 Docker 外部目录，更新容器不会删除个人资料。</small>
            <a href="/collection">管理我的收集 <b>→</b></a>
          </article>
        </div>
      </section>
    </div>
  );
}
