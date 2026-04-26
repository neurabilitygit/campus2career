import crypto from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import type {
  CommunicationChannel,
  CommunicationPromptAudience,
  CommunicationTone,
  CommunicationTranslationGoal,
  CommunicationVisibilityScope,
  ParentCommunicationInputRecord,
  CommunicationMessageDraftRecord,
  ParentCommunicationEntryRecord,
  ParentCommunicationProfileRecord,
  StudentCommunicationPreferencesRecord,
  StudentCommunicationInputRecord,
} from "../../../../packages/shared/src/contracts/communication";
import { CommunicationRepository } from "../repositories/communication/communicationRepository";
import { resolveRequestContext } from "../services/auth/resolveRequestContext";
import { hasCapability } from "../services/auth/permissions";
import { resolveCoachRelationshipOrThrow } from "../services/coach/workspace";
import { buildStudentScoringInput, aggregateStudentContext } from "../services/student/aggregateStudentContext";
import { runScoring } from "../services/scoring";
import { generateCommunicationTranslation } from "../services/communication/translator";
import { getCommunicationProvider } from "../services/communication/provider";
import {
  buildCommunicationAnalytics,
  buildCommunicationSummary,
  buildPromptLearningEvent,
  calculateCommunicationProfileCompletion,
  canViewCommunicationScope,
  deriveCommunicationInferredInsights,
  feedbackToLearningSignal,
  generateCommunicationBridge,
  getCommunicationPromptCatalog,
  selectNextCommunicationPrompt,
} from "../services/communication/intelligence";
import {
  canAccessParentCommunication,
  canAccessStudentCommunication,
} from "../services/communication/access";
import { readJsonBody } from "../utils/body";
import { badRequest, forbidden, json, unauthorized } from "../utils/http";

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
const visibilityScopes = [
  "private_to_user",
  "visible_to_household_admin",
  "visible_to_student",
  "visible_to_parent",
  "visible_to_coach",
  "visible_to_system_only",
  "shared_summary_only",
] as const;
const sensitivityLevels = ["low", "medium", "high"] as const;
const promptStatuses = ["unanswered", "answered", "skipped", "revisit_later"] as const;
const promptAudiences = ["parent", "student"] as const;
const translationGoals = [
  "clarify",
  "reduce_friction",
  "reminder",
  "check_in",
  "boundary_setting",
  "status_update",
  "encouragement",
] as const;
const feedbackRatings = [
  "helpful",
  "not_helpful",
  "too_direct",
  "too_soft",
  "missed_the_point",
  "made_it_worse",
  "other",
] as const;

function newId(): string {
  return crypto.randomUUID();
}

type RouteContext = Awaited<ReturnType<typeof resolveRequestContext>>;

export const communicationRouteDeps = {
  repo: new CommunicationRepository(),
  resolveRequestContext,
  buildStudentScoringInput,
  aggregateStudentContext,
  runScoring,
  generateCommunicationTranslation,
  getCommunicationProvider,
  newId,
};

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

const parentInputSchema = z.object({
  promptKey: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(120),
  questionText: z.string().trim().min(1).max(280),
  responseText: z.string().trim().min(1).max(4000),
  sensitivityLevel: z.enum(sensitivityLevels),
  visibilityScope: z.enum(visibilityScopes),
  confidenceLevel: optionalTrimmedString(120),
});

const studentInputSchema = z.object({
  promptKey: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(120),
  questionText: z.string().trim().min(1).max(280),
  responseText: z.string().trim().min(1).max(4000),
  sensitivityLevel: z.enum(sensitivityLevels),
  visibilityScope: z.enum(visibilityScopes),
});

const communicationInputReviewSchema = z.object({
  status: z.enum(["confirmed", "rejected"]),
  reviewNotes: optionalTrimmedString(1200),
});

const promptSkipSchema = z.object({
  audience: z.enum(promptAudiences),
  promptKey: z.string().trim().min(1).max(120),
  status: z.enum(promptStatuses),
});

const communicationTranslateSchema = z.object({
  sourceRole: z.enum(["parent", "student"]),
  targetRole: z.enum(["parent", "student"]),
  originalText: z.string().trim().min(1).max(4000),
  translationGoal: z.enum(translationGoals),
  tone: z.enum(preferredTones).optional(),
});

const communicationFeedbackSchema = z.object({
  communicationTranslationEventId: z.string().uuid(),
  feedbackRating: z.enum(feedbackRatings),
  feedbackNotes: optionalTrimmedString(1200),
});

function canReviewInferredInsights(role: string) {
  return role === "parent" || role === "student" || role === "admin";
}

function formatZodError(error: z.ZodError): string {
  return (
    error.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`).join("; ") ||
    "Invalid request body"
  );
}

function requestUrl(req: IncomingMessage) {
  return new URL(req.url || "/", "http://localhost");
}

async function ensureCommunicationProfileForContext(ctx: RouteContext) {
  if (!ctx.studentProfileId) {
    throw new Error("NO_STUDENT_PROFILE");
  }
  return communicationRouteDeps.repo.getOrCreateCommunicationProfile({
    communicationProfileId: communicationRouteDeps.newId(),
    householdId: ctx.householdId,
    studentProfileId: ctx.studentProfileId,
  });
}

async function resolveCommunicationStudentProfileId(req: IncomingMessage, ctx: RouteContext) {
  if (ctx.authenticatedRoleType !== "coach") {
    return ctx.studentProfileId;
  }

  const requestedStudentProfileId = requestUrl(req).searchParams.get("studentProfileId");
  const relationship = await resolveCoachRelationshipOrThrow(ctx as any, requestedStudentProfileId);
  return relationship?.studentProfileId || null;
}

function requireCommunicationViewerRole(role: string) {
  if (role !== "student" && role !== "parent" && role !== "coach" && role !== "admin") {
    throw new Error("FORBIDDEN_COMMUNICATION");
  }
}

function filterVisibleParentInputs(
  inputs: ParentCommunicationInputRecord[],
  ctx: RouteContext
) {
  return inputs.filter((item) =>
    canViewCommunicationScope({
      viewerRole: ctx.authenticatedRoleType as any,
      viewerUserId: ctx.authenticatedUserId,
      ownerUserId: item.parentUserId,
      visibilityScope: item.visibilityScope,
    })
  );
}

function filterVisibleStudentInputs(
  inputs: StudentCommunicationInputRecord[],
  ctx: RouteContext
) {
  return inputs.filter((item) =>
    canViewCommunicationScope({
      viewerRole: ctx.authenticatedRoleType as any,
      viewerUserId: ctx.authenticatedUserId,
      ownerUserId: item.studentUserId,
      visibilityScope: item.visibilityScope,
    })
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
    const ctx = await communicationRouteDeps.resolveRequestContext(req);
    requireStudentLikeRole(ctx.authenticatedRoleType);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated user");
    }

    const preferences = await communicationRouteDeps.repo.getStudentPreferences(ctx.studentProfileId);
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

    const ctx = await communicationRouteDeps.resolveRequestContext(req);
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

    await communicationRouteDeps.repo.upsertStudentPreferences({
      preferenceId: communicationRouteDeps.newId(),
      studentProfileId: ctx.studentProfileId,
      record,
    });
    await communicationRouteDeps.repo.createAuditLog({
      communicationAuditLogId: communicationRouteDeps.newId(),
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
    const ctx = await communicationRouteDeps.resolveRequestContext(req);
    requireStudentLikeRole(ctx.authenticatedRoleType);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated user");
    }

    const messages = await communicationRouteDeps.repo.listStudentReceivedMessages(ctx.studentProfileId);
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
    const ctx = await communicationRouteDeps.resolveRequestContext(req);
    requireParentLikeRole(ctx.authenticatedRoleType);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated parent");
    }

    const profile = await communicationRouteDeps.repo.getParentProfile(ctx.authenticatedUserId, ctx.studentProfileId);
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

    const ctx = await communicationRouteDeps.resolveRequestContext(req);
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

    await communicationRouteDeps.repo.upsertParentProfile({
      profileId: communicationRouteDeps.newId(),
      record,
    });
    await communicationRouteDeps.repo.createAuditLog({
      communicationAuditLogId: communicationRouteDeps.newId(),
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
    const ctx = await communicationRouteDeps.resolveRequestContext(req);
    requireParentLikeRole(ctx.authenticatedRoleType);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated parent");
    }

    const entries = await communicationRouteDeps.repo.listEntries(ctx.authenticatedUserId, ctx.studentProfileId);
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

    const ctx = await communicationRouteDeps.resolveRequestContext(req);
    requireParentLikeRole(ctx.authenticatedRoleType);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated parent");
    }

    const entry: ParentCommunicationEntryRecord = {
      parentCommunicationEntryId: communicationRouteDeps.newId(),
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

    await communicationRouteDeps.repo.createEntry(entry);
    await communicationRouteDeps.repo.createAuditLog({
      communicationAuditLogId: communicationRouteDeps.newId(),
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

    const ctx = await communicationRouteDeps.resolveRequestContext(req);
    requireParentLikeRole(ctx.authenticatedRoleType);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated parent");
    }

    const success = await communicationRouteDeps.repo.updateEntryStatus({
      parentCommunicationEntryId: body.parentCommunicationEntryId,
      parentUserId: ctx.authenticatedUserId,
      studentProfileId: ctx.studentProfileId,
      status: body.status,
    });
    if (!success) {
      return badRequest(res, "The selected entry does not belong to the authenticated parent context");
    }

    await communicationRouteDeps.repo.createAuditLog({
      communicationAuditLogId: communicationRouteDeps.newId(),
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

    const ctx = await communicationRouteDeps.resolveRequestContext(req);
    requireParentLikeRole(ctx.authenticatedRoleType);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated parent");
    }

    const [entry, parentProfile, studentPreferences, aggregated] = await Promise.all([
      communicationRouteDeps.repo.getEntry(body.parentCommunicationEntryId, ctx.authenticatedUserId, ctx.studentProfileId),
      communicationRouteDeps.repo.getParentProfile(ctx.authenticatedUserId, ctx.studentProfileId),
      communicationRouteDeps.repo.getStudentPreferences(ctx.studentProfileId),
      communicationRouteDeps.aggregateStudentContext(ctx.studentProfileId),
    ]);

    if (!entry) {
      return badRequest(res, "The selected communication entry does not belong to the authenticated parent context");
    }

    const scoringInput = await communicationRouteDeps.buildStudentScoringInput(ctx.studentProfileId);
    const scoring = communicationRouteDeps.runScoring(scoringInput);
    const history = await communicationRouteDeps.repo.listAuditLogs(ctx.studentProfileId, ctx.householdId);
    const priorOutcomeNotes = history
      .filter((item) => item.eventType === "delivery_blocked" || item.eventType === "delivery_mocked")
      .slice(0, 5)
      .map((item) => item.eventSummary);

    const result = await communicationRouteDeps.generateCommunicationTranslation({
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

    const strategyId = communicationRouteDeps.newId();
    await communicationRouteDeps.repo.createStrategy({
      communicationStrategyId: strategyId,
      ...result.strategy,
    });
    await communicationRouteDeps.repo.updateEntryStatus({
      parentCommunicationEntryId: entry.parentCommunicationEntryId,
      parentUserId: ctx.authenticatedUserId,
      studentProfileId: ctx.studentProfileId,
      status: result.strategy.withholdDelivery ? "saved_as_context" : "translated",
    });
    await communicationRouteDeps.repo.createAuditLog({
      communicationAuditLogId: communicationRouteDeps.newId(),
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

    const ctx = await communicationRouteDeps.resolveRequestContext(req);
    requireParentLikeRole(ctx.authenticatedRoleType);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated parent");
    }

    const strategy = await communicationRouteDeps.repo.getStrategy(body.communicationStrategyId, ctx.authenticatedUserId, ctx.studentProfileId);
    if (!strategy) {
      return badRequest(res, "The selected strategy does not belong to the authenticated parent context");
    }

    const draftId = communicationRouteDeps.newId();
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

    await communicationRouteDeps.repo.createMessageDraft(draft);
    await communicationRouteDeps.repo.createAuditLog({
      communicationAuditLogId: communicationRouteDeps.newId(),
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

    const ctx = await communicationRouteDeps.resolveRequestContext(req);
    requireParentLikeRole(ctx.authenticatedRoleType);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated parent");
    }

    const draft = await communicationRouteDeps.repo.getDraft(body.communicationMessageDraftId, ctx.authenticatedUserId, ctx.studentProfileId);
    if (!draft) {
      return badRequest(res, "The selected draft does not belong to the authenticated parent context");
    }

    const strategy = await communicationRouteDeps.repo.getStrategy(draft.communicationStrategyId, ctx.authenticatedUserId, ctx.studentProfileId);
    if (!strategy) {
      return badRequest(res, "The selected strategy does not belong to the authenticated parent context");
    }

    await communicationRouteDeps.repo.createAuditLog({
      communicationAuditLogId: communicationRouteDeps.newId(),
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
      await communicationRouteDeps.repo.updateDraftStatus({
        communicationMessageDraftId: draft.communicationMessageDraftId,
        status: "withheld",
        providerMode: "not_sent",
        approvedForDelivery: false,
      });
      await communicationRouteDeps.repo.createAuditLog({
        communicationAuditLogId: communicationRouteDeps.newId(),
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

    const provider = communicationRouteDeps.getCommunicationProvider();
    const sendResult = await provider.send({
      channel: draft.selectedChannel as CommunicationChannel,
      messageBody: draft.messageBody,
      studentProfileId: draft.studentProfileId,
      strategyId: draft.communicationStrategyId,
    });

    if (!sendResult.ok) {
      await communicationRouteDeps.repo.updateDraftStatus({
        communicationMessageDraftId: draft.communicationMessageDraftId,
        status: "review_required",
        providerMode: sendResult.providerMode,
        approvedForDelivery: false,
      });
      await communicationRouteDeps.repo.createAuditLog({
        communicationAuditLogId: communicationRouteDeps.newId(),
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
    await communicationRouteDeps.repo.updateDraftStatus({
      communicationMessageDraftId: draft.communicationMessageDraftId,
      status: "delivered",
      providerMode: sendResult.providerMode,
      approvedForDelivery: true,
      deliveredAt,
    });
    await communicationRouteDeps.repo.updateStrategyStatus({
      communicationStrategyId: draft.communicationStrategyId,
      status: "delivered",
    });
    await communicationRouteDeps.repo.updateEntryStatus({
      parentCommunicationEntryId: draft.parentCommunicationEntryId,
      parentUserId: ctx.authenticatedUserId,
      studentProfileId: ctx.studentProfileId,
      status: "delivered",
    });
    await communicationRouteDeps.repo.createAuditLog({
      communicationAuditLogId: communicationRouteDeps.newId(),
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
    const ctx = await communicationRouteDeps.resolveRequestContext(req);
    requireParentLikeRole(ctx.authenticatedRoleType);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated parent");
    }

    const [entries, strategies, drafts, audit] = await Promise.all([
      communicationRouteDeps.repo.listEntries(ctx.authenticatedUserId, ctx.studentProfileId),
      communicationRouteDeps.repo.listStrategies(ctx.authenticatedUserId, ctx.studentProfileId),
      communicationRouteDeps.repo.listDrafts(ctx.authenticatedUserId, ctx.studentProfileId),
      communicationRouteDeps.repo.listAuditLogs(ctx.studentProfileId, ctx.householdId),
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

export async function communicationProfileRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await communicationRouteDeps.resolveRequestContext(req);
    requireCommunicationViewerRole(ctx.authenticatedRoleType);
    const effectiveStudentProfileId = await resolveCommunicationStudentProfileId(req, ctx);
    if (!effectiveStudentProfileId) {
      throw new Error("NO_STUDENT_PROFILE");
    }
    const profile = await communicationRouteDeps.repo.getOrCreateCommunicationProfile({
      communicationProfileId: communicationRouteDeps.newId(),
      householdId: ctx.householdId,
      studentProfileId: effectiveStudentProfileId,
    });

    const [parentProfile, studentPreferences, parentInputs, studentInputs, translationEvents] = await Promise.all([
      communicationRouteDeps.repo.getParentProfile(ctx.authenticatedUserId, effectiveStudentProfileId),
      communicationRouteDeps.repo.getStudentPreferences(effectiveStudentProfileId),
      communicationRouteDeps.repo.listParentInputs(profile.communicationProfileId),
      communicationRouteDeps.repo.listStudentInputs(profile.communicationProfileId),
      communicationRouteDeps.repo.listTranslationEvents(profile.communicationProfileId, 10),
    ]);

    const visibleParentInputs = filterVisibleParentInputs(parentInputs, ctx);
    const visibleStudentInputs = filterVisibleStudentInputs(studentInputs, ctx);
    const parentCompletion = calculateCommunicationProfileCompletion({
      audience: "parent",
      answeredPromptKeys: parentInputs.map((item) => item.promptKey),
    });
    const studentCompletion = calculateCommunicationProfileCompletion({
      audience: "student",
      answeredPromptKeys: studentInputs.map((item) => item.promptKey),
    });

    return json(res, 200, {
      ok: true,
      profile,
      parentProfile,
      studentPreferences,
      parentInputs: visibleParentInputs,
      studentInputs: visibleStudentInputs,
      translationEvents:
        ctx.authenticatedRoleType === "coach"
          ? translationEvents.map((item) => ({
              communicationTranslationEventId: item.communicationTranslationEventId,
              sourceRole: item.sourceRole,
              targetRole: item.targetRole,
              translationGoal: item.translationGoal,
              feedbackRating: item.feedbackRating || null,
              createdAt: item.createdAt || null,
            }))
          : translationEvents,
      completion: {
        parent: parentCompletion,
        student: studentCompletion,
      },
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_COMMUNICATION") return forbidden(res, "Communication access is required");
    if (error?.message === "NO_STUDENT_PROFILE") return badRequest(res, "No student profile could be resolved for the authenticated context");
    throw error;
  }
}

export async function communicationNextPromptRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await communicationRouteDeps.resolveRequestContext(req);
    requireCommunicationViewerRole(ctx.authenticatedRoleType);
    const effectiveStudentProfileId = await resolveCommunicationStudentProfileId(req, ctx);
    if (!effectiveStudentProfileId) {
      throw new Error("NO_STUDENT_PROFILE");
    }
    const profile = await communicationRouteDeps.repo.getOrCreateCommunicationProfile({
      communicationProfileId: communicationRouteDeps.newId(),
      householdId: ctx.householdId,
      studentProfileId: effectiveStudentProfileId,
    });
    const parsedAudience = z.enum(promptAudiences).safeParse(requestUrl(req).searchParams.get("audience"));
    const audience: CommunicationPromptAudience =
      parsedAudience.success
        ? parsedAudience.data
        : ctx.authenticatedRoleType === "parent"
          ? "parent"
          : "student";

    if (audience === "parent" && !canAccessParentCommunication(ctx.authenticatedRoleType)) {
      return forbidden(res, "Parent communication access is required");
    }
    if (audience === "student" && !canAccessStudentCommunication(ctx.authenticatedRoleType)) {
      return forbidden(res, "Student communication access is required");
    }

    const ownerUserId = ctx.authenticatedUserId;
    const [progress, parentInputs, studentInputs] = await Promise.all([
      communicationRouteDeps.repo.listPromptProgress(profile.communicationProfileId, ownerUserId, audience),
      audience === "parent"
        ? communicationRouteDeps.repo.listParentInputs(profile.communicationProfileId, ownerUserId)
        : Promise.resolve([] as ParentCommunicationInputRecord[]),
      audience === "student"
        ? communicationRouteDeps.repo.listStudentInputs(profile.communicationProfileId, ownerUserId)
        : Promise.resolve([] as StudentCommunicationInputRecord[]),
    ]);

    const answeredPromptKeys =
      audience === "parent"
        ? parentInputs.map((item) => item.promptKey)
        : studentInputs.map((item) => item.promptKey);
    const nextPrompt = selectNextCommunicationPrompt({
      audience,
      progress,
      answeredPromptKeys,
    });

    if (nextPrompt) {
      await communicationRouteDeps.repo.upsertPromptProgress({
        communicationPromptProgressId: communicationRouteDeps.newId(),
        communicationProfileId: profile.communicationProfileId,
        userId: ownerUserId,
        role: audience,
        promptKey: nextPrompt.key,
        status: progress.find((item) => item.promptKey === nextPrompt.key)?.status || "unanswered",
        lastPromptedAt: new Date().toISOString(),
        answeredAt: progress.find((item) => item.promptKey === nextPrompt.key)?.answeredAt || null,
      });
    }

    return json(res, 200, {
      ok: true,
      audience,
      nextPrompt,
      completion: calculateCommunicationProfileCompletion({ audience, answeredPromptKeys }),
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_COMMUNICATION") return forbidden(res, "Communication access is required");
    if (error?.message === "NO_STUDENT_PROFILE") return badRequest(res, "No student profile could be resolved for the authenticated context");
    throw error;
  }
}

export async function communicationParentInputUpsertRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await parseBody(req, parentInputSchema, res);
    if (!body) return;

    const ctx = await communicationRouteDeps.resolveRequestContext(req);
    requireParentLikeRole(ctx.authenticatedRoleType);
    const profile = await ensureCommunicationProfileForContext(ctx);

    const record: ParentCommunicationInputRecord = {
      parentCommunicationInputId: communicationRouteDeps.newId(),
      communicationProfileId: profile.communicationProfileId,
      parentUserId: ctx.authenticatedUserId,
      category: body.category,
      promptKey: body.promptKey,
      questionText: body.questionText,
      responseText: body.responseText,
      sensitivityLevel: body.sensitivityLevel,
      visibilityScope: body.visibilityScope as CommunicationVisibilityScope,
      confidenceLevel: body.confidenceLevel ?? null,
    };

    await communicationRouteDeps.repo.upsertParentInput(record);
    await communicationRouteDeps.repo.upsertPromptProgress({
      communicationPromptProgressId: communicationRouteDeps.newId(),
      communicationProfileId: profile.communicationProfileId,
      userId: ctx.authenticatedUserId,
      role: "parent",
      promptKey: record.promptKey,
      status: "answered",
      lastPromptedAt: new Date().toISOString(),
      answeredAt: new Date().toISOString(),
    });
    const learning = buildPromptLearningEvent({
      promptKey: record.promptKey,
      status: "answered",
      role: ctx.authenticatedRoleType as any,
    });
    await communicationRouteDeps.repo.createLearningEvent({
      communicationLearningEventId: communicationRouteDeps.newId(),
      communicationProfileId: profile.communicationProfileId,
      ...learning,
    });

    return json(res, 200, { ok: true, input: record });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_PARENT") return forbidden(res, "Parent access is required");
    if (error?.message === "NO_STUDENT_PROFILE") return badRequest(res, "No student profile could be resolved for the authenticated context");
    throw error;
  }
}

export async function communicationParentInputUpdateRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await parseBody(req, parentInputSchema, res);
    if (!body) return;

    const ctx = await communicationRouteDeps.resolveRequestContext(req);
    requireParentLikeRole(ctx.authenticatedRoleType);
    const profile = await ensureCommunicationProfileForContext(ctx);
    const inputId = requestUrl(req).pathname.split("/").pop();
    if (!inputId) {
      return badRequest(res, "A communication input id is required");
    }

    const success = await communicationRouteDeps.repo.updateParentInput({
      parentCommunicationInputId: inputId,
      communicationProfileId: profile.communicationProfileId,
      parentUserId: ctx.authenticatedUserId,
      category: body.category,
      promptKey: body.promptKey,
      questionText: body.questionText,
      responseText: body.responseText,
      sensitivityLevel: body.sensitivityLevel,
      visibilityScope: body.visibilityScope as CommunicationVisibilityScope,
      confidenceLevel: body.confidenceLevel ?? null,
    });
    if (!success) {
      return badRequest(res, "The selected parent insight could not be updated");
    }

    return json(res, 200, { ok: true });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_PARENT") return forbidden(res, "Parent access is required");
    if (error?.message === "NO_STUDENT_PROFILE") return badRequest(res, "No student profile could be resolved for the authenticated context");
    throw error;
  }
}

export async function communicationParentInputDeleteRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await communicationRouteDeps.resolveRequestContext(req);
    requireParentLikeRole(ctx.authenticatedRoleType);
    const profile = await ensureCommunicationProfileForContext(ctx);
    const inputId = requestUrl(req).pathname.split("/").pop();
    if (!inputId) {
      return badRequest(res, "A communication input id is required");
    }

    const success = await communicationRouteDeps.repo.deleteParentInput({
      parentCommunicationInputId: inputId,
      communicationProfileId: profile.communicationProfileId,
      parentUserId: ctx.authenticatedUserId,
    });
    if (!success) {
      return badRequest(res, "The selected parent insight could not be deleted");
    }

    return json(res, 200, { ok: true });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_PARENT") return forbidden(res, "Parent access is required");
    if (error?.message === "NO_STUDENT_PROFILE") return badRequest(res, "No student profile could be resolved for the authenticated context");
    throw error;
  }
}

export async function communicationStudentInputUpsertRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await parseBody(req, studentInputSchema, res);
    if (!body) return;

    const ctx = await communicationRouteDeps.resolveRequestContext(req);
    requireStudentLikeRole(ctx.authenticatedRoleType);
    const profile = await ensureCommunicationProfileForContext(ctx);

    const record: StudentCommunicationInputRecord = {
      studentCommunicationInputId: communicationRouteDeps.newId(),
      communicationProfileId: profile.communicationProfileId,
      studentUserId: ctx.authenticatedUserId,
      category: body.category,
      promptKey: body.promptKey,
      questionText: body.questionText,
      responseText: body.responseText,
      sensitivityLevel: body.sensitivityLevel,
      visibilityScope: body.visibilityScope as CommunicationVisibilityScope,
    };

    await communicationRouteDeps.repo.upsertStudentInput(record);
    await communicationRouteDeps.repo.upsertPromptProgress({
      communicationPromptProgressId: communicationRouteDeps.newId(),
      communicationProfileId: profile.communicationProfileId,
      userId: ctx.authenticatedUserId,
      role: "student",
      promptKey: record.promptKey,
      status: "answered",
      lastPromptedAt: new Date().toISOString(),
      answeredAt: new Date().toISOString(),
    });
    const learning = buildPromptLearningEvent({
      promptKey: record.promptKey,
      status: "answered",
      role: ctx.authenticatedRoleType as any,
    });
    await communicationRouteDeps.repo.createLearningEvent({
      communicationLearningEventId: communicationRouteDeps.newId(),
      communicationProfileId: profile.communicationProfileId,
      ...learning,
    });

    return json(res, 200, { ok: true, input: record });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_STUDENT") return forbidden(res, "Student access is required");
    if (error?.message === "NO_STUDENT_PROFILE") return badRequest(res, "No student profile could be resolved for the authenticated context");
    throw error;
  }
}

export async function communicationStudentInputUpdateRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await parseBody(req, studentInputSchema, res);
    if (!body) return;

    const ctx = await communicationRouteDeps.resolveRequestContext(req);
    requireStudentLikeRole(ctx.authenticatedRoleType);
    const profile = await ensureCommunicationProfileForContext(ctx);
    const inputId = requestUrl(req).pathname.split("/").pop();
    if (!inputId) {
      return badRequest(res, "A communication input id is required");
    }

    const success = await communicationRouteDeps.repo.updateStudentInput({
      studentCommunicationInputId: inputId,
      communicationProfileId: profile.communicationProfileId,
      studentUserId: ctx.authenticatedUserId,
      category: body.category,
      promptKey: body.promptKey,
      questionText: body.questionText,
      responseText: body.responseText,
      sensitivityLevel: body.sensitivityLevel,
      visibilityScope: body.visibilityScope as CommunicationVisibilityScope,
    });
    if (!success) {
      return badRequest(res, "The selected student response could not be updated");
    }

    return json(res, 200, { ok: true });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_STUDENT") return forbidden(res, "Student access is required");
    if (error?.message === "NO_STUDENT_PROFILE") return badRequest(res, "No student profile could be resolved for the authenticated context");
    throw error;
  }
}

export async function communicationStudentInputDeleteRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await communicationRouteDeps.resolveRequestContext(req);
    requireStudentLikeRole(ctx.authenticatedRoleType);
    const profile = await ensureCommunicationProfileForContext(ctx);
    const inputId = requestUrl(req).pathname.split("/").pop();
    if (!inputId) {
      return badRequest(res, "A communication input id is required");
    }

    const success = await communicationRouteDeps.repo.deleteStudentInput({
      studentCommunicationInputId: inputId,
      communicationProfileId: profile.communicationProfileId,
      studentUserId: ctx.authenticatedUserId,
    });
    if (!success) {
      return badRequest(res, "The selected student response could not be deleted");
    }

    return json(res, 200, { ok: true });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_STUDENT") return forbidden(res, "Student access is required");
    if (error?.message === "NO_STUDENT_PROFILE") return badRequest(res, "No student profile could be resolved for the authenticated context");
    throw error;
  }
}

export async function communicationPromptProgressRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await parseBody(req, promptSkipSchema, res);
    if (!body) return;

    const ctx = await communicationRouteDeps.resolveRequestContext(req);
    requireCommunicationViewerRole(ctx.authenticatedRoleType);
    const profile = await ensureCommunicationProfileForContext(ctx);
    if (body.audience === "parent" && !canAccessParentCommunication(ctx.authenticatedRoleType)) {
      return forbidden(res, "Parent communication access is required");
    }
    if (body.audience === "student" && !canAccessStudentCommunication(ctx.authenticatedRoleType)) {
      return forbidden(res, "Student communication access is required");
    }

    await communicationRouteDeps.repo.upsertPromptProgress({
      communicationPromptProgressId: communicationRouteDeps.newId(),
      communicationProfileId: profile.communicationProfileId,
      userId: ctx.authenticatedUserId,
      role: body.audience,
      promptKey: body.promptKey,
      status: body.status,
      lastPromptedAt: new Date().toISOString(),
      answeredAt: body.status === "answered" ? new Date().toISOString() : null,
    });
    const learning = buildPromptLearningEvent({
      promptKey: body.promptKey,
      status: body.status,
      role: ctx.authenticatedRoleType as any,
    });
    await communicationRouteDeps.repo.createLearningEvent({
      communicationLearningEventId: communicationRouteDeps.newId(),
      communicationProfileId: profile.communicationProfileId,
      ...learning,
    });

    return json(res, 200, { ok: true, status: body.status });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_COMMUNICATION") return forbidden(res, "Communication access is required");
    if (error?.message === "NO_STUDENT_PROFILE") return badRequest(res, "No student profile could be resolved for the authenticated context");
    throw error;
  }
}

export async function communicationTranslateRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await parseBody(req, communicationTranslateSchema, res);
    if (!body) return;

    const ctx = await communicationRouteDeps.resolveRequestContext(req);
    requireCommunicationViewerRole(ctx.authenticatedRoleType);
    const profile = await ensureCommunicationProfileForContext(ctx);
    const capabilityNeeded =
      body.sourceRole === "parent"
        ? "communication_translate_parent_to_student"
        : "communication_translate_student_to_parent";
    if (
      !hasCapability(
        { isSuperAdmin: !!ctx.isSuperAdmin, grantedCapabilities: ctx.effectiveCapabilities || [] },
        capabilityNeeded
      )
    ) {
      return forbidden(res, "The current account cannot use this translation flow");
    }
    if (body.sourceRole === "parent" && !canAccessParentCommunication(ctx.authenticatedRoleType)) {
      return forbidden(res, "Parent translation access is required");
    }
    if (body.sourceRole === "student" && !canAccessStudentCommunication(ctx.authenticatedRoleType)) {
      return forbidden(res, "Student translation access is required");
    }

    const [aggregated, parentProfile, studentPreferences, parentInputs, studentInputs, scoringInput] = await Promise.all([
      communicationRouteDeps.aggregateStudentContext(ctx.studentProfileId!),
      communicationRouteDeps.repo.getParentProfile(ctx.authenticatedUserId, ctx.studentProfileId!),
      communicationRouteDeps.repo.getStudentPreferences(ctx.studentProfileId!),
      communicationRouteDeps.repo.listParentInputs(profile.communicationProfileId),
      communicationRouteDeps.repo.listStudentInputs(profile.communicationProfileId),
      communicationRouteDeps.buildStudentScoringInput(ctx.studentProfileId!),
    ]);
    const scoring = communicationRouteDeps.runScoring(scoringInput);

    const bridge = await generateCommunicationBridge({
      sourceRole: body.sourceRole,
      targetRole: body.targetRole,
      translationGoal: body.translationGoal as CommunicationTranslationGoal,
      tone: (body.tone ?? null) as CommunicationTone | null,
      originalText: body.originalText,
      studentName: aggregated.studentName,
      studentGoal: aggregated.targetGoal,
      parentProfile,
      studentPreferences,
      parentInputs,
      studentInputs,
      householdId: ctx.householdId,
      studentProfileId: ctx.studentProfileId!,
      careerGoalName: aggregated.targetGoal,
      scoringHighlights: scoring.topRisks.slice(0, 2),
    });

    const eventId = communicationRouteDeps.newId();
    await communicationRouteDeps.repo.createTranslationEvent({
      communicationTranslationEventId: eventId,
      communicationProfileId: profile.communicationProfileId,
      sourceRole: body.sourceRole,
      targetRole: body.targetRole,
      originalText: body.originalText,
      translatedText: bridge.output.rewrittenMessage,
      translationGoal: body.translationGoal as CommunicationTranslationGoal,
      tone: (body.tone ?? null) as CommunicationTone | null,
      contextUsedJson: {
        scoringHighlights: scoring.topRisks.slice(0, 3),
        degradedReason: bridge.degradedReason || null,
      },
      structuredResultJson: bridge.output,
      createdByUserId: ctx.authenticatedUserId,
    });

    return json(res, 200, {
      ok: true,
      communicationTranslationEventId: eventId,
      mode: bridge.mode,
      output: bridge.output,
      degradedReason: bridge.degradedReason || null,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_COMMUNICATION") return forbidden(res, "Communication access is required");
    if (error?.message === "NO_STUDENT_PROFILE") return badRequest(res, "No student profile could be resolved for the authenticated context");
    throw error;
  }
}

export async function communicationFeedbackRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await parseBody(req, communicationFeedbackSchema, res);
    if (!body) return;

    const ctx = await communicationRouteDeps.resolveRequestContext(req);
    requireCommunicationViewerRole(ctx.authenticatedRoleType);
    const profile = await ensureCommunicationProfileForContext(ctx);
    const success = await communicationRouteDeps.repo.updateTranslationFeedback({
      communicationTranslationEventId: body.communicationTranslationEventId,
      feedbackRating: body.feedbackRating,
      feedbackNotes: body.feedbackNotes ?? null,
    });
    if (!success) {
      return badRequest(res, "The selected translation event could not be updated");
    }

    await communicationRouteDeps.repo.createLearningEvent({
      communicationLearningEventId: communicationRouteDeps.newId(),
      communicationProfileId: profile.communicationProfileId,
      eventType: "translation_feedback",
      sourceRole: ctx.authenticatedRoleType as any,
      signalJson: feedbackToLearningSignal(body.feedbackRating, body.feedbackNotes ?? null),
      interpretationJson: {
        target: "translation_tone_and_clarity",
      },
    });

    return json(res, 200, { ok: true });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_COMMUNICATION") return forbidden(res, "Communication access is required");
    if (error?.message === "NO_STUDENT_PROFILE") return badRequest(res, "No student profile could be resolved for the authenticated context");
    throw error;
  }
}

export async function communicationInferredInsightReviewRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await parseBody(req, communicationInputReviewSchema, res);
    if (!body) return;

    const ctx = await communicationRouteDeps.resolveRequestContext(req);
    requireCommunicationViewerRole(ctx.authenticatedRoleType);
    if (!canReviewInferredInsights(ctx.authenticatedRoleType)) {
      return forbidden(res, "This role cannot review inferred communication patterns");
    }
    const effectiveStudentProfileId = await resolveCommunicationStudentProfileId(req, ctx);
    if (!effectiveStudentProfileId) {
      throw new Error("NO_STUDENT_PROFILE");
    }
    const profile = await communicationRouteDeps.repo.getOrCreateCommunicationProfile({
      communicationProfileId: communicationRouteDeps.newId(),
      householdId: ctx.householdId,
      studentProfileId: effectiveStudentProfileId,
    });
    const insightId = requestUrl(req).pathname.split("/").filter(Boolean).at(-2);
    if (!insightId) {
      return badRequest(res, "An inferred insight id is required");
    }

    const success = await communicationRouteDeps.repo.reviewInferredInsight({
      communicationInferredInsightId: insightId,
      communicationProfileId: profile.communicationProfileId,
      status: body.status,
      reviewedByUserId: ctx.authenticatedUserId,
      reviewNotes: body.reviewNotes ?? null,
    });
    if (!success) {
      return badRequest(res, "The selected inferred insight could not be reviewed");
    }

    await communicationRouteDeps.repo.createLearningEvent({
      communicationLearningEventId: communicationRouteDeps.newId(),
      communicationProfileId: profile.communicationProfileId,
      eventType: "summary_generated",
      sourceRole: ctx.authenticatedRoleType as any,
      signalJson: {
        insightId,
        reviewStatus: body.status,
      },
      interpretationJson: {
        reviewNotes: body.reviewNotes ?? null,
        target: "inferred_communication_pattern",
      },
    });

    return json(res, 200, { ok: true });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_COMMUNICATION") return forbidden(res, "Communication access is required");
    if (error?.message === "NO_STUDENT_PROFILE") return badRequest(res, "No student profile could be resolved for the authenticated context");
    throw error;
  }
}

export async function communicationSummaryRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await communicationRouteDeps.resolveRequestContext(req);
    requireCommunicationViewerRole(ctx.authenticatedRoleType);
    if (
      ctx.authenticatedRoleType === "coach" &&
      !hasCapability(
        { isSuperAdmin: !!ctx.isSuperAdmin, grantedCapabilities: ctx.effectiveCapabilities || [] },
        "communication_coach_context_view"
      )
    ) {
      return forbidden(res, "Coach communication context is not enabled for this account");
    }
    const effectiveStudentProfileId = await resolveCommunicationStudentProfileId(req, ctx);
    if (!effectiveStudentProfileId) {
      throw new Error("NO_STUDENT_PROFILE");
    }
    const profile = await communicationRouteDeps.repo.getOrCreateCommunicationProfile({
      communicationProfileId: communicationRouteDeps.newId(),
      householdId: ctx.householdId,
      studentProfileId: effectiveStudentProfileId,
    });

    const [parentProfile, studentPreferences, parentInputs, studentInputs, translationEvents, learningEvents, promptProgress, existingInsights] = await Promise.all([
      communicationRouteDeps.repo.getParentProfile(ctx.authenticatedUserId, effectiveStudentProfileId),
      communicationRouteDeps.repo.getStudentPreferences(effectiveStudentProfileId),
      communicationRouteDeps.repo.listParentInputs(profile.communicationProfileId),
      communicationRouteDeps.repo.listStudentInputs(profile.communicationProfileId),
      communicationRouteDeps.repo.listTranslationEvents(profile.communicationProfileId, 8),
      communicationRouteDeps.repo.listLearningEvents(profile.communicationProfileId, 100),
      communicationRouteDeps.repo.listPromptProgressForProfile(profile.communicationProfileId),
      communicationRouteDeps.repo.listInferredInsights(profile.communicationProfileId),
    ]);

    const summary = buildCommunicationSummary({
      viewerRole: ctx.authenticatedRoleType as any,
      viewerUserId: ctx.authenticatedUserId,
      parentInputs,
      studentInputs,
      parentProfile,
      studentPreferences,
      translationEvents,
    });

    const parentCompletion = calculateCommunicationProfileCompletion({
      audience: "parent",
      answeredPromptKeys: parentInputs.map((item) => item.promptKey),
    });
    const studentCompletion = calculateCommunicationProfileCompletion({
      audience: "student",
      answeredPromptKeys: studentInputs.map((item) => item.promptKey),
    });
    const inferredInsights = deriveCommunicationInferredInsights({
      communicationProfileId: profile.communicationProfileId,
      parentInputs,
      studentInputs,
      studentPreferences,
      existingInsights,
    });
    await Promise.all(
      inferredInsights.map((item) => communicationRouteDeps.repo.upsertInferredInsight(item))
    );
    const analytics = buildCommunicationAnalytics({
      promptProgress,
      translationEvents,
      learningEvents,
    });

    return json(res, 200, {
      ok: true,
      profile,
      summary,
      completion: {
        parent: parentCompletion,
        student: studentCompletion,
      },
      inferredInsights,
      analytics,
      latestTranslationEventId: translationEvents[0]?.communicationTranslationEventId || null,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_COMMUNICATION") return forbidden(res, "Communication access is required");
    if (error?.message === "NO_STUDENT_PROFILE") return badRequest(res, "No student profile could be resolved for the authenticated context");
    throw error;
  }
}
