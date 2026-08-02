import type { Metadata } from "next";
import { buildWorks } from "../card-data";
import { SiteNavigation } from "../components/SiteNavigation";
import { SettingsPanel } from "./SettingsPanel";

export const metadata: Metadata = {
  title: "設定｜UPTCG",
  description: "管理 UPTCG 本机资料备份、恢复与卡表状态。",
};

export default function SettingsPage() {
  const works = buildWorks();
  const datasets = works.flatMap((work) => work.datasets);
  const syncedAt = datasets
    .map((dataset) => dataset.syncedAt)
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a))[0] ?? "";

  return (
    <div className="site-shell">
      <SiteNavigation active="settings" />
      <main className="main-content settings-page">
        <header className="settings-hero">
          <div>
            <p>SETTINGS</p>
            <h1>設定</h1>
          </div>
        </header>

        <SettingsPanel
          cardCount={datasets.reduce((total, dataset) => total + dataset.cardCount, 0)}
          productCount={datasets.length}
          seriesCodes={works.map((work) => work.code)}
          syncedAt={syncedAt}
          workCount={works.length}
        />
      </main>
    </div>
  );
}
