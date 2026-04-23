import { query } from "../../db/client";

export interface CreateAcademicArtifactInput {
  academicArtifactId: string;
  studentProfileId: string;
  artifactType: string;
  fileUri: string;
  sourceLabel?: string | null;
  parsedStatus?: "pending" | "parsed" | "failed";
  extractedSummary?: string | null;
}

export interface CreateArtifactParseJobInput {
  artifactParseJobId: string;
  academicArtifactId: string;
  studentProfileId: string;
  artifactType: string;
  parserType: string;
}

export interface AcademicArtifactRow {
  academic_artifact_id: string;
  student_profile_id: string;
  artifact_type: string;
  file_uri: string;
  source_label: string | null;
  parsed_status: "pending" | "parsed" | "failed";
  extracted_summary: string | null;
}

export interface UploadTargetRow {
  upload_target_id: string;
  student_profile_id: string;
  artifact_type: string;
  bucket: string;
  object_path: string;
  token_hash: string | null;
  issued_at: string;
  expires_at: string;
  consumed_at: string | null;
}

export interface QueuedParseJobRow {
  artifact_parse_job_id: string;
  academic_artifact_id: string;
  student_profile_id: string;
  artifact_type: string;
  status: "queued" | "processing" | "completed" | "failed";
  parser_type: string;
  queued_at: string;
}

export class ArtifactRepository {
  async upsertUploadTarget(input: {
    uploadTargetId: string;
    studentProfileId: string;
    artifactType: string;
    bucket: string;
    objectPath: string;
    tokenHash?: string | null;
    expiresAt: string;
  }): Promise<void> {
    await query(
      `
      insert into upload_targets (
        upload_target_id,
        student_profile_id,
        artifact_type,
        bucket,
        object_path,
        token_hash,
        issued_at,
        expires_at,
        consumed_at
      ) values ($1,$2,$3,$4,$5,$6,now(),$7,null)
      on conflict (object_path) do update set
        student_profile_id = excluded.student_profile_id,
        artifact_type = excluded.artifact_type,
        bucket = excluded.bucket,
        token_hash = excluded.token_hash,
        issued_at = now(),
        expires_at = excluded.expires_at,
        consumed_at = null
      `,
      [
        input.uploadTargetId,
        input.studentProfileId,
        input.artifactType,
        input.bucket,
        input.objectPath,
        input.tokenHash ?? null,
        input.expiresAt,
      ]
    );
  }

  async getUploadTargetByObjectPath(studentProfileId: string, objectPath: string): Promise<UploadTargetRow | null> {
    const result = await query<UploadTargetRow>(
      `
      select
        upload_target_id,
        student_profile_id,
        artifact_type,
        bucket,
        object_path,
        token_hash,
        issued_at,
        expires_at,
        consumed_at
      from upload_targets
      where student_profile_id = $1
        and object_path = $2
      limit 1
      `,
      [studentProfileId, objectPath]
    );
    return result.rows[0] || null;
  }

  async markUploadTargetConsumed(uploadTargetId: string): Promise<void> {
    await query(
      `
      update upload_targets
      set consumed_at = coalesce(consumed_at, now())
      where upload_target_id = $1
      `,
      [uploadTargetId]
    );
  }

  async createAcademicArtifact(input: CreateAcademicArtifactInput): Promise<void> {
    await query(
      `
      insert into academic_artifacts (
        academic_artifact_id,
        student_profile_id,
        artifact_type,
        file_uri,
        source_label,
        uploaded_at,
        parsed_status,
        extracted_summary
      ) values ($1,$2,$3,$4,$5,now(),$6,$7)
      on conflict (academic_artifact_id) do update set
        artifact_type = excluded.artifact_type,
        file_uri = excluded.file_uri,
        source_label = excluded.source_label,
        parsed_status = excluded.parsed_status,
        extracted_summary = excluded.extracted_summary
      `,
      [
        input.academicArtifactId,
        input.studentProfileId,
        input.artifactType,
        input.fileUri,
        input.sourceLabel ?? null,
        input.parsedStatus ?? "pending",
        input.extractedSummary ?? null,
      ]
    );
  }

  async createArtifactParseJob(input: CreateArtifactParseJobInput): Promise<void> {
    await query(
      `
      insert into artifact_parse_jobs (
        artifact_parse_job_id,
        academic_artifact_id,
        student_profile_id,
        artifact_type,
        status,
        parser_type,
        queued_at
      ) values ($1,$2,$3,$4,'queued',$5,now())
      on conflict (artifact_parse_job_id) do update set
        status = 'queued',
        parser_type = excluded.parser_type,
        result_summary = null,
        error_message = null,
        queued_at = now(),
        started_at = null,
        completed_at = null
      `,
      [
        input.artifactParseJobId,
        input.academicArtifactId,
        input.studentProfileId,
        input.artifactType,
        input.parserType,
      ]
    );
  }

  async claimQueuedParseJobs(limit: number = 25): Promise<QueuedParseJobRow[]> {
    const result = await query<QueuedParseJobRow>(
      `
      with claimed as (
        select artifact_parse_job_id
        from artifact_parse_jobs
        where status = 'queued'
        order by queued_at asc
        for update skip locked
        limit $1
      )
      update artifact_parse_jobs jobs
      set status = 'processing',
          started_at = now()
      from claimed
      where jobs.artifact_parse_job_id = claimed.artifact_parse_job_id
      returning
        jobs.artifact_parse_job_id,
        jobs.academic_artifact_id,
        jobs.student_profile_id,
        jobs.artifact_type,
        jobs.status,
        jobs.parser_type,
        jobs.queued_at
      `
      ,
      [limit]
    );
    return result.rows;
  }

  async getAcademicArtifactById(academicArtifactId: string): Promise<AcademicArtifactRow | null> {
    const result = await query<AcademicArtifactRow>(
      `
      select
        academic_artifact_id,
        student_profile_id,
        artifact_type,
        file_uri,
        source_label,
        parsed_status,
        extracted_summary
      from academic_artifacts
      where academic_artifact_id = $1
      limit 1
      `,
      [academicArtifactId]
    );
    return result.rows[0] || null;
  }

  async markParseJobCompleted(jobId: string, resultSummary: string) {
    await query(
      `
      update artifact_parse_jobs
      set status = 'completed',
          result_summary = $2,
          completed_at = now()
      where artifact_parse_job_id = $1
      `,
      [jobId, resultSummary]
    );
  }

  async markParseJobFailed(jobId: string, errorMessage: string) {
    await query(
      `
      update artifact_parse_jobs
      set status = 'failed',
          error_message = $2,
          completed_at = now()
      where artifact_parse_job_id = $1
      `,
      [jobId, errorMessage]
    );
  }

  async markArtifactParsed(artifactId: string, extractedSummary: string) {
    await query(
      `
      update academic_artifacts
      set parsed_status = 'parsed',
          extracted_summary = $2
      where academic_artifact_id = $1
      `,
      [artifactId, extractedSummary]
    );
  }

  async markArtifactFailed(artifactId: string, extractedSummary: string) {
    await query(
      `
      update academic_artifacts
      set parsed_status = 'failed',
          extracted_summary = $2
      where academic_artifact_id = $1
      `,
      [artifactId, extractedSummary]
    );
  }
}
