import crypto from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { resolveRequestContext } from "../services/auth/resolveRequestContext";
import { readJsonBody } from "../utils/body";
import { badRequest, json, unauthorized } from "../utils/http";
import { StudentWriteRepository } from "../repositories/student/studentWriteRepository";
import { OnboardingRepository } from "../repositories/student/onboardingRepository";
import { StudentReadRepository } from "../repositories/student/studentReadRepository";
import { createSignedUploadTarget } from "../services/storage/supabaseStorage";
import { persistArtifactAndQueueParse } from "../services/student/artifactIntake";
import { runScoring } from "../services/scoring";
import { finalizeOnboardingAndDiagnostic } from "../services/student/diagnosticService";
import { buildStudentScoringInput } from "../services/student/aggregateStudentContext";

const repo = new StudentWriteRepository();
const onboardingRepo = new OnboardingRepository();
const studentReadRepo = new StudentReadRepository();

function stableId(namespace: string, key: string): string {
  return crypto.createHash("sha256").update(`${namespace}:${key}`).digest("hex").slice(0, 32);
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeOptionalDate(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function ensureOnboardingState(studentProfileId: string) {
  const onboardingStateId = stableId("onboarding_state", studentProfileId);
  await onboardingRepo.ensureState(studentProfileId, onboardingStateId);
}

function validateArtifactUpload(input: {
  studentProfileId: string;
  artifactType: string;
  objectPath: string;
}) {
  const allowedArtifactTypes = new Set([
    "resume",
    "transcript",
    "other",
    "project",
    "portfolio",
    "presentation",
    "certification",
  ]);

  if (!allowedArtifactTypes.has(input.artifactType)) {
    throw new Error("INVALID_ARTIFACT_TYPE");
  }

  const expectedPrefix = `${input.studentProfileId}/${input.artifactType}/`;
  if (!input.objectPath.startsWith(expectedPrefix)) {
    throw new Error("INVALID_OBJECT_PATH");
  }
}

function validateUploadSourceFile(input: {
  artifactType: string;
  fileName: string;
  contentType: string;
}) {
  const normalizedFileName = input.fileName.trim().toLowerCase();
  const normalizedContentType = input.contentType.trim().toLowerCase();
  const extensionMatch = normalizedFileName.match(/\.([a-z0-9]+)$/);
  const extension = extensionMatch?.[1] || "";

  const allowedByArtifactType: Record<string, { extensions: string[]; contentTypes: string[] }> = {
    resume: {
      extensions: ["pdf", "txt", "md", "doc", "docx"],
      contentTypes: [
        "application/pdf",
        "text/plain",
        "text/markdown",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/octet-stream",
      ],
    },
    transcript: {
      extensions: ["pdf", "txt", "csv", "json"],
      contentTypes: [
        "application/pdf",
        "text/plain",
        "text/csv",
        "application/json",
        "application/octet-stream",
      ],
    },
    other: {
      extensions: ["pdf", "txt", "md", "csv", "json", "doc", "docx", "ppt", "pptx"],
      contentTypes: [
        "application/pdf",
        "text/plain",
        "text/markdown",
        "text/csv",
        "application/json",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/octet-stream",
      ],
    },
    project: {
      extensions: ["pdf", "txt", "md", "csv", "json", "zip"],
      contentTypes: [
        "application/pdf",
        "text/plain",
        "text/markdown",
        "text/csv",
        "application/json",
        "application/zip",
        "application/octet-stream",
      ],
    },
    portfolio: {
      extensions: ["pdf", "txt", "md"],
      contentTypes: [
        "application/pdf",
        "text/plain",
        "text/markdown",
        "application/octet-stream",
      ],
    },
    presentation: {
      extensions: ["pdf", "ppt", "pptx"],
      contentTypes: [
        "application/pdf",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/octet-stream",
      ],
    },
    certification: {
      extensions: ["pdf", "png", "jpg", "jpeg"],
      contentTypes: [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "application/octet-stream",
      ],
    },
  };

  const allowed = allowedByArtifactType[input.artifactType];
  if (!allowed) {
    throw new Error("INVALID_ARTIFACT_TYPE");
  }

  if (!extension || !allowed.extensions.includes(extension)) {
    throw new Error("INVALID_FILE_EXTENSION");
  }

  if (!allowed.contentTypes.includes(normalizedContentType)) {
    throw new Error("INVALID_CONTENT_TYPE");
  }
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
      schoolName: normalizeOptionalText(body.schoolName),
      expectedGraduationDate: normalizeOptionalDate(body.expectedGraduationDate),
      majorPrimary: normalizeOptionalText(body.majorPrimary),
      majorSecondary: normalizeOptionalText(body.majorSecondary),
      preferredGeographies: Array.isArray(body.preferredGeographies)
        ? body.preferredGeographies.map((item) => item.trim()).filter(Boolean)
        : [],
      careerGoalSummary: normalizeOptionalText(body.careerGoalSummary),
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
    if (typeof error?.message === "string" && error.message.includes("The related resource does not exist")) {
      return badRequest(
        res,
        "Supabase storage bucket is missing or misconfigured. Create the configured bucket before uploading files."
      );
    }
    throw error;
  }
}

export async function studentProfileReadRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await resolveRequestContext(req);
    if (ctx.authenticatedRoleType !== "student" && ctx.authenticatedRoleType !== "admin") {
      return unauthorized(res);
    }

    const studentProfileId =
      ctx.studentProfileId || stableId("student_profile", ctx.authenticatedUserId);

    const profile = await studentReadRepo.getStudentProfile(studentProfileId);

    return json(res, 200, {
      ok: true,
      studentProfileId,
      profile,
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

    try {
      validateUploadSourceFile({
        artifactType: body.artifactType,
        fileName: body.fileName,
        contentType: body.contentType,
      });
    } catch (error: any) {
      if (error?.message === "INVALID_ARTIFACT_TYPE") {
        return badRequest(res, "Unsupported artifactType");
      }
      if (error?.message === "INVALID_FILE_EXTENSION") {
        return badRequest(res, "Unsupported file extension for this artifact type");
      }
      if (error?.message === "INVALID_CONTENT_TYPE") {
        return badRequest(res, "Unsupported contentType for this artifact type");
      }
      throw error;
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

    try {
      validateArtifactUpload({
        studentProfileId: ctx.studentProfileId,
        artifactType: body.artifactType,
        objectPath: body.objectPath,
      });
    } catch (error: any) {
      if (error?.message === "INVALID_ARTIFACT_TYPE") {
        return badRequest(res, "Unsupported artifactType");
      }
      if (error?.message === "INVALID_OBJECT_PATH") {
        return badRequest(res, "objectPath must match the authenticated student's upload target");
      }
      throw error;
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
