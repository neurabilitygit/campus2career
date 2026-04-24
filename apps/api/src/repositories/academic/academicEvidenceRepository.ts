import { query } from "../../db/client";

export interface AcademicDiscoveryAttemptRow {
  academic_discovery_attempt_id: string;
  student_profile_id: string;
  institution_id: string | null;
  academic_catalog_id: string | null;
  discovery_type: "offerings" | "degree_requirements";
  requested_entity_type:
    | "institution"
    | "major"
    | "minor"
    | "concentration"
    | "degree_core"
    | "general_education";
  requested_entity_name: string | null;
  source_attempted: "seeded_database" | "scrape" | "llm_training_data" | "manual_input" | "pdf_upload";
  status: "not_started" | "in_progress" | "succeeded" | "failed" | "questionable" | "needs_review";
  confidence_label: "low" | "medium" | "high" | null;
  truth_status: "direct" | "inferred" | "placeholder" | "fallback" | "unresolved";
  source_url: string | null;
  source_note: string | null;
  reasonableness_notes: string | null;
  raw_result_json: unknown;
  normalized_result_json: unknown;
  created_at: string;
  completed_at: string | null;
  requested_by_user_id: string | null;
}

export class AcademicEvidenceRepository {
  async insertDiscoveryAttempt(input: {
    academicDiscoveryAttemptId: string;
    studentProfileId: string;
    institutionId?: string | null;
    academicCatalogId?: string | null;
    discoveryType: AcademicDiscoveryAttemptRow["discovery_type"];
    requestedEntityType: AcademicDiscoveryAttemptRow["requested_entity_type"];
    requestedEntityName?: string | null;
    sourceAttempted: AcademicDiscoveryAttemptRow["source_attempted"];
    status: AcademicDiscoveryAttemptRow["status"];
    confidenceLabel?: AcademicDiscoveryAttemptRow["confidence_label"];
    truthStatus?: AcademicDiscoveryAttemptRow["truth_status"];
    sourceUrl?: string | null;
    sourceNote?: string | null;
    reasonablenessNotes?: string | null;
    rawResultJson?: unknown;
    normalizedResultJson?: unknown;
    completedAt?: string | null;
    requestedByUserId?: string | null;
  }) {
    await query(
      `
      insert into academic_discovery_attempts (
        academic_discovery_attempt_id,
        student_profile_id,
        institution_id,
        academic_catalog_id,
        discovery_type,
        requested_entity_type,
        requested_entity_name,
        source_attempted,
        status,
        confidence_label,
        truth_status,
        source_url,
        source_note,
        reasonableness_notes,
        raw_result_json,
        normalized_result_json,
        completed_at,
        requested_by_user_id
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb,$17,$18)
      `,
      [
        input.academicDiscoveryAttemptId,
        input.studentProfileId,
        input.institutionId ?? null,
        input.academicCatalogId ?? null,
        input.discoveryType,
        input.requestedEntityType,
        input.requestedEntityName ?? null,
        input.sourceAttempted,
        input.status,
        input.confidenceLabel ?? null,
        input.truthStatus ?? "unresolved",
        input.sourceUrl ?? null,
        input.sourceNote ?? null,
        input.reasonablenessNotes ?? null,
        input.rawResultJson ? JSON.stringify(input.rawResultJson) : null,
        input.normalizedResultJson ? JSON.stringify(input.normalizedResultJson) : null,
        input.completedAt ?? null,
        input.requestedByUserId ?? null,
      ]
    );
  }

  async listRecentDiscoveryAttempts(studentProfileId: string, limit = 12): Promise<AcademicDiscoveryAttemptRow[]> {
    const result = await query<AcademicDiscoveryAttemptRow>(
      `
      select *
      from academic_discovery_attempts
      where student_profile_id = $1
      order by created_at desc
      limit $2
      `,
      [studentProfileId, Math.max(1, Math.min(limit, 50))]
    );
    return result.rows;
  }

  async updateCatalogDiscoveryMetadata(input: {
    academicCatalogId: string;
    discoveryStatus: "not_started" | "in_progress" | "succeeded" | "failed" | "questionable" | "needs_review";
    discoveryStartedAt?: string | null;
    discoveryCompletedAt?: string | null;
    discoverySource?: "seeded_database" | "scrape" | "llm_training_data" | "manual_input" | "pdf_upload" | null;
    discoveryConfidenceLabel?: "low" | "medium" | "high" | null;
    discoveryTruthStatus?: "direct" | "inferred" | "placeholder" | "fallback" | "unresolved";
    discoveryNotes?: string | null;
  }) {
    await query(
      `
      update academic_catalogs
      set
        discovery_status = $2,
        discovery_started_at = coalesce($3, discovery_started_at),
        discovery_completed_at = coalesce($4, discovery_completed_at),
        discovery_source = coalesce($5, discovery_source),
        discovery_confidence_label = coalesce($6, discovery_confidence_label),
        discovery_truth_status = coalesce($7, discovery_truth_status),
        discovery_notes = coalesce($8, discovery_notes)
      where academic_catalog_id = $1
      `,
      [
        input.academicCatalogId,
        input.discoveryStatus,
        input.discoveryStartedAt ?? null,
        input.discoveryCompletedAt ?? null,
        input.discoverySource ?? null,
        input.discoveryConfidenceLabel ?? null,
        input.discoveryTruthStatus ?? null,
        input.discoveryNotes ?? null,
      ]
    );
  }
}
