import crypto from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import type {
  OutcomeActionDateLabel,
  OutcomeReporterRole,
  StudentOutcomeRecord,
} from "../../../../packages/shared/src/contracts/outcomes";
import { JobTargetRepository } from "../repositories/career/jobTargetRepository";
import { OutcomeRepository } from "../repositories/outcomes/outcomeRepository";
import { resolveRequestContext } from "../services/auth/resolveRequestContext";
import {
  canAccessCoachOutcomes,
  canAccessParentOutcomes,
  canAccessStudentOutcomes,
} from "../services/outcomes/access";
import {
  getValidOutcomeStatusesForType,
  inferOutcomeActionDateLabel,
  inferOutcomeSourceType,
  inferOutcomeVerificationStatus,
  isValidOutcomeStatusForType,
  sortOutcomeTimeline,
} from "../services/outcomes/validation";
import { readJsonBody } from "../utils/body";
import { badRequest, forbidden, json, unauthorized } from "../utils/http";

const repo = new OutcomeRepository();
const jobTargetRepo = new JobTargetRepository();

export const outcomeRouteDeps = {
  repo,
  jobTargetRepo,
  resolveRequestContext,
  newId: () => crypto.randomUUID(),
};

function optionalTrimmedString(maxLength: number) {
  return z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed || undefined;
    },
    z.string().max(maxLength).optional()
  );
}

const createBodySchema = z.object({
  jobTargetId: z.string().uuid().optional(),
  targetRoleFamily: optionalTrimmedString(240),
  targetSectorCluster: optionalTrimmedString(240),
  outcomeType: z.enum(["internship_application", "interview", "offer", "accepted_role"]),
  status: z.enum(["not_started", "in_progress", "applied", "interviewing", "offer", "accepted"]),
  employerName: optionalTrimmedString(240),
  roleTitle: optionalTrimmedString(240),
  actionDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
  actionDateLabel: z
    .enum(["applied_date", "interview_date", "offer_date", "accepted_date"])
    .optional(),
  notes: optionalTrimmedString(4000),
});

const updateBodySchema = createBodySchema.extend({
  studentOutcomeId: z.string().uuid(),
});

const archiveBodySchema = z.object({
  studentOutcomeId: z.string().uuid(),
});

const reviewBodySchema = z.object({
  studentOutcomeId: z.string().uuid(),
});

type RouteContext = Awaited<ReturnType<typeof resolveRequestContext>>;

function requireStudentRole(role: string) {
  if (!canAccessStudentOutcomes(role)) {
    throw new Error("FORBIDDEN_STUDENT_OUTCOMES");
  }
}

function requireParentRole(role: string) {
  if (!canAccessParentOutcomes(role)) {
    throw new Error("FORBIDDEN_PARENT_OUTCOMES");
  }
}

function requireCoachRole(role: string) {
  if (!canAccessCoachOutcomes(role)) {
    throw new Error("FORBIDDEN_COACH_OUTCOMES");
  }
}

function formatZodError(error: z.ZodError): string {
  return (
    error.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`).join("; ") ||
    "Invalid request body"
  );
}

async function parseBody<T extends z.ZodTypeAny>(
  req: IncomingMessage,
  schema: T,
  res: ServerResponse
): Promise<z.infer<T> | null> {
  let raw: unknown;
  try {
    raw = await readJsonBody(req);
  } catch {
    badRequest(res, "Invalid JSON body");
    return null;
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    badRequest(res, formatZodError(parsed.error));
    return null;
  }

  return parsed.data;
}

function validateStatus(
  outcomeType: StudentOutcomeRecord["outcomeType"],
  status: StudentOutcomeRecord["status"],
  res: ServerResponse
): boolean {
  if (isValidOutcomeStatusForType(outcomeType, status)) {
    return true;
  }

  badRequest(
    res,
    `Status ${status} is not valid for ${outcomeType}. Valid states: ${getValidOutcomeStatusesForType(
      outcomeType
    ).join(", ")}`
  );
  return false;
}

async function resolveOutcomeTarget(
  studentProfileId: string,
  body: z.infer<typeof createBodySchema> | z.infer<typeof updateBodySchema>
): Promise<{
  jobTargetId: string | null;
  targetRoleFamily: string | null;
  targetSectorCluster: string | null;
}> {
  if (body.jobTargetId) {
    const jobTarget = await outcomeRouteDeps.jobTargetRepo.getByIdForStudent(
      studentProfileId,
      body.jobTargetId
    );
    if (!jobTarget) {
      throw new Error("OUTCOME_JOB_TARGET_NOT_FOUND");
    }
    return {
      jobTargetId: jobTarget.jobTargetId,
      targetRoleFamily: body.targetRoleFamily ?? jobTarget.normalizedRoleFamily ?? null,
      targetSectorCluster: body.targetSectorCluster ?? jobTarget.normalizedSectorCluster ?? null,
    };
  }

  const primary = await outcomeRouteDeps.jobTargetRepo.getPrimaryForStudent(studentProfileId);
  return {
    jobTargetId: primary?.jobTargetId ?? null,
    targetRoleFamily: body.targetRoleFamily ?? primary?.normalizedRoleFamily ?? null,
    targetSectorCluster: body.targetSectorCluster ?? primary?.normalizedSectorCluster ?? null,
  };
}

function inferReporterRole(ctx: RouteContext): OutcomeReporterRole {
  if (
    ctx.authenticatedRoleType === "student" ||
    ctx.authenticatedRoleType === "parent" ||
    ctx.authenticatedRoleType === "coach" ||
    ctx.authenticatedRoleType === "admin"
  ) {
    return ctx.authenticatedRoleType;
  }
  return "student";
}

async function createOutcomeFromContext(
  ctx: RouteContext,
  body: z.infer<typeof createBodySchema>,
  res: ServerResponse
) {
  if (!ctx.studentProfileId) {
    return badRequest(res, "No student profile could be resolved for the authenticated user");
  }

  if (!validateStatus(body.outcomeType, body.status, res)) {
    return;
  }

  const target = await resolveOutcomeTarget(ctx.studentProfileId, body);
  const reportedByRole = inferReporterRole(ctx);
  const actionDateLabel: OutcomeActionDateLabel =
    body.actionDateLabel ?? inferOutcomeActionDateLabel(body.outcomeType);

  await outcomeRouteDeps.repo.create({
    studentOutcomeId: outcomeRouteDeps.newId(),
    studentProfileId: ctx.studentProfileId,
    householdId: ctx.householdId,
    jobTargetId: target.jobTargetId,
    targetRoleFamily: target.targetRoleFamily,
    targetSectorCluster: target.targetSectorCluster,
    outcomeType: body.outcomeType,
    status: body.status,
    employerName: body.employerName ?? null,
    roleTitle: body.roleTitle ?? null,
    sourceType: inferOutcomeSourceType(reportedByRole),
    reportedByUserId: ctx.authenticatedUserId,
    reportedByRole,
    verificationStatus: inferOutcomeVerificationStatus(reportedByRole),
    actionDate: body.actionDate,
    actionDateLabel,
    notes: body.notes ?? null,
  });

  return json(res, 200, { ok: true, message: "Outcome saved" });
}

async function listOutcomesForContext(ctx: RouteContext, res: ServerResponse) {
  if (!ctx.studentProfileId) {
    return badRequest(res, "No student profile could be resolved for the authenticated user");
  }

  const outcomes = await outcomeRouteDeps.repo.listForStudent(ctx.studentProfileId);
  return json(res, 200, {
    ok: true,
    count: outcomes.length,
    outcomes: sortOutcomeTimeline(outcomes),
  });
}

async function summaryForContext(ctx: RouteContext, res: ServerResponse) {
  if (!ctx.studentProfileId) {
    return badRequest(res, "No student profile could be resolved for the authenticated user");
  }

  const summary = await outcomeRouteDeps.repo.getSummaryForStudent(ctx.studentProfileId);
  return json(res, 200, { ok: true, summary });
}

export async function studentOutcomesListRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await outcomeRouteDeps.resolveRequestContext(req);
    requireStudentRole(ctx.authenticatedRoleType);
    return await listOutcomesForContext(ctx, res);
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_STUDENT_OUTCOMES") {
      return forbidden(res, "Student access is required");
    }
    throw error;
  }
}

export async function studentOutcomesCreateRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await parseBody(req, createBodySchema, res);
    if (!body) return;
    const ctx = await outcomeRouteDeps.resolveRequestContext(req);
    requireStudentRole(ctx.authenticatedRoleType);
    return await createOutcomeFromContext(ctx, body, res);
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_STUDENT_OUTCOMES") {
      return forbidden(res, "Student access is required");
    }
    if (error?.message === "OUTCOME_JOB_TARGET_NOT_FOUND") {
      return badRequest(res, "The selected target role does not belong to the authenticated student");
    }
    throw error;
  }
}

export async function studentOutcomesUpdateRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await parseBody(req, updateBodySchema, res);
    if (!body) return;
    const ctx = await outcomeRouteDeps.resolveRequestContext(req);
    requireStudentRole(ctx.authenticatedRoleType);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated user");
    }
    if (!validateStatus(body.outcomeType, body.status, res)) {
      return;
    }
    const target = await resolveOutcomeTarget(ctx.studentProfileId, body);
    const updated = await outcomeRouteDeps.repo.updateForStudent(ctx.studentProfileId, body.studentOutcomeId, {
      jobTargetId: target.jobTargetId,
      targetRoleFamily: target.targetRoleFamily,
      targetSectorCluster: target.targetSectorCluster,
      outcomeType: body.outcomeType,
      status: body.status,
      employerName: body.employerName ?? null,
      roleTitle: body.roleTitle ?? null,
      actionDate: body.actionDate,
      actionDateLabel: body.actionDateLabel ?? inferOutcomeActionDateLabel(body.outcomeType),
      notes: body.notes ?? null,
    });
    if (!updated) {
      return badRequest(res, "The selected outcome could not be updated for this student");
    }
    return json(res, 200, { ok: true, message: "Outcome updated" });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_STUDENT_OUTCOMES") {
      return forbidden(res, "Student access is required");
    }
    if (error?.message === "OUTCOME_JOB_TARGET_NOT_FOUND") {
      return badRequest(res, "The selected target role does not belong to the authenticated student");
    }
    throw error;
  }
}

export async function studentOutcomesArchiveRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await parseBody(req, archiveBodySchema, res);
    if (!body) return;
    const ctx = await outcomeRouteDeps.resolveRequestContext(req);
    requireStudentRole(ctx.authenticatedRoleType);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated user");
    }
    const archived = await outcomeRouteDeps.repo.archiveForStudent(ctx.studentProfileId, body.studentOutcomeId);
    if (!archived) {
      return badRequest(res, "The selected outcome could not be archived for this student");
    }
    return json(res, 200, { ok: true, message: "Outcome archived" });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_STUDENT_OUTCOMES") {
      return forbidden(res, "Student access is required");
    }
    throw error;
  }
}

export async function studentOutcomesSummaryRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await outcomeRouteDeps.resolveRequestContext(req);
    requireStudentRole(ctx.authenticatedRoleType);
    return await summaryForContext(ctx, res);
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_STUDENT_OUTCOMES") {
      return forbidden(res, "Student access is required");
    }
    throw error;
  }
}

export async function parentOutcomesListRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await outcomeRouteDeps.resolveRequestContext(req);
    requireParentRole(ctx.authenticatedRoleType);
    return await listOutcomesForContext(ctx, res);
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_PARENT_OUTCOMES") {
      return forbidden(res, "Parent access is required");
    }
    throw error;
  }
}

export async function parentOutcomesCreateRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await parseBody(req, createBodySchema, res);
    if (!body) return;
    const ctx = await outcomeRouteDeps.resolveRequestContext(req);
    requireParentRole(ctx.authenticatedRoleType);
    return await createOutcomeFromContext(ctx, body, res);
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_PARENT_OUTCOMES") {
      return forbidden(res, "Parent access is required");
    }
    if (error?.message === "OUTCOME_JOB_TARGET_NOT_FOUND") {
      return badRequest(res, "The selected target role does not belong to the authorized student");
    }
    throw error;
  }
}

export async function parentOutcomesUpdateRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await parseBody(req, updateBodySchema, res);
    if (!body) return;
    const ctx = await outcomeRouteDeps.resolveRequestContext(req);
    requireParentRole(ctx.authenticatedRoleType);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated parent");
    }
    if (!validateStatus(body.outcomeType, body.status, res)) {
      return;
    }
    const target = await resolveOutcomeTarget(ctx.studentProfileId, body);
    const updated = await outcomeRouteDeps.repo.updateForStudent(ctx.studentProfileId, body.studentOutcomeId, {
      jobTargetId: target.jobTargetId,
      targetRoleFamily: target.targetRoleFamily,
      targetSectorCluster: target.targetSectorCluster,
      outcomeType: body.outcomeType,
      status: body.status,
      employerName: body.employerName ?? null,
      roleTitle: body.roleTitle ?? null,
      actionDate: body.actionDate,
      actionDateLabel: body.actionDateLabel ?? inferOutcomeActionDateLabel(body.outcomeType),
      notes: body.notes ?? null,
      sourceType: inferOutcomeSourceType("parent"),
      reportedByRole: "parent",
      reportedByUserId: ctx.authenticatedUserId,
      verificationStatus: "parent_reported",
    });
    if (!updated) {
      return badRequest(res, "The selected outcome could not be updated for this student");
    }
    return json(res, 200, { ok: true, message: "Outcome updated" });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_PARENT_OUTCOMES") {
      return forbidden(res, "Parent access is required");
    }
    if (error?.message === "OUTCOME_JOB_TARGET_NOT_FOUND") {
      return badRequest(res, "The selected target role does not belong to the authorized student");
    }
    throw error;
  }
}

export async function parentOutcomesArchiveRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await parseBody(req, archiveBodySchema, res);
    if (!body) return;
    const ctx = await outcomeRouteDeps.resolveRequestContext(req);
    requireParentRole(ctx.authenticatedRoleType);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated parent");
    }
    const archived = await outcomeRouteDeps.repo.archiveForStudent(ctx.studentProfileId, body.studentOutcomeId);
    if (!archived) {
      return badRequest(res, "The selected outcome could not be archived for this student");
    }
    return json(res, 200, { ok: true, message: "Outcome archived" });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_PARENT_OUTCOMES") {
      return forbidden(res, "Parent access is required");
    }
    throw error;
  }
}

export async function parentOutcomesSummaryRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await outcomeRouteDeps.resolveRequestContext(req);
    requireParentRole(ctx.authenticatedRoleType);
    return await summaryForContext(ctx, res);
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_PARENT_OUTCOMES") {
      return forbidden(res, "Parent access is required");
    }
    throw error;
  }
}

export async function coachOutcomesListRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await outcomeRouteDeps.resolveRequestContext(req);
    requireCoachRole(ctx.authenticatedRoleType);
    return await listOutcomesForContext(ctx, res);
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_COACH_OUTCOMES") {
      return forbidden(res, "Coach access is required");
    }
    throw error;
  }
}

export async function coachOutcomesCreateRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await parseBody(req, createBodySchema, res);
    if (!body) return;
    const ctx = await outcomeRouteDeps.resolveRequestContext(req);
    requireCoachRole(ctx.authenticatedRoleType);
    return await createOutcomeFromContext(ctx, body, res);
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_COACH_OUTCOMES") {
      return forbidden(res, "Coach access is required");
    }
    if (error?.message === "OUTCOME_JOB_TARGET_NOT_FOUND") {
      return badRequest(res, "The selected target role does not belong to the authorized student");
    }
    throw error;
  }
}

export async function coachOutcomesReviewRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await parseBody(req, reviewBodySchema, res);
    if (!body) return;
    const ctx = await outcomeRouteDeps.resolveRequestContext(req);
    requireCoachRole(ctx.authenticatedRoleType);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated coach");
    }
    const reviewed = await outcomeRouteDeps.repo.markCoachReviewed(
      ctx.studentProfileId,
      body.studentOutcomeId
    );
    if (!reviewed) {
      return badRequest(res, "The selected outcome could not be marked as coach reviewed");
    }
    return json(res, 200, { ok: true, message: "Outcome marked as coach reviewed" });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_COACH_OUTCOMES") {
      return forbidden(res, "Coach access is required");
    }
    throw error;
  }
}

export async function coachOutcomesSummaryRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await outcomeRouteDeps.resolveRequestContext(req);
    requireCoachRole(ctx.authenticatedRoleType);
    return await summaryForContext(ctx, res);
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_COACH_OUTCOMES") {
      return forbidden(res, "Coach access is required");
    }
    throw error;
  }
}
