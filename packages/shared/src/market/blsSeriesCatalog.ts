/**
 * Curated BLS series seeds for the first production build.
 *
 * These should be validated and adjusted during implementation.
 * The catalog is intentionally small and practical:
 * - broad unemployment pressure
 * - selected CPI / macro pressure is deferred
 * - sector or occupation-specific series can be expanded later
 */
export interface BlsSeriesSeed {
  id: string;
  label: string;
  signalType:
    | "unemployment_pressure"
    | "openings_trend"
    | "wage"
    | "demand_growth"
    | "hiring_slowdown";
  geographyCode?: string;
  notes?: string;
}

/**
 * National unemployment rate.
 * LNS14000000 is a common BLS labor-force series used in public applications.
 */
export const BLS_SERIES_CATALOG: BlsSeriesSeed[] = [
  {
    id: "LNS14000000",
    label: "National unemployment rate",
    signalType: "unemployment_pressure",
    notes: "Baseline labor pressure signal for overall economic context."
  }
];
