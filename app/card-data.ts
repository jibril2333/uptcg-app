import type { UaWork } from "./cards/CardCatalog";
import { series } from "./series-data";

export type UaCatalog = {
  series?: UaWork["datasets"];
  syncedAt?: string;
};

declare global {
  // The local Docker server loads this from the persistent /data volume before
  // importing the application worker. Keeping it runtime-only prevents card
  // records from being compiled into the application image.
  // eslint-disable-next-line no-var
  var __UPTCG_CARD_CATALOG__: UaCatalog | undefined;
}

export function buildWorks(catalog: UaCatalog = globalThis.__UPTCG_CARD_CATALOG__ ?? {}): UaWork[] {
  const productCatalog = catalog.series as unknown as UaWork["datasets"];
  if (!Array.isArray(productCatalog)) return [];

  const supplemental = (productKey: string) => /^(promo|limited)-/.test(productKey) ? 1 : 0;
  const sortDatasets = (datasets: UaWork["datasets"]) => datasets.sort((a, b) => {
    const supplementalOrder = supplemental(a.productKey) - supplemental(b.productKey);
    const specialOrder = Number(a.productKey.startsWith("special-")) - Number(b.productKey.startsWith("special-"));
    return supplementalOrder || specialOrder || b.seriesId.localeCompare(a.seriesId);
  });
  const knownSeries = new Map(series.map((item) => [item.code, item]));
  const discoveredCodes = [...new Set(productCatalog.map((dataset) => dataset.workCode).filter(Boolean))];

  return discoveredCodes
    .map((code) => {
      const item = knownSeries.get(code);
      const datasets = sortDatasets(productCatalog.filter((dataset) => dataset.workCode === code));
      const originalName = datasets[0]?.productName.replace(/【[^】]+】/g, "").trim() || code;
      return {
        code,
        datasets,
        image: item
          ? item.image ?? `/assets/series/${item.code}.${item.ext}`
          : datasets.find((dataset) => dataset.coverImage)?.coverImage ?? "/assets/union-arena.png",
        name: item?.name ?? originalName,
        originalName,
      };
    })
    .sort((a, b) => {
      const aKnown = knownSeries.has(a.code);
      const bKnown = knownSeries.has(b.code);
      if (aKnown !== bKnown) return aKnown ? 1 : -1;
      if (!aKnown) return (b.datasets[0]?.seriesId ?? "").localeCompare(a.datasets[0]?.seriesId ?? "");
      return series.findIndex((item) => item.code === a.code) - series.findIndex((item) => item.code === b.code);
    });
}
