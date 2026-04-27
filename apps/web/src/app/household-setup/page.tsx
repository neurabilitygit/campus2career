"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Persona } from "../../../../../packages/shared/src/capabilities";
import type {
  HouseholdAdminOverview,
  HouseholdInvitationRecord,
  HouseholdJoinRequestRecord,
  HouseholdMemberAdminRecord,
  SignupDecision,
} from "../../../../../packages/shared/src/contracts/admin";
import { AppShell } from "../../components/layout/AppShell";
import { RequireRole } from "../../components/RequireRole";
import { SectionCard } from "../../components/layout/SectionCard";
import { useApiData } from "../../hooks/useApiData";
import { apiFetch } from "../../lib/apiClient";

type AdminOverviewResponse = {
  ok: boolean;
  overview: HouseholdAdminOverview;
};

type SignupDecisionResponse = {
  ok: boolean;
  decision: SignupDecision;
};

function cardStyle(borderColor: string): React.CSSProperties {
  return {
    display: "grid",
    gap: 14,
    padding: "18px 16px",
    borderRadius: 18,
    border: `1px solid ${borderColor}`,
    background: "#fff",
  };
}

function metricStyle(): React.CSSProperties {
  return {
    display: "grid",
    gap: 4,
    padding: "14px 16px",
    borderRadius: 16,
    border: "1px solid #dbe4f0",
    background: "#f8fafc",
  };
}

function memberSummary(member: HouseholdMemberAdminRecord) {
  return `${member.persona} · ${member.membershipStatus}${member.isPrimary ? " · primary" : ""}`;
}

function invitationSummary(invitation: HouseholdInvitationRecord) {
  return `${invitation.invitedPersona} invitation · ${invitation.status}`;
}

function requestSummary(request: HouseholdJoinRequestRecord) {
  return `${request.requestedPersona} request · ${request.status}`;
}

function HouseholdSetupWorkspace() {
  const decision = useApiData<SignupDecisionResponse>("/auth/signup/decision", true);
  const overview = useApiData<AdminOverviewResponse>("/households/me/admin", true);
  const [householdName, setHouseholdName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePersona, setInvitePersona] = useState<"student" | "coach">("student");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const resolvedDecision = decision.data?.decision || null;
  const resolvedOverview = overview.data?.overview || null;

  const pendingInvitations = useMemo(
    () => (resolvedOverview?.invitations || []).filter((invitation) => invitation.status === "pending"),
    [resolvedOverview?.invitations]
  );
  const pendingJoinRequests = useMemo(
    () => (resolvedOverview?.joinRequests || []).filter((request) => request.status === "pending"),
    [resolvedOverview?.joinRequests]
  );

  async function createHousehold() {
    setStatus("");
    setError("");
    try {
      await apiFetch("/auth/signup/create-household", {
        method: "POST",
        body: JSON.stringify({ persona: "parent", householdName }),
      });
      setStatus("Household created.");
      await Promise.all([decision.refresh(), overview.refresh()]);
      setHouseholdName("");
    } catch (saveError: any) {
      setError(saveError?.message || "Could not create the household.");
    }
  }

  async function sendInvite() {
    setStatus("");
    setError("");
    try {
      const response = await apiFetch("/households/me/invitations", {
        method: "POST",
        body: JSON.stringify({ invitedEmail: inviteEmail, invitedPersona: invitePersona }),
      });
      const deliveryMessage =
        response?.invitation?.deliveryMessage ||
        (response?.invitation?.inviteLinkPreview
          ? `Invitation created. Development link: ${response.invitation.inviteLinkPreview}`
          : "Invitation created.");
      setStatus(deliveryMessage);
      setInviteEmail("");
      await overview.refresh();
    } catch (saveError: any) {
      setError(saveError?.message || "Could not create the invitation.");
    }
  }

  async function reviewJoinRequest(householdJoinRequestId: string, action: "approve" | "deny") {
    setStatus("");
    setError("");
    try {
      await apiFetch(`/households/me/join-requests/${action}`, {
        method: "POST",
        body: JSON.stringify({ householdJoinRequestId }),
      });
      setStatus(action === "approve" ? "Join request approved." : "Join request denied.");
      await overview.refresh();
    } catch (saveError: any) {
      setError(saveError?.message || `Could not ${action} the request.`);
    }
  }

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1120 }}>
      <SectionCard
        title="How account linking works"
        subtitle="Rising Senior runs on a household model that centers on a student and scopes parent, coach, and admin access appropriately."
      >
        <div style={{ display: "grid", gap: 14 }}>
          <p style={{ margin: 0, color: "#475569", lineHeight: 1.7 }}>
            A household usually centers on one student. That household can also include a parent or guardian and,
            when coaching support is part of the experience, an optional coach relationship that stays scoped to the
            student.
          </p>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <div style={metricStyle()}>
              <span style={{ color: "#52657d", fontSize: 13, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Household
              </span>
              <strong>{resolvedOverview?.householdName || resolvedDecision?.householdName || "Not created yet"}</strong>
            </div>
            <div style={metricStyle()}>
              <span style={{ color: "#52657d", fontSize: 13, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Members
              </span>
              <strong>{resolvedOverview?.members.length || 0}</strong>
            </div>
            <div style={metricStyle()}>
              <span style={{ color: "#52657d", fontSize: 13, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Pending invites
              </span>
              <strong>{pendingInvitations.length}</strong>
            </div>
            <div style={metricStyle()}>
              <span style={{ color: "#52657d", fontSize: 13, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Join requests
              </span>
              <strong>{pendingJoinRequests.length}</strong>
            </div>
          </div>
          <div className="ui-soft-panel">
            <strong>What is true today</strong>
            <ul style={{ marginBottom: 0 }}>
              <li>Parents can create a household and manage invitations, join requests, and household permissions.</li>
              <li>Students and coaches can join the right household through an invitation or an approved access request.</li>
              <li>Accounts already resolve into a role-aware workspace after sign-in, and the system protects what each role can and cannot see.</li>
              <li>Student, parent, and coach views all depend on this underlying household and relationship model.</li>
            </ul>
          </div>
        </div>
      </SectionCard>

      {decision.loading || overview.loading ? <p style={{ margin: 0 }}>Loading household setup...</p> : null}
      {overview.error ? (
        <p style={{ margin: 0, color: "crimson" }}>
          We could not finish loading household setup yet. Refresh after the API is available and your session is active.
        </p>
      ) : null}
      {status ? <p style={{ margin: 0, color: "#0f766e" }}>{status}</p> : null}
      {error ? <p style={{ margin: 0, color: "crimson" }}>{error}</p> : null}

      {resolvedDecision?.state === "needs_parent_household" ? (
        <SectionCard
          title="Create the household"
          subtitle="Start by creating the parent-run household that will anchor student access, optional coach support, and downstream permissions."
        >
          <div style={{ display: "grid", gap: 12, maxWidth: 520 }}>
            <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
              Household name
              <input
                value={householdName}
                onChange={(event) => setHouseholdName(event.target.value)}
                style={{ borderRadius: 12, border: "1px solid #d0d8e8", padding: "12px 14px" }}
                placeholder="Rivera household"
              />
            </label>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button type="button" className="ui-button ui-button--primary" onClick={createHousehold}>
                Create household
              </button>
              <Link href="/help" className="ui-button ui-button--secondary">
                Open Help
              </Link>
            </div>
          </div>
        </SectionCard>
      ) : null}

      {resolvedOverview?.canManageHousehold && resolvedOverview.householdId ? (
        <>
          <SectionCard
            title="Invite the right accounts"
            subtitle="Invite the student first, then add a coach when that support relationship is part of the experience."
          >
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "minmax(260px, 2fr) minmax(180px, 1fr) auto" }}>
              <input
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="student.or.coach@example.com"
                style={{ borderRadius: 12, border: "1px solid #d0d8e8", padding: "12px 14px" }}
              />
              <select
                value={invitePersona}
                onChange={(event) => setInvitePersona(event.target.value as "student" | "coach")}
                style={{ borderRadius: 12, border: "1px solid #d0d8e8", padding: "12px 14px" }}
              >
                <option value="student">Student</option>
                <option value="coach">Coach</option>
              </select>
              <button type="button" className="ui-button ui-button--primary" onClick={sendInvite}>
                Send invite
              </button>
            </div>
          </SectionCard>

          <SectionCard
            title="Current household wiring"
            subtitle="This is the live relationship map the dashboards and permissions already use today."
          >
            <div style={{ display: "grid", gap: 12 }}>
              {!resolvedOverview.members.length ? (
                <p style={{ margin: 0, color: "#52657d" }}>
                  No members are attached yet. Create the household first, then invite the student and optional coach.
                </p>
              ) : (
                resolvedOverview.members.map((member) => (
                  <div key={member.userId} style={cardStyle("rgba(13, 111, 184, 0.14)")}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <strong>{member.displayName}</strong>
                      <span style={{ color: "#52657d" }}>{member.email || "No email on file"}</span>
                      <span style={{ color: "#52657d", textTransform: "capitalize" }}>{memberSummary(member)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="Pending invitations"
            subtitle="Track who has been invited, what role they were invited into, and whether the link is still waiting to be accepted."
          >
            <div style={{ display: "grid", gap: 12 }}>
              {!pendingInvitations.length ? (
                <p style={{ margin: 0, color: "#52657d" }}>No invitations are waiting right now.</p>
              ) : (
                pendingInvitations.map((invitation) => (
                  <div key={invitation.householdInvitationId} style={cardStyle("rgba(25, 140, 103, 0.16)")}>
                    <strong>{invitation.invitedEmail}</strong>
                    <span style={{ color: "#52657d", textTransform: "capitalize" }}>{invitationSummary(invitation)}</span>
                    <span style={{ color: "#52657d" }}>
                      Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="Pending access requests"
            subtitle="Students and coaches can request access when no invitation is in hand. Review those requests here before they affect household visibility."
          >
            <div style={{ display: "grid", gap: 12 }}>
              {!pendingJoinRequests.length ? (
                <p style={{ margin: 0, color: "#52657d" }}>No pending join requests.</p>
              ) : (
                pendingJoinRequests.map((request) => (
                  <div key={request.householdJoinRequestId} style={cardStyle("rgba(126, 87, 194, 0.16)")}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <strong>{request.requestingDisplayName}</strong>
                      <span style={{ color: "#52657d" }}>{request.requestingUserEmail || "Unknown email"}</span>
                      <span style={{ color: "#52657d", textTransform: "capitalize" }}>{requestSummary(request)}</span>
                      {request.requestMessage ? (
                        <span style={{ color: "#52657d", lineHeight: 1.6 }}>{request.requestMessage}</span>
                      ) : null}
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="ui-button ui-button--primary"
                        onClick={() => reviewJoinRequest(request.householdJoinRequestId, "approve")}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="ui-button ui-button--secondary"
                        onClick={() => reviewJoinRequest(request.householdJoinRequestId, "deny")}
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </SectionCard>
        </>
      ) : null}

      <SectionCard
        title="Where to go next"
        subtitle="Use the detailed administration workspace when you need persona assignment, invitation review, or feature-level permission changes."
      >
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/admin" className="ui-button ui-button--primary">
            Open household administration
          </Link>
          <Link href="/help" className="ui-button ui-button--secondary">
            Open Help
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}

export default function HouseholdSetupPage() {
  return (
    <AppShell
      title="Household setup"
      subtitle="See how Rising Senior connects student, parent, and coach accounts so permissions, dashboards, and invitations stay aligned."
    >
      <RequireRole expectedRoles={["parent", "admin"]} fallbackTitle="Parent or admin sign-in required">
        <HouseholdSetupWorkspace />
      </RequireRole>
    </AppShell>
  );
}
