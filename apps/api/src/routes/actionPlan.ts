import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import type {
  StudentActionPlanDecision,
  StudentActionPlanDueStatus,
  StudentActionPlanOption,
  StudentActionPlanResponse,
  StudentActionPlanSourceKind,
  StudentActionPlanSummary,
} from "../../../../packages/shared/src/contracts/actionPlan";
import type { RecommendationItem } from "../../../../packages/shared/src/scoring/types";
import { badRequest, json, unauthorized } from "../utils/http";
import { readJsonBody } from "../utils/body";
import { resolveRequestContext } from "../services/auth/resolveRequestContext";
import { buildStudentScoringInput } from "../services/student/aggregateStudentContext";
import { runScoring } from "../services/scoring";
import { explainScore } from "../services/scoring/explain";
import {
  listStudentActionPlanItems,
  saveStudentActionPlanItem,
} from "../repositories/studentActionPlanRepository";

const saveActionPlanSchema = z.object({
  title: z.string().trim().min(1).max(500),
  decision: z.enum(["ignore", "explore", "accept"]),
  planningNotes: z.string().trim().max(5000).nullable().optional(),
  nextStepDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  actionCategory: z.string().trim().max(120).nullable().optional(),
  priorityLevel: z.number().int().min(1).max(5).nullable().optional(),
});

function normalizeTitle(value: string) {
  return value.trim().toLowerCase();
}

function deriveSourceKind(
  title: string,
  recommendation: RecommendationItem | undefined,
  topRisks: string[]
): StudentActionPlanSourceKind {
  if (recommendation) return "recommendation";
  if (title.startsWith("Review requirement coverage for ")) return "requirement_gap";
  if (topRisks.some((risk) => normalizeTitle(risk) === normalizeTitle(title))) return "risk";
  return "saved_plan";
}

function deriveDescription(
  sourceKind: StudentActionPlanSourceKind,
  recommendation: RecommendationItem | undefined
) {
  if (recommendation?.description) {
    return recommendation.description;
  }
  if (sourceKind === "requirement_gap") {
    return "This step comes from missing required course coverage in the current curriculum map.";
  }
  if (sourceKind === "risk") {
    return "This concern is limiting the current readiness picture and deserves a direct response.";
  }
  if (sourceKind === "saved_plan") {
    return "This step is still on the student action plan even though it is not in the current top recommendation set.";
  }
  return null;
}

function deriveRationale(
  sourceKind: StudentActionPlanSourceKind,
  recommendation: RecommendationItem | undefined
) {
  if (recommendation?.whyThisMatchesStudent) {
    return recommendation.whyThisMatchesStudent;
  }
  if (sourceKind === "requirement_gap") {
    return "Requirement coverage affects both the readiness picture and how confidently the system can score progress.";
  }
  if (sourceKind === "risk") {
    return "Addressing this risk directly can keep the student from staying stuck in a provisional or stalled state.";
  }
  return null;
}

function deriveDueStatus(nextStepDate: string | null, decision: StudentActionPlanDecision | null): StudentActionPlanDueStatus {
  if (!nextStepDate || !decision || decision === "ignore") {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${nextStepDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) {
    return null;
  }

  const diffMs = due.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / 86400000);
  if (diffDays < 0) return "overdue";
  if (diffDays <= 7) return "due_soon";
  return "scheduled";
}

function buildSummary(options: StudentActionPlanOption[]): StudentActionPlanSummary {
  const accepted = options.filter((item) => item.decision === "accept");
  const explored = options.filter((item) => item.decision === "explore");
  const ignored = options.filter((item) => item.decision === "ignore");
  const selected = [...accepted, ...explored];

  return {
    acceptedCount: accepted.length,
    exploredCount: explored.length,
    ignoredCount: ignored.length,
    overdueCount: options.filter((item) => item.dueStatus === "overdue").length,
    dueSoonCount: options.filter((item) => item.dueStatus === "due_soon").length,
    selectedTitles: selected.map((item) => item.title),
    primaryTitle: selected[0]?.title || null,
  };
}

async function buildStudentActionPlan(studentProfileId: string): Promise<StudentActionPlanResponse["plan"]> {
  const scoringInput = await buildStudentScoringInput(studentProfileId);
  const scoring = runScoring(scoringInput);
  const explanation = explainScore({
    selectedInput: scoringInput,
    selectedScoring: scoring,
  });
  const persisted = await listStudentActionPlanItems(studentProfileId);
  const persistedByTitle = new Map(persisted.map((item) => [normalizeTitle(item.title), item]));
  const topRisks = scoring.topRisks || [];
  const currentActionTitles = new Set(explanation.immediateActions.map((item) => normalizeTitle(item)));

  const options: StudentActionPlanOption[] = explanation.immediateActions.map((title, index) => {
    const recommendation = scoring.recommendations.find(
      (item) => normalizeTitle(item.title) === normalizeTitle(title)
    );
    const persistedItem = persistedByTitle.get(normalizeTitle(title));
    const sourceKind = deriveSourceKind(title, recommendation, topRisks);
    const decision = persistedItem?.decision || null;

    return {
      actionKey: normalizeTitle(title),
      title,
      description: deriveDescription(sourceKind, recommendation),
      rationale: deriveRationale(sourceKind, recommendation),
      sourceKind,
      actionCategory: persistedItem?.actionCategory || recommendation?.recommendationType || null,
      priorityLevel: persistedItem?.priorityLevel || Math.max(1, 5 - index),
      decision,
      planningNotes: persistedItem?.planningNotes || null,
      nextStepDate: persistedItem?.nextStepDate || null,
      dueStatus: deriveDueStatus(persistedItem?.nextStepDate || null, decision),
      isCurrentRecommendation: true,
    };
  });

  for (const persistedItem of persisted) {
    const normalizedTitle = normalizeTitle(persistedItem.title);
    if (currentActionTitles.has(normalizedTitle) || persistedItem.decision === "ignore") {
      continue;
    }

    options.push({
      actionKey: normalizedTitle,
      title: persistedItem.title,
      description: deriveDescription("saved_plan", undefined),
      rationale: null,
      sourceKind: "saved_plan",
      actionCategory: persistedItem.actionCategory,
      priorityLevel: persistedItem.priorityLevel,
      decision: persistedItem.decision,
      planningNotes: persistedItem.planningNotes,
      nextStepDate: persistedItem.nextStepDate,
      dueStatus: deriveDueStatus(persistedItem.nextStepDate, persistedItem.decision),
      isCurrentRecommendation: false,
    });
  }

  return {
    options,
    summary: buildSummary(options),
  };
}

export async function studentActionPlanRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await resolveRequestContext(req);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated user");
    }

    const plan = await buildStudentActionPlan(ctx.studentProfileId);
    return json(res, 200, { ok: true, plan });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    throw error;
  }
}

export async function studentActionPlanSaveRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    let raw: unknown;
    try {
      raw = await readJsonBody(req);
    } catch {
      return badRequest(res, "Invalid JSON body");
    }

    const parsed = saveActionPlanSchema.safeParse(raw);
    if (!parsed.success) {
      const message =
        parsed.error.issues
          .map((issue) => (issue.path.length ? `${issue.path.join(".")}: ` : "") + issue.message)
          .join("; ") || "Invalid request body";
      return badRequest(res, message);
    }

    if (parsed.data.decision !== "ignore" && !parsed.data.nextStepDate) {
      return badRequest(res, "nextStepDate: Choose a next-step date when exploring or accepting an action");
    }

    const ctx = await resolveRequestContext(req);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated user");
    }

    await saveStudentActionPlanItem({
      studentProfileId: ctx.studentProfileId,
      title: parsed.data.title,
      planningNotes: parsed.data.planningNotes || null,
      actionCategory: parsed.data.actionCategory || null,
      nextStepDate: parsed.data.decision === "ignore" ? null : parsed.data.nextStepDate || null,
      priorityLevel: parsed.data.priorityLevel || null,
      decision: parsed.data.decision,
    });

    const plan = await buildStudentActionPlan(ctx.studentProfileId);
    return json(res, 200, { ok: true, message: "Action plan updated.", plan });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    throw error;
  }
}
