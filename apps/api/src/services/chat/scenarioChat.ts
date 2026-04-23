import type { LlmTelemetryContext } from "../../../../../packages/shared/src/contracts/llm";
import type { ScoringOutput } from "../../../../../packages/shared/src/scoring/types";
import { runStructuredScenarioChatWithWebSearch } from "../openai/responsesClient";
import type { ScenarioModelOutput } from "./scenarioSchema";

export interface ScenarioChatInput {
  studentProfileId?: string;
  studentName: string;
  targetRoleFamily: string;
  targetSectorCluster: string;
  scenarioQuestion: string;
  communicationStyle?: string;
  parentVisibleInsights?: string[];
  scoring: ScoringOutput;
}

export interface ScenarioChatResponse {
  mode: "llm" | "fallback";
  headline: string;
  summary: string;
  whyThisMattersNow: string;
  recommendedActions: Array<{
    title: string;
    rationale: string;
    timeframe: string;
  }>;
  risksToWatch: string[];
  encouragement: string;
  basedOn: string[];
  providerError?: string;
}

export interface ScenarioChatResult {
  response: ScenarioChatResponse;
  llmRunId?: string;
  deliveryMode: "llm" | "fallback";
  degradedReason?: string;
}

const SCENARIO_CHAT_PROVIDER_TIMEOUT_MS = 5000;

function buildStudentSystemPrompt(input: ScenarioChatInput): string {
  return [
    "You are the Campus2Career student strategist.",
    "Role: strategist and coach hybrid.",
    "Tone: blunt, challenging, encouraging, action-oriented.",
    "Do not soften real risks.",
    "Use the student's current scoring, skill gaps, and inferred style.",
    `Preferred communication style: ${input.communicationStyle || "direct"}`,
    "Keep recommendedActions to 3 items maximum.",
    "Ground the response in the supplied scoring and evidence, not generic advice.",
    "Be specific about the next move.",
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
    `Skill gaps: ${input.scoring.skillGaps.map((g) => `${g.skillName} [${g.gapSeverity}]`).join("; ") || "None"}`,
    `Relevant insights: ${(input.parentVisibleInsights || []).join("; ") || "None provided"}`,
    `Scenario question: ${input.scenarioQuestion}`,
    "Answer the question directly and strategically.",
  ].join("\n");
}

function buildFallbackScenarioResponse(input: ScenarioChatInput, providerError?: string): ScenarioChatResponse {
  const primaryActions = input.scoring.recommendations.slice(0, 3).map((item, index) => ({
    title: item.title,
    rationale: item.whyThisMatchesStudent || item.description,
    timeframe: index === 0 ? "Start this week" : index === 1 ? "Make progress this month" : "Queue next",
  }));

  return {
    mode: "fallback",
    headline: `${input.targetRoleFamily} path: focus on the highest-signal gaps first`,
    summary:
      input.scoring.trajectoryStatus === "on_track"
        ? "Your current path is credible, but you will get the most leverage by strengthening the weakest visible signals instead of making random changes."
        : "Your current evidence is not yet strong enough for the stated target, so the best move is to close a few concrete gaps rather than spread effort too thin.",
    whyThisMattersNow:
      `The system currently scores you at ${input.scoring.overallScore} with trajectory status "${input.scoring.trajectoryStatus}". The next few actions should directly improve the weakest visible parts of that profile.`,
    recommendedActions: primaryActions.length
      ? primaryActions
      : [
          {
            title: "Choose one role-aligned project to ship",
            rationale: "A single visible artifact is usually a faster credibility gain than broad passive research.",
            timeframe: "Start this week",
          },
        ],
    risksToWatch: input.scoring.topRisks.slice(0, 3),
    encouragement:
      "You do not need a full plan rewrite. The fastest improvement usually comes from one visible project, one stronger piece of evidence, and one real conversation with a relevant professional.",
    basedOn: [
      `Target role: ${input.targetRoleFamily}`,
      `Trajectory: ${input.scoring.trajectoryStatus}`,
      ...input.scoring.skillGaps.slice(0, 3).map((gap) => `Skill gap: ${gap.skillName} (${gap.gapSeverity})`),
    ],
    providerError,
  };
}

function normalizeScenarioChatResponse(raw: ScenarioModelOutput): ScenarioChatResponse {
  const parsed = raw as Partial<ScenarioModelOutput>;
  return {
    mode: "llm",
    headline: parsed.headline || "Scenario guidance",
    summary: parsed.summary || "No summary returned.",
    whyThisMattersNow: parsed.whyThisMattersNow || "No explanation returned.",
    recommendedActions: Array.isArray(parsed.recommendedActions)
      ? parsed.recommendedActions.slice(0, 3).map((action) => ({
          title: String(action?.title || "Recommended action"),
          rationale: String(action?.rationale || "This action is supported by the current scoring."),
          timeframe: String(action?.timeframe || "Soon"),
        }))
      : [],
    risksToWatch: Array.isArray(parsed.risksToWatch) ? parsed.risksToWatch.map((value) => String(value)).slice(0, 4) : [],
    encouragement: parsed.encouragement || "Keep the plan focused on the highest-leverage next move.",
    basedOn: Array.isArray(parsed.basedOn) ? parsed.basedOn.map((value) => String(value)).slice(0, 6) : [],
  };
}

function buildScenarioTelemetry(input: ScenarioChatInput): LlmTelemetryContext {
  return {
    runType: "scenario_chat",
    promptVersion: "student_scenario_v2_structured",
    studentProfileId: input.studentProfileId ?? null,
    inputPayload: {
      studentName: input.studentName,
      targetRoleFamily: input.targetRoleFamily,
      targetSectorCluster: input.targetSectorCluster,
      scenarioQuestion: input.scenarioQuestion,
      communicationStyle: input.communicationStyle || "direct",
      trajectoryStatus: input.scoring.trajectoryStatus,
      overallScore: input.scoring.overallScore,
      topRisks: input.scoring.topRisks,
      topStrengths: input.scoring.topStrengths,
      skillGaps: input.scoring.skillGaps.map((gap) => ({
        skillName: gap.skillName,
        gapSeverity: gap.gapSeverity,
      })),
    },
  };
}

export async function runScenarioChat(input: ScenarioChatInput): Promise<ScenarioChatResult> {
  try {
    const result = await runStructuredScenarioChatWithWebSearch({
      systemPrompt: buildStudentSystemPrompt(input),
      userPrompt: buildStudentUserPrompt(input),
      telemetry: buildScenarioTelemetry(input),
      timeoutMs: SCENARIO_CHAT_PROVIDER_TIMEOUT_MS,
    });

    return {
      response: normalizeScenarioChatResponse(result.output),
      llmRunId: result.llmRunId,
      deliveryMode: "llm",
    };
  } catch (error) {
    const providerError = error instanceof Error ? error.message : String(error);
    return {
      response: buildFallbackScenarioResponse(input, providerError),
      deliveryMode: "fallback",
      degradedReason: providerError,
    };
  }
}
