import { query } from "../../db/client";

/** Latest row from `parent_monthly_briefs` for API responses. */
export interface ParentBriefRecord {
  parentMonthlyBriefId: string;
  householdId: string | null;
  studentProfileId: string;
  monthLabel: string;
  trajectoryStatus: "on_track" | "watch" | "at_risk";
  keyMarketChanges: string | null;
  progressSummary: string | null;
  topRisks: string | null;
  recommendedParentQuestions: string | null;
  recommendedParentActions: string | null;
  generatedAt: string;
}

export interface ParentBriefInsert {
  parentMonthlyBriefId: string;
  householdId?: string | null;
  studentProfileId: string;
  monthLabel: string;
  trajectoryStatus: "on_track" | "watch" | "at_risk";
  keyMarketChanges?: string | null;
  progressSummary?: string | null;
  topRisks?: string | null;
  recommendedParentQuestions?: string | null;
  recommendedParentActions?: string | null;
}

function mapBriefRow(row: Record<string, unknown>): ParentBriefRecord {
  const genAt = row.generated_at;
  return {
    parentMonthlyBriefId: String(row.parent_monthly_brief_id),
    householdId: row.household_id == null ? null : String(row.household_id),
    studentProfileId: String(row.student_profile_id),
    monthLabel: String(row.month_label),
    trajectoryStatus: row.trajectory_status as ParentBriefRecord["trajectoryStatus"],
    keyMarketChanges: row.key_market_changes == null ? null : String(row.key_market_changes),
    progressSummary: row.progress_summary == null ? null : String(row.progress_summary),
    topRisks: row.top_risks == null ? null : String(row.top_risks),
    recommendedParentQuestions: row.recommended_parent_questions == null ? null : String(row.recommended_parent_questions),
    recommendedParentActions: row.recommended_parent_actions == null ? null : String(row.recommended_parent_actions),
    generatedAt: genAt instanceof Date ? genAt.toISOString() : String(genAt),
  };
}

export class ParentBriefRepository {
  /**
   * Most recently generated brief for this student, scoped by optional household
   * (rows with no `household_id` remain visible; otherwise `household_id` must match when provided).
   */
  async findLatestForContext(params: {
    studentProfileId: string;
    householdId: string | null;
  }): Promise<ParentBriefRecord | null> {
    const result = await query<Record<string, unknown>>(
      `
      select
        parent_monthly_brief_id,
        household_id,
        student_profile_id,
        month_label,
        trajectory_status,
        key_market_changes,
        progress_summary,
        top_risks,
        recommended_parent_questions,
        recommended_parent_actions,
        generated_at
      from parent_monthly_briefs
      where student_profile_id = $1
        and (
          $2::uuid is null
          or household_id is null
          or household_id = $2::uuid
        )
      order by generated_at desc
      limit 1
      `,
      [params.studentProfileId, params.householdId]
    );

    const row = result.rows[0];
    if (!row) return null;
    return mapBriefRow(row);
  }

  /** Persisted brief for the reporting month (e.g. `2026-04`), with the same household scoping as `findLatestForContext`. */
  async findForContextAndMonth(params: {
    studentProfileId: string;
    householdId: string | null;
    monthLabel: string;
  }): Promise<ParentBriefRecord | null> {
    const result = await query<Record<string, unknown>>(
      `
      select
        parent_monthly_brief_id,
        household_id,
        student_profile_id,
        month_label,
        trajectory_status,
        key_market_changes,
        progress_summary,
        top_risks,
        recommended_parent_questions,
        recommended_parent_actions,
        generated_at
      from parent_monthly_briefs
      where student_profile_id = $1
        and month_label = $3
        and (
          $2::uuid is null
          or household_id is null
          or household_id = $2::uuid
        )
      order by generated_at desc
      limit 1
      `,
      [params.studentProfileId, params.householdId, params.monthLabel]
    );

    const row = result.rows[0];
    if (!row) return null;
    return mapBriefRow(row);
  }

  async insertBrief(input: ParentBriefInsert): Promise<void> {
    await query(
      `
      insert into parent_monthly_briefs (
        parent_monthly_brief_id,
        household_id,
        student_profile_id,
        month_label,
        trajectory_status,
        key_market_changes,
        progress_summary,
        top_risks,
        recommended_parent_questions,
        recommended_parent_actions,
        generated_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
      on conflict (parent_monthly_brief_id) do update set
        household_id = excluded.household_id,
        student_profile_id = excluded.student_profile_id,
        month_label = excluded.month_label,
        trajectory_status = excluded.trajectory_status,
        key_market_changes = excluded.key_market_changes,
        progress_summary = excluded.progress_summary,
        top_risks = excluded.top_risks,
        recommended_parent_questions = excluded.recommended_parent_questions,
        recommended_parent_actions = excluded.recommended_parent_actions,
        generated_at = now()
      `,
      [
        input.parentMonthlyBriefId,
        input.householdId ?? null,
        input.studentProfileId,
        input.monthLabel,
        input.trajectoryStatus,
        input.keyMarketChanges ?? null,
        input.progressSummary ?? null,
        input.topRisks ?? null,
        input.recommendedParentQuestions ?? null,
        input.recommendedParentActions ?? null,
      ]
    );
  }
}
