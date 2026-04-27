"use client";

import type { Session, SupabaseClient } from "@supabase/supabase-js";

export type RememberedGoogleAccount = {
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
};

const AUTH_RETURN_TO_KEY = "rising-senior:auth:return-to";
const LAST_GOOGLE_ACCOUNT_KEY = "rising-senior:last-google-account";

function normalizeInternalRoute(route: string | null | undefined): string | null {
  if (!route) {
    return null;
  }

  const trimmed = route.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return null;
  }
  if (trimmed.startsWith("/auth/callback")) {
    return null;
  }
  return trimmed;
}

export function getCurrentAppRoute() {
  if (typeof window === "undefined") {
    return "/";
  }

  return `${window.location.pathname}${window.location.search}`;
}

export function setStoredAuthReturnTo(route: string | null | undefined) {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = normalizeInternalRoute(route);
  if (normalized && normalized !== "/auth") {
    window.sessionStorage.setItem(AUTH_RETURN_TO_KEY, normalized);
  } else {
    window.sessionStorage.removeItem(AUTH_RETURN_TO_KEY);
  }
}

export function consumeStoredAuthReturnTo(fallbackRoute: string = "/signup") {
  const fallback = normalizeInternalRoute(fallbackRoute) || "/signup";
  if (typeof window === "undefined") {
    return fallback;
  }

  const stored = normalizeInternalRoute(window.sessionStorage.getItem(AUTH_RETURN_TO_KEY));
  window.sessionStorage.removeItem(AUTH_RETURN_TO_KEY);
  if (!stored || stored === "/auth") {
    return fallback;
  }
  return stored;
}

export function readRememberedGoogleAccount(): RememberedGoogleAccount | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(LAST_GOOGLE_ACCOUNT_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<RememberedGoogleAccount>;
    if (typeof parsed.email !== "string" || !parsed.email.trim()) {
      return null;
    }

    return {
      email: parsed.email.trim(),
      fullName: typeof parsed.fullName === "string" && parsed.fullName.trim() ? parsed.fullName.trim() : null,
      avatarUrl: typeof parsed.avatarUrl === "string" && parsed.avatarUrl.trim() ? parsed.avatarUrl.trim() : null,
    };
  } catch {
    return null;
  }
}

export function writeRememberedGoogleAccount(account: RememberedGoogleAccount | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!account) {
    window.localStorage.removeItem(LAST_GOOGLE_ACCOUNT_KEY);
    return;
  }

  window.localStorage.setItem(LAST_GOOGLE_ACCOUNT_KEY, JSON.stringify(account));
}

export function rememberGoogleAccountFromSession(session: Session | null | undefined) {
  const user = session?.user;
  const email = user?.email?.trim();
  if (!email) {
    return;
  }

  const userMetadata = (user.user_metadata || {}) as {
    avatar_url?: string;
    full_name?: string;
    name?: string;
    given_name?: string;
    family_name?: string;
  };
  const fullName =
    (typeof userMetadata.full_name === "string" && userMetadata.full_name.trim()) ||
    (typeof userMetadata.name === "string" && userMetadata.name.trim()) ||
    [userMetadata.given_name, userMetadata.family_name].filter(Boolean).join(" ").trim() ||
    null;
  const avatarUrl =
    typeof userMetadata.avatar_url === "string" && userMetadata.avatar_url.trim()
      ? userMetadata.avatar_url.trim()
      : null;

  writeRememberedGoogleAccount({
    email,
    fullName,
    avatarUrl,
  });
}

export function redirectToAuth(input?: {
  returnTo?: string | null;
  signedOut?: boolean;
  reauth?: boolean;
  replace?: boolean;
}) {
  if (typeof window === "undefined") {
    return;
  }

  setStoredAuthReturnTo(input?.returnTo || getCurrentAppRoute());

  const query = new URLSearchParams();
  if (input?.signedOut) {
    query.set("signed_out", "1");
  }
  if (input?.reauth) {
    query.set("reauth", "1");
  }

  const href = query.size ? `/auth?${query.toString()}` : "/auth";
  if (input?.replace) {
    window.location.replace(href);
    return;
  }
  window.location.assign(href);
}

export async function beginGoogleSignIn(input: {
  supabase: SupabaseClient;
  returnTo?: string | null;
  loginHint?: string | null;
}) {
  const explicitReturnTo = normalizeInternalRoute(input.returnTo);
  if (explicitReturnTo) {
    setStoredAuthReturnTo(explicitReturnTo);
  } else if (typeof window !== "undefined" && !window.sessionStorage.getItem(AUTH_RETURN_TO_KEY)) {
    setStoredAuthReturnTo(getCurrentAppRoute());
  }

  const queryParams: Record<string, string> = {
    prompt: "select_account",
  };
  if (input.loginHint?.trim()) {
    queryParams.login_hint = input.loginHint.trim();
  }

  await input.supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams,
    },
  });
}
