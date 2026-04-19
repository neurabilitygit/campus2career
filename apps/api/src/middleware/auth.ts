import type { IncomingMessage } from "node:http";
import type { AuthenticatedUser } from "../types/auth";
import { verifySupabaseJwt } from "../services/auth/supabaseJwt";

/**
 * Resolution order:
 * 1. Authorization: Bearer <token> (Supabase JWT)
 * 2. x-demo-user-id / x-demo-role-type fallback for local development
 */
export async function getAuthenticatedUser(req: IncomingMessage): Promise<AuthenticatedUser | null> {
  const authHeader = req.headers["authorization"];
  if (typeof authHeader === "string" && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    try {
      const verified = await verifySupabaseJwt(token);
      if (verified) return verified;
    } catch (error) {
      console.error("JWT verification failed", error);
      return null;
    }
  }

  const userIdHeader = req.headers["x-demo-user-id"];
  const roleTypeHeader = req.headers["x-demo-role-type"];
  const emailHeader = req.headers["x-demo-email"];

  const userId = typeof userIdHeader === "string" ? userIdHeader : null;
  const roleType =
    typeof roleTypeHeader === "string" &&
    ["student", "parent", "coach", "admin"].includes(roleTypeHeader)
      ? (roleTypeHeader as AuthenticatedUser["roleType"])
      : null;
  const email = typeof emailHeader === "string" ? emailHeader : undefined;

  if (!userId || !roleType) return null;
  return { userId, roleType, email };
}
