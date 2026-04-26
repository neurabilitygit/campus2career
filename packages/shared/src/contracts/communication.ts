export type CommunicationChannel = "email" | "sms" | "whatsapp";

export type ParentCommunicationCategory =
  | "career_concern"
  | "academic_concern"
  | "internship_job_search_concern"
  | "financial_tuition_concern"
  | "independence_life_skills_concern"
  | "emotional_motivational_concern"
  | "logistical_question"
  | "other";

export type ParentCommunicationEntryStatus =
  | "draft"
  | "saved_as_context"
  | "ready_for_translation"
  | "translated"
  | "queued_for_delivery"
  | "delivered"
  | "student_responded"
  | "archived";

export type ParentCommunicationIntent =
  | "context_only"
  | "direct"
  | "indirect"
  | "delayed";

export type CommunicationUrgency = "low" | "medium" | "high" | "urgent";

export type CommunicationTone =
  | "gentle"
  | "neutral"
  | "direct"
  | "encouraging"
  | "question_led"
  | "summary_first";

export type CommunicationFrequency =
  | "as_needed"
  | "weekly"
  | "biweekly"
  | "monthly";

export type CommunicationTimeOfDay =
  | "morning"
  | "afternoon"
  | "evening"
  | "late_night"
  | "weekend"
  | "variable";

export type StudentGuidanceFormat =
  | "direct_instructions"
  | "choices"
  | "reminders"
  | "questions"
  | "summaries";

export type ConsentState = "granted" | "withheld" | "unknown";

export type TranslationDeliveryStatus =
  | "generated"
  | "review_required"
  | "withheld"
  | "approved"
  | "queued"
  | "delivered"
  | "archived";

export type DefensivenessRisk = "low" | "medium" | "high";

export type DeliveryProviderMode = "mock" | "provider_disabled" | "not_sent";

export type CommunicationAuditEventType =
  | "student_preferences_updated"
  | "parent_profile_updated"
  | "entry_created"
  | "entry_updated"
  | "entry_status_changed"
  | "strategy_generated"
  | "strategy_withheld"
  | "draft_saved"
  | "delivery_requested"
  | "delivery_blocked"
  | "delivery_mocked";

export type CommunicationActorRole = "student" | "parent" | "coach" | "admin" | "system";

export type CommunicationVisibilityScope =
  | "private_to_user"
  | "visible_to_household_admin"
  | "visible_to_student"
  | "visible_to_parent"
  | "visible_to_coach"
  | "visible_to_system_only"
  | "shared_summary_only";

export type CommunicationSensitivityLevel = "low" | "medium" | "high";

export type CommunicationPromptStatus =
  | "unanswered"
  | "answered"
  | "skipped"
  | "revisit_later";

export type CommunicationPromptAudience = "parent" | "student";

export type CommunicationTranslationGoal =
  | "clarify"
  | "reduce_friction"
  | "reminder"
  | "check_in"
  | "boundary_setting"
  | "status_update"
  | "encouragement";

export type CommunicationFeedbackRating =
  | "helpful"
  | "not_helpful"
  | "too_direct"
  | "too_soft"
  | "missed_the_point"
  | "made_it_worse"
  | "other";

export type CommunicationLearningEventType =
  | "translation_feedback"
  | "prompt_answered"
  | "prompt_skipped"
  | "prompt_revisit_requested"
  | "summary_generated";

export type CommunicationInferredInsightType =
  | "tone_preference"
  | "reminder_pattern"
  | "friction_pattern"
  | "support_pattern";

export type CommunicationInferredInsightStatus =
  | "pending_review"
  | "confirmed"
  | "rejected";

export interface StudentCommunicationPreferencesRecord {
  studentProfileId: string;
  preferredChannels: CommunicationChannel[];
  dislikedChannels: CommunicationChannel[];
  preferredTone: CommunicationTone | null;
  sensitiveTopics: string[];
  preferredFrequency: CommunicationFrequency | null;
  bestTimeOfDay: CommunicationTimeOfDay | null;
  preferredGuidanceFormats: StudentGuidanceFormat[];
  identifyParentOrigin: boolean;
  allowParentConcernRephrasing: boolean;
  consentParentTranslatedMessages: boolean;
  notes: string | null;
  updatedAt?: string;
}

export interface ParentCommunicationProfileRecord {
  parentUserId: string;
  studentProfileId: string;
  householdId?: string | null;
  mainWorries: string | null;
  usualApproach: string | null;
  whatDoesNotWork: string | null;
  wantsToImprove: string | null;
  sendPreference: "review_before_send" | "send_direct_if_allowed" | null;
  preferredCommunicationStyle: string | null;
  consentAcknowledged: boolean;
  updatedAt?: string;
}

export interface ParentCommunicationEntryRecord {
  parentCommunicationEntryId: string;
  parentUserId: string;
  studentProfileId: string;
  householdId?: string | null;
  category: ParentCommunicationCategory;
  status: ParentCommunicationEntryStatus;
  urgency: CommunicationUrgency;
  deliveryIntent: ParentCommunicationIntent;
  factsStudentShouldKnow: string | null;
  questionsParentWantsAnswered: string | null;
  parentConcerns: string | null;
  recurringCommunicationFailures: string | null;
  defensiveTopics: string | null;
  priorAttemptsThatDidNotWork: string | null;
  preferredOutcome: string | null;
  freeformContext: string | null;
  createdAt?: string;
  updatedAt?: string;
  archivedAt?: string | null;
}

export interface CommunicationTranslationStrategyRecord {
  communicationStrategyId: string;
  parentCommunicationEntryId: string;
  parentUserId: string;
  studentProfileId: string;
  householdId?: string | null;
  sourceLlmRunId?: string | null;
  generationMode: "llm" | "fallback";
  consentState: ConsentState;
  status: TranslationDeliveryStatus;
  recommendedChannel: CommunicationChannel | null;
  recommendedTone: CommunicationTone | null;
  recommendedTiming: string | null;
  recommendedFrequency: CommunicationFrequency | null;
  defensivenessRisk: DefensivenessRisk;
  reasonForRecommendation: string;
  studentFacingMessageDraft: string;
  parentFacingExplanation: string;
  whatNotToSay: string;
  humanReviewRecommended: boolean;
  withholdDelivery: boolean;
  withholdReason: string | null;
  structuredPayload?: unknown;
  createdAt?: string;
  updatedAt?: string;
}

export interface CommunicationMessageDraftRecord {
  communicationMessageDraftId: string;
  communicationStrategyId: string;
  parentCommunicationEntryId: string;
  parentUserId: string;
  studentProfileId: string;
  householdId?: string | null;
  selectedChannel: CommunicationChannel;
  providerMode: DeliveryProviderMode;
  status: TranslationDeliveryStatus;
  messageBody: string;
  reviewRequired: boolean;
  approvedForDelivery: boolean;
  approvedAt?: string | null;
  deliveredAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CommunicationAuditLogRecord {
  communicationAuditLogId: string;
  parentCommunicationEntryId?: string | null;
  communicationStrategyId?: string | null;
  communicationMessageDraftId?: string | null;
  studentProfileId: string;
  householdId?: string | null;
  actorUserId?: string | null;
  actorRole: "student" | "parent" | "coach" | "admin" | "system";
  eventType: CommunicationAuditEventType;
  eventSummary: string;
  eventPayload?: unknown;
  createdAt?: string;
}

export interface CommunicationProfileRecord {
  communicationProfileId: string;
  householdId?: string | null;
  studentProfileId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ParentCommunicationInputRecord {
  parentCommunicationInputId: string;
  communicationProfileId: string;
  parentUserId: string;
  category: string;
  promptKey: string;
  questionText: string;
  responseText: string;
  sensitivityLevel: CommunicationSensitivityLevel;
  visibilityScope: CommunicationVisibilityScope;
  confidenceLevel: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface StudentCommunicationInputRecord {
  studentCommunicationInputId: string;
  communicationProfileId: string;
  studentUserId: string;
  category: string;
  promptKey: string;
  questionText: string;
  responseText: string;
  sensitivityLevel: CommunicationSensitivityLevel;
  visibilityScope: CommunicationVisibilityScope;
  createdAt?: string;
  updatedAt?: string;
}

export interface CommunicationTranslationEventRecord {
  communicationTranslationEventId: string;
  communicationProfileId: string;
  sourceRole: Exclude<CommunicationActorRole, "system" | "admin">;
  targetRole: Exclude<CommunicationActorRole, "system" | "admin">;
  originalText: string;
  translatedText: string;
  translationGoal: CommunicationTranslationGoal;
  tone: CommunicationTone | null;
  contextUsedJson?: unknown;
  structuredResultJson?: unknown;
  feedbackRating?: CommunicationFeedbackRating | null;
  feedbackNotes?: string | null;
  createdByUserId: string;
  createdAt?: string;
}

export interface CommunicationPromptProgressRecord {
  communicationPromptProgressId: string;
  communicationProfileId: string;
  userId: string;
  role: CommunicationPromptAudience;
  promptKey: string;
  status: CommunicationPromptStatus;
  lastPromptedAt?: string | null;
  answeredAt?: string | null;
  updatedAt?: string;
}

export interface CommunicationLearningEventRecord {
  communicationLearningEventId: string;
  communicationProfileId: string;
  eventType: CommunicationLearningEventType;
  sourceRole: CommunicationActorRole;
  signalJson?: unknown;
  interpretationJson?: unknown;
  createdAt?: string;
}

export interface CommunicationInferredInsightRecord {
  communicationInferredInsightId: string;
  communicationProfileId: string;
  insightKey: string;
  insightType: CommunicationInferredInsightType;
  title: string;
  summaryText: string;
  evidenceJson?: unknown;
  confidenceLabel: "low" | "medium" | "high";
  status: CommunicationInferredInsightStatus;
  reviewedByUserId?: string | null;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
  lastDerivedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CommunicationAnalyticsSummary {
  promptStats: {
    parent: {
      answered: number;
      skipped: number;
      revisitLater: number;
      totalPrompts: number;
    };
    student: {
      answered: number;
      skipped: number;
      revisitLater: number;
      totalPrompts: number;
    };
  };
  translationStats: {
    totalTranslations: number;
    feedbackCount: number;
    latestCreatedAt: string | null;
  };
  feedbackBreakdown: Record<CommunicationFeedbackRating, number>;
  topPromptSignals: Array<{
    promptKey: string;
    audience: CommunicationPromptAudience;
    status: CommunicationPromptStatus;
    count: number;
  }>;
}
