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
  return series
    .map((item) => {
      const datasets = productCatalog
        .filter((dataset) => dataset.workCode === item.code)
        .sort((a, b) => {
          const supplemental = (productKey: string) => /^(promo|limited)-/.test(productKey) ? 1 : 0;
          const supplementalOrder = supplemental(a.productKey) - supplemental(b.productKey);
          const specialOrder = Number(a.productKey.startsWith("special-")) - Number(b.productKey.startsWith("special-"));
          return supplementalOrder || specialOrder || b.seriesId.localeCompare(a.seriesId);
        });
      return {
        code: item.code,
        name: item.name,
        originalName: datasets[0]?.productName.replace(/【[^】]+】/g, "").trim() || item.name,
        image: item.image ?? `/assets/series/${item.code}.${item.ext}`,
        datasets,
      };
    })
    .filter((work) => work.datasets.length) as UaWork[];
}
