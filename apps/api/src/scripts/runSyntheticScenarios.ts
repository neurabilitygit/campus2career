import fs from "node:fs";
import path from "node:path";
import { query } from "../db/client";
import { stableId } from "../services/market/idFactory";
import { StudentWriteRepository } from "../repositories/student/studentWriteRepository";
import { OnboardingRepository } from "../repositories/student/onboardingRepository";
import { ArtifactRepository } from "../repositories/student/artifactRepository";
import {
  assignStudentCatalog,
  getPrimaryRequirementSetGraphForStudent,
  replaceResolvedRequirementGroups,
  upsertAcademicCatalog,
  upsertCatalogCourse,
  upsertDegreeProgram,
  upsertInstitution,
  upsertMajor,
  upsertMinor,
  upsertRequirementSet,
} from "../services/academic/catalogService";
import { persistStudentTranscriptGraph, autoMatchTranscriptToPrimaryCatalog } from "../services/academic/transcriptService";
import { buildStudentScoringInput } from "../services/student/aggregateStudentContext";
import { runScoring } from "../services/scoring";
import { SKILL_LEXICON } from "../../../../packages/shared/src/scoring/roleSkillLexicon";
import type { StudentScoringInput, ScoringOutput } from "../../../../packages/shared/src/scoring/types";
import type { StudentTranscriptInput } from "../../../../packages/shared/src/contracts/academic";

type ProgramKind = "major" | "minor";

interface SyntheticScenarioMatrix {
  schemaVersion: string;
  generatedAt: string;
  description: string;
  scenarios: SyntheticScenario[];
}

interface SyntheticScenario {
  id: string;
  label: string;
  publicBasis: {
    institutionDisplayName: string;
    institutionCanonicalName: string;
    majorDisplayName: string;
    majorCanonicalName: string;
    minorDisplayName?: string;
    minorCanonicalName?: string;
    targetRoleFamily: string;
    targetSectorCluster: string;
  };
  profile: {
    schoolName: string;
    expectedGraduationDate: string;
    majorPrimary: string;
    majorSecondary?: string;
    preferredGeographies?: string[];
    careerGoalSummary?: string;
  };
  sectorSelection?: {
    sectorClusters: string[];
  };
  catalogAssignment?: {
    catalogLabel: string;
    degreeType: string;
    programName: string;
    majorCanonicalName?: string;
    minorCanonicalName?: string;
  };
  requirementScaffold?: {
    courses: Array<{
      courseCode: string;
      courseTitle: string;
      credits?: number;
    }>;
  };
  transcript?: {
    institutionCanonicalName: string;
    transcriptSummary?: string;
    terms: StudentTranscriptInput["terms"];
  };
  experiences?: Array<{
    title: string;
    organization?: string;
    deliverablesSummary?: string;
    toolsUsed?: string[];
    relevanceRating?: number;
  }>;
  artifacts?: Array<{
    artifactType: string;
    extractedSummary?: string;
  }>;
  contacts?: Array<{
    contactName: string;
    relationshipType?: string;
    warmthLevel?: "cold" | "warm" | "strong";
    notes?: string;
  }>;
  outreach?: Array<{
    interactionType: string;
    outcome?: string;
  }>;
  deadlines?: Array<{
    title: string;
    dueDate: string;
    deadlineType: string;
    completed?: boolean;
    notes?: string;
  }>;
  expectedAssertions?: {
    requirementGraphExpected?: boolean;
    scoring?: {
      targetRoleFamily?: string;
      trajectoryStatusOneOf?: string[];
      overallScoreRange?: [number, number];
      mustShowStrengthOrRecommendationFor?: string[];
      mustShowRiskOrGapFor?: string[];
      mustRecommend?: string[];
      mustNotPrioritize?: string[];
      comparisonHint?: string;
      comparisonTargets?: Array<{
        targetRoleFamily: string;
        targetSectorCluster?: string;
        expectation?: string;
        expectedOverallScoreRelationToBase?: "greater_or_equal_minus_5";
      }>;
    };
  };
}

const studentWriteRepo = new StudentWriteRepository();
const onboardingRepo = new OnboardingRepository();
const artifactRepo = new ArtifactRepository();

function fixturePath() {
  return path.resolve(process.cwd(), "../../data/synthetic-fixtures/scenario-matrix.v1.json");
}

function loadScenarioMatrix(): SyntheticScenarioMatrix {
  const raw = fs.readFileSync(fixturePath(), "utf8");
  return JSON.parse(raw) as SyntheticScenarioMatrix;
}

function parseArgs(argv: string[]) {
  const args = new Map<string, string | boolean>();
  for (let index = 0; index < argv.length; index += 1) {
    const part = argv[index];
    if (!part.startsWith("--")) continue;
    const key = part.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args.set(key, true);
    } else {
      args.set(key, next);
      index += 1;
    }
  }
  return {
    scenarioId: (args.get("scenario") as string | undefined) || null,
    listOnly: args.get("list") === true,
    keepExisting: args.get("keep-existing") === true,
  };
}

function syntheticIdentity(scenarioId: string) {
  return {
    userId: stableId("synthetic_user", scenarioId),
    studentProfileId: stableId("synthetic_student_profile", scenarioId),
    onboardingStateId: stableId("synthetic_onboarding_state", scenarioId),
    email: `${scenarioId.toLowerCase()}@synthetic.campus2career.local`,
    firstName: "Synthetic",
    lastName: scenarioId,
  };
}

async function cleanupScenarioData(identity: ReturnType<typeof syntheticIdentity>) {
  await query(`delete from users where user_id = $1 or email = $2`, [
    identity.userId,
    identity.email,
  ]);
}

async function ensureSyntheticUser(identity: ReturnType<typeof syntheticIdentity>) {
  await query(
    `
    insert into users (
      user_id,
      role_type,
      first_name,
      last_name,
      email,
      timezone,
      preferred_language,
      account_status,
      created_at,
      updated_at
    ) values ($1,'student',$2,$3,$4,'America/New_York','en','active',now(),now())
    on conflict (user_id) do update set
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      email = excluded.email,
      updated_at = now()
    `,
    [identity.userId, identity.firstName, identity.lastName, identity.email]
  );
}

async function ensureOnboardingState(identity: ReturnType<typeof syntheticIdentity>) {
  await onboardingRepo.ensureState(identity.studentProfileId, identity.onboardingStateId);
}

function normalizeTermKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function parseCatalogYears(catalogLabel: string) {
  const match = catalogLabel.match(/(20\d{2})\D+(20\d{2})/);
  if (match) {
    return {
      startYear: Number(match[1]),
      endYear: Number(match[2]),
    };
  }

  return {
    startYear: 2026,
    endYear: 2027,
  };
}

type SyntheticCatalogCourseSeed = {
  courseCode: string;
  courseTitle: string;
  credits: number | null;
};

const SYNTHETIC_REQUIREMENT_TARGET_COMPLETION: Record<
  "freshman" | "sophomore" | "junior" | "senior" | "other",
  number
> = {
  freshman: 0.25,
  sophomore: 0.4,
  junior: 0.5,
  senior: 0.55,
  other: 0.45,
};

const SYNTHETIC_MATCHED_COURSE_SHARE: Record<
  "freshman" | "sophomore" | "junior" | "senior" | "other",
  number
> = {
  freshman: 0.35,
  sophomore: 0.4,
  junior: 0.45,
  senior: 0.5,
  other: 0.4,
};

function deriveSyntheticAcademicYear(expectedGraduationDate?: string | null): "freshman" | "sophomore" | "junior" | "senior" | "other" {
  if (!expectedGraduationDate) return "other";
  const grad = new Date(expectedGraduationDate);
  const now = new Date();
  const months = (grad.getFullYear() - now.getFullYear()) * 12 + (grad.getMonth() - now.getMonth());
  if (months > 36) return "freshman";
  if (months > 24) return "sophomore";
  if (months > 12) return "junior";
  if (months >= -3) return "senior";
  return "other";
}

function parseCourseLevelFromCode(courseCode?: string | null): number {
  const match = courseCode?.match(/(\d{3,4})/);
  return match ? Number(match[1]) : 0;
}

function deriveMajorKeywordTokens(scenario: SyntheticScenario) {
  const raw = `${scenario.publicBasis.majorDisplayName} ${scenario.profile.majorPrimary}`;
  return raw
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2)
    .filter((token) => !["and", "for", "the", "with"].includes(token));
}

function chooseRequirementBackedCourses(
  scenario: SyntheticScenario,
  transcriptCourses: SyntheticCatalogCourseSeed[]
) {
  const tokens = deriveMajorKeywordTokens(scenario);
  const year = deriveSyntheticAcademicYear(scenario.profile.expectedGraduationDate);
  const targetCount = Math.max(
    1,
    Math.min(
      transcriptCourses.length,
      Math.round(transcriptCourses.length * SYNTHETIC_MATCHED_COURSE_SHARE[year])
    )
  );

  return [...transcriptCourses]
    .sort((left, right) => {
      const score = (course: SyntheticCatalogCourseSeed) => {
        const title = course.courseTitle.toLowerCase();
        const tokenHits = tokens.filter((token) => title.includes(token)).length;
        const researchBoost = /research|methods|capstone|seminar|project|analysis|statistics|probability|public health/i.test(
          course.courseTitle
        )
          ? 18
          : 0;
        return tokenHits * 24 + researchBoost + parseCourseLevelFromCode(course.courseCode) / 50;
      };
      return score(right) - score(left);
    })
    .slice(0, targetCount);
}

function dominantCoursePrefix(courses: SyntheticCatalogCourseSeed[]) {
  const counts = new Map<string, number>();
  for (const course of courses) {
    const prefix = course.courseCode.match(/^[A-Z]{2,4}/i)?.[0]?.toUpperCase();
    if (!prefix) continue;
    counts.set(prefix, (counts.get(prefix) || 0) + 1);
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "SYN";
}

function buildFutureRequirementCourses(
  scenario: SyntheticScenario,
  matchedCourses: SyntheticCatalogCourseSeed[],
  totalRequirementCount: number
) {
  const missingCount = Math.max(0, totalRequirementCount - matchedCourses.length);
  if (missingCount === 0) {
    return [];
  }

  const prefix = dominantCoursePrefix(matchedCourses);
  const startingLevel = Math.max(
    3000,
    ...matchedCourses.map((course) => parseCourseLevelFromCode(course.courseCode))
  );

  return Array.from({ length: missingCount }, (_, index) => ({
    courseCode: `${prefix}${startingLevel + (index + 1) * 10}`,
    courseTitle: `Synthetic ${scenario.publicBasis.majorDisplayName} advanced requirement ${index + 1}`,
    credits: 3,
  }));
}

function buildSyntheticRequirementPlan(scenario: SyntheticScenario) {
  if (scenario.requirementScaffold?.courses?.length) {
    const explicitCourses = scenario.requirementScaffold.courses.map((course) => ({
      courseCode: course.courseCode.trim(),
      courseTitle: course.courseTitle,
      credits: course.credits ?? 3,
    }));

    return {
      matchedCourses: [] as SyntheticCatalogCourseSeed[],
      futureCourses: explicitCourses,
      allCatalogCourses: explicitCourses,
    };
  }

  const uniqueTranscriptCourses = new Map<string, SyntheticCatalogCourseSeed>();
  for (const term of scenario.transcript?.terms || []) {
    for (const course of term.courses) {
      const courseCode = course.rawCourseCode?.trim();
      if (!courseCode || uniqueTranscriptCourses.has(courseCode)) {
        continue;
      }
      uniqueTranscriptCourses.set(courseCode, {
        courseCode,
        courseTitle: course.rawCourseTitle,
        credits: course.creditsEarned ?? course.creditsAttempted ?? null,
      });
    }
  }

  const transcriptCourses = Array.from(uniqueTranscriptCourses.values());
  const matchedCourses = chooseRequirementBackedCourses(scenario, transcriptCourses);
  const year = deriveSyntheticAcademicYear(scenario.profile.expectedGraduationDate);
  const totalRequirementCount = Math.max(
    matchedCourses.length + 1,
    Math.ceil(matchedCourses.length / SYNTHETIC_REQUIREMENT_TARGET_COMPLETION[year])
  );
  const futureCourses = buildFutureRequirementCourses(scenario, matchedCourses, totalRequirementCount);

  return {
    matchedCourses,
    futureCourses,
    allCatalogCourses: [...matchedCourses, ...futureCourses],
  };
}

async function ensureSyntheticCatalogScaffold(scenario: SyntheticScenario) {
  if (!scenario.catalogAssignment) {
    return;
  }

  const { startYear, endYear } = parseCatalogYears(scenario.catalogAssignment.catalogLabel);

  await upsertInstitution({
    canonicalName: scenario.publicBasis.institutionCanonicalName,
    displayName: scenario.publicBasis.institutionDisplayName,
    countryCode: "US",
  });

  await upsertAcademicCatalog({
    institutionCanonicalName: scenario.publicBasis.institutionCanonicalName,
    catalogLabel: scenario.catalogAssignment.catalogLabel,
    startYear,
    endYear,
    sourceFormat: "manual",
    extractionStatus: "published",
  });

  await upsertDegreeProgram({
    institutionCanonicalName: scenario.publicBasis.institutionCanonicalName,
    catalogLabel: scenario.catalogAssignment.catalogLabel,
    degreeType: scenario.catalogAssignment.degreeType,
    programName: scenario.catalogAssignment.programName,
    totalCreditsRequired: 120,
  });

  if (scenario.catalogAssignment.majorCanonicalName) {
    await upsertMajor({
      institutionCanonicalName: scenario.publicBasis.institutionCanonicalName,
      catalogLabel: scenario.catalogAssignment.catalogLabel,
      degreeType: scenario.catalogAssignment.degreeType,
      programName: scenario.catalogAssignment.programName,
      canonicalName: scenario.catalogAssignment.majorCanonicalName,
      displayName: scenario.publicBasis.majorDisplayName,
    });
  }

  if (scenario.catalogAssignment.minorCanonicalName && scenario.publicBasis.minorDisplayName) {
    await upsertMinor({
      institutionCanonicalName: scenario.publicBasis.institutionCanonicalName,
      catalogLabel: scenario.catalogAssignment.catalogLabel,
      degreeType: scenario.catalogAssignment.degreeType,
      programName: scenario.catalogAssignment.programName,
      canonicalName: scenario.catalogAssignment.minorCanonicalName,
      displayName: scenario.publicBasis.minorDisplayName,
    });
  }

  const requirementPlan = buildSyntheticRequirementPlan(scenario);

  await query(
    `
    delete from catalog_courses
    where academic_catalog_id = (
      select ac.academic_catalog_id
      from academic_catalogs ac
      join institutions i on i.institution_id = ac.institution_id
      where i.canonical_name = $1
        and ac.catalog_label = $2
      limit 1
    )
    `,
    [scenario.publicBasis.institutionCanonicalName, scenario.catalogAssignment.catalogLabel]
  );

  for (const course of requirementPlan.allCatalogCourses) {
    await upsertCatalogCourse({
      institutionCanonicalName: scenario.publicBasis.institutionCanonicalName,
      catalogLabel: scenario.catalogAssignment.catalogLabel,
      courseCode: course.courseCode,
      courseTitle: course.courseTitle,
      creditsMin: course.credits ?? undefined,
      creditsMax: course.credits ?? undefined,
    });
  }

  if (scenario.catalogAssignment.majorCanonicalName) {
    const requirementSetId = await upsertRequirementSet({
      institutionCanonicalName: scenario.publicBasis.institutionCanonicalName,
      catalogLabel: scenario.catalogAssignment.catalogLabel,
      degreeType: scenario.catalogAssignment.degreeType,
      programName: scenario.catalogAssignment.programName,
      setType: "major",
      displayName: `${scenario.publicBasis.majorDisplayName} synthetic requirements`,
      totalCreditsRequired: requirementPlan.allCatalogCourses.reduce(
        (sum, course) => sum + (course.credits || 0),
        0
      ),
      majorCanonicalName: scenario.catalogAssignment.majorCanonicalName,
      provenanceMethod: "synthetic_seed",
      sourceNote: `Synthetic scenario scaffold for ${scenario.id}`,
    });

    if (requirementPlan.matchedCourses.length > 0 || requirementPlan.futureCourses.length > 0) {
      await replaceResolvedRequirementGroups({
        institutionCanonicalName: scenario.publicBasis.institutionCanonicalName,
        catalogLabel: scenario.catalogAssignment.catalogLabel,
        requirementSetId,
        groups: [
          ...(requirementPlan.matchedCourses.length > 0
            ? [
                {
                  groupName: "Synthetic completed major core",
                  groupType: "all_of" as const,
                  minCoursesRequired: requirementPlan.matchedCourses.length,
                  displayOrder: 0,
                  items: requirementPlan.matchedCourses.map((course, index) => ({
                    itemType: "course" as const,
                    courseCode: course.courseCode,
                    itemLabel: course.courseTitle,
                    creditsIfUsed: course.credits ?? undefined,
                    displayOrder: index,
                  })),
                },
              ]
            : []),
          ...(requirementPlan.futureCourses.length > 0
            ? [
                {
                  groupName: "Synthetic remaining major requirements",
                  groupType: "all_of" as const,
                  minCoursesRequired: requirementPlan.futureCourses.length,
                  displayOrder: 1,
                  items: requirementPlan.futureCourses.map((course, index) => ({
                    itemType: "course" as const,
                    courseCode: course.courseCode,
                    itemLabel: course.courseTitle,
                    creditsIfUsed: course.credits ?? undefined,
                    displayOrder: index,
                  })),
                },
              ]
            : []),
        ],
      });
    }
  }

  if (scenario.catalogAssignment.minorCanonicalName && scenario.publicBasis.minorDisplayName) {
    await upsertRequirementSet({
      institutionCanonicalName: scenario.publicBasis.institutionCanonicalName,
      catalogLabel: scenario.catalogAssignment.catalogLabel,
      degreeType: scenario.catalogAssignment.degreeType,
      programName: scenario.catalogAssignment.programName,
      setType: "minor",
      displayName: `${scenario.publicBasis.minorDisplayName} synthetic requirements`,
      totalCreditsRequired: 18,
      minorCanonicalName: scenario.catalogAssignment.minorCanonicalName,
      provenanceMethod: "synthetic_seed",
      sourceNote: `Synthetic scenario scaffold for ${scenario.id}`,
    });
  }
}

async function seedTranscriptAndCourseCoverage(input: {
  scenario: SyntheticScenario;
  studentProfileId: string;
  targetRoleFamily: string;
}) {
  if (!input.scenario.transcript) {
    return {
      studentTranscriptId: null,
      transcriptMatching: null,
    };
  }

  const transcriptInput: StudentTranscriptInput = {
    studentProfileId: input.studentProfileId,
    institutionCanonicalName: input.scenario.transcript.institutionCanonicalName,
    transcriptSummary: input.scenario.transcript.transcriptSummary,
    parsedStatus: "parsed",
    terms: input.scenario.transcript.terms,
  };

  const studentTranscriptId = await persistStudentTranscriptGraph(transcriptInput);
  const transcriptMatching = await autoMatchTranscriptToPrimaryCatalog(
    input.studentProfileId,
    studentTranscriptId
  );

  for (const term of input.scenario.transcript.terms) {
    const academicTermId = stableId(
      "synthetic_academic_term",
      `${input.studentProfileId}:${normalizeTermKey(term.termLabel)}`
    );
    await studentWriteRepo.ensureAcademicTerm({
      academicTermId,
      studentProfileId: input.studentProfileId,
      termName: term.termLabel,
    });

    for (const course of term.courses) {
      const courseId = stableId(
        "synthetic_course",
        `${academicTermId}:${course.rawCourseCode || course.rawCourseTitle}`
      );
      await studentWriteRepo.createCourse({
        courseId,
        academicTermId,
        courseCode: course.rawCourseCode || null,
        courseTitle: course.rawCourseTitle,
        finalGrade: course.grade || null,
        notes: course.rawTextExcerpt || null,
      });

      const derivedSkills = inferSkillsForCourse(course.rawCourseTitle, input.targetRoleFamily);
      for (const [skillIndex, skillName] of derivedSkills.entries()) {
        await studentWriteRepo.createCourseSkillCoverage({
          courseSkillCoverageId: stableId(
            "synthetic_course_skill",
            `${courseId}:${skillName}:${skillIndex}`
          ),
          courseId,
          skillName,
          coverageStrength: "medium",
          confidenceScore: 0.72,
          derivedFrom: "manual_tagging",
        });
      }
    }
  }

  return {
    studentTranscriptId,
    transcriptMatching,
  };
}

function inferSkillsForCourse(courseTitle: string, targetRoleFamily: string): string[] {
  const lower = courseTitle.toLowerCase();
  const hits = new Set<string>();

  for (const [skillName, terms] of Object.entries(SKILL_LEXICON)) {
    if (terms.some((term) => lower.includes(term.toLowerCase()))) {
      hits.add(skillName);
    }
  }

  if (/stat|econometric|probability|analytics|data science|database/i.test(courseTitle)) {
    hits.add("sql");
  }
  if (/visual|dashboard|tableau|power bi|business intelligence/i.test(courseTitle)) {
    hits.add("data_visualization");
  }
  if (/finance|valuation|investment|corporate/i.test(courseTitle)) {
    hits.add("finance_analysis");
    hits.add("excel_modeling");
  }
  if (/account|audit|tax/i.test(courseTitle)) {
    hits.add("accounting_controls");
  }
  if (/research|epidemiology|public health|biology/i.test(courseTitle)) {
    hits.add("research");
  }
  if (/supply chain|optimization|operations|strategy/i.test(courseTitle)) {
    hits.add("consulting_problem_solving");
  }
  if (/programming|python|computing|data structures/i.test(courseTitle)) {
    hits.add(targetRoleFamily === "software developer" ? "python" : "project_execution");
  }

  return Array.from(hits);
}

async function seedArtifacts(studentProfileId: string, scenarioId: string, artifacts: SyntheticScenario["artifacts"] = []) {
  for (let index = 0; index < artifacts.length; index += 1) {
    const artifact = artifacts[index];
    await artifactRepo.createAcademicArtifact({
      academicArtifactId: stableId("synthetic_artifact", `${scenarioId}:${index}:${artifact.artifactType}`),
      studentProfileId,
      artifactType: artifact.artifactType,
      fileUri: `synthetic://${scenarioId}/${artifact.artifactType}/${index}`,
      sourceLabel: "synthetic_fixture",
      parsedStatus: "parsed",
      extractedSummary: artifact.extractedSummary || null,
    });
  }
}

async function seedOutreach(studentProfileId: string, scenarioId: string, outreach: SyntheticScenario["outreach"] = []) {
  for (let index = 0; index < outreach.length; index += 1) {
    const item = outreach[index];
    await query(
      `
      insert into outreach_interactions (
        outreach_interaction_id,
        student_profile_id,
        interaction_type,
        outcome,
        notes,
        interaction_at,
        created_at
      ) values ($1,$2,$3,$4,$5,now(),now())
      on conflict (outreach_interaction_id) do update set
        interaction_type = excluded.interaction_type,
        outcome = excluded.outcome,
        notes = excluded.notes
      `,
      [
        stableId("synthetic_outreach", `${scenarioId}:${index}:${item.interactionType}`),
        studentProfileId,
        item.interactionType,
        item.outcome || null,
        "Synthetic fixture outreach interaction",
      ]
    );
  }
}

async function seedDeadlines(studentProfileId: string, scenarioId: string, deadlines: SyntheticScenario["deadlines"] = []) {
  for (let index = 0; index < deadlines.length; index += 1) {
    const deadline = deadlines[index];
    await studentWriteRepo.createDeadline({
      deadlineId: stableId("synthetic_deadline", `${scenarioId}:${index}:${deadline.title}`),
      studentProfileId,
      title: deadline.title,
      dueDate: deadline.dueDate,
      deadlineType: deadline.deadlineType,
      notes: deadline.notes || null,
    });
    if (deadline.completed) {
      await query(`update deadlines set completed = true where deadline_id = $1`, [
        stableId("synthetic_deadline", `${scenarioId}:${index}:${deadline.title}`),
      ]);
    }
  }
}

function normalizeTerm(value: string): string {
  return value.toLowerCase().replace(/[_\s-]+/g, " ").trim();
}

function searchScoringText(scoring: ScoringOutput, sections?: Array<"recommendations" | "risks" | "strengths" | "gaps" | "heuristics">) {
  const values: string[] = [];

  const include = (section: string) => !sections || sections.includes(section as any);

  if (include("strengths")) {
    values.push(...scoring.topStrengths);
  }
  if (include("risks")) {
    values.push(...scoring.topRisks);
  }
  if (include("gaps")) {
    values.push(...scoring.skillGaps.map((gap) => `${gap.skillName} ${gap.evidenceSummary}`));
  }
  if (include("heuristics")) {
    values.push(
      ...scoring.heuristicFlags.flatMap((flag) => [
        flag.code,
        flag.title,
        flag.explanation,
        ...flag.recommendedActions,
      ])
    );
  }
  if (include("recommendations")) {
    values.push(
      ...scoring.recommendations.flatMap((item) => [
        item.title,
        item.description,
        item.whyThisMatchesStudent,
        item.linkedSkillName || "",
      ])
    );
  }

  return normalizeTerm(values.join(" "));
}

function includesAnyTerm(haystack: string, terms: string[] = []) {
  return terms.every((term) => haystack.includes(normalizeTerm(term)));
}

function evaluateAssertions(input: {
  scenario: SyntheticScenario;
  scoring: ScoringOutput;
  requirementGraphExists: boolean;
  comparisons: Array<{ targetRoleFamily: string; targetSectorCluster?: string; scoring: ScoringOutput }>;
}) {
  const failures: string[] = [];
  const notes: string[] = [];
  const scoringAssertions = input.scenario.expectedAssertions?.scoring;

  if (input.scenario.expectedAssertions?.requirementGraphExpected && !input.requirementGraphExists) {
    failures.push("Expected a bound requirement graph, but no primary requirement set was found.");
  }

  if (scoringAssertions?.targetRoleFamily && input.scoring.targetRoleFamily !== scoringAssertions.targetRoleFamily) {
    failures.push(
      `Expected target role ${scoringAssertions.targetRoleFamily}, got ${input.scoring.targetRoleFamily}.`
    );
  }

  if (
    scoringAssertions?.trajectoryStatusOneOf &&
    !scoringAssertions.trajectoryStatusOneOf.includes(input.scoring.trajectoryStatus)
  ) {
    failures.push(
      `Expected trajectory status in [${scoringAssertions.trajectoryStatusOneOf.join(", ")}], got ${input.scoring.trajectoryStatus}.`
    );
  }

  if (scoringAssertions?.overallScoreRange) {
    const [min, max] = scoringAssertions.overallScoreRange;
    if (input.scoring.overallScore < min || input.scoring.overallScore > max) {
      failures.push(
        `Expected overall score in range ${min}-${max}, got ${input.scoring.overallScore}.`
      );
    }
  }

  const allScoringText = searchScoringText(input.scoring);
  const recommendationText = searchScoringText(input.scoring, ["recommendations"]);
  const riskGapText = searchScoringText(input.scoring, ["risks", "gaps", "heuristics", "recommendations"]);

  for (const term of scoringAssertions?.mustShowStrengthOrRecommendationFor || []) {
    if (!allScoringText.includes(normalizeTerm(term))) {
      failures.push(`Expected scoring output to surface signal related to "${term}".`);
    }
  }

  for (const term of scoringAssertions?.mustShowRiskOrGapFor || []) {
    if (!riskGapText.includes(normalizeTerm(term))) {
      failures.push(`Expected scoring output to surface risk or gap related to "${term}".`);
    }
  }

  for (const term of scoringAssertions?.mustRecommend || []) {
    if (!recommendationText.includes(normalizeTerm(term))) {
      failures.push(`Expected recommendations to mention "${term}".`);
    }
  }

  for (const term of scoringAssertions?.mustNotPrioritize || []) {
    if (riskGapText.includes(normalizeTerm(term))) {
      failures.push(`Expected the system not to prioritize "${term}", but it appeared in output.`);
    }
  }

  for (const comparison of scoringAssertions?.comparisonTargets || []) {
    const comparisonResult = input.comparisons.find(
      (item) => item.targetRoleFamily === comparison.targetRoleFamily
    );
    if (!comparisonResult) {
      failures.push(`Expected comparison output for ${comparison.targetRoleFamily}, but none was computed.`);
      continue;
    }

    notes.push(
      `Comparison ${comparison.targetRoleFamily}: overall ${comparisonResult.scoring.overallScore}, trajectory ${comparisonResult.scoring.trajectoryStatus}`
    );

    if (comparison.expectedOverallScoreRelationToBase === "greater_or_equal_minus_5") {
      if (comparisonResult.scoring.overallScore < input.scoring.overallScore - 5) {
        failures.push(
          `Expected comparison role ${comparison.targetRoleFamily} to score within 5 points of or above the base score ${input.scoring.overallScore}, but got ${comparisonResult.scoring.overallScore}.`
        );
      }
    }
  }

  return {
    passed: failures.length === 0,
    failures,
    notes,
  };
}

async function runScenario(scenario: SyntheticScenario, options: { keepExisting: boolean }) {
  const identity = syntheticIdentity(scenario.id);

  if (!options.keepExisting) {
    await cleanupScenarioData(identity);
  }

  await ensureSyntheticUser(identity);
  await studentWriteRepo.upsertStudentProfile({
    studentProfileId: identity.studentProfileId,
    userId: identity.userId,
    schoolName: scenario.profile.schoolName,
    expectedGraduationDate: scenario.profile.expectedGraduationDate,
    majorPrimary: scenario.profile.majorPrimary,
    majorSecondary: scenario.profile.majorSecondary || null,
    preferredGeographies: scenario.profile.preferredGeographies || [],
    careerGoalSummary: scenario.profile.careerGoalSummary || null,
  });
  await ensureOnboardingState(identity);
  await onboardingRepo.updateFlags(identity.studentProfileId, {
    profile_completed: true,
  });

  if (scenario.sectorSelection?.sectorClusters?.length) {
    await onboardingRepo.replaceSectorSelections(
      identity.studentProfileId,
      scenario.sectorSelection.sectorClusters
    );
    await onboardingRepo.updateFlags(identity.studentProfileId, {
      sectors_completed: true,
    });
  }

  let catalogAssignmentError: string | null = null;
  if (scenario.catalogAssignment) {
    try {
      await ensureSyntheticCatalogScaffold(scenario);
      await assignStudentCatalog({
        studentProfileId: identity.studentProfileId,
        institutionCanonicalName: scenario.publicBasis.institutionCanonicalName,
        catalogLabel: scenario.catalogAssignment.catalogLabel,
        degreeType: scenario.catalogAssignment.degreeType,
        programName: scenario.catalogAssignment.programName,
        majorCanonicalName: scenario.catalogAssignment.majorCanonicalName,
        minorCanonicalName: scenario.catalogAssignment.minorCanonicalName,
        assignmentSource: "student_selected",
        isPrimary: true,
      });
    } catch (error) {
      catalogAssignmentError = error instanceof Error ? error.message : String(error);
    }
  }

  for (let index = 0; index < (scenario.experiences || []).length; index += 1) {
    const experience = scenario.experiences?.[index];
    if (!experience) continue;
    await studentWriteRepo.createExperience({
      experienceId: stableId("synthetic_experience", `${scenario.id}:${index}:${experience.title}`),
      studentProfileId: identity.studentProfileId,
      title: experience.title,
      organization: experience.organization || null,
      deliverablesSummary: experience.deliverablesSummary || null,
      toolsUsed: experience.toolsUsed || [],
      relevanceRating: experience.relevanceRating ?? null,
    });
  }

  for (let index = 0; index < (scenario.contacts || []).length; index += 1) {
    const contact = scenario.contacts?.[index];
    if (!contact) continue;
    await studentWriteRepo.createContact({
      contactId: stableId("synthetic_contact", `${scenario.id}:${index}:${contact.contactName}`),
      studentProfileId: identity.studentProfileId,
      contactName: contact.contactName,
      relationshipType: contact.relationshipType || null,
      warmthLevel: contact.warmthLevel || null,
      notes: contact.notes || null,
    });
  }

  await seedOutreach(identity.studentProfileId, scenario.id, scenario.outreach);
  await seedDeadlines(identity.studentProfileId, scenario.id, scenario.deadlines);
  await seedArtifacts(identity.studentProfileId, scenario.id, scenario.artifacts);
  const transcriptSeedResult = await seedTranscriptAndCourseCoverage({
    scenario,
    studentProfileId: identity.studentProfileId,
    targetRoleFamily: scenario.publicBasis.targetRoleFamily,
  });

  const scoringInput = await buildStudentScoringInput(identity.studentProfileId, {
    targetRoleFamily: scenario.publicBasis.targetRoleFamily,
    targetSectorCluster: scenario.publicBasis.targetSectorCluster,
  });
  const scoring = runScoring(scoringInput);
  const requirementGraph = await getPrimaryRequirementSetGraphForStudent(identity.studentProfileId);

  const comparisons: Array<{ targetRoleFamily: string; targetSectorCluster?: string; scoring: ScoringOutput }> = [];
  for (const comparison of scenario.expectedAssertions?.scoring?.comparisonTargets || []) {
    const compareInput = await buildStudentScoringInput(identity.studentProfileId, {
      targetRoleFamily: comparison.targetRoleFamily,
      targetSectorCluster: comparison.targetSectorCluster,
    });
    comparisons.push({
      targetRoleFamily: comparison.targetRoleFamily,
      targetSectorCluster: comparison.targetSectorCluster,
      scoring: runScoring(compareInput),
    });
  }

  const assertionResult = evaluateAssertions({
    scenario,
    scoring,
    requirementGraphExists: !!requirementGraph,
    comparisons,
  });

  return {
    scenarioId: scenario.id,
    label: scenario.label,
    studentProfileId: identity.studentProfileId,
    email: identity.email,
    catalogAssignmentError,
    transcriptSeedResult,
    scoringInput,
    scoring,
    requirementGraphExists: !!requirementGraph,
    comparisonResults: comparisons,
    assertions: assertionResult,
  };
}

function printReport(result: Awaited<ReturnType<typeof runScenario>>) {
  const status = result.assertions.passed ? "PASS" : "FAIL";
  console.log(`\n[${status}] ${result.scenarioId} ${result.label}`);
  console.log(`studentProfileId: ${result.studentProfileId}`);
  console.log(`email: ${result.email}`);
  console.log(
    `score: ${result.scoring.overallScore} | trajectory: ${result.scoring.trajectoryStatus} | role: ${result.scoring.targetRoleFamily}`
  );
  console.log(
    `requirementGraph: ${result.requirementGraphExists ? "present" : "missing"} | transcriptSeeded: ${result.transcriptSeedResult.studentTranscriptId ? "yes" : "no"}`
  );
  if (result.catalogAssignmentError) {
    console.log(`catalogAssignmentError: ${result.catalogAssignmentError}`);
  }
  if (result.assertions.notes.length) {
    for (const note of result.assertions.notes) {
      console.log(`note: ${note}`);
    }
  }
  if (result.assertions.failures.length) {
    for (const failure of result.assertions.failures) {
      console.log(`failure: ${failure}`);
    }
  }
}

async function main() {
  const cli = parseArgs(process.argv.slice(2));
  const matrix = loadScenarioMatrix();

  if (cli.listOnly) {
    console.log("Available synthetic scenarios:");
    for (const scenario of matrix.scenarios) {
      console.log(`- ${scenario.id}: ${scenario.label}`);
    }
    return;
  }

  const scenarios = cli.scenarioId
    ? matrix.scenarios.filter((scenario) => scenario.id === cli.scenarioId)
    : matrix.scenarios;

  if (!scenarios.length) {
    throw new Error(`No synthetic scenario found for ${cli.scenarioId}`);
  }

  const results = [];
  for (const scenario of scenarios) {
    const result = await runScenario(scenario, {
      keepExisting: cli.keepExisting,
    });
    results.push(result);
    printReport(result);
  }

  const passed = results.filter((result) => result.assertions.passed).length;
  const failed = results.length - passed;
  console.log(`\nSynthetic scenario summary: ${passed} passed, ${failed} failed, ${results.length} total.`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
