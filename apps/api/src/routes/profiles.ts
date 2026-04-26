import crypto from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { withTransaction } from "../db/client";
import { ProfileRepository } from "../repositories/profile/profileRepository";
import { resolveRequestContext } from "../services/auth/resolveRequestContext";
import {
  coachEditableProfileSchema,
  parentEditableProfileSchema,
  splitFullName,
  studentEditableProfileSchema,
} from "../services/profile/validation";
import { readJsonBody } from "../utils/body";
import { badRequest, json, unauthorized } from "../utils/http";

const repo = new ProfileRepository();
export const profileRouteDeps = {
  repo,
  resolveRequestContext,
  withTransaction,
};

function newId() {
  return crypto.randomUUID();
}

function formatZodErrorMessage(error: { issues?: Array<{ path: Array<string | number>; message: string }> }) {
  return (
    error.issues?.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`).join("; ") ||
    "Invalid request body"
  );
}

function hasRole(role: string, allowed: string[]) {
  return allowed.includes(role);
}

async function parseJsonBody(req: IncomingMessage) {
  try {
    return await readJsonBody(req);
  } catch {
    return null;
  }
}

export async function studentEditableProfileReadRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await profileRouteDeps.resolveRequestContext(req);
    if (!hasRole(ctx.authenticatedRoleType, ["student", "admin"])) {
      return unauthorized(res);
    }
    if (!ctx.studentProfileId || !ctx.studentUserId) {
      return badRequest(res, "No student profile could be resolved for the authenticated user");
    }

    const profile = await profileRouteDeps.repo.getStudentEditableProfile(ctx.studentProfileId);
    return json(res, 200, { ok: true, profile });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    throw error;
  }
}

export async function studentEditableProfileUpsertRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await profileRouteDeps.resolveRequestContext(req);
    if (!hasRole(ctx.authenticatedRoleType, ["student", "admin"])) {
      return unauthorized(res);
    }
    if (!ctx.studentProfileId || !ctx.studentUserId) {
      return badRequest(res, "No student profile could be resolved for the authenticated user");
    }

    const raw = await parseJsonBody(req);
    if (!raw) {
      return badRequest(res, "Invalid JSON body");
    }

    const parsed = studentEditableProfileSchema.safeParse(raw);
    if (!parsed.success) {
      return badRequest(res, formatZodErrorMessage(parsed.error));
    }

    const names = splitFullName(parsed.data.fullName);
    await profileRouteDeps.withTransaction(async (tx) => {
      await profileRouteDeps.repo.updateUserIdentity(
        {
          userId: ctx.studentUserId!,
          firstName: names.firstName,
          lastName: names.lastName,
          preferredName: parsed.data.preferredName ?? null,
        },
        tx
      );
      await profileRouteDeps.repo.updateStudentEditableProfile(
        {
          studentProfileId: ctx.studentProfileId!,
          profile: {
            ...parsed.data,
            preferredName: parsed.data.preferredName ?? null,
            age: parsed.data.age ?? null,
            gender: parsed.data.gender ?? null,
            housingStatus: parsed.data.housingStatus ?? null,
            otherNeurodivergentDescription: parsed.data.otherNeurodivergentDescription ?? null,
            communicationPreferences: parsed.data.communicationPreferences ?? null,
            personalChoices: parsed.data.personalChoices ?? null,
          },
        },
        tx
      );
    });

    return json(res, 200, { ok: true, message: "Profile updated" });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    throw error;
  }
}

export async function parentEditableProfileReadRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await profileRouteDeps.resolveRequestContext(req);
    if (!hasRole(ctx.authenticatedRoleType, ["parent", "admin"])) {
      return unauthorized(res);
    }

    const profile = await profileRouteDeps.repo.getParentEditableProfile(ctx.authenticatedUserId);
    return json(res, 200, { ok: true, profile });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    throw error;
  }
}

export async function parentEditableProfileUpsertRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await profileRouteDeps.resolveRequestContext(req);
    if (!hasRole(ctx.authenticatedRoleType, ["parent", "admin"])) {
      return unauthorized(res);
    }

    const raw = await parseJsonBody(req);
    if (!raw) {
      return badRequest(res, "Invalid JSON body");
    }

    const parsed = parentEditableProfileSchema.safeParse(raw);
    if (!parsed.success) {
      return badRequest(res, formatZodErrorMessage(parsed.error));
    }

    const names = splitFullName(parsed.data.fullName);
    await profileRouteDeps.withTransaction(async (tx) => {
      await profileRouteDeps.repo.updateUserIdentity(
        {
          userId: ctx.authenticatedUserId,
          firstName: names.firstName,
          lastName: names.lastName,
          preferredName: parsed.data.preferredName ?? null,
        },
        tx
      );
      await profileRouteDeps.repo.upsertParentEditableProfile(
        {
          profileId: newId(),
          userId: ctx.authenticatedUserId,
          householdId: ctx.householdId,
          profile: {
            ...parsed.data,
            householdMembers: (parsed.data.householdMembers || []).map((member) => ({
              name: member.name,
              relationship: member.relationship ?? null,
            })),
            preferredName: parsed.data.preferredName ?? null,
            familyUnitName: parsed.data.familyUnitName ?? null,
            relationshipToStudent: parsed.data.relationshipToStudent ?? null,
            familyStructure: parsed.data.familyStructure ?? null,
            partnershipStructure: parsed.data.partnershipStructure ?? null,
            demographicInformation: parsed.data.demographicInformation ?? null,
            communicationPreferences: parsed.data.communicationPreferences ?? null,
            parentGoalsOrConcerns: parsed.data.parentGoalsOrConcerns ?? null,
          },
        },
        tx
      );
    });

    return json(res, 200, { ok: true, message: "Profile updated" });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    throw error;
  }
}

export async function coachEditableProfileReadRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await profileRouteDeps.resolveRequestContext(req);
    if (!hasRole(ctx.authenticatedRoleType, ["coach", "admin"])) {
      return unauthorized(res);
    }

    const profile = await profileRouteDeps.repo.getCoachEditableProfile(ctx.authenticatedUserId);
    return json(res, 200, { ok: true, profile });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    throw error;
  }
}

export async function coachEditableProfileUpsertRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await profileRouteDeps.resolveRequestContext(req);
    if (!hasRole(ctx.authenticatedRoleType, ["coach", "admin"])) {
      return unauthorized(res);
    }

    const raw = await parseJsonBody(req);
    if (!raw) {
      return badRequest(res, "Invalid JSON body");
    }

    const parsed = coachEditableProfileSchema.safeParse(raw);
    if (!parsed.success) {
      return badRequest(res, formatZodErrorMessage(parsed.error));
    }

    const names = splitFullName(parsed.data.fullName);
    await profileRouteDeps.withTransaction(async (tx) => {
      await profileRouteDeps.repo.updateUserIdentity(
        {
          userId: ctx.authenticatedUserId,
          firstName: names.firstName,
          lastName: names.lastName,
          preferredName: parsed.data.preferredName ?? null,
        },
        tx
      );
      await profileRouteDeps.repo.upsertCoachEditableProfile(
        {
          profileId: newId(),
          userId: ctx.authenticatedUserId,
          profile: {
            ...parsed.data,
            preferredName: parsed.data.preferredName ?? null,
            professionalTitle: parsed.data.professionalTitle ?? null,
            organizationName: parsed.data.organizationName ?? null,
            communicationPreferences: parsed.data.communicationPreferences ?? null,
          },
        },
        tx
      );
    });

    return json(res, 200, { ok: true, message: "Profile updated" });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    throw error;
  }
}
