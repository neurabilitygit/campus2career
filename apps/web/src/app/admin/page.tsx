"use client";

import { useMemo, useState } from "react";
import type { CapabilityKey, CapabilityDefinition, Persona } from "../../../../../packages/shared/src/capabilities";
import type {
  HouseholdAdminOverview,
  HouseholdMemberAdminRecord,
  SuperAdminDirectoryUserRecord,
} from "../../../../../packages/shared/src/contracts/admin";
import { AppShell } from "../../components/layout/AppShell";
import { RequireRole } from "../../components/RequireRole";
import { useApiData } from "../../hooks/useApiData";
import { apiFetch } from "../../lib/apiClient";

type AdminOverviewResponse = {
  ok: boolean;
  overview: HouseholdAdminOverview;
  editableCapabilitiesByPersona: Record<Persona, CapabilityDefinition[]>;
};

type SuperAdminDirectoryResponse = {
  ok: boolean;
  users: SuperAdminDirectoryUserRecord[];
};

function checkboxListValue(source: CapabilityKey[], target: CapabilityKey) {
  return source.includes(target);
}

function MemberPermissionsCard(props: {
  member: HouseholdMemberAdminRecord;
  capabilityDefs: CapabilityDefinition[];
  canAssignAdmin: boolean;
  onSave: (input: {
    userId: string;
    persona: Persona;
    grants: CapabilityKey[];
    denies: CapabilityKey[];
  }) => Promise<void>;
}) {
  const [selectedPersona, setSelectedPersona] = useState<Persona>(props.member.persona);
  const [grants, setGrants] = useState<CapabilityKey[]>(props.member.grantedCapabilities);
  const [denies, setDenies] = useState<CapabilityKey[]>(props.member.deniedCapabilities);

  return (
    <div style={{ display: "grid", gap: 10, padding: 16, border: "1px solid #dbe4f0", borderRadius: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <strong>{props.member.displayName}</strong>
          <span style={{ color: "#52657d" }}>{props.member.email}</span>
          <span style={{ color: "#52657d" }}>
            {props.member.membershipStatus} · current persona {props.member.persona}
          </span>
        </div>
        <select
          value={selectedPersona}
          onChange={(event) => setSelectedPersona(event.target.value as Persona)}
          style={{ borderRadius: 12, border: "1px solid #d0d8e8", padding: "10px 12px", minWidth: 180 }}
        >
          <option value="student">Student</option>
          <option value="parent">Parent</option>
          <option value="coach">Coach</option>
          {props.canAssignAdmin ? <option value="admin">Admin</option> : null}
        </select>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {props.capabilityDefs.map((capability) => {
          const granted = checkboxListValue(grants, capability.key);
          const denied = checkboxListValue(denies, capability.key);
          return (
            <div key={capability.key} style={{ display: "grid", gap: 6, padding: 12, borderRadius: 12, background: "#f8fafc" }}>
              <strong>{capability.label}</strong>
              <span style={{ color: "#52657d", lineHeight: 1.5 }}>{capability.description}</span>
              {!!capability.dependencies.length ? (
                <span style={{ color: "#92400e", fontSize: 13 }}>
                  Depends on: {capability.dependencies.join(", ")}
                </span>
              ) : null}
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={granted}
                    onChange={() =>
                      setGrants((current) =>
                        granted ? current.filter((item) => item !== capability.key) : [...current, capability.key]
                      )
                    }
                  />
                  Grant
                </label>
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={denied}
                    onChange={() =>
                      setDenies((current) =>
                        denied ? current.filter((item) => item !== capability.key) : [...current, capability.key]
                      )
                    }
                  />
                  Deny
                </label>
              </div>
            </div>
          );
        })}
      </div>
      <div>
        <button
          type="button"
          className="ui-button ui-button--primary"
          onClick={() => props.onSave({ userId: props.member.userId, persona: selectedPersona, grants, denies })}
        >
          Save permissions
        </button>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const auth = useApiData<{ context?: { isSuperAdmin?: boolean } }>("/auth/me", true);
  const overview = useApiData<AdminOverviewResponse>("/households/me/admin", true);
  const directory = useApiData<SuperAdminDirectoryResponse>(
    "/admin/users",
    !!auth.data?.context?.isSuperAdmin
  );
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePersona, setInvitePersona] = useState<"student" | "coach">("student");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const editableCatalog = useMemo(
    () => overview.data?.editableCapabilitiesByPersona || null,
    [overview.data?.editableCapabilitiesByPersona]
  );

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
      await overview.refresh();
      setInviteEmail("");
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
      await overview.refresh();
    } catch (saveError: any) {
      setError(saveError?.message || `Could not ${action} the request.`);
    }
  }

  async function savePermissions(input: {
    userId: string;
    persona: Persona;
    grants: CapabilityKey[];
    denies: CapabilityKey[];
  }) {
    setStatus("");
    setError("");
    try {
      await apiFetch("/households/me/permissions", {
        method: "POST",
        body: JSON.stringify(input),
      });
      setStatus("Permissions updated.");
      await overview.refresh();
    } catch (saveError: any) {
      setError(saveError?.message || "Could not update permissions.");
    }
  }

  return (
    <AppShell
      title="Household administration"
      subtitle="Manage the household, invitations, join requests, personas, and feature-level permissions from one place."
    >
      <RequireRole expectedRoles={["parent", "admin"]} fallbackTitle="Parent or admin sign-in required">
        <div style={{ display: "grid", gap: 18, maxWidth: 1180 }}>
          {overview.loading ? <p style={{ margin: 0 }}>Loading administration...</p> : null}
          {overview.error ? (
            <p style={{ margin: 0, color: "crimson" }}>
              We could not finish loading household administration yet. Refresh after the API is available and your
              session is active.
            </p>
          ) : null}
          {status ? <p style={{ margin: 0, color: "#0f766e" }}>{status}</p> : null}
          {error ? <p style={{ margin: 0, color: "crimson" }}>{error}</p> : null}

          <section className="ui-section-card" style={{ display: "grid", gap: 12 }}>
            <h2 style={{ margin: 0 }}>
              {overview.data?.overview.householdName || "Household"} administration
            </h2>
            <p style={{ margin: 0, color: "#52657d", lineHeight: 1.6 }}>
              Parents create and manage households. Students and coaches join through invitations or approved access requests.
            </p>
          </section>

          <section className="ui-section-card" style={{ display: "grid", gap: 12 }}>
            <h3 style={{ margin: 0 }}>Invite a student or coach</h3>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "2fr 1fr auto" }}>
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
          </section>

          <section className="ui-section-card" style={{ display: "grid", gap: 12 }}>
            <h3 style={{ margin: 0 }}>Pending join requests</h3>
            {!overview.data?.overview.joinRequests.length ? (
              <p style={{ margin: 0, color: "#52657d" }}>No pending join requests.</p>
            ) : (
              overview.data?.overview.joinRequests.map((request) => (
                <div key={request.householdJoinRequestId} style={{ display: "grid", gap: 8, padding: 14, border: "1px solid #e2e8f0", borderRadius: 16 }}>
                  <strong>{request.requestingDisplayName}</strong>
                  <span style={{ color: "#52657d" }}>
                    {request.requestingUserEmail || "Unknown email"} wants to join as a {request.requestedPersona}.
                  </span>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button type="button" className="ui-button ui-button--primary" onClick={() => reviewJoinRequest(request.householdJoinRequestId, "approve")}>
                      Approve
                    </button>
                    <button type="button" className="ui-button ui-button--secondary" onClick={() => reviewJoinRequest(request.householdJoinRequestId, "deny")}>
                      Deny
                    </button>
                  </div>
                </div>
              ))
            )}
          </section>

          <section className="ui-section-card" style={{ display: "grid", gap: 16 }}>
            <h3 style={{ margin: 0 }}>Members and permissions</h3>
            {overview.data?.overview.members.map((member) => {
              const capabilityDefs = editableCatalog?.[member.persona] || [];
              return (
                <MemberPermissionsCard
                  key={member.userId}
                  member={member}
                  capabilityDefs={capabilityDefs}
                  canAssignAdmin={!!auth.data?.context?.isSuperAdmin}
                  onSave={savePermissions}
                />
              );
            })}
          </section>

          {auth.data?.context?.isSuperAdmin ? (
            <section className="ui-section-card" style={{ display: "grid", gap: 16 }}>
              <h3 style={{ margin: 0 }}>Super-admin user directory</h3>
              <p style={{ margin: 0, color: "#52657d", lineHeight: 1.6 }}>
                Read-only cross-household visibility for platform administration. Use this to confirm account status, household attachments, and super-admin coverage without switching households.
              </p>
              {directory.loading ? <p style={{ margin: 0 }}>Loading directory...</p> : null}
              {directory.error ? (
                <p style={{ margin: 0, color: "crimson" }}>
                  We could not finish loading the super-admin directory yet. Refresh after the API is available and
                  your session is active.
                </p>
              ) : null}
              {(directory.data?.users || []).map((user) => (
                <div
                  key={user.userId}
                  style={{ display: "grid", gap: 8, padding: 14, border: "1px solid #e2e8f0", borderRadius: 16 }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <strong>{user.displayName}</strong>
                      <span style={{ color: "#52657d" }}>{user.email || "No email on file"}</span>
                    </div>
                    <div style={{ display: "grid", gap: 4, textAlign: "right" }}>
                      <span style={{ color: "#173d6b", fontWeight: 700, textTransform: "capitalize" }}>{user.roleType}</span>
                      <span style={{ color: "#52657d" }}>{user.accountStatus}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", color: "#52657d", fontSize: 14 }}>
                    <span>{user.isSuperAdmin ? "Super admin" : "Standard user"}</span>
                    <span>Created {new Date(user.createdAt).toLocaleDateString()}</span>
                    <span>Updated {new Date(user.updatedAt).toLocaleDateString()}</span>
                  </div>
                  {!user.memberships.length ? (
                    <p style={{ margin: 0, color: "#52657d" }}>No household memberships on file.</p>
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      {user.memberships.map((membership) => (
                        <div key={`${user.userId}-${membership.householdId}-${membership.roleInHousehold}`} style={{ padding: 10, borderRadius: 12, background: "#f8fafc" }}>
                          <strong>{membership.householdName || "Unnamed household"}</strong>
                          <div style={{ color: "#52657d", marginTop: 4 }}>
                            {membership.roleInHousehold} · {membership.membershipStatus}
                            {membership.isPrimary ? " · primary" : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </section>
          ) : null}
        </div>
      </RequireRole>
    </AppShell>
  );
}
