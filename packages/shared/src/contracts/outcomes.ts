export const outcomeTypes = [
  "internship_application",
  "interview",
  "offer",
  "accepted_role",
] as const;

export type OutcomeType = (typeof outcomeTypes)[number];

export const outcomeStatuses = [
  "not_started",
  "in_progress",
  "applied",
  "interviewing",
  "offer",
  "accepted",
] as const;

export type OutcomeStatus = (typeof outcomeStatuses)[number];

export const outcomeReporterRoles = ["student", "parent", "coach", "admin"] as const;
export type OutcomeReporterRole = (typeof outcomeReporterRoles)[number];

export const outcomeSourceTypes = [
  "student_report",
  "parent_report",
  "coach_report",
  "admin_report",
] as const;

export type OutcomeSourceType = (typeof outcomeSourceTypes)[number];

export const outcomeVerificationStatuses = [
  "self_reported",
  "coach_reviewed",
  "parent_reported",
  "verified",
  "disputed",
] as const;

export type OutcomeVerificationStatus = (typeof outcomeVerificationStatuses)[number];

export const outcomeActionDateLabels = [
  "applied_date",
  "interview_date",
  "offer_date",
  "accepted_date",
] as const;

export type OutcomeActionDateLabel = (typeof outcomeActionDateLabels)[number];

export interface StudentOutcomeRecord {
  studentOutcomeId: string;
  studentProfileId: string;
  householdId: string | null;
  jobTargetId: string | null;
  targetRoleFamily: string | null;
  targetSectorCluster: string | null;
  outcomeType: OutcomeType;
  status: OutcomeStatus;
  employerName: string | null;
  roleTitle: string | null;
  sourceType: OutcomeSourceType;
  reportedByUserId: string | null;
  reportedByRole: OutcomeReporterRole;
  verificationStatus: OutcomeVerificationStatus;
  actionDate: string;
  actionDateLabel: OutcomeActionDateLabel;
  notes: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudentOutcomeCreateInput {
  jobTargetId?: string | null;
  targetRoleFamily?: string | null;
  targetSectorCluster?: string | null;
  outcomeType: OutcomeType;
  status: OutcomeStatus;
  employerName?: string | null;
  roleTitle?: string | null;
  actionDate: string;
  actionDateLabel?: OutcomeActionDateLabel | null;
  notes?: string | null;
}

export interface StudentOutcomeUpdateInput extends StudentOutcomeCreateInput {
  studentOutcomeId: string;
}

export interface StudentOutcomeArchiveInput {
  studentOutcomeId: string;
}

export interface StudentOutcomeSummary {
  totalActive: number;
  countsByType: Record<OutcomeType, number>;
  countsByVerification: Record<OutcomeVerificationStatus, number>;
  countsByStatus: Record<OutcomeStatus, number>;
  latestActionDate: string | null;
  hasOutcomeData: boolean;
}
