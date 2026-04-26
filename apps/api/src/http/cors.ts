import type { IncomingHttpHeaders } from "node:http";

function normalizeOrigin(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    return url.origin;
  } catch {
    return null;
  }
}

export function resolveAllowedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const configured = (env.API_ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => normalizeOrigin(value))
    .filter((value): value is string => Boolean(value));

  const derived = [env.APP_BASE_URL, env.NEXT_PUBLIC_APP_URL]
    .map((value) => normalizeOrigin(value))
    .filter((value): value is string => Boolean(value));

  const defaults =
    env.NODE_ENV === "production"
      ? []
      : ["http://localhost:3000", "http://localhost:3100"];

  return Array.from(new Set([...configured, ...derived, ...defaults]));
}

export function resolveCorsOrigin(
  headers: IncomingHttpHeaders,
  env: NodeJS.ProcessEnv = process.env
): string | null {
  const requestOrigin = normalizeOrigin(
    Array.isArray(headers.origin) ? headers.origin[0] : headers.origin
  );
  if (!requestOrigin) {
    return null;
  }

  const allowedOrigins = resolveAllowedOrigins(env);
  return allowedOrigins.includes(requestOrigin) ? requestOrigin : null;
}

