"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { getSupabaseBrowserClient, getSupabaseConfigError } from "../lib/supabaseClient";
import { setStoredTestContextRole } from "../lib/testContext";
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
  const { isAuthenticated, loading, error, refresh, hasResolvedOnce } = useSession();
  const [actionBusy, setActionBusy] = useState<"sign_in" | "sign_out" | null>(null);
  const [showSlowNotice, setShowSlowNotice] = useState(false);

  useEffect(() => {
    if (!loading) {
      setShowSlowNotice(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShowSlowNotice(true);
    }, 2500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loading]);

  const sessionAppearsStalled = loading && showSlowNotice && !hasResolvedOnce;
  const signInDisabled =
    !supabase ||
    isAuthenticated ||
    actionBusy !== null ||
    (loading && !sessionAppearsStalled);
  const signOutDisabled =
    !supabase ||
    !isAuthenticated ||
    actionBusy !== null;

  async function signInWithGoogle() {
    if (!supabase) return;
    setActionBusy("sign_in");
    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
    } finally {
      setActionBusy(null);
    }
  }

  async function signOut() {
    if (!supabase) return;
    setActionBusy("sign_out");
    try {
      await supabase.auth.signOut();
      setStoredTestContextRole(null);
      window.location.href = "/";
    } finally {
      setActionBusy(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div
        style={{
          display: "inline-flex",
          width: "fit-content",
          alignItems: "center",
          gap: 8,
          padding: "6px 10px",
          borderRadius: 999,
          background: isAuthenticated ? "rgba(255,255,255,0.16)" : "rgba(15, 23, 42, 0.18)",
          color: "#f8fafc",
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: 0.04,
          textTransform: "uppercase",
        }}
      >
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: isAuthenticated ? "#34d399" : "#cbd5e1",
          }}
        />
        {isAuthenticated ? "Signed in" : "Not signed in"}
      </div>
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
          {actionBusy === "sign_in"
            ? "Opening Google..."
            : loading && !sessionAppearsStalled
              ? "Checking session..."
              : "Continue with Google"}
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
          {actionBusy === "sign_out" ? "Signing out..." : "Log out"}
        </button>
      </div>
      {disabledReason ? (
        <p style={{ margin: 0, color: "#fee2e2" }}>{disabledReason}</p>
      ) : null}
      {showSlowNotice ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <p style={{ margin: 0, color: "#dbe7ff" }}>
            Session check is taking longer than expected. You can retry now or continue to Google sign-in directly.
          </p>
          <button
            type="button"
            onClick={() => {
              void refresh();
            }}
            style={{
              borderRadius: 999,
              border: "1px solid #cbd5e1",
              background: "#fff",
              padding: "8px 12px",
              fontWeight: 700,
              cursor: "pointer",
              color: "#0f172a",
            }}
          >
            Retry auth check
          </button>
        </div>
      ) : null}
      {error ? <p style={{ margin: 0, color: "#fee2e2" }}>Session error: {error}</p> : null}
    </div>
  );
}
