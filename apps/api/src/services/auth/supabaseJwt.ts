import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from "jose";
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

let remoteJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getRemoteJwks() {
  if (!supabaseConfig.url) {
    throw new Error("SUPABASE_URL is required for JWKS verification");
  }

  if (!remoteJwks) {
    remoteJwks = createRemoteJWKSet(
      new URL(`${supabaseConfig.url}/auth/v1/.well-known/jwks.json`)
    );
  }

  return remoteJwks;
}

export async function verifySupabaseJwt(token: string): Promise<AuthenticatedUser | null> {
  const protectedHeader = decodeProtectedHeader(token);
  const algorithm = protectedHeader.alg;

  if (typeof algorithm === "string" && algorithm.startsWith("HS")) {
    if (!supabaseConfig.jwtSecret) {
      throw new Error("SUPABASE_JWT_SECRET is required for JWT verification");
    }

    const secret = new TextEncoder().encode(supabaseConfig.jwtSecret);
    const { payload } = await jwtVerify(token, secret, {
      issuer: `${supabaseConfig.url}/auth/v1`,
      audience: "authenticated",
    });

    const typed = payload as unknown as SupabaseJwtPayload;
    if (!typed.sub) return null;

    return {
      userId: typed.sub,
      email: typed.email,
      roleType: mapSupabaseRole(typed),
      firstName: readFirstName(typed),
      lastName: readLastName(typed),
      preferredName: readPreferredName(typed),
    };
  }

  const { payload } = await jwtVerify(token, getRemoteJwks(), {
    issuer: `${supabaseConfig.url}/auth/v1`,
    audience: "authenticated",
  });

  const typed = payload as unknown as SupabaseJwtPayload;
  if (!typed.sub) return null;

  return {
    userId: typed.sub,
    email: typed.email,
    roleType: mapSupabaseRole(typed),
    firstName: readFirstName(typed),
    lastName: readLastName(typed),
    preferredName: readPreferredName(typed),
  };
}

function readPreferredName(payload: SupabaseJwtPayload) {
  const candidate =
    (typeof payload.user_metadata?.preferred_name === "string"
      ? payload.user_metadata.preferred_name
      : undefined) ||
    (typeof payload.user_metadata?.nickname === "string"
      ? payload.user_metadata.nickname
      : undefined);
  return candidate?.trim() || null;
}

function readFirstName(payload: SupabaseJwtPayload) {
  const explicit =
    (typeof payload.user_metadata?.given_name === "string"
      ? payload.user_metadata.given_name
      : undefined) ||
    (typeof payload.user_metadata?.first_name === "string"
      ? payload.user_metadata.first_name
      : undefined);
  if (explicit?.trim()) {
    return explicit.trim();
  }

  const fullName =
    (typeof payload.user_metadata?.full_name === "string"
      ? payload.user_metadata.full_name
      : undefined) ||
    (typeof payload.user_metadata?.name === "string" ? payload.user_metadata.name : undefined);

  return fullName?.trim()?.split(/\s+/)[0] || null;
}

function readLastName(payload: SupabaseJwtPayload) {
  const explicit =
    (typeof payload.user_metadata?.family_name === "string"
      ? payload.user_metadata.family_name
      : undefined) ||
    (typeof payload.user_metadata?.last_name === "string"
      ? payload.user_metadata.last_name
      : undefined);
  if (explicit?.trim()) {
    return explicit.trim();
  }

  const fullName =
    (typeof payload.user_metadata?.full_name === "string"
      ? payload.user_metadata.full_name
      : undefined) ||
    (typeof payload.user_metadata?.name === "string" ? payload.user_metadata.name : undefined);
  const parts = fullName?.trim().split(/\s+/).filter(Boolean) || [];
  if (parts.length <= 1) {
    return null;
  }
  return parts.slice(1).join(" ");
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
