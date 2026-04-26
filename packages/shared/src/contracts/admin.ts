import type { CapabilityKey, Persona } from "../capabilities";

export type MembershipStatus = "pending" | "active" | "suspended" | "removed";
export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";
export type JoinRequestStatus = "pending" | "approved" | "denied" | "cancelled";

export interface HouseholdMemberAdminRecord {
  userId: string;
  email: string | null;
  displayName: string;
  persona: Persona;
  householdId: string;
  householdName: string | null;
  membershipStatus: MembershipStatus;
  isPrimary: boolean;
  accountStatus: string;
  isSuperAdmin: boolean;
  grantedCapabilities: CapabilityKey[];
  deniedCapabilities: CapabilityKey[];
}

export interface HouseholdInvitationRecord {
  householdInvitationId: string;
  householdId: string;
  invitedEmail: string;
  invitedPersona: Persona;
  invitedByUserId: string;
  status: InvitationStatus;
  expiresAt: string;
  acceptedByUserId: string | null;
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
  inviteLinkPreview?: string | null;
  deliveryProvider?: "sendgrid" | "development_log" | null;
  deliveryState?: "sent" | "logged" | "failed" | null;
  deliveryMessage?: string | null;
}

export interface HouseholdJoinRequestRecord {
  householdJoinRequestId: string;
  householdId: string | null;
  requestingUserId: string;
  requestingUserEmail: string | null;
  requestingDisplayName: string;
  requestedPersona: Persona;
  requestedParentEmail: string | null;
  requestMessage: string | null;
  status: JoinRequestStatus;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HouseholdAdminOverview {
  householdId: string | null;
  householdName: string | null;
  canManageHousehold: boolean;
  canManagePermissions: boolean;
  members: HouseholdMemberAdminRecord[];
  invitations: HouseholdInvitationRecord[];
  joinRequests: HouseholdJoinRequestRecord[];
}

export interface SuperAdminDirectoryMembershipRecord {
  householdId: string;
  householdName: string | null;
  roleInHousehold: string;
  membershipStatus: MembershipStatus;
  isPrimary: boolean;
}

export interface SuperAdminDirectoryUserRecord {
  userId: string;
  email: string | null;
  displayName: string;
  roleType: Persona;
  accountStatus: string;
  isSuperAdmin: boolean;
  createdAt: string;
  updatedAt: string;
  memberships: SuperAdminDirectoryMembershipRecord[];
}

export interface SignupDecision {
  state:
    | "ready"
    | "needs_parent_household"
    | "needs_household_request"
    | "pending_invitation_acceptance"
    | "pending_join_request"
    | "admin_ready";
  role: Persona;
  householdId: string | null;
  householdName: string | null;
  invitationPreview?: {
    invitedPersona: Persona;
    householdName: string | null;
    inviterName: string | null;
    expiresAt: string;
  } | null;
  pendingJoinRequest?: {
    requestedParentEmail: string | null;
    status: JoinRequestStatus;
  } | null;
}
