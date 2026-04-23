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
