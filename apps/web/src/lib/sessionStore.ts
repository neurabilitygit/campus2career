"use client";

import type {
  AuthChangeEvent,
  Session,
  SupabaseClient,
} from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "./supabaseClient";

export type SessionState = {
  session: Session | null;
  loading: boolean;
  error: string | null;
  lastCheckedAt: number | null;
};

const SESSION_TIMEOUT_MS = 5000;

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

function emit(next: SessionState) {
  state = next;
  for (const listener of Array.from(listeners)) {
    listener();
  }
}

function emitSession(session: Session | null, error: string | null = null) {
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
  return Promise.race([
    supabase.auth.getSession(),
    new Promise<never>((_, reject) => {
      window.setTimeout(() => {
        reject(new Error("Session check timed out."));
      }, SESSION_TIMEOUT_MS);
    }),
  ]);
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

export async function refreshSession(options?: { force?: boolean }) {
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

  if (activeRefresh && !options?.force) {
    return activeRefresh;
  }

  emit({
    ...state,
    loading: true,
    error: null,
  });

  activeRefresh = (async () => {
    try {
      const result = await getSessionWithTimeout(supabase);
      emitSession(result.data.session || null, result.error?.message || null);
    } catch (error) {
      emit({
        session: state.session,
        loading: false,
        error: error instanceof Error ? error.message : String(error),
        lastCheckedAt: Date.now(),
      });
    } finally {
      activeRefresh = null;
    }
  })();

  return activeRefresh;
}
