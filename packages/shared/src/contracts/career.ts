import type { ConfidenceLabel, TruthStatus } from "./truth";

export type JobTargetSourceType = "manual" | "job_posting" | "partner_feed";

export interface JobTargetNormalizationResult {
  normalizedRoleFamily?: string | null;
  normalizedSectorCluster?: string | null;
  onetCode?: string | null;
  normalizationConfidence?: number | null;
  confidenceLabel?: ConfidenceLabel;
  normalizationReasoning?: string | null;
  topRequiredSkills?: string[];
  source: "deterministic" | "llm";
  truthStatus: TruthStatus;
}

export interface StudentJobTargetInput {
  studentProfileId: string;
  title: string;
  employer?: string;
  location?: string;
  sourceType: JobTargetSourceType;
  sourceUrl?: string;
  jobDescriptionText?: string;
  isPrimary?: boolean;
}

export interface StudentJobTargetRecord {
  jobTargetId: string;
  studentProfileId: string;
  title: string;
  employer?: string | null;
  location?: string | null;
  sourceType: JobTargetSourceType;
  sourceUrl?: string | null;
  jobDescriptionText?: string | null;
  normalizedRoleFamily?: string | null;
  normalizedSectorCluster?: string | null;
  onetCode?: string | null;
  normalizationConfidence?: number | null;
  normalizationConfidenceLabel?: ConfidenceLabel | null;
  normalizationReasoning?: string | null;
  normalizationSource?: "deterministic" | "llm" | null;
  normalizationTruthStatus?: TruthStatus | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}
