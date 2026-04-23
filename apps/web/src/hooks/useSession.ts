"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  getSessionSnapshot,
  initializeSession,
  refreshSession,
  subscribeToSession,
} from "../lib/sessionStore";

export function useSession() {
  const state = useSyncExternalStore(
    subscribeToSession,
    getSessionSnapshot,
    getSessionSnapshot
  );

  useEffect(() => {
    void initializeSession();
  }, []);

  return {
    session: state.session,
    loading: state.loading,
    error: state.error,
    lastCheckedAt: state.lastCheckedAt,
    hasResolvedOnce: state.lastCheckedAt !== null,
    isAuthenticated: !!state.session,
    refresh: () => refreshSession({ force: true }),
  };
}
