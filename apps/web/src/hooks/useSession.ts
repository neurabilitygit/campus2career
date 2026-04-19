"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabaseClient";

export function useSession() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      setSession(null);
      setError(null);
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    const timeout = window.setTimeout(() => {
      if (mounted) {
        setError("Session check timed out.");
        setLoading(false);
      }
    }, 6000);

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) return;
        window.clearTimeout(timeout);
        if (error) {
          setError(error.message);
          setSession(null);
          setLoading(false);
          return;
        }
        setError(null);
        setSession(data.session || null);
        setLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        window.clearTimeout(timeout);
        setError(err instanceof Error ? err.message : String(err));
        setSession(null);
        setLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        window.clearTimeout(timeout);
        setError(null);
        setSession(session || null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      window.clearTimeout(timeout);
      listener.subscription.unsubscribe();
    };
  }, []);

  return { session, loading, error, isAuthenticated: !!session };
}
