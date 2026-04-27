import { execFile } from "node:child_process";
import { promisify } from "node:util";
import vm from "node:vm";

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

interface UclaBrowseNode {
  title?: string;
  href?: string;
  children?: UclaBrowseNode[];
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
    .replace(/&#0*38;/gi, "&")
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
      .replace(/\s+\bco[\s-]*major\b$/i, "")
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

function stripTrailingUndergraduateNotation(value: string): string {
  return normalizeWhitespace(
    value
      .replace(/\s*\((?:b\.?a\.?|b\.?s\.?|b\.?f\.?a\.?|b\.?s\.?e\.?|b\.?s\.?b\.?a\.?|b\.?a\.?\s*or\s*b\.?s\.?)\)\s*$/i, "")
      .replace(/\s*,\s*(?:b\.?a\.?|b\.?s\.?|b\.?f\.?a\.?|b\.?s\.?e\.?|b\.?s\.?b\.?a\.?)\s*$/i, "")
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

async function postHtmlFragment(
  url: string,
  formBody: URLSearchParams,
  headers?: Record<string, string>
): Promise<string | null> {
  const baseHeaders: Record<string, string> = {
    accept: "text/html,application/xhtml+xml,*/*",
    "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
    "user-agent": DISCOVERY_USER_AGENT,
    "x-requested-with": "XMLHttpRequest",
    ...headers,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: baseHeaders,
      body: formBody,
      redirect: "follow",
    });
    if (!response.ok) {
      return null;
    }
    return await response.text();
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

async function fetchJsonViaCurlWithHeaders<T>(url: string, headers: Record<string, string>): Promise<T | null> {
  const args = ["-L", "--max-time", "20", "--silent", "--show-error", "-A", DISCOVERY_FALLBACK_USER_AGENT];
  for (const [header, value] of Object.entries(headers)) {
    args.push("-H", `${header}: ${value}`);
  }
  args.push(url);

  try {
    const { stdout } = await execFileAsync("curl", args);
    if (!stdout) {
      return null;
    }
    return JSON.parse(stdout) as T;
  } catch {
    return null;
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

function extractNextDataJson(html: string): unknown | null {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i);
  if (!match?.[1]) {
    return null;
  }
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
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

function isLikelyNortheasternCatalogRootLink(href: string) {
  try {
    const { pathname } = new URL(href, "https://catalog.northeastern.edu");
    return /^\/undergraduate\/[^/]+\/?$/i.test(pathname) && pathname !== "/undergraduate/";
  } catch {
    return false;
  }
}

function isLikelyNortheasternProgramPageLink(href: string) {
  try {
    const { pathname } = new URL(href, "https://catalog.northeastern.edu");
    return /^\/undergraduate\/[^/]+\/[^/]+\/?$/i.test(pathname);
  } catch {
    return false;
  }
}

function shouldSkipNortheasternCatalogLabel(value: string) {
  const normalized = normalizeWhitespace(value).toLowerCase();
  return (
    !normalized ||
    normalized === "undergraduate" ||
    normalized === "overview" ||
    normalized === "website" ||
    normalized === "minors" ||
    normalized === "concentrations" ||
    normalized.includes("academic group chairs") ||
    normalized.includes("combined major") ||
    normalized.includes("accelerated bachelor") ||
    normalized.includes("admission") ||
    normalized.includes("information for entering students") ||
    normalized.includes("financial information") ||
    normalized.includes("academic policies") ||
    normalized.includes("university academics") ||
    normalized.includes("courses")
  );
}

function classifyNortheasternProgramKind(value: string, href: string): ProgramKind | null {
  const normalized = normalizeWhitespace(value);
  if (!normalized || shouldSkipNortheasternCatalogLabel(normalized)) {
    return null;
  }

  if (/\bminor\b/i.test(normalized) || /\/minor[s-]/i.test(href)) {
    return "minor";
  }

  if (
    /,\s*B[A-Z]{1,5}\b/.test(normalized) ||
    /\b(BSBA|BSIB|BS|BA|BFA|BARCH)\b/i.test(normalized)
  ) {
    return "major";
  }

  return null;
}

function extractNortheasternSecondaryCatalogUrls(baseUrl: string, html: string) {
  const base = new URL(baseUrl);
  return Array.from(
    new Set(
      extractAnchors(baseUrl, html)
        .filter((anchor) => /minors?/i.test(anchor.text))
        .map((anchor) => {
          try {
            return new URL(anchor.href, base).toString();
          } catch {
            return null;
          }
        })
        .filter((value): value is string => !!value && isLikelyNortheasternProgramPageLink(value))
    )
  );
}

export function extractNortheasternProgramsFromCatalogSchoolHtml(baseUrl: string, html: string) {
  const base = new URL(baseUrl);
  return uniquePrograms(
    extractAnchors(baseUrl, html)
      .filter((anchor) => isLikelyNortheasternProgramPageLink(anchor.href))
      .map((anchor) => {
        const resolvedUrl = new URL(anchor.href, base).toString();
        const kind = classifyNortheasternProgramKind(anchor.text, resolvedUrl);
        if (!kind) {
          return null;
        }

        return createProgram(anchor.text, resolvedUrl, kind);
      })
      .filter((entry): entry is InstitutionAdapterDiscoveredProgram => !!entry)
  );
}

export function dedupeRepeatedProgramLabel(value: string) {
  const normalized = normalizeWhitespace(value);
  const half = Math.floor(normalized.length / 2);
  if (half > 0) {
    const left = normalizeWhitespace(normalized.slice(0, half));
    const right = normalizeWhitespace(normalized.slice(half));
    if (left && left === right) {
      return left;
    }
  }

  const words = normalized.split(/\s+/);
  if (words.length >= 4 && words.length % 2 === 0) {
    const firstHalf = words.slice(0, words.length / 2).join(" ");
    const secondHalf = words.slice(words.length / 2).join(" ");
    if (firstHalf === secondHalf) {
      return firstHalf;
    }
  }

  return normalized;
}

export function extractYaleMajorsFromHtml(baseUrl: string, html: string) {
  return uniquePrograms(
    extractAnchors(baseUrl, html)
      .filter((anchor) => anchor.href.includes("/ycps/subjects-of-instruction/"))
      .filter((anchor) => !anchor.href.includes("#"))
      .map((anchor) => stripTrailingUndergraduateNotation(anchor.text))
      .filter((label) => !/certificate/i.test(label))
      .map((label) => createProgram(label, baseUrl, "major"))
      .filter((entry): entry is InstitutionAdapterDiscoveredProgram => !!entry)
  );
}

export function extractWashuProgramsFromHtml(baseUrl: string, html: string, kind: ProgramKind) {
  const pathNeedle = kind === "major" ? "/majors/" : "/minors/";
  return uniquePrograms(
    extractAnchors(baseUrl, html)
      .filter((anchor) => anchor.href.includes("/undergrad/"))
      .filter((anchor) => anchor.href.includes(pathNeedle))
      .filter((anchor) => anchor.href !== baseUrl)
      .map((anchor) =>
        createProgram(
          stripTrailingUndergraduateNotation(anchor.text).replace(/\(Non-BSBA\)/gi, "(Non BSBA)"),
          anchor.href,
          kind,
          kind === "major" && /,\s*BS[A-Z]*$/i.test(anchor.text)
            ? { degreeType: "BS", programName: DEFAULT_PROGRAM_NAME }
            : undefined
        )
      )
      .filter((entry): entry is InstitutionAdapterDiscoveredProgram => !!entry)
  );
}

export function extractJhuProgramsFromHtml(baseUrl: string, html: string) {
  return uniquePrograms(
    extractAnchors(baseUrl, html)
      .filter((anchor) => anchor.href.includes("/arts-sciences/full-time-residential-programs/degree-programs/"))
      .filter((anchor) => !/\/degree-programs\/?$/.test(new URL(anchor.href).pathname))
      .map((anchor) => {
        const label = stripTrailingUndergraduateNotation(
          anchor.text.replace(/,\s*Bachelor of (Arts|Science)\s*$/i, "")
        );
        if (/phd|master|certificate|post baccalaureate|post-baccalaureate|residency/i.test(label)) {
          return null;
        }
        const href = anchor.href.toLowerCase();
        if (/bachelor|b\.a\.|b\.s\.|minor/i.test(label) || href.includes("-bachelor-") || href.endsWith("-minor/")) {
          return createProgram(
            label,
            anchor.href,
            /minor/i.test(label) || href.endsWith("-minor/") ? "minor" : "major",
            /bachelor of science|b\.s\./i.test(label) || href.includes("-bachelor-science")
              ? { degreeType: "BS", programName: DEFAULT_PROGRAM_NAME }
              : undefined
          );
        }
        return null;
      })
      .filter((entry): entry is InstitutionAdapterDiscoveredProgram => !!entry)
  );
}

export function extractWisconsinProgramsFromHtml(baseUrl: string, html: string) {
  return uniquePrograms(
    Array.from(
      html.matchAll(
        /<li[^>]*id="isotope-item[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>[\s\S]*?(?:<span class="title list"><h3>([\s\S]*?)<\/h3><\/span>|<h3>([\s\S]*?)<\/h3>)[\s\S]*?<\/a>[\s\S]*?<\/li>/gi
      )
    )
      .map((match) => ({
        href: new URL(match[1] || "", baseUrl).toString(),
        label: stripTags(match[2] || match[3] || ""),
      }))
      .filter((entry) => entry.href.includes("/undergraduate/"))
      .filter((entry) => !/certificate/i.test(entry.label))
      .filter((entry) => /,\s*(BA|BS|BFA|BBA|BLS|BM)$/i.test(entry.label))
      .map((entry) => createProgram(stripTrailingUndergraduateNotation(entry.label), entry.href, "major"))
      .filter((entry): entry is InstitutionAdapterDiscoveredProgram => !!entry)
  );
}

function cleanBerkeleyProgramLabel(value: string) {
  return normalizeWhitespace(
    cleanProgramLabel(value)
      .replace(/\s*\*+\s*$/g, "")
      .replace(/\s*\(including [^)]+\)\s*/gi, " ")
      .replace(/\s+also offered[\s\S]*$/i, "")
  );
}

export function extractBerkeleyProgramsFromAdmissionsHtml(baseUrl: string, html: string) {
  const programs: InstitutionAdapterDiscoveredProgram[] = [];

  for (const section of extractHeadingSections(html, "h5")) {
    const heading = section.heading.toLowerCase();
    if (heading !== "majors" && heading !== "minors") {
      continue;
    }

    const kind = heading === "minors" ? "minor" : "major";
    for (const rawLabel of extractLeafListItemTexts(section.sectionHtml)) {
      const label = cleanBerkeleyProgramLabel(rawLabel);
      if (!label || /^undeclared\b/i.test(label)) {
        continue;
      }
      const program = createProgram(label, baseUrl, kind);
      if (program) {
        programs.push(program);
      }
    }
  }

  return uniquePrograms(programs);
}

export function extractCaltechProgramsFromCatalogHtml(baseUrl: string, html: string) {
  const programs: InstitutionAdapterDiscoveredProgram[] = [];

  for (const anchor of extractAnchors(baseUrl, html)) {
    if (!anchor.href.includes("/current/information-for-undergraduate-students/graduation-requirements-all-options/")) {
      continue;
    }

    const rawLabel = cleanProgramLabel(anchor.text);
    if (
      !rawLabel ||
      /^(Graduation Requirements|Core Institute Requirements|Typical First-Year Course Schedule)/i.test(rawLabel)
    ) {
      continue;
    }

    const hasOption = /\boption\b/i.test(rawLabel);
    const hasMinor = /\bminor\b/i.test(rawLabel);
    const baseLabel = cleanProgramLabel(
      rawLabel
        .replace(/\s+Option\b[\s\S]*$/i, "")
        .replace(/\s+Minor\b[\s\S]*$/i, "")
    );

    if (!baseLabel) {
      continue;
    }

    if (hasOption) {
      const major = createProgram(baseLabel, anchor.href, "major");
      if (major) {
        programs.push(major);
      }
    }

    if (hasMinor) {
      const minor = createProgram(baseLabel, anchor.href, "minor");
      if (minor) {
        programs.push(minor);
      }
    }
  }

  return uniquePrograms(programs);
}

function isUtAustinGenericContainerLabel(label: string) {
  return /^(degrees and programs|programs of study|courses|print options|minor and certificate programs)$/i.test(label);
}

function cleanUtAustinProgramLabel(label: string) {
  const stripped = normalizeWhitespace(
    cleanProgramLabel(label)
      .replace(/^suggested arrangement of courses\s*[:,]?\s*/i, "")
      .replace(/\s*\((?:B\.?A\.?|B\.?S\.?|BFA|BBA|BJ|BATD|BMusic|BSAdv|BSComm&Lead|BSCommStds|BSPR|BSRTF|BSSLH|BSEd|BSKin&Health|BSAthTrng|BSGE)\)\s*$/i, "")
      .replace(/^Bachelor of\s+/i, "")
      .replace(/^(?:BS|BA|BFA|BBA|BJ|BM|BMus)\s+/i, "")
  );
  return stripped.replace(/\s+Minor$/i, "");
}

function extractUtAustinSchoolPageUrls(baseUrl: string, html: string, sectionSlug: "degrees-and-programs" | "minor-and-certificate-programs") {
  const deduped = new Set<string>();
  for (const anchor of extractAnchors(baseUrl, html)) {
    const path = new URL(anchor.href).pathname;
    if (!new RegExp(`^/undergraduate/[^/]+/${sectionSlug}/$`, "i").test(path)) {
      continue;
    }
    if (sectionSlug === "minor-and-certificate-programs" && path.startsWith("/undergraduate/the-university/")) {
      continue;
    }
    deduped.add(anchor.href);
  }
  return Array.from(deduped.values());
}

export function extractUtAustinMajorProgramsFromHtml(baseUrl: string, html: string) {
  const pageAnchors = extractAnchors(baseUrl, html)
    .filter((anchor) => anchor.href.includes("/degrees-and-programs/"))
    .filter((anchor) => !anchor.href.includes("/minor-and-certificate-programs/"))
    .filter((anchor) => !anchor.href.endsWith(".pdf"));

  const candidatePaths = pageAnchors.map((anchor) => new URL(anchor.href).pathname);
  const programs: InstitutionAdapterDiscoveredProgram[] = [];

  for (const anchor of pageAnchors) {
    const url = new URL(anchor.href);
    const path = url.pathname;
    if (/\/degrees-and-programs\/?$/.test(path)) {
      continue;
    }

    const rawLabel = normalizeWhitespace(anchor.text);
    if (!rawLabel || isUtAustinGenericContainerLabel(rawLabel)) {
      continue;
    }

    if (/suggested arrangement of courses/i.test(rawLabel)) {
      if (!/[:,]/.test(rawLabel)) {
        continue;
      }
      const suggestedLabel = cleanUtAustinProgramLabel(rawLabel);
      const program = createProgram(suggestedLabel, anchor.href, "major");
      if (program) {
        programs.push(program);
      }
      continue;
    }

    const normalizedLabel = cleanUtAustinProgramLabel(rawLabel);
    if (!normalizedLabel || /^Degree Programs$/i.test(normalizedLabel)) {
      continue;
    }

    const hasNestedPrograms = candidatePaths.some((otherPath) => {
      if (otherPath === path) {
        return false;
      }
      return otherPath.startsWith(path.endsWith("/") ? path : `${path}/`);
    });

    if (hasNestedPrograms && /^(Bachelor of|BS\b|BA\b|BFA\b|BBA\b|BJ\b|BM\b|BMus\b)/i.test(rawLabel)) {
      continue;
    }

    const program = createProgram(normalizedLabel, anchor.href, "major");
    if (program) {
      programs.push(program);
    }
  }

  return uniquePrograms(programs);
}

export function extractUtAustinMinorProgramsFromHtml(baseUrl: string, html: string) {
  const minorsSectionMatch = html.match(/<h2[^>]*>[\s\S]*?Minors[\s\S]*?<\/h2>([\s\S]*?)(?=<h2[^>]*>|$)/i);
  const minorsSection = minorsSectionMatch?.[1] || "";
  const headings = Array.from(minorsSection.matchAll(/<h4[^>]*>([\s\S]*?)<\/h4>/gi))
    .map((match) => cleanUtAustinProgramLabel(stripTags(match[1] || "")))
    .filter((label) => !!label)
    .filter((label) => !isUtAustinGenericContainerLabel(label))
    .filter((label) => !/certificate/i.test(label));

  return createProgramsFromLabels(headings, baseUrl, "minor");
}

function parseGeorgiaSearchPageNumber(html: string) {
  const match = html.match(/<p class="small gray mw">Page\s+(\d+)<\/p>/i);
  return match ? Number.parseInt(match[1] || "0", 10) : 0;
}

export function extractGeorgiaProgramsFromSearchHtml(baseUrl: string, html: string, kind: ProgramKind) {
  return uniquePrograms(
    Array.from(
      html.matchAll(
        /<div class="program-card">[\s\S]*?<p class="large-mw">([\s\S]*?)<\/p>[\s\S]*?<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/div>\s*<\/div>/gi
      )
    )
      .map((match) => {
        const label = cleanProgramLabel(stripTags(match[1] || ""));
        const href = new URL(match[2] || "", baseUrl).toString();
        return createProgram(label, href, kind);
      })
      .filter((entry): entry is InstitutionAdapterDiscoveredProgram => !!entry)
  );
}

function cleanBucknellProgramLabel(value: string) {
  return normalizeWhitespace(
    cleanProgramLabel(value)
      .replace(/\s*\(previously [^)]+\)\s*/gi, " ")
      .replace(/\s*&nbsp;\s*/gi, " ")
  );
}

function shouldSkipBucknellProgramLabel(label: string) {
  const normalized = label.toLowerCase();
  return (
    !normalized ||
    normalized === "interdepartmental" ||
    normalized === "foundation seminar" ||
    normalized === "nontraditional study" ||
    normalized === "residential college" ||
    normalized === "university courses" ||
    normalized === "military science"
  );
}

function joinBucknellAnchorTexts(texts: string[]) {
  let combined = "";
  for (const rawText of texts.map((value) => normalizeWhitespace(value)).filter(Boolean)) {
    if (!combined) {
      combined = rawText;
      continue;
    }

    if (/[A-Za-z]$/.test(combined) && /^[a-z]$/.test(rawText)) {
      combined += rawText;
      continue;
    }

    combined += ` ${rawText}`;
  }

  return combined;
}

function extractBucknellProgramsFromPanelHtml(baseUrl: string, panelHtml: string, kind: ProgramKind) {
  const programs: InstitutionAdapterDiscoveredProgram[] = [];

  for (const itemMatch of panelHtml.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
    const itemHtml = itemMatch[1] || "";
    const anchors = extractAnchors(baseUrl, itemHtml);
    if (anchors.length === 0) {
      continue;
    }

    const label = cleanBucknellProgramLabel(joinBucknellAnchorTexts(anchors.map((anchor) => anchor.text)));
    if (shouldSkipBucknellProgramLabel(label)) {
      continue;
    }

    const sourceUrl =
      anchors.find((anchor) => !/\/node\/\d+\/?$/i.test(new URL(anchor.href).pathname))?.href ||
      anchors[0]?.href ||
      baseUrl;
    const program = createProgram(label, sourceUrl, kind);
    if (program) {
      programs.push(program);
    }
  }

  return programs;
}

export function extractBucknellProgramsFromMajorsMinorsHtml(baseUrl: string, html: string) {
  const fullListStart = html.search(/id="m_fullList"/i);
  const relevantHtml = fullListStart >= 0 ? html.slice(fullListStart) : html;
  const programs: InstitutionAdapterDiscoveredProgram[] = [];

  const panels = [
    { panelId: "college-of-arts-sciences", kind: "major" as const },
    { panelId: "freeman-college-of-management", kind: "major" as const },
    { panelId: "college-of-engineering", kind: "major" as const },
    { panelId: "minors", kind: "minor" as const },
  ];

  for (const panel of panels) {
    const escapedPanelId = panel.panelId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const panelMatch = relevantHtml.match(
      new RegExp(
        `<div\\s+id="${escapedPanelId}"[^>]*class="c-accordion-item__panel c-wysiwyg"[^>]*>([\\s\\S]*?)<span aria-hidden="true">&nbsp;<\\/span>`,
        "i"
      )
    );
    const panelHtml = panelMatch?.[1] || "";
    if (!panelHtml) {
      continue;
    }

    programs.push(...extractBucknellProgramsFromPanelHtml(baseUrl, panelHtml, panel.kind));
  }

  return uniquePrograms(programs);
}

export function extractBostonCollegeProgramsFromHtml(baseUrl: string, html: string) {
  return uniquePrograms(
    extractAnchors(baseUrl, html)
      .map((anchor) => {
        const label = stripTrailingUndergraduateNotation(anchor.text);
        if (!label) {
          return null;
        }
        const href = anchor.href.toLowerCase();
        const isMinor =
          /minor/.test(label.toLowerCase()) ||
          /\/minor\b|minor\.html|major-and-minor|majors-minor|#tab-.*minor/.test(href);
        const isMajor =
          /major/.test(label.toLowerCase()) ||
          /\/major\b|major\.html|undergraduate-programs\/|interdisciplinary-majors|#tab-.*major/.test(href);
        if (isMinor && !isMajor) {
          return createProgram(label, anchor.href, "minor");
        }
        if (isMajor || /content\/bc-web\/schools\//.test(href)) {
          return createProgram(label, anchor.href, "major");
        }
        return null;
      })
      .filter((entry): entry is InstitutionAdapterDiscoveredProgram => !!entry)
  );
}

export function extractNorthwesternProgramsFromAdmissionsHtml(baseUrl: string, html: string) {
  const programs: InstitutionAdapterDiscoveredProgram[] = [];
  for (const rowMatch of html.matchAll(/<tr[^>]*>\s*<td[^>]*><div[^>]*class="program"[^>]*>([\s\S]*?)<\/div><\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/gi)) {
    const programName = stripTags(rowMatch[1] || "");
    const optionsHtml = rowMatch[2] || "";
    for (const anchor of Array.from(optionsHtml.matchAll(/<a[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi))) {
      const href = anchor[2] || "";
      const text = stripTags(anchor[3] || "");
      const kind = /\bminor\b/i.test(text) ? "minor" : /\bmajor\b/i.test(text) ? "major" : null;
      if (!kind || /certificate/i.test(text)) {
        continue;
      }
      const program = createProgram(programName, new URL(href, baseUrl).toString(), kind);
      if (program) {
        programs.push(program);
      }
    }
  }
  return uniquePrograms(programs);
}

export function extractGeorgetownProgramsFromDegreePage(baseUrl: string, html: string) {
  const programs: InstitutionAdapterDiscoveredProgram[] = [];
  const majorSectionMatch = html.match(/<h2[^>]*id="majors"[^>]*>[\s\S]*?<\/h2>([\s\S]*?)(?=<h2[^>]*id="minors"|<h2[^>]*id="certificates"|$)/i);
  const minorSectionMatch = html.match(/<h2[^>]*id="minors"[^>]*>[\s\S]*?<\/h2>([\s\S]*?)(?=<h2[^>]*id="certificates"|<h2[^>]*id="joint-degree"|$)/i);

  for (const [sectionHtml, kind] of [
    [majorSectionMatch?.[1] || "", "major"],
    [minorSectionMatch?.[1] || "", "minor"],
  ] as const) {
    for (const anchor of extractAnchors(baseUrl, sectionHtml)) {
      const label = stripTags(anchor.text);
      if (!label || /\bcertificate\b/i.test(label) || /\[top of page\]/i.test(label)) {
        continue;
      }
      const program = createProgram(label, anchor.href, kind);
      if (program) {
        programs.push(program);
      }
    }
  }

  return uniquePrograms(programs);
}

export function extractDukeProgramsFromAdmissionsHtml(baseUrl: string, html: string) {
  const programs: InstitutionAdapterDiscoveredProgram[] = [];
  for (const sectionMatch of html.matchAll(/<h3>\s*(Majors|Minors|Certificates)\s*<\/h3>\s*<div class="desc body-text-lg"><p>([\s\S]*?)<\/p>/gi)) {
    const heading = stripTags(sectionMatch[1] || "");
    const sectionHtml = sectionMatch[2] || "";
    const kind = /minors/i.test(heading) ? "minor" : /majors/i.test(heading) ? "major" : null;
    if (!kind) {
      continue;
    }
    const labels = sectionHtml
      .split(/<br\s*\/?>/i)
      .map((part) => stripTags(part).replace(/^\-+/, "").replace(/\*+/g, "").trim())
      .filter(Boolean);
    for (const label of labels) {
      const program = createProgram(label, baseUrl, kind);
      if (program) {
        programs.push(program);
      }
    }
  }
  return uniquePrograms(programs);
}

export function extractEmoryProgramsFromHtml(baseUrl: string, html: string) {
  const programs: InstitutionAdapterDiscoveredProgram[] = [];
  for (const itemMatch of html.matchAll(/<li class="filter-results-item">([\s\S]*?)<\/li>/gi)) {
    const itemHtml = itemMatch[1] || "";
    const titleMatch = itemHtml.match(/<div class="filter-results-title">([\s\S]*?)<\/div>/i);
    const label = stripTags(titleMatch?.[1] || "");
    if (!label) {
      continue;
    }
    const categoryText = stripTags((itemHtml.match(/<div[^>]*class="sr-only"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || "").replace(/['"]/g, ""));
    const lowerCategories = categoryText.toLowerCase();
    if (lowerCategories.includes("major")) {
      const program = createProgram(label, baseUrl, "major");
      if (program) {
        programs.push(program);
      }
    }
    if (lowerCategories.includes("minor")) {
      const program = createProgram(label, baseUrl, "minor");
      if (program) {
        programs.push(program);
      }
    }
  }
  return uniquePrograms(programs);
}

export function extractNotreDameProgramsFromHtml(baseUrl: string, html: string) {
  return uniquePrograms(
    extractAnchors(baseUrl, html)
      .filter((anchor) => /\.nd\.edu$/i.test(new URL(anchor.href).hostname))
      .filter((anchor) => !/graduateschool\.nd\.edu|graduate-programs|\/graduate\//i.test(anchor.href))
      .map((anchor) => {
        const rawLabel = cleanProgramLabel(
          anchor.text
            .replace(/\s*:\s*(?:M\.|Ph\.D\.|Ed\.D\.|J\.D\.).*$/i, "")
            .replace(/\s+\(Graduate\)$/i, "")
            .replace(/\s+Program$/i, "")
        );
        if (
          !rawLabel ||
          /academics|schools? & colleges|study abroad|residential colleges|online programs/i.test(rawLabel) ||
          /:\s*(?:M\.|Ph\.D\.|Ed\.D\.|J\.D\.)/i.test(anchor.text)
        ) {
          return null;
        }
        const kind = /\bminor\b/i.test(anchor.text) || /\/minor/i.test(anchor.href) ? "minor" : "major";
        return createProgram(rawLabel, anchor.href, kind);
      })
      .filter((entry): entry is InstitutionAdapterDiscoveredProgram => !!entry)
  );
}

function splitRochesterProgramLabel(label: string) {
  return normalizeWhitespace(label)
    .replace(/\b(BA|BS|BFA|BM|minor|certificate)\b[, ]+(?=[A-Z])/g, "$1|")
    .split("|")
    .map((part) =>
      cleanProgramLabel(
        part
          .replace(/^(BA|BS|BFA|BM)\s+/i, "")
          .replace(/\s+(BA|BS|BFA|BM)$/i, "")
          .replace(/\s+\bminor\b$/i, "")
          .replace(/\s+\bcertificate\b$/i, "")
      )
    )
    .filter(Boolean);
}

export function extractRochesterProgramsFromHtml(baseUrl: string, html: string) {
  const programs: InstitutionAdapterDiscoveredProgram[] = [];
  for (const anchor of extractAnchors(baseUrl, html)) {
    if (!/rochester\.edu$/i.test(new URL(anchor.href).hostname)) {
      continue;
    }
    if (
      /(?:^|\/)(?:graduate|masters|doctoral)(?:\/|$)/i.test(new URL(anchor.href).pathname) ||
      /certificate/i.test(anchor.href) ||
      /\bMA\b|\bMS\b|\bPhD\b/i.test(anchor.text)
    ) {
      continue;
    }

    const labels = splitRochesterProgramLabel(anchor.text);
    for (const label of labels) {
      if (
        !label ||
        /advance your career|advisory organizations|athletics|blackboard|body|academics|programs html/i.test(
          label.toLowerCase()
        )
      ) {
        continue;
      }
      const kind = /\bminor\b/i.test(anchor.text) || /\/minor/i.test(anchor.href) ? "minor" : "major";
      const program = createProgram(label, anchor.href, kind);
      if (program) {
        programs.push(program);
      }
    }
  }
  return uniquePrograms(programs);
}

export function extractUChicagoProgramsFromCourseleafHtml(
  baseUrl: string,
  html: string,
  sectionHeading: "List of Majors" | "List of Minors",
  kind: ProgramKind
) {
  const sectionMatch = html.match(
    new RegExp(
      `<h3[^>]*>\\s*(?:<span>)?${sectionHeading.replace(/ /g, "\\s+")}(?:<\\/span>)?\\s*<\\/h3>([\\s\\S]*?)(?=<\\/div><!--end #content-->|<h3|$)`,
      "i"
    )
  );
  if (!sectionMatch) {
    return [];
  }

  return uniquePrograms(
    extractAnchors(baseUrl, sectionMatch[1] || "")
      .filter((anchor) => /\/thecollege\//.test(new URL(anchor.href).pathname))
      .filter((anchor) => !/\/(programsofstudy|minors|curriculum|thecore|jointdegreeprograms)\/?$/.test(new URL(anchor.href).pathname))
      .map((anchor) => createProgram(cleanProgramLabel(anchor.text), anchor.href, kind))
      .filter((entry): entry is InstitutionAdapterDiscoveredProgram => !!entry)
  );
}

export function extractMitProgramsFromCourseleafHtml(
  baseUrl: string,
  html: string,
  kind: ProgramKind
) {
  if (kind === "minor") {
    const sectionMatch = html.match(/<div id="textcontainer" class="page_content">([\s\S]*?)<\/div><!--end #textcontainer -->/i);
    if (!sectionMatch) {
      return [];
    }
    return uniquePrograms(
      extractAnchors(baseUrl, sectionMatch[1] || "")
        .filter((anchor) => !/registrar|shass/i.test(anchor.href))
        .map((anchor) => {
          const label = cleanProgramLabel(anchor.text.replace(/\s*<sup>.*$/i, ""));
          if (!label) {
            return null;
          }
          return createProgram(label, anchor.href, "minor");
        })
        .filter((entry): entry is InstitutionAdapterDiscoveredProgram => !!entry)
    );
  }

  return uniquePrograms(
    extractAnchors(baseUrl, html)
      .filter((anchor) => anchor.href.includes("/degree-charts/"))
      .map((anchor) => {
        const label = cleanProgramLabel(anchor.text);
        if (
          !label ||
          /\b(phd|sm|meng|march|master|doctoral)\b/i.test(label) ||
          /\bsecond major\b/i.test(label) ||
          !/\(SB[,)]/i.test(label)
        ) {
          return null;
        }
        const stripped = cleanProgramLabel(
          label
            .replace(/\s*\(SB,\s*Course[^)]*\)\s*$/i, "")
            .replace(/\s*\(SB\)\s*$/i, "")
        );
        return createProgram(stripped, anchor.href, "major");
      })
      .filter((entry): entry is InstitutionAdapterDiscoveredProgram => !!entry)
  );
}

export function extractUcdavisProgramsFromCatalogHtml(baseUrl: string, html: string) {
  const start = html.indexOf('<div id="programsanddegreestextcontainer');
  if (start < 0) {
    return [];
  }
  const sitemapStart = html.indexOf('<div class="az_sitemap">', start);
  if (sitemapStart < 0) {
    return [];
  }
  const nextTab = html.indexOf('</div>\n\t\t\t</div>', sitemapStart);
  const end = nextTab > sitemapStart ? nextTab : html.length;
  const sectionHtml = html.slice(sitemapStart, end);

  return uniquePrograms(
    extractAnchors(baseUrl, sectionHtml)
      .map((anchor) => {
        const rawLabel = stripTags(anchor.text);
        if (!rawLabel) {
          return null;
        }
        if (/, Minor$/i.test(rawLabel)) {
          return createProgram(rawLabel.replace(/,\s*Minor$/i, ""), anchor.href, "minor");
        }
        if (/, Bachelor of (Arts|Science)$/i.test(rawLabel)) {
          const degreeType = /Bachelor of Science$/i.test(rawLabel) ? "BS" : "BA";
          return createProgram(
            rawLabel.replace(/,\s*Bachelor of (Arts|Science)$/i, ""),
            anchor.href,
            "major",
            { degreeType, programName: DEFAULT_PROGRAM_NAME }
          );
        }
        return null;
      })
      .filter((entry): entry is InstitutionAdapterDiscoveredProgram => !!entry)
  );
}

export function extractUcsdProgramsFromDegreesHtml(baseUrl: string, html: string) {
  const start = html.indexOf("Undergraduate Degrees Offered");
  const end = html.indexOf('<div class="clear footnotes">', start);
  if (start < 0 || end < 0) {
    return [];
  }

  const sectionHtml = html.slice(start, end);
  return uniquePrograms(
    Array.from(sectionHtml.matchAll(/<li>([\s\S]*?)<\/li>/gi))
      .map((match) => stripTags(match[1] || ""))
      .map((rawLabel) => {
        if (
          !rawLabel ||
          /\b(prelaw|premedical)\b/i.test(rawLabel) ||
          /\bBA\/MIA\b/i.test(rawLabel) ||
          /\bonly\b/i.test(rawLabel) ||
          /teaching credential|footnote/i.test(rawLabel)
        ) {
          return null;
        }
        const compact = normalizeWhitespace(rawLabel);
        const degreeType = /\bBS\b/.test(compact) ? "BS" : /\bBA\b/.test(compact) ? "BA" : null;
        if (!degreeType) {
          return null;
        }
        const stripped = cleanProgramLabel(
          compact
            .replace(/\s+\(effective\s+fall\s+\d{4}\)$/i, "")
            .replace(/\s+Bachelor of Science\b/gi, "")
            .replace(/\s+Bachelor of Arts\b/gi, "")
            .replace(/\s+\bBA\b$/i, "")
            .replace(/\s+\bBS\b$/i, "")
        );
        return createProgram(stripped, baseUrl, "major", {
          degreeType,
          programName: DEFAULT_PROGRAM_NAME,
        });
      })
      .filter((entry): entry is InstitutionAdapterDiscoveredProgram => !!entry)
  );
}

export function extractBrownConcentrationsFromBulletinHtml(baseUrl: string, html: string) {
  const start = html.indexOf('<div id="textcontainer" class="page_content">');
  if (start < 0) {
    return [];
  }
  const firstColumnEnd = html.indexOf('<div class="colb">', start);
  const end = firstColumnEnd > start ? firstColumnEnd : html.length;
  const sectionHtml = html.slice(start, end);

  return uniquePrograms(
    extractAnchors(baseUrl, sectionHtml)
      .filter((anchor) => /\/the-college\/concentrations\//.test(new URL(anchor.href).pathname))
      .filter((anchor) => !/\/the-college\/concentrations\/?$/.test(new URL(anchor.href).pathname))
      .map((anchor) => createProgram(cleanProgramLabel(anchor.text), anchor.href, "major"))
      .filter((entry): entry is InstitutionAdapterDiscoveredProgram => !!entry)
  );
}

export function extractRiceProgramsFromCatalogHtml(baseUrl: string, html: string) {
  const programs: InstitutionAdapterDiscoveredProgram[] = [];

  for (const row of html.matchAll(/<tr[^>]+role="row"[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = Array.from((row[1] || "").matchAll(/<td[^>]*role="gridcell"[^>]*>([\s\S]*?)<\/td>/gi));
    if (cells.length < 4) {
      continue;
    }

    const programLabel = stripTags(cells[0]?.[1] || "").replace(/^(Program|Department)\s+/i, "");
    const undergradCellHtml = cells[3]?.[1] || "";
    if (!programLabel || !undergradCellHtml || />\s*-\s*</.test(undergradCellHtml)) {
      continue;
    }

    for (const anchor of extractAnchors(baseUrl, undergradCellHtml)) {
      const credential = stripTags(anchor.text).toUpperCase().replace(/\./g, "");
      const kind: ProgramKind | null = /MINOR/i.test(credential)
        ? "minor"
        : /^[A-Z]{2,6}$/.test(credential)
          ? "major"
          : null;
      if (!kind) {
        continue;
      }

      const program = createProgram(programLabel, anchor.href, kind, {
        degreeType: kind === "major" ? credential : DEFAULT_DEGREE_TYPE,
      });
      if (program) {
        programs.push(program);
      }
    }
  }

  return uniquePrograms(programs);
}

export function extractWashingtonProgramsFromDegreeProgramsHtml(baseUrl: string, html: string) {
  const programs: InstitutionAdapterDiscoveredProgram[] = [];

  const restrictedSectionHeadings = new Set([
    "School of Dentistry",
    "School of Law",
    "School of Medicine",
  ]);

  for (const section of extractHeadingSections(html, "h3")) {
    const heading = cleanProgramLabel(section.heading);
    const isRestrictedSection = restrictedSectionHeadings.has(heading);
    for (const anchor of extractAnchors(baseUrl, section.sectionHtml)) {
      if (!/\/students\/gencat\/program\//.test(new URL(anchor.href).pathname)) {
        continue;
      }

      const label = cleanProgramLabel(anchor.text);
      if (
        !label ||
        /^(school of|college of|undergraduate interdisciplinary programs|reserve officers training corps programs)/i.test(label) ||
        /\b(graduate degree programs|professional degree programs|graduate study)\b/i.test(label)
      ) {
        continue;
      }

      if (isRestrictedSection && !/#program-UG-/i.test(anchor.href)) {
        continue;
      }

      const kind: ProgramKind = /-MINOR\b/i.test(anchor.href) ? "minor" : "major";
      const program = createProgram(label, anchor.href, kind);
      if (program) {
        programs.push(program);
      }
    }
  }

  return uniquePrograms(programs);
}

export function extractUcsdProgramsFromMajorCodesHtml(baseUrl: string, html: string) {
  const programs: InstitutionAdapterDiscoveredProgram[] = [];
  let currentDepartmentUrl = baseUrl;
  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = Array.from((row[1] || "").matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi));
    if (cells.length < 4) {
      continue;
    }
    const departmentAnchor = extractAnchors(baseUrl, cells[0]?.[1] || "")[0];
    if (departmentAnchor?.href) {
      currentDepartmentUrl = departmentAnchor.href;
    }
    const majorLabel = stripTags(cells[cells.length - 1]?.[1] || "");
    const majorUrl = currentDepartmentUrl;
    if (!majorLabel) {
      continue;
    }
    const degreeType =
      /\(B\.S\.\)$/i.test(majorLabel) ? "BS" : /\(B\.A\.\)$/i.test(majorLabel) ? "BA" : DEFAULT_DEGREE_TYPE;
    const cleanedLabel = cleanProgramLabel(
      majorLabel
        .replace(/\(B\.S\.\)$/i, "")
        .replace(/\(B\.A\.\)$/i, "")
        .replace(/\bwith a concentration in\b/gi, "(Concentration in")
    );
    const program = createProgram(cleanedLabel, majorUrl, "major", { degreeType });
    if (program) {
      programs.push(program);
    }
  }
  return uniquePrograms(programs);
}

export function extractUcsdProgramsFromMinorCodesHtml(baseUrl: string, html: string) {
  const programs: InstitutionAdapterDiscoveredProgram[] = [];
  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = Array.from((row[1] || "").matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi));
    if (cells.length < 4) {
      continue;
    }
    const labelHtml = cells[2]?.[1] || "";
    const label = stripTags(labelHtml);
    if (!label || /^minor$/i.test(label)) {
      continue;
    }
    const anchor = extractAnchors(baseUrl, labelHtml)[0];
    const program = createProgram(label, anchor?.href || baseUrl, "minor");
    if (program) {
      programs.push(program);
    }
  }
  return uniquePrograms(programs);
}

export function extractDartmouthProgramsFromCatalogHtml(baseUrl: string, html: string) {
  const programs: InstitutionAdapterDiscoveredProgram[] = [];
  const navMatch = html.match(
    /<li class="hasChildren active"><a href="\/en\/current\/orc\/departments-programs-undergraduate">[\s\S]*?<ul>([\s\S]*?)<\/ul><\/li>/i
  );
  const navHtml = navMatch?.[1] || "";
  for (const anchor of extractAnchors(baseUrl, navHtml)) {
    if (!/\/en\/current\/orc\/departments-programs-undergraduate\//.test(new URL(anchor.href).pathname)) {
      continue;
    }
    const label = cleanProgramLabel(
      stripTrailingUndergraduateNotation(anchor.text)
        .replace(/^Minor in\s+/i, "")
        .replace(/\s+-\s+Undergraduate$/i, "")
        .replace(/\s+Program$/i, "")
    );
    if (
      !label ||
      /^(college courses|divisional courses|ethics institute|language and advanced language study abroad program)$/i.test(label)
    ) {
      continue;
    }
    const kind: ProgramKind = /^Minor in /i.test(anchor.text) ? "minor" : "major";
    const program = createProgram(label, anchor.href, kind);
    if (program) {
      programs.push(program);
    }
  }
  return uniquePrograms(programs);
}

export function extractUclaDepartmentLinksFromNextData(html: string) {
  const nextData = extractNextDataJson(html) as
    | {
        props?: {
          pageProps?: {
            navigation?: {
              browse_nav?: UclaBrowseNode[];
            };
          };
        };
      }
    | null;
  const departmentNodes = nextData?.props?.pageProps?.navigation?.browse_nav?.[1]?.children || [];
  return departmentNodes
    .map((node) => {
      const title = cleanProgramLabel(node.title || "");
      const href = node.href || "";
      return { title, href, children: node.children || [] };
    })
    .filter((node) => node.title && /^\/browse\/Departments\//.test(node.href))
    .filter((node) => !/schoolwide programs|collegewide programs|cluster program/i.test(node.title));
}

export function classifyUclaDepartmentPageFromNextData(html: string) {
  const nextData = extractNextDataJson(html) as
    | {
        props?: {
          pageProps?: {
            browseContent?: {
              content?: {
                name?: string;
              };
              totalCount?: {
                aos?: Record<string, number>;
                minor?: Record<string, number>;
              };
              tabs?: Array<{
                sections?: Array<{
                  label?: string;
                }>;
              }>;
            };
          };
        };
      }
    | null;

  const browseContent = nextData?.props?.pageProps?.browseContent;
  const name = cleanProgramLabel(browseContent?.content?.name || "");
  const majorCount = Number(browseContent?.totalCount?.aos?.ucla || 0);
  const minorCount = Number(browseContent?.totalCount?.minor?.ucla || 0);

  return {
    displayName: name,
    hasMajor: majorCount > 0,
    hasMinor: minorCount > 0,
  };
}

export function extractVanderbiltProgramsFromApiPayload(
  payload: Array<{ program?: string; bachelors?: string; schoollist?: string[] }>
) {
  return uniquePrograms(
    payload
      .filter((item) => !!item?.bachelors)
      .map((item) => createProgram(item.program || "", item.bachelors || "", "major"))
      .filter((entry): entry is InstitutionAdapterDiscoveredProgram => !!entry)
  );
}

export function extractCmuProgramsFromFinderHtml(baseUrl: string, html: string) {
  const programs: InstitutionAdapterDiscoveredProgram[] = [];

  for (const match of html.matchAll(
    /<a[^>]*class="[^"]*\bprogram-finder__program\b[^"]*"[^>]*href="([^"]+)"[^>]*>[\s\S]*?<h2[^>]*class="[^"]*\bprogram-finder__program__title\b[^"]*"[^>]*>([\s\S]*?)<\/h2>[\s\S]*?<div[^>]*class="[^"]*\bprogram-finder__program__concentrations\b[^"]*"[^>]*>([\s\S]*?)<\/div>[\s\S]*?<\/a>/gi
  )) {
    const sourceUrl = new URL(match[1] || "", baseUrl).toString();
    const title = stripTags(match[2] || "");
    const concentrationsHtml = match[3] || "";
    const kinds = new Set<ProgramKind>();

    if (/\bmajor\b/i.test(concentrationsHtml)) {
      kinds.add("major");
    }
    if (/\bminor\b/i.test(concentrationsHtml)) {
      kinds.add("minor");
    }

    for (const kind of kinds) {
      const program = createProgram(title, sourceUrl, kind);
      if (program) {
        programs.push(program);
      }
    }
  }

  return uniquePrograms(programs);
}

export function extractBostonUniversityProgramsFromHtml(baseUrl: string, html: string) {
  const programs: InstitutionAdapterDiscoveredProgram[] = [];

  for (const match of html.matchAll(/<li\s+class="([^"]+)"[^>]*>([\s\S]*?)<\/li>/gi)) {
    const className = match[1] || "";
    const itemHtml = match[2] || "";
    const hasMajor = /\bmj\b/.test(className);
    const hasMinor = /\bmi\b/.test(className);
    if (!hasMajor && !hasMinor) {
      continue;
    }

    const rawLabel = stripTags(itemHtml)
      .replace(/\s+[A-Z]{2,}(?:\/[A-Z]{2,})?\s*\(.*/g, "")
      .replace(/\s*\(.*/g, "")
      .replace(/\s*—\s*.*/g, "")
      .trim();
    const label = normalizeWhitespace(rawLabel);
    if (!label) {
      continue;
    }

    const sourceUrl = new URL(
      (itemHtml.match(/href="([^"]+)"/i)?.[1] || "") || baseUrl,
      baseUrl
    ).toString();

    if (hasMajor) {
      const major = createProgram(label, sourceUrl, "major");
      if (major) {
        programs.push(major);
      }
    }
    if (hasMinor) {
      const minor = createProgram(label, sourceUrl, "minor");
      if (minor) {
        programs.push(minor);
      }
    }
  }

  return uniquePrograms(programs);
}

export function extractTuftsProgramsFromAdmissionsHtml(baseUrl: string, html: string) {
  const programs: InstitutionAdapterDiscoveredProgram[] = [];

  for (const match of html.matchAll(
    /<div class="js-program program_finder_box[\s\S]*?">[\s\S]*?<\/a>\s*<\/div>/gi
  )) {
    const cardHtml = match[0] || "";
    const title = stripTags(cardHtml.match(/<h3 class="program_finder_heading">([\s\S]*?)<\/h3>/i)?.[1] || "");
    const kinds = new Set<ProgramKind>();

    for (const labelMatch of cardHtml.matchAll(/<p class="program_finder_label">([\s\S]*?)<\/p>/gi)) {
      const label = stripTags(labelMatch[1] || "").toLowerCase();
      if (label.includes("major")) {
        kinds.add("major");
      }
      if (label.includes("minor")) {
        kinds.add("minor");
      }
    }

    const sourceUrl = new URL(
      (match[0].match(/data-url="([^"]+)"/i)?.[1] || "") || baseUrl,
      baseUrl
    ).toString();

    for (const kind of kinds) {
      const program = createProgram(title, sourceUrl, kind);
      if (program) {
        programs.push(program);
      }
    }
  }

  return uniquePrograms(programs);
}

export function extractRutgersProgramsFromUndergraduateHtml(baseUrl: string, html: string) {
  return uniquePrograms(
    Array.from(
      html.matchAll(
        /<li class="views-row accordion-list-item">([\s\S]*?)<\/li>/gi
      )
    )
      .map((match) => {
        const itemHtml = match[1] || "";
        const title = stripTags(itemHtml.match(/<h3>([\s\S]*?)<\/h3>/i)?.[1] || "");
        const newBrunswickRow = Array.from(
          itemHtml.matchAll(
            /<tr class="program_implementation">[\s\S]*?<td>\s*Rutgers-New Brunswick\s*<\/td>[\s\S]*?<a href="([^"]+)"/gi
          )
        )[0];
        if (!newBrunswickRow) {
          return null;
        }
        const sourceUrl = new URL((newBrunswickRow[1] || "") || baseUrl, baseUrl).toString();
        return createProgram(title, sourceUrl, "major");
      })
      .filter((entry): entry is InstitutionAdapterDiscoveredProgram => !!entry)
  );
}

export function extractMichiganProgramsFromHtml(baseUrl: string, html: string) {
  return uniquePrograms(
    Array.from(
      html.matchAll(
        /<tr[^>]*id="[^"]+"[^>]*>\s*<td[^>]*class="dept-name"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/td>/gi
      )
    )
      .map((match) => {
        const rawLabel = stripTags(match[2] || "");
        const rawLower = rawLabel.toLowerCase();
        const label = cleanProgramLabel(
          rawLabel
            .replace(/\s+\(Sub-Major\)$/i, "")
            .replace(/\s+\((Major|Minor)\)$/i, "")
            .replace(/\s+\[[^\]]+\]$/i, "")
        );
        if (!label || rawLower.includes("sub-major")) {
          return null;
        }
        const href = new URL(match[1] || "", baseUrl).toString();
        if (rawLower.includes("(major)")) {
          return createProgram(label, href, "major");
        }
        if (rawLower.includes("(minor)")) {
          return createProgram(label, href, "minor");
        }
        if (/-min$/i.test(match[1] || "")) {
          return createProgram(label, href, "minor");
        }
        if (/-maj$/i.test(match[1] || "")) {
          return createProgram(label, href, "major");
        }
        return null;
      })
      .filter((entry): entry is InstitutionAdapterDiscoveredProgram => !!entry)
  );
}

export function extractUncProgramsFromCatalogHtml(baseUrl: string, html: string) {
  return uniquePrograms(
    extractAnchors(baseUrl, html)
      .filter((link) => link.href.includes("/undergraduate/programs-study/"))
      .map((link) => {
        const lower = link.text.toLowerCase();
        if (!lower.includes("major") && !lower.includes("minor")) {
          return null;
        }
        const kind = lower.includes("minor") ? "minor" : "major";
        const label = cleanProgramLabel(
          link.text
            .replace(/\s*[–-]\s*.*(?:Concentration|Track)$/i, "")
            .replace(/\s+Major,\s*B\.[A-Z.]+$/i, "")
            .replace(/\s*,\s*B\.[A-Z.]+$/i, "")
            .replace(/\s+Major$/i, "")
            .replace(/\s+Minor$/i, "")
        );
        return createProgram(label, link.href, kind);
      })
      .filter((entry): entry is InstitutionAdapterDiscoveredProgram => !!entry)
  );
}

export function extractPennProgramsFromCatalogHtml(baseUrl: string, html: string, kind: ProgramKind) {
  return uniquePrograms(
    extractAnchors(baseUrl, html)
      .filter((anchor) => anchor.href.includes("/undergraduate/programs/") || (kind === "minor" && anchor.href.endsWith("#text")))
      .map((anchor) => {
        if (/^view program requirements$/i.test(anchor.text) || /^back to top$/i.test(anchor.text) || /^programs$/i.test(anchor.text)) {
          return null;
        }
        if (/^https?:\/\//i.test(anchor.text)) {
          return null;
        }
        return createProgram(stripTrailingUndergraduateNotation(anchor.text), anchor.href.endsWith("#text") ? baseUrl : anchor.href, kind);
      })
      .filter((entry): entry is InstitutionAdapterDiscoveredProgram => !!entry)
  );
}

function parseCoursedogNuxtPayload(html: string) {
  const start = html.indexOf("window.__NUXT__=");
  if (start < 0) {
    return null;
  }
  const end = html.indexOf("</script>", start);
  if (end < 0) {
    return null;
  }

  const expression = html
    .slice(start, end)
    .replace(/^window\.__NUXT__=/, "")
    .replace(/;\s*$/, "");

  try {
    const context: { window: { __NUXT__?: unknown }; document: Record<string, never>; console: { log(): void; warn(): void; error(): void } } = {
      window: {},
      document: {},
      console: { log() {}, warn() {}, error() {} },
    };
    vm.createContext(context);
    vm.runInContext(`window.__NUXT__=${expression}`, context, { timeout: 12_000 });
    return context.window?.__NUXT__ || null;
  } catch {
    return null;
  }
}

function decodeCoursedogContentText(value: string) {
  return normalizeWhitespace(
    decodeHtmlEntities(
      value
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<\/p>/gi, ". ")
        .replace(/<\/h[1-6]>/gi, ". ")
        .replace(/<\/li>/gi, ". ")
        .replace(/<[^>]+>/g, " ")
    )
  );
}

function splitInlineProgramLabels(value: string) {
  return normalizeWhitespace(value)
    .split(/\s*(?:;|\/)\s*|\s*,\s*(?=[A-Z])|\s+\(\d+\)\s+/)
    .map((part) => cleanProgramLabel(part))
    .filter(Boolean);
}

function toTitleCaseLabel(value: string) {
  return value
    .split(/\s+/)
    .map((part, index) => {
      if (!part) {
        return part;
      }
      const lower = part.toLowerCase();
      if (index > 0 && ["and", "of", "in", "for", "to", "the"].includes(lower)) {
        return lower;
      }
      return part[0].toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}

function isUcsbFallbackDepartmentLabel(label: string) {
  const lower = normalizeWhitespace(label).toLowerCase();
  return !(
    lower.includes("graduate division") ||
    lower.includes("writing program") ||
    lower.includes("teacher education") ||
    lower === "education" ||
    lower.includes("office") ||
    lower.includes("division")
  );
}

export function extractUcsbProgramsFromDepartmentPage(
  sourceUrl: string,
  departmentDisplayName: string,
  pageContentHtml: string
) {
  const programs: InstitutionAdapterDiscoveredProgram[] = [];
  const text = decodeCoursedogContentText(pageContentHtml);

  const majorLabels = new Set<string>();
  const minorLabels = new Set<string>();

  function normalizeUcsbLabel(label: string) {
    const cleaned = cleanProgramLabel(label).replace(/\s+also$/i, "");
    if (!cleaned) {
      return "";
    }
    if (cleaned.toLowerCase() === departmentDisplayName.toLowerCase()) {
      return departmentDisplayName;
    }
    return toTitleCaseLabel(cleaned);
  }

  for (const match of text.matchAll(
    /bachelor of (?:arts|science|fine arts|music)(?: degree)? in ([^.]+?)(?=(?: also | provides| provide| prepares| prepare| emphasizes| offers| is | are |, and the |\.\s|;))/gi
  )) {
    for (const rawLabel of splitInlineProgramLabels(match[1] || "")) {
      const label = normalizeUcsbLabel(rawLabel);
      if (!label) {
        continue;
      }
      majorLabels.add(label);
    }
  }

  for (const match of text.matchAll(
    /offer(?:s)?\s+a\s+bachelor of (?:arts|science|fine arts|music)(?: degree)? in ([^.]+?)\./gi
  )) {
    for (const rawLabel of splitInlineProgramLabels(match[1] || "")) {
      const label = normalizeUcsbLabel(rawLabel);
      if (!label) {
        continue;
      }
      majorLabels.add(label);
    }
  }

  for (const match of text.matchAll(/undergraduate major in ([^.]+?)(?=(?: has| is | are | at |,|\.\s))/gi)) {
    for (const rawLabel of splitInlineProgramLabels(match[1] || "")) {
      const label = normalizeUcsbLabel(rawLabel);
      if (!label) {
        continue;
      }
      majorLabels.add(label);
    }
  }

  for (const match of text.matchAll(/students who major in ([^.]+?)(?=(?: learn| study| explore| often| at | are | will | can | may |,|\.\s))/gi)) {
    for (const rawLabel of splitInlineProgramLabels(match[1] || "")) {
      const label = normalizeUcsbLabel(rawLabel);
      if (!label) {
        continue;
      }
      majorLabels.add(label);
    }
  }

  for (const match of text.matchAll(/minors? in ([^.]+?)(?=(?: also | provides| provide| offers| are | is |,|\.\s|;))/gi)) {
    for (const rawLabel of splitInlineProgramLabels(match[1] || "")) {
      const label = normalizeUcsbLabel(rawLabel);
      if (!label) {
        continue;
      }
      minorLabels.add(label);
    }
  }

  for (const match of text.matchAll(/(?:offers|offer)\s+(?:an?\s+|the\s+)?minor in ([^.]+?)(?=(?: also | provides| provide| offers| is | are |,|\.\s|;))/gi)) {
    for (const rawLabel of splitInlineProgramLabels(match[1] || "")) {
      const label = normalizeUcsbLabel(rawLabel);
      if (!label) {
        continue;
      }
      minorLabels.add(label);
    }
  }

  for (const match of text.matchAll(/(?:offers|offer)\s+(?:an?\s+|the\s+)?minor in ([^.]+?)\./gi)) {
    for (const rawLabel of splitInlineProgramLabels(match[1] || "")) {
      const label = normalizeUcsbLabel(rawLabel);
      if (!label) {
        continue;
      }
      minorLabels.add(label);
    }
  }

  for (const label of Array.from(majorLabels)) {
    const program = createProgram(label, sourceUrl, "major");
    if (program) {
      programs.push(program);
    }
  }

  for (const label of Array.from(minorLabels)) {
    const program = createProgram(label, sourceUrl, "minor");
    if (program) {
      programs.push(program);
    }
  }

  if (programs.length === 0 && isUcsbFallbackDepartmentLabel(departmentDisplayName) && /\b(bachelor|major|minor)\b/i.test(text)) {
    const program = createProgram(departmentDisplayName, sourceUrl, "major");
    if (program) {
      programs.push(program);
    }
  }

  return uniquePrograms(programs);
}

function isLikelyUndergraduateDegreeLabel(value: string) {
  return /\((BA|BS|BBA|BFA|BARCH|BM|BSBA|BSIB|BLS|BSE|BPH)\)/i.test(value);
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

    const programs = extractBerkeleyProgramsFromAdmissionsHtml(page.url, page.html);

    return programs.length > 0
      ? {
          programs,
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

const northeasternAdapter: InstitutionCatalogAdapter = {
  name: "northeastern",
  matches(input) {
    return input.institutionCanonicalName.includes("northeastern-university");
  },
  async discover() {
    const rootPage = await fetchHtmlPage("https://catalog.northeastern.edu/undergraduate/");
    if (!rootPage) {
      return null;
    }

    const schoolLinks = Array.from(
      new Set(
        extractAnchors(rootPage.url, rootPage.html)
          .filter((anchor) => isLikelyNortheasternCatalogRootLink(anchor.href))
          .filter(
            (anchor) =>
              /(college|school|mills)/i.test(anchor.text) &&
              !/professional-studies/i.test(anchor.href) &&
              !/(admission|entering-students|expenses|academic-policies|university-academics)/i.test(anchor.href)
          )
          .map((anchor) => new URL(anchor.href, rootPage.url).toString())
      )
    ).slice(0, 12);

    const schoolPages = (
      await Promise.all(schoolLinks.map((link) => fetchHtmlPage(link)))
    ).filter((page): page is HtmlPage => !!page);

    const secondaryUrls = Array.from(
      new Set(
        schoolPages.flatMap((page) => extractNortheasternSecondaryCatalogUrls(page.url, page.html))
      )
    ).slice(0, 12);
    const secondaryPages = (
      await Promise.all(secondaryUrls.map((link) => fetchHtmlPage(link)))
    ).filter((page): page is HtmlPage => !!page);

    const programs = uniquePrograms(
      [...schoolPages, ...secondaryPages].flatMap((page) =>
        extractNortheasternProgramsFromCatalogSchoolHtml(page.url, page.html)
      )
    );

    return programs.length > 0
      ? {
          programs,
          sourcePages: [rootPage.url, ...schoolPages.map((page) => page.url), ...secondaryPages.map((page) => page.url)],
        }
      : null;
  },
};

const yaleAdapter: InstitutionCatalogAdapter = {
  name: "yale",
  matches(input) {
    return input.institutionCanonicalName.includes("yale-university");
  },
  async discover() {
    const page = await fetchHtmlPage("https://catalog.yale.edu/ycps/majors-in-yale-college/");
    if (!page) {
      return null;
    }

    const programs = extractYaleMajorsFromHtml(page.url, page.html);
    return programs.length > 0 ? { programs, sourcePages: [page.url] } : null;
  },
};

const jhuAdapter: InstitutionCatalogAdapter = {
  name: "jhu",
  matches(input) {
    return input.institutionCanonicalName.includes("johns-hopkins-university");
  },
  async discover() {
    const page = await fetchHtmlPage(
      "https://e-catalogue.jhu.edu/arts-sciences/full-time-residential-programs/degree-programs/"
    );
    if (!page) {
      return null;
    }

    const programs = extractJhuProgramsFromHtml(page.url, page.html);
    return programs.length > 0 ? { programs, sourcePages: [page.url] } : null;
  },
};

const washuAdapter: InstitutionCatalogAdapter = {
  name: "washu",
  matches(input) {
    return input.institutionCanonicalName.includes("washington-university-in-st-louis");
  },
  async discover() {
    const majorsPage = await fetchHtmlPage("https://bulletin.wustl.edu/undergrad/majors/");
    const minorsPage = await fetchHtmlPage("https://bulletin.wustl.edu/undergrad/minors/");
    if (!majorsPage && !minorsPage) {
      return null;
    }

    const programs = uniquePrograms([
      ...extractWashuProgramsFromHtml(majorsPage?.url || "https://bulletin.wustl.edu/undergrad/majors/", majorsPage?.html || "", "major"),
      ...extractWashuProgramsFromHtml(minorsPage?.url || "https://bulletin.wustl.edu/undergrad/minors/", minorsPage?.html || "", "minor"),
    ]);

    return programs.length > 0
      ? {
          programs,
          sourcePages: [majorsPage?.url, minorsPage?.url].filter((value): value is string => !!value),
        }
      : null;
  },
};

const wisconsinAdapter: InstitutionCatalogAdapter = {
  name: "wisconsin",
  matches(input) {
    return input.institutionCanonicalName.includes("wisconsin-madison");
  },
  async discover() {
    const page = await fetchHtmlPage("https://guide.wisc.edu/explore-majors/");
    if (!page) {
      return null;
    }

    const programs = extractWisconsinProgramsFromHtml(page.url, page.html);

    return programs.length > 0
      ? {
          programs,
          sourcePages: [page.url],
        }
      : null;
  },
};

const caltechAdapter: InstitutionCatalogAdapter = {
  name: "caltech-catalog",
  matches(input) {
    return input.institutionCanonicalName.includes("california-institute-of-technology");
  },
  async discover() {
    const page = await fetchHtmlPage("https://catalog.caltech.edu/current/");
    if (!page) {
      return null;
    }

    const programs = extractCaltechProgramsFromCatalogHtml(page.url, page.html);
    return programs.length > 0
      ? {
          programs,
          sourcePages: [page.url],
        }
      : null;
  },
};

const ucsbAdapter: InstitutionCatalogAdapter = {
  name: "ucsb-coursedog",
  matches(input) {
    return input.institutionCanonicalName.includes("university-of-california-santa-barbara");
  },
  async discover() {
    const departmentsPage = await fetchHtmlPage("https://catalog.ucsb.edu/departments");
    if (!departmentsPage) {
      return null;
    }

    const departmentUrls = Array.from(
      new Set(
        extractAnchors(departmentsPage.url, departmentsPage.html)
          .filter((anchor) => /\/departments\/[^/]+\/overview$/.test(new URL(anchor.href).pathname))
          .map((anchor) => anchor.href)
      )
    );

    const departmentPages = (
      await mapWithConcurrency(departmentUrls, 6, async (url) => fetchHtmlPage(url))
    ).filter((page): page is HtmlPage => !!page);

    const programs = uniquePrograms(
      departmentPages.flatMap((page) => {
        const nuxt = parseCoursedogNuxtPayload(page.html);
        const pageData = (((nuxt as { data?: Array<Record<string, unknown>> } | null)?.data || [])[0] ||
          {}) as Record<string, any>;
        const departmentDisplayName = normalizeWhitespace(
          pageData?.department?.displayName || pageData?.department?.name || ""
        );
        const pageContent = typeof pageData?.page?.content === "string" ? pageData.page.content : "";
        if (!departmentDisplayName || !pageContent) {
          return [];
        }
        return extractUcsbProgramsFromDepartmentPage(page.url, departmentDisplayName, pageContent);
      })
    );

    return programs.length > 0
      ? {
          programs,
          sourcePages: [departmentsPage.url, ...departmentPages.map((page) => page.url)],
        }
      : null;
  },
};

const bostonCollegeAdapter: InstitutionCatalogAdapter = {
  name: "boston-college",
  matches(input) {
    return input.institutionCanonicalName.includes("boston-college");
  },
  async discover() {
    const page = await fetchHtmlPage("https://www.bc.edu/content/bc-web/academics/undergraduate-programs.html");
    const majorsMinorsPage = await fetchHtmlPage("https://www.bc.edu/content/bc-web/admission/majors-minors.html");
    if (!page && !majorsMinorsPage) {
      return null;
    }

    const programs = uniquePrograms([
      ...extractBostonCollegeProgramsFromHtml(
        page?.url || "https://www.bc.edu/content/bc-web/academics/undergraduate-programs.html",
        page?.html || ""
      ),
      ...extractBostonCollegeProgramsFromHtml(
        majorsMinorsPage?.url || "https://www.bc.edu/content/bc-web/admission/majors-minors.html",
        majorsMinorsPage?.html || ""
      ),
    ]);

    return programs.length > 0
      ? {
          programs,
          sourcePages: [page?.url, majorsMinorsPage?.url].filter((value): value is string => !!value),
        }
      : null;
  },
};

const umdAdapter: InstitutionCatalogAdapter = {
  name: "umd",
  matches(input) {
    return input.institutionCanonicalName.includes("maryland-college-park");
  },
  async discover() {
    const page = await fetchHtmlPage("https://academiccatalog.umd.edu/undergraduate/programs/");
    if (!page) {
      return null;
    }

    const programs = uniquePrograms(
      extractAnchors(page.url, page.html)
        .filter((anchor) => /\/undergraduate\/colleges-schools\//.test(anchor.href))
        .map((anchor) => {
          if (/certificate/i.test(anchor.text)) {
            return null;
          }
          if (/\/minor\/|minor\//i.test(anchor.href) || /\bminor\b/i.test(anchor.text)) {
            return createProgram(anchor.text, anchor.href, "minor");
          }
          if (/\/major\/|major\//i.test(anchor.href) || /\bmajor\b/i.test(anchor.text)) {
            return createProgram(anchor.text, anchor.href, "major");
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

const uscAdapter: InstitutionCatalogAdapter = {
  name: "usc",
  matches(input) {
    return input.institutionCanonicalName.includes("southern-california");
  },
  async discover() {
    const page = await fetchHtmlPage("https://catalogue.usc.edu/content.php?catoid=21&navoid=8873");
    if (!page) {
      return null;
    }

    const programs = uniquePrograms(
      extractAnchors(page.url, page.html)
        .filter((anchor) => /preview_program\.php/i.test(anchor.href))
        .map((anchor) => {
          const label = dedupeRepeatedProgramLabel(anchor.text);
          if (!label || /\bcertificate\b/i.test(label)) {
            return null;
          }
          if (/\bminor\b/i.test(label)) {
            return createProgram(label, anchor.href, "minor");
          }
          if (isLikelyUndergraduateDegreeLabel(label)) {
            return createProgram(label, anchor.href, "major");
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

const lehighAdapter: InstitutionCatalogAdapter = {
  name: "lehigh",
  matches(input) {
    return input.institutionCanonicalName.includes("lehigh-university");
  },
  async discover() {
    const page = await fetchHtmlPage("https://catalog.lehigh.edu/programsandmajors/");
    if (!page) {
      return null;
    }

    const programs = uniquePrograms(
      extractAnchors(page.url, page.html)
        .filter((anchor) => /\/coursesprogramsandcurricula\//.test(anchor.href))
        .filter((anchor) => !/undergraduatestudies|graduatestudyandresearch|programsandmajors/i.test(anchor.href))
        .map((anchor) => createProgram(anchor.text, anchor.href, "major"))
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

const nyuAdapter: InstitutionCatalogAdapter = {
  name: "nyu",
  matches(input) {
    return input.institutionCanonicalName.includes("new-york-university");
  },
  async discover() {
    const rootPage = await fetchHtmlPage("https://bulletins.nyu.edu/undergraduate/");
    if (!rootPage) {
      return null;
    }

    const schoolUrls = Array.from(
      new Set(
        extractAnchors(rootPage.url, rootPage.html)
          .filter((anchor) => /\/undergraduate\/[^/]+\/?$/.test(anchor.href))
          .filter((anchor) => !/professional-studies/i.test(anchor.href))
          .map((anchor) => new URL(anchor.href, rootPage.url).toString())
      )
    ).slice(0, 16);

    const schoolPages = (
      await Promise.all(schoolUrls.map((url) => fetchHtmlPage(url)))
    ).filter((page): page is HtmlPage => !!page);

    const programs = uniquePrograms(
      schoolPages.flatMap((page) =>
        extractAnchors(page.url, page.html)
          .filter((anchor) => /\/undergraduate\/[^/]+\/programs\//.test(anchor.href))
          .map((anchor) => {
            if (/\bminor\b/i.test(anchor.text)) {
              return createProgram(anchor.text, anchor.href, "minor");
            }
            if (isLikelyUndergraduateDegreeLabel(anchor.text)) {
              return createProgram(anchor.text, anchor.href, "major");
            }
            return null;
          })
          .filter((entry): entry is InstitutionAdapterDiscoveredProgram => !!entry)
      )
    );

    return programs.length > 0
      ? {
          programs,
          sourcePages: [rootPage.url, ...schoolPages.map((page) => page.url)],
        }
      : null;
  },
};

const northwesternAdapter: InstitutionCatalogAdapter = {
  name: "northwestern-admissions",
  matches(input) {
    return input.institutionCanonicalName.includes("northwestern-university");
  },
  async discover() {
    const page = await fetchHtmlPage("https://admissions.northwestern.edu/academics/majors-minors/");
    if (!page) {
      return null;
    }
    const programs = extractNorthwesternProgramsFromAdmissionsHtml(page.url, page.html);
    return programs.length > 0 ? { programs, sourcePages: [page.url] } : null;
  },
};

const georgetownAdapter: InstitutionCatalogAdapter = {
  name: "georgetown",
  matches(input) {
    return input.institutionCanonicalName.includes("georgetown-university");
  },
  async discover() {
    const page = await fetchHtmlPage("https://bulletin.georgetown.edu/schools-programs/college/degree-programs/");
    if (!page) {
      return null;
    }
    const programs = extractGeorgetownProgramsFromDegreePage(page.url, page.html);
    return programs.length > 0 ? { programs, sourcePages: [page.url] } : null;
  },
};

const notreDameAdapter: InstitutionCatalogAdapter = {
  name: "notre-dame",
  matches(input) {
    return input.institutionCanonicalName.includes("notre-dame");
  },
  async discover() {
    const page = await fetchHtmlPage("https://www.nd.edu/academics/programs/");
    if (!page) {
      return null;
    }
    const programs = extractNotreDameProgramsFromHtml(page.url, page.html);
    return programs.length > 0 ? { programs, sourcePages: [page.url] } : null;
  },
};

const rochesterAdapter: InstitutionCatalogAdapter = {
  name: "rochester",
  matches(input) {
    return input.institutionCanonicalName.includes("university-of-rochester");
  },
  async discover() {
    const page = await fetchHtmlPage("https://www.rochester.edu/academics/programs.html");
    if (!page) {
      return null;
    }
    const programs = extractRochesterProgramsFromHtml(page.url, page.html);
    return programs.length > 0 ? { programs, sourcePages: [page.url] } : null;
  },
};

const uchicagoAdapter: InstitutionCatalogAdapter = {
  name: "uchicago-courseleaf",
  matches(input) {
    return input.institutionCanonicalName.includes("university-of-chicago");
  },
  async discover() {
    const majorsPage = await fetchHtmlPage("http://collegecatalog.uchicago.edu/thecollege/programsofstudy/");
    const minorsPage = await fetchHtmlPage("http://collegecatalog.uchicago.edu/thecollege/minors/");
    if (!majorsPage && !minorsPage) {
      return null;
    }

    const programs = uniquePrograms([
      ...(majorsPage
        ? extractUChicagoProgramsFromCourseleafHtml(majorsPage.url, majorsPage.html, "List of Majors", "major")
        : []),
      ...(minorsPage
        ? extractUChicagoProgramsFromCourseleafHtml(minorsPage.url, minorsPage.html, "List of Minors", "minor")
        : []),
    ]);

    return programs.length > 0
      ? {
          programs,
          sourcePages: [majorsPage?.url, minorsPage?.url].filter((value): value is string => !!value),
        }
      : null;
  },
};

const ucdavisAdapter: InstitutionCatalogAdapter = {
  name: "ucdavis-catalog",
  matches(input) {
    return input.institutionCanonicalName.includes("university-of-california-davis");
  },
  async discover() {
    const page = await fetchHtmlPage("https://catalog.ucdavis.edu/departments-programs-degrees/");
    if (!page) {
      return null;
    }
    const programs = extractUcdavisProgramsFromCatalogHtml(page.url, page.html);
    return programs.length > 0 ? { programs, sourcePages: [page.url] } : null;
  },
};

const ucsdAdapter: InstitutionCatalogAdapter = {
  name: "ucsd-degrees-offered",
  matches(input) {
    return input.institutionCanonicalName.includes("university-of-california-san-diego");
  },
  async discover() {
    const [degreesPage, majorCodesPage, minorCodesPage] = await Promise.all([
      fetchHtmlPage("https://catalog.ucsd.edu/undergraduate/degrees-offered/index.html"),
      fetchHtmlPage("http://blink.ucsd.edu/instructors/academic-info/majors/major-codes.html"),
      fetchHtmlPage("http://blink.ucsd.edu/instructors/academic-info/majors/minor-codes.html"),
    ]);
    if (!degreesPage && !majorCodesPage && !minorCodesPage) {
      return null;
    }
    const programs = uniquePrograms([
      ...(degreesPage ? extractUcsdProgramsFromDegreesHtml(degreesPage.url, degreesPage.html) : []),
      ...(majorCodesPage ? extractUcsdProgramsFromMajorCodesHtml(majorCodesPage.url, majorCodesPage.html) : []),
      ...(minorCodesPage ? extractUcsdProgramsFromMinorCodesHtml(minorCodesPage.url, minorCodesPage.html) : []),
    ]);
    return programs.length > 0
      ? {
          programs,
          sourcePages: [degreesPage?.url, majorCodesPage?.url, minorCodesPage?.url].filter((value): value is string => !!value),
        }
      : null;
  },
};

const dartmouthAdapter: InstitutionCatalogAdapter = {
  name: "dartmouth-smartcatalog",
  matches(input) {
    return input.institutionCanonicalName.includes("dartmouth-college");
  },
  async discover() {
    const page = await fetchHtmlPage("https://dartmouth.smartcatalogiq.com/en/current/orc/departments-programs-undergraduate/");
    if (!page) {
      return null;
    }
    const programs = extractDartmouthProgramsFromCatalogHtml(page.url, page.html);
    return programs.length > 0 ? { programs, sourcePages: [page.url] } : null;
  },
};

const uclaAdapter: InstitutionCatalogAdapter = {
  name: "ucla-next-browse",
  matches(input) {
    return input.institutionCanonicalName.includes("university-of-california-los-angeles");
  },
  async discover() {
    const homePage = await fetchHtmlPage("https://catalog.registrar.ucla.edu/");
    if (!homePage) {
      return null;
    }

    const departmentLinks = extractUclaDepartmentLinksFromNextData(homePage.html).slice(0, 220);
    if (!departmentLinks.length) {
      return null;
    }

    const pageResults = await mapWithConcurrency(departmentLinks, 8, async (department) => {
      const page = await fetchHtmlPage(new URL(department.href, homePage.url).toString());
      if (!page) {
        return [];
      }
      const classification = classifyUclaDepartmentPageFromNextData(page.html);
      const displayName = classification.displayName || department.title;
      const programs: InstitutionAdapterDiscoveredProgram[] = [];
      if (classification.hasMajor) {
        const major = createProgram(displayName, page.url, "major");
        if (major) {
          programs.push(major);
        }
      }
      if (classification.hasMinor) {
        const minor = createProgram(displayName, page.url, "minor");
        if (minor) {
          programs.push(minor);
        }
      }
      return programs;
    });

    const programs = uniquePrograms(pageResults.flat());
    return programs.length > 0 ? { programs, sourcePages: [homePage.url] } : null;
  },
};

const brownAdapter: InstitutionCatalogAdapter = {
  name: "brown-bulletin",
  matches(input) {
    return input.institutionCanonicalName.includes("brown-university");
  },
  async discover() {
    const page = await fetchHtmlPage("https://bulletin.brown.edu/the-college/concentrations/");
    if (!page) {
      return null;
    }
    const programs = extractBrownConcentrationsFromBulletinHtml(page.url, page.html);
    return programs.length > 0 ? { programs, sourcePages: [page.url] } : null;
  },
};

const riceAdapter: InstitutionCatalogAdapter = {
  name: "rice-courseleaf",
  matches(input) {
    return input.institutionCanonicalName.includes("rice-university");
  },
  async discover() {
    const page = await fetchHtmlPage("https://ga.rice.edu/programs-study/departments-programs/");
    if (!page) {
      return null;
    }
    const programs = extractRiceProgramsFromCatalogHtml(page.url, page.html);
    return programs.length > 0 ? { programs, sourcePages: [page.url] } : null;
  },
};

const washingtonAdapter: InstitutionCatalogAdapter = {
  name: "washington-degree-programs",
  matches(input) {
    return input.institutionCanonicalName.includes("university-of-washington");
  },
  async discover() {
    const page = await fetchHtmlPage("https://www.washington.edu/students/gencat/degree_programs.html");
    if (!page) {
      return null;
    }
    const programs = extractWashingtonProgramsFromDegreeProgramsHtml(page.url, page.html);
    return programs.length > 0 ? { programs, sourcePages: [page.url] } : null;
  },
};

const mitAdapter: InstitutionCatalogAdapter = {
  name: "mit-courseleaf",
  matches(input) {
    return input.institutionCanonicalName.includes("massachusetts-institute-of-technology");
  },
  async discover() {
    const majorsPage = await fetchHtmlPage("https://catalog.mit.edu/mit/undergraduate-education/academic-programs/majors/");
    const minorsPage = await fetchHtmlPage("https://catalog.mit.edu/mit/undergraduate-education/academic-programs/minors/");
    if (!majorsPage && !minorsPage) {
      return null;
    }

    const programs = uniquePrograms([
      ...(majorsPage ? extractMitProgramsFromCourseleafHtml(majorsPage.url, majorsPage.html, "major") : []),
      ...(minorsPage ? extractMitProgramsFromCourseleafHtml(minorsPage.url, minorsPage.html, "minor") : []),
    ]);

    return programs.length > 0
      ? {
          programs,
          sourcePages: [majorsPage?.url, minorsPage?.url].filter((value): value is string => !!value),
        }
      : null;
  },
};

const carnegieMellonAdapter: InstitutionCatalogAdapter = {
  name: "carnegie-mellon-program-finder",
  matches(input) {
    return input.institutionCanonicalName.includes("carnegie-mellon");
  },
  async discover() {
    const page = await fetchHtmlPage("https://www.cmu.edu/admission/majors-programs/undergraduate-program-finder");
    if (!page) {
      return null;
    }

    const programs = extractCmuProgramsFromFinderHtml(page.url, page.html);
    return programs.length > 0
      ? {
          programs,
          sourcePages: [page.url],
        }
      : null;
  },
};

const bostonUniversityAdapter: InstitutionCatalogAdapter = {
  name: "boston-university-degree-programs",
  matches(input) {
    return input.institutionCanonicalName.includes("boston-university");
  },
  async discover() {
    const page = await fetchHtmlPage("https://www.bu.edu/academics/degree-programs/");
    if (!page) {
      return null;
    }

    const programs = extractBostonUniversityProgramsFromHtml(page.url, page.html);
    return programs.length > 0
      ? {
          programs,
          sourcePages: [page.url],
        }
      : null;
  },
};

const tuftsAdapter: InstitutionCatalogAdapter = {
  name: "tufts-admissions-program-finder",
  matches(input) {
    return input.institutionCanonicalName.includes("tufts-university");
  },
  async discover() {
    const page = await fetchHtmlPage("https://admissions.tufts.edu/discover-tufts/academics/majors-and-minors/");
    if (!page) {
      return null;
    }

    const programs = extractTuftsProgramsFromAdmissionsHtml(page.url, page.html);
    return programs.length > 0
      ? {
          programs,
          sourcePages: [page.url],
        }
      : null;
  },
};

const bucknellAdapter: InstitutionCatalogAdapter = {
  name: "bucknell-majors-minors",
  matches(input) {
    return input.institutionCanonicalName.includes("bucknell-university");
  },
  async discover() {
    const page = await fetchHtmlPage("https://www.bucknell.edu/academics/majors-minors");
    if (!page) {
      return null;
    }

    const programs = extractBucknellProgramsFromMajorsMinorsHtml(page.url, page.html);
    return programs.length > 0
      ? {
          programs,
          sourcePages: [page.url],
        }
      : null;
  },
};

const rutgersAdapter: InstitutionCatalogAdapter = {
  name: "rutgers-undergraduate-programs",
  matches(input) {
    return input.institutionCanonicalName.includes("rutgers-university-new-brunswick");
  },
  async discover() {
    const sourcePages: string[] = [];
    const programs: InstitutionAdapterDiscoveredProgram[] = [];

    for (let pageNumber = 0; pageNumber < 25; pageNumber += 1) {
      const page = await fetchHtmlPage(
        `https://www.rutgers.edu/academics/explore-undergraduate-programs?page=${pageNumber}`
      );
      if (!page) {
        break;
      }

      const pagePrograms = extractRutgersProgramsFromUndergraduateHtml(page.url, page.html);
      if (pagePrograms.length === 0) {
        break;
      }

      sourcePages.push(page.url);
      programs.push(...pagePrograms);
    }

    return programs.length > 0
      ? {
          programs: uniquePrograms(programs),
          sourcePages: Array.from(new Set(sourcePages)),
        }
      : null;
  },
};

const vanderbiltAdapter: InstitutionCatalogAdapter = {
  name: "vanderbilt-program-finder",
  matches(input) {
    return input.institutionCanonicalName.includes("vanderbilt-university");
  },
  async discover() {
    const programs = await fetchJsonViaCurlWithHeaders<Array<{ program?: string; bachelors?: string; schoollist?: string[] }>>(
      "https://web.dev-api.vanderbilt.edu/program-finder",
      {
        Referer: "https://www.vanderbilt.edu/academics/program-finder/",
        Origin: "https://www.vanderbilt.edu",
      }
    );
    if (!programs) {
      return null;
    }
    const discoveredPrograms = extractVanderbiltProgramsFromApiPayload(programs);
    return discoveredPrograms.length > 0
      ? {
          programs: discoveredPrograms,
          sourcePages: [
            "https://www.vanderbilt.edu/academics/program-finder/",
            "https://web.dev-api.vanderbilt.edu/program-finder",
          ],
        }
      : null;
  },
};

const pennAdapter: InstitutionCatalogAdapter = {
  name: "penn-catalog",
  matches(input) {
    return input.institutionCanonicalName.includes("university-of-pennsylvania");
  },
  async discover() {
    const pages = (
      await Promise.all([
        fetchHtmlPage("https://catalog.upenn.edu/undergraduate/arts-sciences/majors/"),
        fetchHtmlPage("https://catalog.upenn.edu/undergraduate/arts-sciences/minors/"),
        fetchHtmlPage("https://catalog.upenn.edu/undergraduate/engineering-applied-science/majors/"),
        fetchHtmlPage("https://catalog.upenn.edu/undergraduate/engineering-applied-science/minors/"),
        fetchHtmlPage("https://catalog.upenn.edu/undergraduate/interdisciplinary/university-minors/"),
      ])
    ).filter((page): page is HtmlPage => !!page);

    if (pages.length === 0) {
      return null;
    }

    const programs = uniquePrograms(
      pages.flatMap((page) => {
        const isMinorPage = /\/minors\/|university-minors/i.test(page.url);
        return extractPennProgramsFromCatalogHtml(page.url, page.html, isMinorPage ? "minor" : "major");
      })
    );

    return programs.length > 0
      ? {
          programs,
          sourcePages: pages.map((page) => page.url),
        }
      : null;
  },
};

const dukeAdapter: InstitutionCatalogAdapter = {
  name: "duke",
  matches(input) {
    return input.institutionCanonicalName.includes("duke-university");
  },
  async discover() {
    const page = await fetchHtmlPage("https://admissions.duke.edu/academic-possibilities/");
    if (!page) {
      return null;
    }
    const programs = extractDukeProgramsFromAdmissionsHtml(page.url, page.html);
    return programs.length > 0 ? { programs, sourcePages: [page.url] } : null;
  },
};

const emoryAdapter: InstitutionCatalogAdapter = {
  name: "emory",
  matches(input) {
    return input.institutionCanonicalName.includes("emory-university");
  },
  async discover() {
    const page = await fetchHtmlPage("https://apply.emory.edu/academics/majors-minors.html");
    if (!page) {
      return null;
    }
    const programs = extractEmoryProgramsFromHtml(page.url, page.html);
    return programs.length > 0 ? { programs, sourcePages: [page.url] } : null;
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
    const majorsIndexPage = await fetchHtmlPage("https://catalog.utexas.edu/undergraduate/the-university/degree-programs/");
    const minorsIndexPage = await fetchHtmlPage("https://catalog.utexas.edu/undergraduate/the-university/minor-and-certificate-programs/");
    if (!majorsIndexPage && !minorsIndexPage) {
      return null;
    }

    const degreeSchoolPages = majorsIndexPage
      ? extractUtAustinSchoolPageUrls(majorsIndexPage.url, majorsIndexPage.html, "degrees-and-programs")
      : [];
    const minorSchoolPages = minorsIndexPage
      ? extractUtAustinSchoolPageUrls(minorsIndexPage.url, minorsIndexPage.html, "minor-and-certificate-programs")
      : [];

    const loadedDegreePages = (
      await mapWithConcurrency(degreeSchoolPages, 4, async (url) => fetchHtmlPage(url))
    ).filter((page): page is HtmlPage => !!page);
    const loadedMinorPages = (
      await mapWithConcurrency(minorSchoolPages, 4, async (url) => fetchHtmlPage(url))
    ).filter((page): page is HtmlPage => !!page);

    const programs = uniquePrograms([
      ...loadedDegreePages.flatMap((page) => extractUtAustinMajorProgramsFromHtml(page.url, page.html)),
      ...loadedMinorPages.flatMap((page) => extractUtAustinMinorProgramsFromHtml(page.url, page.html)),
    ]);

    return programs.length > 0
      ? {
          programs,
          sourcePages: [
            majorsIndexPage?.url,
            minorsIndexPage?.url,
            ...loadedDegreePages.map((page) => page.url),
            ...loadedMinorPages.map((page) => page.url),
          ].filter((value): value is string => !!value),
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

    const programs = extractMichiganProgramsFromHtml(page.url, page.html);

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

    const programs = extractUncProgramsFromCatalogHtml(page.url, page.html);

    return programs.length > 0
      ? {
          programs,
          sourcePages: [page.url],
        }
      : null;
  },
};

const georgiaAdapter: InstitutionCatalogAdapter = {
  name: "georgia",
  matches(input) {
    return input.institutionCanonicalName.includes("university-of-georgia");
  },
  async discover() {
    const baseUrl = "https://bulletin.uga.edu/Program/Index";
    const searchUrl = "https://bulletin.uga.edu/Program/_ViewAllPrograms";
    const programs: InstitutionAdapterDiscoveredProgram[] = [];

    for (const [kind, category] of [
      ["major", "UG"],
      ["minor", "MINOR"],
    ] as const) {
      for (let pageNumber = 1; pageNumber <= 20; pageNumber += 1) {
        const formBody = new URLSearchParams();
        formBody.append("keyword", "");
        formBody.append("programCategory", category);
        formBody.append("page", String(pageNumber));

        const html = await postHtmlFragment(searchUrl, formBody);
        if (!html) {
          break;
        }

        const renderedPageNumber = parseGeorgiaSearchPageNumber(html);
        if (renderedPageNumber && renderedPageNumber < pageNumber) {
          break;
        }

        const pagePrograms = extractGeorgiaProgramsFromSearchHtml(baseUrl, html, kind);
        if (pagePrograms.length === 0) {
          break;
        }

        programs.push(...pagePrograms);
        if (pagePrograms.length < 18) {
          break;
        }
      }
    }

    return programs.length > 0
      ? {
          programs: uniquePrograms(programs),
          sourcePages: [baseUrl, searchUrl],
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
  yaleAdapter,
  jhuAdapter,
  tcnjAdapter,
  montclairAdapter,
  northeasternAdapter,
  washuAdapter,
  wisconsinAdapter,
  caltechAdapter,
  ucsbAdapter,
  ucdavisAdapter,
  ucsdAdapter,
  dartmouthAdapter,
  uclaAdapter,
  brownAdapter,
  riceAdapter,
  washingtonAdapter,
  bostonCollegeAdapter,
  umdAdapter,
  uscAdapter,
  lehighAdapter,
  nyuAdapter,
  northwesternAdapter,
  georgetownAdapter,
  notreDameAdapter,
  rochesterAdapter,
  uchicagoAdapter,
  mitAdapter,
  carnegieMellonAdapter,
  bostonUniversityAdapter,
  tuftsAdapter,
  bucknellAdapter,
  rutgersAdapter,
  vanderbiltAdapter,
  pennAdapter,
  dukeAdapter,
  emoryAdapter,
  purdueAdapter,
  ohioStateAdapter,
  michiganAdapter,
  utAustinAdapter,
  uncAdapter,
  georgiaAdapter,
];

export async function discoverProgramsViaInstitutionAdapter(input: AdapterInput): Promise<AdapterDiscoveryResult | null> {
  const adapter = ADAPTERS.find((candidate) => candidate.matches(input));
  if (!adapter) {
    return null;
  }

  return adapter.discover(input);
}
