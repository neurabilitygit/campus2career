import type { ConfidenceLabel, TruthStatus } from "./truth";

export type RequirementSetProvenanceMethod =
  | "direct_scrape"
  | "artifact_pdf"
  | "manual"
  | "llm_assisted"
  | "synthetic_seed";

export interface InstitutionInput {
  canonicalName: string;
  displayName: string;
  countryCode?: string;
  stateRegion?: string;
  city?: string;
  websiteUrl?: string;
}

export interface AcademicCatalogInput {
  institutionCanonicalName: string;
  catalogLabel: string;
  startYear: number;
  endYear: number;
  sourceUrl?: string;
  sourceFormat?: "html" | "pdf" | "api" | "manual";
  extractionStatus?: "draft" | "parsed" | "reviewed" | "published" | "deprecated";
}

export interface DegreeProgramInput {
  institutionCanonicalName: string;
  catalogLabel: string;
  degreeType: string;
  programName: string;
  schoolName?: string;
  totalCreditsRequired?: number;
  residencyCreditsRequired?: number;
  minimumGpaRequired?: number;
}

export interface MajorInput {
  institutionCanonicalName: string;
  catalogLabel: string;
  degreeType: string;
  programName: string;
  canonicalName: string;
  displayName: string;
  cipCode?: string;
  departmentName?: string;
}

export interface CatalogCourseInput {
  institutionCanonicalName: string;
  catalogLabel: string;
  courseCode: string;
  courseTitle: string;
  department?: string;
  creditsMin?: number;
  creditsMax?: number;
  description?: string;
  levelHint?: "introductory" | "intermediate" | "advanced" | "graduate" | "mixed";
}

export interface CatalogCourseAliasInput {
  aliasCode?: string;
  aliasTitle?: string;
  sourceType: "catalog" | "transfer-guide" | "manual" | "transcript-observed";
}

export interface CoursePrerequisiteInput {
  prerequisiteCourseCode?: string;
  prerequisiteCourseTitle?: string;
  logicGroup?: string;
  relationshipType: "prerequisite" | "corequisite" | "recommended";
}

export interface RequirementSetInput {
  institutionCanonicalName: string;
  catalogLabel: string;
  degreeType: string;
  programName: string;
  setType: "major" | "minor" | "concentration" | "degree_core" | "general_education";
  displayName: string;
  totalCreditsRequired?: number;
  majorCanonicalName?: string;
  minorCanonicalName?: string;
  provenanceMethod?: RequirementSetProvenanceMethod;
  sourceUrl?: string;
  sourceNote?: string;
}

export interface RequirementGroupInput {
  groupName: string;
  groupType: "all_of" | "choose_n" | "credits_bucket" | "one_of" | "capstone" | "gpa_rule";
  minCoursesRequired?: number;
  minCreditsRequired?: number;
  displayOrder?: number;
  notes?: string;
}

export interface RequirementItemInput {
  itemLabel?: string;
  itemType: "course" | "course_pattern" | "free_elective" | "department_elective" | "manual_rule";
  courseCode?: string;
  coursePrefix?: string;
  minLevel?: number;
  creditsIfUsed?: number;
  displayOrder?: number;
}

export interface StudentCatalogAssignmentInput {
  studentProfileId: string;
  institutionCanonicalName: string;
  catalogLabel: string;
  degreeType?: string;
  programName?: string;
  majorCanonicalName?: string;
  minorCanonicalName?: string;
  concentrationCanonicalName?: string;
  assignmentSource: "student_selected" | "transcript_inferred" | "advisor_confirmed" | "system_inferred";
  assignmentConfidenceLabel?: ConfidenceLabel;
  assignmentNote?: string;
  isPrimary?: boolean;
}

export interface TranscriptCourseInput {
  rawCourseCode?: string;
  rawCourseTitle: string;
  creditsAttempted?: number;
  creditsEarned?: number;
  grade?: string;
  completionStatus: "completed" | "in_progress" | "withdrawn" | "transfer" | "ap_ib" | "failed" | "repeated";
  rawTextExcerpt?: string;
}

export interface TranscriptTermInput {
  termLabel: string;
  termStartDate?: string;
  termEndDate?: string;
  displayOrder?: number;
  courses: TranscriptCourseInput[];
}

export interface StudentTranscriptInput {
  studentProfileId: string;
  academicArtifactId?: string;
  institutionCanonicalName?: string;
  transcriptSummary?: string;
  parsedStatus?: "pending" | "parsed" | "matched" | "review_required" | "failed";
  extractionMethod?: "plain_text" | "json_text" | "pdf_text";
  extractionConfidenceLabel?: ConfidenceLabel;
  institutionResolutionTruthStatus?: TruthStatus;
  institutionResolutionNote?: string;
  terms: TranscriptTermInput[];
}

export interface TranscriptCourseGraphNode {
  transcriptCourseId: string;
  rawCourseCode?: string | null;
  rawCourseTitle: string;
  creditsAttempted?: number | null;
  creditsEarned?: number | null;
  grade?: string | null;
  completionStatus: TranscriptCourseInput["completionStatus"];
  rawTextExcerpt?: string | null;
  match?: {
    transcriptCourseMatchId: string;
    catalogCourseId?: string | null;
    matchStatus: "exact" | "fuzzy" | "manual" | "unmatched";
    confidenceScore?: number | null;
    reviewerNote?: string | null;
  };
}

export interface TranscriptTermGraphNode {
  transcriptTermId: string;
  termLabel: string;
  termStartDate?: string | null;
  termEndDate?: string | null;
  displayOrder?: number | null;
  courses: TranscriptCourseGraphNode[];
}

export interface StudentTranscriptGraph {
  studentTranscriptId: string;
  studentProfileId: string;
  academicArtifactId?: string | null;
  institutionId?: string | null;
  parsedStatus: "pending" | "parsed" | "matched" | "review_required" | "failed";
  transcriptSummary?: string | null;
  extractionMethod?: "plain_text" | "json_text" | "pdf_text" | null;
  extractionConfidenceLabel?: ConfidenceLabel | null;
  institutionResolutionTruthStatus?: TruthStatus | null;
  institutionResolutionNote?: string | null;
  terms: TranscriptTermGraphNode[];
}

export interface RequirementItemGraphNode {
  requirementItemId: string;
  itemLabel?: string | null;
  itemType: RequirementItemInput["itemType"];
  catalogCourseId?: string | null;
  courseCode?: string | null;
  coursePrefix?: string | null;
  minLevel?: number | null;
  creditsIfUsed?: number | null;
  displayOrder?: number | null;
}

export interface RequirementGroupGraphNode {
  requirementGroupId: string;
  groupName: string;
  groupType: RequirementGroupInput["groupType"];
  minCoursesRequired?: number | null;
  minCreditsRequired?: number | null;
  displayOrder?: number | null;
  notes?: string | null;
  items: RequirementItemGraphNode[];
}

export interface RequirementSetGraph {
  requirementSetId: string;
  setType: RequirementSetInput["setType"];
  displayName: string;
  totalCreditsRequired?: number | null;
  provenanceMethod?: RequirementSetProvenanceMethod | null;
  sourceUrl?: string | null;
  sourceNote?: string | null;
  groups: RequirementGroupGraphNode[];
}
