import { executeQuery, type DbExecutor } from "../../db/client";
import type {
  CareerScenarioActionItemRecord,
  CareerScenarioAnalysisResult,
  CareerScenarioAssumptions,
  CareerScenarioExtractedRequirements,
  CareerScenarioRecord,
  CareerScenarioSourceType,
  CareerScenarioStatus,
  CareerScenarioSummary,
} from "../../../../../packages/shared/src/contracts/careerScenario";
import type { RecommendationItem, ScoringOutput } from "../../../../../packages/shared/src/scoring/types";

type CareerScenarioRow = {
  career_scenario_id: string;
  student_profile_id: string;
  linked_job_target_id: string | null;
  scenario_name: string;
  status: CareerScenarioStatus;
  is_active: boolean;
  job_description_text: string | null;
  target_role: string | null;
  target_profession: string | null;
  target_industry: string | null;
  target_sector: string | null;
  target_geography: string | null;
  employer_name: string | null;
  job_posting_url: string | null;
  notes: string | null;
  assumptions_json: CareerScenarioAssumptions | null;
  extracted_requirements_json: CareerScenarioExtractedRequirements | null;
  analysis_result_json: CareerScenarioAnalysisResult | null;
  readiness_score_snapshot_json: ScoringOutput | null;
  recommendations_snapshot_json: RecommendationItem[] | null;
  source_type: CareerScenarioSourceType;
  created_by_user_id: string | null;
  updated_by_user_id: string | null;
  created_at: string | Date;
  updated_at: string | Date;
  last_run_at: string | Date | null;
  deleted_at: string | Date | null;
};

type CareerScenarioActionItemRow = {
  career_scenario_action_item_id: string;
  career_scenario_id: string;
  student_profile_id: string;
  title: string;
  description: string | null;
  rationale: string | null;
  action_category: string | null;
  priority: "high" | "medium" | "low";
  timeframe: string | null;
  source_kind: "scenario_specific" | "recommendation" | "evidence_gap";
  status: "active" | "completed" | "dismissed";
  sort_order: number;
  created_at: string | Date;
  updated_at: string | Date;
};

function toIsoString(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function mapRow(row: CareerScenarioRow): CareerScenarioRecord {
  return {
    careerScenarioId: row.career_scenario_id,
    studentProfileId: row.student_profile_id,
    linkedJobTargetId: row.linked_job_target_id,
    scenarioName: row.scenario_name,
    status: row.status,
    isActive: !!row.is_active,
    jobDescriptionText: row.job_description_text,
    targetRole: row.target_role,
    targetProfession: row.target_profession,
    targetIndustry: row.target_industry,
    targetSector: row.target_sector,
    targetGeography: row.target_geography,
    employerName: row.employer_name,
    jobPostingUrl: row.job_posting_url,
    notes: row.notes,
    assumptions: row.assumptions_json || {},
    extractedRequirements: row.extracted_requirements_json,
    analysisResult: row.analysis_result_json,
    readinessScoreSnapshot: row.readiness_score_snapshot_json,
    recommendationsSnapshot: row.recommendations_snapshot_json,
    sourceType: row.source_type,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
    createdAt: toIsoString(row.created_at) || new Date(0).toISOString(),
    updatedAt: toIsoString(row.updated_at) || new Date(0).toISOString(),
    lastRunAt: toIsoString(row.last_run_at),
    deletedAt: toIsoString(row.deleted_at),
  };
}

function mapActionItemRow(row: CareerScenarioActionItemRow): CareerScenarioActionItemRecord {
  return {
    careerScenarioActionItemId: row.career_scenario_action_item_id,
    careerScenarioId: row.career_scenario_id,
    studentProfileId: row.student_profile_id,
    title: row.title,
    description: row.description,
    rationale: row.rationale,
    actionCategory: row.action_category,
    priority: row.priority,
    timeframe: row.timeframe,
    sourceKind: row.source_kind,
    status: row.status,
    sortOrder: row.sort_order,
    createdAt: toIsoString(row.created_at) || new Date(0).toISOString(),
    updatedAt: toIsoString(row.updated_at) || new Date(0).toISOString(),
  };
}

function mapSummary(row: CareerScenarioRow): CareerScenarioSummary {
  return {
    careerScenarioId: row.career_scenario_id,
    scenarioName: row.scenario_name,
    status: row.status,
    isActive: !!row.is_active,
    targetRole: row.target_role,
    targetProfession: row.target_profession,
    employerName: row.employer_name,
    sourceType: row.source_type,
    lastRunAt: toIsoString(row.last_run_at),
    updatedAt: toIsoString(row.updated_at) || new Date(0).toISOString(),
  };
}

const selectColumns = `
  career_scenario_id,
  student_profile_id,
  linked_job_target_id,
  scenario_name,
  status,
  is_active,
  job_description_text,
  target_role,
  target_profession,
  target_industry,
  target_sector,
  target_geography,
  employer_name,
  job_posting_url,
  notes,
  assumptions_json,
  extracted_requirements_json,
  analysis_result_json,
  readiness_score_snapshot_json,
  recommendations_snapshot_json,
  source_type,
  created_by_user_id,
  updated_by_user_id,
  created_at,
  updated_at,
  last_run_at,
  deleted_at
`;

export class CareerScenarioRepository {
  async listForStudent(studentProfileId: string, executor?: DbExecutor): Promise<CareerScenarioSummary[]> {
    const result = await executeQuery<CareerScenarioRow>(
      executor,
      `
      select ${selectColumns}
      from career_scenarios
      where student_profile_id = $1
        and deleted_at is null
      order by is_active desc, updated_at desc, created_at desc
      `,
      [studentProfileId]
    );
    return result.rows.map(mapSummary);
  }

  async getById(studentProfileId: string, careerScenarioId: string, executor?: DbExecutor): Promise<CareerScenarioRecord | null> {
    const result = await executeQuery<CareerScenarioRow>(
      executor,
      `
      select ${selectColumns}
      from career_scenarios
      where student_profile_id = $1
        and career_scenario_id = $2
        and deleted_at is null
      limit 1
      `,
      [studentProfileId, careerScenarioId]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  async getActiveForStudent(studentProfileId: string, executor?: DbExecutor): Promise<CareerScenarioRecord | null> {
    const result = await executeQuery<CareerScenarioRow>(
      executor,
      `
      select ${selectColumns}
      from career_scenarios
      where student_profile_id = $1
        and deleted_at is null
        and is_active = true
      limit 1
      `,
      [studentProfileId]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  async getByName(studentProfileId: string, scenarioName: string, executor?: DbExecutor): Promise<CareerScenarioRecord | null> {
    const result = await executeQuery<CareerScenarioRow>(
      executor,
      `
      select ${selectColumns}
      from career_scenarios
      where student_profile_id = $1
        and deleted_at is null
        and lower(scenario_name) = lower($2)
      limit 1
      `,
      [studentProfileId, scenarioName]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  async create(
    input: {
      careerScenarioId: string;
      studentProfileId: string;
      linkedJobTargetId?: string | null;
      scenarioName: string;
      status: CareerScenarioStatus;
      isActive: boolean;
      jobDescriptionText?: string | null;
      targetRole?: string | null;
      targetProfession?: string | null;
      targetIndustry?: string | null;
      targetSector?: string | null;
      targetGeography?: string | null;
      employerName?: string | null;
      jobPostingUrl?: string | null;
      notes?: string | null;
      assumptions?: CareerScenarioAssumptions;
      extractedRequirements?: CareerScenarioExtractedRequirements | null;
      analysisResult?: CareerScenarioAnalysisResult | null;
      readinessScoreSnapshot?: ScoringOutput | null;
      recommendationsSnapshot?: RecommendationItem[] | null;
      sourceType: CareerScenarioSourceType;
      createdByUserId?: string | null;
      updatedByUserId?: string | null;
      lastRunAt?: string | null;
    },
    executor?: DbExecutor
  ): Promise<void> {
    await executeQuery(
      executor,
      `
      insert into career_scenarios (
        career_scenario_id,
        student_profile_id,
        linked_job_target_id,
        scenario_name,
        status,
        is_active,
        job_description_text,
        target_role,
        target_profession,
        target_industry,
        target_sector,
        target_geography,
        employer_name,
        job_posting_url,
        notes,
        assumptions_json,
        extracted_requirements_json,
        analysis_result_json,
        readiness_score_snapshot_json,
        recommendations_snapshot_json,
        source_type,
        created_by_user_id,
        updated_by_user_id,
        created_at,
        updated_at,
        last_run_at
      ) values (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
        $16::jsonb,$17::jsonb,$18::jsonb,$19::jsonb,$20::jsonb,$21,$22,$23,now(),now(),$24
      )
      `,
      [
        input.careerScenarioId,
        input.studentProfileId,
        input.linkedJobTargetId ?? null,
        input.scenarioName,
        input.status,
        input.isActive,
        input.jobDescriptionText ?? null,
        input.targetRole ?? null,
        input.targetProfession ?? null,
        input.targetIndustry ?? null,
        input.targetSector ?? null,
        input.targetGeography ?? null,
        input.employerName ?? null,
        input.jobPostingUrl ?? null,
        input.notes ?? null,
        JSON.stringify(input.assumptions || {}),
        JSON.stringify(input.extractedRequirements || null),
        JSON.stringify(input.analysisResult || null),
        JSON.stringify(input.readinessScoreSnapshot || null),
        JSON.stringify(input.recommendationsSnapshot || null),
        input.sourceType,
        input.createdByUserId ?? null,
        input.updatedByUserId ?? null,
        input.lastRunAt ?? null,
      ]
    );
  }

  async update(
    input: {
      careerScenarioId: string;
      studentProfileId: string;
      linkedJobTargetId?: string | null;
      scenarioName: string;
      status: CareerScenarioStatus;
      isActive: boolean;
      jobDescriptionText?: string | null;
      targetRole?: string | null;
      targetProfession?: string | null;
      targetIndustry?: string | null;
      targetSector?: string | null;
      targetGeography?: string | null;
      employerName?: string | null;
      jobPostingUrl?: string | null;
      notes?: string | null;
      assumptions?: CareerScenarioAssumptions;
      extractedRequirements?: CareerScenarioExtractedRequirements | null;
      analysisResult?: CareerScenarioAnalysisResult | null;
      readinessScoreSnapshot?: ScoringOutput | null;
      recommendationsSnapshot?: RecommendationItem[] | null;
      sourceType: CareerScenarioSourceType;
      updatedByUserId?: string | null;
      lastRunAt?: string | null;
    },
    executor?: DbExecutor
  ): Promise<void> {
    await executeQuery(
      executor,
      `
      update career_scenarios
      set
        linked_job_target_id = $3,
        scenario_name = $4,
        status = $5,
        is_active = $6,
        job_description_text = $7,
        target_role = $8,
        target_profession = $9,
        target_industry = $10,
        target_sector = $11,
        target_geography = $12,
        employer_name = $13,
        job_posting_url = $14,
        notes = $15,
        assumptions_json = $16::jsonb,
        extracted_requirements_json = $17::jsonb,
        analysis_result_json = $18::jsonb,
        readiness_score_snapshot_json = $19::jsonb,
        recommendations_snapshot_json = $20::jsonb,
        source_type = $21,
        updated_by_user_id = $22,
        updated_at = now(),
        last_run_at = $23
      where student_profile_id = $1
        and career_scenario_id = $2
        and deleted_at is null
      `,
      [
        input.studentProfileId,
        input.careerScenarioId,
        input.linkedJobTargetId ?? null,
        input.scenarioName,
        input.status,
        input.isActive,
        input.jobDescriptionText ?? null,
        input.targetRole ?? null,
        input.targetProfession ?? null,
        input.targetIndustry ?? null,
        input.targetSector ?? null,
        input.targetGeography ?? null,
        input.employerName ?? null,
        input.jobPostingUrl ?? null,
        input.notes ?? null,
        JSON.stringify(input.assumptions || {}),
        JSON.stringify(input.extractedRequirements || null),
        JSON.stringify(input.analysisResult || null),
        JSON.stringify(input.readinessScoreSnapshot || null),
        JSON.stringify(input.recommendationsSnapshot || null),
        input.sourceType,
        input.updatedByUserId ?? null,
        input.lastRunAt ?? null,
      ]
    );
  }

  async clearActive(studentProfileId: string, executor?: DbExecutor): Promise<void> {
    await executeQuery(
      executor,
      `
      update career_scenarios
      set is_active = false,
          status = case when status = 'active' then 'complete' else status end,
          updated_at = now()
      where student_profile_id = $1
        and deleted_at is null
        and is_active = true
      `,
      [studentProfileId]
    );
  }

  async setActive(studentProfileId: string, careerScenarioId: string, updatedByUserId?: string | null, executor?: DbExecutor): Promise<void> {
    await this.clearActive(studentProfileId, executor);
    await executeQuery(
      executor,
      `
      update career_scenarios
      set is_active = true,
          status = case when status in ('draft', 'complete') then 'active' else status end,
          updated_by_user_id = $3,
          updated_at = now()
      where student_profile_id = $1
        and career_scenario_id = $2
        and deleted_at is null
      `,
      [studentProfileId, careerScenarioId, updatedByUserId ?? null]
    );
  }

  async markNeedsRerunForStudent(studentProfileId: string, executor?: DbExecutor): Promise<void> {
    await executeQuery(
      executor,
      `
      update career_scenarios
      set
        status = case
          when status in ('active', 'complete') then 'needs_rerun'
          else status
        end,
        updated_at = now()
      where student_profile_id = $1
        and deleted_at is null
      `,
      [studentProfileId]
    );
  }

  async listActionItemsForScenario(
    studentProfileId: string,
    careerScenarioId: string,
    executor?: DbExecutor
  ): Promise<CareerScenarioActionItemRecord[]> {
    const result = await executeQuery<CareerScenarioActionItemRow>(
      executor,
      `
      select
        career_scenario_action_item_id,
        career_scenario_id,
        student_profile_id,
        title,
        description,
        rationale,
        action_category,
        priority,
        timeframe,
        source_kind,
        status,
        sort_order,
        created_at,
        updated_at
      from career_scenario_action_items
      where student_profile_id = $1
        and career_scenario_id = $2
      order by sort_order asc, updated_at desc
      `,
      [studentProfileId, careerScenarioId]
    );
    return result.rows.map(mapActionItemRow);
  }

  async replaceActionItemsForScenario(
    studentProfileId: string,
    careerScenarioId: string,
    items: CareerScenarioActionItemRecord[],
    executor?: DbExecutor
  ): Promise<void> {
    await executeQuery(
      executor,
      `
      delete from career_scenario_action_items
      where student_profile_id = $1
        and career_scenario_id = $2
      `,
      [studentProfileId, careerScenarioId]
    );

    for (const item of items) {
      await executeQuery(
        executor,
        `
        insert into career_scenario_action_items (
          career_scenario_action_item_id,
          career_scenario_id,
          student_profile_id,
          title,
          description,
          rationale,
          action_category,
          priority,
          timeframe,
          source_kind,
          status,
          sort_order,
          created_at,
          updated_at
        ) values (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now(),now()
        )
        `,
        [
          item.careerScenarioActionItemId,
          careerScenarioId,
          studentProfileId,
          item.title,
          item.description ?? null,
          item.rationale ?? null,
          item.actionCategory ?? null,
          item.priority,
          item.timeframe ?? null,
          item.sourceKind,
          item.status,
          item.sortOrder,
        ]
      );
    }
  }

  async softDelete(studentProfileId: string, careerScenarioId: string, updatedByUserId?: string | null, executor?: DbExecutor): Promise<void> {
    await executeQuery(
      executor,
      `
      update career_scenarios
      set deleted_at = now(),
          is_active = false,
          status = 'archived',
          updated_by_user_id = $3,
          updated_at = now()
      where student_profile_id = $1
        and career_scenario_id = $2
        and deleted_at is null
      `,
      [studentProfileId, careerScenarioId, updatedByUserId ?? null]
    );
  }
}
