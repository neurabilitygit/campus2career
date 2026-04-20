import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { badRequest, forbidden, json, unauthorized } from "../utils/http";
import { resolveRequestContext } from "../services/auth/resolveRequestContext";
import {
  getInstitutionDirectoryOptions,
  searchInstitutionDirectory,
} from "../services/academic/institutionDirectoryService";
import { CatalogRepository } from "../repositories/academic/catalogRepository";
import { readJsonBody } from "../utils/body";
import { upsertInstitution } from "../services/academic/catalogService";

const catalogRepo = new CatalogRepository();

const institutionDirectoryBulkUpsertSchema = z.object({
  institutions: z.array(
    z.object({
      canonicalName: z.string().trim().min(1),
      displayName: z.string().trim().min(1),
      countryCode: z.string().trim().max(8).optional(),
      stateRegion: z.string().trim().max(128).optional(),
      city: z.string().trim().max(128).optional(),
      websiteUrl: z.string().trim().url().optional(),
    })
  ).min(1),
});

function getSearchParams(req: IncomingMessage) {
  const requestUrl = new URL(req.url || "/", "http://localhost");
  return requestUrl.searchParams;
}

export async function institutionDirectorySearchRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    await resolveRequestContext(req);

    const params = getSearchParams(req);
    const query = params.get("q") || "";
    const limitValue = params.get("limit");
    const parsedLimit = limitValue ? Number(limitValue) : undefined;

    if (limitValue && (parsedLimit == null || !Number.isFinite(parsedLimit) || parsedLimit <= 0)) {
      return badRequest(res, "limit must be a positive number");
    }

    const institutions = await searchInstitutionDirectory({
      query,
      limit: parsedLimit,
    });

    return json(res, 200, {
      ok: true,
      query,
      count: institutions.length,
      institutions,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    throw error;
  }
}

export async function institutionDirectoryOptionsRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    await resolveRequestContext(req);

    const params = getSearchParams(req);
    const institutionCanonicalName = params.get("institutionCanonicalName") || undefined;
    const catalogLabel = params.get("catalogLabel") || undefined;
    const degreeType = params.get("degreeType") || undefined;
    const programName = params.get("programName") || undefined;
    const majorCanonicalName = params.get("majorCanonicalName") || undefined;

    if (!institutionCanonicalName) {
      return badRequest(res, "institutionCanonicalName is required");
    }

    const options = await getInstitutionDirectoryOptions({
      institutionCanonicalName,
      catalogLabel,
      degreeType,
      programName,
      majorCanonicalName,
    });

    return json(res, 200, {
      ok: true,
      ...options,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    if (typeof error?.message === "string" && error.message.includes("not found")) {
      return badRequest(res, error.message);
    }
    throw error;
  }
}

export async function studentCatalogAssignmentReadRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await resolveRequestContext(req);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated user");
    }

    const assignment = await catalogRepo.getPrimaryStudentCatalogContext(ctx.studentProfileId);

    return json(res, 200, {
      ok: true,
      assignment,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    throw error;
  }
}

export async function institutionDirectoryBulkUpsertRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await resolveRequestContext(req);
    if (ctx.authenticatedRoleType !== "admin" && ctx.authenticatedRoleType !== "coach") {
      return forbidden(res, "Admin or coach role required");
    }

    let raw: unknown;
    try {
      raw = await readJsonBody(req);
    } catch {
      return badRequest(res, "Invalid JSON body");
    }

    const parsed = institutionDirectoryBulkUpsertSchema.safeParse(raw);
    if (!parsed.success) {
      const message =
        parsed.error.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`).join("; ") ||
        "Invalid request body";
      return badRequest(res, message);
    }

    for (const institution of parsed.data.institutions) {
      await upsertInstitution({
        canonicalName: institution.canonicalName,
        displayName: institution.displayName,
        countryCode: institution.countryCode,
        stateRegion: institution.stateRegion,
        city: institution.city,
        websiteUrl: institution.websiteUrl,
      });
    }

    return json(res, 200, {
      ok: true,
      upsertedInstitutionCount: parsed.data.institutions.length,
      message: "Institution directory entries saved",
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    throw error;
  }
}
