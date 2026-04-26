import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { resolveRequestContext } from "../services/auth/resolveRequestContext";
import { resolveCoachRelationshipOrThrow } from "../services/coach/workspace";
import { careerScenarioService, canEditCareerScenariosForRole } from "../services/career/careerScenarioService";
import { readJsonBody } from "../utils/body";
import { badRequest, forbidden, json, unauthorized } from "../utils/http";
import { AppError } from "../utils/appError";
import type { RequestContext } from "../services/auth/resolveRequestContext";

const upsertSchema = z.object({
  careerScenarioId: z.string().uuid().optional(),
  scenarioName: z.string().trim().min(1).max(180),
  isActive: z.boolean().optional(),
  jobDescriptionText: z.string().trim().max(50000).optional().nullable(),
  targetRole: z.string().trim().max(240).optional().nullable(),
  targetProfession: z.string().trim().max(240).optional().nullable(),
  targetIndustry: z.string().trim().max(240).optional().nullable(),
  targetSector: z.string().trim().max(240).optional().nullable(),
  targetGeography: z.string().trim().max(240).optional().nullable(),
  employerName: z.string().trim().max(240).optional().nullable(),
  jobPostingUrl: z.string().trim().url().optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),
  assumptions: z
    .object({
      skills: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
      credentials: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
      internships: z.array(z.string().trim().min(1).max(240)).max(20).optional(),
      projects: z.array(z.string().trim().min(1).max(240)).max(20).optional(),
      majorMinorConcentrationAssumptions: z.array(z.string().trim().min(1).max(240)).max(20).optional(),
      graduationTimeline: z.string().trim().max(120).optional().nullable(),
      preferredGeographies: z.array(z.string().trim().min(1).max(120)).max(12).optional(),
      notes: z.string().trim().max(5000).optional().nullable(),
    })
    .optional(),
  sourceType: z.enum(["pasted_job_description", "manual_target", "imported", "mixed"]).optional(),
});

const idSchema = z.object({
  careerScenarioId: z.string().uuid(),
});

const duplicateSchema = z.object({
  careerScenarioId: z.string().uuid(),
  newName: z.string().trim().min(1).max(180),
});

function formatZodError(error: z.ZodError) {
  return error.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`).join("; ") || "Invalid request body";
}

function getSearchParams(req: IncomingMessage) {
  return new URL(req.url || "/", "http://localhost").searchParams;
}

async function parseBody<T extends z.ZodTypeAny>(req: IncomingMessage, res: ServerResponse, schema: T): Promise<z.infer<T> | null> {
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

async function resolveStudentScopeForRole(args: {
  req: IncomingMessage;
  res: ServerResponse;
  requestedStudentProfileId?: string | null;
  requireEdit?: boolean;
}): Promise<{ ctx: RequestContext; studentProfileId: string } | null> {
  const ctx = await resolveRequestContext(args.req);

  if (ctx.authenticatedRoleType === "student" || ctx.authenticatedRoleType === "parent") {
    if (!ctx.studentProfileId) {
      badRequest(args.res, "No student profile could be resolved for the authenticated user");
      return null;
    }
    if (args.requireEdit && !canEditCareerScenariosForRole(ctx.authenticatedRoleType)) {
      forbidden(args.res, "This role can view career scenarios but cannot edit them.");
      return null;
    }
    return { ctx, studentProfileId: ctx.studentProfileId };
  }

  if (ctx.authenticatedRoleType === "coach") {
    if (!args.requestedStudentProfileId) {
      badRequest(args.res, "A studentProfileId is required for coach scenario access");
      return null;
    }
    const relationship = await resolveCoachRelationshipOrThrow(ctx, args.requestedStudentProfileId);
    if (!relationship) {
      forbidden(args.res, "Coach access is limited to assigned students");
      return null;
    }
    if (args.requireEdit && !relationship.permissions.createRecommendations) {
      forbidden(args.res, "Coach edit access is not enabled for this student");
      return null;
    }
    return { ctx, studentProfileId: relationship.studentProfileId };
  }

  if (ctx.authenticatedRoleType === "admin") {
    const requested = args.requestedStudentProfileId || ctx.studentProfileId;
    if (!requested) {
      badRequest(args.res, "A studentProfileId is required for admin scenario access");
      return null;
    }
    return { ctx, studentProfileId: requested };
  }

  forbidden(args.res, "Scenario access is not available for this role");
  return null;
}

async function handleList(req: IncomingMessage, res: ServerResponse, requestedStudentProfileId?: string | null) {
  const scope = await resolveStudentScopeForRole({ req, res, requestedStudentProfileId, requireEdit: false });
  if (!scope) return;
  const scenarios = await careerScenarioService.listScenarios(scope.studentProfileId, scope.ctx.authenticatedUserId);
  return json(res, 200, { ok: true, count: scenarios.length, scenarios });
}

async function handleActive(req: IncomingMessage, res: ServerResponse, requestedStudentProfileId?: string | null) {
  const scope = await resolveStudentScopeForRole({ req, res, requestedStudentProfileId, requireEdit: false });
  if (!scope) return;
  const activeScenario = await careerScenarioService.getActiveScenarioForDashboard(
    scope.studentProfileId,
    scope.ctx.authenticatedUserId
  );
  return json(res, 200, { ok: true, activeScenario });
}

async function handleGet(req: IncomingMessage, res: ServerResponse, requestedStudentProfileId?: string | null) {
  const scope = await resolveStudentScopeForRole({ req, res, requestedStudentProfileId, requireEdit: false });
  if (!scope) return;
  const params = getSearchParams(req);
  const careerScenarioId = params.get("careerScenarioId");
  if (!careerScenarioId) {
    return badRequest(res, "careerScenarioId is required");
  }
  const scenario = await careerScenarioService.getScenario(
    scope.studentProfileId,
    careerScenarioId,
    scope.ctx.authenticatedUserId
  );
  if (!scenario) {
    return badRequest(res, "The selected career scenario was not found for this student");
  }
  return json(res, 200, { ok: true, scenario });
}

async function handleCreate(req: IncomingMessage, res: ServerResponse, requestedStudentProfileId?: string | null) {
  const scope = await resolveStudentScopeForRole({ req, res, requestedStudentProfileId, requireEdit: true });
  if (!scope) return;
  const body = await parseBody(req, res, upsertSchema);
  if (!body) return;
  const scenario = await careerScenarioService.createScenario(scope.studentProfileId, body, scope.ctx.authenticatedUserId);
  return json(res, 200, { ok: true, scenario, message: "Career scenario saved" });
}

async function handleUpdate(req: IncomingMessage, res: ServerResponse, requestedStudentProfileId?: string | null) {
  const scope = await resolveStudentScopeForRole({ req, res, requestedStudentProfileId, requireEdit: true });
  if (!scope) return;
  const body = await parseBody(req, res, upsertSchema.extend({ careerScenarioId: z.string().uuid() }));
  if (!body) return;
  const scenario = await careerScenarioService.updateScenario(
    scope.studentProfileId,
    body.careerScenarioId,
    body,
    scope.ctx.authenticatedUserId
  );
  return json(res, 200, { ok: true, scenario, message: "Career scenario updated" });
}

async function handleDuplicate(req: IncomingMessage, res: ServerResponse, requestedStudentProfileId?: string | null) {
  const scope = await resolveStudentScopeForRole({ req, res, requestedStudentProfileId, requireEdit: true });
  if (!scope) return;
  const body = await parseBody(req, res, duplicateSchema);
  if (!body) return;
  const scenario = await careerScenarioService.duplicateScenario(
    scope.studentProfileId,
    body.careerScenarioId,
    body.newName,
    scope.ctx.authenticatedUserId
  );
  return json(res, 200, { ok: true, scenario, message: "Career scenario duplicated" });
}

async function handleDelete(req: IncomingMessage, res: ServerResponse, requestedStudentProfileId?: string | null) {
  const scope = await resolveStudentScopeForRole({ req, res, requestedStudentProfileId, requireEdit: true });
  if (!scope) return;
  const body = await parseBody(req, res, idSchema);
  if (!body) return;
  await careerScenarioService.deleteScenario(scope.studentProfileId, body.careerScenarioId, scope.ctx.authenticatedUserId);
  return json(res, 200, { ok: true, message: "Career scenario deleted" });
}

async function handleSetActive(req: IncomingMessage, res: ServerResponse, requestedStudentProfileId?: string | null) {
  const scope = await resolveStudentScopeForRole({ req, res, requestedStudentProfileId, requireEdit: true });
  if (!scope) return;
  const body = await parseBody(req, res, idSchema);
  if (!body) return;
  const scenario = await careerScenarioService.setActiveScenario(
    scope.studentProfileId,
    body.careerScenarioId,
    scope.ctx.authenticatedUserId
  );
  return json(res, 200, { ok: true, scenario, message: "Active career scenario updated" });
}

async function handleAnalyze(req: IncomingMessage, res: ServerResponse, requestedStudentProfileId?: string | null) {
  const scope = await resolveStudentScopeForRole({ req, res, requestedStudentProfileId, requireEdit: true });
  if (!scope) return;
  const body = await parseBody(req, res, idSchema);
  if (!body) return;
  const scenario = await careerScenarioService.analyzeScenario(
    scope.studentProfileId,
    body.careerScenarioId,
    scope.ctx.authenticatedUserId
  );
  return json(res, 200, { ok: true, scenario, message: "Career scenario analysis refreshed" });
}

async function withCareerErrors(res: ServerResponse, handler: () => Promise<void>) {
  try {
    await handler();
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error instanceof AppError) return json(res, error.status, { error: error.code, message: error.message, details: error.details });
    throw error;
  }
}

export async function studentCareerScenarioListRoute(req: IncomingMessage, res: ServerResponse) {
  return withCareerErrors(res, () => handleList(req, res));
}

export async function studentCareerScenarioActiveRoute(req: IncomingMessage, res: ServerResponse) {
  return withCareerErrors(res, () => handleActive(req, res));
}

export async function studentCareerScenarioGetRoute(req: IncomingMessage, res: ServerResponse) {
  return withCareerErrors(res, () => handleGet(req, res));
}

export async function studentCareerScenarioCreateRoute(req: IncomingMessage, res: ServerResponse) {
  return withCareerErrors(res, () => handleCreate(req, res));
}

export async function studentCareerScenarioUpdateRoute(req: IncomingMessage, res: ServerResponse) {
  return withCareerErrors(res, () => handleUpdate(req, res));
}

export async function studentCareerScenarioDuplicateRoute(req: IncomingMessage, res: ServerResponse) {
  return withCareerErrors(res, () => handleDuplicate(req, res));
}

export async function studentCareerScenarioDeleteRoute(req: IncomingMessage, res: ServerResponse) {
  return withCareerErrors(res, () => handleDelete(req, res));
}

export async function studentCareerScenarioSetActiveRoute(req: IncomingMessage, res: ServerResponse) {
  return withCareerErrors(res, () => handleSetActive(req, res));
}

export async function studentCareerScenarioAnalyzeRoute(req: IncomingMessage, res: ServerResponse) {
  return withCareerErrors(res, () => handleAnalyze(req, res));
}

export async function parentCareerScenarioListRoute(req: IncomingMessage, res: ServerResponse) {
  return withCareerErrors(res, () => handleList(req, res));
}

export async function parentCareerScenarioActiveRoute(req: IncomingMessage, res: ServerResponse) {
  return withCareerErrors(res, () => handleActive(req, res));
}

export async function parentCareerScenarioGetRoute(req: IncomingMessage, res: ServerResponse) {
  return withCareerErrors(res, () => handleGet(req, res));
}

export async function coachCareerScenarioListRoute(req: IncomingMessage, res: ServerResponse) {
  const studentProfileId = getSearchParams(req).get("studentProfileId");
  return withCareerErrors(res, () => handleList(req, res, studentProfileId));
}

export async function coachCareerScenarioActiveRoute(req: IncomingMessage, res: ServerResponse) {
  const studentProfileId = getSearchParams(req).get("studentProfileId");
  return withCareerErrors(res, () => handleActive(req, res, studentProfileId));
}

export async function coachCareerScenarioGetRoute(req: IncomingMessage, res: ServerResponse) {
  const studentProfileId = getSearchParams(req).get("studentProfileId");
  return withCareerErrors(res, () => handleGet(req, res, studentProfileId));
}

export async function coachCareerScenarioCreateRoute(req: IncomingMessage, res: ServerResponse) {
  const body = await parseBody(req, res, upsertSchema.extend({ studentProfileId: z.string().uuid() }));
  if (!body) return;
  return withCareerErrors(res, async () => {
    const scope = await resolveStudentScopeForRole({ req, res, requestedStudentProfileId: body.studentProfileId, requireEdit: true });
    if (!scope) return;
    const scenario = await careerScenarioService.createScenario(scope.studentProfileId, body, scope.ctx.authenticatedUserId);
    return json(res, 200, { ok: true, scenario, message: "Career scenario saved" });
  });
}

export async function coachCareerScenarioUpdateRoute(req: IncomingMessage, res: ServerResponse) {
  const body = await parseBody(req, res, upsertSchema.extend({ careerScenarioId: z.string().uuid(), studentProfileId: z.string().uuid() }));
  if (!body) return;
  return withCareerErrors(res, async () => {
    const scope = await resolveStudentScopeForRole({ req, res, requestedStudentProfileId: body.studentProfileId, requireEdit: true });
    if (!scope) return;
    const scenario = await careerScenarioService.updateScenario(scope.studentProfileId, body.careerScenarioId, body, scope.ctx.authenticatedUserId);
    return json(res, 200, { ok: true, scenario, message: "Career scenario updated" });
  });
}

export async function coachCareerScenarioDuplicateRoute(req: IncomingMessage, res: ServerResponse) {
  const body = await parseBody(req, res, duplicateSchema.extend({ studentProfileId: z.string().uuid() }));
  if (!body) return;
  return withCareerErrors(res, async () => {
    const scope = await resolveStudentScopeForRole({ req, res, requestedStudentProfileId: body.studentProfileId, requireEdit: true });
    if (!scope) return;
    const scenario = await careerScenarioService.duplicateScenario(scope.studentProfileId, body.careerScenarioId, body.newName, scope.ctx.authenticatedUserId);
    return json(res, 200, { ok: true, scenario, message: "Career scenario duplicated" });
  });
}

export async function coachCareerScenarioDeleteRoute(req: IncomingMessage, res: ServerResponse) {
  const body = await parseBody(req, res, idSchema.extend({ studentProfileId: z.string().uuid() }));
  if (!body) return;
  return withCareerErrors(res, async () => {
    const scope = await resolveStudentScopeForRole({ req, res, requestedStudentProfileId: body.studentProfileId, requireEdit: true });
    if (!scope) return;
    await careerScenarioService.deleteScenario(scope.studentProfileId, body.careerScenarioId, scope.ctx.authenticatedUserId);
    return json(res, 200, { ok: true, message: "Career scenario deleted" });
  });
}

export async function coachCareerScenarioSetActiveRoute(req: IncomingMessage, res: ServerResponse) {
  const body = await parseBody(req, res, idSchema.extend({ studentProfileId: z.string().uuid() }));
  if (!body) return;
  return withCareerErrors(res, async () => {
    const scope = await resolveStudentScopeForRole({ req, res, requestedStudentProfileId: body.studentProfileId, requireEdit: true });
    if (!scope) return;
    const scenario = await careerScenarioService.setActiveScenario(scope.studentProfileId, body.careerScenarioId, scope.ctx.authenticatedUserId);
    return json(res, 200, { ok: true, scenario, message: "Active career scenario updated" });
  });
}

export async function coachCareerScenarioAnalyzeRoute(req: IncomingMessage, res: ServerResponse) {
  const body = await parseBody(req, res, idSchema.extend({ studentProfileId: z.string().uuid() }));
  if (!body) return;
  return withCareerErrors(res, async () => {
    const scope = await resolveStudentScopeForRole({ req, res, requestedStudentProfileId: body.studentProfileId, requireEdit: true });
    if (!scope) return;
    const scenario = await careerScenarioService.analyzeScenario(scope.studentProfileId, body.careerScenarioId, scope.ctx.authenticatedUserId);
    return json(res, 200, { ok: true, scenario, message: "Career scenario analysis refreshed" });
  });
}
