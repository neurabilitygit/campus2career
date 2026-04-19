import crypto from "node:crypto";
import { ArtifactRepository } from "../../../api/src/repositories/student/artifactRepository";
import { StudentWriteRepository } from "../../../api/src/repositories/student/studentWriteRepository";

const artifactRepo = new ArtifactRepository();
const studentWriteRepo = new StudentWriteRepository();

function stableId(namespace: string, key: string): string {
  return crypto.createHash("sha256").update(`${namespace}:${key}`).digest("hex").slice(0, 32);
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
      const summary = summarizeParser(job.artifact_type);

      if (job.artifact_type === "resume") {
        await enrichResume(job, summary);
      } else if (job.artifact_type === "transcript") {
        await enrichTranscript(job, summary);
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
