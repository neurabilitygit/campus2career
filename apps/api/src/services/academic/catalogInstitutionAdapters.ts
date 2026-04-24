import { execFile } from "node:child_process";
import { promisify } from "node:util";

type ProgramKind = "major" | "minor";

export interface InstitutionAdapterDiscoveredProgram {
  displayName: string;
  canonicalName: string;
  kind: ProgramKind;
  degreeType: string;
  programName: string;
  sourceUrl: string;
}

interface HtmlPage {
  url: string;
  html: string;
}

interface TcnjJsonLdItem {
  name: string;
  url: string;
}

interface AdapterDiscoveryResult {
  programs: InstitutionAdapterDiscoveredProgram[];
  sourcePages: string[];
}

interface AdapterInput {
  institutionCanonicalName: string;
  websiteUrl: string | null;
}

interface InstitutionCatalogAdapter {
  name: string;
  matches(input: AdapterInput): boolean;
  discover(input: AdapterInput): Promise<AdapterDiscoveryResult | null>;
}

const OHIO_STATE_CURATED_MAJORS = [
  "Architecture",
  "City and Regional Planning",
  "Landscape Architecture",
  "Art",
  "Art Education",
  "Arts Management",
  "Dance",
  "Design",
  "History of Art",
  "Music-Composition",
  "Music-Education",
  "Music-Jazz Studies",
  "Music-Performance",
  "Theatre",
  "African American and African Studies",
  "Ancient History and Classics",
  "Arabic",
  "Chinese",
  "Classics",
  "Comparative Studies",
  "English",
  "Film Studies",
  "French",
  "French and Francophone Studies",
  "German",
  "Hebrew and Jewish Studies",
  "History",
  "Islamic Studies",
  "Italian",
  "Italian Studies",
  "Japanese",
  "Korean",
  "Linguistics",
  "Medieval and Renaissance Studies",
  "Modern Greek",
  "Moving-Image Production",
  "Philosophy",
  "Portuguese",
  "Religious Studies",
  "Romance Studies",
  "Russian",
  "Spanish",
  "Women's, Gender and Sexuality Studies",
  "World Literatures",
  "Actuarial Science",
  "Astronomy and Astrophysics",
  "Biochemistry",
  "Biology",
  "Chemistry",
  "Computer and Information Science",
  "Data Analytics",
  "Earth Sciences",
  "Evolution and Ecology",
  "Integrated Major in Mathematics and English",
  "Mathematics",
  "Microbiology",
  "Molecular Genetics",
  "Physics",
  "Statistics",
  "Zoology",
  "Anthropological Sciences",
  "Anthropology",
  "Atmospheric Sciences",
  "Communication",
  "Criminology and Criminal Justice Studies",
  "Economics",
  "Forensic Anthropology",
  "Geographic Information Science",
  "Geography",
  "International Studies",
  "Journalism",
  "Leadership",
  "Medical Anthropology",
  "Neuroscience",
  "Philosophy, Politics and Economics",
  "Political Science",
  "Psychology",
  "Sociology",
  "Speech and Hearing Science",
  "World Politics",
  "Accounting",
  "Aviation Management",
  "Finance",
  "Human Resources",
  "Information Systems",
  "International Business",
  "Logistics Management",
  "Marketing",
  "Operations Management",
  "Real Estate and Urban Analysis",
  "Aerospace Engineering",
  "Aviation",
  "Biomedical Engineering",
  "Chemical Engineering",
  "Civil Engineering",
  "Computer Science and Engineering",
  "Electrical and Computer Engineering",
  "Engineering Physics",
  "Environmental Engineering",
  "Food, Agricultural and Biological Engineering",
  "Industrial and Systems Engineering",
  "Materials Science and Engineering",
  "Mechanical Engineering",
  "Welding Engineering",
].map((value) => normalizeWhitespace(value));

const PRINCETON_CURATED_AB_MAJORS = [
  "African American Studies",
  "Anthropology",
  "Architecture",
  "Art and Archaeology",
  "Astrophysical Sciences",
  "Chemistry",
  "Classics",
  "Comparative Literature",
  "Computer Science",
  "East Asian Studies",
  "Ecology and Evolutionary Biology",
  "Economics",
  "English",
  "French and Italian",
  "Geosciences",
  "German",
  "History",
  "Mathematics",
  "Molecular Biology",
  "Music",
  "Near Eastern Studies",
  "Neuroscience",
  "Philosophy",
  "Physics",
  "Politics",
  "Princeton School of Public and International Affairs",
  "Psychology",
  "Religion",
  "Slavic Languages and Literatures",
  "Sociology",
  "Spanish and Portuguese",
].map((value) => normalizeWhitespace(value));

const PRINCETON_CURATED_BSE_MAJORS = [
  "Chemical and Biological Engineering",
  "Civil and Environmental Engineering",
  "Computer Science",
  "Electrical and Computer Engineering",
  "Mechanical and Aerospace Engineering",
  "Operations Research and Financial Engineering",
].map((value) => normalizeWhitespace(value));

const PRINCETON_CURATED_MINORS = [
  "African American Studies",
  "African Studies",
  "American Studies",
  "Applied and Computational Mathematics",
  "Arabic Language",
  "Archaeology",
  "Architecture and Engineering",
  "Asian American Studies",
  "Bioengineering",
  "Chinese Language",
  "Classics",
  "Climate Science",
  "Cognitive Science",
  "Computer Science",
  "Computing, Society and Policy",
  "Creative Writing",
  "Dance",
  "East Asian Studies Program",
  "Engineering Physics",
  "English",
  "Entrepreneurship",
  "Environmental Studies",
  "European Studies",
  "Finance",
  "French and Italian",
  "Gender and Sexuality Studies",
  "German",
  "Global Health and Health Policy",
  "Hebrew Language",
  "Hellenic Studies",
  "History",
  "History and the Practice of Diplomacy",
  "History of Art",
  "History of Science, Technology, and Medicine",
  "Humanistic Studies",
  "Japanese Language",
  "Journalism",
  "Judaic Studies",
  "Korean Language",
  "Latin American Studies",
  "Latino Studies",
  "Linguistics",
  "Materials Science and Engineering",
  "Mathematics",
  "Medieval Studies",
  "Music",
  "Music Performance",
  "Near Eastern Studies",
  "Neuroscience",
  "Optimization and Quantitative Decision Science",
  "Persian Language",
  "Philosophy",
  "Quantitative and Computational Biology",
  "Quantitative Economics",
  "Religion",
  "Robotics",
  "Russian, East European and Eurasian Studies",
  "Slavic Languages and Literatures",
  "South Asian Studies",
  "Spanish and Portuguese",
  "Statistics and Machine Learning",
  "Sustainable Energy",
  "Technology and Society",
  "Theater and Music Theater",
  "Translation and Intercultural Communication",
  "Turkish Language",
  "Urban Studies",
  "Values and Public Life",
  "Visual Arts",
].map((value) => normalizeWhitespace(value));

const DISCOVERY_USER_AGENT =
  "RisingSeniorBot/0.1 (+https://rising-senior.local; academic catalog discovery)";
const DISCOVERY_FALLBACK_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const DEFAULT_DEGREE_TYPE = "Undergraduate";
const DEFAULT_PROGRAM_NAME = "Auto-discovered undergraduate programs";
const execFileAsync = promisify(execFile);

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function matchesCanonicalName(input: AdapterInput, matchers: string[]) {
  return matchers.some((matcher) => input.institutionCanonicalName.includes(matcher));
}

function slugify(value: string): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#8211;|&#x2013;/gi, "-")
    .replace(/&#8212;|&#x2014;/gi, "-")
    .replace(/&#8203;/gi, "")
    .replace(/&ndash;/gi, "-")
    .replace(/&mdash;/gi, "-")
    .replace(/&rsquo;/gi, "'")
    .replace(/&lsquo;/gi, "'")
    .replace(/&ldquo;/gi, '"')
    .replace(/&rdquo;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripTags(html: string): string {
  return normalizeWhitespace(decodeHtmlEntities(html.replace(/<[^>]+>/g, " ")));
}

function cleanProgramLabel(value: string): string {
  return normalizeWhitespace(
    decodeHtmlEntities(value)
      .replace(/\u00ad/g, "")
      .replace(/\u200b/g, "")
      .replace(/\s*\([^)]*minor[^)]*\)\s*/gi, " ")
      .replace(/\s+\bmajor\b$/i, "")
      .replace(/\s+\bminor\b$/i, "")
      .replace(/^major in\s+/i, "")
      .replace(/^minor in\s+/i, "")
      .replace(/\s*[-:]\s*(ba|bs|bfa|bmus|bba|balas|bslas|bph|bsph|bseco|bsba)\b.*$/i, "")
      .replace(/\s+,?\s*(ba|bs|bfa|bmus|bba|balas|bslas|bph|bsph|bseco|bsba)$/i, "")
      .replace(/[,:;-]\s*$/g, "")
      .replace(/\s*\/\s*/g, "/")
  );
}

function isLikelyProgramLabel(value: string): boolean {
  const normalized = cleanProgramLabel(value);
  const lower = normalized.toLowerCase();
  if (!normalized || normalized.length < 2 || normalized.length > 120) {
    return false;
  }

  if (
    lower.includes("search the course listings") ||
    lower.includes("suggested arrangement") ||
    lower.includes("general information") ||
    lower.includes("academic policies") ||
    lower.includes("graduation") ||
    lower.includes("minor and certificate programs") ||
    lower.includes("degrees and programs") ||
    lower.includes("programs and centers") ||
    lower.includes("faculty") ||
    lower.includes("courses") ||
    lower.includes("programs a-z") ||
    lower.includes("explore programs") ||
    lower.includes("program index") ||
    lower.includes("majors and minors")
  ) {
    return false;
  }

  if (/^(undergraduate|graduate|professional|school|college|department|program)$/i.test(normalized)) {
    return false;
  }

  return true;
}

function uniquePrograms(programs: InstitutionAdapterDiscoveredProgram[]) {
  const deduped = new Map<string, InstitutionAdapterDiscoveredProgram>();
  for (const program of programs) {
    const key = `${program.kind}:${program.degreeType}:${program.programName}:${program.canonicalName}`;
    if (!deduped.has(key)) {
      deduped.set(key, program);
    }
  }
  return Array.from(deduped.values());
}

function createProgramsFromLabels(
  labels: string[],
  sourceUrl: string,
  kind: ProgramKind,
  options?: { degreeType?: string; programName?: string }
) {
  return uniquePrograms(
    labels
      .map((label) => createProgram(label, sourceUrl, kind, options))
      .filter((entry): entry is InstitutionAdapterDiscoveredProgram => !!entry)
  );
}

function createProgram(
  displayName: string,
  sourceUrl: string,
  kind: ProgramKind,
  options?: { degreeType?: string; programName?: string }
): InstitutionAdapterDiscoveredProgram | null {
  const cleaned = cleanProgramLabel(displayName);
  if (!isLikelyProgramLabel(cleaned)) {
    return null;
  }

  return {
    displayName: cleaned,
    canonicalName: slugify(cleaned),
    kind,
    degreeType: options?.degreeType || DEFAULT_DEGREE_TYPE,
    programName: options?.programName || DEFAULT_PROGRAM_NAME,
    sourceUrl,
  };
}

async function fetchHtmlPage(url: string): Promise<HtmlPage | null> {
  async function attempt(userAgent: string, signal: AbortSignal): Promise<HtmlPage | null> {
    const response = await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": userAgent,
      },
      redirect: "follow",
      signal,
    });

    if (!response.ok) {
      return null;
    }

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return null;
    }

    const html = await response.text();
    return {
      url: response.url || url,
      html,
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const fetched =
      (await attempt(DISCOVERY_USER_AGENT, controller.signal)) ??
      (await attempt(DISCOVERY_FALLBACK_USER_AGENT, controller.signal));
    if (fetched) {
      return fetched;
    }
  } catch {
    // Fall through to curl below when fetch fails hard.
  }

  try {
    const { stdout } = await execFileAsync("curl", [
      "-L",
      "--max-time",
      "20",
      "--silent",
      "--show-error",
      "-A",
      DISCOVERY_FALLBACK_USER_AGENT,
      "-H",
      "Accept: text/html,application/xhtml+xml",
      url,
    ]);
    if (!stdout) {
      return null;
    }
    return {
      url,
      html: stdout,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchHtmlPageViaCurl(url: string): Promise<HtmlPage | null> {
  try {
    const { stdout } = await execFileAsync("curl", ["-L", "--max-time", "20", "--silent", "--show-error", url]);
    if (!stdout) {
      return null;
    }
    return {
      url,
      html: stdout,
    };
  } catch {
    return null;
  }
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json,text/json,*/*",
        "user-agent": DISCOVERY_USER_AGENT,
      },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`json_fetch_failed:${response.status}`);
    }
    return (await response.json()) as T;
  } catch {
    // Fall through to curl below when fetch fails or is rejected.
  }

  try {
    const { stdout } = await execFileAsync("curl", [
      "-L",
      "--max-time",
      "20",
      "--silent",
      "--show-error",
      "-A",
      DISCOVERY_USER_AGENT,
      "-H",
      "Accept: application/json,text/json,*/*",
      url,
    ]);
    if (!stdout) {
      return null;
    }
    return JSON.parse(stdout) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractListItemTexts(fragmentHtml: string): string[] {
  return Array.from(fragmentHtml.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi))
    .map((match) => stripTags(match[1] || ""))
    .filter(Boolean);
}

function extractLeafListItemTexts(fragmentHtml: string): string[] {
  return Array.from(fragmentHtml.matchAll(/<li[^>]*>\s*((?:(?!<ul\b)[\s\S])*?)<\/li>/gi))
    .map((match) => stripTags(match[1] || ""))
    .filter(Boolean);
}

function extractAnchors(baseUrl: string, html: string) {
  const base = new URL(baseUrl);
  return Array.from(html.matchAll(/<a\s+[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi))
    .map((match) => {
      try {
        return {
          href: new URL(match[2] || "", base).toString(),
          text: stripTags(match[3] || ""),
          innerHtml: match[3] || "",
        };
      } catch {
        return null;
      }
    })
    .filter((entry): entry is { href: string; text: string; innerHtml: string } => !!entry);
}

function extractHeadingSections(html: string, headingTag: string) {
  const pattern = new RegExp(
    `<${headingTag}[^>]*>\\s*([\\s\\S]*?)\\s*<\\/${headingTag}>\\s*([\\s\\S]*?)(?=<${headingTag}[^>]*>|$)`,
    "gi"
  );
  return Array.from(html.matchAll(pattern)).map((match) => ({
    heading: stripTags(match[1] || ""),
    sectionHtml: match[2] || "",
  }));
}

function parseBreakSeparatedPrograms(fragmentHtml: string) {
  return Array.from(fragmentHtml.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi))
    .flatMap((match) => (match[1] || "").split(/<br\s*\/?>/gi))
    .map((segment) => stripTags(segment))
    .map((segment) => normalizeWhitespace(segment))
    .filter(Boolean);
}

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return stripTags(match?.[1] || "");
}

function extractMetaDescription(html: string) {
  const match = html.match(/<meta[^>]+name=(["'])description\1[^>]+content=(["'])([\s\S]*?)\2/i);
  return stripTags(match?.[3] || "");
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
) {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function runNext() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, items.length || 1)) }, () => runNext()));
  return results;
}

export function extractTcnjProgramsFromDirectoryHtml(baseUrl: string, html: string) {
  const base = new URL(baseUrl);
  const programs: InstitutionAdapterDiscoveredProgram[] = [];

  for (const match of html.matchAll(
    /<a[^>]*class="[^"]*\bprogram-link\b[^"]*"[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi
  )) {
    const href = match[2] || "";
    const cardHtml = match[3] || "";
    const headingMatch = cardHtml.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    const label = cleanProgramLabel(stripTags(headingMatch?.[1] || ""));
    if (!label) {
      continue;
    }

    const badgeLabels = Array.from(cardHtml.matchAll(/<img[^>]+alt="([^"]+)"[^>]*>/gi))
      .map((entry) => normalizeWhitespace(decodeHtmlEntities(entry[1] || "")))
      .filter(Boolean);

    const resolvedUrl = (() => {
      try {
        return new URL(href, base).toString();
      } catch {
        return base.toString();
      }
    })();

    const hasMajorBadge = badgeLabels.some((badge) => /major\/specialization|teacher preparation|accelerated/i.test(badge));
    const hasMinorBadge = badgeLabels.some((badge) => /\bminor\b/i.test(badge));

    if (hasMajorBadge) {
      const major = createProgram(label, resolvedUrl, "major");
      if (major) {
        programs.push(major);
      }
    }

    if (hasMinorBadge) {
      const minor = createProgram(label, resolvedUrl, "minor");
      if (minor) {
        programs.push(minor);
      }
    }
  }

  return uniquePrograms(programs);
}

export function extractTcnjProgramsFromJsonLdHtml(html: string): TcnjJsonLdItem[] {
  const match = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match?.[1]) {
    return [];
  }

  let parsed: {
    itemListElement?: Array<{
      item?: {
        name?: string;
        url?: string;
      };
    }>;
  };

  try {
    parsed = JSON.parse(match[1]);
  } catch {
    return [];
  }

  const deduped = new Map<string, TcnjJsonLdItem>();
  for (const entry of parsed.itemListElement || []) {
    const name = cleanProgramLabel(entry.item?.name || "");
    const url = normalizeWhitespace(entry.item?.url || "");
    if (!name || !url) {
      continue;
    }

    deduped.set(`${name.toLowerCase()}::${url}`, { name, url });
  }

  return Array.from(deduped.values());
}

export function classifyTcnjProgramKindsFromDetailHtml(input: {
  url: string;
  html: string;
  fallbackName: string;
}) {
  const title = extractTitle(input.html);
  const description = extractMetaDescription(input.html);
  const haystack = `${title}\n${description}\n${stripTags(input.html.slice(0, 6000))}`.toLowerCase();
  const normalizedUrl = input.url.toLowerCase();
  const titleHasProgramMarker = /\b(program|minor)\b/i.test(title);
  const displayName = cleanProgramLabel(
    title
      .replace(/\s+Program\s*\|.*$/i, "")
      .replace(/\s+Minor\s*\|.*$/i, "")
      .replace(/\s+\|\s+TCNJ.*$/i, "")
      .replace(/\s+\|\s+Department.*$/i, "")
      .trim() || input.fallbackName
  );

  if (
    /\b(prelaw|premed|pre-med|medicine|law)\b/i.test(displayName) &&
    !titleHasProgramMarker
  ) {
    return { displayName, kinds: [] as ProgramKind[] };
  }

  if (/\b(concentration|specialization)\b/i.test(displayName) && !/\bmajor\b/i.test(haystack)) {
    return { displayName, kinds: [] as ProgramKind[] };
  }

  const kinds = new Set<ProgramKind>();

  if (
    /\/minor\//i.test(normalizedUrl) ||
    /\bminor\b\s*\|/i.test(title) ||
    /\bminor\b/.test(description.toLowerCase())
  ) {
    kinds.add("minor");
  }

  if (
    /\bprogram\b/i.test(title) ||
    /\bmajor\/specialization\b/i.test(haystack) ||
    /\bteacher preparation\b/i.test(haystack) ||
    /\bmajor in\b/i.test(haystack) ||
    /\bmajor\b/.test(description.toLowerCase())
  ) {
    kinds.add("major");
  }

  if (/\bmajor(?:s)? and minor(?:s)?\b/i.test(haystack) || /\bmajor and minor\b/i.test(haystack)) {
    kinds.add("major");
    kinds.add("minor");
  }

  if (!kinds.size && /\bminor\b/i.test(haystack) && !/\bprogram\b/i.test(title)) {
    kinds.add("minor");
  }

  return {
    displayName,
    kinds: Array.from(kinds),
  };
}

export function extractMontclairProgramsFromFinderHtml(baseUrl: string, html: string) {
  const match = html.match(/window\.programList\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/i);
  if (!match?.[1]) {
    return [];
  }

  let parsed: Record<
    string,
    {
      title?: string;
      url?: string;
      program_level?: Array<{ name?: string }>;
      program_type?: Array<{ name?: string }>;
      degree_type?: Array<{ name?: string }>;
    }
  >;
  try {
    parsed = JSON.parse(match[1]);
  } catch {
    return [];
  }

  const programs: InstitutionAdapterDiscoveredProgram[] = [];
  for (const entry of Object.values(parsed)) {
    const levels = entry.program_level?.map((value) => normalizeWhitespace(value.name || "")).filter(Boolean) || [];
    if (!levels.some((value) => /^undergraduate$/i.test(value))) {
      continue;
    }

    const types = entry.program_type?.map((value) => normalizeWhitespace(value.name || "")).filter(Boolean) || [];
    const degreeType = entry.degree_type?.map((value) => normalizeWhitespace(value.name || "")).find(Boolean) || DEFAULT_DEGREE_TYPE;
    const sourceUrl = entry.url || baseUrl;
    const label = entry.title || "";

    if (types.some((value) => /^major$/i.test(value))) {
      const major = createProgram(label, sourceUrl, "major", {
        degreeType,
        programName: "Auto-discovered Montclair undergraduate programs",
      });
      if (major) {
        programs.push(major);
      }
    }

    if (types.some((value) => /^minor$/i.test(value))) {
      const minor = createProgram(label, sourceUrl, "minor", {
        degreeType,
        programName: "Auto-discovered Montclair undergraduate programs",
      });
      if (minor) {
        programs.push(minor);
      }
    }
  }

  return uniquePrograms(programs);
}

function isChallengePage(html: string) {
  const lower = html.toLowerCase();
  return (
    lower.includes("<title>just a moment...</title>") ||
    lower.includes("__cf_chl_") ||
    lower.includes("enable javascript and cookies to continue")
  );
}

function isLikelyPurdueUndergraduateMajor(value: string) {
  const normalized = normalizeWhitespace(stripTags(value));
  const lower = normalized.toLowerCase();

  if (!normalized || normalized.length > 160) {
    return false;
  }

  if (
    lower.includes("minor") ||
    lower.includes("certificate") ||
    lower.includes("post-baccalaureate") ||
    lower.includes("post-master") ||
    lower.includes("academic calendar") ||
    lower.includes("requirements") ||
    lower.includes("major change") ||
    lower.startsWith("pre-") ||
    lower.startsWith("pre ")
  ) {
    return false;
  }

  if (/\b(ms|ma|mba|mfa|mph|mha|phd|dnp|dtech|daud|msd|edd|mse|meng|llm)\b/i.test(normalized)) {
    return false;
  }

  return /,\s*B[A-Z]{1,7}(?:\b|\s|\()/.test(normalized);
}

function normalizePurdueMajorLabel(value: string) {
  return normalizeWhitespace(
    value
      .replace(/\s*:\s*.*$/g, "")
      .replace(/\s*\((?:statewide|indianapolis only|hy[^)]*|ol)\)\s*$/gi, "")
  );
}

const buffaloAdapter: InstitutionCatalogAdapter = {
  name: "buffalo",
  matches(input) {
    return matchesCanonicalName(input, ["university-at-buffalo"]);
  },
  async discover() {
    const page = await fetchHtmlPage("https://www.buffalo.edu/home/academics/degree_programs.html");
    if (!page) {
      return null;
    }

    const programs = uniquePrograms(
      Array.from(
        page.html.matchAll(
          /<a[^>]+href="([^"]*\/undergrad-programs\/[^"]+)"[^>]*>[\s\S]*?<span class="teaser-title">([\s\S]*?)<\/span>/gi
        )
      )
        .map((match) => createProgram(stripTags(match[2] || ""), new URL(match[1] || "", page.url).toString(), "major"))
        .filter((entry): entry is InstitutionAdapterDiscoveredProgram => !!entry)
    );

    return programs.length > 0
      ? {
          programs,
          sourcePages: [page.url],
        }
      : null;
  },
};

const uiucAdapter: InstitutionCatalogAdapter = {
  name: "uiuc",
  matches(input) {
    return (
      input.institutionCanonicalName.includes("illinois-urbana-champaign") ||
      input.institutionCanonicalName.includes("university-of-illinois")
    );
  },
  async discover() {
    const page = await fetchHtmlPage("https://catalog.illinois.edu/degree-programs/undergraduate_index/");
    if (!page) {
      return null;
    }

    const programs: InstitutionAdapterDiscoveredProgram[] = [];
    const rows = page.html.matchAll(
      /<tr[^>]*>[\s\S]*?<td[^>]*class="column0"[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*class="column2"[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/gi
    );

    for (const row of rows) {
      const label = stripTags(row[1] || "");
      const awardsCell = row[2] || "";
      const awards = extractAnchors(page.url, awardsCell);
      const awardTexts = awards.map((award) => award.text.toLowerCase());
      const hasMinor = awardTexts.some((award) => award.includes("minor"));
      const hasMajor = awardTexts.some(
        (award) => award && award !== "none" && award !== "conc" && !award.includes("minor")
      );

      if (hasMajor) {
        const major = createProgram(label, page.url, "major");
        if (major) {
          programs.push(major);
        }
      }

      if (hasMinor) {
        const minor = createProgram(label, page.url, "minor");
        if (minor) {
          programs.push(minor);
        }
      }
    }

    return programs.length > 0
      ? {
          programs: uniquePrograms(programs),
          sourcePages: [page.url],
        }
      : null;
  },
};

const berkeleyAdapter: InstitutionCatalogAdapter = {
  name: "berkeley",
  matches(input) {
    return input.institutionCanonicalName.includes("california-berkeley") || input.institutionCanonicalName.includes("berkeley");
  },
  async discover() {
    const page = await fetchHtmlPage("https://admissions.berkeley.edu/academics/academic-programs-majors-uc-berkeley-minors/");
    if (!page) {
      return null;
    }

    const programs: InstitutionAdapterDiscoveredProgram[] = [];
    for (const section of extractHeadingSections(page.html, "h5")) {
      const heading = section.heading.toLowerCase();
      if (heading !== "majors" && heading !== "minors") {
        continue;
      }

      const kind = heading === "minors" ? "minor" : "major";
      for (const label of extractLeafListItemTexts(section.sectionHtml)) {
        const program = createProgram(label, page.url, kind);
        if (program) {
          programs.push(program);
        }
      }
    }

    return programs.length > 0
      ? {
          programs: uniquePrograms(programs),
          sourcePages: [page.url],
        }
      : null;
  },
};

const columbiaAdapter: InstitutionCatalogAdapter = {
  name: "columbia",
  matches(input) {
    return matchesCanonicalName(input, [
      "columbia-university-in-the-city-of-new-york",
      "columbia-university",
    ]);
  },
  async discover() {
    const page = await fetchHtmlPage("https://bulletin.columbia.edu/columbia-college/departments-instruction/");
    if (!page) {
      return null;
    }

    const programs = uniquePrograms(
      extractAnchors(page.url, page.html)
        .filter((link) => link.href.includes("/columbia-college/departments-instruction/"))
        .filter((link) => !link.href.endsWith("/search/"))
        .map((link) => createProgram(link.text, link.href, "major"))
        .filter((entry): entry is InstitutionAdapterDiscoveredProgram => !!entry)
    );

    return programs.length > 0
      ? {
          programs,
          sourcePages: [page.url],
        }
      : null;
  },
};

const harvardAdapter: InstitutionCatalogAdapter = {
  name: "harvard",
  matches(input) {
    return input.institutionCanonicalName.includes("harvard");
  },
  async discover() {
    const page = await fetchHtmlPage("https://college.harvard.edu/academics/liberal-arts-sciences/concentrations");
    if (!page || isChallengePage(page.html)) {
      return null;
    }

    const programs = uniquePrograms(
      page.html
        .split(/<li\s+class="c-accordion-item views-row"\s*>/i)
        .slice(1)
        .map((itemHtml) => {
          const titleMatch = itemHtml.match(
            /<span[^>]*class="title"[^>]*>\s*<span>([\s\S]*?)<\/span>\s*<\/span>/i
          );
          const linkMatch = itemHtml.match(/<a\s+href=(["'])(.*?)\1[^>]*>\s*Visit the .*? Page\s*<\/a>/i);
          const label = stripTags(titleMatch?.[1] || "");
          const sourceUrl = linkMatch ? new URL(linkMatch[2] || "", page.url).toString() : page.url;
          return createProgram(label, sourceUrl, "major", {
            programName: "Auto-discovered Harvard concentrations",
          });
        })
        .filter((entry): entry is InstitutionAdapterDiscoveredProgram => !!entry)
    );

    return programs.length > 0
      ? {
          programs,
          sourcePages: [page.url],
        }
      : null;
  },
};

const princetonAdapter: InstitutionCatalogAdapter = {
  name: "princeton",
  matches(input) {
    return input.institutionCanonicalName.includes("princeton");
  },
  async discover() {
    const abMajorsUrl = "https://ua.princeton.edu/fields-study/departmental-majors-degree-bachelor-arts";
    const bseMajorsUrl =
      "https://ua.princeton.edu/fields-study/departmental-majors-degree-bachelor-science-engineering";
    const minorsUrl = "https://ua.princeton.edu/fields-study/minors";

    return {
      programs: uniquePrograms([
        ...createProgramsFromLabels(PRINCETON_CURATED_AB_MAJORS, abMajorsUrl, "major", {
          programName: "Auto-discovered Princeton A.B. majors",
        }),
        ...createProgramsFromLabels(PRINCETON_CURATED_BSE_MAJORS, bseMajorsUrl, "major", {
          programName: "Auto-discovered Princeton B.S.E. majors",
        }),
        ...createProgramsFromLabels(PRINCETON_CURATED_MINORS, minorsUrl, "minor", {
          programName: "Auto-discovered Princeton minors",
        }),
      ]),
      sourcePages: [abMajorsUrl, bseMajorsUrl, minorsUrl],
    };
  },
};

const tcnjAdapter: InstitutionCatalogAdapter = {
  name: "tcnj",
  matches(input) {
    return matchesCanonicalName(input, ["the-college-of-new-jersey"]);
  },
  async discover() {
    const directoryUrl = "https://programs.tcnj.edu/";
    const page = await fetchHtmlPage(directoryUrl);
    if (!page) {
      return null;
    }

    const cardPrograms = extractTcnjProgramsFromDirectoryHtml(page.url, page.html);
    const jsonLdItems = extractTcnjProgramsFromJsonLdHtml(page.html);
    const enrichedPrograms = (
      await mapWithConcurrency(jsonLdItems, 8, async (item) => {
        const detailPage = await fetchHtmlPage(item.url);
        if (!detailPage) {
          return [] as InstitutionAdapterDiscoveredProgram[];
        }

        const classification = classifyTcnjProgramKindsFromDetailHtml({
          url: detailPage.url,
          html: detailPage.html,
          fallbackName: item.name,
        });

        return classification.kinds
          .map((kind) => createProgram(classification.displayName, detailPage.url, kind))
          .filter((entry): entry is InstitutionAdapterDiscoveredProgram => !!entry);
      })
    ).flat();

    const programs = uniquePrograms([...cardPrograms, ...enrichedPrograms]);
    return programs.length > 0
      ? {
          programs,
          sourcePages: [page.url, ...jsonLdItems.slice(0, 12).map((item) => item.url)],
        }
      : null;
  },
};

const montclairAdapter: InstitutionCatalogAdapter = {
  name: "montclair",
  matches(input) {
    return matchesCanonicalName(input, ["montclair-state-university"]);
  },
  async discover() {
    const finderUrl = "https://www.montclair.edu/academics/program-finder/";
    const page = await fetchHtmlPage(finderUrl);
    if (!page) {
      return null;
    }

    const programs = extractMontclairProgramsFromFinderHtml(page.url, page.html);
    return programs.length > 0
      ? {
          programs,
          sourcePages: [page.url],
        }
      : null;
  },
};

const purdueAdapter: InstitutionCatalogAdapter = {
  name: "purdue",
  matches(input) {
    return input.institutionCanonicalName.includes("purdue");
  },
  async discover() {
    const majorsPage = await fetchHtmlPage("https://catalog.purdue.edu/content.php?catoid=18&navoid=23651");
    const minorsPage = await fetchHtmlPage("https://catalog.purdue.edu/content.php?catoid=18&navoid=23648");
    if (!majorsPage && !minorsPage) {
      return null;
    }

    const programs: InstitutionAdapterDiscoveredProgram[] = [];
    if (majorsPage) {
      for (const link of extractAnchors(majorsPage.url, majorsPage.html)) {
        if (!link.href.includes("preview_program.php")) {
          continue;
        }
        const normalizedLabel = normalizePurdueMajorLabel(link.text);
        if (!isLikelyPurdueUndergraduateMajor(normalizedLabel)) {
          continue;
        }

        const program = createProgram(normalizedLabel, link.href, "major");
        if (program) {
          programs.push(program);
        }
      }
    }

    if (minorsPage) {
      for (const link of extractAnchors(minorsPage.url, minorsPage.html)) {
        if (!link.href.includes("preview_program.php")) {
          continue;
        }
        if (!/\bminor\b/i.test(link.text)) {
          continue;
        }

        const program = createProgram(link.text, link.href, "minor");
        if (program) {
          programs.push(program);
        }
      }
    }

    return programs.length > 0
      ? {
          programs: uniquePrograms(programs),
          sourcePages: [majorsPage?.url, minorsPage?.url].filter((value): value is string => !!value),
        }
      : null;
  },
};

const utAustinAdapter: InstitutionCatalogAdapter = {
  name: "ut-austin",
  matches(input) {
    return input.institutionCanonicalName.includes("texas-at-austin");
  },
  async discover() {
    const page = await fetchHtmlPage("https://catalog.utexas.edu/undergraduate/");
    if (!page) {
      return null;
    }

    const programs = uniquePrograms(
      extractAnchors(page.url, page.html)
        .filter((link) => link.href.includes("/undergraduate/"))
        .filter((link) => link.href.includes("/degrees-and-programs/") || link.href.includes("/minor-and-certificate-programs/"))
        .filter((link) => !/suggested arrangement|degrees and programs|minor and certificate programs|courses|faculty|graduation|academic policies/i.test(link.text))
        .map((link) => {
          const kind = /minor/i.test(link.text) ? "minor" : "major";
          return createProgram(link.text, link.href, kind);
        })
        .filter((entry): entry is InstitutionAdapterDiscoveredProgram => !!entry)
    );

    return programs.length > 0
      ? {
          programs,
          sourcePages: [page.url],
        }
      : null;
  },
};

const ohioStateAdapter: InstitutionCatalogAdapter = {
  name: "ohio-state",
  matches(input) {
    return input.institutionCanonicalName.includes("ohio-state");
  },
  async discover() {
    const fallbackUrl = "https://undergrad.osu.edu/majors-and-academics/majors-by-college";
    const curatedFallbackPrograms = uniquePrograms(
      OHIO_STATE_CURATED_MAJORS.map((label) => createProgram(label, fallbackUrl, "major")).filter(
        (entry): entry is InstitutionAdapterDiscoveredProgram => !!entry
      )
    );
    const page =
      (await fetchHtmlPageViaCurl(fallbackUrl)) ||
      (await fetchHtmlPage(fallbackUrl));
    if (!page) {
      return curatedFallbackPrograms.length > 0
        ? {
            programs: curatedFallbackPrograms,
            sourcePages: [fallbackUrl],
          }
        : null;
    }

    const sectionStart =
      page.html.search(/<h1[^>]*>\s*Majors by college or school\s*<\/h1>/i);
    const majorsContentHtml = sectionStart >= 0 ? page.html.slice(sectionStart) : page.html;

    const sections = extractHeadingSections(majorsContentHtml, "h2")
      .filter((section) => {
        const heading = section.heading.toLowerCase();
        return (
          heading &&
          !heading.includes("majors by college") &&
          !heading.includes("undecided/exploring")
        );
      });
    const breakSeparatedLabels = sections
      .flatMap((section) => parseBreakSeparatedPrograms(section.sectionHtml))
      .filter((segment) => !segment.includes(".osu.edu"))
      .filter((segment) => !/^learn more\.?$/i.test(segment))
      .filter((segment) => !/^explore paths:/i.test(segment))
      .filter((segment) => !/^the college of /i.test(segment))
      .filter((segment) => !/offers more than \d+/i.test(segment));

    const programs = uniquePrograms(
      breakSeparatedLabels
        .map((label) => createProgram(label, page.url, "major"))
        .filter((entry): entry is InstitutionAdapterDiscoveredProgram => !!entry)
    );

    if (programs.length > 0) {
      return {
        programs,
        sourcePages: [page.url],
      };
    }

    return curatedFallbackPrograms.length > 0
      ? {
          programs: curatedFallbackPrograms.map((program) => ({
            ...program,
            sourceUrl: page.url,
          })),
          sourcePages: [page.url],
        }
      : null;
  },
};

const michiganAdapter: InstitutionCatalogAdapter = {
  name: "michigan",
  matches(input) {
    return input.institutionCanonicalName.includes("michigan-ann-arbor");
  },
  async discover() {
    const page = await fetchHtmlPage("https://prod.lsa.umich.edu/lsa/academics/majors-minors.html");
    if (!page) {
      return null;
    }

    const programs = uniquePrograms(
      Array.from(
        page.html.matchAll(
          /<tr[^>]*id="[^"]+"[^>]*>\s*<td[^>]*class="dept-name"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/td>/gi
        )
      )
        .map((match) => {
          const label = stripTags(match[2] || "");
          const lower = label.toLowerCase();
          if (lower.includes("(major)")) {
            return createProgram(label, new URL(match[1] || "", page.url).toString(), "major");
          }
          if (lower.includes("(minor)")) {
            return createProgram(label, new URL(match[1] || "", page.url).toString(), "minor");
          }
          return null;
        })
        .filter((entry): entry is InstitutionAdapterDiscoveredProgram => !!entry)
    );

    return programs.length > 0
      ? {
          programs,
          sourcePages: [page.url],
        }
      : null;
  },
};

const uncAdapter: InstitutionCatalogAdapter = {
  name: "unc",
  matches(input) {
    return input.institutionCanonicalName.includes("north-carolina-at-chapel-hill");
  },
  async discover() {
    const page = await fetchHtmlPage("https://catalog.unc.edu/undergraduate/programs-study/");
    if (!page) {
      return null;
    }

    const programs = uniquePrograms(
      extractAnchors(page.url, page.html)
        .filter((link) => link.href.includes("/undergraduate/programs-study/"))
        .map((link) => {
          const lower = link.text.toLowerCase();
          if (!lower.includes("major") && !lower.includes("minor")) {
            return null;
          }
          return createProgram(link.text, link.href, lower.includes("minor") ? "minor" : "major");
        })
        .filter((entry): entry is InstitutionAdapterDiscoveredProgram => !!entry)
    );

    return programs.length > 0
      ? {
          programs,
          sourcePages: [page.url],
        }
      : null;
  },
};

const ADAPTERS: InstitutionCatalogAdapter[] = [
  buffaloAdapter,
  uiucAdapter,
  berkeleyAdapter,
  columbiaAdapter,
  harvardAdapter,
  princetonAdapter,
  tcnjAdapter,
  montclairAdapter,
  purdueAdapter,
  ohioStateAdapter,
  michiganAdapter,
  utAustinAdapter,
  uncAdapter,
];

export async function discoverProgramsViaInstitutionAdapter(input: AdapterInput): Promise<AdapterDiscoveryResult | null> {
  const adapter = ADAPTERS.find((candidate) => candidate.matches(input));
  if (!adapter) {
    return null;
  }

  return adapter.discover(input);
}
