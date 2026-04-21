import { CatalogRepository } from "../../repositories/academic/catalogRepository";
import {
  replaceResolvedRequirementGroups,
  upsertAcademicCatalog,
  upsertCatalogCourse,
  upsertDegreeProgram,
  upsertMajor,
  upsertMinor,
  upsertRequirementSet,
} from "./catalogService";
import { discoverProgramsViaInstitutionAdapter } from "./catalogInstitutionAdapters";

const repo = new CatalogRepository();

const DISCOVERY_USER_AGENT =
  "Campus2CareerBot/0.1 (+https://campus2career.local; academic catalog discovery)";
const DISCOVERY_FALLBACK_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const MAX_CATALOG_PAGES = 8;
const MAX_PROGRAM_PAGES = 5;
const MAX_PROGRAM_DETAIL_PAGES = 18;
const MIN_STRUCTURED_PROGRAM_COUNT_TO_SKIP_DISCOVERY = 8;

type ProgramKind = "major" | "minor";

interface HtmlPage {
  url: string;
  html: string;
  text: string;
  title: string;
}

interface ExtractedLink {
  href: string;
  text: string;
  contextText?: string;
}

interface DiscoveredProgram {
  displayName: string;
  canonicalName: string;
  kind: ProgramKind;
  degreeType: string;
  programName: string;
  sourceUrl: string;
}

interface DiscoveredCourse {
  courseCode: string;
  courseTitle: string;
  creditsMin?: number;
  creditsMax?: number;
  rawLine: string;
}

interface ProgramDirectoryContext {
  isLikelyProgramDirectory: boolean;
  impliedKind: ProgramKind;
  degreeType: string;
  programName: string;
  score: number;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
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
    .replace(/&mdash;/gi, "-")
    .replace(/&ndash;/gi, "-")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x2013;/gi, "-")
    .replace(/&#x2014;/gi, "-");
}

function stripHtmlToText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6]|tr|\/tr)[^>]*>/gi, "\n")
      .replace(/<li[^>]*>/gi, "\n")
      .replace(/<\/?(?:p|div|section|article|main|aside|header|footer|ul|ol|table|thead|tbody)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[^\S\n]+/g, " ")
    .trim();
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return normalizeWhitespace(decodeHtmlEntities(match?.[1] || ""));
}

function approximateRegistrableDomain(hostname: string): string {
  const parts = hostname
    .toLowerCase()
    .split(".")
    .filter(Boolean);

  if (parts.length <= 2) {
    return parts.join(".");
  }

  const last = parts[parts.length - 1] || "";
  const secondLast = parts[parts.length - 2] || "";
  const thirdLast = parts[parts.length - 3] || "";

  // A simple approximation that keeps sibling academic subdomains like
  // `www.columbia.edu` and `bulletin.columbia.edu` in the same crawl family.
  if (last.length === 2 && secondLast.length <= 3 && thirdLast) {
    return `${thirdLast}.${secondLast}.${last}`;
  }

  return `${secondLast}.${last}`;
}

function sameOriginHost(a: URL, b: URL): boolean {
  return (
    a.hostname === b.hostname ||
    a.hostname.endsWith(`.${b.hostname}`) ||
    b.hostname.endsWith(`.${a.hostname}`) ||
    approximateRegistrableDomain(a.hostname) === approximateRegistrableDomain(b.hostname)
  );
}

function extractLinks(baseUrl: string, html: string): ExtractedLink[] {
  const base = new URL(baseUrl);
  const matches = html.matchAll(/<a\s+[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi);
  const deduped = new Map<string, ExtractedLink>();

  for (const match of matches) {
    const rawHref = match[2]?.trim();
    if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:")) {
      continue;
    }

    let resolved: URL;
    try {
      resolved = new URL(rawHref, base);
    } catch {
      continue;
    }

    if (!/^https?:$/i.test(resolved.protocol)) {
      continue;
    }
    if (!sameOriginHost(resolved, base)) {
      continue;
    }

    const text = normalizeWhitespace(stripHtmlToText(match[3] || ""));
    if (!text) {
      continue;
    }

    const contextText = normalizeWhitespace(
      stripHtmlToText(html.slice(Math.max(0, (match.index || 0) - 2000), match.index || 0)).slice(-600)
    );

    deduped.set(resolved.toString(), {
      href: resolved.toString(),
      text,
      contextText,
    });
  }

  return Array.from(deduped.values());
}

async function fetchHtmlPage(url: string): Promise<HtmlPage | null> {
  async function attempt(userAgent: string): Promise<HtmlPage | null> {
    const response = await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": userAgent,
      },
      redirect: "follow",
      signal: controller.signal,
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
      text: stripHtmlToText(html),
      title: extractTitle(html),
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    return (await attempt(DISCOVERY_USER_AGENT)) ?? (await attempt(DISCOVERY_FALLBACK_USER_AGENT));
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildCatalogSeedUrls(websiteUrl: string): string[] {
  let base: URL;
  try {
    base = new URL(websiteUrl);
  } catch {
    return [];
  }

  const registrable = approximateRegistrableDomain(base.hostname);
  const seeds = new Set<string>();

  seeds.add(base.toString());
  seeds.add(`https://bulletin.${registrable}/`);
  seeds.add(`https://catalog.${registrable}/`);
  seeds.add(`https://coursecatalog.${registrable}/`);
  seeds.add(`https://www.${registrable}/academics/`);
  seeds.add(`https://www.${registrable}/academic-programs/`);
  seeds.add(`https://www.${registrable}/academics/programs/`);
  seeds.add(`https://www.${registrable}/academics/programs.html`);
  seeds.add(`https://www.${registrable}/admissions/academics/programs/`);
  seeds.add(`https://www.${registrable}/admissions/academics/programs.html`);

  return Array.from(seeds);
}

function rankCatalogLinks(links: ExtractedLink[]): ExtractedLink[] {
  const keywords = [
    "catalog",
    "bulletin",
    "academic",
    "academics",
    "program",
    "programs",
    "major",
    "majors",
    "minor",
    "minors",
    "degrees",
    "curriculum",
    "undergraduate",
  ];

  return [...links]
    .map((link) => {
      const haystack = `${link.text} ${link.href}`.toLowerCase();
      let score = 0;
      for (const keyword of keywords) {
        if (haystack.includes(keyword)) {
          score += 10;
        }
      }
      if (haystack.includes("major") || haystack.includes("minor")) {
        score += 10;
      }
      if (haystack.includes("catalog") || haystack.includes("bulletin")) {
        score += 20;
      }
      score -= link.href.length / 200;
      return { link, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CATALOG_PAGES)
    .map((entry) => entry.link);
}

function rankProgramDetailLinks(links: ExtractedLink[]): ExtractedLink[] {
  const stopPhrases = new Set([
    "overview",
    "faculty",
    "courses",
    "requirements",
    "home",
    "print options",
    "search the course listings",
    "academic requirements",
  ]);

  return [...links]
    .map((link) => {
      const normalizedText = normalizeWhitespace(link.text).toLowerCase();
      if (!normalizedText || stopPhrases.has(normalizedText)) {
        return { link, score: -100 };
      }

      const haystack = `${normalizedText} ${link.href}`.toLowerCase();
      let score = 0;

      if (normalizedText.length >= 4 && normalizedText.length <= 80) {
        score += 8;
      }
      if (
        haystack.includes("department") ||
        haystack.includes("departments") ||
        haystack.includes("program") ||
        haystack.includes("study") ||
        haystack.includes("bulletin") ||
        haystack.includes("curriculum") ||
        haystack.includes("major") ||
        haystack.includes("minor")
      ) {
        score += 10;
      }
      if (
        haystack.includes("/departments") ||
        haystack.includes("/departments-") ||
        haystack.includes("/program") ||
        haystack.includes("/instruction/")
      ) {
        score += 12;
      }
      if (/^[a-z][a-z&,'/()\-. ]+$/i.test(link.text)) {
        score += 5;
      }

      return { link, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_PROGRAM_DETAIL_PAGES)
    .map((entry) => entry.link);
}

function inferDegreeBucket(label: string, sourceUrl: string): { degreeType: string; programName: string } {
  const haystack = `${label} ${sourceUrl}`.toLowerCase();
  if (
    haystack.includes("master") ||
    haystack.includes("phd") ||
    haystack.includes("doctor") ||
    haystack.includes("graduate")
  ) {
    return {
      degreeType: "Graduate",
      programName: "Auto-discovered graduate programs",
    };
  }

  return {
    degreeType: "Undergraduate",
    programName: "Auto-discovered undergraduate programs",
  };
}

function cleanProgramDisplayName(value: string): string {
  return normalizeWhitespace(
    value
      .replace(/^\d{1,2}\/\d{1,2}\/\d{2,4}\s+/g, "")
      .replace(/^updated\s+\d{1,2}\/\d{1,2}\/\d{2,4}\s+/gi, "")
      .replace(/^["'`]+|["'`]+$/g, "")
      .replace(/\s*\|\s*.*/g, "")
      .replace(/\s*-\s*(major|minor|b\.?a\.?|b\.?s\.?|bachelor.*)$/i, "")
      .replace(/^(major|minor)\s+in\s+/i, "")
      .replace(/\s+\((b\.?a\.?|b\.?s\.?|b\.?f\.?a\.?|bachelor.*?)\)$/i, "")
      .replace(/\s*,\s*(b\.?a\.?|b\.?s\.?|b\.?f\.?a\.?|b\.?b\.?a\.?)$/i, "")
      .replace(/\s+(b\.?a\.?|b\.?s\.?|b\.?f\.?a\.?|b\.?b\.?a\.?)$/i, "")
  );
}

function looksLikeProgramName(value: string): boolean {
  const normalized = normalizeWhitespace(value);
  if (!normalized || normalized.length < 2 || normalized.length > 80) {
    return false;
  }

  const lower = normalized.toLowerCase();
  if (
    lower.includes(" requires ") ||
    lower.includes(" prerequisite") ||
    lower.includes(" permission") ||
    lower.includes(" open to ") ||
    lower.includes(" students ") ||
    lower.includes(" points ") ||
    lower.includes(" credits ") ||
    lower.includes(" hours ")
  ) {
    return false;
  }

  if (/[.:;]/.test(normalized)) {
    return false;
  }

  if (
    normalized.startsWith("/") ||
    normalized.includes("\\") ||
    normalized.includes(".css") ||
    normalized.includes(".js") ||
    normalized.includes(".png") ||
    normalized.includes(".jpg") ||
    normalized.includes(".svg") ||
    normalized.includes(".pdf")
  ) {
    return false;
  }

  if (
    /^[A-Z]{2,6}\s?\d{2,4}[A-Z]?$/i.test(normalized) ||
    /^\d+[A-Z]?$/i.test(normalized)
  ) {
    return false;
  }

  const digitCount = (normalized.match(/\d/g) || []).length;
  if (digitCount >= 2) {
    return false;
  }

  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  if (wordCount > 8) {
    return false;
  }

  return true;
}

function isClearlyNonProgramLabel(value: string): boolean {
  const normalized = cleanProgramDisplayName(value).toLowerCase();
  if (!normalized) {
    return true;
  }

  const stopPhrases = new Set([
    "academics",
    "academic programs",
    "academic support",
    "about",
    "admissions",
    "alumni",
    "apply",
    "a to z index",
    "a-z index",
    "a-z program list",
    "bulletin",
    "calendar",
    "campus life",
    "catalog",
    "centers and institutes",
    "colleges and schools",
    "contact",
    "current students",
    "degree programs",
    "degrees",
    "directory",
    "events",
    "explore majors",
    "faculty",
    "faculty and staff",
    "financial aid",
    "future students",
    "give",
    "graduate programs",
    "home",
    "index",
    "international students",
    "libraries",
    "login",
    "majors and minors",
    "menu",
    "minors",
    "news",
    "overview",
    "parents and families",
    "print options",
    "programs",
    "research",
    "schools and colleges",
    "search",
    "student life",
    "student services",
    "students",
    "tuition and fees",
    "undergraduate programs",
    "visit",
    "we have your",
  ]);

  if (stopPhrases.has(normalized)) {
    return true;
  }

  return (
    /\b(admissions?|apply|calendar|campus|classroom|contact|course|courses|edition|events|faculty|financial aid|help|index|libraries|login|news|office|overview|records|research|scheduling|search|staff|student|visit)\b/i.test(
      normalized
    ) ||
    /^(bachelor|master|doctor|doctoral|graduate|undergraduate|certificate)(\s|$)/i.test(normalized)
  );
}

function isProgramLikeHref(sourceUrl: string, programLabel: string): boolean {
  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    return false;
  }

  const path = url.pathname.toLowerCase();
  if (
    path === "/" ||
    path.endsWith(".css") ||
    path.endsWith(".js") ||
    path.endsWith(".png") ||
    path.endsWith(".jpg") ||
    path.endsWith(".jpeg") ||
    path.endsWith(".svg") ||
    path.endsWith(".pdf") ||
    path.endsWith(".xml") ||
    path.endsWith(".json")
  ) {
    return false;
  }

  if (
    path.includes("/azindex") ||
    path.includes("/a-z") ||
    path.includes("/atoz") ||
    path.includes("/help") ||
    path.includes("/search") ||
    path.includes("/login") ||
    path.includes("/news") ||
    path.includes("/events")
  ) {
    return false;
  }

  const slug = slugify(programLabel);
  const slugTokens = slug.split("-").filter((token) => token.length > 3);
  return (
    slugTokens.some((token) => path.includes(token)) ||
    path.includes("program") ||
    path.includes("degree") ||
    path.includes("major") ||
    path.includes("minor") ||
    path.includes("study") ||
    path.includes("curriculum") ||
    path.includes("department")
  );
}

function deriveProgramDirectoryContext(page: HtmlPage): ProgramDirectoryContext {
  const primaryHaystack = `${page.title}\n${page.url}`.toLowerCase();
  const bodyHaystack = page.text.slice(0, 16000).toLowerCase();
  const haystack = `${primaryHaystack}\n${bodyHaystack}`;
  let score = 0;
  let hasPrimaryDirectorySignal = false;

  if (primaryHaystack.includes("degree program")) {
    score += 28;
    hasPrimaryDirectorySignal = true;
  }
  if (primaryHaystack.includes("programs of study")) {
    score += 24;
    hasPrimaryDirectorySignal = true;
  }
  if (primaryHaystack.includes("academic program")) {
    score += 20;
    hasPrimaryDirectorySignal = true;
  }
  if (primaryHaystack.includes("undergraduate program")) {
    score += 24;
    hasPrimaryDirectorySignal = true;
  }
  if (primaryHaystack.includes("majors")) {
    score += 18;
    hasPrimaryDirectorySignal = true;
  }
  if (primaryHaystack.includes("minors")) {
    score += 14;
    hasPrimaryDirectorySignal = true;
  }
  if (primaryHaystack.includes("degree offerings") || primaryHaystack.includes("degree options")) {
    score += 16;
    hasPrimaryDirectorySignal = true;
  }
  if (
    primaryHaystack.includes("/degree_program") ||
    primaryHaystack.includes("/degree-program") ||
    primaryHaystack.includes("/programs-study") ||
    primaryHaystack.includes("/majors") ||
    primaryHaystack.includes("/minors")
  ) {
    score += 18;
    hasPrimaryDirectorySignal = true;
  }

  if (!hasPrimaryDirectorySignal) {
    if (bodyHaystack.includes("degree program")) {
      score += 10;
    }
    if (bodyHaystack.includes("undergraduate program")) {
      score += 8;
    }
    if (bodyHaystack.includes("majors")) {
      score += 6;
    }
    if (bodyHaystack.includes("minors")) {
      score += 4;
    }
  }
  if (
    haystack.includes("a-z") ||
    haystack.includes("az index") ||
    haystack.includes("catalog edition") ||
    haystack.includes("general information catalog") ||
    haystack.includes("course search")
  ) {
    score -= 18;
  }

  const impliedKind =
    haystack.includes(" minors") && !haystack.includes(" majors") && !haystack.includes("undergraduate program")
      ? "minor"
      : "major";
  const degreeType =
    haystack.includes("graduate") &&
    !haystack.includes("undergraduate") &&
    !haystack.includes("bachelor") &&
    !haystack.includes("majors")
      ? "Graduate"
      : "Undergraduate";

  return {
    isLikelyProgramDirectory: hasPrimaryDirectorySignal && score >= 22,
    impliedKind,
    degreeType,
    programName:
      degreeType === "Graduate"
        ? "Auto-discovered graduate programs"
        : "Auto-discovered undergraduate programs",
    score,
  };
}

function classifyProgramLabelFromPageContext(
  label: string,
  sourceUrl: string,
  page: HtmlPage,
  contextText?: string,
  options?: { skipHrefCheck?: boolean }
): Omit<DiscoveredProgram, "sourceUrl"> | null {
  const cleaned = cleanProgramDisplayName(label);
  if (!looksLikeProgramName(cleaned) || isClearlyNonProgramLabel(cleaned)) {
    return null;
  }

  const context = deriveProgramDirectoryContext(page);
  if (!context.isLikelyProgramDirectory) {
    return null;
  }
  if (!options?.skipHrefCheck && !isProgramLikeHref(sourceUrl, cleaned)) {
    return null;
  }

  const localContext = `${contextText || ""} ${page.title} ${page.url}`.toLowerCase();
  const pageHasBothUndergraduateAndGraduate =
    page.text.toLowerCase().includes("undergraduate programs") &&
    page.text.toLowerCase().includes("graduate programs");
  const localMentionsUndergraduate = localContext.includes("undergraduate");
  const localMentionsGraduate = localContext.includes("graduate");
  const localMentionsMinor = localContext.includes(" minor");
  const localMentionsMajor = localContext.includes(" major");

  if (pageHasBothUndergraduateAndGraduate && !localMentionsUndergraduate && !localMentionsGraduate) {
    return null;
  }

  const urlHaystack = sourceUrl.toLowerCase();
  const tokens = slugify(cleaned).split("-").filter((token) => token.length > 2);
  let score = context.score;

  if (tokens.some((token) => urlHaystack.includes(token))) {
    score += 10;
  }
  if (
    urlHaystack.includes("degree") ||
    urlHaystack.includes("program") ||
    urlHaystack.includes("major") ||
    urlHaystack.includes("minor") ||
    urlHaystack.includes("study") ||
    urlHaystack.includes("academics")
  ) {
    score += 8;
  }
  if (/^[A-Za-z&,'/(). -]+$/.test(cleaned)) {
    score += 4;
  }
  if (cleaned.split(/\s+/).length > 6) {
    score -= 8;
  }
  if (score < 28) {
    return null;
  }

  const inferredKind =
    localMentionsMinor && !localMentionsMajor
      ? "minor"
      : localMentionsMajor && !localMentionsMinor
        ? "major"
        : context.impliedKind;
  const inferredDegreeType =
    localMentionsGraduate && !localMentionsUndergraduate
      ? "Graduate"
      : "Undergraduate";

  return {
    displayName: cleaned,
    canonicalName: slugify(cleaned),
    kind: inferredKind,
    degreeType: inferredDegreeType,
    programName:
      inferredDegreeType === "Graduate"
        ? "Auto-discovered graduate programs"
        : "Auto-discovered undergraduate programs",
  };
}

function classifyProgramLabel(label: string, sourceUrl: string): Omit<DiscoveredProgram, "sourceUrl"> | null {
  const normalized = normalizeWhitespace(label);
  if (!normalized || normalized.length < 3 || normalized.length > 120) {
    return null;
  }

  const lower = normalized.toLowerCase();
  const stopPhrases = new Set([
    "majors and minors",
    "undergraduate programs",
    "graduate programs",
    "academic programs",
    "programs",
    "academics",
    "degrees",
    "catalog",
    "bulletin",
  ]);
  if (stopPhrases.has(lower)) {
    return null;
  }

  let displayName = "";
  let kind: ProgramKind | null = null;

  const patternChecks: Array<[RegExp, ProgramKind]> = [
    [/^major in (.+)$/i, "major"],
    [/^minor in (.+)$/i, "minor"],
    [/^(.+?) major$/i, "major"],
    [/^(.+?) minor$/i, "minor"],
    [/^bachelor of [a-z .]+ in (.+)$/i, "major"],
    [/^(.+?),\s*(b\.?a\.?|b\.?s\.?|b\.?f\.?a\.?|b\.?b\.?a\.?)$/i, "major"],
    [/^(.+?)\s+\((b\.?a\.?|b\.?s\.?|b\.?f\.?a\.?|bachelor.*?)\)$/i, "major"],
  ];

  for (const [pattern, inferredKind] of patternChecks) {
    const match = normalized.match(pattern);
    if (!match) {
      continue;
    }
    displayName = cleanProgramDisplayName(match[1] || normalized);
    kind = inferredKind;
    break;
  }

  if (!kind) {
    if (lower.includes(" major")) {
      displayName = cleanProgramDisplayName(normalized);
      kind = "major";
    } else if (lower.includes(" minor")) {
      displayName = cleanProgramDisplayName(normalized);
      kind = "minor";
    } else {
      return null;
    }
  }

  if (!displayName || displayName.length < 2 || !looksLikeProgramName(displayName)) {
    return null;
  }

  const { degreeType, programName } = inferDegreeBucket(normalized, sourceUrl);

  return {
    displayName,
    canonicalName: slugify(displayName),
    kind,
    degreeType,
    programName,
  };
}

function extractProgramLabelsFromText(page: HtmlPage): Array<{ label: string; sourceUrl: string }> {
  const pageContext = deriveProgramDirectoryContext(page);
  const lines = page.text
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)
    .filter((line) => line.length >= 3 && line.length <= 120);

  const labels = new Map<string, { label: string; sourceUrl: string }>();

  for (const line of lines) {
    const lower = line.toLowerCase();
    const hasExplicitProgramCue =
      !lower.startsWith("major in ") &&
      !lower.startsWith("minor in ") &&
      !lower.includes(" major") &&
      !lower.includes(" minor")
        ? false
        : true;

    if (
      !hasExplicitProgramCue &&
      !(pageContext.isLikelyProgramDirectory && pageContext.score >= 28 && looksLikeProgramName(cleanProgramDisplayName(line)))
    ) {
      continue;
    }

    if (!looksLikeProgramName(cleanProgramDisplayName(line)) || isClearlyNonProgramLabel(line)) {
      continue;
    }

    const key = `${line.toLowerCase()}::${page.url}`;
    if (!labels.has(key)) {
      labels.set(key, {
        label: line,
        sourceUrl: page.url,
      });
    }
  }

  return Array.from(labels.values());
}

function extractProgramsFromPage(page: HtmlPage): DiscoveredProgram[] {
  const links = extractLinks(page.url, page.html);
  const discovered: DiscoveredProgram[] = [];
  const deduped = new Set<string>();

  const candidates = [
    ...links.map((link) => ({
      label: link.text,
      sourceUrl: link.href,
      contextText: link.contextText,
      origin: "link" as const,
    })),
    ...extractProgramLabelsFromText(page).map((candidate) => ({
      ...candidate,
      contextText: undefined,
      origin: "text" as const,
    })),
  ];

  for (const candidate of candidates) {
    const classified =
      classifyProgramLabel(candidate.label, candidate.sourceUrl) ||
      ((candidate.origin === "link" || deriveProgramDirectoryContext(page).score >= 28)
        ? classifyProgramLabelFromPageContext(candidate.label, candidate.sourceUrl, page, candidate.contextText, {
            skipHrefCheck: candidate.origin === "text",
          })
        : null);
    if (!classified) {
      continue;
    }
    const dedupeKey = `${classified.kind}:${classified.degreeType}:${classified.programName}:${classified.canonicalName}`;
    if (deduped.has(dedupeKey)) {
      continue;
    }
    deduped.add(dedupeKey);
    discovered.push({
      ...classified,
      sourceUrl: candidate.sourceUrl,
    });
  }

  return discovered;
}

function rankProgramDirectoryPages(pages: HtmlPage[]): HtmlPage[] {
  return [...pages]
    .map((page) => ({
      page,
      context: deriveProgramDirectoryContext(page),
      score: (() => {
        const haystack = `${page.title} ${page.url}`.toLowerCase();
        let score = deriveProgramDirectoryContext(page).score;
        if (haystack.includes("majors and programs")) {
          score += 20;
        }
        if (
          haystack.includes("/academics/programs") ||
          haystack.includes("/admissions/academics/programs")
        ) {
          score += 18;
        }
        if (haystack.includes("/degree_programs") || haystack.includes("/degree-programs")) {
          score += 22;
        }
        if (haystack.includes("undergraduate")) {
          score += 12;
        }
        if (haystack.includes("graduate")) {
          score -= 10;
        }
        if (haystack.includes("catalog")) {
          score -= 8;
        }
        return score;
      })(),
    }))
    .filter((entry) => entry.context.isLikelyProgramDirectory)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((entry) => entry.page);
}

function scoreProgramLink(programName: string, kind: ProgramKind, link: ExtractedLink): number {
  const nameTokens = slugify(programName).split("-").filter((token) => token.length > 2);
  const haystack = `${link.text} ${link.href}`.toLowerCase();
  let score = 0;

  for (const token of nameTokens) {
    if (haystack.includes(token)) {
      score += 12;
    }
  }
  if (haystack.includes(kind)) {
    score += 18;
  }
  if (haystack.includes("curriculum") || haystack.includes("requirement")) {
    score += 14;
  }
  if (haystack.includes("catalog") || haystack.includes("bulletin")) {
    score += 10;
  }
  return score;
}

function extractCoursesFromText(text: string): DiscoveredCourse[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  const patterns = [
    /(?<code>[A-Z]{2,5}\s?(?:[A-Z]{1,3}\s?)?\d{2,4}[A-Z]?)\s*[:\-]\s*(?<title>[A-Za-z0-9 ,/&()'.]{3,120}?)(?:\.\s*|\s+-\s+)?(?<credits>\d+(?:\.\d+)?)\s*(?:credits?|credit hours?|hrs?)/i,
    /(?<code>[A-Z]{2,5}\s?(?:[A-Z]{1,3}\s?)?\d{2,4}[A-Z]?)(?:\s+|(?=[A-Z]))(?<title>[A-Za-z0-9 ,/&()'.]{3,120}?)\s+(?<credits>\d+(?:\.\d+)?)\s*(?:credits?|credit hours?|hrs?)/i,
    /(?<code>[A-Z]{2,5}\s?(?:[A-Z]{1,3}\s?)?\d{2,4}[A-Z]?)\s*[:\-]\s*(?<title>[A-Za-z0-9 ,/&()'.]{3,120})/i,
    /(?<code>[A-Z]{2,5}\s?(?:[A-Z]{1,3}\s?)?\d{2,4}[A-Z]?)(?:\s+|(?=[A-Z]))(?<title>[A-Za-z0-9 ,/&()'.]{3,120})/i,
  ];

  const byCode = new Map<string, DiscoveredCourse>();

  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (!match?.groups?.code) {
        continue;
      }

      const courseCode = normalizeWhitespace(match.groups.code).replace(/\s+/g, "");
      const courseTitle = normalizeWhitespace(match.groups.title || `Discovered course ${courseCode}`);
      const credits = Number(match.groups.credits);
      const parsedCredits = Number.isFinite(credits) ? credits : undefined;

      if (!byCode.has(courseCode)) {
        byCode.set(courseCode, {
          courseCode,
          courseTitle,
          creditsMin: parsedCredits,
          creditsMax: parsedCredits,
          rawLine: line,
        });
      }
      break;
    }
  }

  return Array.from(byCode.values());
}

function currentCatalogWindow() {
  const startYear = new Date().getFullYear();
  return {
    startYear,
    endYear: startYear + 1,
    catalogLabel: `Auto-discovered ${startYear}-${startYear + 1}`,
  };
}

async function persistDiscoveredPrograms(input: {
  institutionCanonicalName: string;
  institutionDisplayName: string;
  institutionWebsiteUrl: string | null;
  catalogSourceUrl: string | null;
  sourcePages: string[];
  discoveredPrograms: DiscoveredProgram[];
}) {
  const refreshedDiscoveredList = input.discoveredPrograms.filter(
    (program) => program.degreeType === "Undergraduate"
  );
  const catalogWindow = currentCatalogWindow();

  await upsertAcademicCatalog({
    institutionCanonicalName: input.institutionCanonicalName,
    catalogLabel: catalogWindow.catalogLabel,
    startYear: catalogWindow.startYear,
    endYear: catalogWindow.endYear,
    sourceUrl: input.catalogSourceUrl || input.institutionWebsiteUrl || undefined,
    sourceFormat: "html",
    extractionStatus: "draft",
  });

  const institution = await repo.getInstitutionByCanonicalName(input.institutionCanonicalName);
  if (!institution) {
    throw new Error(`Institution not found after catalog upsert: ${input.institutionCanonicalName}`);
  }

  const catalogRow = await repo.getAcademicCatalog(institution.institution_id, catalogWindow.catalogLabel);
  if (!catalogRow) {
    throw new Error(`Academic catalog not found after discovery upsert: ${catalogWindow.catalogLabel}`);
  }

  const degreePrograms = new Map<string, { degreeType: string; programName: string }>();
  for (const program of refreshedDiscoveredList) {
    degreePrograms.set(`${program.degreeType}:${program.programName}`, {
      degreeType: program.degreeType,
      programName: program.programName,
    });
  }

  await repo.deleteDegreeProgramsNotInList(catalogRow.academic_catalog_id, Array.from(degreePrograms.values()));

  for (const program of degreePrograms.values()) {
    await upsertDegreeProgram({
      institutionCanonicalName: input.institutionCanonicalName,
      catalogLabel: catalogWindow.catalogLabel,
      degreeType: program.degreeType,
      programName: program.programName,
      schoolName: input.institutionDisplayName,
    });
  }

  for (const program of degreePrograms.values()) {
    const degreeProgramRow = await repo.getDegreeProgram(
      catalogRow.academic_catalog_id,
      program.degreeType,
      program.programName
    );
    if (!degreeProgramRow) {
      continue;
    }

    const discoveredMajors = refreshedDiscoveredList
      .filter(
        (item) =>
          item.kind === "major" &&
          item.degreeType === program.degreeType &&
          item.programName === program.programName
      )
      .map((item) => item.canonicalName);
    const discoveredMinors = refreshedDiscoveredList
      .filter(
        (item) =>
          item.kind === "minor" &&
          item.degreeType === program.degreeType &&
          item.programName === program.programName
      )
      .map((item) => item.canonicalName);

    await repo.deleteMajorsNotInList(degreeProgramRow.degree_program_id, discoveredMajors);
    await repo.deleteMinorsNotInList(degreeProgramRow.degree_program_id, discoveredMinors);
  }

  let discoveredMajorCount = 0;
  let discoveredMinorCount = 0;
  for (const program of refreshedDiscoveredList) {
    if (program.kind === "major") {
      await upsertMajor({
        institutionCanonicalName: input.institutionCanonicalName,
        catalogLabel: catalogWindow.catalogLabel,
        degreeType: program.degreeType,
        programName: program.programName,
        canonicalName: program.canonicalName,
        displayName: program.displayName,
      });
      discoveredMajorCount += 1;
    } else {
      await upsertMinor({
        institutionCanonicalName: input.institutionCanonicalName,
        catalogLabel: catalogWindow.catalogLabel,
        degreeType: program.degreeType,
        programName: program.programName,
        canonicalName: program.canonicalName,
        displayName: program.displayName,
      });
      discoveredMinorCount += 1;
    }
  }

  return {
    status: "discovered_programs" as const,
    uploadRecommended: false,
    websiteUrl: input.institutionWebsiteUrl,
    sourcePages: input.sourcePages,
    discoveredDegreeProgramCount: degreePrograms.size,
    discoveredMajorCount,
    discoveredMinorCount,
    catalogLabel: catalogWindow.catalogLabel,
    message: "Discovered institution programs from the school website and seeded them into the academic directory.",
  };
}

export async function discoverInstitutionCatalog(input: {
  institutionCanonicalName: string;
  forceRefresh?: boolean;
}) {
  const institution = await repo.getInstitutionByCanonicalName(input.institutionCanonicalName);
  if (!institution) {
    throw new Error(`Institution not found: ${input.institutionCanonicalName}`);
  }

  const existingCatalogs = await repo.listAcademicCatalogsForInstitution(institution.institution_id);
  const catalogSummaries: Array<{
    catalogLabel: string;
    structuredProgramCount: number;
    hasStructuredPrograms: boolean;
    isStableCatalog: boolean;
  }> = [];

  for (const catalog of existingCatalogs) {
    let structuredProgramCount = 0;
    const degreePrograms = await repo.listDegreeProgramsForCatalog(catalog.academic_catalog_id);
    for (const degreeProgram of degreePrograms) {
      const [majors, minors] = await Promise.all([
        repo.listMajorsForDegreeProgram(degreeProgram.degree_program_id),
        repo.listMinorsForDegreeProgram(degreeProgram.degree_program_id),
      ]);
      structuredProgramCount += majors.length + minors.length;
    }

    catalogSummaries.push({
      catalogLabel: catalog.catalog_label,
      structuredProgramCount,
      hasStructuredPrograms: structuredProgramCount > 0,
      isStableCatalog:
        catalog.source_format === "manual" ||
        catalog.source_format === "pdf" ||
        catalog.extraction_status === "parsed" ||
        catalog.extraction_status === "reviewed" ||
        catalog.extraction_status === "published",
    });
  }

  const bestStructuredCatalog =
    [...catalogSummaries]
      .filter((catalog) => catalog.hasStructuredPrograms)
      .sort((a, b) => b.structuredProgramCount - a.structuredProgramCount)[0] || null;
  const bestStableStructuredCatalog =
    [...catalogSummaries]
      .filter((catalog) => catalog.hasStructuredPrograms && catalog.isStableCatalog)
      .sort((a, b) => b.structuredProgramCount - a.structuredProgramCount)[0] || null;
  const hasStructuredPrograms = !!bestStructuredCatalog;

  const existingCatalogFallback = (
    message: string,
    uploadRecommended: boolean
  ) => ({
    status: "existing_catalog" as const,
    uploadRecommended,
    websiteUrl: institution.website_url,
    sourcePages: [],
    discoveredDegreeProgramCount: 0,
    discoveredMajorCount: 0,
    discoveredMinorCount: 0,
    catalogLabel: bestStructuredCatalog?.catalogLabel || existingCatalogs[0]?.catalog_label || null,
    message,
  });

  if (!input.forceRefresh && bestStableStructuredCatalog?.structuredProgramCount >= MIN_STRUCTURED_PROGRAM_COUNT_TO_SKIP_DISCOVERY) {
    return {
      status: "existing_catalog" as const,
      uploadRecommended: false,
      websiteUrl: institution.website_url,
      sourcePages: [],
      discoveredDegreeProgramCount: 0,
      discoveredMajorCount: 0,
      discoveredMinorCount: 0,
      catalogLabel: bestStableStructuredCatalog.catalogLabel,
      message: "Structured catalog data already exists for this institution.",
    };
  }

  const adapterDiscovery = await discoverProgramsViaInstitutionAdapter({
    institutionCanonicalName: input.institutionCanonicalName,
    websiteUrl: institution.website_url,
  });
  if (adapterDiscovery?.programs.length) {
    return persistDiscoveredPrograms({
      institutionCanonicalName: input.institutionCanonicalName,
      institutionDisplayName: institution.display_name,
      institutionWebsiteUrl: institution.website_url,
      catalogSourceUrl: adapterDiscovery.sourcePages[0] || institution.website_url,
      sourcePages: adapterDiscovery.sourcePages,
      discoveredPrograms: adapterDiscovery.programs,
    });
  }

  if (!institution.website_url) {
    if (hasStructuredPrograms) {
      return existingCatalogFallback(
        "The institution directory entry has no website URL, so the system is falling back to the existing structured catalog.",
        true
      );
    }
    return {
      status: "upload_required" as const,
      uploadRecommended: true,
      websiteUrl: null,
      sourcePages: [],
      discoveredDegreeProgramCount: 0,
      discoveredMajorCount: 0,
      discoveredMinorCount: 0,
      catalogLabel: null,
      message: "The institution has no website URL in the directory, so a PDF upload is required.",
    };
  }

  const initialSeedUrls = buildCatalogSeedUrls(institution.website_url);
  const seedPages = (
    await Promise.all(initialSeedUrls.map((url) => fetchHtmlPage(url)))
  ).filter((page): page is HtmlPage => !!page);
  const homePage = seedPages[0] || null;

  if (!homePage && seedPages.length === 0) {
    if (hasStructuredPrograms) {
      return existingCatalogFallback(
        "Fresh catalog discovery could not fetch the institution website reliably, so the system is falling back to the existing structured catalog.",
        true
      );
    }
    return {
      status: "upload_required" as const,
      uploadRecommended: true,
      websiteUrl: institution.website_url,
      sourcePages: [institution.website_url],
      discoveredDegreeProgramCount: 0,
      discoveredMajorCount: 0,
      discoveredMinorCount: 0,
      catalogLabel: null,
      message: "The institution website could not be fetched reliably. Upload a catalog PDF instead.",
    };
  }

  const candidateLinks = rankCatalogLinks(
    seedPages.flatMap((page) => extractLinks(page.url, page.html))
  );
  const candidatePages = (
    await Promise.all(candidateLinks.map((link) => fetchHtmlPage(link.href)))
  ).filter((page): page is HtmlPage => !!page);

  const programDetailLinks = rankProgramDetailLinks(
    candidatePages.flatMap((page) => extractLinks(page.url, page.html))
  );
  const programDetailPages = (
    await Promise.all(programDetailLinks.map((link) => fetchHtmlPage(link.href)))
  ).filter((page): page is HtmlPage => !!page);

  const discoveryPages = Array.from(
    new Map([...seedPages, ...candidatePages, ...programDetailPages].map((page) => [page.url, page] as const)).values()
  );
  const sourcePages = discoveryPages.map((page) => page.url);
  const preferredProgramPages = rankProgramDirectoryPages(discoveryPages);
  const extractionPages = preferredProgramPages.length > 0 ? preferredProgramPages : discoveryPages;

  const discoveredPrograms = new Map<string, DiscoveredProgram>();
  for (const page of extractionPages) {
    for (const program of extractProgramsFromPage(page)) {
      const key = `${program.kind}:${program.degreeType}:${program.programName}:${program.canonicalName}`;
      if (!discoveredPrograms.has(key)) {
        discoveredPrograms.set(key, program);
      }
    }
  }

  const discoveredList = Array.from(discoveredPrograms.values());
  if (discoveredList.length < 5 && preferredProgramPages.length > 0) {
    for (const page of discoveryPages) {
      for (const program of extractProgramsFromPage(page)) {
        const key = `${program.kind}:${program.degreeType}:${program.programName}:${program.canonicalName}`;
        if (!discoveredPrograms.has(key)) {
          discoveredPrograms.set(key, program);
        }
      }
    }
  }

  const refreshedDiscoveredList = Array.from(discoveredPrograms.values()).filter(
    (program) => program.degreeType === "Undergraduate"
  );
  if (!refreshedDiscoveredList.length) {
    if (hasStructuredPrograms) {
      return existingCatalogFallback(
        "Fresh catalog discovery did not extract a better structured program list, so the system is falling back to the existing structured catalog.",
        true
      );
    }
    return {
      status: "upload_required" as const,
      uploadRecommended: true,
      websiteUrl: institution.website_url,
      sourcePages,
      discoveredDegreeProgramCount: 0,
      discoveredMajorCount: 0,
      discoveredMinorCount: 0,
      catalogLabel: null,
      message: "No structured major or minor list could be discovered from the institution website.",
    };
  }
  return persistDiscoveredPrograms({
    institutionCanonicalName: input.institutionCanonicalName,
    institutionDisplayName: institution.display_name,
    institutionWebsiteUrl: institution.website_url,
    catalogSourceUrl: candidatePages[0]?.url || seedPages[0]?.url || institution.website_url,
    sourcePages,
    discoveredPrograms: refreshedDiscoveredList,
  });
}

async function discoverSingleProgramRequirements(input: {
  institutionCanonicalName: string;
  catalogLabel: string;
  degreeType: string;
  programName: string;
  programCanonicalName: string;
  programDisplayName: string;
  kind: ProgramKind;
  websiteUrl: string;
}) {
  const seedPages = (
    await Promise.all(buildCatalogSeedUrls(input.websiteUrl).map((url) => fetchHtmlPage(url)))
  ).filter((page): page is HtmlPage => !!page);
  const homePage = seedPages[0] || null;

  if (!homePage && seedPages.length === 0) {
    return {
      status: "upload_required" as const,
      discoveredCourseCount: 0,
      sourcePage: null,
      requirementSetId: null,
      message: `The ${input.kind} page could not be discovered from the institution website.`,
    };
  }

  const catalogSeedLinks = rankCatalogLinks(seedPages.flatMap((page) => extractLinks(page.url, page.html)));
  const catalogSeedPages = (
    await Promise.all(catalogSeedLinks.map((link) => fetchHtmlPage(link.href)))
  ).filter((page): page is HtmlPage => !!page);

  const allCandidateLinks = Array.from(
    new Map(
      [
        ...seedPages.flatMap((page) => extractLinks(page.url, page.html)),
        ...catalogSeedPages.flatMap((page) => extractLinks(page.url, page.html)),
      ].map((link) => [link.href, link] as const)
    ).values()
  );

  const rankedLinks = allCandidateLinks
    .map((link) => ({
      link,
      score: scoreProgramLink(input.programDisplayName, input.kind, link),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(MAX_PROGRAM_PAGES * 2, 10))
    .map((entry) => entry.link);

  const candidatePages = (
    await Promise.all(rankedLinks.map((link) => fetchHtmlPage(link.href)))
  ).filter((page): page is HtmlPage => !!page);

  let bestPage: HtmlPage | null = null;
  let bestCourses: DiscoveredCourse[] = [];
  let bestScore = -1;
  let foundProgramTokenMatch = false;

  for (const page of candidatePages) {
    const courses = extractCoursesFromText(page.text);
    const pageHaystack = `${page.title}\n${page.text.slice(0, 12000)}`.toLowerCase();
    const programTokens = slugify(input.programDisplayName).split("-").filter((token) => token.length > 2);
    const matchedTokenCount = programTokens.filter((token) => pageHaystack.includes(token)).length;
    const exactProgramMention =
      pageHaystack.includes(`${input.kind} in ${input.programDisplayName}`.toLowerCase()) ||
      pageHaystack.includes(input.programDisplayName.toLowerCase());

    if (programTokens.length > 0 && matchedTokenCount === 0 && !exactProgramMention) {
      if (foundProgramTokenMatch) {
        continue;
      }
    }

    if (matchedTokenCount > 0 || exactProgramMention) {
      foundProgramTokenMatch = true;
    }

    let suitabilityScore = courses.length;

    suitabilityScore += matchedTokenCount * 20;

    if (pageHaystack.includes(`${input.kind} in ${input.programDisplayName}`.toLowerCase())) {
      suitabilityScore += 30;
    }
    if (page.title.toLowerCase().includes(input.programDisplayName.toLowerCase())) {
      suitabilityScore += 20;
    }
    if (page.url.toLowerCase().includes(slugify(input.programDisplayName))) {
      suitabilityScore += 20;
    }
    if (pageHaystack.includes("requirements")) {
      suitabilityScore += 12;
    }
    if (pageHaystack.includes("course list")) {
      suitabilityScore += 8;
    }

    if (suitabilityScore > bestScore) {
      bestScore = suitabilityScore;
      bestCourses = courses;
      bestPage = page;
    }
  }

  const bestPageUrl = bestPage ? bestPage.url : null;

  if (!bestPage || bestCourses.length < 3) {
    return {
      status: "upload_required" as const,
      discoveredCourseCount: bestCourses.length,
      sourcePage: bestPageUrl,
      requirementSetId: null,
      message: `The ${input.kind} requirement courses could not be extracted reliably. Upload a PDF from the school's catalog or department page.`,
    };
  }

  for (const course of bestCourses) {
    await upsertCatalogCourse({
      institutionCanonicalName: input.institutionCanonicalName,
      catalogLabel: input.catalogLabel,
      courseCode: course.courseCode,
      courseTitle: course.courseTitle,
      creditsMin: course.creditsMin,
      creditsMax: course.creditsMax,
      description: `Auto-discovered from ${bestPage.url}`,
      levelHint: "mixed",
    });
  }

  const requirementSetId = await upsertRequirementSet({
    institutionCanonicalName: input.institutionCanonicalName,
    catalogLabel: input.catalogLabel,
    degreeType: input.degreeType,
    programName: input.programName,
    setType: input.kind,
    displayName:
      input.kind === "major"
        ? `${input.programDisplayName} major requirements`
        : `${input.programDisplayName} minor requirements`,
    majorCanonicalName: input.kind === "major" ? input.programCanonicalName : undefined,
    minorCanonicalName: input.kind === "minor" ? input.programCanonicalName : undefined,
  });

  await replaceResolvedRequirementGroups({
    institutionCanonicalName: input.institutionCanonicalName,
    catalogLabel: input.catalogLabel,
    requirementSetId,
    groups: [
      {
        groupName: "Auto-discovered required courses",
        groupType: "all_of",
        displayOrder: 0,
        items: bestCourses.slice(0, 60).map((course, index) => ({
          itemType: "course",
          courseCode: course.courseCode,
          itemLabel: course.courseTitle,
          displayOrder: index,
        })),
      },
    ],
  });

  return {
    status: "requirements_discovered" as const,
    discoveredCourseCount: bestCourses.length,
    sourcePage: bestPage.url,
    requirementSetId,
    message: `Discovered ${bestCourses.length} courses for the ${input.kind} requirement set.`,
  };
}

export async function discoverProgramRequirements(input: {
  institutionCanonicalName: string;
  catalogLabel: string;
  degreeType: string;
  programName: string;
  majorCanonicalName?: string;
  minorCanonicalName?: string;
}) {
  const institution = await repo.getInstitutionByCanonicalName(input.institutionCanonicalName);
  if (!institution) {
    throw new Error(`Institution not found: ${input.institutionCanonicalName}`);
  }

  if (!institution.website_url) {
    return {
      status: "upload_required" as const,
      uploadRecommended: true,
      message: "The institution directory entry has no website URL, so a program PDF is required.",
      major: null,
      minor: null,
      uploadUrl: "/uploads/catalog",
    };
  }

  let majorResult: Awaited<ReturnType<typeof discoverSingleProgramRequirements>> | null = null;
  let minorResult: Awaited<ReturnType<typeof discoverSingleProgramRequirements>> | null = null;

  if (input.majorCanonicalName) {
    const institutionRow = await repo.getInstitutionByCanonicalName(input.institutionCanonicalName);
    const catalogRow = institutionRow
      ? await repo.getAcademicCatalog(institutionRow.institution_id, input.catalogLabel)
      : null;
    const degreeProgramRow = catalogRow
      ? await repo.getDegreeProgram(catalogRow.academic_catalog_id, input.degreeType, input.programName)
      : null;
    const majorRow =
      degreeProgramRow && input.majorCanonicalName
        ? await repo.getMajor(degreeProgramRow.degree_program_id, input.majorCanonicalName)
        : null;

    if (majorRow) {
      majorResult = await discoverSingleProgramRequirements({
        institutionCanonicalName: input.institutionCanonicalName,
        catalogLabel: input.catalogLabel,
        degreeType: input.degreeType,
        programName: input.programName,
        programCanonicalName: majorRow.canonical_name,
        programDisplayName: majorRow.display_name,
        kind: "major",
        websiteUrl: institution.website_url,
      });
    }
  }

  if (input.minorCanonicalName) {
    const institutionRow = await repo.getInstitutionByCanonicalName(input.institutionCanonicalName);
    const catalogRow = institutionRow
      ? await repo.getAcademicCatalog(institutionRow.institution_id, input.catalogLabel)
      : null;
    const degreeProgramRow = catalogRow
      ? await repo.getDegreeProgram(catalogRow.academic_catalog_id, input.degreeType, input.programName)
      : null;
    const minorRow =
      degreeProgramRow && input.minorCanonicalName
        ? await repo.getMinor(degreeProgramRow.degree_program_id, input.minorCanonicalName)
        : null;

    if (minorRow) {
      minorResult = await discoverSingleProgramRequirements({
        institutionCanonicalName: input.institutionCanonicalName,
        catalogLabel: input.catalogLabel,
        degreeType: input.degreeType,
        programName: input.programName,
        programCanonicalName: minorRow.canonical_name,
        programDisplayName: minorRow.display_name,
        kind: "minor",
        websiteUrl: institution.website_url,
      });
    }
  }

  const uploadRecommended =
    !majorResult ||
    majorResult.status === "upload_required" ||
    (minorResult != null && minorResult.status === "upload_required");

  return {
    status: uploadRecommended ? "upload_required" as const : "requirements_discovered" as const,
    uploadRecommended,
    uploadUrl: uploadRecommended ? "/uploads/catalog" : null,
    message: uploadRecommended
      ? "The system attempted to discover the selected program requirements from the school website, but a PDF upload is still recommended."
      : "The system discovered structured requirement details from the school website.",
    major: majorResult,
    minor: minorResult,
  };
}
