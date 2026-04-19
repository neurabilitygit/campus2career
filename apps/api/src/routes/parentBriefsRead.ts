import type { IncomingMessage, ServerResponse } from "node:http";
import { ParentBriefRepository } from "../repositories/briefs/parentBriefRepository";
import { resolveRequestContext } from "../services/auth/resolveRequestContext";
import { unauthorized, badRequest, forbidden, json } from "../utils/http";

const repo = new ParentBriefRepository();

export async function parentLatestBriefRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await resolveRequestContext(req);

    const role = ctx.authenticatedRoleType;
    if (role !== "parent" && role !== "coach" && role !== "admin") {
      return forbidden(res, "This endpoint is only available to parent, coach, or admin roles");
    }

    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated user");
    }

    const brief = await repo.findLatestForContext({
      studentProfileId: ctx.studentProfileId,
      householdId: ctx.householdId,
    });

    return json(res, 200, { brief, resolvedContext: ctx });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    throw error;
  }
}
