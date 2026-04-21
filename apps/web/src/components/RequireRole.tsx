"use client";

import { SessionGate } from "./SessionGate";
import { useApiData } from "../hooks/useApiData";

export function RequireRole(props: {
  expectedRoles: string[];
  children: React.ReactNode;
  fallbackTitle?: string;
}) {
  return (
    <SessionGate fallbackTitle={props.fallbackTitle}>
      <RequireRoleInner expectedRoles={props.expectedRoles}>
        {props.children}
      </RequireRoleInner>
    </SessionGate>
  );
}

function RequireRoleInner(props: {
  expectedRoles: string[];
  children: React.ReactNode;
}) {
  const auth = useApiData("/auth/me");

  if (auth.loading) {
    return <p style={{ margin: 0, color: "#52657d" }}>Loading your account access...</p>;
  }
  if (auth.error) {
    return <p style={{ color: "crimson", margin: 0 }}>{auth.error}</p>;
  }

  const role = auth.data?.context?.authenticatedRoleType;
  if (!role) {
    return <p style={{ margin: 0, color: "#52657d" }}>We could not determine your account role yet.</p>;
  }

  if (!props.expectedRoles.includes(role)) {
    return (
      <div
        style={{
          display: "grid",
          gap: 10,
          padding: "22px 20px",
          borderRadius: 22,
          background: "rgba(255,255,255,0.82)",
          border: "1px solid rgba(223, 90, 73, 0.18)",
        }}
      >
        <h2 style={{ margin: 0 }}>This page is for a different account view</h2>
        <p style={{ margin: 0, lineHeight: 1.6 }}>
          You are currently signed in as <strong style={{ textTransform: "capitalize" }}>{role}</strong>.
        </p>
        <p style={{ margin: 0, color: "#52657d", lineHeight: 1.6 }}>
          Open the matching workspace from the main navigation, or switch your testing view if this account supports it.
        </p>
      </div>
    );
  }

  return <>{props.children}</>;
}
