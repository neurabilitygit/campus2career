import crypto from "node:crypto";
import { ParentBriefRepository } from "../../repositories/briefs/parentBriefRepository";
import { aggregateStudentContext } from "../student/aggregateStudentContext";
import { generateParentBrief } from "./generator";
import type { ScoringOutput, StudentScoringInput } from "../../../../../packages/shared/src/scoring/types";

const repo = new ParentBriefRepository();

function stableId(namespace: string, key: string): string {
  return crypto.createHash("sha256").update(`${namespace}:${key}`).digest("hex").slice(0, 32);
}

export async function generateAndPersistParentBrief(input: {
  householdId?: string | null;
  studentProfileId: string;
  monthLabel: string;
  scoring: ScoringOutput;
  scoringInput?: StudentScoringInput;
}) {
  const ctx = await aggregateStudentContext(input.studentProfileId);

  const brief = await generateParentBrief({
    studentProfileId: input.studentProfileId,
    householdId: input.householdId ?? null,
    studentName: ctx.studentName,
    monthLabel: input.monthLabel,
    targetGoal: ctx.targetGoal,
    accomplishments: ctx.accomplishments,
    scoring: input.scoring,
    upcomingDeadlines: ctx.upcomingDeadlines,
    parentVisibleInsights: ctx.parentVisibleInsights,
    truthNotes: [
      ...(input.scoringInput?.dataQualityNotes || []),
      ctx.targetGoalTruthStatus !== "direct"
        ? `The current student goal text is ${ctx.targetGoalTruthStatus} and was derived from ${ctx.targetGoalSource.replace(/_/g, " ")}.`
        : "",
    ].filter(Boolean),
  });

  await repo.insertBrief({
    parentMonthlyBriefId: stableId("parent_monthly_brief", `${input.studentProfileId}:${input.monthLabel}`),
    householdId: input.householdId,
    studentProfileId: input.studentProfileId,
    monthLabel: input.monthLabel,
    trajectoryStatus: input.scoring.trajectoryStatus,
    keyMarketChanges: "Market changes integration will be sourced from persisted market signals.",
    progressSummary: ctx.accomplishments.join(" | ").slice(0, 4000),
    topRisks: input.scoring.topRisks.join(" | ").slice(0, 4000),
    recommendedParentQuestions: "What progress have you made on your highest-priority action items? | Where do you need introductions or support this month?",
    recommendedParentActions: input.scoring.recommendations.map((r) => r.title).slice(0, 3).join(" | "),
  });

  return {
    brief: brief.brief,
    deliveryMode: brief.deliveryMode,
    degradedReason: brief.degradedReason,
    context: ctx,
  };
}
