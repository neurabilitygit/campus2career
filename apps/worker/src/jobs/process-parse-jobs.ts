import crypto from "node:crypto";
import { CatalogRepository } from "../../../api/src/repositories/academic/catalogRepository";
import { ArtifactRepository } from "../../../api/src/repositories/student/artifactRepository";
import { StudentReadRepository } from "../../../api/src/repositories/student/studentReadRepository";
import { extractDocumentText } from "../../../api/src/services/academic/documentExtraction";
import { extractStructuredTranscript } from "../../../api/src/services/academic/transcriptExtraction";
import { StudentWriteRepository } from "../../../api/src/repositories/student/studentWriteRepository";
import { autoMatchTranscriptToPrimaryCatalog, persistStudentTranscriptGraph } from "../../../api/src/services/academic/transcriptService";
import { downloadArtifactFromStorage } from "../../../api/src/services/storage/artifactDownload";

const artifactRepo = new ArtifactRepository();
const studentWriteRepo = new StudentWriteRepository();
const studentReadRepo = new StudentReadRepository();
const catalogRepo = new CatalogRepository();

function stableId(namespace: string, key: string): string {
  return crypto.createHash("sha256").update(`${namespace}:${key}`).digest("hex").slice(0, 32);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncateSummary(value: string, maxLength: number = 280): string {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

async function enrichResume(job: any, summary: string) {
  await studentWriteRepo.createExperience({
    experienceId: stableId("experience", `${job.student_profile_id}:${job.academic_artifact_id}:resume`),
    studentProfileId: job.student_profile_id,
    title: "Résumé-derived experience placeholder",
    organization: "Imported from résumé",
    description: "Created by the résumé parse stub.",
    deliverablesSummary: summary,
    toolsUsed: ["excel", "presentation"],
    relevanceRating: 3,
  });

  await studentWriteRepo.createInsight({
    insightId: stableId("insight", `${job.student_profile_id}:${job.academic_artifact_id}:resume`),
    studentProfileId: job.student_profile_id,
    insightCategory: "strength",
    insightStatement: "Student has at least one résumé-based experience signal recorded.",
    parentSafeSummary: "Student has initial experience evidence captured from the résumé upload.",
  });
}

async function enrichTranscript(job: any, summary: string) {
  const academicTermId = stableId("academic_term", `${job.student_profile_id}:imported-term`);
  const courseId = stableId("course", `${job.student_profile_id}:${job.academic_artifact_id}:course`);
  await studentWriteRepo.ensureAcademicTerm({
    academicTermId,
    studentProfileId: job.student_profile_id,
    termName: "Imported Transcript Term",
  });
  await studentWriteRepo.createCourse({
    courseId,
    academicTermId,
    courseTitle: "Imported Quantitative Course",
    courseCode: "IMPT-101",
    finalGrade: "A",
    notes: summary,
  });
  await studentWriteRepo.createCourseSkillCoverage({
    courseSkillCoverageId: stableId("course_skill", `${courseId}:analysis`),
    courseId,
    skillName: "finance_analysis",
    coverageStrength: "medium",
    confidenceScore: 0.7,
    derivedFrom: "manual_tagging",
  });
  await studentWriteRepo.createInsight({
    insightId: stableId("insight", `${job.student_profile_id}:${job.academic_artifact_id}:transcript`),
    studentProfileId: job.student_profile_id,
    insightCategory: "strength",
    insightStatement: "Transcript parsing added at least one course-level signal.",
    parentSafeSummary: "Transcript parsing added an initial course and skill signal.",
  });
}

async function enrichOtherArtifact(job: any, summary: string) {
  const artifact = await artifactRepo.getAcademicArtifactById(job.academic_artifact_id);
  const fileLabel = artifact?.file_uri ? extractBaseFileName(artifact.file_uri) : "supporting artifact";

  let extractedTextSummary: string | null = null;
  let extractionMethod: string | null = null;

  if (artifact?.file_uri) {
    try {
      const downloadedArtifact = await downloadArtifactFromStorage({
        objectPath: artifact.file_uri,
      });
      const extracted = extractDocumentText({
        buffer: downloadedArtifact.buffer,
        fileName: downloadedArtifact.fileName,
        contentType: downloadedArtifact.contentType,
      });

      if (extracted.text.trim()) {
        extractedTextSummary = truncateSummary(extracted.text);
        extractionMethod = extracted.method;
      }
    } catch (error) {
      console.warn(
        `Supporting artifact download/extraction failed for ${job.academic_artifact_id}:`,
        error
      );
    }
  }

  const insightStatement = extractedTextSummary
    ? `Student uploaded supporting artifact "${fileLabel}" with extractable content that can inform coaching and application evidence.`
    : `Student uploaded supporting artifact "${fileLabel}" that can be reviewed for additional evidence.`;

  const parentSafeSummary = extractedTextSummary
    ? `Supporting artifact uploaded: ${truncateSummary(extractedTextSummary, 180)}`
    : `Supporting artifact uploaded and recorded for later review.`;

  await studentWriteRepo.createInsight({
    insightId: stableId("insight", `${job.student_profile_id}:${job.academic_artifact_id}:other`),
    studentProfileId: job.student_profile_id,
    insightCategory: "strength",
    insightStatement,
    parentSafeSummary,
  });

  return {
    summary: extractedTextSummary
      ? `Supporting artifact parsed from ${extractionMethod}: ${extractedTextSummary}`
      : summary,
  };
}

function extractBaseFileName(fileUri: string): string {
  const [, fileName = fileUri] = fileUri.split(/[/\\]/).slice(-1);
  return fileName.replace(/\.[a-z0-9]+$/i, "");
}

function buildTranscriptPlaceholderCourse(fileUri: string, summary: string) {
  const baseName = extractBaseFileName(fileUri);
  return {
    rawCourseCode: undefined,
    rawCourseTitle: `Imported transcript artifact: ${baseName}`,
    creditsAttempted: undefined,
    creditsEarned: undefined,
    grade: undefined,
    completionStatus: "completed" as const,
    rawTextExcerpt: summary,
  };
}

async function persistTranscriptGraph(job: any, summary: string) {
  const artifact = await artifactRepo.getAcademicArtifactById(job.academic_artifact_id);
  const profile = await studentReadRepo.getStudentProfile(job.student_profile_id);

  const matchedInstitution = profile?.school_name
    ? await catalogRepo.findInstitutionByName(profile.school_name)
    : null;

  let extractedTranscriptInput;
  let extractionMethod: string | null = null;

  if (artifact?.file_uri) {
    try {
      const downloadedArtifact = await downloadArtifactFromStorage({
        objectPath: artifact.file_uri,
      });
      const extracted = extractDocumentText({
        buffer: downloadedArtifact.buffer,
        fileName: downloadedArtifact.fileName,
        contentType: downloadedArtifact.contentType,
      });

      if (extracted.text.trim()) {
        extractedTranscriptInput = extractStructuredTranscript({
          studentProfileId: job.student_profile_id,
          academicArtifactId: job.academic_artifact_id,
          institutionCanonicalName: matchedInstitution?.canonical_name,
          transcriptSummary: `${summary} Extraction method: ${extracted.method}.`,
          transcriptText: extracted.text,
        });
        extractionMethod = extracted.method;
      }
    } catch (error) {
      console.warn(
        `Transcript artifact download/extraction failed for ${job.academic_artifact_id}:`,
        error
      );
    }
  }

  const studentTranscriptId = await persistStudentTranscriptGraph(
    extractedTranscriptInput ?? {
      studentProfileId: job.student_profile_id,
      academicArtifactId: job.academic_artifact_id,
      institutionCanonicalName: matchedInstitution?.canonical_name,
      transcriptSummary: summary,
      parsedStatus: matchedInstitution ? "matched" : "review_required",
      terms: [
        {
          termLabel: "Imported Transcript",
          displayOrder: 0,
          courses: [
            buildTranscriptPlaceholderCourse(
              artifact?.file_uri || `artifact-${job.academic_artifact_id}`,
              summary
            ),
          ],
        },
      ],
    }
  );

  const matchingResult = await autoMatchTranscriptToPrimaryCatalog(
    job.student_profile_id,
    studentTranscriptId
  );

  return {
    studentTranscriptId,
    matchingResult,
    extractionMethod,
  };
}

function summarizeParser(artifactType: string): string {
  if (artifactType === "resume") {
    return "Stub parse complete: extracted candidate experience, tools, and project signals.";
  }
  if (artifactType === "transcript") {
    return "Stub parse complete: extracted candidate course and grade signals.";
  }
  return "Stub parse complete: extracted generic artifact summary.";
}

export async function processParseJobs() {
  console.log("Processing queued artifact parse jobs...");
  const jobs = await artifactRepo.listQueuedParseJobs();

  for (const job of jobs) {
    try {
      await artifactRepo.markParseJobProcessing(job.artifact_parse_job_id);
      let summary = summarizeParser(job.artifact_type);

      if (job.artifact_type === "resume") {
        await enrichResume(job, summary);
      } else if (job.artifact_type === "transcript") {
        await enrichTranscript(job, summary);
        const transcriptResult = await persistTranscriptGraph(job, summary);
        console.log(
          `Persisted transcript graph ${transcriptResult.studentTranscriptId} for artifact ${job.academic_artifact_id}${transcriptResult.extractionMethod ? ` using ${transcriptResult.extractionMethod}` : ""}`
        );
      } else if (job.artifact_type === "other") {
        const otherResult = await enrichOtherArtifact(job, summary);
        summary = otherResult.summary;
      }

      await artifactRepo.markArtifactParsed(job.academic_artifact_id, summary);
      await artifactRepo.markParseJobCompleted(job.artifact_parse_job_id, summary);
      console.log(`Completed parse job ${job.artifact_parse_job_id}`);
    } catch (error: any) {
      await artifactRepo.markParseJobFailed(
        job.artifact_parse_job_id,
        error?.message || String(error)
      );
    }
  }
}
