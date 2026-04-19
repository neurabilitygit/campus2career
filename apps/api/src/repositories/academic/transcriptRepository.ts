import { query } from "../../db/client";

export interface StudentTranscriptRow {
  student_transcript_id: string;
  student_profile_id: string;
  academic_artifact_id: string | null;
  institution_id: string | null;
  parsed_status: "pending" | "parsed" | "matched" | "review_required" | "failed";
  transcript_summary: string | null;
}

export interface TranscriptTermRow {
  transcript_term_id: string;
  student_transcript_id: string;
  term_label: string;
  term_start_date: string | null;
  term_end_date: string | null;
  display_order: number | null;
}

export interface TranscriptCourseRow {
  transcript_course_id: string;
  transcript_term_id: string;
  raw_course_code: string | null;
  raw_course_title: string;
  credits_attempted: number | null;
  credits_earned: number | null;
  grade: string | null;
  completion_status: "completed" | "in_progress" | "withdrawn" | "transfer" | "ap_ib" | "failed" | "repeated";
  raw_text_excerpt: string | null;
}

export interface TranscriptCourseMatchRow {
  transcript_course_match_id: string;
  transcript_course_id: string;
  catalog_course_id: string | null;
  match_status: "exact" | "fuzzy" | "manual" | "unmatched";
  confidence_score: number | null;
  reviewer_note: string | null;
}

export interface TranscriptCourseWithMatchRow extends TranscriptCourseRow {
  transcript_term_id: string;
  transcript_course_match_id: string | null;
  catalog_course_id: string | null;
  match_status: "exact" | "fuzzy" | "manual" | "unmatched" | null;
  confidence_score: number | null;
  reviewer_note: string | null;
}

export class TranscriptRepository {
  async upsertStudentTranscript(input: {
    studentTranscriptId: string;
    studentProfileId: string;
    academicArtifactId?: string | null;
    institutionId?: string | null;
    parsedStatus?: "pending" | "parsed" | "matched" | "review_required" | "failed";
    transcriptSummary?: string | null;
  }): Promise<void> {
    await query(
      `
      insert into student_transcripts (
        student_transcript_id,
        student_profile_id,
        academic_artifact_id,
        institution_id,
        parsed_status,
        transcript_summary,
        created_at,
        updated_at
      ) values ($1,$2,$3,$4,$5,$6,now(),now())
      on conflict (student_transcript_id) do update set
        academic_artifact_id = excluded.academic_artifact_id,
        institution_id = excluded.institution_id,
        parsed_status = excluded.parsed_status,
        transcript_summary = excluded.transcript_summary,
        updated_at = now()
      `,
      [
        input.studentTranscriptId,
        input.studentProfileId,
        input.academicArtifactId ?? null,
        input.institutionId ?? null,
        input.parsedStatus ?? "pending",
        input.transcriptSummary ?? null,
      ]
    );
  }

  async replaceTranscriptTerms(studentTranscriptId: string, terms: Array<{
    transcriptTermId: string;
    termLabel: string;
    termStartDate?: string | null;
    termEndDate?: string | null;
    displayOrder?: number | null;
  }>): Promise<void> {
    await query(`delete from transcript_terms where student_transcript_id = $1`, [studentTranscriptId]);

    for (const term of terms) {
      await query(
        `
        insert into transcript_terms (
          transcript_term_id,
          student_transcript_id,
          term_label,
          term_start_date,
          term_end_date,
          display_order
        ) values ($1,$2,$3,$4,$5,$6)
        `,
        [
          term.transcriptTermId,
          studentTranscriptId,
          term.termLabel,
          term.termStartDate ?? null,
          term.termEndDate ?? null,
          term.displayOrder ?? null,
        ]
      );
    }
  }

  async replaceTranscriptCourses(transcriptTermId: string, courses: Array<{
    transcriptCourseId: string;
    rawCourseCode?: string | null;
    rawCourseTitle: string;
    creditsAttempted?: number | null;
    creditsEarned?: number | null;
    grade?: string | null;
    completionStatus: "completed" | "in_progress" | "withdrawn" | "transfer" | "ap_ib" | "failed" | "repeated";
    rawTextExcerpt?: string | null;
  }>): Promise<void> {
    await query(`delete from transcript_courses where transcript_term_id = $1`, [transcriptTermId]);

    for (const course of courses) {
      await query(
        `
        insert into transcript_courses (
          transcript_course_id,
          transcript_term_id,
          raw_course_code,
          raw_course_title,
          credits_attempted,
          credits_earned,
          grade,
          completion_status,
          raw_text_excerpt,
          created_at
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
        `,
        [
          course.transcriptCourseId,
          transcriptTermId,
          course.rawCourseCode ?? null,
          course.rawCourseTitle,
          course.creditsAttempted ?? null,
          course.creditsEarned ?? null,
          course.grade ?? null,
          course.completionStatus,
          course.rawTextExcerpt ?? null,
        ]
      );
    }
  }

  async upsertTranscriptCourseMatch(input: {
    transcriptCourseMatchId: string;
    transcriptCourseId: string;
    catalogCourseId?: string | null;
    matchStatus: "exact" | "fuzzy" | "manual" | "unmatched";
    confidenceScore?: number | null;
    reviewerNote?: string | null;
  }): Promise<void> {
    await query(
      `
      insert into transcript_course_matches (
        transcript_course_match_id,
        transcript_course_id,
        catalog_course_id,
        match_status,
        confidence_score,
        reviewer_note,
        created_at
      ) values ($1,$2,$3,$4,$5,$6,now())
      on conflict (transcript_course_id) do update set
        catalog_course_id = excluded.catalog_course_id,
        match_status = excluded.match_status,
        confidence_score = excluded.confidence_score,
        reviewer_note = excluded.reviewer_note
      `,
      [
        input.transcriptCourseMatchId,
        input.transcriptCourseId,
        input.catalogCourseId ?? null,
        input.matchStatus,
        input.confidenceScore ?? null,
        input.reviewerNote ?? null,
      ]
    );
  }

  async getStudentTranscript(studentTranscriptId: string): Promise<StudentTranscriptRow | null> {
    const result = await query<StudentTranscriptRow>(
      `select * from student_transcripts where student_transcript_id = $1 limit 1`,
      [studentTranscriptId]
    );
    return result.rows[0] || null;
  }

  async getLatestStudentTranscriptForStudentProfile(studentProfileId: string): Promise<StudentTranscriptRow | null> {
    const result = await query<StudentTranscriptRow>(
      `
      select *
      from student_transcripts
      where student_profile_id = $1
      order by updated_at desc, created_at desc
      limit 1
      `,
      [studentProfileId]
    );
    return result.rows[0] || null;
  }

  async listTranscriptTerms(studentTranscriptId: string): Promise<TranscriptTermRow[]> {
    const result = await query<TranscriptTermRow>(
      `
      select *
      from transcript_terms
      where student_transcript_id = $1
      order by display_order asc nulls last, term_label asc
      `,
      [studentTranscriptId]
    );
    return result.rows;
  }

  async listTranscriptCoursesForTranscript(studentTranscriptId: string): Promise<TranscriptCourseWithMatchRow[]> {
    const result = await query<TranscriptCourseWithMatchRow>(
      `
      select
        c.transcript_course_id,
        c.transcript_term_id,
        c.raw_course_code,
        c.raw_course_title,
        c.credits_attempted,
        c.credits_earned,
        c.grade,
        c.completion_status,
        c.raw_text_excerpt,
        m.transcript_course_match_id,
        m.catalog_course_id,
        m.match_status,
        m.confidence_score,
        m.reviewer_note
      from transcript_courses c
      inner join transcript_terms t
        on t.transcript_term_id = c.transcript_term_id
      left join transcript_course_matches m
        on m.transcript_course_id = c.transcript_course_id
      where t.student_transcript_id = $1
      order by t.display_order asc nulls last, t.term_label asc, c.raw_course_code asc nulls last, c.raw_course_title asc
      `,
      [studentTranscriptId]
    );
    return result.rows;
  }
}
