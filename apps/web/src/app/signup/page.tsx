"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Persona } from "../../../../../packages/shared/src/capabilities";
import type { SignupDecision } from "../../../../../packages/shared/src/contracts/admin";
import { AppShell } from "../../components/layout/AppShell";
import { SessionGate } from "../../components/SessionGate";
import { useApiData } from "../../hooks/useApiData";
import { useAuthContext } from "../../hooks/useAuthContext";
import { useSession } from "../../hooks/useSession";
import { apiFetch } from "../../lib/apiClient";
import { AuthButtons } from "../../components/AuthButtons";
import { getStoredTestContextRole } from "../../lib/testContext";

const RETURNING_SUPERUSER_EMAIL = "eric.bassman@gmail.com";

function normalize(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function isReturningSuperUserIdentity(input: {
  email?: string | null;
  preferredName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}) {
  if (normalize(input.email) === RETURNING_SUPERUSER_EMAIL) {
    return true;
  }

  const fullName = `${input.firstName || ""} ${input.lastName || ""}`.trim().toLowerCase();
  if (fullName === "eric bass") {
    return true;
  }

  return normalize(input.preferredName) === "eric";
}

type SignupDecisionResponse = {
  ok: boolean;
  decision: SignupDecision;
};

function cardStyle(accent: string): React.CSSProperties {
  return {
    display: "grid",
    gap: 14,
    padding: "22px 20px",
    borderRadius: 24,
    background: "#fff",
    border: `1px solid ${accent}`,
    boxShadow: "0 18px 36px rgba(15, 23, 42, 0.06)",
  };
}

function SignupWorkspace() {
  const router = useRouter();
  const auth = useAuthContext();
  const session = useSession();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const decision = useApiData<SignupDecisionResponse>(
    `/auth/signup/decision${inviteToken ? `?inviteToken=${encodeURIComponent(inviteToken)}` : ""}`,
    auth.isAuthenticated
  );
  const [selectedPersona, setSelectedPersona] = useState<Persona>("student");
  const [householdName, setHouseholdName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const resolvedDecision = decision.data?.decision;

  const isReturningSuperUser =
    auth.isAuthenticated &&
    isReturningSuperUserIdentity({
      email: auth.data?.context?.email || session.session?.user?.email || null,
      preferredName:
        auth.data?.context?.authenticatedPreferredName ||
        (typeof session.session?.user?.user_metadata?.preferred_name === "string"
          ? session.session.user.user_metadata.preferred_name
          : null),
      firstName:
        auth.data?.context?.authenticatedFirstName ||
        (typeof session.session?.user?.user_metadata?.given_name === "string"
          ? session.session.user.user_metadata.given_name
          : null),
      lastName:
        auth.data?.context?.authenticatedLastName ||
        (typeof session.session?.user?.user_metadata?.family_name === "string"
          ? session.session.user.user_metadata.family_name
          : null),
    });

  const superUserWorkspaceHref = useMemo(() => {
    const previewRole = auth.data?.context?.testContextOverrideRole || getStoredTestContextRole();
    if (previewRole === "parent") return "/parent";
    if (previewRole === "coach") return "/coach";
    if (previewRole === "student") return "/student";
    return "/admin";
  }, [auth.data?.context?.testContextOverrideRole]);

  useEffect(() => {
    const resolvedRole = resolvedDecision?.role ?? auth.data?.context?.authenticatedRoleType;
    if (!resolvedRole) {
      return;
    }
    setSelectedPersona(resolvedRole === "admin" ? "parent" : resolvedRole);
  }, [resolvedDecision?.role, auth.data?.context?.authenticatedRoleType]);

  useEffect(() => {
    if (!isReturningSuperUser) {
      return;
    }
    router.replace(superUserWorkspaceHref);
  }, [isReturningSuperUser, router, superUserWorkspaceHref]);

  const readyHref = useMemo(() => {
    const role = auth.data?.context?.authenticatedRoleType;
    if (role === "parent") return "/parent";
    if (role === "coach") return "/coach";
    if (role === "admin") return "/admin";
    return "/student";
  }, [auth.data?.context?.authenticatedRoleType]);

  if (isReturningSuperUser) {
    return (
      <div style={{ display: "grid", gap: 12, maxWidth: 720 }}>
        <section style={cardStyle("rgba(25, 140, 103, 0.18)")}>
          <h2 style={{ margin: 0 }}>Opening your workspace</h2>
          <p style={{ margin: 0, color: "#52657d", lineHeight: 1.6 }}>
            Returning superuser access bypasses household setup and opens the correct workspace directly.
          </p>
        </section>
      </div>
    );
  }

  async function createHousehold() {
    setStatus("");
    setError("");
    try {
      await apiFetch("/auth/signup/create-household", {
        method: "POST",
        body: JSON.stringify({ persona: "parent", householdName }),
      });
      window.location.href = "/admin";
    } catch (saveError: any) {
      setError(saveError?.message || "Could not create the household.");
    }
  }

  async function requestAccess() {
    setStatus("");
    setError("");
    try {
      await apiFetch("/auth/signup/request-household-access", {
        method: "POST",
        body: JSON.stringify({
          requestedPersona: selectedPersona === "coach" ? "coach" : "student",
          parentEmail,
          requestMessage: requestMessage || null,
        }),
      });
      setStatus("Household access request submitted.");
    } catch (saveError: any) {
      setError(saveError?.message || "Could not submit the request.");
    }
  }

  async function acceptInvitation() {
    if (!inviteToken) return;
    setStatus("");
    setError("");
    try {
      await apiFetch("/auth/invitations/accept", {
        method: "POST",
        body: JSON.stringify({ token: inviteToken }),
      });
      window.location.href = readyHref;
    } catch (saveError: any) {
      setError(saveError?.message || "Could not accept the invitation.");
    }
  }

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 880 }}>
      <section style={cardStyle("rgba(13, 111, 184, 0.18)")}>
        <div style={{ display: "grid", gap: 8 }}>
          <div className="ui-pill">Account setup</div>
          <h2 style={{ margin: 0 }}>Create the right household and role wiring</h2>
          <p style={{ margin: 0, color: "#52657d", lineHeight: 1.6 }}>
            Parents create households. Students and coaches join by invitation or request access to an existing parent-run household.
          </p>
        </div>
      </section>

      {decision.loading ? <p style={{ margin: 0 }}>Loading your signup path...</p> : null}
      {decision.error ? (
        <p style={{ margin: 0, color: "crimson" }}>
          We could not auto-detect the exact signup path, so you can choose it manually below. Your account can still continue
          with the right setup options on this page.
        </p>
      ) : null}

      {resolvedDecision?.state === "ready" || resolvedDecision?.state === "admin_ready" ? (
        <section style={cardStyle("rgba(25, 140, 103, 0.18)")}>
          <h3 style={{ margin: 0 }}>Your account is ready</h3>
          <p style={{ margin: 0, color: "#52657d", lineHeight: 1.6 }}>
            This account is already wired into the correct workspace and permission model.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href={readyHref} className="ui-button ui-button--primary">
              Open my workspace
            </Link>
            <Link href="/admin" className="ui-button ui-button--secondary">
              Open administration
            </Link>
          </div>
        </section>
      ) : null}

      {resolvedDecision?.state === "pending_invitation_acceptance" ? (
        <section style={cardStyle("rgba(126, 87, 194, 0.18)")}>
          <h3 style={{ margin: 0 }}>Invitation found</h3>
          <p style={{ margin: 0, color: "#52657d", lineHeight: 1.6 }}>
            This link will add you to <strong>{resolvedDecision.householdName || "the household"}</strong> as a{" "}
            <strong style={{ textTransform: "capitalize" }}>{resolvedDecision.invitationPreview?.invitedPersona}</strong>.
          </p>
          <button type="button" className="ui-button ui-button--primary" onClick={acceptInvitation}>
            Accept invitation
          </button>
        </section>
      ) : null}

      {(resolvedDecision?.state === "needs_parent_household" || selectedPersona === "parent") ? (
        <section style={cardStyle("rgba(245, 158, 11, 0.18)")}>
          <h3 style={{ margin: 0 }}>Parent first-subscriber flow</h3>
          <p style={{ margin: 0, color: "#52657d", lineHeight: 1.6 }}>
            Create the household first, then invite the student and optional coach.
          </p>
          <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
            Household name
            <input
              value={householdName}
              onChange={(event) => setHouseholdName(event.target.value)}
              style={{ borderRadius: 12, border: "1px solid #d0d8e8", padding: "12px 14px" }}
              placeholder="Rivera household"
            />
          </label>
          <button type="button" className="ui-button ui-button--primary" onClick={createHousehold}>
            Create household
          </button>
        </section>
      ) : null}

      {(resolvedDecision?.state === "needs_household_request" || selectedPersona !== "parent") ? (
        <section style={cardStyle("rgba(15, 23, 42, 0.12)")}>
          <h3 style={{ margin: 0 }}>Student or coach access request</h3>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              className={`ui-button ${selectedPersona === "student" ? "ui-button--primary" : "ui-button--secondary"}`}
              onClick={() => setSelectedPersona("student")}
            >
              Student
            </button>
            <button
              type="button"
              className={`ui-button ${selectedPersona === "coach" ? "ui-button--primary" : "ui-button--secondary"}`}
              onClick={() => setSelectedPersona("coach")}
            >
              Coach
            </button>
            <button
              type="button"
              className={`ui-button ${selectedPersona === "parent" ? "ui-button--primary" : "ui-button--secondary"}`}
              onClick={() => setSelectedPersona("parent")}
            >
              Parent
            </button>
          </div>
          {selectedPersona !== "parent" ? (
            <>
              <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
                Parent email
                <input
                  value={parentEmail}
                  onChange={(event) => setParentEmail(event.target.value)}
                  style={{ borderRadius: 12, border: "1px solid #d0d8e8", padding: "12px 14px" }}
                  placeholder="parent@example.com"
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
                Optional note
                <textarea
                  value={requestMessage}
                  onChange={(event) => setRequestMessage(event.target.value)}
                  rows={3}
                  style={{ borderRadius: 12, border: "1px solid #d0d8e8", padding: "12px 14px", fontFamily: "inherit" }}
                  placeholder="I’m the invited student for this household."
                />
              </label>
              <button type="button" className="ui-button ui-button--primary" onClick={requestAccess}>
                Request household access
              </button>
            </>
          ) : (
            <p style={{ margin: 0, color: "#52657d", lineHeight: 1.6 }}>
              Parents create households directly. Switch to the parent option above and create the household first.
            </p>
          )}
        </section>
      ) : null}

      {resolvedDecision?.state === "pending_join_request" ? (
        <section style={cardStyle("rgba(59, 130, 246, 0.18)")}>
          <h3 style={{ margin: 0 }}>Request pending</h3>
          <p style={{ margin: 0, color: "#52657d", lineHeight: 1.6 }}>
            Your household access request is waiting for review by the household administrator.
          </p>
        </section>
      ) : null}

      {status ? <p style={{ margin: 0, color: "#0f766e" }}>{status}</p> : null}
      {error ? <p style={{ margin: 0, color: "crimson" }}>{error}</p> : null}
    </div>
  );
}

export default function SignupPage() {
  const auth = useAuthContext();

  return (
    <AppShell
      title="Signup and household setup"
      subtitle="Choose the correct household and role path so permissions, dashboards, and invitations line up with the real relationship."
    >
      {auth.isAuthenticated ? (
        <SessionGate fallbackTitle="Sign in to continue setup">
          <SignupWorkspace />
        </SessionGate>
      ) : (
        <div style={{ display: "grid", gap: 18, maxWidth: 780 }}>
          <section style={cardStyle("rgba(13, 111, 184, 0.18)")}>
            <h2 style={{ margin: 0 }}>Create your account</h2>
            <p style={{ margin: 0, color: "#52657d", lineHeight: 1.6 }}>
              Google sign-in works today. Apple sign-in and email/password are stubbed here so the future auth model is visible without pretending those flows are live yet.
            </p>
            <AuthButtons />
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button type="button" className="ui-button ui-button--secondary ui-button--disabled" disabled>
                Apple sign-in (coming later)
              </button>
              <button type="button" className="ui-button ui-button--secondary ui-button--disabled" disabled>
                Email & password (coming later)
              </button>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
