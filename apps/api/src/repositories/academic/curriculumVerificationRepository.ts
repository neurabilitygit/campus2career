import { query } from "../../db/client";
import type {
  CurriculumVerificationRecord,
  CurriculumVerificationStatus,
  RequirementSetProvenanceMethod,
} from "../../../../../packages/shared/src/contracts/academic";

interface CurriculumReviewRow {
  student_profile_id: string;
  curriculum_verification_status: CurriculumVerificationStatus;
  curriculum_verified_at: string | null;
  curriculum_verified_by_user_id: string | null;
  curriculum_verification_notes: string | null;
  curriculum_source: RequirementSetProvenanceMethod | "unknown" | null;
  curriculum_requested_at: string | null;
  curriculum_requested_by_user_id: string | null;
  curriculum_pdf_upload_id: string | null;
  coach_reviewed_at: string | null;
  coach_reviewed_by_user_id: string | null;
}

function mapRow(row: CurriculumReviewRow): CurriculumVerificationRecord {
  return {
    curriculumVerificationStatus: row.curriculum_verification_status,
    curriculumVerifiedAt: row.curriculum_verified_at,
    curriculumVerifiedByUserId: row.curriculum_verified_by_user_id,
    curriculumVerificationNotes: row.curriculum_verification_notes,
    curriculumSource: row.curriculum_source,
    curriculumRequestedAt: row.curriculum_requested_at,
    curriculumRequestedByUserId: row.curriculum_requested_by_user_id,
    curriculumPdfUploadId: row.curriculum_pdf_upload_id,
    coachReviewedAt: row.coach_reviewed_at,
    coachReviewedByUserId: row.coach_reviewed_by_user_id,
  };
}

export class CurriculumVerificationRepository {
  async getForStudent(studentProfileId: string): Promise<CurriculumVerificationRecord | null> {
    const result = await query<CurriculumReviewRow>(
      `
      select
        student_profile_id,
        curriculum_verification_status,
        curriculum_verified_at,
        curriculum_verified_by_user_id,
        curriculum_verification_notes,
        curriculum_source,
        curriculum_requested_at,
        curriculum_requested_by_user_id,
        curriculum_pdf_upload_id,
        coach_reviewed_at,
        coach_reviewed_by_user_id
      from student_curriculum_reviews
      where student_profile_id = $1
      limit 1
      `,
      [studentProfileId]
    );

    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  async saveVerification(input: {
    studentProfileId: string;
    status: CurriculumVerificationStatus;
    verifiedByUserId: string;
    verifiedAt: string;
    verificationNotes?: string | null;
    curriculumSource?: RequirementSetProvenanceMethod | "unknown" | null;
  }): Promise<void> {
    await query(
      `
      insert into student_curriculum_reviews (
        student_profile_id,
        curriculum_verification_status,
        curriculum_verified_at,
        curriculum_verified_by_user_id,
        curriculum_verification_notes,
        curriculum_source,
        updated_at
      ) values ($1,$2,$3,$4,$5,$6,now())
      on conflict (student_profile_id) do update set
        curriculum_verification_status = excluded.curriculum_verification_status,
        curriculum_verified_at = excluded.curriculum_verified_at,
        curriculum_verified_by_user_id = excluded.curriculum_verified_by_user_id,
        curriculum_verification_notes = excluded.curriculum_verification_notes,
        curriculum_source = coalesce(excluded.curriculum_source, student_curriculum_reviews.curriculum_source),
        updated_at = now()
      `,
      [
        input.studentProfileId,
        input.status,
        input.verifiedAt,
        input.verifiedByUserId,
        input.verificationNotes ?? null,
        input.curriculumSource ?? null,
      ]
    );
  }

  async savePopulationRequest(input: {
    studentProfileId: string;
    requestedByUserId: string;
    requestedAt: string;
    status: CurriculumVerificationStatus;
    curriculumSource?: RequirementSetProvenanceMethod | "unknown" | null;
  }): Promise<void> {
    await query(
      `
      insert into student_curriculum_reviews (
        student_profile_id,
        curriculum_verification_status,
        curriculum_requested_at,
        curriculum_requested_by_user_id,
        curriculum_source,
        updated_at
      ) values ($1,$2,$3,$4,$5,now())
      on conflict (student_profile_id) do update set
        curriculum_verification_status = excluded.curriculum_verification_status,
        curriculum_requested_at = excluded.curriculum_requested_at,
        curriculum_requested_by_user_id = excluded.curriculum_requested_by_user_id,
        curriculum_source = coalesce(excluded.curriculum_source, student_curriculum_reviews.curriculum_source),
        updated_at = now()
      `,
      [
        input.studentProfileId,
        input.status,
        input.requestedAt,
        input.requestedByUserId,
        input.curriculumSource ?? null,
      ]
    );
  }

  async linkPdfUpload(input: {
    studentProfileId: string;
    academicArtifactId: string;
    curriculumSource?: RequirementSetProvenanceMethod | "unknown" | null;
  }): Promise<void> {
    await query(
      `
      insert into student_curriculum_reviews (
        student_profile_id,
        curriculum_verification_status,
        curriculum_pdf_upload_id,
        curriculum_source,
        updated_at
      ) values ($1,'present_unverified',$2,$3,now())
      on conflict (student_profile_id) do update set
        curriculum_pdf_upload_id = excluded.curriculum_pdf_upload_id,
        curriculum_source = coalesce(excluded.curriculum_source, student_curriculum_reviews.curriculum_source),
        curriculum_verification_status =
          case
            when student_curriculum_reviews.curriculum_verification_status = 'verified'
              then student_curriculum_reviews.curriculum_verification_status
            else 'present_unverified'
          end,
        updated_at = now()
      `,
      [input.studentProfileId, input.academicArtifactId, input.curriculumSource ?? null]
    );
  }

  async saveCoachReview(input: {
    studentProfileId: string;
    coachReviewedByUserId: string;
    coachReviewedAt: string;
    curriculumSource?: RequirementSetProvenanceMethod | "unknown" | null;
  }): Promise<void> {
    await query(
      `
      insert into student_curriculum_reviews (
        student_profile_id,
        curriculum_verification_status,
        coach_reviewed_at,
        coach_reviewed_by_user_id,
        curriculum_source,
        updated_at
      ) values ($1,'present_unverified',$2,$3,$4,now())
      on conflict (student_profile_id) do update set
        coach_reviewed_at = excluded.coach_reviewed_at,
        coach_reviewed_by_user_id = excluded.coach_reviewed_by_user_id,
        curriculum_source = coalesce(excluded.curriculum_source, student_curriculum_reviews.curriculum_source),
        updated_at = now()
      `,
      [
        input.studentProfileId,
        input.coachReviewedAt,
        input.coachReviewedByUserId,
        input.curriculumSource ?? null,
      ]
    );
  }
}
