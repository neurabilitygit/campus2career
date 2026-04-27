import crypto from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { withTransaction } from "../db/client";
import { resolveRequestContext } from "../services/auth/resolveRequestContext";
import { readJsonBody } from "../utils/body";
import { badRequest, json, unauthorized } from "../utils/http";
import { StudentWriteRepository } from "../repositories/student/studentWriteRepository";
import { OnboardingRepository } from "../repositories/student/onboardingRepository";
import { StudentReadRepository } from "../repositories/student/studentReadRepository";
import { ArtifactRepository } from "../repositories/student/artifactRepository";
import { createSignedUploadTarget, verifyStorageObjectExists } from "../services/storage/supabaseStorage";
import { persistArtifactAndQueueParse } from "../services/student/artifactIntake";
import { careerScenarioService } from "../services/career/careerScenarioService";
import { runScoring } from "../services/scoring";
import { finalizeOnboardingAndDiagnostic } from "../services/student/diagnosticService";
import { buildStudentScoringInput } from "../services/student/aggregateStudentContext";
import { syncPrimaryJobTargetFromStudentIntent } from "../services/career/primaryJobTargetSync";

const repo = new StudentWriteRepository();
const onboardingRepo = new OnboardingRepository();
const studentReadRepo = new StudentReadRepository();
const artifactRepo = new ArtifactRepository();
export const studentWriteRouteDeps = {
  artifactRepo,
  onboardingRepo,
  repo,
  resolveRequestContext,
  verifyStorageObjectExists,
  persistArtifactAndQueueParse,
  withTransaction,
};
const allowedArtifactTypes = [
  "resume",
  "transcript",
  "other",
  "project",
  "portfolio",
  "presentation",
  "certification",
] as const;
const allowedSectorClusters = [
  "Technology & Startups",
  "Fintech",
  "Management Consulting",
  "Finance & Financial Services",
  "Accounting, Audit & Risk",
  "Data & Analytics",
  "Cybersecurity",
  "Marketing & Growth",
  "Actuarial & Risk Analytics",
  "Law & Public Policy",
  "Healthcare",
  "Medicine & Clinical Care",
  "Nursing & Advanced Practice",
  "Pharmacy & Drug Development",
  "Allied Health & Rehabilitation",
  "Pharmaceutical, Biotech & Clinical Research",
  "Operations & Strategy",
] as const;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const uploadTargetTtlMinutes = Math.max(
  15,
  Number(process.env.UPLOAD_TARGET_TTL_MINUTES || 360) || 360
);

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

function requiredTrimmedString(maxLength: number) {
  return z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    z.string().min(1).max(maxLength)
  );
}

const optionalIsoDateSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed || undefined;
  },
  z.string().regex(isoDatePattern, "Expected YYYY-MM-DD date").optional()
);

const studentProfileBodySchema = z.object({
  schoolName: requiredTrimmedString(160),
  expectedGraduationDate: optionalIsoDateSchema,
  majorPrimary: requiredTrimmedString(160),
  majorSecondary: optionalTrimmedString(160),
  preferredGeographies: z.array(requiredTrimmedString(120)).max(10).optional().default([]),
  careerGoalSummary: optionalTrimmedString(2000),
  academicNotes: optionalTrimmedString(4000),
});

const sectorSelectionBodySchema = z.object({
  sectorClusters: z.array(z.enum(allowedSectorClusters)).max(6),
});

const networkBaselineBodySchema = z.object({
  notes: optionalTrimmedString(12000),
});

const deadlineCreateBodySchema = z.object({
  title: requiredTrimmedString(200),
  dueDate: z.string().trim().regex(isoDatePattern, "dueDate must be YYYY-MM-DD"),
  deadlineType: requiredTrimmedString(80),
  notes: optionalTrimmedString(1000),
});

const uploadPresignBodySchema = z.object({
  artifactType: z.enum(allowedArtifactTypes),
  fileName: requiredTrimmedString(240),
  contentType: requiredTrimmedString(160),
});

const uploadCompleteBodySchema = z.object({
  artifactType: z.enum(allowedArtifactTypes),
  objectPath: requiredTrimmedString(512),
});

function formatZodErrorMessage(error: z.ZodError): string {
  return (
    error.issues
      .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
      .join("; ") || "Invalid request body"
  );
}

function stableId(namespace: string, key: string): string {
  return crypto.createHash("sha256").update(`${namespace}:${key}`).digest("hex").slice(0, 32);
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
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
  const allowedArtifactTypesSet = new Set(allowedArtifactTypes);

  if (!allowedArtifactTypesSet.has(input.artifactType as (typeof allowedArtifactTypes)[number])) {
    throw new Error("INVALID_ARTIFACT_TYPE");
  }

  const expectedPrefix = `${input.studentProfileId}/${input.artifactType}/`;
  if (!input.objectPath.startsWith(expectedPrefix)) {
    throw new Error("INVALID_OBJECT_PATH");
  }
}

export function validateUploadSourceFile(input: {
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
    const ctx = await studentWriteRouteDeps.resolveRequestContext(req);
    if (ctx.authenticatedRoleType !== "student" && ctx.authenticatedRoleType !== "admin") {
      return unauthorized(res);
    }

    let raw: unknown;
    try {
      raw = await readJsonBody(req);
    } catch {
      return badRequest(res, "Invalid JSON body");
    }

    const parsed = studentProfileBodySchema.safeParse(raw);
    if (!parsed.success) {
      return badRequest(res, formatZodErrorMessage(parsed.error));
    }
    const body = parsed.data;

    const studentProfileId =
      ctx.studentProfileId || stableId("student_profile", ctx.authenticatedUserId);

    await studentWriteRouteDeps.withTransaction(async (tx) => {
      await studentWriteRouteDeps.repo.upsertStudentProfile(
        {
          studentProfileId,
          userId: ctx.studentUserId || ctx.authenticatedUserId,
          householdId: ctx.householdId,
          schoolName: normalizeOptionalText(body.schoolName),
          expectedGraduationDate: normalizeOptionalDate(body.expectedGraduationDate),
          majorPrimary: normalizeOptionalText(body.majorPrimary),
          majorSecondary: normalizeOptionalText(body.majorSecondary),
          preferredGeographies: body.preferredGeographies,
          careerGoalSummary: normalizeOptionalText(body.careerGoalSummary),
          academicNotes: normalizeOptionalText(body.academicNotes),
        },
        tx
      );

      await onboardingRepo.ensureState(studentProfileId, stableId("onboarding_state", studentProfileId), tx);
      await onboardingRepo.updateFlags(
        studentProfileId,
        {
          profile_completed: true,
        },
        tx
      );
    });
    await syncPrimaryJobTargetFromStudentIntent({
      studentProfileId,
      title: body.careerGoalSummary,
      location: body.preferredGeographies[0] || null,
      sourceType: "manual",
      allowOverwriteExistingPrimary: false,
    });
    await careerScenarioService.markStudentScenariosNeedsRerun(studentProfileId);

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
    const ctx = await studentWriteRouteDeps.resolveRequestContext(req);
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

    let raw: unknown;
    try {
      raw = await readJsonBody(req);
    } catch {
      return badRequest(res, "Invalid JSON body");
    }
    const parsed = sectorSelectionBodySchema.safeParse(raw);
    if (!parsed.success) {
      return badRequest(res, formatZodErrorMessage(parsed.error));
    }
    const selections = Array.from(new Set(parsed.data.sectorClusters));

    await ensureOnboardingState(ctx.studentProfileId);
    await onboardingRepo.replaceSectorSelections(ctx.studentProfileId, selections);
    await onboardingRepo.updateFlags(ctx.studentProfileId, {
      sectors_completed: selections.length > 0,
    });
    await careerScenarioService.markStudentScenariosNeedsRerun(ctx.studentProfileId);

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

    let raw: unknown;
    try {
      raw = await readJsonBody(req);
    } catch {
      return badRequest(res, "Invalid JSON body");
    }
    const parsed = networkBaselineBodySchema.safeParse(raw);
    if (!parsed.success) {
      return badRequest(res, formatZodErrorMessage(parsed.error));
    }

    const rawLines = (parsed.data.notes || "")
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

    let raw: unknown;
    try {
      raw = await readJsonBody(req);
    } catch {
      return badRequest(res, "Invalid JSON body");
    }
    const parsed = deadlineCreateBodySchema.safeParse(raw);
    if (!parsed.success) {
      return badRequest(res, formatZodErrorMessage(parsed.error));
    }
    const body = parsed.data;

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
    const ctx = await studentWriteRouteDeps.resolveRequestContext(req);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile resolved");
    }

    let raw: unknown;
    try {
      raw = await readJsonBody(req);
    } catch {
      return badRequest(res, "Invalid JSON body");
    }
    const parsed = uploadPresignBodySchema.safeParse(raw);
    if (!parsed.success) {
      return badRequest(res, formatZodErrorMessage(parsed.error));
    }
    const body = parsed.data;

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

    const bucket = process.env.SUPABASE_STORAGE_BUCKET || "rising-senior";
    const objectPath = `${ctx.studentProfileId}/${body.artifactType}/${Date.now()}-${body.fileName}`;

    const signedTarget = await createSignedUploadTarget({
      bucket,
      path: objectPath,
      upsert: false,
    });

    await studentWriteRouteDeps.artifactRepo.upsertUploadTarget({
      uploadTargetId: stableId("upload_target", `${ctx.studentProfileId}:${objectPath}`),
      studentProfileId: ctx.studentProfileId,
      artifactType: body.artifactType,
      bucket: signedTarget.bucket,
      objectPath: signedTarget.path,
      tokenHash: sha256(signedTarget.token),
      expiresAt: new Date(Date.now() + uploadTargetTtlMinutes * 60_000).toISOString(),
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
    const ctx = await studentWriteRouteDeps.resolveRequestContext(req);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile resolved");
    }

    let raw: unknown;
    try {
      raw = await readJsonBody(req);
    } catch {
      return badRequest(res, "Invalid JSON body");
    }
    const parsed = uploadCompleteBodySchema.safeParse(raw);
    if (!parsed.success) {
      return badRequest(res, formatZodErrorMessage(parsed.error));
    }
    const body = parsed.data;

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

    const uploadTarget = await studentWriteRouteDeps.artifactRepo.getUploadTargetByObjectPath(
      ctx.studentProfileId,
      body.objectPath
    );
    if (!uploadTarget) {
      return badRequest(
        res,
        "objectPath was not minted by the server presign endpoint for the authenticated student"
      );
    }
    if (uploadTarget.artifact_type !== body.artifactType) {
      return badRequest(res, "artifactType does not match the minted upload target");
    }

    const now = Date.now();
    const expiresAt = Date.parse(uploadTarget.expires_at);
    const alreadyConsumed = !!uploadTarget.consumed_at;
    if (!alreadyConsumed && Number.isFinite(expiresAt) && expiresAt < now) {
      return badRequest(
        res,
        "The upload target has expired. Request a fresh upload link and upload the file again."
      );
    }

    const objectExists = await studentWriteRouteDeps.verifyStorageObjectExists({
      bucket: uploadTarget.bucket,
      path: body.objectPath,
    });
    if (!objectExists) {
      return badRequest(
        res,
        "The uploaded file could not be found in storage yet. Finish the browser upload first, then try completion again."
      );
    }

    const result = await studentWriteRouteDeps.withTransaction(async (tx) => {
      const persisted = await studentWriteRouteDeps.persistArtifactAndQueueParse(
        {
          studentProfileId: ctx.studentProfileId!,
          artifactType: body.artifactType,
          objectPath: body.objectPath,
        },
        tx
      );
      await studentWriteRouteDeps.artifactRepo.markUploadTargetConsumed(uploadTarget.upload_target_id, tx);
      return persisted;
    });
    await careerScenarioService.markStudentScenariosNeedsRerun(ctx.studentProfileId);

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
