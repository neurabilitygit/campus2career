import {
  type StudentTranscriptInput,
  type StudentTranscriptGraph,
  type TranscriptCourseInput,
  type TranscriptCourseGraphNode,
  type TranscriptTermGraphNode,
} from "../../../../../packages/shared/src/contracts/academic";
import { CatalogRepository } from "../../repositories/academic/catalogRepository";
import { TranscriptRepository } from "../../repositories/academic/transcriptRepository";
import { stableId } from "../market/idFactory";

const transcriptRepo = new TranscriptRepository();
const catalogRepo = new CatalogRepository();

function buildTranscriptCourseId(studentTranscriptId: string, termLabel: string, course: TranscriptCourseInput, index: number) {
  return stableId(
    "transcript_course",
    `${studentTranscriptId}:${termLabel}:${course.rawCourseCode || course.rawCourseTitle}:${index}`
  );
}

export async function persistStudentTranscriptGraph(input: StudentTranscriptInput) {
  let institutionId: string | null = null;
  if (input.institutionCanonicalName) {
    const institution = await catalogRepo.getInstitutionByCanonicalName(input.institutionCanonicalName);
    if (!institution) {
      throw new Error(`Institution not found: ${input.institutionCanonicalName}`);
    }
    institutionId = institution.institution_id;
  }

  const studentTranscriptId = stableId(
    "student_transcript",
    `${input.studentProfileId}:${input.academicArtifactId || input.institutionCanonicalName || "manual"}`
  );

  await transcriptRepo.upsertStudentTranscript({
    studentTranscriptId,
    studentProfileId: input.studentProfileId,
    academicArtifactId: input.academicArtifactId ?? null,
    institutionId,
    parsedStatus: input.parsedStatus ?? "pending",
    transcriptSummary: input.transcriptSummary ?? null,
  });

  const termRecords = input.terms.map((term, index) => ({
    transcriptTermId: stableId("transcript_term", `${studentTranscriptId}:${term.termLabel}:${index}`),
    termLabel: term.termLabel,
    termStartDate: term.termStartDate ?? null,
    termEndDate: term.termEndDate ?? null,
    displayOrder: term.displayOrder ?? index,
  }));

  await transcriptRepo.replaceTranscriptTerms(studentTranscriptId, termRecords);

  for (let termIndex = 0; termIndex < input.terms.length; termIndex++) {
    const term = input.terms[termIndex];
    const termRecord = termRecords[termIndex];

    await transcriptRepo.replaceTranscriptCourses(
      termRecord.transcriptTermId,
      term.courses.map((course, courseIndex) => ({
        transcriptCourseId: buildTranscriptCourseId(studentTranscriptId, term.termLabel, course, courseIndex),
        rawCourseCode: course.rawCourseCode ?? null,
        rawCourseTitle: course.rawCourseTitle,
        creditsAttempted: course.creditsAttempted ?? null,
        creditsEarned: course.creditsEarned ?? null,
        grade: course.grade ?? null,
        completionStatus: course.completionStatus,
        rawTextExcerpt: course.rawTextExcerpt ?? null,
      }))
    );
  }

  return studentTranscriptId;
}

export async function markTranscriptCourseMatch(input: {
  transcriptCourseId: string;
  catalogCourseId?: string | null;
  matchStatus: "exact" | "fuzzy" | "manual" | "unmatched";
  confidenceScore?: number | null;
  reviewerNote?: string | null;
}) {
  const transcriptCourseMatchId = stableId(
    "transcript_course_match",
    `${input.transcriptCourseId}:${input.catalogCourseId || input.matchStatus}`
  );

  await transcriptRepo.upsertTranscriptCourseMatch({
    transcriptCourseMatchId,
    transcriptCourseId: input.transcriptCourseId,
    catalogCourseId: input.catalogCourseId ?? null,
    matchStatus: input.matchStatus,
    confidenceScore: input.confidenceScore ?? null,
    reviewerNote: input.reviewerNote ?? null,
  });

  return transcriptCourseMatchId;
}

export async function getStudentTranscript(studentTranscriptId: string) {
  return transcriptRepo.getStudentTranscript(studentTranscriptId);
}

export async function listTranscriptTerms(studentTranscriptId: string) {
  return transcriptRepo.listTranscriptTerms(studentTranscriptId);
}

function normalizeComparisonValue(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export async function getLatestStudentTranscriptGraphForStudent(studentProfileId: string) {
  const transcript = await transcriptRepo.getLatestStudentTranscriptForStudentProfile(studentProfileId);
  if (!transcript) {
    return null;
  }

  return getStudentTranscriptGraph(transcript.student_transcript_id);
}

export async function autoMatchTranscriptToPrimaryCatalog(studentProfileId: string, studentTranscriptId: string) {
  const assignment = await catalogRepo.getPrimaryStudentCatalogAssignment(studentProfileId);
  const transcript = await transcriptRepo.getStudentTranscript(studentTranscriptId);
  if (!assignment || !transcript) {
    return { matchedCount: 0, unmatchedCount: 0, matchingCatalogBound: false };
  }

  const transcriptCourses = await transcriptRepo.listTranscriptCoursesForTranscript(studentTranscriptId);
  const catalogCourses = await catalogRepo.listCatalogCourses(assignment.academic_catalog_id);

  const catalogByCode = new Map(
    catalogCourses
      .filter((course) => normalizeComparisonValue(course.course_code))
      .map((course) => [normalizeComparisonValue(course.course_code), course] as const)
  );
  const catalogByTitle = new Map(
    catalogCourses
      .filter((course) => normalizeComparisonValue(course.course_title))
      .map((course) => [normalizeComparisonValue(course.course_title), course] as const)
  );

  let matchedCount = 0;
  let unmatchedCount = 0;

  for (const course of transcriptCourses) {
    const byCode = catalogByCode.get(normalizeComparisonValue(course.raw_course_code));
    const byTitle = catalogByTitle.get(normalizeComparisonValue(course.raw_course_title));
    const matchedCourse = byCode || byTitle || null;

    await markTranscriptCourseMatch({
      transcriptCourseId: course.transcript_course_id,
      catalogCourseId: matchedCourse?.catalog_course_id ?? null,
      matchStatus: matchedCourse ? "exact" : "unmatched",
      confidenceScore: matchedCourse ? 1 : 0,
      reviewerNote: matchedCourse
        ? `Auto-matched against academic catalog by ${byCode ? "course code" : "course title"}.`
        : "No exact academic catalog match was found. Manual review still required.",
    });

    if (matchedCourse) matchedCount += 1;
    else unmatchedCount += 1;
  }

  return {
    matchedCount,
    unmatchedCount,
    matchingCatalogBound: true,
  };
}

export async function getStudentTranscriptGraph(studentTranscriptId: string): Promise<StudentTranscriptGraph | null> {
  const transcript = await transcriptRepo.getStudentTranscript(studentTranscriptId);
  if (!transcript) {
    return null;
  }

  const terms = await transcriptRepo.listTranscriptTerms(studentTranscriptId);
  const courses = await transcriptRepo.listTranscriptCoursesForTranscript(studentTranscriptId);

  const courseMap = new Map<string, TranscriptCourseGraphNode[]>();
  for (const course of courses) {
    const courseNodes = courseMap.get(course.transcript_term_id) ?? [];
    courseNodes.push({
      transcriptCourseId: course.transcript_course_id,
      rawCourseCode: course.raw_course_code,
      rawCourseTitle: course.raw_course_title,
      creditsAttempted: course.credits_attempted,
      creditsEarned: course.credits_earned,
      grade: course.grade,
      completionStatus: course.completion_status,
      rawTextExcerpt: course.raw_text_excerpt,
      match: course.transcript_course_match_id
        ? {
            transcriptCourseMatchId: course.transcript_course_match_id,
            catalogCourseId: course.catalog_course_id,
            matchStatus: course.match_status ?? "unmatched",
            confidenceScore: course.confidence_score,
            reviewerNote: course.reviewer_note,
          }
        : undefined,
    });
    courseMap.set(course.transcript_term_id, courseNodes);
  }

  const termGraph: TranscriptTermGraphNode[] = terms.map((term) => ({
    transcriptTermId: term.transcript_term_id,
    termLabel: term.term_label,
    termStartDate: term.term_start_date,
    termEndDate: term.term_end_date,
    displayOrder: term.display_order,
    courses: courseMap.get(term.transcript_term_id) ?? [],
  }));

  return {
    studentTranscriptId: transcript.student_transcript_id,
    studentProfileId: transcript.student_profile_id,
    academicArtifactId: transcript.academic_artifact_id,
    institutionId: transcript.institution_id,
    parsedStatus: transcript.parsed_status,
    transcriptSummary: transcript.transcript_summary,
    terms: termGraph,
  };
}
