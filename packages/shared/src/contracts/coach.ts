export type CoachRelationshipStatus = "pending" | "active" | "paused" | "ended";

export type CoachRecordVisibility =
  | "coach_private"
  | "student_visible"
  | "parent_visible"
  | "student_and_parent_visible"
  | "internal_system_context";

export interface CoachPermissionSet {
  viewStudentProfile: boolean;
  viewEvidence: boolean;
  createNotes: boolean;
  createRecommendations: boolean;
  createActionItems: boolean;
  sendCommunications: boolean;
  viewParentFacingSummaries: boolean;
}

export interface CoachStudentRelationshipRecord {
  coachStudentRelationshipId: string;
  coachUserId: string;
  coachDisplayName?: string | null;
  studentProfileId: string;
  studentDisplayName: string;
  householdId: string | null;
  relationshipStatus: CoachRelationshipStatus;
  startDate: string | null;
  endDate: string | null;
  nextReviewDate: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  permissions: CoachPermissionSet;
}

export type CoachNoteType =
  | "session_note"
  | "observation"
  | "risk_note"
  | "strength_note"
  | "parent_context_note"
  | "follow_up_note"
  | "other";

export interface CoachNoteRecord {
  coachNoteId: string;
  coachUserId: string;
  coachDisplayName?: string | null;
  studentProfileId: string;
  householdId: string | null;
  noteType: CoachNoteType;
  title: string;
  body: string;
  tags: string[];
  visibility: CoachRecordVisibility;
  sessionDate: string | null;
  linkedEvidenceIds: string[];
  linkedActionItemIds: string[];
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export type CoachFindingCategory =
  | "academic_gap"
  | "career_direction"
  | "execution_risk"
  | "communication_issue"
  | "motivation_or_confidence"
  | "experience_gap"
  | "network_gap"
  | "application_strategy"
  | "strength"
  | "other";

export type CoachFindingSeverity = "low" | "medium" | "high" | "urgent";

export interface CoachFindingRecord {
  coachFindingId: string;
  coachUserId: string;
  coachDisplayName?: string | null;
  studentProfileId: string;
  householdId: string | null;
  title: string;
  findingCategory: CoachFindingCategory;
  severity: CoachFindingSeverity;
  evidenceBasis: string | null;
  explanation: string;
  visibility: CoachRecordVisibility;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export type CoachRecommendationCategory =
  | "academic"
  | "career_target"
  | "resume"
  | "internship_search"
  | "networking"
  | "interview_prep"
  | "project_or_portfolio"
  | "communication"
  | "outcome_tracking"
  | "other";

export type CoachRecommendationPriority = "low" | "medium" | "high" | "urgent";

export type CoachRecommendationStatus =
  | "draft"
  | "active"
  | "accepted"
  | "declined"
  | "completed"
  | "archived";

export interface CoachRecommendationRecord {
  coachRecommendationId: string;
  coachUserId: string;
  coachDisplayName?: string | null;
  studentProfileId: string;
  householdId: string | null;
  title: string;
  recommendationCategory: CoachRecommendationCategory;
  rationale: string;
  recommendedNextStep: string;
  expectedBenefit: string | null;
  priority: CoachRecommendationPriority;
  dueDate: string | null;
  visibility: CoachRecordVisibility;
  status: CoachRecommendationStatus;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export type CoachActionItemStatus =
  | "not_started"
  | "in_progress"
  | "blocked"
  | "completed"
  | "deferred"
  | "archived";

export type CoachActionItemPriority = "low" | "medium" | "high" | "urgent";

export type CoachActionItemAssignee = "student" | "parent" | "coach" | "shared";

export interface CoachActionItemRecord {
  coachActionItemId: string;
  coachUserId: string;
  coachDisplayName?: string | null;
  coachRecommendationId: string | null;
  studentProfileId: string;
  householdId: string | null;
  title: string;
  description: string | null;
  priority: CoachActionItemPriority;
  dueDate: string | null;
  status: CoachActionItemStatus;
  assignedTo: CoachActionItemAssignee;
  visibleToStudent: boolean;
  visibleToParent: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export type CoachFlagType =
  | "missing_evidence"
  | "academic_risk"
  | "application_stall"
  | "communication_breakdown"
  | "missed_deadline"
  | "no_outcome_activity"
  | "high_parent_concern"
  | "coach_attention_needed"
  | "other";

export type CoachFlagSeverity = "info" | "warning" | "high" | "urgent";

export type CoachFlagStatus = "open" | "acknowledged" | "resolved" | "archived";

export interface CoachFlagRecord {
  coachFlagId: string;
  studentProfileId: string;
  householdId: string | null;
  createdByUserId: string | null;
  createdByRole: "coach" | "admin" | "system";
  title: string;
  description: string;
  flagType: CoachFlagType;
  severity: CoachFlagSeverity;
  status: CoachFlagStatus;
  visibility: CoachRecordVisibility;
  linkedEvidenceIds: string[];
  createdAt: string;
  resolvedAt: string | null;
  archivedAt: string | null;
}

export type CoachOutboundRecipientType = "student" | "parent";
export type CoachOutboundMessageStatus = "draft" | "ready" | "sent" | "failed" | "archived";
export type CoachDeliveryProviderMode = "mock" | "provider_disabled" | "not_sent";

export interface CoachOutboundMessageRecord {
  coachOutboundMessageId: string;
  coachUserId: string;
  coachDisplayName?: string | null;
  studentProfileId: string;
  householdId: string | null;
  recipientType: CoachOutboundRecipientType;
  recipientUserId: string | null;
  channel: "email" | "sms" | "whatsapp";
  subject: string | null;
  body: string;
  status: CoachOutboundMessageStatus;
  providerMode: CoachDeliveryProviderMode;
  externalMessageId: string | null;
  linkedCoachActionItemId: string | null;
  linkedCoachRecommendationId: string | null;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  archivedAt: string | null;
}

export interface CoachRosterItem extends CoachStudentRelationshipRecord {
  readinessStatus: string | null;
  evidenceCompletenessStatus: string | null;
  openActionItems: number;
  activeFlags: number;
  lastCoachNoteDate: string | null;
}

export interface CoachWorkspaceSummary {
  studentProfileId: string;
  studentDisplayName: string;
  householdId: string | null;
  relationshipStatus: CoachRelationshipStatus;
  nextReviewDate: string | null;
  readinessStatus: string | null;
  overallScore: number | null;
  evidenceStrength: "strong" | "moderate" | "weak" | "missing" | null;
  missingEvidence: string[];
  outcomeSummary: {
    totalActive: number;
    latestActionDate: string | null;
    countsByType: Record<string, number>;
  };
  academicSummary: {
    schoolName: string | null;
    majorPrimary: string | null;
    majorSecondary: string | null;
    expectedGraduationDate: string | null;
  };
  parentContextAllowed: boolean;
}

export interface CoachVisibleFeed {
  recommendations: CoachRecommendationRecord[];
  actionItems: CoachActionItemRecord[];
  flags: CoachFlagRecord[];
  notes: CoachNoteRecord[];
}
