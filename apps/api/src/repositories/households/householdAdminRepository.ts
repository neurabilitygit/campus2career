import crypto from "node:crypto";
import type { CapabilityKey, Persona } from "../../../../../packages/shared/src/capabilities";
import type {
  HouseholdInvitationRecord,
  HouseholdJoinRequestRecord,
  HouseholdMemberAdminRecord,
  SuperAdminDirectoryMembershipRecord,
  SuperAdminDirectoryUserRecord,
} from "../../../../../packages/shared/src/contracts/admin";
import { executeQuery, query, type DbExecutor } from "../../db/client";

function newId() {
  return crypto.randomUUID();
}

function displayName(firstName?: string | null, lastName?: string | null, preferredName?: string | null) {
  const preferred = preferredName?.trim();
  if (preferred) {
    const last = lastName?.trim();
    return [preferred, last].filter(Boolean).join(" ").trim();
  }

  const parts = [firstName?.trim(), lastName?.trim()].filter(Boolean);
  return parts.join(" ").trim() || "Unknown user";
}

export interface HouseholdRecord {
  householdId: string;
  householdName: string | null;
  createdByParentUserId: string | null;
  primaryStudentUserId: string | null;
}

export interface UserRecord {
  userId: string;
  email: string | null;
  roleType: Persona;
  accountStatus: string;
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
  isSuperAdmin: boolean;
}

export interface InvitationPreviewRecord {
  householdInvitationId: string;
  householdId: string;
  householdName: string | null;
  invitedEmail: string;
  invitedPersona: Persona;
  invitedByUserId: string;
  inviterDisplayName: string | null;
  invitationTokenHash: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  expiresAt: string;
}

type SuperAdminDirectoryRow = {
  userId: string;
  email: string | null;
  roleType: Persona;
  accountStatus: string;
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
  isSuperAdmin: boolean;
  createdAt: string;
  updatedAt: string;
  membershipHouseholdId: string | null;
  membershipHouseholdName: string | null;
  membershipRoleInHousehold: string | null;
  membershipStatus: "pending" | "active" | "suspended" | "removed" | null;
  membershipIsPrimary: boolean | null;
};

export class HouseholdAdminRepository {
  async findHouseholdById(householdId: string, executor?: DbExecutor): Promise<HouseholdRecord | null> {
    const result = await executeQuery<HouseholdRecord>(
      executor,
      `
      select
        household_id as "householdId",
        household_name as "householdName",
        created_by_parent_user_id as "createdByParentUserId",
        primary_student_user_id as "primaryStudentUserId"
      from households
      where household_id = $1
      limit 1
      `,
      [householdId]
    );
    return result.rows[0] || null;
  }

  async listHouseholds(executor?: DbExecutor): Promise<HouseholdRecord[]> {
    const result = await executeQuery<HouseholdRecord>(
      executor,
      `
      select
        household_id as "householdId",
        household_name as "householdName",
        created_by_parent_user_id as "createdByParentUserId",
        primary_student_user_id as "primaryStudentUserId"
      from households
      order by updated_at desc, created_at desc
      `
    );
    return result.rows;
  }

  async listSuperAdminDirectoryUsers(executor?: DbExecutor): Promise<SuperAdminDirectoryUserRecord[]> {
    const result = await executeQuery<SuperAdminDirectoryRow>(
      executor,
      `
      select
        u.user_id as "userId",
        u.email,
        u.role_type as "roleType",
        u.account_status as "accountStatus",
        u.first_name as "firstName",
        u.last_name as "lastName",
        u.preferred_name as "preferredName",
        u.is_super_admin as "isSuperAdmin",
        u.created_at::text as "createdAt",
        u.updated_at::text as "updatedAt",
        uhr.household_id as "membershipHouseholdId",
        h.household_name as "membershipHouseholdName",
        uhr.role_in_household as "membershipRoleInHousehold",
        uhr.membership_status as "membershipStatus",
        uhr.is_primary as "membershipIsPrimary"
      from users u
      left join user_household_roles uhr on uhr.user_id = u.user_id
      left join households h on h.household_id = uhr.household_id
      order by
        case when u.is_super_admin then 0 else 1 end,
        lower(coalesce(u.email, '')),
        uhr.created_at asc nulls last
      `
    );

    const byUser = new Map<string, SuperAdminDirectoryUserRecord>();
    for (const row of result.rows) {
      const existing = byUser.get(row.userId);
      const base =
        existing ||
        {
          userId: row.userId,
          email: row.email,
          displayName: displayName(row.firstName, row.lastName, row.preferredName),
          roleType: row.roleType,
          accountStatus: row.accountStatus,
          isSuperAdmin: row.isSuperAdmin,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          memberships: [] as SuperAdminDirectoryMembershipRecord[],
        };

      if (row.membershipHouseholdId && row.membershipRoleInHousehold && row.membershipStatus) {
        base.memberships.push({
          householdId: row.membershipHouseholdId,
          householdName: row.membershipHouseholdName,
          roleInHousehold: row.membershipRoleInHousehold,
          membershipStatus: row.membershipStatus,
          isPrimary: !!row.membershipIsPrimary,
        });
      }

      byUser.set(row.userId, base);
    }

    return Array.from(byUser.values());
  }

  async findActiveHouseholdByParentEmail(email: string, executor?: DbExecutor): Promise<HouseholdRecord | null> {
    const result = await executeQuery<HouseholdRecord>(
      executor,
      `
      select
        h.household_id as "householdId",
        h.household_name as "householdName",
        h.created_by_parent_user_id as "createdByParentUserId",
        h.primary_student_user_id as "primaryStudentUserId"
      from households h
      join user_household_roles uhr on uhr.household_id = h.household_id
      join users u on u.user_id = uhr.user_id
      where lower(u.email) = lower($1)
        and uhr.role_in_household in ('parent','guardian')
        and uhr.membership_status = 'active'
      order by
        case when uhr.is_primary then 0 else 1 end,
        uhr.created_at asc
      limit 1
      `,
      [email]
    );
    return result.rows[0] || null;
  }

  async createHousehold(input: {
    householdId: string;
    householdName: string;
    createdByParentUserId: string;
  }, executor?: DbExecutor) {
    await executeQuery(
      executor,
      `
      insert into households (
        household_id,
        household_name,
        created_by_parent_user_id,
        created_at,
        updated_at
      ) values ($1,$2,$3,now(),now())
      `,
      [input.householdId, input.householdName, input.createdByParentUserId]
    );
  }

  async insertMembership(input: {
    membershipId?: string;
    householdId: string;
    userId: string;
    roleInHousehold: "student" | "parent" | "guardian" | "coach";
    isPrimary?: boolean;
    membershipStatus?: "pending" | "active" | "suspended" | "removed";
    invitedByUserId?: string | null;
    approvedByUserId?: string | null;
    approvedAt?: string | null;
  }, executor?: DbExecutor) {
    await executeQuery(
      executor,
      `
      insert into user_household_roles (
        user_household_role_id,
        household_id,
        user_id,
        role_in_household,
        is_primary,
        membership_status,
        invited_by_user_id,
        approved_by_user_id,
        approved_at,
        created_at,
        updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),now())
      on conflict (household_id, user_id, role_in_household) do update
      set
        is_primary = excluded.is_primary,
        membership_status = excluded.membership_status,
        invited_by_user_id = excluded.invited_by_user_id,
        approved_by_user_id = excluded.approved_by_user_id,
        approved_at = excluded.approved_at,
        updated_at = now()
      `,
      [
        input.membershipId || newId(),
        input.householdId,
        input.userId,
        input.roleInHousehold,
        input.isPrimary ?? false,
        input.membershipStatus ?? "active",
        input.invitedByUserId ?? null,
        input.approvedByUserId ?? null,
        input.approvedAt ?? null,
      ]
    );
  }

  async setUserAccountRole(userId: string, persona: Persona, executor?: DbExecutor) {
    await executeQuery(
      executor,
      `
      update users
      set
        role_type = $2,
        updated_at = now()
      where user_id = $1
      `,
      [userId, persona]
    );
  }

  async setUserAccountStatus(userId: string, status: string, executor?: DbExecutor) {
    await executeQuery(
      executor,
      `
      update users
      set
        account_status = $2,
        updated_at = now()
      where user_id = $1
      `,
      [userId, status]
    );
  }

  async getUserById(userId: string, executor?: DbExecutor): Promise<UserRecord | null> {
    const result = await executeQuery<UserRecord>(
      executor,
      `
      select
        user_id as "userId",
        email,
        role_type as "roleType",
        account_status as "accountStatus",
        first_name as "firstName",
        last_name as "lastName",
        preferred_name as "preferredName",
        is_super_admin as "isSuperAdmin"
      from users
      where user_id = $1
      limit 1
      `,
      [userId]
    );
    return result.rows[0] || null;
  }

  async listHouseholdMembers(householdId: string, executor?: DbExecutor): Promise<HouseholdMemberAdminRecord[]> {
    const result = await executeQuery<
      HouseholdMemberAdminRecord & {
        firstName: string | null;
        lastName: string | null;
        preferredName: string | null;
      }
    >(
      executor,
      `
      select
        u.user_id as "userId",
        u.email,
        u.role_type as "persona",
        uhr.household_id as "householdId",
        h.household_name as "householdName",
        uhr.membership_status as "membershipStatus",
        uhr.is_primary as "isPrimary",
        u.account_status as "accountStatus",
        u.is_super_admin as "isSuperAdmin",
        '{}'::text[] as "grantedCapabilities",
        '{}'::text[] as "deniedCapabilities",
        u.first_name as "firstName",
        u.last_name as "lastName",
        u.preferred_name as "preferredName"
      from user_household_roles uhr
      join users u on u.user_id = uhr.user_id
      join households h on h.household_id = uhr.household_id
      where uhr.household_id = $1
      order by
        case when uhr.membership_status = 'active' then 0 else 1 end,
        case when uhr.is_primary then 0 else 1 end,
        uhr.created_at asc
      `,
      [householdId]
    );

    return result.rows.map((row) => ({
      ...row,
      displayName: displayName(row.firstName, row.lastName, row.preferredName),
    }));
  }

  async createInvitation(input: {
    householdInvitationId: string;
    householdId: string;
    invitedEmail: string;
    invitedPersona: Persona;
    invitedByUserId: string;
    invitationTokenHash: string;
    expiresAt: string;
  }, executor?: DbExecutor) {
    await executeQuery(
      executor,
      `
      insert into household_invitations (
        household_invitation_id,
        household_id,
        invited_email,
        invited_persona,
        invited_by_user_id,
        invitation_token_hash,
        status,
        expires_at,
        created_at,
        updated_at
      ) values ($1,$2,$3,$4,$5,$6,'pending',$7::timestamptz,now(),now())
      `,
      [
        input.householdInvitationId,
        input.householdId,
        input.invitedEmail,
        input.invitedPersona,
        input.invitedByUserId,
        input.invitationTokenHash,
        input.expiresAt,
      ]
    );
  }

  async listInvitations(householdId: string, executor?: DbExecutor): Promise<HouseholdInvitationRecord[]> {
    const result = await executeQuery<
      HouseholdInvitationRecord & {
        inviteLinkPreview: string | null;
      }
    >(
      executor,
      `
      select
        household_invitation_id as "householdInvitationId",
        household_id as "householdId",
        invited_email as "invitedEmail",
        invited_persona as "invitedPersona",
        invited_by_user_id as "invitedByUserId",
        status,
        expires_at::text as "expiresAt",
        accepted_by_user_id as "acceptedByUserId",
        accepted_at::text as "acceptedAt",
        created_at::text as "createdAt",
        updated_at::text as "updatedAt",
        null::text as "inviteLinkPreview"
      from household_invitations
      where household_id = $1
      order by created_at desc
      `,
      [householdId]
    );
    return result.rows;
  }

  async getInvitationByTokenHash(tokenHash: string, executor?: DbExecutor): Promise<InvitationPreviewRecord | null> {
    const result = await executeQuery<InvitationPreviewRecord>(
      executor,
      `
      select
        i.household_invitation_id as "householdInvitationId",
        i.household_id as "householdId",
        h.household_name as "householdName",
        i.invited_email as "invitedEmail",
        i.invited_persona as "invitedPersona",
        i.invited_by_user_id as "invitedByUserId",
        concat_ws(' ', inviter.first_name, inviter.last_name) as "inviterDisplayName",
        i.invitation_token_hash as "invitationTokenHash",
        i.status,
        i.expires_at::text as "expiresAt"
      from household_invitations i
      join households h on h.household_id = i.household_id
      left join users inviter on inviter.user_id = i.invited_by_user_id
      where i.invitation_token_hash = $1
      limit 1
      `,
      [tokenHash]
    );
    return result.rows[0] || null;
  }

  async markInvitationAccepted(input: {
    householdInvitationId: string;
    acceptedByUserId: string;
  }, executor?: DbExecutor) {
    await executeQuery(
      executor,
      `
      update household_invitations
      set
        status = 'accepted',
        accepted_by_user_id = $2,
        accepted_at = now(),
        updated_at = now()
      where household_invitation_id = $1
      `,
      [input.householdInvitationId, input.acceptedByUserId]
    );
  }

  async createJoinRequest(input: {
    householdJoinRequestId: string;
    householdId?: string | null;
    requestingUserId: string;
    requestedPersona: Persona;
    requestedParentEmail?: string | null;
    requestMessage?: string | null;
  }, executor?: DbExecutor) {
    await executeQuery(
      executor,
      `
      insert into household_join_requests (
        household_join_request_id,
        household_id,
        requesting_user_id,
        requested_persona,
        requested_parent_email,
        request_message,
        status,
        created_at,
        updated_at
      ) values ($1,$2,$3,$4,$5,$6,'pending',now(),now())
      `,
      [
        input.householdJoinRequestId,
        input.householdId ?? null,
        input.requestingUserId,
        input.requestedPersona,
        input.requestedParentEmail ?? null,
        input.requestMessage ?? null,
      ]
    );
  }

  async listJoinRequests(householdId: string, executor?: DbExecutor): Promise<HouseholdJoinRequestRecord[]> {
    const result = await executeQuery<
      HouseholdJoinRequestRecord & {
        firstName: string | null;
        lastName: string | null;
        preferredName: string | null;
      }
    >(
      executor,
      `
      select
        r.household_join_request_id as "householdJoinRequestId",
        r.household_id as "householdId",
        r.requesting_user_id as "requestingUserId",
        u.email as "requestingUserEmail",
        r.requested_persona as "requestedPersona",
        r.requested_parent_email as "requestedParentEmail",
        r.request_message as "requestMessage",
        r.status,
        r.reviewed_by_user_id as "reviewedByUserId",
        r.reviewed_at::text as "reviewedAt",
        r.created_at::text as "createdAt",
        r.updated_at::text as "updatedAt",
        u.first_name as "firstName",
        u.last_name as "lastName",
        u.preferred_name as "preferredName"
      from household_join_requests r
      join users u on u.user_id = r.requesting_user_id
      where r.household_id = $1
      order by r.created_at desc
      `,
      [householdId]
    );

    return result.rows.map((row) => ({
      ...row,
      requestingDisplayName: displayName(row.firstName, row.lastName, row.preferredName),
    }));
  }

  async getPendingJoinRequestForUser(userId: string, executor?: DbExecutor): Promise<HouseholdJoinRequestRecord | null> {
    const result = await executeQuery<
      HouseholdJoinRequestRecord & {
        firstName: string | null;
        lastName: string | null;
        preferredName: string | null;
      }
    >(
      executor,
      `
      select
        r.household_join_request_id as "householdJoinRequestId",
        r.household_id as "householdId",
        r.requesting_user_id as "requestingUserId",
        u.email as "requestingUserEmail",
        r.requested_persona as "requestedPersona",
        r.requested_parent_email as "requestedParentEmail",
        r.request_message as "requestMessage",
        r.status,
        r.reviewed_by_user_id as "reviewedByUserId",
        r.reviewed_at::text as "reviewedAt",
        r.created_at::text as "createdAt",
        r.updated_at::text as "updatedAt",
        u.first_name as "firstName",
        u.last_name as "lastName",
        u.preferred_name as "preferredName"
      from household_join_requests r
      join users u on u.user_id = r.requesting_user_id
      where r.requesting_user_id = $1
        and r.status = 'pending'
      order by r.created_at desc
      limit 1
      `,
      [userId]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return {
      ...row,
      requestingDisplayName: displayName(row.firstName, row.lastName, row.preferredName),
    };
  }

  async markJoinRequest(input: {
    householdJoinRequestId: string;
    status: "approved" | "denied" | "cancelled";
    reviewedByUserId?: string | null;
  }, executor?: DbExecutor) {
    await executeQuery(
      executor,
      `
      update household_join_requests
      set
        status = $2,
        reviewed_by_user_id = $3,
        reviewed_at = case when $2 in ('approved','denied') then now() else reviewed_at end,
        updated_at = now()
      where household_join_request_id = $1
      `,
      [input.householdJoinRequestId, input.status, input.reviewedByUserId ?? null]
    );
  }
}

export const householdAdminRepository = new HouseholdAdminRepository();
