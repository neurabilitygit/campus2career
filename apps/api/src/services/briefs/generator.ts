import { generateStructuredParentBrief } from "../openai/responsesClient";
import type { ScoringOutput } from "../../../../../packages/shared/src/scoring/types";

export interface ParentBriefInput {
  studentName: string;
  monthLabel: string;
  targetGoal: string;
  accomplishments: string[];
  scoring: ScoringOutput;
  upcomingDeadlines: string[];
  parentVisibleInsights: string[];
}

function buildSystemPrompt(): string {
  return [
    "You are the Campus2Career parent brief writer.",
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

function buildUserPrompt(input: ParentBriefInput): string {
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
    "Write the monthly brief."
  ].join("\n");
}

export async function generateParentBrief(input: ParentBriefInput): Promise<string> {
  return generateStructuredParentBrief({
    systemPrompt: buildSystemPrompt(),
    userPrompt: buildUserPrompt(input),
  });
}
