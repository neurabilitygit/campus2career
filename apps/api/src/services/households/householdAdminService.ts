import crypto from "node:crypto";
import {
  CAPABILITY_CATALOG,
  capabilityAppliesToPersona,
  type CapabilityKey,
  type Persona,
} from "../../../../../packages/shared/src/capabilities";
import type {
  HouseholdAdminOverview,
  HouseholdInvitationRecord,
  SignupDecision,
} from "../../../../../packages/shared/src/contracts/admin";
import { withTransaction } from "../../db/client";
import { permissionRepository } from "../../repositories/auth/permissionRepository";
import { householdAdminRepository } from "../../repositories/households/householdAdminRepository";
import type { RequestContext } from "../auth/resolveRequestContext";
import { buildEffectivePermissions, canCreateHouseholdForPersona, hasCapability } from "../auth/permissions";
import { AppError } from "../../utils/appError";
import { invitationEmailService } from "../email/invitationEmailService";

const INVITATION_TTL_DAYS = 7;

function newId() {
  return crypto.randomUUID();
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function roleInHouseholdForPersona(persona: Persona): "student" | "parent" | "coach" {
  if (persona === "parent") return "parent";
  if (persona === "coach") return "coach";
  return "student";
}

function hashInvitationToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function futureExpiryIso(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function assertCapability(ctx: RequestContext, capability: CapabilityKey) {
  if (!hasCapability({ isSuperAdmin: !!ctx.isSuperAdmin, grantedCapabilities: ctx.effectiveCapabilities || [] }, capability)) {
    throw new AppError({
      status: 403,
      code: "forbidden_capability",
      message: `Missing required capability: ${capability}`,
      details: { capability },
    });
  }
}

function buildInviteLink(rawToken: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || "http://localhost:3000";
  return `${baseUrl.replace(/\/$/, "")}/signup?invite=${encodeURIComponent(rawToken)}`;
}

export class HouseholdAdminService {
  private buildFallbackSignupDecision(ctx: RequestContext): SignupDecision {
    const activeMembership = ctx.activeMemberships?.find((membership) => membership.membershipStatus === "active");
    const role = ctx.primaryPersona;

    if (ctx.isSuperAdmin || role === "admin") {
      return {
        state: "admin_ready",
        role: "admin",
        householdId: ctx.householdId ?? activeMembership?.householdId ?? null,
        householdName: activeMembership?.householdName ?? null,
      };
    }

    if (activeMembership) {
      return {
        state: "ready",
        role,
        householdId: activeMembership.householdId,
        householdName: activeMembership.householdName ?? null,
      };
    }

    return {
      state: canCreateHouseholdForPersona(role) ? "needs_parent_household" : "needs_household_request",
      role,
      householdId: null,
      householdName: null,
    };
  }

  async getSignupDecision(ctx: RequestContext, inviteToken?: string | null): Promise<SignupDecision> {
    if (ctx.isSuperAdmin) {
      return {
        state: "admin_ready",
        role: "admin",
        householdId: ctx.householdId ?? null,
        householdName: ctx.activeMemberships?.[0]?.householdName ?? null,
      };
    }

    const role = ctx.primaryPersona;

    if (inviteToken) {
      const invitation = await this.previewInvitation(inviteToken);
      return {
        state: "pending_invitation_acceptance",
        role: invitation.invitedPersona,
        householdId: invitation.householdId,
        householdName: invitation.householdName ?? null,
        invitationPreview: {
          invitedPersona: invitation.invitedPersona,
          householdName: invitation.householdName ?? null,
          inviterName: null,
          expiresAt: invitation.expiresAt,
        },
      };
    }

    try {
      const activeMembership = ctx.activeMemberships?.find((membership) => membership.membershipStatus === "active");
      if (activeMembership || role === "admin") {
        return {
          state: role === "admin" ? "admin_ready" : "ready",
          role,
          householdId: activeMembership?.householdId ?? null,
          householdName: activeMembership?.householdName ?? null,
        };
      }

      const pendingJoinRequest = await householdAdminRepository.getPendingJoinRequestForUser(ctx.authenticatedUserId);
      if (pendingJoinRequest) {
        return {
          state: "pending_join_request",
          role,
          householdId: pendingJoinRequest.householdId,
          householdName: null,
          pendingJoinRequest: {
            requestedParentEmail: pendingJoinRequest.requestedParentEmail,
            status: pendingJoinRequest.status,
          },
        };
      }

      if (canCreateHouseholdForPersona(role)) {
        return {
          state: "needs_parent_household",
          role,
          householdId: null,
          householdName: null,
        };
      }

      return {
        state: "needs_household_request",
        role,
        householdId: null,
        householdName: null,
      };
    } catch (error) {
      console.error("Signup decision lookup failed, using fallback decision", {
        authenticatedUserId: ctx.authenticatedUserId,
        primaryPersona: ctx.primaryPersona,
        householdId: ctx.householdId,
        error,
      });
      return this.buildFallbackSignupDecision(ctx);
    }
  }

  async createParentHousehold(ctx: RequestContext, input: { householdName: string; persona: "parent" | "admin" }) {
    if (ctx.householdId || (ctx.activeMemberships || []).some((membership) => membership.membershipStatus === "active")) {
      throw new AppError({
        status: 400,
        code: "household_already_exists",
        message: "This account is already attached to an active household.",
      });
    }
    if (input.persona !== "parent" && input.persona !== "admin") {
      throw new AppError({
        status: 400,
        code: "invalid_household_creator_persona",
        message: "Only parent or admin signup flows can create a household.",
      });
    }
    const normalizedName = input.householdName.trim();
    if (!normalizedName) {
      throw new AppError({ status: 400, code: "household_name_required", message: "Household name is required." });
    }

    return withTransaction(async (tx) => {
      const householdId = newId();
      await householdAdminRepository.createHousehold(
        {
          householdId,
          householdName: normalizedName,
          createdByParentUserId: ctx.authenticatedUserId,
        },
        tx
      );
      if (input.persona === "parent") {
        await householdAdminRepository.insertMembership(
          {
            householdId,
            userId: ctx.authenticatedUserId,
            roleInHousehold: "parent",
            isPrimary: true,
            membershipStatus: "active",
            approvedByUserId: ctx.authenticatedUserId,
            approvedAt: new Date().toISOString(),
          },
          tx
        );
      }
      await householdAdminRepository.setUserAccountRole(ctx.authenticatedUserId, input.persona, tx);
      await householdAdminRepository.setUserAccountStatus(ctx.authenticatedUserId, "active", tx);
      return householdAdminRepository.findHouseholdById(householdId, tx);
    });
  }

  async buildAdminOverview(ctx: RequestContext, requestedHouseholdId?: string | null): Promise<HouseholdAdminOverview> {
    const canAccessAdminConsole = hasCapability(
      { isSuperAdmin: !!ctx.isSuperAdmin, grantedCapabilities: ctx.effectiveCapabilities || [] },
      "access_admin_console"
    );

    const householdId = requestedHouseholdId || ctx.householdId;
    if (!householdId && !canAccessAdminConsole) {
      return {
        householdId: null,
        householdName: null,
        canManageHousehold: false,
        canManagePermissions: false,
        members: [],
        invitations: [],
        joinRequests: [],
      };
    }

    const resolvedHouseholdId =
      householdId ||
      (await householdAdminRepository.listHouseholds()).at(0)?.householdId ||
      null;

    if (!resolvedHouseholdId) {
      return {
        householdId: null,
        householdName: null,
        canManageHousehold: false,
        canManagePermissions: false,
        members: [],
        invitations: [],
        joinRequests: [],
      };
    }

    const household = await householdAdminRepository.findHouseholdById(resolvedHouseholdId);
    const [members, invitations, joinRequests] = await Promise.all([
      householdAdminRepository.listHouseholdMembers(resolvedHouseholdId),
      householdAdminRepository.listInvitations(resolvedHouseholdId),
      householdAdminRepository.listJoinRequests(resolvedHouseholdId),
    ]);

    const hydratedMembers = [];
    for (const member of members) {
      await permissionRepository.ensureCapabilityCatalogSynced();
      const overrides = await permissionRepository.listCapabilityOverridesForUser(member.userId, resolvedHouseholdId);
      const account = await permissionRepository.getUserAccount(member.userId);
      if (!account) {
        continue;
      }
      const memberships = await permissionRepository.listMembershipsForUser(member.userId);
      const effective = buildEffectivePermissions({ account, memberships, overrides });
      hydratedMembers.push({
        ...member,
        grantedCapabilities: effective.grantedCapabilities,
        deniedCapabilities: effective.deniedCapabilities,
      });
    }

    return {
      householdId: household?.householdId ?? resolvedHouseholdId,
      householdName: household?.householdName ?? null,
      canManageHousehold: hasCapability(
        { isSuperAdmin: !!ctx.isSuperAdmin, grantedCapabilities: ctx.effectiveCapabilities || [] },
        "manage_household"
      ),
      canManagePermissions: hasCapability(
        { isSuperAdmin: !!ctx.isSuperAdmin, grantedCapabilities: ctx.effectiveCapabilities || [] },
        "manage_permissions"
      ),
      members: hydratedMembers,
      invitations,
      joinRequests,
    };
  }

  async inviteMember(
    ctx: RequestContext,
    input: { householdId?: string | null; invitedEmail: string; invitedPersona: "student" | "coach" }
  ) {
    const capability = input.invitedPersona === "coach" ? "invite_coach" : "invite_student";
    assertCapability(ctx, capability);

    const householdId = input.householdId || ctx.householdId;
    if (!householdId) {
      throw new AppError({ status: 400, code: "household_required", message: "A household is required to send an invitation." });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const invitationTokenHash = hashInvitationToken(rawToken);
    const householdInvitationId = newId();
    const expiresAt = futureExpiryIso(INVITATION_TTL_DAYS);

    await householdAdminRepository.createInvitation({
      householdInvitationId,
      householdId,
      invitedEmail: normalizeEmail(input.invitedEmail),
      invitedPersona: input.invitedPersona,
      invitedByUserId: ctx.authenticatedUserId,
      invitationTokenHash,
      expiresAt,
    });

    const inviteLink = buildInviteLink(rawToken);
    const delivery = await invitationEmailService.sendHouseholdInvitation({
      invitedEmail: normalizeEmail(input.invitedEmail),
      invitedPersona: input.invitedPersona,
      inviterName:
        [ctx.authenticatedPreferredName || ctx.authenticatedFirstName, ctx.authenticatedLastName]
          .filter(Boolean)
          .join(" ")
          .trim() || null,
      householdName: (await householdAdminRepository.findHouseholdById(householdId))?.householdName ?? null,
      inviteLink,
      expiresAt,
    });

    const invitations = await householdAdminRepository.listInvitations(householdId);
    const record = invitations.find((item) => item.householdInvitationId === householdInvitationId);
    if (!record) {
      throw new AppError({ status: 500, code: "invitation_create_failed", message: "Invitation could not be created." });
    }

    const enriched: HouseholdInvitationRecord = {
      ...record,
      inviteLinkPreview: delivery.provider === "development_log" ? inviteLink : null,
      deliveryProvider: delivery.provider,
      deliveryState: delivery.state,
      deliveryMessage: delivery.message,
    };
    return enriched;
  }

  async previewInvitation(rawToken: string) {
    const invitation = await householdAdminRepository.getInvitationByTokenHash(hashInvitationToken(rawToken));
    if (!invitation) {
      throw new AppError({ status: 404, code: "invitation_not_found", message: "Invitation not found." });
    }
    if (invitation.status !== "pending") {
      throw new AppError({ status: 400, code: "invitation_unavailable", message: "This invitation is no longer available." });
    }
    if (new Date(invitation.expiresAt).getTime() < Date.now()) {
      throw new AppError({ status: 400, code: "invitation_expired", message: "This invitation has expired." });
    }
    return invitation;
  }

  async acceptInvitation(ctx: RequestContext, rawToken: string) {
    const invitation = await this.previewInvitation(rawToken);
    if (normalizeEmail(ctx.email || "") !== normalizeEmail(invitation.invitedEmail)) {
      throw new AppError({
        status: 403,
        code: "invitation_email_mismatch",
        message: "This invitation was issued to a different email address.",
      });
    }

    return withTransaction(async (tx) => {
      await householdAdminRepository.insertMembership(
        {
          householdId: invitation.householdId,
          userId: ctx.authenticatedUserId,
          roleInHousehold: roleInHouseholdForPersona(invitation.invitedPersona),
          isPrimary: true,
          membershipStatus: "active",
          invitedByUserId: invitation.invitedByUserId,
          approvedByUserId: invitation.invitedByUserId,
          approvedAt: new Date().toISOString(),
        },
        tx
      );
      await householdAdminRepository.setUserAccountRole(ctx.authenticatedUserId, invitation.invitedPersona, tx);
      await householdAdminRepository.setUserAccountStatus(ctx.authenticatedUserId, "active", tx);
      await householdAdminRepository.markInvitationAccepted(
        {
          householdInvitationId: invitation.householdInvitationId,
          acceptedByUserId: ctx.authenticatedUserId,
        },
        tx
      );
      return householdAdminRepository.findHouseholdById(invitation.householdId, tx);
    });
  }

  async requestHouseholdAccess(
    ctx: RequestContext,
    input: { requestedPersona: Persona; parentEmail: string; requestMessage?: string | null }
  ) {
    if (input.requestedPersona !== "student" && input.requestedPersona !== "coach") {
      throw new AppError({
        status: 400,
        code: "invalid_household_request_persona",
        message: "Only student and coach requests are supported here.",
      });
    }
    const targetHousehold = await householdAdminRepository.findActiveHouseholdByParentEmail(input.parentEmail);
    await householdAdminRepository.createJoinRequest({
      householdJoinRequestId: newId(),
      householdId: targetHousehold?.householdId ?? null,
      requestingUserId: ctx.authenticatedUserId,
      requestedPersona: input.requestedPersona,
      requestedParentEmail: normalizeEmail(input.parentEmail),
      requestMessage: input.requestMessage ?? null,
    });
    await householdAdminRepository.setUserAccountRole(ctx.authenticatedUserId, input.requestedPersona);
    await householdAdminRepository.setUserAccountStatus(ctx.authenticatedUserId, "pending_household");
    return targetHousehold;
  }

  async approveJoinRequest(ctx: RequestContext, input: { householdJoinRequestId: string }) {
    assertCapability(ctx, "approve_household_join_request");
    const overview = await this.buildAdminOverview(ctx, ctx.householdId);
    const request = overview.joinRequests.find((entry) => entry.householdJoinRequestId === input.householdJoinRequestId);
    if (!request) {
      throw new AppError({ status: 404, code: "join_request_not_found", message: "Join request not found." });
    }
    if (!overview.householdId) {
      throw new AppError({ status: 400, code: "household_required", message: "A household is required to approve a request." });
    }

    return withTransaction(async (tx) => {
      await householdAdminRepository.insertMembership(
        {
          householdId: overview.householdId!,
          userId: request.requestingUserId,
          roleInHousehold: roleInHouseholdForPersona(request.requestedPersona),
          isPrimary: true,
          membershipStatus: "active",
          approvedByUserId: ctx.authenticatedUserId,
          approvedAt: new Date().toISOString(),
        },
        tx
      );
      await householdAdminRepository.setUserAccountRole(request.requestingUserId, request.requestedPersona, tx);
      await householdAdminRepository.setUserAccountStatus(request.requestingUserId, "active", tx);
      await householdAdminRepository.markJoinRequest(
        {
          householdJoinRequestId: request.householdJoinRequestId,
          status: "approved",
          reviewedByUserId: ctx.authenticatedUserId,
        },
        tx
      );
    });
  }

  async denyJoinRequest(ctx: RequestContext, input: { householdJoinRequestId: string }) {
    assertCapability(ctx, "approve_household_join_request");
    await householdAdminRepository.markJoinRequest({
      householdJoinRequestId: input.householdJoinRequestId,
      status: "denied",
      reviewedByUserId: ctx.authenticatedUserId,
    });
  }

  async updateMemberPermissions(
    ctx: RequestContext,
    input: {
      householdId?: string | null;
      userId: string;
      persona: Persona;
      grants: CapabilityKey[];
      denies: CapabilityKey[];
    }
  ) {
    assertCapability(ctx, "manage_permissions");
    if (input.persona === "admin" && !ctx.isSuperAdmin) {
      throw new AppError({
        status: 403,
        code: "admin_persona_requires_super_admin",
        message: "Only the super administrator can assign the admin persona.",
      });
    }
    const householdId = input.householdId || ctx.householdId;
    if (!householdId && !ctx.isSuperAdmin) {
      throw new AppError({ status: 400, code: "household_required", message: "A household is required to manage permissions." });
    }

    const allowedGrants = input.grants.filter((capability) => capabilityAppliesToPersona(capability, input.persona));
    const allowedDenies = input.denies.filter((capability) => capabilityAppliesToPersona(capability, input.persona));

    await withTransaction(async (tx) => {
      await permissionRepository.replaceUserCapabilityOverrides(
        {
          userId: input.userId,
          householdId: householdId ?? null,
          grants: allowedGrants,
          denies: allowedDenies,
          createdByUserId: ctx.authenticatedUserId,
        },
        tx
      );
      await permissionRepository.updateUserPrimaryPersona(
        {
          userId: input.userId,
          persona: input.persona,
          householdId: householdId ?? null,
        },
        tx
      );
    });

    return this.buildAdminOverview(ctx, householdId ?? undefined);
  }

  async listSuperAdminDirectory(ctx: RequestContext) {
    assertCapability(ctx, "access_admin_console");
    if (!ctx.isSuperAdmin) {
      throw new AppError({
        status: 403,
        code: "super_admin_required",
        message: "Only the super administrator can access the cross-household user directory.",
      });
    }
    return householdAdminRepository.listSuperAdminDirectoryUsers();
  }

  listEditableCapabilitiesForPersona(persona: Persona) {
    return CAPABILITY_CATALOG.filter(
      (capability) => capability.adminChangeable && capability.applicablePersonas.includes(persona)
    );
  }
}

export const householdAdminService = new HouseholdAdminService();
