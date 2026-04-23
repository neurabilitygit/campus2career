import { query } from "../../db/client";
import type {
  CommunicationAuditEventType,
  CommunicationAuditLogRecord,
  CommunicationMessageDraftRecord,
  CommunicationTranslationStrategyRecord,
  ParentCommunicationEntryRecord,
  ParentCommunicationEntryStatus,
  ParentCommunicationProfileRecord,
  StudentCommunicationPreferencesRecord,
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

export class CommunicationRepository {
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
}
