import crypto from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { JobTargetRepository } from "../repositories/career/jobTargetRepository";
import { resolveRequestContext } from "../services/auth/resolveRequestContext";
import { normalizeJobTarget } from "../services/llm/jobNormalization";
import { readJsonBody } from "../utils/body";
import { badRequest, json, unauthorized } from "../utils/http";

const repo = new JobTargetRepository();

const createJobTargetBodySchema = z.object({
  title: z.string().trim().min(1).max(240),
  employer: z.string().trim().max(240).optional(),
  location: z.string().trim().max(240).optional(),
  sourceType: z.enum(["manual", "job_posting", "partner_feed"]).optional(),
  sourceUrl: z.string().trim().url().optional(),
  jobDescriptionText: z.string().trim().min(1).max(50000).optional(),
  isPrimary: z.boolean().optional(),
});

const setPrimaryBodySchema = z.object({
  jobTargetId: z.string().uuid(),
});

function normalizeOptionalText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function newJobTargetId(): string {
  return crypto.randomUUID();
}

export async function studentJobTargetsListRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await resolveRequestContext(req);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated user");
    }

    const jobTargets = await repo.listForStudent(ctx.studentProfileId);
    return json(res, 200, {
      ok: true,
      count: jobTargets.length,
      jobTargets,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    throw error;
  }
}

export async function studentJobTargetCreateRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    let raw: unknown;
    try {
      raw = await readJsonBody(req);
    } catch {
      return badRequest(res, "Invalid JSON body");
    }

    const parsed = createJobTargetBodySchema.safeParse(raw);
    if (!parsed.success) {
      const message =
        parsed.error.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`).join("; ") ||
        "Invalid request body";
      return badRequest(res, message);
    }

    const ctx = await resolveRequestContext(req);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated user");
    }

    const existingPrimary = await repo.getPrimaryForStudent(ctx.studentProfileId);
    const isPrimary = parsed.data.isPrimary ?? !existingPrimary;
    const sourceType =
      parsed.data.sourceType ??
      (parsed.data.sourceUrl || parsed.data.jobDescriptionText ? "job_posting" : "manual");

    const normalized = await normalizeJobTarget({
      title: parsed.data.title,
      employer: parsed.data.employer,
      location: parsed.data.location,
      sourceUrl: parsed.data.sourceUrl,
      jobDescriptionText: parsed.data.jobDescriptionText,
    });

    const jobTargetId = newJobTargetId();
    await repo.create({
      jobTargetId,
      studentProfileId: ctx.studentProfileId,
      title: parsed.data.title.trim(),
      employer: normalizeOptionalText(parsed.data.employer),
      location: normalizeOptionalText(parsed.data.location),
      sourceType,
      sourceUrl: normalizeOptionalText(parsed.data.sourceUrl),
      jobDescriptionText: normalizeOptionalText(parsed.data.jobDescriptionText),
      normalizedRoleFamily: normalized.normalizedRoleFamily ?? null,
      normalizedSectorCluster: normalized.normalizedSectorCluster ?? null,
      onetCode: normalized.onetCode ?? null,
      normalizationConfidence: normalized.normalizationConfidence ?? null,
      normalizationConfidenceLabel: normalized.confidenceLabel ?? null,
      normalizationReasoning: normalized.normalizationReasoning ?? null,
      normalizationSource: normalized.source,
      normalizationTruthStatus: normalized.truthStatus,
      isPrimary,
    });

    return json(res, 200, {
      ok: true,
      jobTargetId,
      isPrimary,
      normalized,
      message: "Job target saved",
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    throw error;
  }
}

export async function studentJobTargetSetPrimaryRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    let raw: unknown;
    try {
      raw = await readJsonBody(req);
    } catch {
      return badRequest(res, "Invalid JSON body");
    }

    const parsed = setPrimaryBodySchema.safeParse(raw);
    if (!parsed.success) {
      const message =
        parsed.error.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`).join("; ") ||
        "Invalid request body";
      return badRequest(res, message);
    }

    const ctx = await resolveRequestContext(req);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated user");
    }

    const success = await repo.setPrimary(ctx.studentProfileId, parsed.data.jobTargetId);
    if (!success) {
      return badRequest(res, "The selected job target does not belong to the authenticated student");
    }

    const primary = await repo.getPrimaryForStudent(ctx.studentProfileId);

    return json(res, 200, {
      ok: true,
      primary,
      message: "Primary job target updated",
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    throw error;
  }
}
