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

type ProgramKind = "major" | "minor";

interface ExtractedCatalogCourse {
  courseCode: string;
  courseTitle: string;
  creditsMin?: number;
  creditsMax?: number;
}

interface ExtractedRequirementRule {
  itemLabel: string;
  itemType: "manual_rule" | "department_elective";
  minCoursesRequired?: number;
  coursePrefix?: string;
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

function currentCatalogWindow() {
  const startYear = new Date().getFullYear();
  return {
    startYear,
    endYear: startYear + 1,
    catalogLabel: `Uploaded ${startYear}-${startYear + 1}`,
  };
}

function inferProgramDisplayName(input: {
  text: string;
  programKind: ProgramKind;
  fallbackDisplayName?: string;
}): string | null {
  if (input.fallbackDisplayName) {
    return input.fallbackDisplayName;
  }

  const lines = input.text
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)
    .slice(0, 80);

  const patterns =
    input.programKind === "major"
      ? [
          /^major in (.+)$/i,
          /^(.+?) major$/i,
          /^bachelor of [a-z .]+ in (.+)$/i,
          /^(.+?)\s+\((b\.?a\.?|b\.?s\.?|bachelor.*?)\)$/i,
        ]
      : [
          /^minor in (.+)$/i,
          /^(.+?) minor$/i,
        ];

  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      const candidate = normalizeWhitespace(match?.[1] || "");
      if (candidate.length >= 2 && candidate.length <= 120) {
        return candidate;
      }
    }
  }

  return null;
}

function inferTotalCreditsRequired(text: string): number | undefined {
  const patterns = [
    /(?:requires?|complete|minimum of)\s+(\d{1,3})\s+(?:semester\s+)?credits?/i,
    /(\d{1,3})\s+(?:semester\s+)?credits?\s+(?:required|minimum)/i,
    /total\s+(?:of\s+)?(\d{1,3})\s+credits?/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const parsed = Number(match?.[1]);
    if (Number.isFinite(parsed) && parsed > 0 && parsed < 300) {
      return parsed;
    }
  }

  return undefined;
}

function extractCatalogCoursesFromText(text: string): ExtractedCatalogCourse[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  const patterns = [
    /(?<code>[A-Z]{2,5}\s?-?\d{2,4}[A-Z]?)\s*[:\-]\s*(?<title>[A-Za-z0-9 ,/&()'.]{3,120}?)(?:\.\s*|\s+-\s+)?(?<credits>\d+(?:\.\d+)?)\s*(?:credits?|credit hours?|hrs?)/i,
    /(?<code>[A-Z]{2,5}\s?-?\d{2,4}[A-Z]?)\s+(?<title>[A-Za-z0-9 ,/&()'.]{3,120}?)\s+(?<credits>\d+(?:\.\d+)?)\s*(?:credits?|credit hours?|hrs?)/i,
    /(?<code>[A-Z]{2,5}\s?-?\d{2,4}[A-Z]?)\s*[:\-]\s*(?<title>[A-Za-z0-9 ,/&()'.]{3,120})/i,
    /(?<code>[A-Z]{2,5}\s?-?\d{2,4}[A-Z]?)\s*,\s*(?<title>[A-Za-z][A-Za-z0-9 ,/&()'.-]{3,120})/i,
    /^(?<code>[A-Z]{2,5}\s?-?\d{2,4}[A-Z]?)\s*\((?<title>[^)]+)\)$/i,
    /^\[\s?\]\s*(?<code>[A-Z]{2,5}\s?-?\d{2,4}[A-Z]?)\s+completed\b/i,
  ];

  const byCode = new Map<string, ExtractedCatalogCourse>();

  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      const rawCode = match?.groups?.code;
      const rawTitle = match?.groups?.title;
      if (!rawCode) {
        continue;
      }

      const courseCode = normalizeWhitespace(rawCode).replace(/\s+/g, "");
      const courseTitle = normalizeWhitespace(rawTitle || courseCode);
      if (!courseCode || !courseTitle) {
        continue;
      }

      const parsedCredits = Number(match?.groups?.credits);
      const credits = Number.isFinite(parsedCredits) ? parsedCredits : undefined;

      if (!byCode.has(courseCode)) {
        byCode.set(courseCode, {
          courseCode,
          courseTitle,
          creditsMin: credits,
          creditsMax: credits,
        });
      }
      break;
    }
  }

  return Array.from(byCode.values());
}

function maybeTrimToRequirementSections(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n");
  const stopMarkers = [
    /\n4\.\s+special courses/i,
    /\n5\.\s+suggested way to read/i,
    /\n6\.\s+source note/i,
    /\n7\.\s+final caution/i,
  ];

  let endIndex = normalized.length;
  for (const marker of stopMarkers) {
    const match = marker.exec(normalized);
    if (match && match.index < endIndex) {
      endIndex = match.index;
    }
  }

  return normalized.slice(0, endIndex);
}

function numberWordToCount(value: string): number | null {
  const normalized = value.trim().toLowerCase();
  const map: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
  };

  if (normalized in map) {
    return map[normalized];
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function inferDominantDepartmentPrefix(courses: ExtractedCatalogCourse[]): string | undefined {
  const counts = new Map<string, number>();
  for (const course of courses) {
    const prefix = course.courseCode.match(/^[A-Z]{2,5}/)?.[0];
    if (!prefix) continue;
    counts.set(prefix, (counts.get(prefix) || 0) + 1);
  }

  const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  return ranked[0]?.[0];
}

function extractRequirementRulesFromText(
  text: string,
  explicitCourses: ExtractedCatalogCourse[]
): ExtractedRequirementRule[] {
  const extractionWindow = maybeTrimToRequirementSections(text);
  const lines = extractionWindow
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  const dominantPrefix = inferDominantDepartmentPrefix(explicitCourses);
  const byLabel = new Map<string, ExtractedRequirementRule>();

  const addRule = (rule: ExtractedRequirementRule) => {
    const label = normalizeWhitespace(rule.itemLabel);
    if (!label || byLabel.has(label.toLowerCase())) {
      return;
    }
    byLabel.set(label.toLowerCase(), {
      ...rule,
      itemLabel: label,
    });
  };

  for (const line of lines) {
    const sectionHeadingMatch = line.match(
      /^(?<ordinal>\d+)\.\s+(?<label>.+?)\s+\((?<count>\d+)\s+courses?\)$/i
    );
    if (sectionHeadingMatch?.groups?.label && sectionHeadingMatch.groups.count) {
      const label = normalizeWhitespace(sectionHeadingMatch.groups.label);
      const count = Number(sectionHeadingMatch.groups.count);
      const isElectiveLike =
        /elective|approved offerings|within the department|philosophy/i.test(label);
      addRule({
        itemLabel: label,
        itemType: isElectiveLike ? "department_elective" : "manual_rule",
        minCoursesRequired: Number.isFinite(count) && count > 0 ? count : undefined,
        coursePrefix: isElectiveLike && dominantPrefix ? dominantPrefix : undefined,
      });
      continue;
    }

    const explicitCourseCode = line.match(/\b[A-Z]{2,5}\s?-?\d{2,4}[A-Z]?\b/);
    if (explicitCourseCode && /\brequired\b/i.test(line)) {
      continue;
    }

    const categoryMatch = line.match(
      /^(?<count>one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?<rest>.+?courses?.*)$/i
    );
    if (categoryMatch?.groups?.count && categoryMatch.groups.rest) {
      const count = numberWordToCount(categoryMatch.groups.count);
      if (count && /course/i.test(categoryMatch.groups.rest)) {
        addRule({
          itemLabel: line.replace(/\.$/, ""),
          itemType: "manual_rule",
          minCoursesRequired: count,
        });
        continue;
      }
    }

    const checklistMatch = line.match(
      /^\[\s?\]\s*(?<count>\d+)\s+(?<label>.+?course.+?)\s+completed$/i
    );
    if (checklistMatch?.groups?.count && checklistMatch.groups.label) {
      addRule({
        itemLabel: normalizeWhitespace(checklistMatch.groups.label),
        itemType: "manual_rule",
        minCoursesRequired: Number(checklistMatch.groups.count),
      });
      continue;
    }

    const totalMatch = line.match(
      /^remaining approved concentration courses selected so the total reaches (?<count>\d+)$/i
    );
    if (totalMatch?.groups?.count) {
      addRule({
        itemLabel: `Remaining approved concentration courses to reach ${totalMatch.groups.count} total`,
        itemType: dominantPrefix ? "department_elective" : "manual_rule",
        minCoursesRequired: Number(totalMatch.groups.count),
        coursePrefix: dominantPrefix,
      });
      continue;
    }

    const remainingMatch = line.match(
      /^complete the remaining courses needed to reach the (?<count>\d+)[-\s]?course total/i
    );
    if (remainingMatch?.groups?.count) {
      addRule({
        itemLabel: `Remaining department-approved courses to reach ${remainingMatch.groups.count} total`,
        itemType: dominantPrefix ? "department_elective" : "manual_rule",
        minCoursesRequired: Number(remainingMatch.groups.count),
        coursePrefix: dominantPrefix,
      });
    }
  }

  return Array.from(byLabel.values());
}

export async function extractCatalogRequirementsFromArtifact(input: {
  artifactText: string;
  institutionCanonicalName: string;
  catalogLabel?: string;
  degreeType?: string;
  programName?: string;
  programKind: ProgramKind;
  programCanonicalName?: string;
  programDisplayName?: string;
  academicArtifactId?: string;
}) {
  const institution = await repo.getInstitutionByCanonicalName(input.institutionCanonicalName);
  if (!institution) {
    throw new Error(`Institution not found: ${input.institutionCanonicalName}`);
  }

  const catalogWindow = currentCatalogWindow();
  const catalogLabel = input.catalogLabel || catalogWindow.catalogLabel;
  const degreeType = input.degreeType || "Undergraduate";
  const programName =
    input.programName ||
    (degreeType.toLowerCase().includes("graduate")
      ? "Uploaded graduate programs"
      : "Uploaded undergraduate programs");

  const resolvedDisplayName = inferProgramDisplayName({
    text: input.artifactText,
    programKind: input.programKind,
    fallbackDisplayName: input.programDisplayName,
  });
  if (!resolvedDisplayName) {
    throw new Error("CATALOG_PROGRAM_NAME_UNRESOLVED");
  }

  const resolvedCanonicalName = input.programCanonicalName || slugify(resolvedDisplayName);
  if (!resolvedCanonicalName) {
    throw new Error("CATALOG_PROGRAM_NAME_UNRESOLVED");
  }

  const extractedCourses = extractCatalogCoursesFromText(input.artifactText);
  const extractedRules = extractRequirementRulesFromText(input.artifactText, extractedCourses);
  const recognizedRequirementSignals = extractedCourses.length + extractedRules.length;

  if (recognizedRequirementSignals < 3) {
    throw new Error("CATALOG_ARTIFACT_EXTRACTION_EMPTY");
  }

  const totalCreditsRequired = inferTotalCreditsRequired(input.artifactText);

  await upsertAcademicCatalog({
    institutionCanonicalName: input.institutionCanonicalName,
    catalogLabel,
    startYear: catalogWindow.startYear,
    endYear: catalogWindow.endYear,
    sourceFormat: "pdf",
    extractionStatus: "draft",
  });

  await upsertDegreeProgram({
    institutionCanonicalName: input.institutionCanonicalName,
    catalogLabel,
    degreeType,
    programName,
    schoolName: institution.display_name,
  });

  if (input.programKind === "major") {
    await upsertMajor({
      institutionCanonicalName: input.institutionCanonicalName,
      catalogLabel,
      degreeType,
      programName,
      canonicalName: resolvedCanonicalName,
      displayName: resolvedDisplayName,
    });
  } else {
    await upsertMinor({
      institutionCanonicalName: input.institutionCanonicalName,
      catalogLabel,
      degreeType,
      programName,
      canonicalName: resolvedCanonicalName,
      displayName: resolvedDisplayName,
    });
  }

  for (const course of extractedCourses) {
    await upsertCatalogCourse({
      institutionCanonicalName: input.institutionCanonicalName,
      catalogLabel,
      courseCode: course.courseCode,
      courseTitle: course.courseTitle,
      creditsMin: course.creditsMin,
      creditsMax: course.creditsMax,
      description: input.academicArtifactId
        ? `Extracted from uploaded academic artifact ${input.academicArtifactId}`
        : "Extracted from uploaded academic artifact",
      levelHint: "mixed",
    });
  }

  const requirementSetId = await upsertRequirementSet({
    institutionCanonicalName: input.institutionCanonicalName,
    catalogLabel,
    degreeType,
    programName,
    setType: input.programKind,
    displayName: `${resolvedDisplayName} ${input.programKind} requirements`,
    totalCreditsRequired,
    majorCanonicalName: input.programKind === "major" ? resolvedCanonicalName : undefined,
    minorCanonicalName: input.programKind === "minor" ? resolvedCanonicalName : undefined,
    provenanceMethod: "artifact_pdf",
    sourceNote: input.academicArtifactId
      ? `Extracted from uploaded academic artifact ${input.academicArtifactId}`
      : "Extracted from uploaded academic artifact",
  });

  const requirementGroups: Array<{
    groupName: string;
    groupType: "all_of" | "choose_n" | "credits_bucket" | "one_of" | "capstone" | "gpa_rule";
    displayOrder: number;
    minCoursesRequired?: number;
    items: Array<{
      itemType: "course" | "course_pattern" | "free_elective" | "department_elective" | "manual_rule";
      courseCode?: string;
      itemLabel?: string;
      coursePrefix?: string;
      displayOrder: number;
    }>;
  }> = [];

  if (extractedCourses.length) {
    requirementGroups.push({
      groupName: "Uploaded PDF explicit courses",
      groupType: "all_of",
      displayOrder: 0,
      minCoursesRequired: extractedCourses.length,
      items: extractedCourses.slice(0, 80).map((course, index) => ({
        itemType: "course",
        courseCode: course.courseCode,
        itemLabel: course.courseTitle,
        displayOrder: index,
      })),
    });
  }

  if (extractedRules.length) {
    requirementGroups.push({
      groupName: "Uploaded PDF requirement rules",
      groupType: "all_of",
      displayOrder: requirementGroups.length,
      minCoursesRequired: extractedRules.length,
      items: extractedRules.slice(0, 80).map((rule, index) => ({
        itemType: rule.itemType,
        itemLabel: rule.itemLabel,
        coursePrefix: rule.coursePrefix,
        displayOrder: index,
      })),
    });
  }

  await replaceResolvedRequirementGroups({
    institutionCanonicalName: input.institutionCanonicalName,
    catalogLabel,
    requirementSetId,
    groups: requirementGroups,
  });

  return {
    catalogLabel,
    degreeType,
    programName,
    programKind: input.programKind,
    programCanonicalName: resolvedCanonicalName,
    programDisplayName: resolvedDisplayName,
    requirementSetId,
    extractedCourseCount: extractedCourses.length,
    extractedRequirementRuleCount: extractedRules.length,
    totalCreditsRequired: totalCreditsRequired ?? null,
  };
}
