import { jwtVerify } from "jose";
import { supabaseConfig } from "../../config/supabase";
import type { AuthenticatedUser } from "../../types/auth";

export interface SupabaseJwtPayload {
  sub?: string;
  email?: string;
  role?: string;
  aud?: string | string[];
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}

export async function verifySupabaseJwt(token: string): Promise<AuthenticatedUser | null> {
  if (!supabaseConfig.jwtSecret) {
    throw new Error("SUPABASE_JWT_SECRET is required for JWT verification");
  }

  const secret = new TextEncoder().encode(supabaseConfig.jwtSecret);
  const { payload } = await jwtVerify(token, secret);

  const typed = payload as unknown as SupabaseJwtPayload;
  if (!typed.sub) return null;

  return {
    userId: typed.sub,
    email: typed.email,
    roleType: mapSupabaseRole(typed),
  };
}

function mapSupabaseRole(payload: SupabaseJwtPayload): AuthenticatedUser["roleType"] {
  const roleCandidate =
    (typeof payload.app_metadata?.role === "string" ? payload.app_metadata.role : undefined) ||
    (typeof payload.user_metadata?.role === "string" ? payload.user_metadata.role : undefined) ||
    payload.role;

  if (roleCandidate === "service_role" || roleCandidate === "admin") return "admin";
  if (roleCandidate === "parent") return "parent";
  if (roleCandidate === "coach") return "coach";
  return "student";
}
