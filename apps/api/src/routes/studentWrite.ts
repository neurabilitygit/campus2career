import crypto from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { resolveRequestContext } from "../services/auth/resolveRequestContext";
import { readJsonBody } from "../utils/body";
import { badRequest, json, unauthorized } from "../utils/http";
import { StudentWriteRepository } from "../repositories/student/studentWriteRepository";
import { OnboardingRepository } from "../repositories/student/onboardingRepository";
import { createSignedUploadTarget } from "../services/storage/supabaseStorage";
import { persistArtifactAndQueueParse } from "../services/student/artifactIntake";
import { runScoring } from "../services/scoring";
import { finalizeOnboardingAndDiagnostic } from "../services/student/diagnosticService";
import { buildStudentScoringInput } from "../services/student/aggregateStudentContext";

const repo = new StudentWriteRepository();
const onboardingRepo = new OnboardingRepository();

function stableId(namespace: string, key: string): string {
  return crypto.createHash("sha256").update(`${namespace}:${key}`).digest("hex").slice(0, 32);
}

async function ensureOnboardingState(studentProfileId: string) {
  const onboardingStateId = stableId("onboarding_state", studentProfileId);
  await onboardingRepo.ensureState(studentProfileId, onboardingStateId);
}

export async function studentProfileUpsertRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await resolveRequestContext(req);
    if (ctx.authenticatedRoleType !== "student" && ctx.authenticatedRoleType !== "admin") {
      return unauthorized(res);
    }

    const body = await readJsonBody<{
      schoolName?: string;
      expectedGraduationDate?: string;
      majorPrimary?: string;
      majorSecondary?: string;
      preferredGeographies?: string[];
      careerGoalSummary?: string;
    }>(req);

    const studentProfileId =
      ctx.studentProfileId || stableId("student_profile", ctx.authenticatedUserId);

    await repo.upsertStudentProfile({
      studentProfileId,
      userId: ctx.studentUserId || ctx.authenticatedUserId,
      householdId: ctx.householdId,
      schoolName: body.schoolName ?? null,
      expectedGraduationDate: body.expectedGraduationDate ?? null,
      majorPrimary: body.majorPrimary ?? null,
      majorSecondary: body.majorSecondary ?? null,
      preferredGeographies: body.preferredGeographies ?? [],
      careerGoalSummary: body.careerGoalSummary ?? null,
    });

    await ensureOnboardingState(studentProfileId);
    await onboardingRepo.updateFlags(studentProfileId, {
      profile_completed: true,
    });

    return json(res, 200, {
      ok: true,
      studentProfileId,
      message: "Student profile saved",
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    throw error;
  }
}

export async function sectorSelectionRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await resolveRequestContext(req);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile resolved");
    }

    const body = await readJsonBody<{ sectorClusters?: string[] }>(req);
    const selections = Array.isArray(body.sectorClusters) ? body.sectorClusters.filter(Boolean) : [];

    await ensureOnboardingState(ctx.studentProfileId);
    await onboardingRepo.replaceSectorSelections(ctx.studentProfileId, selections);
    await onboardingRepo.updateFlags(ctx.studentProfileId, {
      sectors_completed: selections.length > 0,
    });

    return json(res, 200, {
      ok: true,
      sectorClusters: selections,
      message: "Sector selections saved",
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    throw error;
  }
}

export async function networkBaselineRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await resolveRequestContext(req);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile resolved");
    }

    const body = await readJsonBody<{ notes?: string }>(req);
    const rawLines = (body.notes || "")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    const parsedContacts = Array.from(
      new Map(
        rawLines
          .map((line) => {
            const [name, ...rest] = line.split(" - ");
            const normalizedName = name.trim();
            if (!normalizedName) return null;

            return [
              normalizedName.toLowerCase(),
              {
                contactName: normalizedName,
                notes: rest.join(" - ").trim() || line,
              },
            ] as const;
          })
          .filter((entry): entry is readonly [string, { contactName: string; notes: string }] => entry !== null)
      ).values()
    );

    if (!parsedContacts.length) {
      return badRequest(res, "At least one network line is required");
    }

    for (const contact of parsedContacts) {
      await repo.createContact({
        contactId: stableId("contact", `${ctx.studentProfileId}:${contact.contactName.toLowerCase()}`),
        studentProfileId: ctx.studentProfileId,
        contactName: contact.contactName,
        relationshipType: "other",
        warmthLevel: "warm",
        notes: contact.notes,
      });
    }

    await ensureOnboardingState(ctx.studentProfileId);
    await onboardingRepo.updateFlags(ctx.studentProfileId, {
      network_completed: true,
    });

    return json(res, 200, { ok: true, importedContacts: parsedContacts.length });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    throw error;
  }
}

export async function deadlineCreateRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await resolveRequestContext(req);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile resolved");
    }

    const body = await readJsonBody<{
      title?: string;
      dueDate?: string;
      deadlineType?: string;
      notes?: string;
    }>(req);

    if (!body.title || !body.dueDate || !body.deadlineType) {
      return badRequest(res, "title, dueDate, and deadlineType are required");
    }

    const deadlineId = stableId("deadline", `${ctx.studentProfileId}:${body.title}:${body.dueDate}`);

    await repo.createDeadline({
      deadlineId,
      studentProfileId: ctx.studentProfileId,
      title: body.title,
      dueDate: body.dueDate,
      deadlineType: body.deadlineType,
      notes: body.notes ?? null,
    });

    await ensureOnboardingState(ctx.studentProfileId);
    await onboardingRepo.updateFlags(ctx.studentProfileId, {
      deadlines_completed: true,
    });

    return json(res, 201, {
      ok: true,
      deadlineId,
      message: "Deadline created",
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    throw error;
  }
}

export async function uploadPresignRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await resolveRequestContext(req);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile resolved");
    }

    const body = await readJsonBody<{
      artifactType?: string;
      fileName?: string;
      contentType?: string;
    }>(req);

    if (!body.artifactType || !body.fileName || !body.contentType) {
      return badRequest(res, "artifactType, fileName, and contentType are required");
    }

    const bucket = process.env.SUPABASE_STORAGE_BUCKET || "campus2career";
    const objectPath = `${ctx.studentProfileId}/${body.artifactType}/${Date.now()}-${body.fileName}`;

    const signedTarget = await createSignedUploadTarget({
      bucket,
      path: objectPath,
      upsert: false,
    });

    return json(res, 200, {
      ok: true,
      bucket: signedTarget.bucket,
      objectPath: signedTarget.path,
      token: signedTarget.token,
      contentType: body.contentType,
      note: "Use supabase.storage.from(bucket).uploadToSignedUrl(path, token, fileBody, { contentType }) from the browser."
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    throw error;
  }
}

export async function uploadCompleteRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await resolveRequestContext(req);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile resolved");
    }

    const body = await readJsonBody<{
      artifactType?: string;
      objectPath?: string;
    }>(req);

    if (!body.artifactType || !body.objectPath) {
      return badRequest(res, "artifactType and objectPath are required");
    }

    const result = await persistArtifactAndQueueParse({
      studentProfileId: ctx.studentProfileId,
      artifactType: body.artifactType,
      objectPath: body.objectPath,
    });

    return json(res, 200, {
      ok: true,
      ...result,
      message: "Artifact persisted and parse job queued",
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    throw error;
  }
}

export async function firstDiagnosticRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await resolveRequestContext(req);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile resolved");
    }

    const scoring = runScoring(await buildStudentScoringInput(ctx.studentProfileId));

    const diagnostic = await finalizeOnboardingAndDiagnostic({
      studentProfileId: ctx.studentProfileId,
      scoring,
    });

    return json(res, 200, {
      ok: true,
      diagnostic,
      scoring,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    throw error;
  }
}
