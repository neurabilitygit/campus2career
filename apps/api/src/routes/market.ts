import type { IncomingMessage, ServerResponse } from "node:http";
import { OccupationRepository } from "../repositories/market/occupationRepository";
import { resolveRequestContext } from "../services/auth/resolveRequestContext";
import { forbidden, json, unauthorized } from "../utils/http";

const repo = new OccupationRepository();

export async function roleMappingsDiagnosticsRoute(
  req: IncomingMessage,
  res: ServerResponse
) {
  try {
    const ctx = await resolveRequestContext(req);

    if (ctx.authenticatedRoleType !== "coach" && ctx.authenticatedRoleType !== "admin") {
      return forbidden(res, "Coach or admin role required");
    }

    const mappings = await repo.listOccupationMappingDiagnostics();

    return json(res, 200, {
      ok: true,
      mappingCount: mappings.length,
      mappings,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    throw error;
  }
}
