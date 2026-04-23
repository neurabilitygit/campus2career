import { z } from "zod";

export const scenarioModelOutputSchema = z.object({
  headline: z.string().trim().min(1).max(240),
  summary: z.string().trim().min(1).max(2000),
  whyThisMattersNow: z.string().trim().min(1).max(1600),
  recommendedActions: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(240),
        rationale: z.string().trim().min(1).max(1200),
        timeframe: z.string().trim().min(1).max(120),
      })
    )
    .max(3),
  risksToWatch: z.array(z.string().trim().min(1).max(240)).max(4),
  encouragement: z.string().trim().min(1).max(1200),
  basedOn: z.array(z.string().trim().min(1).max(240)).max(6),
});

export type ScenarioModelOutput = z.infer<typeof scenarioModelOutputSchema>;

export function scenarioModelOutputJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "headline",
      "summary",
      "whyThisMattersNow",
      "recommendedActions",
      "risksToWatch",
      "encouragement",
      "basedOn",
    ],
    properties: {
      headline: { type: "string" },
      summary: { type: "string" },
      whyThisMattersNow: { type: "string" },
      recommendedActions: {
        type: "array",
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "rationale", "timeframe"],
          properties: {
            title: { type: "string" },
            rationale: { type: "string" },
            timeframe: { type: "string" },
          },
        },
      },
      risksToWatch: {
        type: "array",
        maxItems: 4,
        items: { type: "string" },
      },
      encouragement: { type: "string" },
      basedOn: {
        type: "array",
        maxItems: 6,
        items: { type: "string" },
      },
    },
  } as const;
}

export function renderScenarioMarkdown(input: {
  headline: string;
  summary: string;
  whyThisMattersNow: string;
  recommendedActions: Array<{
    title: string;
    rationale: string;
    timeframe: string;
  }>;
  risksToWatch: string[];
  encouragement: string;
  basedOn: string[];
  mode?: "llm" | "fallback";
  providerError?: string;
}): string {
  const actionLines = input.recommendedActions.length
    ? input.recommendedActions.map(
        (action) => `- ${action.title} (${action.timeframe}): ${action.rationale}`
      )
    : ["- No concrete actions were returned."];

  const riskLines = input.risksToWatch.length
    ? input.risksToWatch.map((risk) => `- ${risk}`)
    : ["- No specific risks were listed."];

  const basedOnLines = input.basedOn.length
    ? input.basedOn.map((item) => `- ${item}`)
    : ["- No supporting context was listed."];

  const footer =
    input.mode === "fallback"
      ? `\n\nFallback note: AI fallback guidance was used.${input.providerError ? ` Provider detail: ${input.providerError}` : ""}`
      : "";

  return [
    `# ${input.headline}`,
    "",
    input.summary,
    "",
    "## Why This Matters Now",
    input.whyThisMattersNow,
    "",
    "## Recommended Actions",
    ...actionLines,
    "",
    "## Risks To Watch",
    ...riskLines,
    "",
    "## Based On",
    ...basedOnLines,
    "",
    "## Encouragement",
    input.encouragement,
  ].join("\n") + footer;
}
