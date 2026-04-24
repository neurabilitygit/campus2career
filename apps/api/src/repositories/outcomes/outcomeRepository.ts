import { query } from "../../db/client";
import type {
  OutcomeStatus,
  OutcomeType,
  OutcomeVerificationStatus,
  StudentOutcomeRecord,
  StudentOutcomeSummary,
} from "../../../../../packages/shared/src/contracts/outcomes";

type OutcomeRow = {
  student_outcome_id: string;
  student_profile_id: string;
  household_id: string | null;
  job_target_id: string | null;
  target_role_family: string | null;
  target_sector_cluster: string | null;
  outcome_type: StudentOutcomeRecord["outcomeType"];
  status: StudentOutcomeRecord["status"];
  employer_name: string | null;
  role_title: string | null;
  source_type: StudentOutcomeRecord["sourceType"];
  reported_by_user_id: string | null;
  reported_by_role: StudentOutcomeRecord["reportedByRole"];
  verification_status: StudentOutcomeRecord["verificationStatus"];
  action_date: Date | string;
  action_date_label: StudentOutcomeRecord["actionDateLabel"];
  notes: string | null;
  archived_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

function toIsoString(value: Date | string | null): string | null {
  if (value == null) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : String(value);
}

function mapRow(row: OutcomeRow): StudentOutcomeRecord {
  return {
    studentOutcomeId: row.student_outcome_id,
    studentProfileId: row.student_profile_id,
    householdId: row.household_id,
    jobTargetId: row.job_target_id,
    targetRoleFamily: row.target_role_family,
    targetSectorCluster: row.target_sector_cluster,
    outcomeType: row.outcome_type,
    status: row.status,
    employerName: row.employer_name,
    roleTitle: row.role_title,
    sourceType: row.source_type,
    reportedByUserId: row.reported_by_user_id,
    reportedByRole: row.reported_by_role,
    verificationStatus: row.verification_status,
    actionDate: toIsoString(row.action_date) || "",
    actionDateLabel: row.action_date_label,
    notes: row.notes,
    archivedAt: toIsoString(row.archived_at),
    createdAt: toIsoString(row.created_at) || "",
    updatedAt: toIsoString(row.updated_at) || "",
  };
}

function emptyCountsByType(): Record<OutcomeType, number> {
  return {
    internship_application: 0,
    interview: 0,
    offer: 0,
    accepted_role: 0,
  };
}

function emptyCountsByStatus(): Record<OutcomeStatus, number> {
  return {
    not_started: 0,
    in_progress: 0,
    applied: 0,
    interviewing: 0,
    offer: 0,
    accepted: 0,
  };
}

function emptyCountsByVerification(): Record<OutcomeVerificationStatus, number> {
  return {
    self_reported: 0,
    coach_reviewed: 0,
    parent_reported: 0,
    verified: 0,
    disputed: 0,
  };
}

export class OutcomeRepository {
  async listForStudent(studentProfileId: string, options?: { includeArchived?: boolean }) {
    const includeArchived = options?.includeArchived ?? false;
    const result = await query<OutcomeRow>(
      `
      select
        student_outcome_id,
        student_profile_id,
        household_id,
        job_target_id,
        target_role_family,
        target_sector_cluster,
        outcome_type,
        status,
        employer_name,
        role_title,
        source_type,
        reported_by_user_id,
        reported_by_role,
        verification_status,
        action_date,
        action_date_label,
        notes,
        archived_at,
        created_at,
        updated_at
      from student_outcomes
      where student_profile_id = $1
        and ($2::boolean = true or archived_at is null)
      order by action_date desc, created_at desc
      `,
      [studentProfileId, includeArchived]
    );

    return result.rows.map(mapRow);
  }

  async getByIdForStudent(studentProfileId: string, studentOutcomeId: string) {
    const result = await query<OutcomeRow>(
      `
      select
        student_outcome_id,
        student_profile_id,
        household_id,
        job_target_id,
        target_role_family,
        target_sector_cluster,
        outcome_type,
        status,
        employer_name,
        role_title,
        source_type,
        reported_by_user_id,
        reported_by_role,
        verification_status,
        action_date,
        action_date_label,
        notes,
        archived_at,
        created_at,
        updated_at
      from student_outcomes
      where student_profile_id = $1
        and student_outcome_id = $2
      limit 1
      `,
      [studentProfileId, studentOutcomeId]
    );

    const row = result.rows[0];
    return row ? mapRow(row) : null;
  }

  async create(input: {
    studentOutcomeId: string;
    studentProfileId: string;
    householdId?: string | null;
    jobTargetId?: string | null;
    targetRoleFamily?: string | null;
    targetSectorCluster?: string | null;
    outcomeType: StudentOutcomeRecord["outcomeType"];
    status: StudentOutcomeRecord["status"];
    employerName?: string | null;
    roleTitle?: string | null;
    sourceType: StudentOutcomeRecord["sourceType"];
    reportedByUserId?: string | null;
    reportedByRole: StudentOutcomeRecord["reportedByRole"];
    verificationStatus: StudentOutcomeRecord["verificationStatus"];
    actionDate: string;
    actionDateLabel: StudentOutcomeRecord["actionDateLabel"];
    notes?: string | null;
  }) {
    await query(
      `
      insert into student_outcomes (
        student_outcome_id,
        student_profile_id,
        household_id,
        job_target_id,
        target_role_family,
        target_sector_cluster,
        outcome_type,
        status,
        employer_name,
        role_title,
        source_type,
        reported_by_user_id,
        reported_by_role,
        verification_status,
        action_date,
        action_date_label,
        notes,
        created_at,
        updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,now(),now())
      `,
      [
        input.studentOutcomeId,
        input.studentProfileId,
        input.householdId ?? null,
        input.jobTargetId ?? null,
        input.targetRoleFamily ?? null,
        input.targetSectorCluster ?? null,
        input.outcomeType,
        input.status,
        input.employerName ?? null,
        input.roleTitle ?? null,
        input.sourceType,
        input.reportedByUserId ?? null,
        input.reportedByRole,
        input.verificationStatus,
        input.actionDate,
        input.actionDateLabel,
        input.notes ?? null,
      ]
    );
  }

  async updateForStudent(
    studentProfileId: string,
    studentOutcomeId: string,
    input: {
      jobTargetId?: string | null;
      targetRoleFamily?: string | null;
      targetSectorCluster?: string | null;
      outcomeType: StudentOutcomeRecord["outcomeType"];
      status: StudentOutcomeRecord["status"];
      employerName?: string | null;
      roleTitle?: string | null;
      actionDate: string;
      actionDateLabel: StudentOutcomeRecord["actionDateLabel"];
      notes?: string | null;
      verificationStatus?: StudentOutcomeRecord["verificationStatus"];
      sourceType?: StudentOutcomeRecord["sourceType"];
      reportedByRole?: StudentOutcomeRecord["reportedByRole"];
      reportedByUserId?: string | null;
    }
  ): Promise<boolean> {
    const result = await query(
      `
      update student_outcomes
      set
        job_target_id = $3,
        target_role_family = $4,
        target_sector_cluster = $5,
        outcome_type = $6,
        status = $7,
        employer_name = $8,
        role_title = $9,
        action_date = $10,
        action_date_label = $11,
        notes = $12,
        verification_status = coalesce($13, verification_status),
        source_type = coalesce($14, source_type),
        reported_by_role = coalesce($15, reported_by_role),
        reported_by_user_id = coalesce($16, reported_by_user_id),
        updated_at = now()
      where student_profile_id = $1
        and student_outcome_id = $2
        and archived_at is null
      `,
      [
        studentProfileId,
        studentOutcomeId,
        input.jobTargetId ?? null,
        input.targetRoleFamily ?? null,
        input.targetSectorCluster ?? null,
        input.outcomeType,
        input.status,
        input.employerName ?? null,
        input.roleTitle ?? null,
        input.actionDate,
        input.actionDateLabel,
        input.notes ?? null,
        input.verificationStatus ?? null,
        input.sourceType ?? null,
        input.reportedByRole ?? null,
        input.reportedByUserId ?? null,
      ]
    );

    return (result.rowCount || 0) > 0;
  }

  async archiveForStudent(studentProfileId: string, studentOutcomeId: string): Promise<boolean> {
    const result = await query(
      `
      update student_outcomes
      set archived_at = now(),
          updated_at = now()
      where student_profile_id = $1
        and student_outcome_id = $2
        and archived_at is null
      `,
      [studentProfileId, studentOutcomeId]
    );

    return (result.rowCount || 0) > 0;
  }

  async markCoachReviewed(studentProfileId: string, studentOutcomeId: string): Promise<boolean> {
    const result = await query(
      `
      update student_outcomes
      set verification_status = 'coach_reviewed',
          updated_at = now()
      where student_profile_id = $1
        and student_outcome_id = $2
        and archived_at is null
      `,
      [studentProfileId, studentOutcomeId]
    );

    return (result.rowCount || 0) > 0;
  }

  async getSummaryForStudent(studentProfileId: string): Promise<StudentOutcomeSummary> {
    const outcomes = await this.listForStudent(studentProfileId);
    const countsByType = emptyCountsByType();
    const countsByStatus = emptyCountsByStatus();
    const countsByVerification = emptyCountsByVerification();

    for (const outcome of outcomes) {
      countsByType[outcome.outcomeType] += 1;
      countsByStatus[outcome.status] += 1;
      countsByVerification[outcome.verificationStatus] += 1;
    }

    return {
      totalActive: outcomes.length,
      countsByType,
      countsByStatus,
      countsByVerification,
      latestActionDate: outcomes[0]?.actionDate ?? null,
      hasOutcomeData: outcomes.length > 0,
    };
  }
}
