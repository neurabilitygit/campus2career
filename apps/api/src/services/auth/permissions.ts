import {
  CAPABILITY_CATALOG,
  expandCapabilitiesWithDependencies,
  getPersonaDefaultCapabilities,
  type CapabilityKey,
  type Persona,
} from "../../../../../packages/shared/src/capabilities";
import type {
  CapabilityOverrideRecord,
  HouseholdMembershipRecord,
  UserAccountPermissionRecord,
} from "../../repositories/auth/permissionRepository";

export interface EffectivePermissionSet {
  primaryPersona: Persona;
  householdId: string | null;
  isSuperAdmin: boolean;
  accountStatus: string;
  memberships: HouseholdMembershipRecord[];
  grantedCapabilities: CapabilityKey[];
  deniedCapabilities: CapabilityKey[];
}

function normalizeMembershipPersona(role: HouseholdMembershipRecord["roleInHousehold"]): Persona | null {
  if (role === "student") return "student";
  if (role === "parent" || role === "guardian") return "parent";
  if (role === "coach") return "coach";
  return null;
}

export function resolvePrimaryMembership(memberships: HouseholdMembershipRecord[]): HouseholdMembershipRecord | null {
  const active = memberships.filter((membership) => membership.membershipStatus === "active");
  return active.find((membership) => membership.isPrimary) || active[0] || memberships[0] || null;
}

export function resolvePrimaryPersona(
  account: UserAccountPermissionRecord,
  memberships: HouseholdMembershipRecord[]
): Persona {
  if (account.isSuperAdmin) {
    return "admin";
  }

  const primaryMembership = resolvePrimaryMembership(memberships);
  const householdPersona = primaryMembership ? normalizeMembershipPersona(primaryMembership.roleInHousehold) : null;
  return householdPersona || account.roleType || "student";
}

export function buildEffectivePermissions(input: {
  account: UserAccountPermissionRecord;
  memberships: HouseholdMembershipRecord[];
  overrides: CapabilityOverrideRecord[];
}): EffectivePermissionSet {
  const primaryMembership = resolvePrimaryMembership(input.memberships);
  const primaryPersona = resolvePrimaryPersona(input.account, input.memberships);
  const householdId = primaryMembership?.householdId ?? null;

  if (input.account.isSuperAdmin) {
    return {
      primaryPersona,
      householdId,
      isSuperAdmin: true,
      accountStatus: input.account.accountStatus,
      memberships: input.memberships,
      grantedCapabilities: CAPABILITY_CATALOG.map((capability) => capability.key),
      deniedCapabilities: [],
    };
  }

  const base = new Set<CapabilityKey>(expandCapabilitiesWithDependencies(getPersonaDefaultCapabilities(primaryPersona)));
  const denied = new Set<CapabilityKey>();

  for (const override of input.overrides) {
    if (override.effect === "deny") {
      denied.add(override.capabilityKey);
      base.delete(override.capabilityKey);
      continue;
    }
    if (!denied.has(override.capabilityKey)) {
      for (const capability of expandCapabilitiesWithDependencies([override.capabilityKey])) {
        base.add(capability);
      }
    }
  }

  const grantedCapabilities = Array.from(base).filter((capability) => !denied.has(capability));
  return {
    primaryPersona,
    householdId,
    isSuperAdmin: false,
    accountStatus: input.account.accountStatus,
    memberships: input.memberships,
    grantedCapabilities,
    deniedCapabilities: Array.from(denied),
  };
}

export function hasCapability(
  permissions: Pick<EffectivePermissionSet, "isSuperAdmin" | "grantedCapabilities"> | null | undefined,
  capability: CapabilityKey
): boolean {
  if (!permissions) {
    return false;
  }
  if (permissions.isSuperAdmin) {
    return true;
  }
  return permissions.grantedCapabilities.includes(capability);
}

export function canCreateHouseholdForPersona(persona: Persona) {
  return persona === "parent" || persona === "admin";
}

export function canSelfStartWithoutHousehold(persona: Persona) {
  return persona === "parent" || persona === "admin";
}
