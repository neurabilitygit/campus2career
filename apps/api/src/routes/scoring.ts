import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { demoFinanceAnalystScoringInput } from "../fixtures/demoStudentScoringInput";
import { runScoring } from "../services/scoring";
import { explainScore } from "../services/scoring/explain";
import { resolveRequestContext } from "../services/auth/resolveRequestContext";
import { buildStudentScoringInput } from "../services/student/aggregateStudentContext";
import { unauthorized, badRequest, json } from "../utils/http";
import { readJsonBody } from "../utils/body";
import type { SubScores } from "../../../../packages/shared/src/scoring/types";

const scoringPreviewBodySchema = z.object({
  targetRoleFamily: z.string().trim().min(1).max(120).optional(),
  targetSectorCluster: z.string().trim().min(1).max(120).optional(),
  compareToRoleFamily: z.string().trim().min(1).max(120).optional(),
});

const subScoreKeys: Array<keyof SubScores> = [
  "roleAlignment",
  "marketDemand",
  "academicReadiness",
  "experienceStrength",
  "proofOfWorkStrength",
  "networkStrength",
  "executionMomentum",
];

async function buildScoringPayload(studentProfileId: string, options?: {
  targetRoleFamily?: string;
  targetSectorCluster?: string;
}) {
  const scoringInput = await buildStudentScoringInput(studentProfileId, options);
  const scoring = runScoring(scoringInput);
  return { scoring, scoringInput };
}

/**
 * Fixed payload for local docs, Storybook, or a “sample scoring” dev panel.
 * Prefer GET /students/me/scoring for real user context.
 */
export async function scoringRoute(_req: IncomingMessage, res: ServerResponse) {
  const demo = runScoring(demoFinanceAnalystScoringInput);

  res.statusCode = 200;
  res.setHeader("content-type", "application/json");
  res.end(
    JSON.stringify(
      {
        ok: true,
        mode: "demo",
        warning: "This endpoint returns demo-only scoring content and does not read any real student record.",
        scoring: demo,
        scoringInput: demoFinanceAnalystScoringInput,
      },
      null,
      2
    )
  );
}

export async function scoringLiveRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await resolveRequestContext(req);

    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated user");
    }

    const { scoringInput, scoring } = await buildScoringPayload(ctx.studentProfileId);

    return json(res, 200, { scoring, scoringInput, resolvedContext: ctx });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    throw error;
  }
}

export async function scoringPreviewRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    let raw: unknown;
    try {
      raw = await readJsonBody(req);
    } catch {
      return badRequest(res, "Invalid JSON body");
    }

    const parsed = scoringPreviewBodySchema.safeParse(raw);
    if (!parsed.success) {
      const message =
        parsed.error.issues.map((issue) => (issue.path.length ? `${issue.path.join(".")}: ` : "") + issue.message).join("; ") ||
        "Invalid request body";
      return badRequest(res, message);
    }

    const ctx = await resolveRequestContext(req);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated user");
    }

    const selected = await buildScoringPayload(ctx.studentProfileId, {
      targetRoleFamily: parsed.data.targetRoleFamily,
      targetSectorCluster: parsed.data.targetSectorCluster,
    });

    let comparison: {
      scoring: ReturnType<typeof runScoring>;
      scoringInput: typeof selected.scoringInput;
      deltaOverallScore: number;
      deltaSubScores: Record<string, number>;
    } | null = null;

    if (
      parsed.data.compareToRoleFamily &&
      parsed.data.compareToRoleFamily.toLowerCase() !== selected.scoring.targetRoleFamily.toLowerCase()
    ) {
      const comparePayload = await buildScoringPayload(ctx.studentProfileId, {
        targetRoleFamily: parsed.data.compareToRoleFamily,
      });
      const deltaSubScores = Object.fromEntries(
        subScoreKeys.map((key) => [
          key,
          comparePayload.scoring.subScores[key] - selected.scoring.subScores[key],
        ])
      );
      comparison = {
        scoring: comparePayload.scoring,
        scoringInput: comparePayload.scoringInput,
        deltaOverallScore: comparePayload.scoring.overallScore - selected.scoring.overallScore,
        deltaSubScores,
      };
    }

    return json(res, 200, {
      scoring: selected.scoring,
      scoringInput: selected.scoringInput,
      comparison,
      resolvedContext: ctx,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    throw error;
  }
}

export async function scoringExplainRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    let raw: unknown;
    try {
      raw = await readJsonBody(req);
    } catch {
      return badRequest(res, "Invalid JSON body");
    }

    const parsed = scoringPreviewBodySchema.safeParse(raw);
    if (!parsed.success) {
      const message =
        parsed.error.issues.map((issue) => (issue.path.length ? `${issue.path.join(".")}: ` : "") + issue.message).join("; ") ||
        "Invalid request body";
      return badRequest(res, message);
    }

    const ctx = await resolveRequestContext(req);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated user");
    }

    const selected = await buildScoringPayload(ctx.studentProfileId, {
      targetRoleFamily: parsed.data.targetRoleFamily,
      targetSectorCluster: parsed.data.targetSectorCluster,
    });

    let comparison:
      | {
          scoring: ReturnType<typeof runScoring>;
          scoringInput: typeof selected.scoringInput;
        }
      | undefined;

    if (
      parsed.data.compareToRoleFamily &&
      parsed.data.compareToRoleFamily.toLowerCase() !== selected.scoring.targetRoleFamily.toLowerCase()
    ) {
      comparison = await buildScoringPayload(ctx.studentProfileId, {
        targetRoleFamily: parsed.data.compareToRoleFamily,
      });
    }

    const explanation = explainScore({
      selectedInput: selected.scoringInput,
      selectedScoring: selected.scoring,
      comparisonInput: comparison?.scoringInput,
      comparisonScoring: comparison?.scoring,
    });

    return json(res, 200, {
      explanation,
      resolvedContext: ctx,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    throw error;
  }
}
