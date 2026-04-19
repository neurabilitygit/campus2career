const DEFAULT_TZ = "UTC";

function normalizeTimeZone(raw: string | undefined): string {
  const t = (raw ?? "").trim();
  return t.length > 0 ? t : DEFAULT_TZ;
}

/**
 * Calendar `YYYY-MM` for the parent-brief reporting month in an IANA time zone.
 * Uses `process.env.BRIEF_MONTH_TZ` when `timeZone` is omitted (defaults to UTC).
 * Invalid zone values fall back to UTC so misconfiguration does not take the API down.
 */
export function resolveBriefMonthLabel(now: Date, timeZone?: string): string {
  const fromEnv = timeZone === undefined ? process.env.BRIEF_MONTH_TZ : timeZone;
  const tz = normalizeTimeZone(fromEnv);

  const format = (zone: string) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .format(now)
      .slice(0, 7);

  try {
    return format(tz);
  } catch {
    return format(DEFAULT_TZ);
  }
}
