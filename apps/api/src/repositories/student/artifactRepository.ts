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

export class ArtifactRepository {
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

  async listQueuedParseJobs() {
    const result = await query(
      `
      select
        artifact_parse_job_id,
        academic_artifact_id,
        student_profile_id,
        artifact_type,
        status,
        parser_type,
        queued_at
      from artifact_parse_jobs
      where status = 'queued'
      order by queued_at asc
      limit 25
      `
    );
    return result.rows;
  }

  async markParseJobProcessing(jobId: string) {
    await query(
      `
      update artifact_parse_jobs
      set status = 'processing',
          started_at = now()
      where artifact_parse_job_id = $1
      `,
      [jobId]
    );
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
}
