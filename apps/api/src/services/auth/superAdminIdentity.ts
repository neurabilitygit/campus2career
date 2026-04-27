import type { AuthenticatedUser } from "../../types/auth";

export const RETURNING_SUPERUSER_EMAIL = "eric.bassman@gmail.com";

function normalize(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

export function isReturningSuperUserIdentity(
  auth?: Pick<AuthenticatedUser, "email" | "firstName" | "lastName" | "preferredName"> | null
) {
  if (!auth) {
    return false;
  }

  return normalize(auth.email) === RETURNING_SUPERUSER_EMAIL;
}
