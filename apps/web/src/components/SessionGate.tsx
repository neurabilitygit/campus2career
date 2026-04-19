"use client";

import { useSession } from "../hooks/useSession";
import { AuthButtons } from "./AuthButtons";

export function SessionGate(props: {
  children: React.ReactNode;
  fallbackTitle?: string;
}) {
  const { loading, error, isAuthenticated } = useSession();

  if (loading) {
    return <p>Loading session...</p>;
  }

  if (!isAuthenticated) {
    return (
      <div>
        <h2>{props.fallbackTitle || "Sign in required"}</h2>
        <p>Please sign in with Google to continue.</p>
        {error ? <p style={{ color: "crimson" }}>Session error: {error}</p> : null}
        <AuthButtons />
      </div>
    );
  }

  return <>{props.children}</>;
}
