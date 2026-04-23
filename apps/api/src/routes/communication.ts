import crypto from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import type {
  CommunicationChannel,
  CommunicationMessageDraftRecord,
  ParentCommunicationEntryRecord,
  ParentCommunicationProfileRecord,
  StudentCommunicationPreferencesRecord,
} from "../../../../packages/shared/src/contracts/communication";
import { CommunicationRepository } from "../repositories/communication/communicationRepository";
import { resolveRequestContext } from "../services/auth/resolveRequestContext";
import { buildStudentScoringInput, aggregateStudentContext } from "../services/student/aggregateStudentContext";
import { runScoring } from "../services/scoring";
import { generateCommunicationTranslation } from "../services/communication/translator";
import { getCommunicationProvider } from "../services/communication/provider";
import {
  canAccessParentCommunication,
  canAccessStudentCommunication,
} from "../services/communication/access";
import { readJsonBody } from "../utils/body";
import { badRequest, forbidden, json, unauthorized } from "../utils/http";

const repo = new CommunicationRepository();

const communicationChannels = ["email", "sms", "whatsapp"] as const;
const parentCategories = [
  "career_concern",
  "academic_concern",
  "internship_job_search_concern",
  "financial_tuition_concern",
  "independence_life_skills_concern",
  "emotional_motivational_concern",
  "logistical_question",
  "other",
] as const;
const entryStatuses = [
  "draft",
  "saved_as_context",
  "ready_for_translation",
  "translated",
  "queued_for_delivery",
  "delivered",
  "student_responded",
  "archived",
] as const;
const urgencyLevels = ["low", "medium", "high", "urgent"] as const;
const deliveryIntents = ["context_only", "direct", "indirect", "delayed"] as const;
const preferredTones = ["gentle", "neutral", "direct", "encouraging", "question_led", "summary_first"] as const;
const preferredFrequencies = ["as_needed", "weekly", "biweekly", "monthly"] as const;
const timeOfDayOptions = ["morning", "afternoon", "evening", "late_night", "weekend", "variable"] as const;
const guidanceFormats = ["direct_instructions", "choices", "reminders", "questions", "summaries"] as const;
const parentSendPreferences = ["review_before_send", "send_direct_if_allowed"] as const;

function newId(): string {
  return crypto.randomUUID();
}

function requireParentLikeRole(role: string) {
  if (!canAccessParentCommunication(role)) {
    throw new Error("FORBIDDEN_PARENT");
  }
}

function requireStudentLikeRole(role: string) {
  if (!canAccessStudentCommunication(role)) {
    throw new Error("FORBIDDEN_STUDENT");
  }
}

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

const studentPreferencesSchema = z.object({
  preferredChannels: z.array(z.enum(communicationChannels)).max(3).default([]),
  dislikedChannels: z.array(z.enum(communicationChannels)).max(3).default([]),
  preferredTone: z.enum(preferredTones).optional(),
  sensitiveTopics: z.array(z.string().trim().min(1).max(120)).max(10).default([]),
  preferredFrequency: z.enum(preferredFrequencies).optional(),
  bestTimeOfDay: z.enum(timeOfDayOptions).optional(),
  preferredGuidanceFormats: z.array(z.enum(guidanceFormats)).max(5).default([]),
  identifyParentOrigin: z.boolean(),
  allowParentConcernRephrasing: z.boolean(),
  consentParentTranslatedMessages: z.boolean(),
  notes: optionalTrimmedString(2000),
});

const parentProfileSchema = z.object({
  mainWorries: optionalTrimmedString(2000),
  usualApproach: optionalTrimmedString(2000),
  whatDoesNotWork: optionalTrimmedString(2000),
  wantsToImprove: optionalTrimmedString(2000),
  sendPreference: z.enum(parentSendPreferences).optional(),
  preferredCommunicationStyle: optionalTrimmedString(200),
  consentAcknowledged: z.boolean(),
});

const parentEntrySchema = z.object({
  category: z.enum(parentCategories),
  status: z.enum(entryStatuses).optional(),
  urgency: z.enum(urgencyLevels),
  deliveryIntent: z.enum(deliveryIntents),
  factsStudentShouldKnow: optionalTrimmedString(4000),
  questionsParentWantsAnswered: optionalTrimmedString(4000),
  parentConcerns: optionalTrimmedString(4000),
  recurringCommunicationFailures: optionalTrimmedString(4000),
  defensiveTopics: optionalTrimmedString(2000),
  priorAttemptsThatDidNotWork: optionalTrimmedString(4000),
  preferredOutcome: optionalTrimmedString(2000),
  freeformContext: optionalTrimmedString(6000),
});

const entryStatusUpdateSchema = z.object({
  parentCommunicationEntryId: z.string().uuid(),
  status: z.enum(entryStatuses),
});

const translateSchema = z.object({
  parentCommunicationEntryId: z.string().uuid(),
  selectedChannel: z.enum(communicationChannels).optional(),
});

const saveDraftSchema = z.object({
  communicationStrategyId: z.string().uuid(),
  selectedChannel: z.enum(communicationChannels),
});

const sendDraftSchema = z.object({
  communicationMessageDraftId: z.string().uuid(),
});

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

function sanitizeDraftForStudent(draft: CommunicationMessageDraftRecord) {
  return {
    communicationMessageDraftId: draft.communicationMessageDraftId,
    selectedChannel: draft.selectedChannel,
    messageBody: draft.messageBody,
    deliveredAt: draft.deliveredAt || null,
    createdAt: draft.createdAt || null,
  };
}

export async function studentCommunicationPreferencesReadRoute(
  req: IncomingMessage,
  res: ServerResponse
) {
  try {
    const ctx = await resolveRequestContext(req);
    requireStudentLikeRole(ctx.authenticatedRoleType);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated user");
    }

    const preferences = await repo.getStudentPreferences(ctx.studentProfileId);
    return json(res, 200, { ok: true, preferences });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_STUDENT") return forbidden(res, "Student access is required");
    throw error;
  }
}

export async function studentCommunicationPreferencesUpsertRoute(
  req: IncomingMessage,
  res: ServerResponse
) {
  try {
    const body = await parseBody(req, studentPreferencesSchema, res);
    if (!body) return;

    const ctx = await resolveRequestContext(req);
    requireStudentLikeRole(ctx.authenticatedRoleType);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated user");
    }

    const record: StudentCommunicationPreferencesRecord = {
      studentProfileId: ctx.studentProfileId,
      preferredChannels: body.preferredChannels,
      dislikedChannels: body.dislikedChannels,
      preferredTone: body.preferredTone ?? null,
      sensitiveTopics: body.sensitiveTopics,
      preferredFrequency: body.preferredFrequency ?? null,
      bestTimeOfDay: body.bestTimeOfDay ?? null,
      preferredGuidanceFormats: body.preferredGuidanceFormats,
      identifyParentOrigin: body.identifyParentOrigin,
      allowParentConcernRephrasing: body.allowParentConcernRephrasing,
      consentParentTranslatedMessages: body.consentParentTranslatedMessages,
      notes: body.notes ?? null,
    };

    await repo.upsertStudentPreferences({
      preferenceId: newId(),
      studentProfileId: ctx.studentProfileId,
      record,
    });
    await repo.createAuditLog({
      communicationAuditLogId: newId(),
      studentProfileId: ctx.studentProfileId,
      householdId: ctx.householdId,
      actorUserId: ctx.authenticatedUserId,
      actorRole: ctx.authenticatedRoleType,
      eventType: "student_preferences_updated",
      eventSummary: "Student communication preferences updated",
      eventPayload: {
        preferredChannels: record.preferredChannels,
        consentParentTranslatedMessages: record.consentParentTranslatedMessages,
      },
    });

    return json(res, 200, { ok: true, message: "Communication preferences saved" });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_STUDENT") return forbidden(res, "Student access is required");
    throw error;
  }
}

export async function studentCommunicationMessagesRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await resolveRequestContext(req);
    requireStudentLikeRole(ctx.authenticatedRoleType);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated user");
    }

    const messages = await repo.listStudentReceivedMessages(ctx.studentProfileId);
    return json(res, 200, {
      ok: true,
      count: messages.length,
      messages: messages.map(sanitizeDraftForStudent),
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_STUDENT") return forbidden(res, "Student access is required");
    throw error;
  }
}

export async function parentCommunicationProfileReadRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await resolveRequestContext(req);
    requireParentLikeRole(ctx.authenticatedRoleType);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated parent");
    }

    const profile = await repo.getParentProfile(ctx.authenticatedUserId, ctx.studentProfileId);
    return json(res, 200, { ok: true, profile });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_PARENT") return forbidden(res, "Parent access is required");
    throw error;
  }
}

export async function parentCommunicationProfileUpsertRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await parseBody(req, parentProfileSchema, res);
    if (!body) return;

    const ctx = await resolveRequestContext(req);
    requireParentLikeRole(ctx.authenticatedRoleType);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated parent");
    }

    const record: ParentCommunicationProfileRecord = {
      parentUserId: ctx.authenticatedUserId,
      studentProfileId: ctx.studentProfileId,
      householdId: ctx.householdId,
      mainWorries: body.mainWorries ?? null,
      usualApproach: body.usualApproach ?? null,
      whatDoesNotWork: body.whatDoesNotWork ?? null,
      wantsToImprove: body.wantsToImprove ?? null,
      sendPreference: body.sendPreference ?? null,
      preferredCommunicationStyle: body.preferredCommunicationStyle ?? null,
      consentAcknowledged: body.consentAcknowledged,
    };

    await repo.upsertParentProfile({ profileId: newId(), record });
    await repo.createAuditLog({
      communicationAuditLogId: newId(),
      studentProfileId: ctx.studentProfileId,
      householdId: ctx.householdId,
      actorUserId: ctx.authenticatedUserId,
      actorRole: ctx.authenticatedRoleType,
      eventType: "parent_profile_updated",
      eventSummary: "Parent communication profile updated",
      eventPayload: {
        sendPreference: record.sendPreference,
        consentAcknowledged: record.consentAcknowledged,
      },
    });

    return json(res, 200, { ok: true, message: "Parent communication profile saved" });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_PARENT") return forbidden(res, "Parent access is required");
    throw error;
  }
}

export async function parentCommunicationEntriesListRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await resolveRequestContext(req);
    requireParentLikeRole(ctx.authenticatedRoleType);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated parent");
    }

    const entries = await repo.listEntries(ctx.authenticatedUserId, ctx.studentProfileId);
    return json(res, 200, { ok: true, count: entries.length, entries });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_PARENT") return forbidden(res, "Parent access is required");
    throw error;
  }
}

export async function parentCommunicationEntryCreateRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await parseBody(req, parentEntrySchema, res);
    if (!body) return;

    const ctx = await resolveRequestContext(req);
    requireParentLikeRole(ctx.authenticatedRoleType);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated parent");
    }

    const entry: ParentCommunicationEntryRecord = {
      parentCommunicationEntryId: newId(),
      parentUserId: ctx.authenticatedUserId,
      studentProfileId: ctx.studentProfileId,
      householdId: ctx.householdId,
      category: body.category,
      status: body.status ?? "draft",
      urgency: body.urgency,
      deliveryIntent: body.deliveryIntent,
      factsStudentShouldKnow: body.factsStudentShouldKnow ?? null,
      questionsParentWantsAnswered: body.questionsParentWantsAnswered ?? null,
      parentConcerns: body.parentConcerns ?? null,
      recurringCommunicationFailures: body.recurringCommunicationFailures ?? null,
      defensiveTopics: body.defensiveTopics ?? null,
      priorAttemptsThatDidNotWork: body.priorAttemptsThatDidNotWork ?? null,
      preferredOutcome: body.preferredOutcome ?? null,
      freeformContext: body.freeformContext ?? null,
    };

    await repo.createEntry(entry);
    await repo.createAuditLog({
      communicationAuditLogId: newId(),
      parentCommunicationEntryId: entry.parentCommunicationEntryId,
      studentProfileId: ctx.studentProfileId,
      householdId: ctx.householdId,
      actorUserId: ctx.authenticatedUserId,
      actorRole: ctx.authenticatedRoleType,
      eventType: "entry_created",
      eventSummary: "Parent communication entry created",
      eventPayload: {
        category: entry.category,
        status: entry.status,
        deliveryIntent: entry.deliveryIntent,
      },
    });

    return json(res, 200, {
      ok: true,
      parentCommunicationEntryId: entry.parentCommunicationEntryId,
      message: "Communication entry saved",
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_PARENT") return forbidden(res, "Parent access is required");
    throw error;
  }
}

export async function parentCommunicationEntryStatusRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await parseBody(req, entryStatusUpdateSchema, res);
    if (!body) return;

    const ctx = await resolveRequestContext(req);
    requireParentLikeRole(ctx.authenticatedRoleType);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated parent");
    }

    const success = await repo.updateEntryStatus({
      parentCommunicationEntryId: body.parentCommunicationEntryId,
      parentUserId: ctx.authenticatedUserId,
      studentProfileId: ctx.studentProfileId,
      status: body.status,
    });
    if (!success) {
      return badRequest(res, "The selected entry does not belong to the authenticated parent context");
    }

    await repo.createAuditLog({
      communicationAuditLogId: newId(),
      parentCommunicationEntryId: body.parentCommunicationEntryId,
      studentProfileId: ctx.studentProfileId,
      householdId: ctx.householdId,
      actorUserId: ctx.authenticatedUserId,
      actorRole: ctx.authenticatedRoleType,
      eventType: "entry_status_changed",
      eventSummary: `Parent communication entry moved to ${body.status}`,
      eventPayload: { status: body.status },
    });

    return json(res, 200, { ok: true, message: "Entry status updated" });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_PARENT") return forbidden(res, "Parent access is required");
    throw error;
  }
}

export async function parentCommunicationTranslateRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await parseBody(req, translateSchema, res);
    if (!body) return;

    const ctx = await resolveRequestContext(req);
    requireParentLikeRole(ctx.authenticatedRoleType);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated parent");
    }

    const [entry, parentProfile, studentPreferences, aggregated] = await Promise.all([
      repo.getEntry(body.parentCommunicationEntryId, ctx.authenticatedUserId, ctx.studentProfileId),
      repo.getParentProfile(ctx.authenticatedUserId, ctx.studentProfileId),
      repo.getStudentPreferences(ctx.studentProfileId),
      aggregateStudentContext(ctx.studentProfileId),
    ]);

    if (!entry) {
      return badRequest(res, "The selected communication entry does not belong to the authenticated parent context");
    }

    const scoringInput = await buildStudentScoringInput(ctx.studentProfileId);
    const scoring = runScoring(scoringInput);
    const history = await repo.listAuditLogs(ctx.studentProfileId, ctx.householdId);
    const priorOutcomeNotes = history
      .filter((item) => item.eventType === "delivery_blocked" || item.eventType === "delivery_mocked")
      .slice(0, 5)
      .map((item) => item.eventSummary);

    const result = await generateCommunicationTranslation({
      studentProfileId: ctx.studentProfileId,
      householdId: ctx.householdId,
      parentUserId: ctx.authenticatedUserId,
      studentName: aggregated.studentName,
      studentGoal: aggregated.targetGoal,
      parentEntry: entry,
      parentProfile,
      studentPreferences,
      scoring,
      selectedChannel: body.selectedChannel ?? null,
      priorOutcomeNotes,
    });

    const strategyId = newId();
    await repo.createStrategy({
      communicationStrategyId: strategyId,
      ...result.strategy,
    });
    await repo.updateEntryStatus({
      parentCommunicationEntryId: entry.parentCommunicationEntryId,
      parentUserId: ctx.authenticatedUserId,
      studentProfileId: ctx.studentProfileId,
      status: result.strategy.withholdDelivery ? "saved_as_context" : "translated",
    });
    await repo.createAuditLog({
      communicationAuditLogId: newId(),
      parentCommunicationEntryId: entry.parentCommunicationEntryId,
      communicationStrategyId: strategyId,
      studentProfileId: ctx.studentProfileId,
      householdId: ctx.householdId,
      actorUserId: ctx.authenticatedUserId,
      actorRole: ctx.authenticatedRoleType,
      eventType: result.strategy.withholdDelivery ? "strategy_withheld" : "strategy_generated",
      eventSummary: result.strategy.withholdDelivery
        ? "Communication strategy generated but withheld from delivery"
        : "Communication strategy generated",
      eventPayload: {
        generationMode: result.strategy.generationMode,
        consentState: result.strategy.consentState,
        selectedChannel: body.selectedChannel ?? null,
        degradedReason: result.degradedReason || null,
      },
    });

    return json(res, 200, {
      ok: true,
      communicationStrategyId: strategyId,
      strategy: {
        communicationStrategyId: strategyId,
        ...result.strategy,
      },
      degradedReason: result.degradedReason || null,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_PARENT") return forbidden(res, "Parent access is required");
    throw error;
  }
}

export async function parentCommunicationDraftSaveRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await parseBody(req, saveDraftSchema, res);
    if (!body) return;

    const ctx = await resolveRequestContext(req);
    requireParentLikeRole(ctx.authenticatedRoleType);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated parent");
    }

    const strategy = await repo.getStrategy(body.communicationStrategyId, ctx.authenticatedUserId, ctx.studentProfileId);
    if (!strategy) {
      return badRequest(res, "The selected strategy does not belong to the authenticated parent context");
    }

    const draftId = newId();
    const draft: CommunicationMessageDraftRecord = {
      communicationMessageDraftId: draftId,
      communicationStrategyId: strategy.communicationStrategyId,
      parentCommunicationEntryId: strategy.parentCommunicationEntryId,
      parentUserId: ctx.authenticatedUserId,
      studentProfileId: ctx.studentProfileId,
      householdId: ctx.householdId,
      selectedChannel: body.selectedChannel,
      providerMode: "not_sent",
      status: strategy.withholdDelivery ? "withheld" : strategy.humanReviewRecommended ? "review_required" : "approved",
      messageBody: strategy.studentFacingMessageDraft,
      reviewRequired: strategy.humanReviewRecommended,
      approvedForDelivery: !strategy.withholdDelivery && !strategy.humanReviewRecommended,
    };

    await repo.createMessageDraft(draft);
    await repo.createAuditLog({
      communicationAuditLogId: newId(),
      parentCommunicationEntryId: strategy.parentCommunicationEntryId,
      communicationStrategyId: strategy.communicationStrategyId,
      communicationMessageDraftId: draftId,
      studentProfileId: ctx.studentProfileId,
      householdId: ctx.householdId,
      actorUserId: ctx.authenticatedUserId,
      actorRole: ctx.authenticatedRoleType,
      eventType: "draft_saved",
      eventSummary: "Communication draft saved for review",
      eventPayload: {
        selectedChannel: draft.selectedChannel,
        reviewRequired: draft.reviewRequired,
        withholdDelivery: strategy.withholdDelivery,
      },
    });

    return json(res, 200, {
      ok: true,
      communicationMessageDraftId: draftId,
      draft,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_PARENT") return forbidden(res, "Parent access is required");
    throw error;
  }
}

export async function parentCommunicationDraftSendMockRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await parseBody(req, sendDraftSchema, res);
    if (!body) return;

    const ctx = await resolveRequestContext(req);
    requireParentLikeRole(ctx.authenticatedRoleType);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated parent");
    }

    const draft = await repo.getDraft(body.communicationMessageDraftId, ctx.authenticatedUserId, ctx.studentProfileId);
    if (!draft) {
      return badRequest(res, "The selected draft does not belong to the authenticated parent context");
    }

    const strategy = await repo.getStrategy(draft.communicationStrategyId, ctx.authenticatedUserId, ctx.studentProfileId);
    if (!strategy) {
      return badRequest(res, "The selected strategy does not belong to the authenticated parent context");
    }

    await repo.createAuditLog({
      communicationAuditLogId: newId(),
      parentCommunicationEntryId: draft.parentCommunicationEntryId,
      communicationStrategyId: draft.communicationStrategyId,
      communicationMessageDraftId: draft.communicationMessageDraftId,
      studentProfileId: ctx.studentProfileId,
      householdId: ctx.householdId,
      actorUserId: ctx.authenticatedUserId,
      actorRole: ctx.authenticatedRoleType,
      eventType: "delivery_requested",
      eventSummary: "Parent requested delivery of a translated communication draft",
      eventPayload: { selectedChannel: draft.selectedChannel },
    });

    if (strategy.withholdDelivery || strategy.consentState !== "granted") {
      await repo.updateDraftStatus({
        communicationMessageDraftId: draft.communicationMessageDraftId,
        status: "withheld",
        providerMode: "not_sent",
        approvedForDelivery: false,
      });
      await repo.createAuditLog({
        communicationAuditLogId: newId(),
        parentCommunicationEntryId: draft.parentCommunicationEntryId,
        communicationStrategyId: draft.communicationStrategyId,
        communicationMessageDraftId: draft.communicationMessageDraftId,
        studentProfileId: ctx.studentProfileId,
        householdId: ctx.householdId,
        actorUserId: ctx.authenticatedUserId,
        actorRole: ctx.authenticatedRoleType,
        eventType: "delivery_blocked",
        eventSummary: "Delivery was blocked because student consent or safety rules did not allow it",
        eventPayload: {
          consentState: strategy.consentState,
          withholdReason: strategy.withholdReason,
        },
      });
      return json(res, 200, {
        ok: false,
        blocked: true,
        message: strategy.withholdReason || "Delivery was blocked by consent or safety rules",
      });
    }

    const provider = getCommunicationProvider();
    const sendResult = await provider.send({
      channel: draft.selectedChannel as CommunicationChannel,
      messageBody: draft.messageBody,
      studentProfileId: draft.studentProfileId,
      strategyId: draft.communicationStrategyId,
    });

    if (!sendResult.ok) {
      await repo.updateDraftStatus({
        communicationMessageDraftId: draft.communicationMessageDraftId,
        status: "review_required",
        providerMode: sendResult.providerMode,
        approvedForDelivery: false,
      });
      await repo.createAuditLog({
        communicationAuditLogId: newId(),
        parentCommunicationEntryId: draft.parentCommunicationEntryId,
        communicationStrategyId: draft.communicationStrategyId,
        communicationMessageDraftId: draft.communicationMessageDraftId,
        studentProfileId: ctx.studentProfileId,
        householdId: ctx.householdId,
        actorUserId: ctx.authenticatedUserId,
        actorRole: ctx.authenticatedRoleType,
        eventType: "delivery_blocked",
        eventSummary: sendResult.note,
        eventPayload: sendResult,
      });
      return json(res, 200, { ok: false, blocked: true, provider: sendResult });
    }

    const deliveredAt = new Date().toISOString();
    await repo.updateDraftStatus({
      communicationMessageDraftId: draft.communicationMessageDraftId,
      status: "delivered",
      providerMode: sendResult.providerMode,
      approvedForDelivery: true,
      deliveredAt,
    });
    await repo.updateStrategyStatus({
      communicationStrategyId: draft.communicationStrategyId,
      status: "delivered",
    });
    await repo.updateEntryStatus({
      parentCommunicationEntryId: draft.parentCommunicationEntryId,
      parentUserId: ctx.authenticatedUserId,
      studentProfileId: ctx.studentProfileId,
      status: "delivered",
    });
    await repo.createAuditLog({
      communicationAuditLogId: newId(),
      parentCommunicationEntryId: draft.parentCommunicationEntryId,
      communicationStrategyId: draft.communicationStrategyId,
      communicationMessageDraftId: draft.communicationMessageDraftId,
      studentProfileId: ctx.studentProfileId,
      householdId: ctx.householdId,
      actorUserId: ctx.authenticatedUserId,
      actorRole: ctx.authenticatedRoleType,
      eventType: "delivery_mocked",
      eventSummary: "Mock delivery recorded successfully",
      eventPayload: {
        providerMode: sendResult.providerMode,
        externalMessageId: sendResult.externalMessageId,
        note: sendResult.note,
      },
    });

    return json(res, 200, {
      ok: true,
      delivered: true,
      provider: sendResult,
      deliveredAt,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_PARENT") return forbidden(res, "Parent access is required");
    throw error;
  }
}

export async function parentCommunicationHistoryRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await resolveRequestContext(req);
    requireParentLikeRole(ctx.authenticatedRoleType);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated parent");
    }

    const [entries, strategies, drafts, audit] = await Promise.all([
      repo.listEntries(ctx.authenticatedUserId, ctx.studentProfileId),
      repo.listStrategies(ctx.authenticatedUserId, ctx.studentProfileId),
      repo.listDrafts(ctx.authenticatedUserId, ctx.studentProfileId),
      repo.listAuditLogs(ctx.studentProfileId, ctx.householdId),
    ]);

    return json(res, 200, {
      ok: true,
      entries,
      strategies,
      drafts,
      audit,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_PARENT") return forbidden(res, "Parent access is required");
    throw error;
  }
}
