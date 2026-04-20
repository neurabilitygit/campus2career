import { BLS_SERIES_CATALOG } from "../../../../packages/shared/src/market/blsSeriesCatalog";
import { fetchLatestBlsSeries } from "../../../api/src/services/market/blsClient";
import { normalizeBlsSeriesToMarketSignal } from "../../../api/src/services/market/blsParsers";
import { persistNormalizedMarketSignal } from "../../../api/src/services/market/persistence";

export async function syncBls() {
  console.log("Starting BLS sync with exact normalization...");

  for (const series of BLS_SERIES_CATALOG) {
    try {
      const raw = await fetchLatestBlsSeries(series.id);
      const normalized = normalizeBlsSeriesToMarketSignal({
        raw,
        sourceName: `BLS:${series.id}`,
        signalType: series.signalType,
        geographyCode: series.geographyCode,
      });

      if (!normalized) {
        console.warn(`No normalized BLS signal for ${series.id}`);
        continue;
      }

      await persistNormalizedMarketSignal(normalized);
      console.log(`Synced BLS signal ${series.id}`);
    } catch (error) {
      console.error(`BLS sync failed for ${series.id}`, error);
    }
  }

  console.log("BLS sync complete.");
}
