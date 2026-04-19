import type { ScoringOutput } from "../../../../../packages/shared/src/scoring/types";
import { aggregateStudentContext } from "../student/aggregateStudentContext";
import { runScenarioChat } from "./scenarioChat";

export async function runScenarioChatWithContext(input: {
  studentProfileId: string;
  targetRoleFamily: string;
  targetSectorCluster: string;
  scenarioQuestion: string;
  communicationStyle?: string;
  scoring: ScoringOutput;
}) {
  const ctx = await aggregateStudentContext(input.studentProfileId);

  return runScenarioChat({
    studentName: ctx.studentName,
    targetRoleFamily: input.targetRoleFamily,
    targetSectorCluster: input.targetSectorCluster,
    scenarioQuestion: input.scenarioQuestion,
    communicationStyle: input.communicationStyle,
    parentVisibleInsights: ctx.parentVisibleInsights,
    scoring: input.scoring,
  });
}
