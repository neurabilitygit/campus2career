import crypto from "node:crypto";
import { CAPABILITY_CATALOG, PERSONAS, type CapabilityKey, type Persona } from "../../../../../packages/shared/src/capabilities";
import { executeQuery, query, type DbExecutor } from "../../db/client";

export interface UserAccountPermissionRecord {
  userId: string;
  email: string | null;
  roleType: Persona;
  accountStatus: string;
  authProvider: string | null;
  isSuperAdmin: boolean;
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
}

export interface HouseholdMembershipRecord {
  userHouseholdRoleId: string;
  householdId: string;
  householdName: string | null;
  createdByParentUserId: string | null;
  userId: string;
  roleInHousehold: "student" | "parent" | "guardian" | "coach";
  isPrimary: boolean;
  membershipStatus: "pending" | "active" | "suspended" | "removed";
  invitedByUserId: string | null;
  approvedByUserId: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CapabilityOverrideRecord {
  userCapabilityOverrideId: string;
  userId: string;
  householdId: string | null;
  capabilityKey: CapabilityKey;
  effect: "grant" | "deny";
}

let capabilityCatalogSynced = false;

function randomId() {
  return crypto.randomUUID();
}

export class PermissionRepository {
  async ensureCapabilityCatalogSynced(executor?: DbExecutor) {
    if (capabilityCatalogSynced) {
      return;
    }

    for (const capability of CAPABILITY_CATALOG) {
      await executeQuery(
        executor,
        `
        insert into capabilities (
          capability_key,
          label,
          description,
          applicable_personas,
          dependency_keys,
          system_critical,
          admin_changeable,
          created_at,
          updated_at
        ) values ($1,$2,$3,$4,$5,$6,$7,now(),now())
        on conflict (capability_key) do update
        set
          label = excluded.label,
          description = excluded.description,
          applicable_personas = excluded.applicable_personas,
          dependency_keys = excluded.dependency_keys,
          system_critical = excluded.system_critical,
          admin_changeable = excluded.admin_changeable,
          updated_at = now()
        `,
        [
          capability.key,
          capability.label,
          capability.description,
          capability.applicablePersonas,
          capability.dependencies,
          capability.systemCritical,
          capability.adminChangeable,
        ]
      );
    }

    for (const persona of PERSONAS) {
      for (const capability of CAPABILITY_CATALOG) {
        const enabled = !!capability.defaultEnabledByPersona[persona];
        await executeQuery(
          executor,
          `
          insert into persona_capability_defaults (
            persona_capability_default_id,
            persona,
            capability_key,
            is_enabled,
            created_at,
            updated_at
          ) values ($1,$2,$3,$4,now(),now())
          on conflict (persona, capability_key) do update
          set
            is_enabled = excluded.is_enabled,
            updated_at = now()
          `,
          [randomId(), persona, capability.key, enabled]
        );
      }
    }

    capabilityCatalogSynced = true;
  }

  async getUserAccount(userId: string, executor?: DbExecutor): Promise<UserAccountPermissionRecord | null> {
    const result = await executeQuery<UserAccountPermissionRecord>(
      executor,
      `
      select
        user_id as "userId",
        email,
        role_type as "roleType",
        account_status as "accountStatus",
        auth_provider as "authProvider",
        is_super_admin as "isSuperAdmin",
        first_name as "firstName",
        last_name as "lastName",
        preferred_name as "preferredName"
      from users
      where user_id = $1
      limit 1
      `,
      [userId]
    );

    return result.rows[0] || null;
  }

  async listMembershipsForUser(userId: string, executor?: DbExecutor): Promise<HouseholdMembershipRecord[]> {
    const result = await executeQuery<HouseholdMembershipRecord>(
      executor,
      `
      select
        uhr.user_household_role_id as "userHouseholdRoleId",
        uhr.household_id as "householdId",
        h.household_name as "householdName",
        h.created_by_parent_user_id as "createdByParentUserId",
        uhr.user_id as "userId",
        uhr.role_in_household as "roleInHousehold",
        uhr.is_primary as "isPrimary",
        uhr.membership_status as "membershipStatus",
        uhr.invited_by_user_id as "invitedByUserId",
        uhr.approved_by_user_id as "approvedByUserId",
        uhr.approved_at::text as "approvedAt",
        uhr.created_at::text as "createdAt",
        uhr.updated_at::text as "updatedAt"
      from user_household_roles uhr
      join households h on h.household_id = uhr.household_id
      where uhr.user_id = $1
      order by
        case when uhr.membership_status = 'active' then 0 else 1 end,
        case when uhr.is_primary then 0 else 1 end,
        uhr.created_at asc
      `,
      [userId]
    );

    return result.rows;
  }

  async listCapabilityOverridesForUser(
    userId: string,
    householdId?: string | null,
    executor?: DbExecutor
  ): Promise<CapabilityOverrideRecord[]> {
    const result = await executeQuery<CapabilityOverrideRecord>(
      executor,
      `
      select
        user_capability_override_id as "userCapabilityOverrideId",
        user_id as "userId",
        household_id as "householdId",
        capability_key as "capabilityKey",
        effect
      from user_capability_overrides
      where user_id = $1
        and (
          household_id is null
          or household_id = $2::uuid
        )
      order by
        case when household_id is null then 1 else 0 end,
        created_at asc
      `,
      [userId, householdId ?? null]
    );

    return result.rows;
  }

  async listHouseholdMembers(householdId: string, executor?: DbExecutor) {
    const result = await executeQuery<
      HouseholdMembershipRecord & {
        email: string | null;
        roleType: Persona;
        accountStatus: string;
        firstName: string | null;
        lastName: string | null;
        preferredName: string | null;
        isSuperAdmin: boolean;
      }
    >(
      executor,
      `
      select
        uhr.user_household_role_id as "userHouseholdRoleId",
        uhr.household_id as "householdId",
        h.household_name as "householdName",
        h.created_by_parent_user_id as "createdByParentUserId",
        uhr.user_id as "userId",
        uhr.role_in_household as "roleInHousehold",
        uhr.is_primary as "isPrimary",
        uhr.membership_status as "membershipStatus",
        uhr.invited_by_user_id as "invitedByUserId",
        uhr.approved_by_user_id as "approvedByUserId",
        uhr.approved_at::text as "approvedAt",
        uhr.created_at::text as "createdAt",
        uhr.updated_at::text as "updatedAt",
        u.email,
        u.role_type as "roleType",
        u.account_status as "accountStatus",
        u.first_name as "firstName",
        u.last_name as "lastName",
        u.preferred_name as "preferredName",
        u.is_super_admin as "isSuperAdmin"
      from user_household_roles uhr
      join households h on h.household_id = uhr.household_id
      join users u on u.user_id = uhr.user_id
      where uhr.household_id = $1
      order by
        case when uhr.membership_status = 'active' then 0 else 1 end,
        case when uhr.is_primary then 0 else 1 end,
        uhr.created_at asc
      `,
      [householdId]
    );

    return result.rows;
  }

  async replaceUserCapabilityOverrides(input: {
    userId: string;
    householdId?: string | null;
    grants: CapabilityKey[];
    denies: CapabilityKey[];
    createdByUserId: string;
  }, executor?: DbExecutor) {
    await executeQuery(
      executor,
      `
      delete from user_capability_overrides
      where user_id = $1
        and household_id is not distinct from $2::uuid
      `,
      [input.userId, input.householdId ?? null]
    );

    for (const capabilityKey of input.grants) {
      await executeQuery(
        executor,
        `
        insert into user_capability_overrides (
          user_capability_override_id,
          user_id,
          household_id,
          capability_key,
          effect,
          created_by_user_id,
          created_at,
          updated_at
        ) values ($1,$2,$3,$4,'grant',$5,now(),now())
        `,
        [randomId(), input.userId, input.householdId ?? null, capabilityKey, input.createdByUserId]
      );
    }

    for (const capabilityKey of input.denies) {
      await executeQuery(
        executor,
        `
        insert into user_capability_overrides (
          user_capability_override_id,
          user_id,
          household_id,
          capability_key,
          effect,
          created_by_user_id,
          created_at,
          updated_at
        ) values ($1,$2,$3,$4,'deny',$5,now(),now())
        `,
        [randomId(), input.userId, input.householdId ?? null, capabilityKey, input.createdByUserId]
      );
    }
  }

  async updateUserPrimaryPersona(input: {
    userId: string;
    persona: Persona;
    householdId?: string | null;
  }, executor?: DbExecutor) {
    await executeQuery(
      executor,
      `
      update users
      set
        role_type = $2,
        updated_at = now()
      where user_id = $1
      `,
      [input.userId, input.persona]
    );

    if (!input.householdId) {
      return;
    }

    await executeQuery(
      executor,
      `
      update user_household_roles
      set
        is_primary = case when role_in_household = $3 then true else false end,
        updated_at = now()
      where household_id = $1
        and user_id = $2
      `,
      [input.householdId, input.userId, input.persona === "parent" ? "parent" : input.persona]
    );
  }
}

export const permissionRepository = new PermissionRepository();
