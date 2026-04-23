import type { StudentCommunicationPreferencesRecord } from "../../../../../packages/shared/src/contracts/communication";

export interface CommunicationPreferenceSummary {
  deliveryConsentState: "granted" | "withheld" | "unknown";
  preferredStyleLabel: string;
  studentPromptNotes: string[];
  parentPromptNotes: string[];
}

function titleCase(value: string): string {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function summarizeCommunicationPreferences(
  preferences: StudentCommunicationPreferencesRecord | null
): CommunicationPreferenceSummary {
  if (!preferences) {
    return {
      deliveryConsentState: "unknown",
      preferredStyleLabel: "direct",
      studentPromptNotes: [
        "No saved communication preferences are on file yet.",
      ],
      parentPromptNotes: [
        "No saved student communication preferences are on file yet.",
      ],
    };
  }

  const preferredFormats = preferences.preferredGuidanceFormats.map(titleCase);
  const preferredChannels = preferences.preferredChannels.map(titleCase);
  const dislikedChannels = preferences.dislikedChannels.map(titleCase);
  const sensitiveTopics = preferences.sensitiveTopics;

  return {
    deliveryConsentState: preferences.consentParentTranslatedMessages ? "granted" : "withheld",
    preferredStyleLabel:
      preferences.preferredTone === "summary_first"
        ? "summary"
        : preferences.preferredTone || preferredFormats[0]?.toLowerCase() || "direct",
    studentPromptNotes: [
      preferredChannels.length
        ? `Preferred channels: ${preferredChannels.join(", ")}.`
        : "Preferred channel is not specified.",
      dislikedChannels.length
        ? `Avoid these channels when possible: ${dislikedChannels.join(", ")}.`
        : "",
      preferences.preferredTone
        ? `Preferred tone: ${titleCase(preferences.preferredTone)}.`
        : "",
      preferredFormats.length
        ? `Preferred guidance format: ${preferredFormats.join(", ")}.`
        : "",
      preferences.preferredFrequency
        ? `Preferred frequency: ${titleCase(preferences.preferredFrequency)}.`
        : "",
      preferences.bestTimeOfDay
        ? `Best time of day: ${titleCase(preferences.bestTimeOfDay)}.`
        : "",
      sensitiveTopics.length
        ? `Sensitive topics: ${sensitiveTopics.join(", ")}.`
        : "",
    ].filter(Boolean),
    parentPromptNotes: [
      preferences.identifyParentOrigin
        ? "If a parent-originated message is shown to the student, it should be clearly identified as coming from the parent."
        : "The student does not require the parent origin to be foregrounded, but the system must still remain transparent.",
      preferences.allowParentConcernRephrasing
        ? "The student allows parent concerns to be rephrased for tone and clarity."
        : "The student has not consented to heavy rephrasing; keep close to the parent's stated intent.",
      preferences.consentParentTranslatedMessages
        ? "The student has consented to receive translated parent-originated messages."
        : "The student has not consented to receive translated parent-originated messages.",
      ...(
        sensitiveTopics.length
          ? [`Take extra care with these sensitive topics: ${sensitiveTopics.join(", ")}.`]
          : []
      ),
      ...(
        preferredFormats.length
          ? [`Formats that tend to land well: ${preferredFormats.join(", ")}.`]
          : []
      ),
      ...(
        preferredChannels.length
          ? [`Channels that tend to land well: ${preferredChannels.join(", ")}.`]
          : []
      ),
      ...(
        dislikedChannels.length
          ? [`Channels to avoid when possible: ${dislikedChannels.join(", ")}.`]
          : []
      ),
    ],
  };
}
