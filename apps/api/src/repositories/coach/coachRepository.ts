import { query } from "../../db/client";
import type {
  CoachActionItemRecord,
  CoachFlagRecord,
  CoachFindingRecord,
  CoachNoteRecord,
  CoachOutboundMessageRecord,
  CoachRecommendationRecord,
  CoachRosterItem,
  CoachStudentRelationshipRecord,
} from "../../../../../packages/shared/src/contracts/coach";

type PermissionColumns = {
  can_view_student_profile: boolean;
  can_view_evidence: boolean;
  can_create_notes: boolean;
  can_create_recommendations: boolean;
  can_create_action_items: boolean;
  can_send_communications: boolean;
  can_view_parent_facing_summaries: boolean;
};

type RelationshipRow = PermissionColumns & {
  coach_student_relationship_id: string;
  coach_user_id: string;
  coach_first_name: string | null;
  coach_last_name: string | null;
  student_profile_id: string;
  student_first_name: string | null;
  student_last_name: string | null;
  household_id: string | null;
  relationship_status: CoachStudentRelationshipRecord["relationshipStatus"];
  start_date: string | null;
  end_date: string | null;
  next_review_date: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  open_action_items: number | null;
  active_flags: number | null;
  last_coach_note_date: string | null;
};

type CoachNoteRow = {
  coach_note_id: string;
  coach_user_id: string;
  coach_first_name: string | null;
  coach_last_name: string | null;
  student_profile_id: string;
  household_id: string | null;
  note_type: CoachNoteRecord["noteType"];
  title: string;
  body: string;
  tags: string[] | null;
  visibility: CoachNoteRecord["visibility"];
  session_date: string | null;
  linked_evidence_ids: string[] | null;
  linked_action_item_ids: string[] | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

type CoachFindingRow = {
  coach_finding_id: string;
  coach_user_id: string;
  coach_first_name: string | null;
  coach_last_name: string | null;
  student_profile_id: string;
  household_id: string | null;
  title: string;
  finding_category: CoachFindingRecord["findingCategory"];
  severity: CoachFindingRecord["severity"];
  evidence_basis: string | null;
  explanation: string;
  visibility: CoachFindingRecord["visibility"];
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

type CoachRecommendationRow = {
  coach_recommendation_id: string;
  coach_user_id: string;
  coach_first_name: string | null;
  coach_last_name: string | null;
  student_profile_id: string;
  household_id: string | null;
  title: string;
  recommendation_category: CoachRecommendationRecord["recommendationCategory"];
  rationale: string;
  recommended_next_step: string;
  expected_benefit: string | null;
  priority: CoachRecommendationRecord["priority"];
  due_date: string | null;
  visibility: CoachRecommendationRecord["visibility"];
  status: CoachRecommendationRecord["status"];
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

type CoachActionItemRow = {
  coach_action_item_id: string;
  coach_user_id: string;
  coach_first_name: string | null;
  coach_last_name: string | null;
  coach_recommendation_id: string | null;
  student_profile_id: string;
  household_id: string | null;
  title: string;
  description: string | null;
  priority: CoachActionItemRecord["priority"];
  due_date: string | null;
  status: CoachActionItemRecord["status"];
  assigned_to: CoachActionItemRecord["assignedTo"];
  visible_to_student: boolean;
  visible_to_parent: boolean;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

type CoachFlagRow = {
  coach_flag_id: string;
  student_profile_id: string;
  household_id: string | null;
  created_by_user_id: string | null;
  created_by_role: CoachFlagRecord["createdByRole"];
  flag_type: CoachFlagRecord["flagType"];
  severity: CoachFlagRecord["severity"];
  title: string;
  description: string;
  status: CoachFlagRecord["status"];
  visibility: CoachFlagRecord["visibility"];
  linked_evidence_ids: string[] | null;
  created_at: string;
  resolved_at: string | null;
  archived_at: string | null;
};

type CoachOutboundMessageRow = {
  coach_outbound_message_id: string;
  coach_user_id: string;
  coach_first_name: string | null;
  coach_last_name: string | null;
  student_profile_id: string;
  household_id: string | null;
  recipient_type: CoachOutboundMessageRecord["recipientType"];
  recipient_user_id: string | null;
  channel: CoachOutboundMessageRecord["channel"];
  subject: string | null;
  body: string;
  status: CoachOutboundMessageRecord["status"];
  provider_mode: CoachOutboundMessageRecord["providerMode"];
  external_message_id: string | null;
  linked_coach_action_item_id: string | null;
  linked_coach_recommendation_id: string | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  archived_at: string | null;
};

export type ParentConcernSummary = {
  parentCommunicationEntryId: string;
  category: string;
  urgency: string;
  parentConcerns: string | null;
  preferredOutcome: string | null;
  updatedAt: string;
};

function displayName(firstName?: string | null, lastName?: string | null): string | null {
  const parts = [firstName, lastName].map((value) => value?.trim()).filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

function mapPermissions(row: PermissionColumns): CoachStudentRelationshipRecord["permissions"] {
  return {
    viewStudentProfile: row.can_view_student_profile,
    viewEvidence: row.can_view_evidence,
    createNotes: row.can_create_notes,
    createRecommendations: row.can_create_recommendations,
    createActionItems: row.can_create_action_items,
    sendCommunications: row.can_send_communications,
    viewParentFacingSummaries: row.can_view_parent_facing_summaries,
  };
}

function mapRelationship(row: RelationshipRow): CoachStudentRelationshipRecord {
  return {
    coachStudentRelationshipId: row.coach_student_relationship_id,
    coachUserId: row.coach_user_id,
    coachDisplayName: displayName(row.coach_first_name, row.coach_last_name),
    studentProfileId: row.student_profile_id,
    studentDisplayName:
      displayName(row.student_first_name, row.student_last_name) || "Student",
    householdId: row.household_id,
    relationshipStatus: row.relationship_status,
    startDate: row.start_date,
    endDate: row.end_date,
    nextReviewDate: row.next_review_date,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    permissions: mapPermissions(row),
  };
}

function mapRosterItem(row: RelationshipRow): CoachRosterItem {
  return {
    ...mapRelationship(row),
    readinessStatus: null,
    evidenceCompletenessStatus: null,
    openActionItems: Number(row.open_action_items || 0),
    activeFlags: Number(row.active_flags || 0),
    lastCoachNoteDate: row.last_coach_note_date,
  };
}

function mapNote(row: CoachNoteRow): CoachNoteRecord {
  return {
    coachNoteId: row.coach_note_id,
    coachUserId: row.coach_user_id,
    coachDisplayName: displayName(row.coach_first_name, row.coach_last_name),
    studentProfileId: row.student_profile_id,
    householdId: row.household_id,
    noteType: row.note_type,
    title: row.title,
    body: row.body,
    tags: row.tags || [],
    visibility: row.visibility,
    sessionDate: row.session_date,
    linkedEvidenceIds: row.linked_evidence_ids || [],
    linkedActionItemIds: row.linked_action_item_ids || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
}

function mapFinding(row: CoachFindingRow): CoachFindingRecord {
  return {
    coachFindingId: row.coach_finding_id,
    coachUserId: row.coach_user_id,
    coachDisplayName: displayName(row.coach_first_name, row.coach_last_name),
    studentProfileId: row.student_profile_id,
    householdId: row.household_id,
    title: row.title,
    findingCategory: row.finding_category,
    severity: row.severity,
    evidenceBasis: row.evidence_basis,
    explanation: row.explanation,
    visibility: row.visibility,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
}

function mapRecommendation(row: CoachRecommendationRow): CoachRecommendationRecord {
  return {
    coachRecommendationId: row.coach_recommendation_id,
    coachUserId: row.coach_user_id,
    coachDisplayName: displayName(row.coach_first_name, row.coach_last_name),
    studentProfileId: row.student_profile_id,
    householdId: row.household_id,
    title: row.title,
    recommendationCategory: row.recommendation_category,
    rationale: row.rationale,
    recommendedNextStep: row.recommended_next_step,
    expectedBenefit: row.expected_benefit,
    priority: row.priority,
    dueDate: row.due_date,
    visibility: row.visibility,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
}

function mapActionItem(row: CoachActionItemRow): CoachActionItemRecord {
  return {
    coachActionItemId: row.coach_action_item_id,
    coachUserId: row.coach_user_id,
    coachDisplayName: displayName(row.coach_first_name, row.coach_last_name),
    coachRecommendationId: row.coach_recommendation_id,
    studentProfileId: row.student_profile_id,
    householdId: row.household_id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    dueDate: row.due_date,
    status: row.status,
    assignedTo: row.assigned_to,
    visibleToStudent: row.visible_to_student,
    visibleToParent: row.visible_to_parent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
}

function mapFlag(row: CoachFlagRow): CoachFlagRecord {
  return {
    coachFlagId: row.coach_flag_id,
    studentProfileId: row.student_profile_id,
    householdId: row.household_id,
    createdByUserId: row.created_by_user_id,
    createdByRole: row.created_by_role,
    title: row.title,
    description: row.description,
    flagType: row.flag_type,
    severity: row.severity,
    status: row.status,
    visibility: row.visibility,
    linkedEvidenceIds: row.linked_evidence_ids || [],
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    archivedAt: row.archived_at,
  };
}

function mapOutboundMessage(row: CoachOutboundMessageRow): CoachOutboundMessageRecord {
  return {
    coachOutboundMessageId: row.coach_outbound_message_id,
    coachUserId: row.coach_user_id,
    coachDisplayName: displayName(row.coach_first_name, row.coach_last_name),
    studentProfileId: row.student_profile_id,
    householdId: row.household_id,
    recipientType: row.recipient_type,
    recipientUserId: row.recipient_user_id,
    channel: row.channel,
    subject: row.subject,
    body: row.body,
    status: row.status,
    providerMode: row.provider_mode,
    externalMessageId: row.external_message_id,
    linkedCoachActionItemId: row.linked_coach_action_item_id,
    linkedCoachRecommendationId: row.linked_coach_recommendation_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sentAt: row.sent_at,
    archivedAt: row.archived_at,
  };
}

function visibilityClauseForViewer(viewer: "student" | "parent") {
  if (viewer === "student") {
    return `visibility in ('student_visible','student_and_parent_visible')`;
  }
  return `visibility in ('parent_visible','student_and_parent_visible')`;
}

export class CoachRepository {
  async listRelationshipsForCoach(coachUserId: string): Promise<CoachRosterItem[]> {
    const result = await query<RelationshipRow>(
      `
      select
        csr.coach_student_relationship_id,
        csr.coach_user_id,
        cu.first_name as coach_first_name,
        cu.last_name as coach_last_name,
        csr.student_profile_id,
        su.first_name as student_first_name,
        su.last_name as student_last_name,
        csr.household_id,
        csr.relationship_status,
        csr.start_date::text,
        csr.end_date::text,
        csr.next_review_date::text,
        csr.created_by_user_id,
        csr.created_at::text,
        csr.updated_at::text,
        csr.can_view_student_profile,
        csr.can_view_evidence,
        csr.can_create_notes,
        csr.can_create_recommendations,
        csr.can_create_action_items,
        csr.can_send_communications,
        csr.can_view_parent_facing_summaries,
        (
          select count(*)
          from coach_action_items cai
          where cai.student_profile_id = csr.student_profile_id
            and cai.archived_at is null
            and cai.status not in ('completed','archived')
        ) as open_action_items,
        (
          select count(*)
          from coach_flags cf
          where cf.student_profile_id = csr.student_profile_id
            and cf.archived_at is null
            and cf.status in ('open','acknowledged')
        ) as active_flags,
        (
          select max(cn.created_at)::text
          from coach_notes cn
          where cn.student_profile_id = csr.student_profile_id
            and cn.archived_at is null
        ) as last_coach_note_date
      from coach_student_relationships csr
      join users cu on cu.user_id = csr.coach_user_id
      join student_profiles sp on sp.student_profile_id = csr.student_profile_id
      join users su on su.user_id = sp.user_id
      where csr.coach_user_id = $1
        and csr.relationship_status <> 'ended'
      order by coalesce(csr.next_review_date, csr.start_date) asc nulls last, su.last_name asc, su.first_name asc
      `,
      [coachUserId]
    );

    return result.rows.map(mapRosterItem);
  }

  async getRelationshipForCoachStudent(
    coachUserId: string,
    studentProfileId: string
  ): Promise<CoachStudentRelationshipRecord | null> {
    const result = await query<RelationshipRow>(
      `
      select
        csr.coach_student_relationship_id,
        csr.coach_user_id,
        cu.first_name as coach_first_name,
        cu.last_name as coach_last_name,
        csr.student_profile_id,
        su.first_name as student_first_name,
        su.last_name as student_last_name,
        csr.household_id,
        csr.relationship_status,
        csr.start_date::text,
        csr.end_date::text,
        csr.next_review_date::text,
        csr.created_by_user_id,
        csr.created_at::text,
        csr.updated_at::text,
        csr.can_view_student_profile,
        csr.can_view_evidence,
        csr.can_create_notes,
        csr.can_create_recommendations,
        csr.can_create_action_items,
        csr.can_send_communications,
        csr.can_view_parent_facing_summaries,
        0 as open_action_items,
        0 as active_flags,
        null::text as last_coach_note_date
      from coach_student_relationships csr
      join users cu on cu.user_id = csr.coach_user_id
      join student_profiles sp on sp.student_profile_id = csr.student_profile_id
      join users su on su.user_id = sp.user_id
      where csr.coach_user_id = $1
        and csr.student_profile_id = $2
        and csr.relationship_status <> 'ended'
      limit 1
      `,
      [coachUserId, studentProfileId]
    );

    const row = result.rows[0];
    return row ? mapRelationship(row) : null;
  }

  async getStudentUserId(studentProfileId: string): Promise<string | null> {
    const result = await query<{ user_id: string }>(
      `select user_id from student_profiles where student_profile_id = $1 limit 1`,
      [studentProfileId]
    );
    return result.rows[0]?.user_id || null;
  }

  async getParentUserIdForHousehold(householdId: string | null | undefined): Promise<string | null> {
    if (!householdId) {
      return null;
    }

    const result = await query<{ user_id: string }>(
      `
      select user_id
      from user_household_roles
      where household_id = $1
        and role_in_household in ('parent','guardian')
      order by is_primary desc, created_at asc
      limit 1
      `,
      [householdId]
    );

    return result.rows[0]?.user_id || null;
  }

  async hasCoachScopeConsent(
    studentUserId: string,
    coachUserId: string,
    scopeType: "parent_summary" | "coach_notes" | "insight_summary" | "chat_summary" = "parent_summary"
  ): Promise<boolean> {
    const result = await query<{ allowed: boolean }>(
      `
      select exists (
        select 1
        from consent_scopes
        where student_user_id = $1
          and grantee_user_id = $2
          and scope_type = $3
          and access_level in ('limited','full')
          and revoked_at is null
          and (expires_at is null or expires_at > now())
      ) as allowed
      `,
      [studentUserId, coachUserId, scopeType]
    );
    return !!result.rows[0]?.allowed;
  }

  async listParentConcernSummaries(studentProfileId: string): Promise<ParentConcernSummary[]> {
    const result = await query<{
      parent_communication_entry_id: string;
      category: string;
      urgency: string;
      parent_concerns: string | null;
      preferred_outcome: string | null;
      updated_at: string;
    }>(
      `
      select
        parent_communication_entry_id,
        category,
        urgency,
        parent_concerns,
        preferred_outcome,
        updated_at::text
      from parent_communication_entries
      where student_profile_id = $1
        and archived_at is null
      order by updated_at desc
      limit 5
      `,
      [studentProfileId]
    );

    return result.rows.map((row) => ({
      parentCommunicationEntryId: row.parent_communication_entry_id,
      category: row.category,
      urgency: row.urgency,
      parentConcerns: row.parent_concerns,
      preferredOutcome: row.preferred_outcome,
      updatedAt: row.updated_at,
    }));
  }

  async listNotesForCoachStudent(coachUserId: string, studentProfileId: string): Promise<CoachNoteRecord[]> {
    const result = await query<CoachNoteRow>(
      `
      select
        cn.coach_note_id,
        cn.coach_user_id,
        cu.first_name as coach_first_name,
        cu.last_name as coach_last_name,
        cn.student_profile_id,
        cn.household_id,
        cn.note_type,
        cn.title,
        cn.body,
        cn.tags,
        cn.visibility,
        cn.session_date::text,
        cn.linked_evidence_ids,
        cn.linked_action_item_ids,
        cn.created_at::text,
        cn.updated_at::text,
        cn.archived_at::text
      from coach_notes cn
      join users cu on cu.user_id = cn.coach_user_id
      where cn.coach_user_id = $1
        and cn.student_profile_id = $2
        and cn.archived_at is null
      order by coalesce(cn.session_date, cn.created_at::date) desc, cn.created_at desc
      limit 20
      `,
      [coachUserId, studentProfileId]
    );

    return result.rows.map(mapNote);
  }

  async listVisibleNotesForViewer(
    studentProfileId: string,
    viewer: "student" | "parent"
  ): Promise<CoachNoteRecord[]> {
    const result = await query<CoachNoteRow>(
      `
      select
        cn.coach_note_id,
        cn.coach_user_id,
        cu.first_name as coach_first_name,
        cu.last_name as coach_last_name,
        cn.student_profile_id,
        cn.household_id,
        cn.note_type,
        cn.title,
        cn.body,
        cn.tags,
        cn.visibility,
        cn.session_date::text,
        cn.linked_evidence_ids,
        cn.linked_action_item_ids,
        cn.created_at::text,
        cn.updated_at::text,
        cn.archived_at::text
      from coach_notes cn
      join users cu on cu.user_id = cn.coach_user_id
      where cn.student_profile_id = $1
        and cn.archived_at is null
        and ${visibilityClauseForViewer(viewer)}
      order by coalesce(cn.session_date, cn.created_at::date) desc, cn.created_at desc
      limit 6
      `,
      [studentProfileId]
    );

    return result.rows.map(mapNote);
  }

  async createNote(input: {
    coachNoteId: string;
    coachUserId: string;
    studentProfileId: string;
    householdId?: string | null;
    noteType: CoachNoteRecord["noteType"];
    title: string;
    body: string;
    tags?: string[];
    visibility: CoachNoteRecord["visibility"];
    sessionDate?: string | null;
    linkedEvidenceIds?: string[];
    linkedActionItemIds?: string[];
  }) {
    await query(
      `
      insert into coach_notes (
        coach_note_id, coach_user_id, student_profile_id, household_id, note_type,
        title, body, tags, visibility, session_date, linked_evidence_ids, linked_action_item_ids,
        created_at, updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now(),now())
      `,
      [
        input.coachNoteId,
        input.coachUserId,
        input.studentProfileId,
        input.householdId ?? null,
        input.noteType,
        input.title,
        input.body,
        input.tags ?? [],
        input.visibility,
        input.sessionDate ?? null,
        input.linkedEvidenceIds ?? [],
        input.linkedActionItemIds ?? [],
      ]
    );
  }

  async listFindingsForCoachStudent(coachUserId: string, studentProfileId: string): Promise<CoachFindingRecord[]> {
    const result = await query<CoachFindingRow>(
      `
      select
        cf.coach_finding_id,
        cf.coach_user_id,
        cu.first_name as coach_first_name,
        cu.last_name as coach_last_name,
        cf.student_profile_id,
        cf.household_id,
        cf.title,
        cf.finding_category,
        cf.severity,
        cf.evidence_basis,
        cf.explanation,
        cf.visibility,
        cf.created_at::text,
        cf.updated_at::text,
        cf.archived_at::text
      from coach_findings cf
      join users cu on cu.user_id = cf.coach_user_id
      where cf.coach_user_id = $1
        and cf.student_profile_id = $2
        and cf.archived_at is null
      order by cf.created_at desc
      limit 20
      `,
      [coachUserId, studentProfileId]
    );
    return result.rows.map(mapFinding);
  }

  async createFinding(input: {
    coachFindingId: string;
    coachUserId: string;
    studentProfileId: string;
    householdId?: string | null;
    title: string;
    findingCategory: CoachFindingRecord["findingCategory"];
    severity: CoachFindingRecord["severity"];
    evidenceBasis?: string | null;
    explanation: string;
    visibility: CoachFindingRecord["visibility"];
  }) {
    await query(
      `
      insert into coach_findings (
        coach_finding_id, coach_user_id, student_profile_id, household_id, title,
        finding_category, severity, evidence_basis, explanation, visibility, created_at, updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),now())
      `,
      [
        input.coachFindingId,
        input.coachUserId,
        input.studentProfileId,
        input.householdId ?? null,
        input.title,
        input.findingCategory,
        input.severity,
        input.evidenceBasis ?? null,
        input.explanation,
        input.visibility,
      ]
    );
  }

  async listRecommendationsForCoachStudent(
    coachUserId: string,
    studentProfileId: string
  ): Promise<CoachRecommendationRecord[]> {
    const result = await query<CoachRecommendationRow>(
      `
      select
        cr.coach_recommendation_id,
        cr.coach_user_id,
        cu.first_name as coach_first_name,
        cu.last_name as coach_last_name,
        cr.student_profile_id,
        cr.household_id,
        cr.title,
        cr.recommendation_category,
        cr.rationale,
        cr.recommended_next_step,
        cr.expected_benefit,
        cr.priority,
        cr.due_date::text,
        cr.visibility,
        cr.status,
        cr.created_at::text,
        cr.updated_at::text,
        cr.archived_at::text
      from coach_recommendations cr
      join users cu on cu.user_id = cr.coach_user_id
      where cr.coach_user_id = $1
        and cr.student_profile_id = $2
        and cr.archived_at is null
      order by cr.created_at desc
      limit 25
      `,
      [coachUserId, studentProfileId]
    );
    return result.rows.map(mapRecommendation);
  }

  async listVisibleRecommendationsForViewer(
    studentProfileId: string,
    viewer: "student" | "parent"
  ): Promise<CoachRecommendationRecord[]> {
    const result = await query<CoachRecommendationRow>(
      `
      select
        cr.coach_recommendation_id,
        cr.coach_user_id,
        cu.first_name as coach_first_name,
        cu.last_name as coach_last_name,
        cr.student_profile_id,
        cr.household_id,
        cr.title,
        cr.recommendation_category,
        cr.rationale,
        cr.recommended_next_step,
        cr.expected_benefit,
        cr.priority,
        cr.due_date::text,
        cr.visibility,
        cr.status,
        cr.created_at::text,
        cr.updated_at::text,
        cr.archived_at::text
      from coach_recommendations cr
      join users cu on cu.user_id = cr.coach_user_id
      where cr.student_profile_id = $1
        and cr.archived_at is null
        and cr.status <> 'archived'
        and ${visibilityClauseForViewer(viewer)}
      order by cr.created_at desc
      limit 10
      `,
      [studentProfileId]
    );
    return result.rows.map(mapRecommendation);
  }

  async createRecommendation(input: {
    coachRecommendationId: string;
    coachUserId: string;
    studentProfileId: string;
    householdId?: string | null;
    title: string;
    recommendationCategory: CoachRecommendationRecord["recommendationCategory"];
    rationale: string;
    recommendedNextStep: string;
    expectedBenefit?: string | null;
    priority: CoachRecommendationRecord["priority"];
    dueDate?: string | null;
    visibility: CoachRecommendationRecord["visibility"];
    status: CoachRecommendationRecord["status"];
  }) {
    await query(
      `
      insert into coach_recommendations (
        coach_recommendation_id, coach_user_id, student_profile_id, household_id, title,
        recommendation_category, rationale, recommended_next_step, expected_benefit,
        priority, due_date, visibility, status, created_at, updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now(),now())
      `,
      [
        input.coachRecommendationId,
        input.coachUserId,
        input.studentProfileId,
        input.householdId ?? null,
        input.title,
        input.recommendationCategory,
        input.rationale,
        input.recommendedNextStep,
        input.expectedBenefit ?? null,
        input.priority,
        input.dueDate ?? null,
        input.visibility,
        input.status,
      ]
    );
  }

  async listActionItemsForCoachStudent(coachUserId: string, studentProfileId: string): Promise<CoachActionItemRecord[]> {
    const result = await query<CoachActionItemRow>(
      `
      select
        cai.coach_action_item_id,
        cai.coach_user_id,
        cu.first_name as coach_first_name,
        cu.last_name as coach_last_name,
        cai.coach_recommendation_id,
        cai.student_profile_id,
        cai.household_id,
        cai.title,
        cai.description,
        cai.priority,
        cai.due_date::text,
        cai.status,
        cai.assigned_to,
        cai.visible_to_student,
        cai.visible_to_parent,
        cai.created_at::text,
        cai.updated_at::text,
        cai.archived_at::text
      from coach_action_items cai
      join users cu on cu.user_id = cai.coach_user_id
      where cai.coach_user_id = $1
        and cai.student_profile_id = $2
        and cai.archived_at is null
      order by cai.created_at desc
      limit 30
      `,
      [coachUserId, studentProfileId]
    );
    return result.rows.map(mapActionItem);
  }

  async listVisibleActionItemsForViewer(
    studentProfileId: string,
    viewer: "student" | "parent"
  ): Promise<CoachActionItemRecord[]> {
    const visibilityColumn = viewer === "student" ? "visible_to_student" : "visible_to_parent";
    const result = await query<CoachActionItemRow>(
      `
      select
        cai.coach_action_item_id,
        cai.coach_user_id,
        cu.first_name as coach_first_name,
        cu.last_name as coach_last_name,
        cai.coach_recommendation_id,
        cai.student_profile_id,
        cai.household_id,
        cai.title,
        cai.description,
        cai.priority,
        cai.due_date::text,
        cai.status,
        cai.assigned_to,
        cai.visible_to_student,
        cai.visible_to_parent,
        cai.created_at::text,
        cai.updated_at::text,
        cai.archived_at::text
      from coach_action_items cai
      join users cu on cu.user_id = cai.coach_user_id
      where cai.student_profile_id = $1
        and cai.archived_at is null
        and cai.status <> 'archived'
        and cai.${visibilityColumn} = true
      order by coalesce(cai.due_date, cai.created_at::date) asc, cai.created_at desc
      limit 10
      `,
      [studentProfileId]
    );
    return result.rows.map(mapActionItem);
  }

  async createActionItem(input: {
    coachActionItemId: string;
    coachUserId: string;
    coachRecommendationId?: string | null;
    studentProfileId: string;
    householdId?: string | null;
    title: string;
    description?: string | null;
    priority: CoachActionItemRecord["priority"];
    dueDate?: string | null;
    status: CoachActionItemRecord["status"];
    assignedTo: CoachActionItemRecord["assignedTo"];
    visibleToStudent: boolean;
    visibleToParent: boolean;
  }) {
    await query(
      `
      insert into coach_action_items (
        coach_action_item_id, coach_user_id, coach_recommendation_id, student_profile_id,
        household_id, title, description, priority, due_date, status, assigned_to,
        visible_to_student, visible_to_parent, created_at, updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now(),now())
      `,
      [
        input.coachActionItemId,
        input.coachUserId,
        input.coachRecommendationId ?? null,
        input.studentProfileId,
        input.householdId ?? null,
        input.title,
        input.description ?? null,
        input.priority,
        input.dueDate ?? null,
        input.status,
        input.assignedTo,
        input.visibleToStudent,
        input.visibleToParent,
      ]
    );
  }

  async listFlagsForCoachStudent(coachUserId: string, studentProfileId: string): Promise<CoachFlagRecord[]> {
    const result = await query<CoachFlagRow>(
      `
      select
        coach_flag_id,
        student_profile_id,
        household_id,
        created_by_user_id,
        created_by_role,
        flag_type,
        severity,
        title,
        description,
        status,
        visibility,
        linked_evidence_ids,
        created_at::text,
        resolved_at::text,
        archived_at::text
      from coach_flags
      where student_profile_id = $1
        and archived_at is null
        and (
          created_by_user_id = $2
          or created_by_role in ('system','admin')
        )
      order by created_at desc
      limit 25
      `,
      [studentProfileId, coachUserId]
    );
    return result.rows.map(mapFlag);
  }

  async listVisibleFlagsForViewer(studentProfileId: string, viewer: "student" | "parent"): Promise<CoachFlagRecord[]> {
    const result = await query<CoachFlagRow>(
      `
      select
        coach_flag_id,
        student_profile_id,
        household_id,
        created_by_user_id,
        created_by_role,
        flag_type,
        severity,
        title,
        description,
        status,
        visibility,
        linked_evidence_ids,
        created_at::text,
        resolved_at::text,
        archived_at::text
      from coach_flags
      where student_profile_id = $1
        and archived_at is null
        and status in ('open','acknowledged','resolved')
        and ${visibilityClauseForViewer(viewer)}
      order by created_at desc
      limit 10
      `,
      [studentProfileId]
    );
    return result.rows.map(mapFlag);
  }

  async createFlag(input: {
    coachFlagId: string;
    studentProfileId: string;
    householdId?: string | null;
    createdByUserId?: string | null;
    createdByRole: CoachFlagRecord["createdByRole"];
    flagType: CoachFlagRecord["flagType"];
    severity: CoachFlagRecord["severity"];
    title: string;
    description: string;
    status: CoachFlagRecord["status"];
    visibility: CoachFlagRecord["visibility"];
    linkedEvidenceIds?: string[];
  }) {
    await query(
      `
      insert into coach_flags (
        coach_flag_id, student_profile_id, household_id, created_by_user_id, created_by_role,
        flag_type, severity, title, description, status, visibility, linked_evidence_ids, created_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now())
      `,
      [
        input.coachFlagId,
        input.studentProfileId,
        input.householdId ?? null,
        input.createdByUserId ?? null,
        input.createdByRole,
        input.flagType,
        input.severity,
        input.title,
        input.description,
        input.status,
        input.visibility,
        input.linkedEvidenceIds ?? [],
      ]
    );
  }

  async listOutboundMessagesForCoachStudent(
    coachUserId: string,
    studentProfileId: string
  ): Promise<CoachOutboundMessageRecord[]> {
    const result = await query<CoachOutboundMessageRow>(
      `
      select
        com.coach_outbound_message_id,
        com.coach_user_id,
        cu.first_name as coach_first_name,
        cu.last_name as coach_last_name,
        com.student_profile_id,
        com.household_id,
        com.recipient_type,
        com.recipient_user_id,
        com.channel,
        com.subject,
        com.body,
        com.status,
        com.provider_mode,
        com.external_message_id,
        com.linked_coach_action_item_id,
        com.linked_coach_recommendation_id,
        com.created_at::text,
        com.updated_at::text,
        com.sent_at::text,
        com.archived_at::text
      from coach_outbound_messages com
      join users cu on cu.user_id = com.coach_user_id
      where com.coach_user_id = $1
        and com.student_profile_id = $2
        and com.archived_at is null
      order by com.created_at desc
      limit 20
      `,
      [coachUserId, studentProfileId]
    );
    return result.rows.map(mapOutboundMessage);
  }

  async getOutboundMessageForCoachStudent(
    coachUserId: string,
    studentProfileId: string,
    coachOutboundMessageId: string
  ): Promise<CoachOutboundMessageRecord | null> {
    const result = await query<CoachOutboundMessageRow>(
      `
      select
        com.coach_outbound_message_id,
        com.coach_user_id,
        cu.first_name as coach_first_name,
        cu.last_name as coach_last_name,
        com.student_profile_id,
        com.household_id,
        com.recipient_type,
        com.recipient_user_id,
        com.channel,
        com.subject,
        com.body,
        com.status,
        com.provider_mode,
        com.external_message_id,
        com.linked_coach_action_item_id,
        com.linked_coach_recommendation_id,
        com.created_at::text,
        com.updated_at::text,
        com.sent_at::text,
        com.archived_at::text
      from coach_outbound_messages com
      join users cu on cu.user_id = com.coach_user_id
      where com.coach_user_id = $1
        and com.student_profile_id = $2
        and com.coach_outbound_message_id = $3
      limit 1
      `,
      [coachUserId, studentProfileId, coachOutboundMessageId]
    );
    const row = result.rows[0];
    return row ? mapOutboundMessage(row) : null;
  }

  async createOutboundMessage(input: {
    coachOutboundMessageId: string;
    coachUserId: string;
    studentProfileId: string;
    householdId?: string | null;
    recipientType: CoachOutboundMessageRecord["recipientType"];
    recipientUserId?: string | null;
    channel: CoachOutboundMessageRecord["channel"];
    subject?: string | null;
    body: string;
    status: CoachOutboundMessageRecord["status"];
    providerMode: CoachOutboundMessageRecord["providerMode"];
    linkedCoachActionItemId?: string | null;
    linkedCoachRecommendationId?: string | null;
  }) {
    await query(
      `
      insert into coach_outbound_messages (
        coach_outbound_message_id, coach_user_id, student_profile_id, household_id, recipient_type,
        recipient_user_id, channel, subject, body, status, provider_mode, linked_coach_action_item_id,
        linked_coach_recommendation_id, created_at, updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now(),now())
      `,
      [
        input.coachOutboundMessageId,
        input.coachUserId,
        input.studentProfileId,
        input.householdId ?? null,
        input.recipientType,
        input.recipientUserId ?? null,
        input.channel,
        input.subject ?? null,
        input.body,
        input.status,
        input.providerMode,
        input.linkedCoachActionItemId ?? null,
        input.linkedCoachRecommendationId ?? null,
      ]
    );
  }

  async updateOutboundMessageStatus(input: {
    coachOutboundMessageId: string;
    status: CoachOutboundMessageRecord["status"];
    providerMode: CoachOutboundMessageRecord["providerMode"];
    externalMessageId?: string | null;
    sentAt?: string | null;
  }) {
    await query(
      `
      update coach_outbound_messages
      set
        status = $2,
        provider_mode = $3,
        external_message_id = $4,
        sent_at = $5,
        updated_at = now()
      where coach_outbound_message_id = $1
      `,
      [
        input.coachOutboundMessageId,
        input.status,
        input.providerMode,
        input.externalMessageId ?? null,
        input.sentAt ?? null,
      ]
    );
  }
}
