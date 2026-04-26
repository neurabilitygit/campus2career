import type {
  CareerScenarioAnalysisResult,
  CareerScenarioAssumptions,
  CareerScenarioExtractedRequirements,
  CareerScenarioRecord,
} from "../../../../../packages/shared/src/contracts/careerScenario";
import type { StudentScoringInput } from "../../../../../packages/shared/src/scoring/types";

const SKILL_KEYWORDS = [
  "sql",
  "python",
  "excel",
  "tableau",
  "power bi",
  "powerpoint",
  "financial modeling",
  "data analysis",
  "project management",
  "stakeholder communication",
  "communication",
  "presentation",
  "leadership",
  "teamwork",
  "problem solving",
  "research",
  "salesforce",
  "javascript",
  "typescript",
  "react",
  "nursing",
  "patient care",
  "clinical documentation",
];

const TOOL_KEYWORDS = [
  "sql",
  "python",
  "excel",
  "tableau",
  "power bi",
  "salesforce",
  "figma",
  "javascript",
  "typescript",
  "react",
];

const CERTIFICATION_KEYWORDS = ["cpa", "pmp", "aws", "rn", "cfa", "license", "licensed"];
const SOFT_SKILLS = ["communication", "leadership", "teamwork", "problem solving", "adaptability", "organization"];
const DOMAIN_KEYWORDS = ["fintech", "healthcare", "marketing", "finance", "consulting", "analytics", "product"];

function unique(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => !!value)
    )
  );
}

function extractKeywordMatches(text: string, keywords: string[]): string[] {
  const lower = text.toLowerCase();
  return unique(
    keywords.filter((keyword) => {
      if (keyword.includes(" ")) {
        return lower.includes(keyword);
      }
      return new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text);
    })
  );
}

function extractExperienceRequirements(text: string): string[] {
  const matches = Array.from(text.matchAll(/(\d+)\+?\s+years?\s+of\s+([^.\\n]+)/gi));
  return unique(matches.map((match) => `${match[1]}+ years of ${match[2].trim()}`));
}

function extractEducationRequirements(text: string): string[] {
  const requirements: string[] = [];
  if (/bachelor'?s|ba\b|bs\b|undergraduate degree/i.test(text)) {
    requirements.push("Bachelor's degree or equivalent undergraduate preparation");
  }
  if (/master'?s|mba\b|graduate degree/i.test(text)) {
    requirements.push("Graduate degree preferred or required");
  }
  if (/nursing degree|bsn/i.test(text)) {
    requirements.push("Nursing degree or BSN-aligned academic path");
  }
  return unique(requirements);
}

export function extractJobDescriptionRequirements(input: {
  jobDescriptionText?: string | null;
  targetRole?: string | null;
  targetProfession?: string | null;
  targetSector?: string | null;
}): CareerScenarioExtractedRequirements {
  const text = [input.targetRole, input.targetProfession, input.targetSector, input.jobDescriptionText]
    .filter(Boolean)
    .join("\n");

  const requirementHighlights = unique(
    (input.jobDescriptionText || "")
      .split(/\n+/)
      .map((line) => line.replace(/^[\-\*\u2022]\s*/, "").trim())
      .filter((line) => line.length >= 12 && line.length <= 180)
      .slice(0, 8)
  );

  return {
    roleTitle: input.targetRole || input.targetProfession || null,
    requiredSkills: extractKeywordMatches(text, SKILL_KEYWORDS),
    preferredSkills: extractKeywordMatches(text, ["internship", "mentorship", "client-facing", "analysis", "documentation"]),
    educationRequirements: extractEducationRequirements(text),
    experienceRequirements: extractExperienceRequirements(text),
    certifications: extractKeywordMatches(text, CERTIFICATION_KEYWORDS),
    toolsAndTechnologies: extractKeywordMatches(text, TOOL_KEYWORDS),
    softSkills: extractKeywordMatches(text, SOFT_SKILLS),
    domainKnowledge: extractKeywordMatches(text, DOMAIN_KEYWORDS),
    requirementHighlights,
    extractionNotes: text
      ? ["Requirements were extracted with deterministic keyword and pattern matching."]
      : ["No job description text was available, so extracted requirements rely on the scenario fields only."],
  };
}

function buildEvidenceCorpus(scoringInput: StudentScoringInput): string {
  return [
    scoringInput.targetRoleFamily,
    ...(scoringInput.preferredGeographies || []),
    ...(scoringInput.courseCoverage || []).map((item) => item.skillName),
    ...(scoringInput.experiences || []).flatMap((item) => [item.title, ...(item.toolsUsed || []), item.deliverablesSummary || ""]),
    ...(scoringInput.artifacts || []).flatMap((item) => [item.extractedSummary || "", ...(item.tags || [])]),
    scoringInput.requirementProgress?.majorDisplayName || "",
    scoringInput.requirementProgress?.programName || "",
  ]
    .join(" ")
    .toLowerCase();
}

export function buildScenarioStatusAfterAnalysis(args: { isActive: boolean; hadErrors?: boolean }): "active" | "complete" | "error" {
  if (args.hadErrors) return "error";
  return args.isActive ? "active" : "complete";
}

export function markScenarioNeedsRerun(status: string): string {
  return status === "active" || status === "complete" ? "needs_rerun" : status;
}

export function analyzeCareerScenario(input: {
  scenario: CareerScenarioRecord;
  extractedRequirements: CareerScenarioExtractedRequirements;
  scoringInput: StudentScoringInput;
  scoring: {
    overallScore: number;
    trajectoryStatus: string;
    topStrengths: string[];
    topRisks: string[];
    recommendations: Array<{ title: string; description?: string }>;
    evidenceQuality?: {
      confidenceLabel?: string;
      missingEvidence?: string[];
      weakEvidence?: string[];
      recommendedEvidenceActions?: string[];
    };
  };
}): CareerScenarioAnalysisResult {
  const targetLabel =
    input.scenario.targetRole ||
    input.scenario.targetProfession ||
    input.extractedRequirements.roleTitle ||
    input.scenario.scenarioName;
  const evidenceCorpus = buildEvidenceCorpus(input.scoringInput);
  const matchedStrengths = unique([
    ...input.scoring.topStrengths,
    ...input.extractedRequirements.requiredSkills.filter((skill) => evidenceCorpus.includes(skill.toLowerCase())),
    ...input.extractedRequirements.toolsAndTechnologies.filter((tool) => evidenceCorpus.includes(tool.toLowerCase())),
  ]).slice(0, 6);

  const likelyGaps = unique([
    ...input.scoring.topRisks,
    ...input.extractedRequirements.requiredSkills.filter((skill) => !evidenceCorpus.includes(skill.toLowerCase())),
    ...input.extractedRequirements.certifications.filter((item) => !evidenceCorpus.includes(item.toLowerCase())),
  ]).slice(0, 6);

  const missingEvidence = unique([
    ...(input.scoring.evidenceQuality?.missingEvidence || []),
    ...input.extractedRequirements.experienceRequirements,
  ]).slice(0, 6);

  const academicImplications = unique([
    input.scoringInput.requirementProgress?.majorDisplayName
      ? `Current academic path is ${input.scoringInput.requirementProgress.majorDisplayName}.`
      : null,
    input.extractedRequirements.educationRequirements[0]
      ? `The scenario expects ${input.extractedRequirements.educationRequirements[0].toLowerCase()}.`
      : null,
  ]);

  const curriculumImplications = unique([
    input.scoringInput.requirementProgress?.curriculumVerificationStatus !== "verified"
      ? "Curriculum verification is incomplete, so academic fit for this scenario should be treated cautiously."
      : null,
    input.scoringInput.requirementProgress?.missingRequiredCourses?.[0]
      ? `Structured degree progress still shows missing requirement examples such as ${input.scoringInput.requirementProgress.missingRequiredCourses[0]}.`
      : null,
  ]);

  const skillsImplications = unique([
    ...input.extractedRequirements.requiredSkills.slice(0, 3).map((skill) =>
      matchedStrengths.includes(skill)
        ? `${skill} already has some supporting evidence in the current record.`
        : `${skill} is a likely gap to close for this scenario.`
    ),
  ]);

  const experienceImplications = unique([
    input.extractedRequirements.experienceRequirements[0]
      ? `The pasted role asks for ${input.extractedRequirements.experienceRequirements[0].toLowerCase()}.`
      : null,
    !input.scoringInput.experiences.length
      ? "Experience evidence is currently thin, so internships, projects, or volunteer work may matter more for this scenario."
      : null,
  ]);

  const warnings = unique([
    input.scoringInput.requirementProgress?.curriculumVerificationStatus !== "verified"
      ? "Curriculum verification is still incomplete, which lowers confidence in scenario readiness."
      : null,
    input.scoring.evidenceQuality?.weakEvidence?.[0] || null,
    input.extractedRequirements.extractionNotes[0] || null,
  ]);

  const qualificationLabel =
    input.scoring.overallScore >= 75 ? "strong" : input.scoring.overallScore >= 55 ? "developing" : "early";

  const scenarioSpecificActions = unique([
    likelyGaps[0] ? `For ${targetLabel}, build visible evidence in ${likelyGaps[0]}.` : null,
    missingEvidence[0]
      ? `Close the evidence gap for ${targetLabel} by documenting ${missingEvidence[0].replace(/\.$/, "")}.`
      : null,
    input.scoringInput.requirementProgress?.curriculumVerificationStatus !== "verified"
      ? `Verify degree requirements before relying on ${targetLabel} readiness as a confirmed read.`
      : null,
    !input.scoringInput.experiences.length
      ? `Add at least one project, internship, or outcome entry that maps directly to ${targetLabel}.`
      : null,
    input.extractedRequirements.requiredSkills[0] && !matchedStrengths.includes(input.extractedRequirements.requiredSkills[0])
      ? `Use the next term to build proof of ${input.extractedRequirements.requiredSkills[0]} for ${targetLabel}.`
      : null,
  ]).slice(0, 5);

  const assumptionsUsed = unique([
    input.scenario.targetRole || input.scenario.targetProfession,
    input.scenario.targetSector,
    input.scenario.targetGeography,
    ...(input.scenario.assumptions.preferredGeographies || []),
    input.scenario.assumptions.graduationTimeline,
  ]);

  return {
    analysisMode: "rule_based",
    confidenceLabel:
      (input.scoring.evidenceQuality?.confidenceLabel as "low" | "medium" | "high" | undefined) ||
      (warnings.length ? "medium" : "high"),
    summary: `${input.scenario.scenarioName} currently scores ${input.scoring.overallScore}/100 for ${input.scoring.trajectoryStatus.replace(/_/g, " ")} readiness under the selected assumptions.`,
    qualificationLabel,
    matchedStrengths,
    likelyGaps,
    missingEvidence,
    scenarioSpecificActions,
    recommendedActions: unique([
      ...scenarioSpecificActions,
      ...(input.scoring.recommendations || []).map((item) => item.title),
      ...(input.scoring.evidenceQuality?.recommendedEvidenceActions || []),
    ]).slice(0, 6),
    academicImplications,
    skillsImplications,
    experienceImplications,
    curriculumImplications,
    warnings,
    assumptionsUsed,
  };
}

export function mergeScenarioAssumptions(input: {
  scenario: CareerScenarioRecord;
  fallbackPreferredGeographies?: string[];
}): CareerScenarioAssumptions {
  return {
    ...input.scenario.assumptions,
    targetRole: input.scenario.targetRole,
    targetProfession: input.scenario.targetProfession,
    targetIndustry: input.scenario.targetIndustry,
    targetSector: input.scenario.targetSector,
    targetGeography: input.scenario.targetGeography,
    employerName: input.scenario.employerName,
    jobPostingUrl: input.scenario.jobPostingUrl,
    notes: input.scenario.notes,
    preferredGeographies:
      input.scenario.assumptions.preferredGeographies?.length
        ? input.scenario.assumptions.preferredGeographies
        : input.scenario.targetGeography
          ? [input.scenario.targetGeography]
          : input.fallbackPreferredGeographies || [],
  };
}
