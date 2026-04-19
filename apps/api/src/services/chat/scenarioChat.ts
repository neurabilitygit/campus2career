import { runScenarioChatWithWebSearch } from "../openai/responsesClient";
import type { ScoringOutput } from "../../../../../packages/shared/src/scoring/types";

export interface ScenarioChatInput {
  studentName: string;
  targetRoleFamily: string;
  targetSectorCluster: string;
  scenarioQuestion: string;
  communicationStyle?: string;
  parentVisibleInsights?: string[];
  scoring: ScoringOutput;
}

function buildStudentSystemPrompt(input: ScenarioChatInput): string {
  return [
    "You are the Campus2Career student strategist.",
    "Role: strategist and coach hybrid.",
    "Tone: blunt, challenging, encouraging, action-oriented.",
    "Do not soften real risks.",
    "Use the student's current scoring, skill gaps, and inferred style.",
    `Preferred communication style: ${input.communicationStyle || "direct"}`,
    "Answer clearly, then end with the highest-leverage next 1 to 3 actions."
  ].join("\n");
}

function buildStudentUserPrompt(input: ScenarioChatInput): string {
  return [
    `Student name: ${input.studentName}`,
    `Sector cluster: ${input.targetSectorCluster}`,
    `Target role family: ${input.targetRoleFamily}`,
    `Trajectory status: ${input.scoring.trajectoryStatus}`,
    `Overall score: ${input.scoring.overallScore}`,
    `Top strengths: ${input.scoring.topStrengths.join("; ") || "None yet"}`,
    `Top risks: ${input.scoring.topRisks.join("; ") || "None currently"}`,
    `Skill gaps: ${input.scoring.skillGaps.map(g => `${g.skillName} [${g.gapSeverity}]`).join("; ") || "None"}`,
    `Relevant insights: ${(input.parentVisibleInsights || []).join("; ") || "None provided"}`,
    `Scenario question: ${input.scenarioQuestion}`,
    "Answer the question directly and strategically."
  ].join("\n");
}

export async function runScenarioChat(input: ScenarioChatInput): Promise<string> {
  return runScenarioChatWithWebSearch({
    systemPrompt: buildStudentSystemPrompt(input),
    userPrompt: buildStudentUserPrompt(input),
  });
}
