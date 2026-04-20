import type { NormalizedMarketSignal } from "./normalizers";

function firstDataPoint(raw: any): any | null {
  return (
    raw?.Results?.series?.[0]?.data?.[0] ||
    raw?.Results?.series?.[0]?.Data?.[0] ||
    raw?.results?.series?.[0]?.data?.[0] ||
    null
  );
}

export function normalizeBlsSeriesToMarketSignal(input: {
  raw: any;
  sourceName: string;
  signalType:
    | "wage"
    | "demand_growth"
    | "unemployment_pressure"
    | "openings_trend"
    | "internship_availability"
    | "ai_disruption_signal"
    | "hiring_slowdown";
  occupationCanonicalName?: string;
  geographyCode?: string;
}): NormalizedMarketSignal | null {
  const point = firstDataPoint(input.raw);
  if (!point) return null;

  const year = point.year || new Date().getUTCFullYear().toString();
  const numericValue = point.value != null ? Number(point.value) : undefined;

  return {
    occupationCanonicalName: input.occupationCanonicalName,
    geographyCode: input.geographyCode,
    signalType: input.signalType,
    signalValue: Number.isFinite(numericValue) ? numericValue : undefined,
    signalDirection: "stable",
    sourceName: input.sourceName,
    effectiveDate: `${year}-01-01`,
    confidenceLevel: "high",
  };
}
