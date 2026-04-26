import crypto from "node:crypto";
import type {
  CommunicationActorRole,
  CommunicationAnalyticsSummary,
  CommunicationFeedbackRating,
  CommunicationInferredInsightRecord,
  CommunicationLearningEventRecord,
  CommunicationPromptAudience,
  CommunicationPromptProgressRecord,
  CommunicationPromptStatus,
  CommunicationSensitivityLevel,
  CommunicationTone,
  CommunicationTranslationEventRecord,
  CommunicationTranslationGoal,
  CommunicationVisibilityScope,
  ParentCommunicationInputRecord,
  ParentCommunicationProfileRecord,
  StudentCommunicationInputRecord,
  StudentCommunicationPreferencesRecord,
} from "../../../../../packages/shared/src/contracts/communication";
import type { LlmTelemetryContext } from "../../../../../packages/shared/src/contracts/llm";
import { runStructuredCommunicationBridge } from "../openai/responsesClient";
import { summarizeCommunicationPreferences } from "./preferences";

export type CommunicationPromptDefinition = {
  key: string;
  audience: CommunicationPromptAudience;
  category: string;
  title: string;
  questionText: string;
  helperText: string;
  placeholder: string;
  suggestedVisibilityScope: CommunicationVisibilityScope;
  suggestedSensitivityLevel: CommunicationSensitivityLevel;
};

export const PARENT_COMMUNICATION_PROMPTS: CommunicationPromptDefinition[] = [
  {
    key: "parent_motivation",
    audience: "parent",
    category: "parent_motivation",
    title: "Why are you here?",
    questionText: "What are you most hoping this system helps your child achieve?",
    helperText: "Start with the outcome you care about most.",
    placeholder: "I want college planning to feel calmer and more actionable for them.",
    suggestedVisibilityScope: "shared_summary_only",
    suggestedSensitivityLevel: "medium",
  },
  {
    key: "parent_worries",
    audience: "parent",
    category: "worries_and_risks",
    title: "What worries you most?",
    questionText: "What worries you most about your child’s college-to-career transition?",
    helperText: "This can include college experience, employability, readiness, or launch concerns.",
    placeholder: "I worry they will wait too long to build experience and then feel behind.",
    suggestedVisibilityScope: "visible_to_household_admin",
    suggestedSensitivityLevel: "high",
  },
  {
    key: "student_strengths_parent_view",
    audience: "parent",
    category: "student_strengths",
    title: "Strengths they may not see",
    questionText: "What strengths does your child sometimes fail to see in themselves?",
    helperText: "These can guide encouragement and coaching language.",
    placeholder: "They are more persistent than they realize once they feel safe to start.",
    suggestedVisibilityScope: "shared_summary_only",
    suggestedSensitivityLevel: "low",
  },
  {
    key: "friction_points_parent_view",
    audience: "parent",
    category: "student_friction_points",
    title: "Known friction points",
    questionText: "Are there topics that usually create tension?",
    helperText: "This helps the system slow down or soften how it frames those topics.",
    placeholder: "Comparisons to peers and questions about money usually escalate quickly.",
    suggestedVisibilityScope: "visible_to_system_only",
    suggestedSensitivityLevel: "high",
  },
  {
    key: "overwhelm_signals",
    audience: "parent",
    category: "student_friction_points",
    title: "When overwhelm shows up",
    questionText: "When your child feels overwhelmed, what do you usually notice first?",
    helperText: "Short observable details are useful here.",
    placeholder: "They get quieter, avoid the topic, and stop replying to longer messages.",
    suggestedVisibilityScope: "shared_summary_only",
    suggestedSensitivityLevel: "medium",
  },
  {
    key: "helpful_reminders_parent",
    audience: "parent",
    category: "communication_style",
    title: "What tends to help",
    questionText: "What kinds of reminders tend to help?",
    helperText: "Think about timing, tone, and format.",
    placeholder: "Short reminders with one clear next step land better than long checklists.",
    suggestedVisibilityScope: "visible_to_parent",
    suggestedSensitivityLevel: "low",
  },
  {
    key: "backfire_reminders_parent",
    audience: "parent",
    category: "what_has_not_worked_before",
    title: "What tends to backfire",
    questionText: "What kinds of reminders tend to backfire?",
    helperText: "This helps the translator avoid patterns that make things worse.",
    placeholder: "Rapid follow-up texts feel like pressure and usually shut the conversation down.",
    suggestedVisibilityScope: "visible_to_system_only",
    suggestedSensitivityLevel: "high",
  },
  {
    key: "language_to_avoid_parent",
    audience: "parent",
    category: "sensitive_topics",
    title: "Language to avoid",
    questionText: "What should the system avoid saying or doing if it wants your child to stay engaged?",
    helperText: "Mention tones, phrases, or habits to avoid.",
    placeholder: "Avoid sounding disappointed or implying they are irresponsible.",
    suggestedVisibilityScope: "visible_to_system_only",
    suggestedSensitivityLevel: "high",
  },
  {
    key: "family_pattern_parent",
    audience: "parent",
    category: "family_communication_patterns",
    title: "Family communication pattern",
    questionText: "What family communication pattern matters here?",
    helperText: "This can include habits, misunderstandings, or old loops.",
    placeholder: "We move into problem-solving quickly, and they often experience that as criticism.",
    suggestedVisibilityScope: "shared_summary_only",
    suggestedSensitivityLevel: "medium",
  },
  {
    key: "parent_experience_expectations",
    audience: "parent",
    category: "parent_experience_and_expectations",
    title: "Your experience matters too",
    questionText: "Is there anything about your own college or career experience that may influence your expectations?",
    helperText: "This helps the system separate your history from the student’s needs.",
    placeholder: "I had to figure everything out alone, so I tend to overcorrect by pushing structure early.",
    suggestedVisibilityScope: "visible_to_system_only",
    suggestedSensitivityLevel: "medium",
  },
];

export const STUDENT_COMMUNICATION_PROMPTS: CommunicationPromptDefinition[] = [
  {
    key: "student_reminder_style",
    audience: "student",
    category: "reminder_preferences",
    title: "How reminders land best",
    questionText: "How do you like to be reminded about important stuff?",
    helperText: "Keep it simple. A few words is enough.",
    placeholder: "One short message with the most important next step.",
    suggestedVisibilityScope: "shared_summary_only",
    suggestedSensitivityLevel: "low",
  },
  {
    key: "student_shutdown_triggers",
    audience: "student",
    category: "stress_points",
    title: "What makes you shut down",
    questionText: "What kind of messages make you shut down?",
    helperText: "This helps the system and adults avoid unhelpful patterns.",
    placeholder: "Long messages, guilt, and being compared to other people.",
    suggestedVisibilityScope: "visible_to_system_only",
    suggestedSensitivityLevel: "high",
  },
  {
    key: "student_helpful_encouragement",
    audience: "student",
    category: "motivation_style",
    title: "What encouragement helps",
    questionText: "What kind of encouragement actually helps?",
    helperText: "Think about what makes it easier to take the next step.",
    placeholder: "Calm encouragement and small concrete next steps help most.",
    suggestedVisibilityScope: "shared_summary_only",
    suggestedSensitivityLevel: "low",
  },
  {
    key: "student_parent_misunderstanding",
    audience: "student",
    category: "parent_communication_friction",
    title: "What adults misunderstand",
    questionText: "What do adults sometimes misunderstand about you?",
    helperText: "You can answer broadly or just name one thing.",
    placeholder: "People think I am avoiding things when I am actually overwhelmed and not sure where to start.",
    suggestedVisibilityScope: "visible_to_system_only",
    suggestedSensitivityLevel: "high",
  },
  {
    key: "student_stress_worseners",
    audience: "student",
    category: "stress_points",
    title: "What makes stress worse",
    questionText: "When school or career planning feels stressful, what usually makes it worse?",
    helperText: "This could be timing, tone, pressure, or too much information.",
    placeholder: "Too many steps at once and last-minute pressure make it worse fast.",
    suggestedVisibilityScope: "visible_to_system_only",
    suggestedSensitivityLevel: "high",
  },
  {
    key: "student_tone_preference",
    audience: "student",
    category: "tone_preferences",
    title: "Direct or softer?",
    questionText: "Do you prefer direct advice or softer suggestions?",
    helperText: "Either answer is fine.",
    placeholder: "Direct is okay if it is respectful and short.",
    suggestedVisibilityScope: "shared_summary_only",
    suggestedSensitivityLevel: "low",
  },
  {
    key: "student_useful_system",
    audience: "student",
    category: "goals_in_own_words",
    title: "What would make this useful",
    questionText: "What would make this system feel useful instead of annoying?",
    helperText: "Tell us what would help it earn your attention.",
    placeholder: "Keep it practical, short, and connected to what I actually want next.",
    suggestedVisibilityScope: "shared_summary_only",
    suggestedSensitivityLevel: "medium",
  },
];

export function getCommunicationPromptCatalog(audience: CommunicationPromptAudience) {
  return audience === "parent"
    ? PARENT_COMMUNICATION_PROMPTS
    : STUDENT_COMMUNICATION_PROMPTS;
}

export function canViewCommunicationScope(input: {
  viewerRole: CommunicationActorRole;
  viewerUserId?: string | null;
  ownerUserId?: string | null;
  visibilityScope: CommunicationVisibilityScope;
}): boolean {
  const { viewerRole, viewerUserId, ownerUserId, visibilityScope } = input;
  if (viewerRole === "admin") {
    return true;
  }
  if (viewerUserId && ownerUserId && viewerUserId === ownerUserId) {
    return true;
  }
  if (visibilityScope === "visible_to_system_only") {
    return false;
  }
  if (visibilityScope === "shared_summary_only") {
    return false;
  }
  if (visibilityScope === "private_to_user") {
    return !!viewerUserId && !!ownerUserId && viewerUserId === ownerUserId;
  }
  if (visibilityScope === "visible_to_household_admin") {
    return viewerRole === "parent";
  }
  if (visibilityScope === "visible_to_student") {
    return viewerRole === "student";
  }
  if (visibilityScope === "visible_to_parent") {
    return viewerRole === "parent";
  }
  if (visibilityScope === "visible_to_coach") {
    return viewerRole === "coach";
  }
  return false;
}

export function canSystemUseVisibilityScope(scope: CommunicationVisibilityScope): boolean {
  return scope !== "visible_to_parent" || true;
}

export function calculateCommunicationProfileCompletion(input: {
  audience: CommunicationPromptAudience;
  answeredPromptKeys: string[];
}) {
  const total = getCommunicationPromptCatalog(input.audience).length;
  const answered = new Set(input.answeredPromptKeys).size;
  return {
    total,
    answered,
    completionPercent: total ? Math.round((answered / total) * 100) : 0,
  };
}

export function selectNextCommunicationPrompt(input: {
  audience: CommunicationPromptAudience;
  progress: CommunicationPromptProgressRecord[];
  answeredPromptKeys: string[];
}) {
  const progressByKey = new Map(input.progress.map((item) => [item.promptKey, item.status]));
  const answered = new Set(input.answeredPromptKeys);
  const prompts = getCommunicationPromptCatalog(input.audience);

  const preferred =
    prompts.find((prompt) => {
      const status = progressByKey.get(prompt.key);
      return status === "revisit_later";
    }) ||
    prompts.find((prompt) => !answered.has(prompt.key) && progressByKey.get(prompt.key) !== "skipped") ||
    prompts.find((prompt) => !answered.has(prompt.key)) ||
    null;

  return preferred;
}

function truncateSentence(value: string, maxLength = 220) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

function filteredSummaryLines<T extends { questionText: string; responseText: string; visibilityScope: CommunicationVisibilityScope; category: string }>(
  items: T[],
  viewerRole: CommunicationActorRole,
  viewerUserId?: string | null
) {
  const visibleDetails = items
    .filter((item) =>
      canViewCommunicationScope({
        viewerRole,
        viewerUserId,
        ownerUserId:
          (item as { parentUserId?: string; studentUserId?: string }).parentUserId ||
          (item as { parentUserId?: string; studentUserId?: string }).studentUserId ||
          null,
        visibilityScope: item.visibilityScope,
      })
    )
    .slice(0, 4)
    .map((item) => `${item.questionText}: ${truncateSentence(item.responseText, 180)}`);

  const sharedThemes = Array.from(
    new Set(
      items
        .filter((item) => item.visibilityScope === "shared_summary_only")
        .map((item) => item.category)
    )
  ).map((category) => category.replace(/_/g, " "));

  return { visibleDetails, sharedThemes };
}

export function buildCommunicationSummary(input: {
  viewerRole: CommunicationActorRole;
  viewerUserId?: string | null;
  parentInputs: ParentCommunicationInputRecord[];
  studentInputs: StudentCommunicationInputRecord[];
  parentProfile: ParentCommunicationProfileRecord | null;
  studentPreferences: StudentCommunicationPreferencesRecord | null;
  translationEvents: CommunicationTranslationEventRecord[];
}) {
  const parentLines = filteredSummaryLines(input.parentInputs, input.viewerRole, input.viewerUserId);
  const studentLines = filteredSummaryLines(input.studentInputs, input.viewerRole, input.viewerUserId);
  const preferenceSummary = summarizeCommunicationPreferences(input.studentPreferences);
  const latestEvent = input.translationEvents[0] || null;

  const frictionSignals = [
    ...input.parentInputs
      .filter((item) => item.sensitivityLevel === "high")
      .map((item) => `${item.category.replace(/_/g, " ")} needs extra care`),
    ...input.studentInputs
      .filter((item) => item.sensitivityLevel === "high")
      .map((item) => `${item.category.replace(/_/g, " ")} is a stress point`),
  ];

  return {
    parentVisibleDetails: parentLines.visibleDetails,
    studentVisibleDetails: studentLines.visibleDetails,
    sharedThemes: Array.from(new Set([...parentLines.sharedThemes, ...studentLines.sharedThemes])),
    frictionSignals: Array.from(new Set(frictionSignals)).slice(0, 6),
    recentTranslationActivity: latestEvent
      ? {
          direction: `${latestEvent.sourceRole}_to_${latestEvent.targetRole}`,
          createdAt: latestEvent.createdAt || null,
          feedbackRating: latestEvent.feedbackRating || null,
        }
      : null,
    preferenceNotes: preferenceSummary.studentPromptNotes,
    coachSuggestions: Array.from(
      new Set([
        preferenceSummary.parentPromptNotes[0],
        frictionSignals[0] ? `Slow down around ${frictionSignals[0].replace(/ needs extra care| is a stress point/, "")}.` : null,
        input.studentPreferences?.preferredTone
          ? `Use a ${input.studentPreferences.preferredTone.replace(/_/g, " ")} tone when the student is under pressure.`
          : null,
      ].filter(Boolean) as string[])
    ).slice(0, 4),
  };
}

export interface CommunicationBridgeRequest {
  sourceRole: "parent" | "student";
  targetRole: "parent" | "student";
  translationGoal: CommunicationTranslationGoal;
  tone: CommunicationTone | null;
  originalText: string;
  studentName: string;
  studentGoal: string;
  parentProfile: ParentCommunicationProfileRecord | null;
  studentPreferences: StudentCommunicationPreferencesRecord | null;
  parentInputs: ParentCommunicationInputRecord[];
  studentInputs: StudentCommunicationInputRecord[];
  householdId?: string | null;
  studentProfileId: string;
  careerGoalName?: string | null;
  scoringHighlights?: string[];
}

export interface CommunicationBridgeResult {
  mode: "llm" | "fallback";
  llmRunId?: string | null;
  output: {
    rewrittenMessage: string;
    shorterVersion: string;
    softerVersion: string;
    directVersion: string;
    rationale: string;
    riskFlags: string[];
    suggestedNextStep: string;
    confidence: "low" | "medium" | "high";
    sourceContextUsed: string[];
    privacyNotes: string[];
    likelyMeaning: string | null;
    suggestedResponse: string | null;
  };
  degradedReason?: string;
}

function buildVisiblePromptNotes(records: Array<ParentCommunicationInputRecord | StudentCommunicationInputRecord>, maxItems = 5) {
  return records.slice(0, maxItems).map((item) => ({
    question: item.questionText,
    category: item.category,
    response: truncateSentence(item.responseText, 180),
    visibilityScope: item.visibilityScope,
  }));
}

function buildBridgeSystemPrompt(input: CommunicationBridgeRequest) {
  return [
    "You are the Rising Senior communication translator.",
    "Your job is to lower friction, preserve dignity, and make meaning clearer between a parent and student.",
    "Do not manipulate either person.",
    "Do not reveal hidden private notes or claim facts that the user did not state.",
    "You may use context to guide tone, pacing, and framing, but you must not expose hidden source details.",
    "Prefer clarity, empathy, brevity, and one concrete next step.",
    `Direction: ${input.sourceRole} to ${input.targetRole}.`,
  ].join("\n");
}

function buildBridgeUserPrompt(input: CommunicationBridgeRequest) {
  const preferenceSummary = summarizeCommunicationPreferences(input.studentPreferences);
  return JSON.stringify(
    {
      sourceRole: input.sourceRole,
      targetRole: input.targetRole,
      translationGoal: input.translationGoal,
      requestedTone: input.tone,
      originalText: input.originalText,
      student: {
        name: input.studentName,
        goal: input.studentGoal,
      },
      careerGoalName: input.careerGoalName || null,
      scoringHighlights: input.scoringHighlights || [],
      parentProfile: input.parentProfile
        ? {
            mainWorries: input.parentProfile.mainWorries,
            usualApproach: input.parentProfile.usualApproach,
            whatDoesNotWork: input.parentProfile.whatDoesNotWork,
            wantsToImprove: input.parentProfile.wantsToImprove,
            preferredCommunicationStyle: input.parentProfile.preferredCommunicationStyle,
          }
        : null,
      studentPreferences: input.studentPreferences,
      studentPreferenceNotes: preferenceSummary.parentPromptNotes,
      parentContext: buildVisiblePromptNotes(input.parentInputs),
      studentContext: buildVisiblePromptNotes(input.studentInputs),
      instructions: [
        "Return a rewritten message that is kind, clear, and concrete.",
        "Also provide shorter, softer, and more direct variants.",
        "Explain why you changed the wording.",
        "Include likely meaning and a suggested parent response when the source role is student.",
        "Flag conflict or stress risks without sounding alarmist.",
      ],
    },
    null,
    2
  );
}

function buildBridgeTelemetry(input: CommunicationBridgeRequest): LlmTelemetryContext {
  return {
    runType: "communication_translation",
    promptVersion: "communication_bridge_v1",
    studentProfileId: input.studentProfileId,
    householdId: input.householdId ?? null,
    inputPayload: {
      sourceRole: input.sourceRole,
      targetRole: input.targetRole,
      translationGoal: input.translationGoal,
      tone: input.tone,
      careerGoalName: input.careerGoalName || null,
    },
  };
}

function buildFallbackBridge(input: CommunicationBridgeRequest, degradedReason?: string): CommunicationBridgeResult {
  const softer =
    input.sourceRole === "parent"
      ? `I want to check in about this without adding pressure: ${input.originalText.trim()}`
      : `I want to explain this clearly without sounding reactive: ${input.originalText.trim()}`;
  const direct =
    input.sourceRole === "parent"
      ? `Here is the main point I need to raise: ${input.originalText.trim()}`
      : `Here is what I am trying to say: ${input.originalText.trim()}`;
  const rewritten =
    input.sourceRole === "parent"
      ? `I care about how things are going for you, and I want to make this easier to talk about. ${input.originalText.trim()}`
      : `I want you to know what this feels like from my side. ${input.originalText.trim()}`;

  return {
    mode: "fallback",
    degradedReason,
    output: {
      rewrittenMessage: rewritten,
      shorterVersion: truncateSentence(input.originalText, 160),
      softerVersion: softer,
      directVersion: direct,
      rationale:
        "This fallback version keeps the message shorter, names the goal more clearly, and reduces language that could sound accusatory or defensive.",
      riskFlags: input.originalText.match(/\b(always|never|lazy|disappointed|pressure|ashamed)\b/i)
        ? ["Potentially triggering language in the original message."]
        : [],
      suggestedNextStep:
        input.sourceRole === "parent"
          ? "Send one short message and leave room for a response instead of stacking follow-ups."
          : "Send the clearer version and ask for one small next step instead of trying to solve everything at once.",
      confidence: "low",
      sourceContextUsed: [
        input.studentPreferences ? "Saved student communication preferences" : "No saved student communication preferences",
        input.parentProfile ? "Saved parent communication profile" : "No saved parent communication profile",
      ],
      privacyNotes: [
        "Private notes were used only to guide tone and were not exposed directly.",
      ],
      likelyMeaning:
        input.sourceRole === "student"
          ? "The student may be asking for less pressure and more concrete support."
          : null,
      suggestedResponse:
        input.sourceRole === "student"
          ? "Acknowledge the feeling first, then ask what one helpful next step would look like."
          : null,
    },
  };
}

export async function generateCommunicationBridge(input: CommunicationBridgeRequest): Promise<CommunicationBridgeResult> {
  try {
    const result = await runStructuredCommunicationBridge({
      systemPrompt: buildBridgeSystemPrompt(input),
      userPrompt: buildBridgeUserPrompt(input),
      telemetry: buildBridgeTelemetry(input),
    });
    return {
      mode: "llm",
      llmRunId: result.llmRunId ?? null,
      output: result.output,
    };
  } catch (error) {
    return buildFallbackBridge(input, error instanceof Error ? error.message : String(error));
  }
}

export function feedbackToLearningSignal(rating: CommunicationFeedbackRating, notes?: string | null) {
  return {
    rating,
    notes: notes || null,
    helpful: rating === "helpful",
  };
}

export function deriveCommunicationInferredInsights(input: {
  communicationProfileId: string;
  parentInputs: ParentCommunicationInputRecord[];
  studentInputs: StudentCommunicationInputRecord[];
  studentPreferences: StudentCommunicationPreferencesRecord | null;
  existingInsights?: CommunicationInferredInsightRecord[];
}) {
  const existingByKey = new Map((input.existingInsights || []).map((item) => [item.insightKey, item]));
  const now = new Date().toISOString();
  const results: CommunicationInferredInsightRecord[] = [];

  const helpfulReminder = input.parentInputs.find((item) => item.promptKey === "helpful_reminders_parent");
  const backfireReminder = input.parentInputs.find((item) => item.promptKey === "backfire_reminders_parent");
  if (helpfulReminder || backfireReminder) {
    const existing = existingByKey.get("reminder-pattern");
    results.push({
      communicationInferredInsightId: existing?.communicationInferredInsightId || crypto.randomUUID(),
      communicationProfileId: input.communicationProfileId,
      insightKey: "reminder-pattern",
      insightType: "reminder_pattern",
      title: "Reminder style pattern",
      summaryText: helpfulReminder && backfireReminder
        ? `Shorter, calmer reminders tend to help more than high-pressure follow-ups. Helpful pattern: ${truncateSentence(helpfulReminder.responseText, 140)} Backfire pattern: ${truncateSentence(backfireReminder.responseText, 140)}`
        : truncateSentence((helpfulReminder || backfireReminder)!.responseText, 220),
      evidenceJson: {
        helpfulReminderPromptKey: helpfulReminder?.promptKey || null,
        backfireReminderPromptKey: backfireReminder?.promptKey || null,
      },
      confidenceLabel: helpfulReminder && backfireReminder ? "high" : "medium",
      status: existing?.status || "pending_review",
      reviewedByUserId: existing?.reviewedByUserId || null,
      reviewedAt: existing?.reviewedAt || null,
      reviewNotes: existing?.reviewNotes || null,
      lastDerivedAt: now,
    });
  }

  const tonePreference =
    input.studentPreferences?.preferredTone ||
    input.studentInputs.find((item) => item.promptKey === "student_tone_preference")?.responseText ||
    null;
  if (tonePreference) {
    const existing = existingByKey.get("tone-preference");
    results.push({
      communicationInferredInsightId: existing?.communicationInferredInsightId || crypto.randomUUID(),
      communicationProfileId: input.communicationProfileId,
      insightKey: "tone-preference",
      insightType: "tone_preference",
      title: "Tone preference pattern",
      summaryText:
        typeof tonePreference === "string" && input.studentPreferences?.preferredTone
          ? `The student appears to respond best to a ${tonePreference.replace(/_/g, " ")} tone.`
          : `The student described this tone preference: ${truncateSentence(String(tonePreference), 180)}`,
      evidenceJson: {
        preferredTone: input.studentPreferences?.preferredTone || null,
        promptKey: input.studentInputs.find((item) => item.promptKey === "student_tone_preference")?.promptKey || null,
      },
      confidenceLabel: input.studentPreferences?.preferredTone ? "high" : "medium",
      status: existing?.status || "pending_review",
      reviewedByUserId: existing?.reviewedByUserId || null,
      reviewedAt: existing?.reviewedAt || null,
      reviewNotes: existing?.reviewNotes || null,
      lastDerivedAt: now,
    });
  }

  const frictionSources = [
    ...input.parentInputs.filter((item) => item.sensitivityLevel === "high"),
    ...input.studentInputs.filter((item) => item.sensitivityLevel === "high"),
  ];
  if (frictionSources.length) {
    const existing = existingByKey.get("friction-pattern");
    results.push({
      communicationInferredInsightId: existing?.communicationInferredInsightId || crypto.randomUUID(),
      communicationProfileId: input.communicationProfileId,
      insightKey: "friction-pattern",
      insightType: "friction_pattern",
      title: "Likely friction pattern",
      summaryText: `High-sensitivity topics are clustering around ${Array.from(new Set(frictionSources.map((item) => item.category.replace(/_/g, " ")))).slice(0, 3).join(", ")}. These topics likely need slower pacing and clearer framing.`,
      evidenceJson: {
        categories: Array.from(new Set(frictionSources.map((item) => item.category))),
        count: frictionSources.length,
      },
      confidenceLabel: frictionSources.length >= 2 ? "high" : "medium",
      status: existing?.status || "pending_review",
      reviewedByUserId: existing?.reviewedByUserId || null,
      reviewedAt: existing?.reviewedAt || null,
      reviewNotes: existing?.reviewNotes || null,
      lastDerivedAt: now,
    });
  }

  const strengthSignal =
    input.parentInputs.find((item) => item.promptKey === "student_strengths_parent_view") ||
    input.studentInputs.find((item) => item.promptKey === "student_helpful_encouragement");
  if (strengthSignal) {
    const existing = existingByKey.get("support-pattern");
    results.push({
      communicationInferredInsightId: existing?.communicationInferredInsightId || crypto.randomUUID(),
      communicationProfileId: input.communicationProfileId,
      insightKey: "support-pattern",
      insightType: "support_pattern",
      title: "Support pattern",
      summaryText: `A constructive support pattern is emerging: ${truncateSentence(strengthSignal.responseText, 200)}`,
      evidenceJson: {
        promptKey: strengthSignal.promptKey,
        category: strengthSignal.category,
      },
      confidenceLabel: "medium",
      status: existing?.status || "pending_review",
      reviewedByUserId: existing?.reviewedByUserId || null,
      reviewedAt: existing?.reviewedAt || null,
      reviewNotes: existing?.reviewNotes || null,
      lastDerivedAt: now,
    });
  }

  return results;
}

export function buildCommunicationAnalytics(input: {
  promptProgress: CommunicationPromptProgressRecord[];
  translationEvents: CommunicationTranslationEventRecord[];
  learningEvents: CommunicationLearningEventRecord[];
}): CommunicationAnalyticsSummary {
  const byAudience = {
    parent: { answered: 0, skipped: 0, revisitLater: 0, totalPrompts: PARENT_COMMUNICATION_PROMPTS.length },
    student: { answered: 0, skipped: 0, revisitLater: 0, totalPrompts: STUDENT_COMMUNICATION_PROMPTS.length },
  };
  const promptSignalCounts = new Map<string, { promptKey: string; audience: CommunicationPromptAudience; status: CommunicationPromptStatus; count: number }>();

  for (const progress of input.promptProgress) {
    if (progress.status === "answered") byAudience[progress.role].answered += 1;
    if (progress.status === "skipped") byAudience[progress.role].skipped += 1;
    if (progress.status === "revisit_later") byAudience[progress.role].revisitLater += 1;
  }

  for (const event of input.learningEvents) {
    const signal = (event.signalJson || {}) as { promptKey?: string; status?: CommunicationPromptStatus };
    if (!signal.promptKey || !signal.status) continue;
    const audience = event.sourceRole === "parent" ? "parent" : "student";
    const key = `${audience}:${signal.promptKey}:${signal.status}`;
    const current = promptSignalCounts.get(key);
    promptSignalCounts.set(key, {
      promptKey: signal.promptKey,
      audience,
      status: signal.status,
      count: (current?.count || 0) + 1,
    });
  }

  const feedbackBreakdown: CommunicationAnalyticsSummary["feedbackBreakdown"] = {
    helpful: 0,
    not_helpful: 0,
    too_direct: 0,
    too_soft: 0,
    missed_the_point: 0,
    made_it_worse: 0,
    other: 0,
  };
  for (const event of input.translationEvents) {
    if (event.feedbackRating) {
      feedbackBreakdown[event.feedbackRating] += 1;
    }
  }

  return {
    promptStats: byAudience,
    translationStats: {
      totalTranslations: input.translationEvents.length,
      feedbackCount: input.translationEvents.filter((event) => !!event.feedbackRating).length,
      latestCreatedAt: input.translationEvents[0]?.createdAt || null,
    },
    feedbackBreakdown,
    topPromptSignals: Array.from(promptSignalCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 6),
  };
}

export function buildPromptLearningEvent(input: {
  promptKey: string;
  status: CommunicationPromptProgressRecord["status"];
  role: CommunicationActorRole;
}): Pick<CommunicationLearningEventRecord, "eventType" | "sourceRole" | "signalJson" | "interpretationJson"> {
  return {
    eventType:
      input.status === "answered"
        ? "prompt_answered"
        : input.status === "revisit_later"
          ? "prompt_revisit_requested"
          : "prompt_skipped",
    sourceRole: input.role,
    signalJson: {
      promptKey: input.promptKey,
      status: input.status,
    },
    interpretationJson: {
      nextAction:
        input.status === "answered"
          ? "use_response_in_future_translation_context"
          : input.status === "revisit_later"
            ? "surface_prompt_again_later"
            : "avoid_reprompting_immediately",
    },
  };
}
