import { upsertInstitution } from "../../../api/src/services/academic/catalogService";

const COLLEGE_SCORECARD_BASE_URL =
  process.env.COLLEGE_SCORECARD_BASE_URL ||
  "https://api.data.gov/ed/collegescorecard/v1/schools";

interface CollegeScorecardApiResponse {
  metadata?: {
    total?: number;
    page?: number;
    per_page?: number;
  };
  results?: CollegeScorecardSchoolRow[];
}

interface CollegeScorecardSchoolRow {
  id?: number;
  school?: {
    name?: string | null;
    city?: string | null;
    state?: string | null;
    school_url?: string | null;
    operating?: number | null;
    main_campus?: number | null;
  };
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function toCanonicalInstitutionName(row: CollegeScorecardSchoolRow): string | null {
  const schoolId = row.id;
  const displayName = row.school?.name?.trim();
  if (!schoolId || !displayName) {
    return null;
  }

  const normalizedName = slugify(displayName);
  if (!normalizedName) {
    return null;
  }

  return `college-scorecard-${schoolId}-${normalizedName}`;
}

function normalizeWebsiteUrl(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

async function fetchCollegeScorecardPage(input: {
  apiKey: string;
  page: number;
  perPage: number;
}): Promise<CollegeScorecardApiResponse> {
  const url = new URL(COLLEGE_SCORECARD_BASE_URL);
  url.searchParams.set("api_key", input.apiKey);
  url.searchParams.set("page", String(input.page));
  url.searchParams.set("per_page", String(input.perPage));
  url.searchParams.set("keys_nested", "true");
  url.searchParams.set(
    "fields",
    [
      "id",
      "school.name",
      "school.city",
      "school.state",
      "school.school_url",
      "school.operating",
      "school.main_campus",
    ].join(",")
  );
  url.searchParams.set("school.operating", "1");
  url.searchParams.set("school.main_campus", "1");

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `College Scorecard request failed: ${response.status} ${response.statusText} :: ${text}`
    );
  }

  return (await response.json()) as CollegeScorecardApiResponse;
}

export async function syncCollegeScorecardInstitutions() {
  const apiKey = process.env.COLLEGE_SCORECARD_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("COLLEGE_SCORECARD_API_KEY is required for sync-college-scorecard");
  }

  const perPage = Math.max(
    1,
    Math.min(Number(process.env.COLLEGE_SCORECARD_PER_PAGE || "100"), 100)
  );
  const maxPagesRaw = Number(process.env.COLLEGE_SCORECARD_MAX_PAGES || "0");
  const maxPages = Number.isFinite(maxPagesRaw) && maxPagesRaw > 0 ? Math.floor(maxPagesRaw) : null;

  console.log("Starting College Scorecard institution sync...");

  let page = 0;
  let total = 0;
  let processed = 0;
  let upserted = 0;

  while (true) {
    if (maxPages != null && page >= maxPages) {
      console.log(`Stopping early at page limit ${maxPages}`);
      break;
    }

    const payload = await fetchCollegeScorecardPage({ apiKey, page, perPage });
    const rows = payload.results || [];
    const metadata = payload.metadata || {};
    total = metadata.total || total;

    if (!rows.length) {
      break;
    }

    for (const row of rows) {
      processed += 1;

      const displayName = row.school?.name?.trim();
      const canonicalName = toCanonicalInstitutionName(row);
      if (!displayName || !canonicalName) {
        continue;
      }

      await upsertInstitution({
        canonicalName,
        displayName,
        countryCode: "US",
        stateRegion: row.school?.state?.trim() || undefined,
        city: row.school?.city?.trim() || undefined,
        websiteUrl: normalizeWebsiteUrl(row.school?.school_url),
      });
      upserted += 1;
    }

    console.log(
      `College Scorecard page ${page} processed (${rows.length} records, ${upserted} upserted so far${total ? ` / ${total} total` : ""})`
    );

    const nextOffset = (page + 1) * perPage;
    if (total > 0 && nextOffset >= total) {
      break;
    }

    page += 1;
  }

  console.log(
    `College Scorecard institution sync complete. Processed ${processed} rows, upserted ${upserted} institutions.`
  );
}
