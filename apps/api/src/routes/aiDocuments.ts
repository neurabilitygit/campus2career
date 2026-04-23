import type { IncomingMessage, ServerResponse } from "node:http";
import { AiDocumentRepository } from "../repositories/llm/aiDocumentRepository";
import { resolveRequestContext } from "../services/auth/resolveRequestContext";
import { badRequest, json, unauthorized } from "../utils/http";

const repo = new AiDocumentRepository();

export async function studentAiDocumentsRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await resolveRequestContext(req);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated user");
    }

    const requestUrl = new URL(req.url || "/", "http://localhost");
    const documentType = requestUrl.searchParams.get("documentType") || undefined;
    const limitValue = requestUrl.searchParams.get("limit");
    const parsedLimit = limitValue ? Number(limitValue) : undefined;

    if (limitValue && (parsedLimit == null || !Number.isFinite(parsedLimit) || parsedLimit <= 0)) {
      return badRequest(res, "limit must be a positive number");
    }

    const documents = await repo.listForStudent({
      studentProfileId: ctx.studentProfileId,
      documentType,
      limit: parsedLimit,
    });

    return json(res, 200, {
      ok: true,
      count: documents.length,
      documents,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    throw error;
  }
}
