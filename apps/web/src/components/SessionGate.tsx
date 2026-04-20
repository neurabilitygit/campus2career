"use client";

import { useEffect, useState } from "react";
import { useSession } from "../hooks/useSession";
import { AuthButtons } from "./AuthButtons";

export function SessionGate(props: {
  children: React.ReactNode;
  fallbackTitle?: string;
}) {
  const { loading, error, isAuthenticated, refresh } = useSession();
  const [showSlowNotice, setShowSlowNotice] = useState(false);

  useEffect(() => {
    if (!loading) {
      setShowSlowNotice(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShowSlowNotice(true);
    }, 3000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loading]);

  if (loading) {
    return (
      <div style={{ display: "grid", gap: 10 }}>
        <h2 style={{ marginBottom: 0 }}>{props.fallbackTitle || "Checking your session"}</h2>
        <p style={{ margin: 0, color: "#475569" }}>
          Confirming your sign-in state and preparing the right dashboard.
        </p>
        {showSlowNotice ? (
          <>
            <p style={{ margin: 0, color: "#92400e" }}>
              Session resolution is taking longer than expected. You can retry the check or sign in again.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => {
                  void refresh();
                }}
                style={{
                  width: "fit-content",
                  borderRadius: 999,
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  padding: "10px 14px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Retry session check
              </button>
            </div>
            <AuthButtons />
          </>
        ) : null}
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <h2>{props.fallbackTitle || "Sign in required"}</h2>
        <p>Please sign in with Google to continue.</p>
        {error ? <p style={{ color: "crimson", margin: 0 }}>Session error: {error}</p> : null}
        {error ? (
          <button
            type="button"
            onClick={() => {
              void refresh();
            }}
            style={{
              width: "fit-content",
              borderRadius: 999,
              border: "1px solid #cbd5e1",
              background: "#fff",
              padding: "10px 14px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Retry session check
          </button>
        ) : null}
        <AuthButtons />
      </div>
    );
  }

  return <>{props.children}</>;
}
