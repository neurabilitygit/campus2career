import type { ConfidenceLabel } from "./truth";
import type { RecommendationItem, ScoringOutput } from "../scoring/types";

export type CareerScenarioStatus = "draft" | "active" | "needs_rerun" | "complete" | "error" | "archived";
export type CareerScenarioSourceType = "pasted_job_description" | "manual_target" | "imported" | "mixed";
export type CareerScenarioAnalysisMode = "rule_based";
export type CareerScenarioActionItemSourceKind = "scenario_specific" | "recommendation" | "evidence_gap";
export type CareerScenarioActionItemPriority = "high" | "medium" | "low";
export type CareerScenarioActionItemStatus = "active" | "completed" | "dismissed";

export interface CareerScenarioAssumptions {
  targetRole?: string | null;
  targetProfession?: string | null;
  targetIndustry?: string | null;
  targetSector?: string | null;
  targetGeography?: string | null;
  employerName?: string | null;
  jobPostingUrl?: string | null;
  skills?: string[];
  credentials?: string[];
  internships?: string[];
  projects?: string[];
  majorMinorConcentrationAssumptions?: string[];
  graduationTimeline?: string | null;
  preferredGeographies?: string[];
  notes?: string | null;
}

export interface CareerScenarioExtractedRequirements {
  roleTitle?: string | null;
  requiredSkills: string[];
  preferredSkills: string[];
  educationRequirements: string[];
  experienceRequirements: string[];
  certifications: string[];
  toolsAndTechnologies: string[];
  softSkills: string[];
  domainKnowledge: string[];
  requirementHighlights: string[];
  extractionNotes: string[];
}

export interface CareerScenarioAnalysisResult {
  analysisMode: CareerScenarioAnalysisMode;
  confidenceLabel: ConfidenceLabel;
  summary: string;
  qualificationLabel: "strong" | "developing" | "early";
  matchedStrengths: string[];
  likelyGaps: string[];
  missingEvidence: string[];
  scenarioSpecificActions: string[];
  recommendedActions: string[];
  academicImplications: string[];
  skillsImplications: string[];
  experienceImplications: string[];
  curriculumImplications: string[];
  warnings: string[];
  assumptionsUsed: string[];
}

export interface CareerScenarioActionItemRecord {
  careerScenarioActionItemId: string;
  careerScenarioId: string;
  studentProfileId: string;
  title: string;
  description?: string | null;
  rationale?: string | null;
  actionCategory?: string | null;
  priority: CareerScenarioActionItemPriority;
  timeframe?: string | null;
  sourceKind: CareerScenarioActionItemSourceKind;
  status: CareerScenarioActionItemStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CareerScenarioRecord {
  careerScenarioId: string;
  studentProfileId: string;
  linkedJobTargetId?: string | null;
  scenarioName: string;
  status: CareerScenarioStatus;
  isActive: boolean;
  jobDescriptionText?: string | null;
  targetRole?: string | null;
  targetProfession?: string | null;
  targetIndustry?: string | null;
  targetSector?: string | null;
  targetGeography?: string | null;
  employerName?: string | null;
  jobPostingUrl?: string | null;
  notes?: string | null;
  assumptions: CareerScenarioAssumptions;
  extractedRequirements?: CareerScenarioExtractedRequirements | null;
  analysisResult?: CareerScenarioAnalysisResult | null;
  readinessScoreSnapshot?: ScoringOutput | null;
  recommendationsSnapshot?: RecommendationItem[] | null;
  actionItems?: CareerScenarioActionItemRecord[];
  sourceType: CareerScenarioSourceType;
  createdByUserId?: string | null;
  updatedByUserId?: string | null;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string | null;
  deletedAt?: string | null;
}

export interface CareerScenarioSummary {
  careerScenarioId: string;
  scenarioName: string;
  status: CareerScenarioStatus;
  isActive: boolean;
  targetRole?: string | null;
  targetProfession?: string | null;
  employerName?: string | null;
  sourceType: CareerScenarioSourceType;
  lastRunAt?: string | null;
  updatedAt: string;
}

export interface CareerScenarioUpsertInput {
  scenarioName: string;
  status?: CareerScenarioStatus;
  isActive?: boolean;
  jobDescriptionText?: string | null;
  targetRole?: string | null;
  targetProfession?: string | null;
  targetIndustry?: string | null;
  targetSector?: string | null;
  targetGeography?: string | null;
  employerName?: string | null;
  jobPostingUrl?: string | null;
  notes?: string | null;
  assumptions?: CareerScenarioAssumptions;
  sourceType?: CareerScenarioSourceType;
}
