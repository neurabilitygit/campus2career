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
  ];

  const byCode = new Map<string, ExtractedCatalogCourse>();

  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      const rawCode = match?.groups?.code;
      const rawTitle = match?.groups?.title;
      if (!rawCode || !rawTitle) {
        continue;
      }

      const courseCode = normalizeWhitespace(rawCode).replace(/\s+/g, "");
      const courseTitle = normalizeWhitespace(rawTitle);
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
  if (extractedCourses.length < 3) {
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

  await replaceResolvedRequirementGroups({
    institutionCanonicalName: input.institutionCanonicalName,
    catalogLabel,
    requirementSetId,
    groups: [
      {
        groupName: "Uploaded PDF requirement courses",
        groupType: "all_of",
        displayOrder: 0,
        minCoursesRequired: extractedCourses.length,
        items: extractedCourses.slice(0, 80).map((course, index) => ({
          itemType: "course",
          courseCode: course.courseCode,
          itemLabel: course.courseTitle,
          displayOrder: index,
        })),
      },
    ],
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
    totalCreditsRequired: totalCreditsRequired ?? null,
  };
}
