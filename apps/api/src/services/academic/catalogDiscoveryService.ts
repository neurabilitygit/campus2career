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

const repo = new CatalogRepository();

const DISCOVERY_USER_AGENT =
  "Campus2CareerBot/0.1 (+https://campus2career.local; academic catalog discovery)";
const MAX_CATALOG_PAGES = 8;
const MAX_PROGRAM_PAGES = 5;

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

function sameOriginHost(a: URL, b: URL): boolean {
  return a.hostname === b.hostname || a.hostname.endsWith(`.${b.hostname}`) || b.hostname.endsWith(`.${a.hostname}`);
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

    deduped.set(resolved.toString(), {
      href: resolved.toString(),
      text,
    });
  }

  return Array.from(deduped.values());
}

async function fetchHtmlPage(url: string): Promise<HtmlPage | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": DISCOVERY_USER_AGENT,
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
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
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
      .replace(/\s*\|\s*.*/g, "")
      .replace(/\s*-\s*(major|minor|b\.?a\.?|b\.?s\.?|bachelor.*)$/i, "")
      .replace(/^(major|minor)\s+in\s+/i, "")
      .replace(/\s+\((b\.?a\.?|b\.?s\.?|b\.?f\.?a\.?|bachelor.*?)\)$/i, "")
      .replace(/\s*,\s*(b\.?a\.?|b\.?s\.?|b\.?f\.?a\.?|b\.?b\.?a\.?)$/i, "")
  );
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

  if (!displayName || displayName.length < 2) {
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

function extractProgramsFromPage(page: HtmlPage): DiscoveredProgram[] {
  const links = extractLinks(page.url, page.html);
  const discovered: DiscoveredProgram[] = [];
  const deduped = new Set<string>();

  for (const link of links) {
    const classified = classifyProgramLabel(link.text, link.href);
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
      sourceUrl: link.href,
    });
  }

  return discovered;
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
    /(?<code>[A-Z]{2,5}\s?-?\d{2,4}[A-Z]?)\s*[:\-]\s*(?<title>[A-Za-z0-9 ,/&()'.]{3,120}?)(?:\.\s*|\s+-\s+)?(?<credits>\d+(?:\.\d+)?)\s*(?:credits?|credit hours?|hrs?)/i,
    /(?<code>[A-Z]{2,5}\s?-?\d{2,4}[A-Z]?)\s+(?<title>[A-Za-z0-9 ,/&()'.]{3,120}?)\s+(?<credits>\d+(?:\.\d+)?)\s*(?:credits?|credit hours?|hrs?)/i,
    /(?<code>[A-Z]{2,5}\s?-?\d{2,4}[A-Z]?)\s*[:\-]\s*(?<title>[A-Za-z0-9 ,/&()'.]{3,120})/i,
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

export async function discoverInstitutionCatalog(input: {
  institutionCanonicalName: string;
}) {
  const institution = await repo.getInstitutionByCanonicalName(input.institutionCanonicalName);
  if (!institution) {
    throw new Error(`Institution not found: ${input.institutionCanonicalName}`);
  }

  const existingCatalogs = await repo.listAcademicCatalogsForInstitution(institution.institution_id);
  if (existingCatalogs.length > 0) {
    return {
      status: "existing_catalog" as const,
      uploadRecommended: false,
      websiteUrl: institution.website_url,
      sourcePages: [],
      discoveredDegreeProgramCount: 0,
      discoveredMajorCount: 0,
      discoveredMinorCount: 0,
      catalogLabel: existingCatalogs[0].catalog_label,
      message: "Structured catalog data already exists for this institution.",
    };
  }

  if (!institution.website_url) {
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

  const homePage = await fetchHtmlPage(institution.website_url);
  if (!homePage) {
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

  const candidateLinks = rankCatalogLinks(extractLinks(homePage.url, homePage.html));
  const candidatePages = (
    await Promise.all(candidateLinks.map((link) => fetchHtmlPage(link.href)))
  ).filter((page): page is HtmlPage => !!page);
  const sourcePages = [homePage.url, ...candidatePages.map((page) => page.url)];

  const discoveredPrograms = new Map<string, DiscoveredProgram>();
  for (const page of [homePage, ...candidatePages]) {
    for (const program of extractProgramsFromPage(page)) {
      const key = `${program.kind}:${program.degreeType}:${program.programName}:${program.canonicalName}`;
      if (!discoveredPrograms.has(key)) {
        discoveredPrograms.set(key, program);
      }
    }
  }

  const discoveredList = Array.from(discoveredPrograms.values());
  if (!discoveredList.length) {
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

  const catalogWindow = currentCatalogWindow();
  await upsertAcademicCatalog({
    institutionCanonicalName: input.institutionCanonicalName,
    catalogLabel: catalogWindow.catalogLabel,
    startYear: catalogWindow.startYear,
    endYear: catalogWindow.endYear,
    sourceUrl: candidatePages[0]?.url || homePage.url,
    sourceFormat: "html",
    extractionStatus: "draft",
  });

  const degreePrograms = new Map<string, { degreeType: string; programName: string }>();
  for (const program of discoveredList) {
    degreePrograms.set(`${program.degreeType}:${program.programName}`, {
      degreeType: program.degreeType,
      programName: program.programName,
    });
  }

  for (const program of degreePrograms.values()) {
    await upsertDegreeProgram({
      institutionCanonicalName: input.institutionCanonicalName,
      catalogLabel: catalogWindow.catalogLabel,
      degreeType: program.degreeType,
      programName: program.programName,
      schoolName: institution.display_name,
    });
  }

  let discoveredMajorCount = 0;
  let discoveredMinorCount = 0;
  for (const program of discoveredList) {
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
    websiteUrl: institution.website_url,
    sourcePages,
    discoveredDegreeProgramCount: degreePrograms.size,
    discoveredMajorCount,
    discoveredMinorCount,
    catalogLabel: catalogWindow.catalogLabel,
    message: "Discovered institution programs from the school website and seeded them into the academic directory.",
  };
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
  const homePage = await fetchHtmlPage(input.websiteUrl);
  if (!homePage) {
    return {
      status: "upload_required" as const,
      discoveredCourseCount: 0,
      sourcePage: null,
      requirementSetId: null,
      message: `The ${input.kind} page could not be discovered from the institution website.`,
    };
  }

  const allCandidateLinks = [
    ...extractLinks(homePage.url, homePage.html),
    ...rankCatalogLinks(extractLinks(homePage.url, homePage.html)),
  ];

  const uniqueLinks = Array.from(
    new Map(allCandidateLinks.map((link) => [link.href, link] as const)).values()
  );

  const rankedLinks = uniqueLinks
    .map((link) => ({
      link,
      score: scoreProgramLink(input.programDisplayName, input.kind, link),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_PROGRAM_PAGES)
    .map((entry) => entry.link);

  const candidatePages = (
    await Promise.all(rankedLinks.map((link) => fetchHtmlPage(link.href)))
  ).filter((page): page is HtmlPage => !!page);

  let bestPage: HtmlPage | null = null;
  let bestCourses: DiscoveredCourse[] = [];

  for (const page of candidatePages) {
    const courses = extractCoursesFromText(page.text);
    if (courses.length > bestCourses.length) {
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
