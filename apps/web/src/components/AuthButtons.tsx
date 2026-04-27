"use client";

import { useEffect, useState } from "react";
import { getCurrentAppRoute, redirectToAuth } from "../lib/authFlow";
import { clearStoredDemoAuth } from "../lib/demoAuth";
import { clearSessionState } from "../lib/sessionStore";
import { getSupabaseBrowserClient, getSupabaseConfigError } from "../lib/supabaseClient";
import { setStoredTestContextRole, setStoredTestContextStudentProfileId } from "../lib/testContext";
import { useSession } from "../hooks/useSession";

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
    isAuthenticated ||
    actionBusy !== null ||
    (loading && !sessionAppearsStalled);
  const signOutDisabled =
    !isAuthenticated ||
    actionBusy !== null;

  async function signInWithGoogle() {
    setActionBusy("sign_in");
    try {
      redirectToAuth({ returnTo: getCurrentAppRoute() });
    } finally {
      setActionBusy(null);
    }
  }

  async function signOut() {
    setActionBusy("sign_out");
    try {
      clearStoredDemoAuth();
      if (supabase) {
        await supabase.auth.signOut({ scope: "global" });
      }
      clearSessionState();
      setStoredTestContextRole(null);
      setStoredTestContextStudentProfileId(null);
      redirectToAuth({ returnTo: getCurrentAppRoute(), signedOut: true, replace: true });
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
          className={`ui-button ${signInDisabled ? "ui-button--secondary ui-button--disabled" : "ui-button--primary"}`}
        >
          {actionBusy === "sign_in"
            ? "Opening sign-in..."
            : loading && !sessionAppearsStalled
              ? "Checking session..."
              : "Open sign-in"}
        </button>
        <button
          onClick={signOut}
          disabled={signOutDisabled}
          className={`ui-button ${signOutDisabled ? "ui-button--secondary ui-button--disabled" : "ui-button--secondary"}`}
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
