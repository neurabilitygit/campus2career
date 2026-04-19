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

  if (auth.loading) return <p>Resolving role...</p>;
  if (auth.error) return <p style={{ color: "crimson" }}>{auth.error}</p>;

  const role = auth.data?.context?.authenticatedRoleType;
  if (!role) return <p>No authenticated role found.</p>;

  if (!props.expectedRoles.includes(role)) {
    return (
      <div>
        <h2>Wrong dashboard for this account</h2>
        <p>Signed-in role: <strong>{role}</strong></p>
        <p>Please open the dashboard that matches this role, or adjust household role configuration.</p>
      </div>
    );
  }

  return <>{props.children}</>;
}
