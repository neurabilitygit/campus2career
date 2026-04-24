import { generateStructuredParentBrief } from "../openai/responsesClient";
import type { ScoringOutput } from "../../../../../packages/shared/src/scoring/types";

export interface ParentBriefInput {
  studentProfileId?: string;
  householdId?: string | null;
  studentName: string;
  monthLabel: string;
  targetGoal: string;
  accomplishments: string[];
  scoring: ScoringOutput;
  upcomingDeadlines: string[];
  parentVisibleInsights: string[];
  truthNotes?: string[];
  evidenceSummary?: {
    assessmentMode: "measured" | "provisional";
    overallEvidenceLevel: string;
    strongestEvidenceCategories: string[];
    weakestEvidenceCategories: string[];
    blockedByMissingEvidence: string[];
    recommendedEvidenceActions: string[];
  };
  coachSummary?: {
    recommendationTitles: string[];
    actionTitles: string[];
    flagTitles: string[];
  };
}

export interface ParentBriefGenerationResult {
  brief: string;
  deliveryMode: "llm" | "fallback";
  degradedReason?: string;
}

const PARENT_BRIEF_PROVIDER_TIMEOUT_MS = 12000;

export function buildSystemPrompt(): string {
  return [
    "You are the Rising Senior parent brief writer.",
    "Audience: a parent paying for a parent-first career intelligence platform.",
    "Tone: direct, measured, delicately worded but not ambiguous.",
    "Do not be evasive.",
    "Do not exaggerate.",
    "Structure the response with these sections:",
    "Purpose of report",
    "Student goal",
    "Accomplishments",
    "Strengths",
    "Gaps and risks",
    "Recommended parent actions",
    "Upcoming deadlines and decision points",
  ].join("\n");
}

export function buildUserPrompt(input: ParentBriefInput): string {
  return [
    `Student name: ${input.studentName}`,
    `Month: ${input.monthLabel}`,
    `Student goal: ${input.targetGoal}`,
    `Trajectory status: ${input.scoring.trajectoryStatus}`,
    `Overall score: ${input.scoring.overallScore}`,
    `Top strengths: ${input.scoring.topStrengths.join("; ") || "None yet"}`,
    `Top risks: ${input.scoring.topRisks.join("; ") || "None currently"}`,
    `Heuristic flags: ${input.scoring.heuristicFlags.map(f => `${f.title} (${f.severity})`).join("; ") || "None"}`,
    `Skill gaps: ${input.scoring.skillGaps.map(g => `${g.skillName} [${g.gapSeverity}]`).join("; ") || "None"}`,
    `Recommendations: ${input.scoring.recommendations.map(r => `${r.title}`).join("; ") || "None"}`,
    `Accomplishments this month: ${input.accomplishments.join("; ") || "None recorded"}`,
    `Upcoming deadlines: ${input.upcomingDeadlines.join("; ") || "None recorded"}`,
    `Parent-visible insights: ${input.parentVisibleInsights.join("; ") || "None recorded"}`,
    `Visible coach recommendations: ${input.coachSummary?.recommendationTitles.join("; ") || "None recorded"}`,
    `Visible coach action items: ${input.coachSummary?.actionTitles.join("; ") || "None recorded"}`,
    `Visible coach flags: ${input.coachSummary?.flagTitles.join("; ") || "None recorded"}`,
    `Truth and confidence notes: ${input.truthNotes?.join("; ") || "None"}`,
    `Evidence integrity: assessment mode ${input.evidenceSummary?.assessmentMode || "unknown"}; overall evidence ${input.evidenceSummary?.overallEvidenceLevel || "unknown"}; strongest evidence ${input.evidenceSummary?.strongestEvidenceCategories.join("; ") || "None"}; weak evidence ${input.evidenceSummary?.weakestEvidenceCategories.join("; ") || "None"}; blocked by missing evidence ${input.evidenceSummary?.blockedByMissingEvidence.join("; ") || "None"}; recommended evidence actions ${input.evidenceSummary?.recommendedEvidenceActions.join("; ") || "None"}`,
    "Write the monthly brief."
  ].join("\n");
}

export async function generateParentBrief(input: ParentBriefInput): Promise<ParentBriefGenerationResult> {
  try {
    const brief = await generateStructuredParentBrief({
      systemPrompt: buildSystemPrompt(),
      userPrompt: buildUserPrompt(input),
      timeoutMs: PARENT_BRIEF_PROVIDER_TIMEOUT_MS,
      telemetry: input.studentProfileId
        ? {
            runType: "parent_brief",
            promptVersion: "parent_brief_v1",
            studentProfileId: input.studentProfileId,
            householdId: input.householdId ?? null,
            inputPayload: {
              studentName: input.studentName,
              monthLabel: input.monthLabel,
              targetGoal: input.targetGoal,
              trajectoryStatus: input.scoring.trajectoryStatus,
              overallScore: input.scoring.overallScore,
              topRisks: input.scoring.topRisks,
              topStrengths: input.scoring.topStrengths,
              recommendationTitles: input.scoring.recommendations.map((item) => item.title),
              truthNotes: input.truthNotes || [],
              evidenceSummary: input.evidenceSummary || null,
              coachSummary: input.coachSummary || null,
            },
          }
        : undefined,
    });
    return {
      brief,
      deliveryMode: "llm",
    };
  } catch (error) {
    const providerMessage = error instanceof Error ? error.message : String(error);
    return {
      brief: [
        `Purpose of report: summarize the student's current path toward ${input.targetGoal}.`,
        `Student goal: ${input.targetGoal}. Trajectory status is ${input.scoring.trajectoryStatus} with overall score ${input.scoring.overallScore}.`,
        `Accomplishments: ${input.accomplishments.join("; ") || "No accomplishments recorded this month."}`,
        `Strengths: ${input.scoring.topStrengths.join("; ") || "No strengths have been surfaced clearly yet."}`,
        `Gaps and risks: ${input.scoring.topRisks.join("; ") || "No major risks listed."}`,
        `Visible coach inputs: ${[
          ...(input.coachSummary?.recommendationTitles || []),
          ...(input.coachSummary?.actionTitles || []),
          ...(input.coachSummary?.flagTitles || []),
        ].join("; ") || "No visible coach inputs were recorded."}`,
        `Evidence confidence: ${input.evidenceSummary?.assessmentMode || "unknown"} read with overall evidence ${input.evidenceSummary?.overallEvidenceLevel || "unknown"}. Missing or weak evidence areas: ${[
          ...(input.evidenceSummary?.weakestEvidenceCategories || []),
          ...(input.evidenceSummary?.blockedByMissingEvidence || []),
        ].join("; ") || "None noted"}.`,
        `Recommended parent actions: ${input.scoring.recommendations.slice(0, 3).map((item) => item.title).join("; ") || "Review the current dashboard and clarify the student's top priority for the month."}`,
        `Upcoming deadlines and decision points: ${input.upcomingDeadlines.join("; ") || "No deadlines were recorded."}`,
        `Fallback note: AI-generated narrative was unavailable, so this brief was assembled from live scoring and stored student data. Provider detail: ${providerMessage}`,
      ].join("\n\n"),
      deliveryMode: "fallback",
      degradedReason: providerMessage,
    };
  }
}
