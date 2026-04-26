import type { CareerScenarioRecord } from "../../../../packages/shared/src/contracts/careerScenario";

export type CareerScenarioComparison = {
  leftScenarioName: string;
  rightScenarioName: string;
  leftOverallScore: number | null;
  rightOverallScore: number | null;
  overallScoreDelta: number | null;
  qualificationShift: string | null;
  leftActions: string[];
  rightActions: string[];
  distinctLeftGaps: string[];
  distinctRightGaps: string[];
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function actionTitles(record: CareerScenarioRecord) {
  if (record.actionItems?.length) {
    return record.actionItems.map((item) => item.title);
  }
  return record.analysisResult?.scenarioSpecificActions || record.analysisResult?.recommendedActions || [];
}

export function compareCareerScenarios(
  left: CareerScenarioRecord | null | undefined,
  right: CareerScenarioRecord | null | undefined
): CareerScenarioComparison | null {
  if (!left || !right) {
    return null;
  }

  const leftScore = typeof left.readinessScoreSnapshot?.overallScore === "number" ? left.readinessScoreSnapshot.overallScore : null;
  const rightScore = typeof right.readinessScoreSnapshot?.overallScore === "number" ? right.readinessScoreSnapshot.overallScore : null;
  const leftGaps = left.analysisResult?.likelyGaps || [];
  const rightGaps = right.analysisResult?.likelyGaps || [];

  return {
    leftScenarioName: left.scenarioName,
    rightScenarioName: right.scenarioName,
    leftOverallScore: leftScore,
    rightOverallScore: rightScore,
    overallScoreDelta: leftScore != null && rightScore != null ? rightScore - leftScore : null,
    qualificationShift:
      left.analysisResult?.qualificationLabel && right.analysisResult?.qualificationLabel
        ? `${left.analysisResult.qualificationLabel} -> ${right.analysisResult.qualificationLabel}`
        : null,
    leftActions: actionTitles(left).slice(0, 3),
    rightActions: actionTitles(right).slice(0, 3),
    distinctLeftGaps: leftGaps.filter((item) => !rightGaps.some((candidate) => normalize(candidate) === normalize(item))).slice(0, 3),
    distinctRightGaps: rightGaps.filter((item) => !leftGaps.some((candidate) => normalize(candidate) === normalize(item))).slice(0, 3),
  };
}
