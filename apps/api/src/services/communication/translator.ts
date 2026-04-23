import type {
  CommunicationChannel,
  CommunicationTranslationStrategyRecord,
  ParentCommunicationEntryRecord,
  ParentCommunicationProfileRecord,
  StudentCommunicationPreferencesRecord,
} from "../../../../../packages/shared/src/contracts/communication";
import type { LlmTelemetryContext } from "../../../../../packages/shared/src/contracts/llm";
import type { ScoringOutput } from "../../../../../packages/shared/src/scoring/types";
import { runStructuredCommunicationTranslation } from "../openai/responsesClient";
import { summarizeCommunicationPreferences } from "./preferences";

export interface CommunicationTranslationInput {
  studentProfileId: string;
  householdId?: string | null;
  parentUserId: string;
  studentName: string;
  studentGoal: string;
  parentEntry: ParentCommunicationEntryRecord;
  parentProfile: ParentCommunicationProfileRecord | null;
  studentPreferences: StudentCommunicationPreferencesRecord | null;
  scoring: ScoringOutput;
  selectedChannel?: CommunicationChannel | null;
  priorOutcomeNotes?: string[];
}

export interface CommunicationTranslationResult {
  strategy: Omit<CommunicationTranslationStrategyRecord, "communicationStrategyId" | "createdAt" | "updatedAt">;
  degradedReason?: string;
}

function containsRiskyLanguage(text: string): boolean {
  return /\b(always|never|lazy|ungrateful|ashamed|disappointed|threat|punish|failure|wasting)\b/i.test(text);
}

function isSensitiveEntry(input: CommunicationTranslationInput): boolean {
  if (input.parentEntry.category === "emotional_motivational_concern") {
    return true;
  }

  const body = [
    input.parentEntry.parentConcerns,
    input.parentEntry.freeformContext,
    input.parentEntry.priorAttemptsThatDidNotWork,
  ]
    .filter(Boolean)
    .join(" ");

  return containsRiskyLanguage(body) || input.parentEntry.urgency === "urgent";
}

function buildFallbackStrategy(input: CommunicationTranslationInput, degradedReason?: string) {
  const preferenceSummary = summarizeCommunicationPreferences(input.studentPreferences);
  const sensitive = isSensitiveEntry(input);
  const withholdForConsent = preferenceSummary.deliveryConsentState !== "granted";
  const withholdForSafety = sensitive && input.parentEntry.deliveryIntent !== "context_only";
  const recommendedChannel =
    input.selectedChannel ||
    input.studentPreferences?.preferredChannels.find(
      (channel) => !input.studentPreferences?.dislikedChannels.includes(channel)
    ) ||
    null;

  const withholdDelivery = withholdForConsent || withholdForSafety;
  const withholdReason = withholdForConsent
    ? "Student consent is not currently on file for translated parent-originated messages."
    : withholdForSafety
      ? "This topic is sensitive enough that a human review should happen before any delivery."
      : null;

  return {
    strategy: {
      parentCommunicationEntryId: input.parentEntry.parentCommunicationEntryId,
      parentUserId: input.parentUserId,
      studentProfileId: input.studentProfileId,
      householdId: input.householdId ?? null,
      sourceLlmRunId: null,
      generationMode: "fallback" as const,
      consentState: preferenceSummary.deliveryConsentState,
      status: withholdDelivery ? ("withheld" as const) : sensitive ? ("review_required" as const) : ("generated" as const),
      recommendedChannel,
      recommendedTone: input.studentPreferences?.preferredTone || "neutral",
      recommendedTiming:
        input.studentPreferences?.bestTimeOfDay
          ? `Prefer ${input.studentPreferences.bestTimeOfDay.replace(/_/g, " ")} when the student is not rushed.`
          : "Choose a calm moment instead of delivering this in the middle of conflict.",
      recommendedFrequency: input.studentPreferences?.preferredFrequency || "as_needed",
      defensivenessRisk: sensitive ? "high" as const : "medium" as const,
      reasonForRecommendation: [
        "This fallback strategy was assembled from the saved parent entry, the student communication preferences on file, and the current readiness context.",
        input.scoring.topRisks[0] ? `Current student risk context: ${input.scoring.topRisks[0]}.` : "",
        degradedReason ? `LLM detail: ${degradedReason}` : "",
      ].filter(Boolean).join(" "),
      studentFacingMessageDraft: withholdDelivery
        ? "This message should not be sent yet."
        : `Your parent asked for help raising a concern about ${input.parentEntry.category.replace(/_/g, " ")}. They want to support you without adding pressure. Would it help to talk through one small next step together?`,
      parentFacingExplanation: withholdDelivery
        ? "The system is holding this message because the current consent or sensitivity state does not support direct delivery."
        : "The message was shortened, made more neutral, and framed around one constructive next step because that is more likely to be received without triggering defensiveness.",
      whatNotToSay:
        "Avoid guilt, exaggeration, threats, or framing the student as irresponsible or unwilling to listen.",
      humanReviewRecommended: sensitive || withholdDelivery,
      withholdDelivery,
      withholdReason,
      structuredPayload: {
        basedOn: {
          studentPromptNotes: preferenceSummary.studentPromptNotes,
          parentPromptNotes: preferenceSummary.parentPromptNotes,
          topRisk: input.scoring.topRisks[0] || null,
          degradedReason: degradedReason || null,
        },
      },
    },
    degradedReason,
  };
}

function buildSystemPrompt(input: CommunicationTranslationInput): string {
  return [
    "You are the Rising Senior communication translator.",
    "Your role is to help a parent communicate with a student respectfully and transparently.",
    "You are not a manipulation engine.",
    "Never use guilt, shame, coercion, exaggeration, threats, emotional blackmail, or deception.",
    "Never pretend that a parent-originated message came from the system.",
    "If consent is absent, or the topic is too sensitive for automatic delivery, set withholdDelivery to true and explain why.",
    "Return a structured strategy, not an essay.",
    "Keep the student-facing message short, respectful, and transparent.",
    `Current student goal context: ${input.studentGoal}`,
  ].join("\n");
}

function buildUserPrompt(input: CommunicationTranslationInput): string {
  const preferenceSummary = summarizeCommunicationPreferences(input.studentPreferences);
  const risky = isSensitiveEntry(input);

  return JSON.stringify(
    {
      student: {
        name: input.studentName,
        goal: input.studentGoal,
        communicationPreferences: input.studentPreferences,
        communicationNotes: preferenceSummary.parentPromptNotes,
      },
      parentProfile: input.parentProfile,
      parentEntry: input.parentEntry,
      selectedChannel: input.selectedChannel || null,
      consentState: preferenceSummary.deliveryConsentState,
      scoringSummary: {
        overallScore: input.scoring.overallScore,
        trajectoryStatus: input.scoring.trajectoryStatus,
        topRisks: input.scoring.topRisks.slice(0, 3),
        recommendations: input.scoring.recommendations.slice(0, 3).map((item) => item.title),
      },
      priorCommunicationOutcomes: input.priorOutcomeNotes || [],
      safetyFlags: {
        sensitiveEntry: risky,
      },
      instructions: [
        "Recommend the calmest viable channel and timing.",
        "If consent is not granted, withhold delivery.",
        "If the topic is highly sensitive, recommend review.",
        "Explain why the original parent framing was changed.",
        "Include what not to say.",
      ],
    },
    null,
    2
  );
}

function buildTelemetry(input: CommunicationTranslationInput): LlmTelemetryContext {
  return {
    runType: "communication_translation",
    promptVersion: "communication_translation_v1",
    studentProfileId: input.studentProfileId,
    householdId: input.householdId ?? null,
    inputPayload: {
      parentEntryId: input.parentEntry.parentCommunicationEntryId,
      category: input.parentEntry.category,
      urgency: input.parentEntry.urgency,
      deliveryIntent: input.parentEntry.deliveryIntent,
      selectedChannel: input.selectedChannel || null,
      consentState: summarizeCommunicationPreferences(input.studentPreferences).deliveryConsentState,
      topRisks: input.scoring.topRisks.slice(0, 3),
    },
  };
}

export async function generateCommunicationTranslation(
  input: CommunicationTranslationInput
): Promise<CommunicationTranslationResult> {
  const preferenceSummary = summarizeCommunicationPreferences(input.studentPreferences);

  try {
    const result = await runStructuredCommunicationTranslation({
      systemPrompt: buildSystemPrompt(input),
      userPrompt: buildUserPrompt(input),
      telemetry: buildTelemetry(input),
    });

    const output = result.output;
    const forcedWithhold =
      preferenceSummary.deliveryConsentState !== "granted" ||
      (isSensitiveEntry(input) && input.parentEntry.deliveryIntent !== "context_only");

    return {
      strategy: {
        parentCommunicationEntryId: input.parentEntry.parentCommunicationEntryId,
        parentUserId: input.parentUserId,
        studentProfileId: input.studentProfileId,
        householdId: input.householdId ?? null,
        sourceLlmRunId: result.llmRunId ?? null,
        generationMode: "llm",
        consentState: preferenceSummary.deliveryConsentState,
        status:
          forcedWithhold || output.withholdDelivery
            ? "withheld"
            : output.humanReviewRecommended
              ? "review_required"
              : "generated",
        recommendedChannel: output.recommendedChannel,
        recommendedTone: output.recommendedTone,
        recommendedTiming: output.recommendedTiming,
        recommendedFrequency: output.recommendedFrequency,
        defensivenessRisk: output.defensivenessRisk,
        reasonForRecommendation: output.reasonForRecommendation,
        studentFacingMessageDraft: output.studentFacingMessageDraft,
        parentFacingExplanation: output.parentFacingExplanation,
        whatNotToSay: output.whatNotToSay,
        humanReviewRecommended: output.humanReviewRecommended || isSensitiveEntry(input),
        withholdDelivery: forcedWithhold || output.withholdDelivery,
        withholdReason:
          preferenceSummary.deliveryConsentState !== "granted"
            ? "Student consent is not currently on file for translated parent-originated messages."
            : output.withholdReason,
        structuredPayload: {
          preferenceNotes: preferenceSummary.parentPromptNotes,
          priorOutcomeNotes: input.priorOutcomeNotes || [],
          selectedChannel: input.selectedChannel || null,
        },
      },
    };
  } catch (error) {
    const degradedReason = error instanceof Error ? error.message : String(error);
    return buildFallbackStrategy(input, degradedReason);
  }
}
