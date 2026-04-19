"use client";

import type { CSSProperties } from "react";
import { getSupabaseBrowserClient, getSupabaseConfigError } from "../lib/supabaseClient";
import { useSession } from "../hooks/useSession";

const buttonBaseStyle: CSSProperties = {
  border: "none",
  borderRadius: 999,
  padding: "12px 18px",
  fontSize: 14,
  fontWeight: 700,
  transition: "transform 160ms ease, opacity 160ms ease, background 160ms ease, color 160ms ease",
  cursor: "pointer",
};

export function AuthButtons() {
  const supabase = getSupabaseBrowserClient();
  const disabledReason = getSupabaseConfigError();
  const { isAuthenticated, loading } = useSession();

  const signInDisabled = !supabase || loading || isAuthenticated;
  const signOutDisabled = !supabase || loading || !isAuthenticated;

  async function signInWithGoogle() {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={signInWithGoogle}
          disabled={signInDisabled}
          style={{
            ...buttonBaseStyle,
            background: signInDisabled ? "#cbd5e1" : "linear-gradient(135deg, #ff7a18 0%, #ffb347 100%)",
            color: signInDisabled ? "#475569" : "#1f2937",
            boxShadow: signInDisabled ? "none" : "0 12px 24px rgba(255, 122, 24, 0.25)",
            opacity: signInDisabled ? 0.8 : 1,
          }}
        >
          {loading ? "Checking session..." : "Sign in with Google"}
        </button>
        <button
          onClick={signOut}
          disabled={signOutDisabled}
          style={{
            ...buttonBaseStyle,
            background: signOutDisabled ? "#dbe4f0" : "linear-gradient(135deg, #155eef 0%, #4bb3fd 100%)",
            color: signOutDisabled ? "#64748b" : "#eff6ff",
            boxShadow: signOutDisabled ? "none" : "0 12px 24px rgba(21, 94, 239, 0.22)",
            opacity: signOutDisabled ? 0.8 : 1,
          }}
        >
          Sign out
        </button>
      </div>
      {disabledReason ? <p style={{ margin: 0, color: "crimson" }}>{disabledReason}</p> : null}
    </div>
  );
}
