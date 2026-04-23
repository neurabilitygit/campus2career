import type { RequirementSetProvenanceMethod } from "../contracts/academic";
import type {
  ConfidenceLabel,
  EvidenceTruthSummary,
  TruthStatus,
} from "../contracts/truth";

export type TrajectoryStatus = "on_track" | "watch" | "at_risk";
export type GapSeverity = "low" | "medium" | "high";
export type ProficiencyBand = "none" | "basic" | "intermediate" | "advanced";
export type EvidenceLevel = "strong" | "moderate" | "thin" | "missing";
export type AssessmentMode = "measured" | "provisional";

export interface OccupationSkillRequirement {
  skillName: string;
  skillCategory:
    | "technical"
    | "analytical"
    | "communication"
    | "operational"
    | "interpersonal"
    | "creative"
    | "managerial"
    | "ai_fluency";
  importanceScore: number; // 0-100
  requiredProficiencyBand: Exclude<ProficiencyBand, "none">;
}

export interface CourseSkillCoverage {
  courseId: string;
  skillName: string;
  coverageStrength: "low" | "medium" | "high";
  confidenceScore: number; // 0-1
}

export interface ExperienceEvidence {
  experienceId: string;
  title: string;
  toolsUsed?: string[];
  deliverablesSummary?: string;
  relevanceRating?: number; // 1-5
}

export interface ArtifactEvidence {
  artifactId: string;
  artifactType: string;
  extractedSummary?: string;
  tags?: string[];
  sourceLabel?: string;
  parseTruthStatus?: TruthStatus | null;
  parseConfidenceLabel?: ConfidenceLabel | null;
  extractionMethod?: string | null;
  parseNotes?: string | null;
}

export interface ContactEvidence {
  contactId: string;
  warmthLevel?: "cold" | "warm" | "strong";
  relationshipType?: string;
}

export interface OutreachEvidence {
  interactionId: string;
  interactionType: string;
  outcome?: string;
}

export interface DeadlineEvidence {
  deadlineType: string;
  dueDate: string;
  completed?: boolean;
}

export interface StudentSignals {
  currentAcademicYear?: "freshman" | "sophomore" | "junior" | "senior" | "other";
  hasInternshipByJuniorYear: boolean;
  hasIndependentProjectBySeniorYear: boolean;
  hasFirstOrSecondDegreeProfessionalNetwork: boolean;
  hasCarefullyCultivatedMentors: boolean;
  aiToolComfortLevel?: "low" | "medium" | "high";
  repeatedDeadlineMisses?: number;
}

export interface OccupationMetadata {
  onetCode?: string;
  jobZone?: number;
  description?: string;
}

export interface MarketSignalEvidence {
  signalType:
    | "wage"
    | "demand_growth"
    | "unemployment_pressure"
    | "openings_trend"
    | "internship_availability"
    | "ai_disruption_signal"
    | "hiring_slowdown";
  signalValue?: number;
  signalDirection?: "rising" | "falling" | "stable";
  sourceName: string;
  effectiveDate: string;
  confidenceLevel?: "low" | "medium" | "high";
  scope: "role" | "macro";
}

export interface TranscriptEvidenceSummary {
  parsedStatus?: "pending" | "parsed" | "matched" | "review_required" | "failed";
  transcriptSummary?: string;
  termCount: number;
  courseCount: number;
  completedCourseCount: number;
  matchedCatalogCourseCount: number;
  unmatchedCourseCount: number;
  creditsEarned: number;
  truthStatus: TruthStatus;
  extractionMethod?: "plain_text" | "json_text" | "pdf_text" | null;
  extractionConfidenceLabel?: ConfidenceLabel | null;
  institutionResolutionTruthStatus?: TruthStatus | null;
  institutionResolutionNote?: string | null;
}

export interface RequirementProgressSummary {
  boundToCatalog: boolean;
  institutionDisplayName?: string;
  catalogLabel?: string;
  degreeType?: string;
  programName?: string;
  majorDisplayName?: string;
  requirementSetDisplayName?: string;
  provenanceMethod?: RequirementSetProvenanceMethod | null;
  sourceUrl?: string | null;
  sourceNote?: string | null;
  totalRequirementItems: number;
  satisfiedRequirementItems: number;
  totalRequirementGroups: number;
  satisfiedRequirementGroups: number;
  creditsApplied: number;
  totalCreditsRequired?: number;
  completionPercent: number;
  missingRequiredCourses: string[];
  inferredConfidence: "low" | "medium" | "high";
  truthStatus: TruthStatus;
  manualRequirementItemCount: number;
  nonCourseRequirementItemCount: number;
  excludedRequirementGroupCount: number;
  coverageNotes?: string[];
}

export interface TargetResolutionSummary {
  truthStatus: TruthStatus;
  confidenceLabel: ConfidenceLabel;
  resolutionKind:
    | "user_override"
    | "normalized_job_target"
    | "selected_sector_mapping"
    | "defaulted_sector_from_role_seed"
    | "unresolved";
  sourceLabel: string;
  note?: string | null;
  sourceJobTargetId?: string | null;
}

export interface StudentScoringInput {
  studentId: string;
  targetRoleFamily: string;
  targetSectorCluster: string;
  targetResolution?: TargetResolutionSummary;
  preferredGeographies?: string[];
  occupationMetadata?: OccupationMetadata;
  occupationSkillTruth?: EvidenceTruthSummary;
  marketSignalTruth?: EvidenceTruthSummary;
  dataQualityNotes?: string[];
  occupationSkills: OccupationSkillRequirement[];
  marketSignals?: MarketSignalEvidence[];
  transcript?: TranscriptEvidenceSummary;
  requirementProgress?: RequirementProgressSummary;
  courseCoverage: CourseSkillCoverage[];
  experiences: ExperienceEvidence[];
  artifacts: ArtifactEvidence[];
  contacts: ContactEvidence[];
  outreach: OutreachEvidence[];
  deadlines?: DeadlineEvidence[];
  signals: StudentSignals;
}

export interface SkillGapItem {
  skillName: string;
  requiredLevel: Exclude<ProficiencyBand, "none">;
  estimatedCurrentLevel: ProficiencyBand;
  gapSeverity: GapSeverity;
  evidenceSummary: string;
  recommendationPriority: 1 | 2 | 3 | 4 | 5;
}

export interface RecommendationItem {
  recommendationType:
    | "course"
    | "project"
    | "internship"
    | "research"
    | "volunteer"
    | "certification"
    | "networking"
    | "ai_project"
    | "portfolio_piece";
  title: string;
  description: string;
  effortLevel: "low" | "medium" | "high";
  estimatedSignalStrength: "low" | "medium" | "high";
  whyThisMatchesStudent: string;
  linkedSkillName?: string;
}

export interface SubScores {
  roleAlignment: number;
  marketDemand: number;
  academicReadiness: number;
  experienceStrength: number;
  proofOfWorkStrength: number;
  networkStrength: number;
  executionMomentum: number;
}

export interface HeuristicFlag {
  code: string;
  severity: "info" | "warning" | "critical";
  title: string;
  explanation: string;
  recommendedActions: string[];
}

export interface SubScoreEvidenceDetail {
  score: number;
  status: "strong" | "developing" | "weak";
  evidenceLevel: EvidenceLevel;
  confidenceLabel: ConfidenceLabel;
  interpretation: string;
  knownSignals: string[];
  missingSignals: string[];
}

export interface ScoringEvidenceQuality {
  overallEvidenceLevel: EvidenceLevel;
  confidenceLabel: ConfidenceLabel;
  assessmentMode: AssessmentMode;
  knownEvidence: string[];
  weakEvidence: string[];
  missingEvidence: string[];
  provisionalReasons: string[];
}

export interface ScoringOutput {
  studentId: string;
  targetRoleFamily: string;
  targetSectorCluster: string;
  trajectoryStatus: TrajectoryStatus;
  overallScore: number;
  subScores: SubScores;
  subScoreDetails: Record<keyof SubScores, SubScoreEvidenceDetail>;
  evidenceQuality: ScoringEvidenceQuality;
  topStrengths: string[];
  topRisks: string[];
  heuristicFlags: HeuristicFlag[];
  skillGaps: SkillGapItem[];
  recommendations: RecommendationItem[];
}
