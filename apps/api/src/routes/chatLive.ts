import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { runScoring } from "../services/scoring";
import { runScenarioChatWithContext } from "../services/chat/orchestrator";
import { resolveRequestContext } from "../services/auth/resolveRequestContext";
import { unauthorized, badRequest, json } from "../utils/http";
import { buildStudentScoringInput } from "../services/student/aggregateStudentContext";
import { readJsonBody } from "../utils/body";

const scenarioChatLiveBodySchema = z.object({
  scenarioQuestion: z.string().trim().min(1, "scenarioQuestion is required").max(8000),
  communicationStyle: z.string().trim().max(64).optional(),
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

    const { scenarioQuestion, communicationStyle } = parsed.data;
    const style = communicationStyle && communicationStyle.length > 0 ? communicationStyle : "direct";

    const ctx = await resolveRequestContext(req);

    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated user");
    }

    const scoringInput = await buildStudentScoringInput(ctx.studentProfileId);
    const scoring = runScoring(scoringInput);

    const response = await runScenarioChatWithContext({
      studentProfileId: ctx.studentProfileId,
      targetRoleFamily: scoringInput.targetRoleFamily,
      targetSectorCluster: scoringInput.targetSectorCluster,
      scenarioQuestion,
      communicationStyle: style,
      scoring,
    });

    return json(res, 200, { response, resolvedContext: ctx });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    throw error;
  }
}
