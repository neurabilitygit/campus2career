import type { ScoringOutput, StudentScoringInput } from "../../../../../packages/shared/src/scoring/types";
import { aggregateStudentContext } from "../student/aggregateStudentContext";
import { runScenarioChat } from "./scenarioChat";
import crypto from "node:crypto";
import { AiDocumentRepository } from "../../repositories/llm/aiDocumentRepository";
import { renderScenarioMarkdown } from "./scenarioSchema";

const aiDocumentRepo = new AiDocumentRepository();

function newDocumentId(): string {
  return crypto.randomUUID();
}

export async function runScenarioChatWithContext(input: {
  studentProfileId: string;
  targetRoleFamily: string;
  targetSectorCluster: string;
  scenarioQuestion: string;
  communicationStyle?: string;
  communicationPreferenceNotes?: string[];
  scoring: ScoringOutput;
  scoringInput?: StudentScoringInput;
}) {
  const ctx = await aggregateStudentContext(input.studentProfileId);

  const result = await runScenarioChat({
    studentProfileId: input.studentProfileId,
    studentName: ctx.studentName,
    targetRoleFamily: input.targetRoleFamily,
    targetSectorCluster: input.targetSectorCluster,
    scenarioQuestion: input.scenarioQuestion,
    communicationStyle: input.communicationStyle,
    communicationPreferenceNotes: input.communicationPreferenceNotes,
    parentVisibleInsights: ctx.parentVisibleInsights,
    scoring: input.scoring,
    truthNotes: [
      ...(input.scoringInput?.dataQualityNotes || []),
      ctx.targetGoalTruthStatus !== "direct"
        ? `The current student goal text is ${ctx.targetGoalTruthStatus} and was derived from ${ctx.targetGoalSource.replace(/_/g, " ")}.`
        : "",
    ].filter(Boolean),
  });

  const aiDocumentId = newDocumentId();

  await aiDocumentRepo.createDocument({
    aiDocumentId,
    studentProfileId: input.studentProfileId,
    sourceLlmRunId: result.llmRunId ?? null,
    documentType: "scenario_guidance",
    title: result.response.headline,
    bodyMarkdown: renderScenarioMarkdown(result.response),
    structuredPayload: {
      ...result.response,
      communicationPreferenceNotes: input.communicationPreferenceNotes || [],
      truthNotes: [
        ...(input.scoringInput?.dataQualityNotes || []),
        ctx.targetGoalTruthStatus !== "direct"
          ? `The current student goal text is ${ctx.targetGoalTruthStatus} and was derived from ${ctx.targetGoalSource.replace(/_/g, " ")}.`
          : "",
      ].filter(Boolean),
    },
    visibleTo: "student",
  });

  return {
    response: result.response,
    aiDocumentId,
    deliveryMode: result.deliveryMode,
    degradedReason: result.degradedReason,
  };
}
