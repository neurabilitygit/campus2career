import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { runScoring } from "../services/scoring";
import { runScenarioChatWithContext } from "../services/chat/orchestrator";
import { resolveRequestContext } from "../services/auth/resolveRequestContext";
import { unauthorized, badRequest, json, serviceUnavailable } from "../utils/http";
import { buildStudentScoringInput } from "../services/student/aggregateStudentContext";
import { readJsonBody } from "../utils/body";

const scenarioChatLiveBodySchema = z.object({
  scenarioQuestion: z.string().trim().min(1, "scenarioQuestion is required").max(8000),
  communicationStyle: z.string().trim().max(64).optional(),
  targetRoleFamily: z.string().trim().min(1).max(120).optional(),
  targetSectorCluster: z.string().trim().min(1).max(120).optional(),
});

export async function scenarioChatLiveRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    let raw: unknown;
    try {
      raw = await readJsonBody(req);
    } catch {
      return badRequest(res, "Invalid JSON body");
    }

    const parsed = scenarioChatLiveBodySchema.safeParse(raw);
    if (!parsed.success) {
      const message =
        parsed.error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ` : "") + i.message).join("; ") ||
        "Invalid request body";
      return badRequest(res, message);
    }

    const { scenarioQuestion, communicationStyle, targetRoleFamily, targetSectorCluster } = parsed.data;
    const style = communicationStyle && communicationStyle.length > 0 ? communicationStyle : "direct";

    const ctx = await resolveRequestContext(req);

    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated user");
    }

    const scoringInput = await buildStudentScoringInput(ctx.studentProfileId, {
      targetRoleFamily,
      targetSectorCluster,
    });
    const scoring = runScoring(scoringInput);

    const result = await runScenarioChatWithContext({
      studentProfileId: ctx.studentProfileId,
      targetRoleFamily: scoringInput.targetRoleFamily,
      targetSectorCluster: scoringInput.targetSectorCluster,
      scenarioQuestion,
      communicationStyle: style,
      scoring,
      scoringInput,
    });

    return json(res, 200, {
      response: result.response,
      aiDocumentId: result.aiDocumentId,
      deliveryMode: result.deliveryMode,
      degradedReason: result.degradedReason || null,
      resolvedContext: ctx,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    if (error?.status === 429 || error?.code === "insufficient_quota") {
      return serviceUnavailable(
        res,
        "Scenario guidance is temporarily unavailable because the configured OpenAI project has no remaining quota.",
        {
          provider: "openai",
          providerError: error?.code || "rate_limited",
        }
      );
    }
    throw error;
  }
}
