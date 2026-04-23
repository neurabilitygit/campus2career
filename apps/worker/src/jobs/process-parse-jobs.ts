import crypto from "node:crypto";
import { CatalogRepository } from "../../../api/src/repositories/academic/catalogRepository";
import { ArtifactRepository } from "../../../api/src/repositories/student/artifactRepository";
import { StudentReadRepository } from "../../../api/src/repositories/student/studentReadRepository";
import { extractDocumentText } from "../../../api/src/services/academic/documentExtraction";
import { extractStructuredTranscript } from "../../../api/src/services/academic/transcriptExtraction";
import { StudentWriteRepository } from "../../../api/src/repositories/student/studentWriteRepository";
import {
  autoMatchTranscriptToPrimaryCatalog,
  persistStudentTranscriptGraph,
  updateStudentTranscriptStatus,
} from "../../../api/src/services/academic/transcriptService";
import { downloadArtifactFromStorage } from "../../../api/src/services/storage/artifactDownload";
import type { WorkerJobResult } from "./jobStatus";

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

async function enrichResume(job: any) {
  await studentWriteRepo.createInsight({
    insightId: stableId("insight", `${job.student_profile_id}:${job.academic_artifact_id}:resume`),
    studentProfileId: job.student_profile_id,
    insightCategory: "strength",
    insightStatement:
      "Résumé text was extracted and summarized, but no structured experience rows were auto-created because parse confidence is not yet high enough for domain truth writes.",
    parentSafeSummary:
      "Résumé uploaded and summarized. Structured experience records still require a stronger parser or review before they should count as direct evidence.",
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
    extractionMethod,
  };
}

function extractBaseFileName(fileUri: string): string {
  const [, fileName = fileUri] = fileUri.split(/[/\\]/).slice(-1);
  return fileName.replace(/\.[a-z0-9]+$/i, "");
}

async function persistTranscriptGraph(job: any, summary: string) {
  const artifact = await artifactRepo.getAcademicArtifactById(job.academic_artifact_id);
  const profile = await studentReadRepo.getStudentProfile(job.student_profile_id);

  const matchedInstitution = profile?.school_name
    ? await catalogRepo.findInstitutionByName(profile.school_name)
    : null;

  if (!artifact?.file_uri) {
    throw new Error("TRANSCRIPT_ARTIFACT_FILE_URI_MISSING");
  }

  let extractedTranscriptInput: ReturnType<typeof extractStructuredTranscript>;
  let extractionMethod: string | null = null;

  const downloadedArtifact = await downloadArtifactFromStorage({
    objectPath: artifact.file_uri,
  });
  const extracted = extractDocumentText({
    buffer: downloadedArtifact.buffer,
    fileName: downloadedArtifact.fileName,
    contentType: downloadedArtifact.contentType,
  });

  if (!extracted.text.trim()) {
    throw new Error("TRANSCRIPT_ARTIFACT_TEXT_EMPTY");
  }

  extractedTranscriptInput = extractStructuredTranscript({
    studentProfileId: job.student_profile_id,
    academicArtifactId: job.academic_artifact_id,
    institutionCanonicalName: matchedInstitution?.canonical_name,
    transcriptSummary: `${summary} Extraction method: ${extracted.method}.`,
    transcriptText: extracted.text,
  });
  extractionMethod = extracted.method;

  const studentTranscriptId = await persistStudentTranscriptGraph({
    studentProfileId: job.student_profile_id,
    academicArtifactId: job.academic_artifact_id,
    institutionCanonicalName: matchedInstitution?.canonical_name,
    transcriptSummary: extractedTranscriptInput.transcriptSummary,
    parsedStatus: "parsed",
    extractionMethod: extracted.method,
    extractionConfidenceLabel: extractedTranscriptInput.terms.length ? "medium" : "low",
    institutionResolutionTruthStatus: matchedInstitution ? "inferred" : "unresolved",
    institutionResolutionNote: matchedInstitution
      ? `Matched student profile school name "${profile?.school_name}" to institution directory entry "${matchedInstitution.display_name}".`
      : profile?.school_name
        ? `Could not confidently match student profile school name "${profile.school_name}" to a known institution entry.`
        : "No school name was present on the student profile, so institution matching could not be attempted.",
    terms: extractedTranscriptInput.terms,
  });

  const matchingResult = await autoMatchTranscriptToPrimaryCatalog(
    job.student_profile_id,
    studentTranscriptId
  );
  await updateStudentTranscriptStatus({
    studentTranscriptId,
    parsedStatus: matchingResult.matchingCatalogBound ? "matched" : "parsed",
    transcriptSummary: `${extractedTranscriptInput.transcriptSummary} Auto-match summary: ${matchingResult.matchedCount} matched, ${matchingResult.unmatchedCount} unmatched.`,
    extractionMethod: extracted.method,
    extractionConfidenceLabel: matchingResult.matchedCount > 0 ? "high" : "medium",
    institutionResolutionTruthStatus: matchedInstitution ? "inferred" : "unresolved",
    institutionResolutionNote: matchedInstitution
      ? `Matched against the institution directory using the student's saved school name.`
      : "Institution matching remained unresolved; transcript parsing proceeded without a bound institution.",
  });

  return {
    studentTranscriptId,
    matchingResult,
    extractionMethod,
    parseTruthStatus: "inferred" as const,
    parseConfidenceLabel: matchingResult.matchedCount > 0 ? "high" as const : "medium" as const,
    parseNotes: matchingResult.matchingCatalogBound
      ? `Transcript extracted via ${extracted.method}; ${matchingResult.matchedCount} course matches and ${matchingResult.unmatchedCount} unmatched courses.`
      : `Transcript extracted via ${extracted.method}; no primary catalog binding was available for automatic course matching.`,
  };
}

function summarizeParser(artifactType: string): string {
  if (artifactType === "resume") {
    return "Resume text was summarized, but no structured experience rows were auto-created.";
  }
  if (artifactType === "transcript") {
    return "Transcript text was parsed into the transcript graph and queued for catalog matching.";
  }
  return "Supporting artifact text was summarized for later review.";
}

export async function processParseJobs(): Promise<WorkerJobResult> {
  console.log("Processing queued artifact parse jobs...");
  const jobs = await artifactRepo.claimQueuedParseJobs();
  let completedCount = 0;
  let failedCount = 0;
  const modeCounts = {
    real: 0,
    partial: 0,
    fallback: 0,
    unresolved: 0,
  };

  for (const job of jobs) {
    try {
      let summary = summarizeParser(job.artifact_type);
      let parseTruthStatus: "direct" | "inferred" | "placeholder" | "fallback" | "unresolved" = "unresolved";
      let parseConfidenceLabel: "low" | "medium" | "high" | null = "low";
      let extractionMethod: string | null = null;
      let parseNotes: string | null = null;
      let executionMode: "real" | "partial" | "fallback" | "unresolved" = "unresolved";

      if (job.artifact_type === "resume") {
        await enrichResume(job);
        parseTruthStatus = "inferred";
        parseConfidenceLabel = "low";
        executionMode = "partial";
        parseNotes =
          "Resume parsing currently produces summary-level evidence only. Structured experience records are intentionally withheld until parse quality improves.";
      } else if (job.artifact_type === "transcript") {
        const transcriptResult = await persistTranscriptGraph(job, summary);
        parseTruthStatus = transcriptResult.parseTruthStatus;
        parseConfidenceLabel = transcriptResult.parseConfidenceLabel;
        extractionMethod = transcriptResult.extractionMethod;
        parseNotes = transcriptResult.parseNotes;
        summary = transcriptResult.parseNotes;
        executionMode = transcriptResult.matchingResult.matchingCatalogBound ? "real" : "partial";
        console.log(
          `Persisted transcript graph ${transcriptResult.studentTranscriptId} for artifact ${job.academic_artifact_id}${transcriptResult.extractionMethod ? ` using ${transcriptResult.extractionMethod}` : ""}`
        );
      } else if (job.artifact_type === "other") {
        const otherResult = await enrichOtherArtifact(job, summary);
        summary = otherResult.summary;
        extractionMethod = otherResult.extractionMethod;
        parseTruthStatus = otherResult.summary === summarizeParser("other") ? "unresolved" : "inferred";
        parseConfidenceLabel = otherResult.summary === summarizeParser("other") ? "low" : "medium";
        executionMode = otherResult.summary === summarizeParser("other") ? "unresolved" : "partial";
        parseNotes =
          otherResult.summary === summarizeParser("other")
            ? "No extractable text was found, so the artifact remains available for manual review only."
            : "Supporting artifact text was extracted into a summary, but no structured domain records were created automatically.";
      }

      await artifactRepo.markArtifactParsed({
        artifactId: job.academic_artifact_id,
        extractedSummary: summary,
        parseTruthStatus,
        parseConfidenceLabel,
        extractionMethod,
        parseNotes,
      });
      await artifactRepo.markParseJobCompleted({
        jobId: job.artifact_parse_job_id,
        resultSummary: summary,
        resultTruthStatus: parseTruthStatus,
        resultConfidenceLabel: parseConfidenceLabel,
        resultNotes: parseNotes,
      });
      completedCount += 1;
      if (executionMode === "real") {
        modeCounts.real += 1;
      } else if (executionMode === "partial") {
        modeCounts.partial += 1;
      } else {
        modeCounts.unresolved += 1;
      }
      console.log(`Completed parse job ${job.artifact_parse_job_id}`);
    } catch (error: any) {
      await artifactRepo.markArtifactFailed(
        job.academic_artifact_id,
        error?.message || String(error)
      );
      await artifactRepo.markParseJobFailed(
        job.artifact_parse_job_id,
        error?.message || String(error)
      );
      failedCount += 1;
    }
  }

  return {
    jobName: "process-parse-jobs",
    mode:
      failedCount > 0
        ? "fallback"
        : completedCount > 0 && (modeCounts.partial > 0 || modeCounts.unresolved > 0)
          ? "partial"
          : "real",
    summary:
      jobs.length === 0
        ? "No queued parse jobs were available."
        : `Processed ${jobs.length} parse job(s): ${completedCount} completed, ${failedCount} failed.`,
    details: {
      claimedJobs: jobs.length,
      completedCount,
      failedCount,
      truthStatusBreakdown: modeCounts,
    },
  };
}
