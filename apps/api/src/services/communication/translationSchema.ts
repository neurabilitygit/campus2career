import { z } from "zod";

export const communicationTranslationModelOutputSchema = z.object({
  recommendedChannel: z.enum(["email", "sms", "whatsapp"]).nullable(),
  recommendedTone: z.enum(["gentle", "neutral", "direct", "encouraging", "question_led", "summary_first"]).nullable(),
  recommendedTiming: z.string().trim().min(1).max(240),
  recommendedFrequency: z.enum(["as_needed", "weekly", "biweekly", "monthly"]).nullable(),
  defensivenessRisk: z.enum(["low", "medium", "high"]),
  reasonForRecommendation: z.string().trim().min(1).max(1600),
  studentFacingMessageDraft: z.string().trim().min(1).max(2400),
  parentFacingExplanation: z.string().trim().min(1).max(2400),
  whatNotToSay: z.string().trim().min(1).max(1600),
  humanReviewRecommended: z.boolean(),
  withholdDelivery: z.boolean(),
  withholdReason: z.string().trim().max(1200).nullable(),
});

export type CommunicationTranslationModelOutput = z.infer<typeof communicationTranslationModelOutputSchema>;

export const communicationBridgeOutputSchema = z.object({
  rewrittenMessage: z.string().trim().min(1).max(2400),
  shorterVersion: z.string().trim().min(1).max(1600),
  softerVersion: z.string().trim().min(1).max(1600),
  directVersion: z.string().trim().min(1).max(1600),
  rationale: z.string().trim().min(1).max(1600),
  riskFlags: z.array(z.string().trim().min(1).max(160)).max(8),
  suggestedNextStep: z.string().trim().min(1).max(800),
  confidence: z.enum(["low", "medium", "high"]),
  sourceContextUsed: z.array(z.string().trim().min(1).max(200)).max(10),
  privacyNotes: z.array(z.string().trim().min(1).max(200)).max(10),
  likelyMeaning: z.string().trim().max(1200).nullable(),
  suggestedResponse: z.string().trim().max(1600).nullable(),
});

export type CommunicationBridgeOutput = z.infer<typeof communicationBridgeOutputSchema>;

export function communicationTranslationModelOutputJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "recommendedChannel",
      "recommendedTone",
      "recommendedTiming",
      "recommendedFrequency",
      "defensivenessRisk",
      "reasonForRecommendation",
      "studentFacingMessageDraft",
      "parentFacingExplanation",
      "whatNotToSay",
      "humanReviewRecommended",
      "withholdDelivery",
      "withholdReason",
    ],
    properties: {
      recommendedChannel: {
        anyOf: [
          { type: "string", enum: ["email", "sms", "whatsapp"] },
          { type: "null" },
        ],
      },
      recommendedTone: {
        anyOf: [
          { type: "string", enum: ["gentle", "neutral", "direct", "encouraging", "question_led", "summary_first"] },
          { type: "null" },
        ],
      },
      recommendedTiming: { type: "string" },
      recommendedFrequency: {
        anyOf: [
          { type: "string", enum: ["as_needed", "weekly", "biweekly", "monthly"] },
          { type: "null" },
        ],
      },
      defensivenessRisk: { type: "string", enum: ["low", "medium", "high"] },
      reasonForRecommendation: { type: "string" },
      studentFacingMessageDraft: { type: "string" },
      parentFacingExplanation: { type: "string" },
      whatNotToSay: { type: "string" },
      humanReviewRecommended: { type: "boolean" },
      withholdDelivery: { type: "boolean" },
      withholdReason: {
        anyOf: [{ type: "string" }, { type: "null" }],
      },
    },
  } as const;
}

export function communicationBridgeOutputJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "rewrittenMessage",
      "shorterVersion",
      "softerVersion",
      "directVersion",
      "rationale",
      "riskFlags",
      "suggestedNextStep",
      "confidence",
      "sourceContextUsed",
      "privacyNotes",
      "likelyMeaning",
      "suggestedResponse",
    ],
    properties: {
      rewrittenMessage: { type: "string" },
      shorterVersion: { type: "string" },
      softerVersion: { type: "string" },
      directVersion: { type: "string" },
      rationale: { type: "string" },
      riskFlags: {
        type: "array",
        items: { type: "string" },
        maxItems: 8,
      },
      suggestedNextStep: { type: "string" },
      confidence: { type: "string", enum: ["low", "medium", "high"] },
      sourceContextUsed: {
        type: "array",
        items: { type: "string" },
        maxItems: 10,
      },
      privacyNotes: {
        type: "array",
        items: { type: "string" },
        maxItems: 10,
      },
      likelyMeaning: {
        anyOf: [{ type: "string" }, { type: "null" }],
      },
      suggestedResponse: {
        anyOf: [{ type: "string" }, { type: "null" }],
      },
    },
  } as const;
}
