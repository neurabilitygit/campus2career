"use client";

import type {
  AuthChangeEvent,
  Session,
  SupabaseClient,
} from "@supabase/supabase-js";
import { rememberGoogleAccountFromSession } from "./authFlow";
import { readStoredDemoAuth } from "./demoAuth";
import { getSupabaseBrowserClient } from "./supabaseClient";

export type SessionState = {
  session: Session | null;
  loading: boolean;
  error: string | null;
  lastCheckedAt: number | null;
};

const SESSION_TIMEOUT_MS = 5000;
const STALE_REFRESH_GRACE_MS = 2000;
const STALE_REFRESH_MS = SESSION_TIMEOUT_MS + STALE_REFRESH_GRACE_MS;

let state: SessionState = {
  session: null,
  loading: true,
  error: null,
  lastCheckedAt: null,
};

const listeners = new Set<() => void>();
let authClient: SupabaseClient | null = null;
let authListenerBound = false;
let activeRefresh: Promise<void> | null = null;
let activeRefreshStartedAt: number | null = null;
let sessionInitialized = false;
let latestRefreshId = 0;

function getDemoSession(): Session | null {
  const demoAuth = readStoredDemoAuth();
  if (!demoAuth) {
    return null;
  }

  return {
    access_token: "demo-auth-token",
    refresh_token: "demo-auth-refresh",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user: {
      id: demoAuth.userId,
      email: demoAuth.email,
      role: demoAuth.roleType,
      aud: "authenticated",
      app_metadata: { provider: "demo-auth" },
      user_metadata: {},
      created_at: new Date().toISOString(),
    },
  } as Session;
}

function emit(next: SessionState) {
  state = next;
  for (const listener of Array.from(listeners)) {
    listener();
  }
}

function emitSession(session: Session | null, error: string | null = null) {
  if (session) {
    rememberGoogleAccountFromSession(session);
  }
  emit({
    session,
    loading: false,
    error,
    lastCheckedAt: Date.now(),
  });
}

function handleAuthStateChange(_event: AuthChangeEvent, session: Session | null) {
  emitSession(session, null);
}

function ensureAuthListener() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    authClient = null;
    authListenerBound = false;
    return null;
  }

  if (authListenerBound && authClient === supabase) {
    return supabase;
  }

  authClient = supabase;
  authListenerBound = true;
  supabase.auth.onAuthStateChange(handleAuthStateChange);
  return supabase;
}

async function getSessionWithTimeout(supabase: SupabaseClient) {
  let timeoutId: number | null = null;

  try {
    return await Promise.race([
      supabase.auth.getSession(),
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(new Error("Session check timed out."));
        }, SESSION_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  }
}

export function getSessionSnapshot(): SessionState {
  return state;
}

export function subscribeToSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function initializeSession() {
  const demoSession = getDemoSession();
  if (demoSession) {
    sessionInitialized = true;
    emitSession(demoSession, null);
    return Promise.resolve();
  }

  if (activeRefreshStartedAt !== null && Date.now() - activeRefreshStartedAt > STALE_REFRESH_MS) {
    activeRefresh = null;
    activeRefreshStartedAt = null;
  }

  if (sessionInitialized) {
    if (activeRefresh) {
      return activeRefresh;
    }

    if (state.loading || state.lastCheckedAt === null) {
      return refreshSession({ force: true });
    }

    return Promise.resolve();
  }

  sessionInitialized = true;
  return refreshSession();
}

export async function refreshSession(options?: { force?: boolean }) {
  const demoSession = getDemoSession();
  if (demoSession) {
    emitSession(demoSession, null);
    return;
  }

  const supabase = ensureAuthListener();

  if (!supabase) {
    emit({
      session: null,
      loading: false,
      error: null,
      lastCheckedAt: Date.now(),
    });
    return;
  }

  if (activeRefreshStartedAt !== null && Date.now() - activeRefreshStartedAt > STALE_REFRESH_MS) {
    activeRefresh = null;
    activeRefreshStartedAt = null;
  }

  if (activeRefresh && !options?.force) {
    return activeRefresh;
  }

  emit({
    ...state,
    loading: true,
    error: null,
  });

  const refreshId = ++latestRefreshId;
  activeRefreshStartedAt = Date.now();

  activeRefresh = (async () => {
    try {
      const result = await getSessionWithTimeout(supabase);
      if (refreshId !== latestRefreshId) {
        return;
      }
      emitSession(result.data.session || null, result.error?.message || null);
    } catch (error) {
      if (refreshId !== latestRefreshId) {
        return;
      }
      emit({
        session: state.session,
        loading: false,
        error: error instanceof Error ? error.message : String(error),
        lastCheckedAt: Date.now(),
      });
    } finally {
      if (refreshId === latestRefreshId) {
        activeRefresh = null;
        activeRefreshStartedAt = null;
      }
    }
  })();

  return activeRefresh;
}

export function clearSessionState() {
  latestRefreshId += 1;
  activeRefresh = null;
  activeRefreshStartedAt = null;
  emit({
    session: null,
    loading: false,
    error: null,
    lastCheckedAt: Date.now(),
  });
}
