import { query } from "../../db/client";
import type {
  CommunicationAuditEventType,
  CommunicationAuditLogRecord,
  CommunicationInferredInsightRecord,
  CommunicationLearningEventRecord,
  CommunicationMessageDraftRecord,
  CommunicationProfileRecord,
  CommunicationPromptProgressRecord,
  CommunicationTranslationEventRecord,
  CommunicationTranslationStrategyRecord,
  ParentCommunicationInputRecord,
  ParentCommunicationEntryRecord,
  ParentCommunicationEntryStatus,
  ParentCommunicationProfileRecord,
  StudentCommunicationPreferencesRecord,
  StudentCommunicationInputRecord,
  TranslationDeliveryStatus,
} from "../../../../../packages/shared/src/contracts/communication";

type StudentCommunicationPreferencesRow = {
  student_profile_id: string;
  preferred_channels: string[] | null;
  disliked_channels: string[] | null;
  preferred_tone: StudentCommunicationPreferencesRecord["preferredTone"];
  sensitive_topics: string[] | null;
  preferred_frequency: StudentCommunicationPreferencesRecord["preferredFrequency"];
  best_time_of_day: StudentCommunicationPreferencesRecord["bestTimeOfDay"];
  preferred_guidance_formats: string[] | null;
  identify_parent_origin: boolean;
  allow_parent_concern_rephrasing: boolean;
  consent_parent_translated_messages: boolean;
  notes: string | null;
  updated_at: string;
};

type ParentCommunicationProfileRow = {
  parent_user_id: string;
  student_profile_id: string;
  household_id: string | null;
  main_worries: string | null;
  usual_approach: string | null;
  what_does_not_work: string | null;
  wants_to_improve: string | null;
  send_preference: ParentCommunicationProfileRecord["sendPreference"];
  preferred_communication_style: string | null;
  consent_acknowledged: boolean;
  updated_at: string;
};

type ParentCommunicationEntryRow = {
  parent_communication_entry_id: string;
  parent_user_id: string;
  student_profile_id: string;
  household_id: string | null;
  category: ParentCommunicationEntryRecord["category"];
  status: ParentCommunicationEntryStatus;
  urgency: ParentCommunicationEntryRecord["urgency"];
  delivery_intent: ParentCommunicationEntryRecord["deliveryIntent"];
  facts_student_should_know: string | null;
  questions_parent_wants_answered: string | null;
  parent_concerns: string | null;
  recurring_communication_failures: string | null;
  defensive_topics: string | null;
  prior_attempts_that_did_not_work: string | null;
  preferred_outcome: string | null;
  freeform_context: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

type CommunicationTranslationStrategyRow = {
  communication_strategy_id: string;
  parent_communication_entry_id: string;
  parent_user_id: string;
  student_profile_id: string;
  household_id: string | null;
  source_llm_run_id: string | null;
  generation_mode: "llm" | "fallback";
  consent_state: CommunicationTranslationStrategyRecord["consentState"];
  status: TranslationDeliveryStatus;
  recommended_channel: CommunicationTranslationStrategyRecord["recommendedChannel"];
  recommended_tone: CommunicationTranslationStrategyRecord["recommendedTone"];
  recommended_timing: string | null;
  recommended_frequency: CommunicationTranslationStrategyRecord["recommendedFrequency"];
  defensiveness_risk: CommunicationTranslationStrategyRecord["defensivenessRisk"];
  reason_for_recommendation: string;
  student_facing_message_draft: string;
  parent_facing_explanation: string;
  what_not_to_say: string;
  human_review_recommended: boolean;
  withhold_delivery: boolean;
  withhold_reason: string | null;
  structured_payload: unknown;
  created_at: string;
  updated_at: string;
};

type CommunicationMessageDraftRow = {
  communication_message_draft_id: string;
  communication_strategy_id: string;
  parent_communication_entry_id: string;
  parent_user_id: string;
  student_profile_id: string;
  household_id: string | null;
  selected_channel: CommunicationMessageDraftRecord["selectedChannel"];
  provider_mode: CommunicationMessageDraftRecord["providerMode"];
  status: TranslationDeliveryStatus;
  message_body: string;
  review_required: boolean;
  approved_for_delivery: boolean;
  approved_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
};

type CommunicationAuditLogRow = {
  communication_audit_log_id: string;
  parent_communication_entry_id: string | null;
  communication_strategy_id: string | null;
  communication_message_draft_id: string | null;
  student_profile_id: string;
  household_id: string | null;
  actor_user_id: string | null;
  actor_role: CommunicationAuditLogRecord["actorRole"];
  event_type: CommunicationAuditEventType;
  event_summary: string;
  event_payload: unknown;
  created_at: string;
};

type CommunicationProfileRow = {
  communication_profile_id: string;
  household_id: string | null;
  student_profile_id: string;
  created_at: string;
  updated_at: string;
};

type ParentCommunicationInputRow = {
  parent_communication_input_id: string;
  communication_profile_id: string;
  parent_user_id: string;
  category: string;
  prompt_key: string;
  question_text: string;
  response_text: string;
  sensitivity_level: ParentCommunicationInputRecord["sensitivityLevel"];
  visibility_scope: ParentCommunicationInputRecord["visibilityScope"];
  confidence_level: string | null;
  created_at: string;
  updated_at: string;
};

type StudentCommunicationInputRow = {
  student_communication_input_id: string;
  communication_profile_id: string;
  student_user_id: string;
  category: string;
  prompt_key: string;
  question_text: string;
  response_text: string;
  sensitivity_level: StudentCommunicationInputRecord["sensitivityLevel"];
  visibility_scope: StudentCommunicationInputRecord["visibilityScope"];
  created_at: string;
  updated_at: string;
};

type CommunicationTranslationEventRow = {
  communication_translation_event_id: string;
  communication_profile_id: string;
  source_role: CommunicationTranslationEventRecord["sourceRole"];
  target_role: CommunicationTranslationEventRecord["targetRole"];
  original_text: string;
  translated_text: string;
  translation_goal: CommunicationTranslationEventRecord["translationGoal"];
  tone: CommunicationTranslationEventRecord["tone"];
  context_used_json: unknown;
  structured_result_json: unknown;
  feedback_rating: CommunicationTranslationEventRecord["feedbackRating"];
  feedback_notes: string | null;
  created_by_user_id: string;
  created_at: string;
};

type CommunicationPromptProgressRow = {
  communication_prompt_progress_id: string;
  communication_profile_id: string;
  user_id: string;
  role: CommunicationPromptProgressRecord["role"];
  prompt_key: string;
  status: CommunicationPromptProgressRecord["status"];
  last_prompted_at: string | null;
  answered_at: string | null;
  updated_at: string;
};

type CommunicationLearningEventRow = {
  communication_learning_event_id: string;
  communication_profile_id: string;
  event_type: CommunicationLearningEventRecord["eventType"];
  source_role: CommunicationLearningEventRecord["sourceRole"];
  signal_json: unknown;
  interpretation_json: unknown;
  created_at: string;
};

type CommunicationInferredInsightRow = {
  communication_inferred_insight_id: string;
  communication_profile_id: string;
  insight_key: string;
  insight_type: CommunicationInferredInsightRecord["insightType"];
  title: string;
  summary_text: string;
  evidence_json: unknown;
  confidence_label: CommunicationInferredInsightRecord["confidenceLabel"];
  status: CommunicationInferredInsightRecord["status"];
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  last_derived_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapStudentPreferences(row: StudentCommunicationPreferencesRow): StudentCommunicationPreferencesRecord {
  return {
    studentProfileId: row.student_profile_id,
    preferredChannels: (row.preferred_channels || []) as StudentCommunicationPreferencesRecord["preferredChannels"],
    dislikedChannels: (row.disliked_channels || []) as StudentCommunicationPreferencesRecord["dislikedChannels"],
    preferredTone: row.preferred_tone,
    sensitiveTopics: row.sensitive_topics || [],
    preferredFrequency: row.preferred_frequency,
    bestTimeOfDay: row.best_time_of_day,
    preferredGuidanceFormats:
      (row.preferred_guidance_formats || []) as StudentCommunicationPreferencesRecord["preferredGuidanceFormats"],
    identifyParentOrigin: row.identify_parent_origin,
    allowParentConcernRephrasing: row.allow_parent_concern_rephrasing,
    consentParentTranslatedMessages: row.consent_parent_translated_messages,
    notes: row.notes,
    updatedAt: row.updated_at,
  };
}

function mapParentProfile(row: ParentCommunicationProfileRow): ParentCommunicationProfileRecord {
  return {
    parentUserId: row.parent_user_id,
    studentProfileId: row.student_profile_id,
    householdId: row.household_id,
    mainWorries: row.main_worries,
    usualApproach: row.usual_approach,
    whatDoesNotWork: row.what_does_not_work,
    wantsToImprove: row.wants_to_improve,
    sendPreference: row.send_preference,
    preferredCommunicationStyle: row.preferred_communication_style,
    consentAcknowledged: row.consent_acknowledged,
    updatedAt: row.updated_at,
  };
}

function mapEntry(row: ParentCommunicationEntryRow): ParentCommunicationEntryRecord {
  return {
    parentCommunicationEntryId: row.parent_communication_entry_id,
    parentUserId: row.parent_user_id,
    studentProfileId: row.student_profile_id,
    householdId: row.household_id,
    category: row.category,
    status: row.status,
    urgency: row.urgency,
    deliveryIntent: row.delivery_intent,
    factsStudentShouldKnow: row.facts_student_should_know,
    questionsParentWantsAnswered: row.questions_parent_wants_answered,
    parentConcerns: row.parent_concerns,
    recurringCommunicationFailures: row.recurring_communication_failures,
    defensiveTopics: row.defensive_topics,
    priorAttemptsThatDidNotWork: row.prior_attempts_that_did_not_work,
    preferredOutcome: row.preferred_outcome,
    freeformContext: row.freeform_context,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
}

function mapStrategy(row: CommunicationTranslationStrategyRow): CommunicationTranslationStrategyRecord {
  return {
    communicationStrategyId: row.communication_strategy_id,
    parentCommunicationEntryId: row.parent_communication_entry_id,
    parentUserId: row.parent_user_id,
    studentProfileId: row.student_profile_id,
    householdId: row.household_id,
    sourceLlmRunId: row.source_llm_run_id,
    generationMode: row.generation_mode,
    consentState: row.consent_state,
    status: row.status,
    recommendedChannel: row.recommended_channel,
    recommendedTone: row.recommended_tone,
    recommendedTiming: row.recommended_timing,
    recommendedFrequency: row.recommended_frequency,
    defensivenessRisk: row.defensiveness_risk,
    reasonForRecommendation: row.reason_for_recommendation,
    studentFacingMessageDraft: row.student_facing_message_draft,
    parentFacingExplanation: row.parent_facing_explanation,
    whatNotToSay: row.what_not_to_say,
    humanReviewRecommended: row.human_review_recommended,
    withholdDelivery: row.withhold_delivery,
    withholdReason: row.withhold_reason,
    structuredPayload: row.structured_payload,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDraft(row: CommunicationMessageDraftRow): CommunicationMessageDraftRecord {
  return {
    communicationMessageDraftId: row.communication_message_draft_id,
    communicationStrategyId: row.communication_strategy_id,
    parentCommunicationEntryId: row.parent_communication_entry_id,
    parentUserId: row.parent_user_id,
    studentProfileId: row.student_profile_id,
    householdId: row.household_id,
    selectedChannel: row.selected_channel,
    providerMode: row.provider_mode,
    status: row.status,
    messageBody: row.message_body,
    reviewRequired: row.review_required,
    approvedForDelivery: row.approved_for_delivery,
    approvedAt: row.approved_at,
    deliveredAt: row.delivered_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAudit(row: CommunicationAuditLogRow): CommunicationAuditLogRecord {
  return {
    communicationAuditLogId: row.communication_audit_log_id,
    parentCommunicationEntryId: row.parent_communication_entry_id,
    communicationStrategyId: row.communication_strategy_id,
    communicationMessageDraftId: row.communication_message_draft_id,
    studentProfileId: row.student_profile_id,
    householdId: row.household_id,
    actorUserId: row.actor_user_id,
    actorRole: row.actor_role,
    eventType: row.event_type,
    eventSummary: row.event_summary,
    eventPayload: row.event_payload,
    createdAt: row.created_at,
  };
}

function mapCommunicationProfile(row: CommunicationProfileRow): CommunicationProfileRecord {
  return {
    communicationProfileId: row.communication_profile_id,
    householdId: row.household_id,
    studentProfileId: row.student_profile_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapParentInput(row: ParentCommunicationInputRow): ParentCommunicationInputRecord {
  return {
    parentCommunicationInputId: row.parent_communication_input_id,
    communicationProfileId: row.communication_profile_id,
    parentUserId: row.parent_user_id,
    category: row.category,
    promptKey: row.prompt_key,
    questionText: row.question_text,
    responseText: row.response_text,
    sensitivityLevel: row.sensitivity_level,
    visibilityScope: row.visibility_scope,
    confidenceLevel: row.confidence_level,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapStudentInput(row: StudentCommunicationInputRow): StudentCommunicationInputRecord {
  return {
    studentCommunicationInputId: row.student_communication_input_id,
    communicationProfileId: row.communication_profile_id,
    studentUserId: row.student_user_id,
    category: row.category,
    promptKey: row.prompt_key,
    questionText: row.question_text,
    responseText: row.response_text,
    sensitivityLevel: row.sensitivity_level,
    visibilityScope: row.visibility_scope,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTranslationEvent(row: CommunicationTranslationEventRow): CommunicationTranslationEventRecord {
  return {
    communicationTranslationEventId: row.communication_translation_event_id,
    communicationProfileId: row.communication_profile_id,
    sourceRole: row.source_role,
    targetRole: row.target_role,
    originalText: row.original_text,
    translatedText: row.translated_text,
    translationGoal: row.translation_goal,
    tone: row.tone,
    contextUsedJson: row.context_used_json,
    structuredResultJson: row.structured_result_json,
    feedbackRating: row.feedback_rating,
    feedbackNotes: row.feedback_notes,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
  };
}

function mapPromptProgress(row: CommunicationPromptProgressRow): CommunicationPromptProgressRecord {
  return {
    communicationPromptProgressId: row.communication_prompt_progress_id,
    communicationProfileId: row.communication_profile_id,
    userId: row.user_id,
    role: row.role,
    promptKey: row.prompt_key,
    status: row.status,
    lastPromptedAt: row.last_prompted_at,
    answeredAt: row.answered_at,
    updatedAt: row.updated_at,
  };
}

function mapLearningEvent(row: CommunicationLearningEventRow): CommunicationLearningEventRecord {
  return {
    communicationLearningEventId: row.communication_learning_event_id,
    communicationProfileId: row.communication_profile_id,
    eventType: row.event_type,
    sourceRole: row.source_role,
    signalJson: row.signal_json,
    interpretationJson: row.interpretation_json,
    createdAt: row.created_at,
  };
}

function mapInferredInsight(row: CommunicationInferredInsightRow): CommunicationInferredInsightRecord {
  return {
    communicationInferredInsightId: row.communication_inferred_insight_id,
    communicationProfileId: row.communication_profile_id,
    insightKey: row.insight_key,
    insightType: row.insight_type,
    title: row.title,
    summaryText: row.summary_text,
    evidenceJson: row.evidence_json,
    confidenceLabel: row.confidence_label,
    status: row.status,
    reviewedByUserId: row.reviewed_by_user_id,
    reviewedAt: row.reviewed_at,
    reviewNotes: row.review_notes,
    lastDerivedAt: row.last_derived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class CommunicationRepository {
  async getOrCreateCommunicationProfile(input: {
    communicationProfileId: string;
    studentProfileId: string;
    householdId?: string | null;
  }): Promise<CommunicationProfileRecord> {
    await query(
      `
      insert into communication_profiles (
        communication_profile_id,
        household_id,
        student_profile_id,
        created_at,
        updated_at
      ) values ($1,$2,$3,now(),now())
      on conflict (student_profile_id) do update set
        household_id = coalesce(excluded.household_id, communication_profiles.household_id),
        updated_at = now()
      `,
      [input.communicationProfileId, input.householdId ?? null, input.studentProfileId]
    );

    const result = await query<CommunicationProfileRow>(
      `
      select
        communication_profile_id,
        household_id,
        student_profile_id,
        created_at,
        updated_at
      from communication_profiles
      where student_profile_id = $1
      limit 1
      `,
      [input.studentProfileId]
    );

    return mapCommunicationProfile(result.rows[0]);
  }

  async getCommunicationProfileByStudent(studentProfileId: string): Promise<CommunicationProfileRecord | null> {
    const result = await query<CommunicationProfileRow>(
      `
      select
        communication_profile_id,
        household_id,
        student_profile_id,
        created_at,
        updated_at
      from communication_profiles
      where student_profile_id = $1
      limit 1
      `,
      [studentProfileId]
    );
    return result.rows[0] ? mapCommunicationProfile(result.rows[0]) : null;
  }

  async getStudentPreferences(studentProfileId: string): Promise<StudentCommunicationPreferencesRecord | null> {
    const result = await query<StudentCommunicationPreferencesRow>(
      `
      select
        student_profile_id,
        preferred_channels,
        disliked_channels,
        preferred_tone,
        sensitive_topics,
        preferred_frequency,
        best_time_of_day,
        preferred_guidance_formats,
        identify_parent_origin,
        allow_parent_concern_rephrasing,
        consent_parent_translated_messages,
        notes,
        updated_at
      from student_communication_preferences
      where student_profile_id = $1
      limit 1
      `,
      [studentProfileId]
    );
    return result.rows[0] ? mapStudentPreferences(result.rows[0]) : null;
  }

  async upsertStudentPreferences(input: {
    preferenceId: string;
    studentProfileId: string;
    record: StudentCommunicationPreferencesRecord;
  }): Promise<void> {
    await query(
      `
      insert into student_communication_preferences (
        student_communication_preference_id,
        student_profile_id,
        preferred_channels,
        disliked_channels,
        preferred_tone,
        sensitive_topics,
        preferred_frequency,
        best_time_of_day,
        preferred_guidance_formats,
        identify_parent_origin,
        allow_parent_concern_rephrasing,
        consent_parent_translated_messages,
        notes,
        created_at,
        updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now(),now())
      on conflict (student_profile_id) do update set
        preferred_channels = excluded.preferred_channels,
        disliked_channels = excluded.disliked_channels,
        preferred_tone = excluded.preferred_tone,
        sensitive_topics = excluded.sensitive_topics,
        preferred_frequency = excluded.preferred_frequency,
        best_time_of_day = excluded.best_time_of_day,
        preferred_guidance_formats = excluded.preferred_guidance_formats,
        identify_parent_origin = excluded.identify_parent_origin,
        allow_parent_concern_rephrasing = excluded.allow_parent_concern_rephrasing,
        consent_parent_translated_messages = excluded.consent_parent_translated_messages,
        notes = excluded.notes,
        updated_at = now()
      `,
      [
        input.preferenceId,
        input.studentProfileId,
        input.record.preferredChannels,
        input.record.dislikedChannels,
        input.record.preferredTone,
        input.record.sensitiveTopics,
        input.record.preferredFrequency,
        input.record.bestTimeOfDay,
        input.record.preferredGuidanceFormats,
        input.record.identifyParentOrigin,
        input.record.allowParentConcernRephrasing,
        input.record.consentParentTranslatedMessages,
        input.record.notes,
      ]
    );
  }

  async getParentProfile(parentUserId: string, studentProfileId: string): Promise<ParentCommunicationProfileRecord | null> {
    const result = await query<ParentCommunicationProfileRow>(
      `
      select
        parent_user_id,
        student_profile_id,
        household_id,
        main_worries,
        usual_approach,
        what_does_not_work,
        wants_to_improve,
        send_preference,
        preferred_communication_style,
        consent_acknowledged,
        updated_at
      from parent_communication_profiles
      where parent_user_id = $1
        and student_profile_id = $2
      limit 1
      `,
      [parentUserId, studentProfileId]
    );
    return result.rows[0] ? mapParentProfile(result.rows[0]) : null;
  }

  async upsertParentProfile(input: {
    profileId: string;
    record: ParentCommunicationProfileRecord;
  }): Promise<void> {
    await query(
      `
      insert into parent_communication_profiles (
        parent_communication_profile_id,
        parent_user_id,
        student_profile_id,
        household_id,
        main_worries,
        usual_approach,
        what_does_not_work,
        wants_to_improve,
        send_preference,
        preferred_communication_style,
        consent_acknowledged,
        created_at,
        updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now(),now())
      on conflict (parent_user_id, student_profile_id) do update set
        household_id = excluded.household_id,
        main_worries = excluded.main_worries,
        usual_approach = excluded.usual_approach,
        what_does_not_work = excluded.what_does_not_work,
        wants_to_improve = excluded.wants_to_improve,
        send_preference = excluded.send_preference,
        preferred_communication_style = excluded.preferred_communication_style,
        consent_acknowledged = excluded.consent_acknowledged,
        updated_at = now()
      `,
      [
        input.profileId,
        input.record.parentUserId,
        input.record.studentProfileId,
        input.record.householdId ?? null,
        input.record.mainWorries,
        input.record.usualApproach,
        input.record.whatDoesNotWork,
        input.record.wantsToImprove,
        input.record.sendPreference,
        input.record.preferredCommunicationStyle,
        input.record.consentAcknowledged,
      ]
    );
  }

  async createEntry(entry: ParentCommunicationEntryRecord): Promise<void> {
    await query(
      `
      insert into parent_communication_entries (
        parent_communication_entry_id,
        parent_user_id,
        student_profile_id,
        household_id,
        category,
        status,
        urgency,
        delivery_intent,
        facts_student_should_know,
        questions_parent_wants_answered,
        parent_concerns,
        recurring_communication_failures,
        defensive_topics,
        prior_attempts_that_did_not_work,
        preferred_outcome,
        freeform_context,
        created_at,
        updated_at,
        archived_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,now(),now(),$17)
      `,
      [
        entry.parentCommunicationEntryId,
        entry.parentUserId,
        entry.studentProfileId,
        entry.householdId ?? null,
        entry.category,
        entry.status,
        entry.urgency,
        entry.deliveryIntent,
        entry.factsStudentShouldKnow,
        entry.questionsParentWantsAnswered,
        entry.parentConcerns,
        entry.recurringCommunicationFailures,
        entry.defensiveTopics,
        entry.priorAttemptsThatDidNotWork,
        entry.preferredOutcome,
        entry.freeformContext,
        entry.archivedAt ?? null,
      ]
    );
  }

  async listEntries(parentUserId: string, studentProfileId: string): Promise<ParentCommunicationEntryRecord[]> {
    const result = await query<ParentCommunicationEntryRow>(
      `
      select
        parent_communication_entry_id,
        parent_user_id,
        student_profile_id,
        household_id,
        category,
        status,
        urgency,
        delivery_intent,
        facts_student_should_know,
        questions_parent_wants_answered,
        parent_concerns,
        recurring_communication_failures,
        defensive_topics,
        prior_attempts_that_did_not_work,
        preferred_outcome,
        freeform_context,
        created_at,
        updated_at,
        archived_at
      from parent_communication_entries
      where parent_user_id = $1
        and student_profile_id = $2
      order by created_at desc
      `,
      [parentUserId, studentProfileId]
    );
    return result.rows.map(mapEntry);
  }

  async getEntry(parentCommunicationEntryId: string, parentUserId: string, studentProfileId: string): Promise<ParentCommunicationEntryRecord | null> {
    const result = await query<ParentCommunicationEntryRow>(
      `
      select
        parent_communication_entry_id,
        parent_user_id,
        student_profile_id,
        household_id,
        category,
        status,
        urgency,
        delivery_intent,
        facts_student_should_know,
        questions_parent_wants_answered,
        parent_concerns,
        recurring_communication_failures,
        defensive_topics,
        prior_attempts_that_did_not_work,
        preferred_outcome,
        freeform_context,
        created_at,
        updated_at,
        archived_at
      from parent_communication_entries
      where parent_communication_entry_id = $1
        and parent_user_id = $2
        and student_profile_id = $3
      limit 1
      `,
      [parentCommunicationEntryId, parentUserId, studentProfileId]
    );
    return result.rows[0] ? mapEntry(result.rows[0]) : null;
  }

  async updateEntryStatus(input: {
    parentCommunicationEntryId: string;
    parentUserId: string;
    studentProfileId: string;
    status: ParentCommunicationEntryStatus;
  }): Promise<boolean> {
    const result = await query(
      `
      update parent_communication_entries
      set
        status = $4,
        archived_at = case when $4 = 'archived' then now() else archived_at end,
        updated_at = now()
      where parent_communication_entry_id = $1
        and parent_user_id = $2
        and student_profile_id = $3
      `,
      [input.parentCommunicationEntryId, input.parentUserId, input.studentProfileId, input.status]
    );
    return (result.rowCount || 0) > 0;
  }

  async createStrategy(record: CommunicationTranslationStrategyRecord): Promise<void> {
    await query(
      `
      insert into communication_translation_strategies (
        communication_strategy_id,
        parent_communication_entry_id,
        parent_user_id,
        student_profile_id,
        household_id,
        source_llm_run_id,
        generation_mode,
        consent_state,
        status,
        recommended_channel,
        recommended_tone,
        recommended_timing,
        recommended_frequency,
        defensiveness_risk,
        reason_for_recommendation,
        student_facing_message_draft,
        parent_facing_explanation,
        what_not_to_say,
        human_review_recommended,
        withhold_delivery,
        withhold_reason,
        structured_payload,
        created_at,
        updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,now(),now())
      `,
      [
        record.communicationStrategyId,
        record.parentCommunicationEntryId,
        record.parentUserId,
        record.studentProfileId,
        record.householdId ?? null,
        record.sourceLlmRunId ?? null,
        record.generationMode,
        record.consentState,
        record.status,
        record.recommendedChannel,
        record.recommendedTone,
        record.recommendedTiming,
        record.recommendedFrequency,
        record.defensivenessRisk,
        record.reasonForRecommendation,
        record.studentFacingMessageDraft,
        record.parentFacingExplanation,
        record.whatNotToSay,
        record.humanReviewRecommended,
        record.withholdDelivery,
        record.withholdReason,
        JSON.stringify(record.structuredPayload ?? null),
      ]
    );
  }

  async getLatestStrategyForEntry(parentCommunicationEntryId: string): Promise<CommunicationTranslationStrategyRecord | null> {
    const result = await query<CommunicationTranslationStrategyRow>(
      `
      select
        communication_strategy_id,
        parent_communication_entry_id,
        parent_user_id,
        student_profile_id,
        household_id,
        source_llm_run_id,
        generation_mode,
        consent_state,
        status,
        recommended_channel,
        recommended_tone,
        recommended_timing,
        recommended_frequency,
        defensiveness_risk,
        reason_for_recommendation,
        student_facing_message_draft,
        parent_facing_explanation,
        what_not_to_say,
        human_review_recommended,
        withhold_delivery,
        withhold_reason,
        structured_payload,
        created_at,
        updated_at
      from communication_translation_strategies
      where parent_communication_entry_id = $1
      order by created_at desc
      limit 1
      `,
      [parentCommunicationEntryId]
    );
    return result.rows[0] ? mapStrategy(result.rows[0]) : null;
  }

  async listStrategies(parentUserId: string, studentProfileId: string): Promise<CommunicationTranslationStrategyRecord[]> {
    const result = await query<CommunicationTranslationStrategyRow>(
      `
      select
        communication_strategy_id,
        parent_communication_entry_id,
        parent_user_id,
        student_profile_id,
        household_id,
        source_llm_run_id,
        generation_mode,
        consent_state,
        status,
        recommended_channel,
        recommended_tone,
        recommended_timing,
        recommended_frequency,
        defensiveness_risk,
        reason_for_recommendation,
        student_facing_message_draft,
        parent_facing_explanation,
        what_not_to_say,
        human_review_recommended,
        withhold_delivery,
        withhold_reason,
        structured_payload,
        created_at,
        updated_at
      from communication_translation_strategies
      where parent_user_id = $1
        and student_profile_id = $2
      order by created_at desc
      `,
      [parentUserId, studentProfileId]
    );
    return result.rows.map(mapStrategy);
  }

  async getStrategy(
    communicationStrategyId: string,
    parentUserId: string,
    studentProfileId: string
  ): Promise<CommunicationTranslationStrategyRecord | null> {
    const result = await query<CommunicationTranslationStrategyRow>(
      `
      select
        communication_strategy_id,
        parent_communication_entry_id,
        parent_user_id,
        student_profile_id,
        household_id,
        source_llm_run_id,
        generation_mode,
        consent_state,
        status,
        recommended_channel,
        recommended_tone,
        recommended_timing,
        recommended_frequency,
        defensiveness_risk,
        reason_for_recommendation,
        student_facing_message_draft,
        parent_facing_explanation,
        what_not_to_say,
        human_review_recommended,
        withhold_delivery,
        withhold_reason,
        structured_payload,
        created_at,
        updated_at
      from communication_translation_strategies
      where communication_strategy_id = $1
        and parent_user_id = $2
        and student_profile_id = $3
      limit 1
      `,
      [communicationStrategyId, parentUserId, studentProfileId]
    );
    return result.rows[0] ? mapStrategy(result.rows[0]) : null;
  }

  async updateStrategyStatus(input: {
    communicationStrategyId: string;
    status: TranslationDeliveryStatus;
  }): Promise<void> {
    await query(
      `
      update communication_translation_strategies
      set status = $2,
          updated_at = now()
      where communication_strategy_id = $1
      `,
      [input.communicationStrategyId, input.status]
    );
  }

  async createMessageDraft(record: CommunicationMessageDraftRecord): Promise<void> {
    await query(
      `
      insert into communication_message_drafts (
        communication_message_draft_id,
        communication_strategy_id,
        parent_communication_entry_id,
        parent_user_id,
        student_profile_id,
        household_id,
        selected_channel,
        provider_mode,
        status,
        message_body,
        review_required,
        approved_for_delivery,
        approved_at,
        delivered_at,
        created_at,
        updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now(),now())
      `,
      [
        record.communicationMessageDraftId,
        record.communicationStrategyId,
        record.parentCommunicationEntryId,
        record.parentUserId,
        record.studentProfileId,
        record.householdId ?? null,
        record.selectedChannel,
        record.providerMode,
        record.status,
        record.messageBody,
        record.reviewRequired,
        record.approvedForDelivery,
        record.approvedAt ?? null,
        record.deliveredAt ?? null,
      ]
    );
  }

  async updateDraftStatus(input: {
    communicationMessageDraftId: string;
    status: TranslationDeliveryStatus;
    providerMode: CommunicationMessageDraftRecord["providerMode"];
    approvedForDelivery: boolean;
    deliveredAt?: string | null;
  }): Promise<void> {
    await query(
      `
      update communication_message_drafts
      set
        status = $2,
        provider_mode = $3,
        approved_for_delivery = $4,
        approved_at = case when $4 then coalesce(approved_at, now()) else approved_at end,
        delivered_at = $5,
        updated_at = now()
      where communication_message_draft_id = $1
      `,
      [
        input.communicationMessageDraftId,
        input.status,
        input.providerMode,
        input.approvedForDelivery,
        input.deliveredAt ?? null,
      ]
    );
  }

  async listDrafts(parentUserId: string, studentProfileId: string): Promise<CommunicationMessageDraftRecord[]> {
    const result = await query<CommunicationMessageDraftRow>(
      `
      select
        communication_message_draft_id,
        communication_strategy_id,
        parent_communication_entry_id,
        parent_user_id,
        student_profile_id,
        household_id,
        selected_channel,
        provider_mode,
        status,
        message_body,
        review_required,
        approved_for_delivery,
        approved_at,
        delivered_at,
        created_at,
        updated_at
      from communication_message_drafts
      where parent_user_id = $1
        and student_profile_id = $2
      order by created_at desc
      `,
      [parentUserId, studentProfileId]
    );
    return result.rows.map(mapDraft);
  }

  async getDraft(
    communicationMessageDraftId: string,
    parentUserId: string,
    studentProfileId: string
  ): Promise<CommunicationMessageDraftRecord | null> {
    const result = await query<CommunicationMessageDraftRow>(
      `
      select
        communication_message_draft_id,
        communication_strategy_id,
        parent_communication_entry_id,
        parent_user_id,
        student_profile_id,
        household_id,
        selected_channel,
        provider_mode,
        status,
        message_body,
        review_required,
        approved_for_delivery,
        approved_at,
        delivered_at,
        created_at,
        updated_at
      from communication_message_drafts
      where communication_message_draft_id = $1
        and parent_user_id = $2
        and student_profile_id = $3
      limit 1
      `,
      [communicationMessageDraftId, parentUserId, studentProfileId]
    );
    return result.rows[0] ? mapDraft(result.rows[0]) : null;
  }

  async listStudentReceivedMessages(studentProfileId: string): Promise<CommunicationMessageDraftRecord[]> {
    const result = await query<CommunicationMessageDraftRow>(
      `
      select
        communication_message_draft_id,
        communication_strategy_id,
        parent_communication_entry_id,
        parent_user_id,
        student_profile_id,
        household_id,
        selected_channel,
        provider_mode,
        status,
        message_body,
        review_required,
        approved_for_delivery,
        approved_at,
        delivered_at,
        created_at,
        updated_at
      from communication_message_drafts
      where student_profile_id = $1
        and status = 'delivered'
      order by delivered_at desc nulls last, created_at desc
      `,
      [studentProfileId]
    );
    return result.rows.map(mapDraft);
  }

  async createAuditLog(input: Omit<CommunicationAuditLogRecord, "createdAt">): Promise<void> {
    await query(
      `
      insert into communication_audit_logs (
        communication_audit_log_id,
        parent_communication_entry_id,
        communication_strategy_id,
        communication_message_draft_id,
        student_profile_id,
        household_id,
        actor_user_id,
        actor_role,
        event_type,
        event_summary,
        event_payload,
        created_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
      `,
      [
        input.communicationAuditLogId,
        input.parentCommunicationEntryId ?? null,
        input.communicationStrategyId ?? null,
        input.communicationMessageDraftId ?? null,
        input.studentProfileId,
        input.householdId ?? null,
        input.actorUserId ?? null,
        input.actorRole,
        input.eventType,
        input.eventSummary,
        JSON.stringify(input.eventPayload ?? null),
      ]
    );
  }

  async listAuditLogs(studentProfileId: string, householdId?: string | null): Promise<CommunicationAuditLogRecord[]> {
    const result = await query<CommunicationAuditLogRow>(
      `
      select
        communication_audit_log_id,
        parent_communication_entry_id,
        communication_strategy_id,
        communication_message_draft_id,
        student_profile_id,
        household_id,
        actor_user_id,
        actor_role,
        event_type,
        event_summary,
        event_payload,
        created_at
      from communication_audit_logs
      where student_profile_id = $1
        and ($2::uuid is null or household_id = $2::uuid or household_id is null)
      order by created_at desc
      limit 100
      `,
      [studentProfileId, householdId ?? null]
    );
    return result.rows.map(mapAudit);
  }

  async listParentInputs(communicationProfileId: string, parentUserId?: string): Promise<ParentCommunicationInputRecord[]> {
    const result = await query<ParentCommunicationInputRow>(
      `
      select
        parent_communication_input_id,
        communication_profile_id,
        parent_user_id,
        category,
        prompt_key,
        question_text,
        response_text,
        sensitivity_level,
        visibility_scope,
        confidence_level,
        created_at,
        updated_at
      from parent_communication_inputs
      where communication_profile_id = $1
        and ($2::uuid is null or parent_user_id = $2::uuid)
      order by updated_at desc, created_at desc
      `,
      [communicationProfileId, parentUserId ?? null]
    );
    return result.rows.map(mapParentInput);
  }

  async upsertParentInput(input: ParentCommunicationInputRecord): Promise<void> {
    await query(
      `
      insert into parent_communication_inputs (
        parent_communication_input_id,
        communication_profile_id,
        parent_user_id,
        category,
        prompt_key,
        question_text,
        response_text,
        sensitivity_level,
        visibility_scope,
        confidence_level,
        created_at,
        updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),now())
      on conflict (communication_profile_id, parent_user_id, prompt_key) do update set
        category = excluded.category,
        question_text = excluded.question_text,
        response_text = excluded.response_text,
        sensitivity_level = excluded.sensitivity_level,
        visibility_scope = excluded.visibility_scope,
        confidence_level = excluded.confidence_level,
        updated_at = now()
      `,
      [
        input.parentCommunicationInputId,
        input.communicationProfileId,
        input.parentUserId,
        input.category,
        input.promptKey,
        input.questionText,
        input.responseText,
        input.sensitivityLevel,
        input.visibilityScope,
        input.confidenceLevel,
      ]
    );
  }

  async updateParentInput(input: ParentCommunicationInputRecord): Promise<boolean> {
    const result = await query(
      `
      update parent_communication_inputs
      set
        category = $4,
        question_text = $5,
        response_text = $6,
        sensitivity_level = $7,
        visibility_scope = $8,
        confidence_level = $9,
        updated_at = now()
      where parent_communication_input_id = $1
        and communication_profile_id = $2
        and parent_user_id = $3
      `,
      [
        input.parentCommunicationInputId,
        input.communicationProfileId,
        input.parentUserId,
        input.category,
        input.questionText,
        input.responseText,
        input.sensitivityLevel,
        input.visibilityScope,
        input.confidenceLevel,
      ]
    );
    return (result.rowCount || 0) > 0;
  }

  async deleteParentInput(input: {
    parentCommunicationInputId: string;
    communicationProfileId: string;
    parentUserId: string;
  }): Promise<boolean> {
    const result = await query(
      `
      delete from parent_communication_inputs
      where parent_communication_input_id = $1
        and communication_profile_id = $2
        and parent_user_id = $3
      `,
      [input.parentCommunicationInputId, input.communicationProfileId, input.parentUserId]
    );
    return (result.rowCount || 0) > 0;
  }

  async listStudentInputs(communicationProfileId: string, studentUserId?: string): Promise<StudentCommunicationInputRecord[]> {
    const result = await query<StudentCommunicationInputRow>(
      `
      select
        student_communication_input_id,
        communication_profile_id,
        student_user_id,
        category,
        prompt_key,
        question_text,
        response_text,
        sensitivity_level,
        visibility_scope,
        created_at,
        updated_at
      from student_communication_inputs
      where communication_profile_id = $1
        and ($2::uuid is null or student_user_id = $2::uuid)
      order by updated_at desc, created_at desc
      `,
      [communicationProfileId, studentUserId ?? null]
    );
    return result.rows.map(mapStudentInput);
  }

  async upsertStudentInput(input: StudentCommunicationInputRecord): Promise<void> {
    await query(
      `
      insert into student_communication_inputs (
        student_communication_input_id,
        communication_profile_id,
        student_user_id,
        category,
        prompt_key,
        question_text,
        response_text,
        sensitivity_level,
        visibility_scope,
        created_at,
        updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),now())
      on conflict (communication_profile_id, student_user_id, prompt_key) do update set
        category = excluded.category,
        question_text = excluded.question_text,
        response_text = excluded.response_text,
        sensitivity_level = excluded.sensitivity_level,
        visibility_scope = excluded.visibility_scope,
        updated_at = now()
      `,
      [
        input.studentCommunicationInputId,
        input.communicationProfileId,
        input.studentUserId,
        input.category,
        input.promptKey,
        input.questionText,
        input.responseText,
        input.sensitivityLevel,
        input.visibilityScope,
      ]
    );
  }

  async updateStudentInput(input: StudentCommunicationInputRecord): Promise<boolean> {
    const result = await query(
      `
      update student_communication_inputs
      set
        category = $4,
        question_text = $5,
        response_text = $6,
        sensitivity_level = $7,
        visibility_scope = $8,
        updated_at = now()
      where student_communication_input_id = $1
        and communication_profile_id = $2
        and student_user_id = $3
      `,
      [
        input.studentCommunicationInputId,
        input.communicationProfileId,
        input.studentUserId,
        input.category,
        input.questionText,
        input.responseText,
        input.sensitivityLevel,
        input.visibilityScope,
      ]
    );
    return (result.rowCount || 0) > 0;
  }

  async deleteStudentInput(input: {
    studentCommunicationInputId: string;
    communicationProfileId: string;
    studentUserId: string;
  }): Promise<boolean> {
    const result = await query(
      `
      delete from student_communication_inputs
      where student_communication_input_id = $1
        and communication_profile_id = $2
        and student_user_id = $3
      `,
      [input.studentCommunicationInputId, input.communicationProfileId, input.studentUserId]
    );
    return (result.rowCount || 0) > 0;
  }

  async listPromptProgress(communicationProfileId: string, userId: string, role: CommunicationPromptProgressRecord["role"]) {
    const result = await query<CommunicationPromptProgressRow>(
      `
      select
        communication_prompt_progress_id,
        communication_profile_id,
        user_id,
        role,
        prompt_key,
        status,
        last_prompted_at,
        answered_at,
        updated_at
      from communication_prompt_progress
      where communication_profile_id = $1
        and user_id = $2
        and role = $3
      order by updated_at desc
      `,
      [communicationProfileId, userId, role]
    );
    return result.rows.map(mapPromptProgress);
  }

  async listPromptProgressForProfile(communicationProfileId: string) {
    const result = await query<CommunicationPromptProgressRow>(
      `
      select
        communication_prompt_progress_id,
        communication_profile_id,
        user_id,
        role,
        prompt_key,
        status,
        last_prompted_at,
        answered_at,
        updated_at
      from communication_prompt_progress
      where communication_profile_id = $1
      order by updated_at desc
      `,
      [communicationProfileId]
    );
    return result.rows.map(mapPromptProgress);
  }

  async upsertPromptProgress(record: CommunicationPromptProgressRecord): Promise<void> {
    await query(
      `
      insert into communication_prompt_progress (
        communication_prompt_progress_id,
        communication_profile_id,
        user_id,
        role,
        prompt_key,
        status,
        last_prompted_at,
        answered_at,
        updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,now())
      on conflict (communication_profile_id, user_id, prompt_key) do update set
        status = excluded.status,
        last_prompted_at = excluded.last_prompted_at,
        answered_at = excluded.answered_at,
        updated_at = now()
      `,
      [
        record.communicationPromptProgressId,
        record.communicationProfileId,
        record.userId,
        record.role,
        record.promptKey,
        record.status,
        record.lastPromptedAt ?? null,
        record.answeredAt ?? null,
      ]
    );
  }

  async createTranslationEvent(record: CommunicationTranslationEventRecord): Promise<void> {
    await query(
      `
      insert into communication_translation_events (
        communication_translation_event_id,
        communication_profile_id,
        source_role,
        target_role,
        original_text,
        translated_text,
        translation_goal,
        tone,
        context_used_json,
        structured_result_json,
        feedback_rating,
        feedback_notes,
        created_by_user_id,
        created_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now())
      `,
      [
        record.communicationTranslationEventId,
        record.communicationProfileId,
        record.sourceRole,
        record.targetRole,
        record.originalText,
        record.translatedText,
        record.translationGoal,
        record.tone ?? null,
        JSON.stringify(record.contextUsedJson ?? null),
        JSON.stringify(record.structuredResultJson ?? null),
        record.feedbackRating ?? null,
        record.feedbackNotes ?? null,
        record.createdByUserId,
      ]
    );
  }

  async listTranslationEvents(communicationProfileId: string, limit = 20): Promise<CommunicationTranslationEventRecord[]> {
    const result = await query<CommunicationTranslationEventRow>(
      `
      select
        communication_translation_event_id,
        communication_profile_id,
        source_role,
        target_role,
        original_text,
        translated_text,
        translation_goal,
        tone,
        context_used_json,
        structured_result_json,
        feedback_rating,
        feedback_notes,
        created_by_user_id,
        created_at
      from communication_translation_events
      where communication_profile_id = $1
      order by created_at desc
      limit $2
      `,
      [communicationProfileId, limit]
    );
    return result.rows.map(mapTranslationEvent);
  }

  async updateTranslationFeedback(input: {
    communicationTranslationEventId: string;
    feedbackRating: CommunicationTranslationEventRecord["feedbackRating"];
    feedbackNotes?: string | null;
  }): Promise<boolean> {
    const result = await query(
      `
      update communication_translation_events
      set
        feedback_rating = $2,
        feedback_notes = $3
      where communication_translation_event_id = $1
      `,
      [input.communicationTranslationEventId, input.feedbackRating ?? null, input.feedbackNotes ?? null]
    );
    return (result.rowCount || 0) > 0;
  }

  async createLearningEvent(record: CommunicationLearningEventRecord): Promise<void> {
    await query(
      `
      insert into communication_learning_events (
        communication_learning_event_id,
        communication_profile_id,
        event_type,
        source_role,
        signal_json,
        interpretation_json,
        created_at
      ) values ($1,$2,$3,$4,$5,$6,now())
      `,
      [
        record.communicationLearningEventId,
        record.communicationProfileId,
        record.eventType,
        record.sourceRole,
        JSON.stringify(record.signalJson ?? null),
        JSON.stringify(record.interpretationJson ?? null),
      ]
    );
  }

  async listLearningEvents(communicationProfileId: string, limit = 50): Promise<CommunicationLearningEventRecord[]> {
    const result = await query<CommunicationLearningEventRow>(
      `
      select
        communication_learning_event_id,
        communication_profile_id,
        event_type,
        source_role,
        signal_json,
        interpretation_json,
        created_at
      from communication_learning_events
      where communication_profile_id = $1
      order by created_at desc
      limit $2
      `,
      [communicationProfileId, limit]
    );
    return result.rows.map(mapLearningEvent);
  }

  async listInferredInsights(communicationProfileId: string): Promise<CommunicationInferredInsightRecord[]> {
    const result = await query<CommunicationInferredInsightRow>(
      `
      select
        communication_inferred_insight_id,
        communication_profile_id,
        insight_key,
        insight_type,
        title,
        summary_text,
        evidence_json,
        confidence_label,
        status,
        reviewed_by_user_id,
        reviewed_at,
        review_notes,
        last_derived_at,
        created_at,
        updated_at
      from communication_inferred_insights
      where communication_profile_id = $1
      order by updated_at desc, created_at desc
      `,
      [communicationProfileId]
    );
    return result.rows.map(mapInferredInsight);
  }

  async upsertInferredInsight(record: CommunicationInferredInsightRecord): Promise<void> {
    await query(
      `
      insert into communication_inferred_insights (
        communication_inferred_insight_id,
        communication_profile_id,
        insight_key,
        insight_type,
        title,
        summary_text,
        evidence_json,
        confidence_label,
        status,
        reviewed_by_user_id,
        reviewed_at,
        review_notes,
        last_derived_at,
        created_at,
        updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now(),now())
      on conflict (communication_profile_id, insight_key) do update set
        insight_type = excluded.insight_type,
        title = excluded.title,
        summary_text = excluded.summary_text,
        evidence_json = excluded.evidence_json,
        confidence_label = excluded.confidence_label,
        last_derived_at = excluded.last_derived_at,
        updated_at = now()
      `,
      [
        record.communicationInferredInsightId,
        record.communicationProfileId,
        record.insightKey,
        record.insightType,
        record.title,
        record.summaryText,
        JSON.stringify(record.evidenceJson ?? null),
        record.confidenceLabel,
        record.status,
        record.reviewedByUserId ?? null,
        record.reviewedAt ?? null,
        record.reviewNotes ?? null,
        record.lastDerivedAt ?? null,
      ]
    );
  }

  async reviewInferredInsight(input: {
    communicationInferredInsightId: string;
    communicationProfileId: string;
    status: CommunicationInferredInsightRecord["status"];
    reviewedByUserId: string;
    reviewNotes?: string | null;
  }): Promise<boolean> {
    const result = await query(
      `
      update communication_inferred_insights
      set
        status = $3,
        reviewed_by_user_id = $4,
        reviewed_at = now(),
        review_notes = $5,
        updated_at = now()
      where communication_inferred_insight_id = $1
        and communication_profile_id = $2
      `,
      [
        input.communicationInferredInsightId,
        input.communicationProfileId,
        input.status,
        input.reviewedByUserId,
        input.reviewNotes ?? null,
      ]
    );
    return (result.rowCount || 0) > 0;
  }
}
