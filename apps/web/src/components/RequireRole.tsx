"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SessionGate } from "./SessionGate";
import { useAuthContext } from "../hooks/useAuthContext";
import { capabilityForPath } from "../lib/pageCapabilities";
import {
  shouldRedirectWorkspaceRole,
  workspaceHrefForRole,
  workspaceLabelForRole,
} from "../lib/workspaceAccess";

export function RequireRole(props: {
  expectedRoles: string[];
  children: React.ReactNode;
  fallbackTitle?: string;
  requiredCapability?: string;
}) {
  return (
    <SessionGate fallbackTitle={props.fallbackTitle}>
      <RequireRoleInner expectedRoles={props.expectedRoles} requiredCapability={props.requiredCapability}>
        {props.children}
      </RequireRoleInner>
    </SessionGate>
  );
}

function RequireRoleInner(props: {
  expectedRoles: string[];
  children: React.ReactNode;
  requiredCapability?: string;
}) {
  const auth = useAuthContext();
  const pathname = usePathname();
  const router = useRouter();
  const role = auth.data?.context?.authenticatedRoleType;
  const effectiveCapabilities = auth.data?.context?.effectiveCapabilities || [];
  const requiredCapability = props.requiredCapability || capabilityForPath(pathname || "");
  const shouldRedirect = shouldRedirectWorkspaceRole({
    authenticatedRole: role || null,
    expectedRoles: props.expectedRoles,
  });
  const missingCapability = !!requiredCapability && !effectiveCapabilities.includes(requiredCapability as never);

  useEffect(() => {
    if (!shouldRedirect || !role) {
      return;
    }

    const destination = workspaceHrefForRole(role);
    if (!destination || destination === pathname) {
      return;
    }

    router.replace(destination);
  }, [pathname, role, router, shouldRedirect]);

  if (auth.sessionLoading || auth.loading) {
    return <p style={{ margin: 0, color: "#52657d" }}>Loading your account access...</p>;
  }
  if (auth.sessionError) {
    return <p style={{ color: "crimson", margin: 0 }}>{auth.sessionError}</p>;
  }
  if (auth.error) {
    return <p style={{ color: "crimson", margin: 0 }}>{auth.error}</p>;
  }

  if (!role) {
    return <p style={{ margin: 0, color: "#52657d" }}>We could not determine your account role yet.</p>;
  }

  if (missingCapability) {
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
        <h2 style={{ margin: 0 }}>This feature is not enabled for this account</h2>
        <p style={{ margin: 0, color: "#52657d", lineHeight: 1.6 }}>
          Your current workspace is signed in correctly, but this feature is hidden because the required permission is not enabled for your account or household.
        </p>
        <p style={{ margin: 0, color: "#52657d", lineHeight: 1.6 }}>
          If you expected access, contact the household administrator or a platform administrator.
        </p>
      </div>
    );
  }

  if (shouldRedirect) {
    const destination = workspaceHrefForRole(role);
    const destinationLabel = workspaceLabelForRole(role);
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
          This usually happens when a saved tab, direct URL, or preview context points at a different workspace than the role attached to the current session. You are being returned to the matching workspace automatically.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href={destination} className="ui-button ui-button--primary">
            Go to {destinationLabel}
          </Link>
        </div>
      </div>
    );
  }

  return <>{props.children}</>;
}
