import { getDbPool, query } from "../../db/client";
import type {
  JobTargetSourceType,
  StudentJobTargetRecord,
} from "../../../../../packages/shared/src/contracts/career";

type JobTargetRow = {
  job_target_id: string;
  student_profile_id: string;
  title: string;
  employer: string | null;
  location: string | null;
  source_type: JobTargetSourceType;
  source_url: string | null;
  job_description_text: string | null;
  normalized_role_family: string | null;
  normalized_sector_cluster: string | null;
  onet_code: string | null;
  normalization_confidence: string | number | null;
  normalization_confidence_label: "low" | "medium" | "high" | null;
  normalization_reasoning: string | null;
  normalization_source: "deterministic" | "llm" | null;
  normalization_truth_status: "direct" | "inferred" | "placeholder" | "fallback" | "unresolved";
  is_primary: boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function mapRow(row: JobTargetRow): StudentJobTargetRecord {
  return {
    jobTargetId: row.job_target_id,
    studentProfileId: row.student_profile_id,
    title: row.title,
    employer: row.employer,
    location: row.location,
    sourceType: row.source_type,
    sourceUrl: row.source_url,
    jobDescriptionText: row.job_description_text,
    normalizedRoleFamily: row.normalized_role_family,
    normalizedSectorCluster: row.normalized_sector_cluster,
    onetCode: row.onet_code,
    normalizationConfidence:
      row.normalization_confidence == null ? null : Number(row.normalization_confidence),
    normalizationConfidenceLabel: row.normalization_confidence_label,
    normalizationReasoning: row.normalization_reasoning,
    normalizationSource: row.normalization_source,
    normalizationTruthStatus: row.normalization_truth_status,
    isPrimary: !!row.is_primary,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

export class JobTargetRepository {
  async listForStudent(studentProfileId: string): Promise<StudentJobTargetRecord[]> {
    const result = await query<JobTargetRow>(
      `
      select
        job_target_id,
        student_profile_id,
        title,
        employer,
        location,
        source_type,
        source_url,
        job_description_text,
        normalized_role_family,
        normalized_sector_cluster,
        onet_code,
        normalization_confidence,
        normalization_confidence_label,
        normalization_reasoning,
        normalization_source,
        normalization_truth_status,
        is_primary,
        created_at,
        updated_at
      from job_targets
      where student_profile_id = $1
      order by is_primary desc, updated_at desc, created_at desc
      `,
      [studentProfileId]
    );

    return result.rows.map(mapRow);
  }

  async getPrimaryForStudent(studentProfileId: string): Promise<StudentJobTargetRecord | null> {
    const result = await query<JobTargetRow>(
      `
      select
        job_target_id,
        student_profile_id,
        title,
        employer,
        location,
        source_type,
        source_url,
        job_description_text,
        normalized_role_family,
        normalized_sector_cluster,
        onet_code,
        normalization_confidence,
        normalization_confidence_label,
        normalization_reasoning,
        normalization_source,
        normalization_truth_status,
        is_primary,
        created_at,
        updated_at
      from job_targets
      where student_profile_id = $1
        and is_primary = true
      order by updated_at desc
      limit 1
      `,
      [studentProfileId]
    );

    const row = result.rows[0];
    return row ? mapRow(row) : null;
  }

  async getByIdForStudent(studentProfileId: string, jobTargetId: string): Promise<StudentJobTargetRecord | null> {
    const result = await query<JobTargetRow>(
      `
      select
        job_target_id,
        student_profile_id,
        title,
        employer,
        location,
        source_type,
        source_url,
        job_description_text,
        normalized_role_family,
        normalized_sector_cluster,
        onet_code,
        normalization_confidence,
        normalization_confidence_label,
        normalization_reasoning,
        normalization_source,
        normalization_truth_status,
        is_primary,
        created_at,
        updated_at
      from job_targets
      where student_profile_id = $1
        and job_target_id = $2
      limit 1
      `,
      [studentProfileId, jobTargetId]
    );

    const row = result.rows[0];
    return row ? mapRow(row) : null;
  }

  async create(input: {
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
    normalizationConfidenceLabel?: "low" | "medium" | "high" | null;
    normalizationReasoning?: string | null;
    normalizationSource?: "deterministic" | "llm" | null;
    normalizationTruthStatus?: "direct" | "inferred" | "placeholder" | "fallback" | "unresolved";
    isPrimary: boolean;
  }): Promise<void> {
    const pool = getDbPool();
    const client = await pool.connect();

    try {
      await client.query("begin");

      if (input.isPrimary) {
        await client.query(
          `
          update job_targets
          set is_primary = false,
              updated_at = now()
          where student_profile_id = $1
            and is_primary = true
          `,
          [input.studentProfileId]
        );
      }

      await client.query(
        `
        insert into job_targets (
          job_target_id,
          student_profile_id,
          title,
          employer,
          location,
          source_type,
          source_url,
          job_description_text,
          normalized_role_family,
          normalized_sector_cluster,
          onet_code,
          normalization_confidence,
          normalization_confidence_label,
          normalization_reasoning,
          normalization_source,
          normalization_truth_status,
          is_primary,
          created_at,
          updated_at
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,now(),now())
        `,
        [
          input.jobTargetId,
          input.studentProfileId,
          input.title,
          input.employer ?? null,
          input.location ?? null,
          input.sourceType,
          input.sourceUrl ?? null,
          input.jobDescriptionText ?? null,
          input.normalizedRoleFamily ?? null,
          input.normalizedSectorCluster ?? null,
          input.onetCode ?? null,
          input.normalizationConfidence ?? null,
          input.normalizationConfidenceLabel ?? null,
          input.normalizationReasoning ?? null,
          input.normalizationSource ?? null,
          input.normalizationTruthStatus ?? "unresolved",
          input.isPrimary,
        ]
      );

      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async setPrimary(studentProfileId: string, jobTargetId: string): Promise<boolean> {
    const pool = getDbPool();
    const client = await pool.connect();

    try {
      await client.query("begin");

      const exists = await client.query<{ job_target_id: string }>(
        `
        select job_target_id
        from job_targets
        where student_profile_id = $1
          and job_target_id = $2
        limit 1
        `,
        [studentProfileId, jobTargetId]
      );

      if (!exists.rowCount) {
        await client.query("rollback");
        return false;
      }

      await client.query(
        `
        update job_targets
        set is_primary = false,
            updated_at = now()
        where student_profile_id = $1
          and is_primary = true
        `,
        [studentProfileId]
      );

      await client.query(
        `
        update job_targets
        set is_primary = true,
            updated_at = now()
        where student_profile_id = $1
          and job_target_id = $2
        `,
        [studentProfileId, jobTargetId]
      );

      await client.query("commit");
      return true;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async updateNormalization(input: {
    studentProfileId: string;
    jobTargetId: string;
    normalizedRoleFamily?: string | null;
    normalizedSectorCluster?: string | null;
    onetCode?: string | null;
    normalizationConfidence?: number | null;
    normalizationConfidenceLabel?: "low" | "medium" | "high" | null;
    normalizationReasoning?: string | null;
    normalizationSource?: "deterministic" | "llm" | null;
    normalizationTruthStatus?: "direct" | "inferred" | "placeholder" | "fallback" | "unresolved";
  }): Promise<boolean> {
    const result = await query(
      `
      update job_targets
      set
        normalized_role_family = $3,
        normalized_sector_cluster = $4,
        onet_code = $5,
        normalization_confidence = $6,
        normalization_confidence_label = $7,
        normalization_reasoning = $8,
        normalization_source = $9,
        normalization_truth_status = $10,
        updated_at = now()
      where student_profile_id = $1
        and job_target_id = $2
      `,
      [
        input.studentProfileId,
        input.jobTargetId,
        input.normalizedRoleFamily ?? null,
        input.normalizedSectorCluster ?? null,
        input.onetCode ?? null,
        input.normalizationConfidence ?? null,
        input.normalizationConfidenceLabel ?? null,
        input.normalizationReasoning ?? null,
        input.normalizationSource ?? null,
        input.normalizationTruthStatus ?? "unresolved",
      ]
    );

    return (result.rowCount || 0) > 0;
  }

  async updatePrimaryIntent(input: {
    studentProfileId: string;
    jobTargetId: string;
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
    normalizationConfidenceLabel?: "low" | "medium" | "high" | null;
    normalizationReasoning?: string | null;
    normalizationSource?: "deterministic" | "llm" | null;
    normalizationTruthStatus?: "direct" | "inferred" | "placeholder" | "fallback" | "unresolved";
  }): Promise<boolean> {
    const result = await query(
      `
      update job_targets
      set
        title = $3,
        employer = $4,
        location = $5,
        source_type = $6,
        source_url = $7,
        job_description_text = $8,
        normalized_role_family = $9,
        normalized_sector_cluster = $10,
        onet_code = $11,
        normalization_confidence = $12,
        normalization_confidence_label = $13,
        normalization_reasoning = $14,
        normalization_source = $15,
        normalization_truth_status = $16,
        updated_at = now()
      where student_profile_id = $1
        and job_target_id = $2
      `,
      [
        input.studentProfileId,
        input.jobTargetId,
        input.title,
        input.employer ?? null,
        input.location ?? null,
        input.sourceType,
        input.sourceUrl ?? null,
        input.jobDescriptionText ?? null,
        input.normalizedRoleFamily ?? null,
        input.normalizedSectorCluster ?? null,
        input.onetCode ?? null,
        input.normalizationConfidence ?? null,
        input.normalizationConfidenceLabel ?? null,
        input.normalizationReasoning ?? null,
        input.normalizationSource ?? null,
        input.normalizationTruthStatus ?? "unresolved",
      ]
    );

    return (result.rowCount || 0) > 0;
  }
}
