import type { IncomingMessage, ServerResponse } from "node:http";
import { resolveRequestContext } from "../services/auth/resolveRequestContext";
import { unauthorized, json } from "../utils/http";

export async function authMeRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await resolveRequestContext(req);
    return json(res, 200, {
      authenticated: true,
      context: ctx,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    throw error;
  }
}
