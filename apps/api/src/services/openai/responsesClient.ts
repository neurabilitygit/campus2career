import OpenAI from "openai";
import { z } from "zod";
import type { LlmTelemetryContext } from "../../../../../packages/shared/src/contracts/llm";
import {
  completeLlmRun,
  failLlmRun,
  startLlmRun,
} from "../llm/runLogger";
import {
  scenarioModelOutputJsonSchema,
  scenarioModelOutputSchema,
  type ScenarioModelOutput,
} from "../chat/scenarioSchema";
import {
  communicationTranslationModelOutputJsonSchema,
  communicationTranslationModelOutputSchema,
  type CommunicationTranslationModelOutput,
} from "../communication/translationSchema";

let client: OpenAI | null = null;
const COURSEWORK_INFERENCE_TIMEOUT_MS = 10000;
const JOB_TARGET_NORMALIZATION_TIMEOUT_MS = 10000;
const COMMUNICATION_TRANSLATION_TIMEOUT_MS = 12000;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is required");
    client = new OpenAI({ apiKey });
  }
  return client;
}

const courseworkInferenceSchema = z.object({
  confidence: z.enum(["low", "medium", "high"]),
  sourceUrl: z.string().url().nullable().optional(),
  summary: z.string().trim().max(1000),
  courses: z.array(
    z.object({
      courseCode: z.string().trim().min(1).max(64),
      courseTitle: z.string().trim().min(1).max(240),
      creditsMin: z.number().nonnegative().max(20).nullable().optional(),
      creditsMax: z.number().nonnegative().max(20).nullable().optional(),
      evidence: z.string().trim().min(1).max(500),
    })
  ).max(60),
});

type CourseworkInference = z.infer<typeof courseworkInferenceSchema>;

const academicOfferingsInferenceSchema = z.object({
  sourceConfidence: z.enum(["low", "medium", "high"]),
  catalogYear: z.string().trim().max(64).nullable().optional(),
  uncertaintyNotes: z.array(z.string().trim().min(1).max(240)).max(12).default([]),
  fieldsNeedingReview: z.array(z.string().trim().min(1).max(120)).max(12).default([]),
  majors: z.array(z.string().trim().min(1).max(120)).max(120),
  minors: z.array(z.string().trim().min(1).max(120)).max(120),
  concentrations: z.array(z.string().trim().min(1).max(120)).max(120),
});

type AcademicOfferingsInference = z.infer<typeof academicOfferingsInferenceSchema>;

const jobTargetNormalizationSchema = z.object({
  normalizedRoleFamily: z.string().trim().min(1).max(120).nullable(),
  confidenceLabel: z.enum(["low", "medium", "high"]),
  reasoning: z.string().trim().max(1000),
  onetCode: z.string().trim().max(32).nullable().optional(),
  topRequiredSkills: z.array(z.string().trim().min(1).max(120)).max(8).optional(),
});

type JobTargetNormalization = z.infer<typeof jobTargetNormalizationSchema>;

interface OpenAiTelemetryOptions {
  telemetry?: LlmTelemetryContext;
  timeoutMs?: number;
}

class OpenAiTimeoutError extends Error {
  constructor(message = "OPENAI_RESPONSE_TIMEOUT") {
    super(message);
    this.name = "OpenAiTimeoutError";
  }
}

function isTimeoutLikeError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message === "OPENAI_RESPONSE_TIMEOUT" ||
    error.message === "Request was aborted." ||
    error.name === "AbortError" ||
    error.name === "APIUserAbortError" ||
    error.name === "OpenAiTimeoutError"
  );
}

function courseworkInferenceJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["confidence", "sourceUrl", "summary", "courses"],
    properties: {
      confidence: {
        type: "string",
        enum: ["low", "medium", "high"],
      },
      sourceUrl: {
        anyOf: [{ type: "string" }, { type: "null" }],
      },
      summary: {
        type: "string",
      },
      courses: {
        type: "array",
        maxItems: 60,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["courseCode", "courseTitle", "creditsMin", "creditsMax", "evidence"],
          properties: {
            courseCode: { type: "string" },
            courseTitle: { type: "string" },
            creditsMin: { anyOf: [{ type: "number" }, { type: "null" }] },
            creditsMax: { anyOf: [{ type: "number" }, { type: "null" }] },
            evidence: { type: "string" },
          },
        },
      },
    },
  } as const;
}

function academicOfferingsInferenceJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "sourceConfidence",
      "catalogYear",
      "uncertaintyNotes",
      "fieldsNeedingReview",
      "majors",
      "minors",
      "concentrations",
    ],
    properties: {
      sourceConfidence: {
        type: "string",
        enum: ["low", "medium", "high"],
      },
      catalogYear: {
        anyOf: [{ type: "string" }, { type: "null" }],
      },
      uncertaintyNotes: {
        type: "array",
        maxItems: 12,
        items: { type: "string" },
      },
      fieldsNeedingReview: {
        type: "array",
        maxItems: 12,
        items: { type: "string" },
      },
      majors: {
        type: "array",
        maxItems: 120,
        items: { type: "string" },
      },
      minors: {
        type: "array",
        maxItems: 120,
        items: { type: "string" },
      },
      concentrations: {
        type: "array",
        maxItems: 120,
        items: { type: "string" },
      },
    },
  } as const;
}

function jobTargetNormalizationJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["normalizedRoleFamily", "confidenceLabel", "reasoning", "onetCode", "topRequiredSkills"],
    properties: {
      normalizedRoleFamily: {
        anyOf: [{ type: "string" }, { type: "null" }],
      },
      confidenceLabel: {
        type: "string",
        enum: ["low", "medium", "high"],
      },
      reasoning: {
        type: "string",
      },
      onetCode: {
        anyOf: [{ type: "string" }, { type: "null" }],
      },
      topRequiredSkills: {
        type: "array",
        maxItems: 8,
        items: { type: "string" },
      },
    },
  } as const;
}

async function createLoggedResponse(
  request: {
    model: string;
    requestBody: OpenAI.Responses.ResponseCreateParamsNonStreaming;
    telemetry?: LlmTelemetryContext;
    timeoutMs?: number;
  }
): Promise<{
  response: OpenAI.Responses.Response;
  llmRunId?: string;
}> {
  const activeRun = request.telemetry
    ? await startLlmRun({
        model: request.model,
        context: request.telemetry,
      })
    : null;

  const controller = request.timeoutMs ? new AbortController() : null;
  const timeoutId = controller
    ? setTimeout(() => {
        controller.abort(new OpenAiTimeoutError());
      }, request.timeoutMs)
    : null;

  try {
    const response = await getClient().responses.create(
      request.requestBody,
      controller ? { signal: controller.signal } : undefined
    );
    if (activeRun) {
      await completeLlmRun(activeRun, {
        outputText: response.output_text,
        responseId: response.id,
      });
    }
    return {
      response,
      llmRunId: activeRun?.llmRunId,
    };
  } catch (error) {
    if (activeRun) {
      const status = isTimeoutLikeError(error) ? "timed_out" : "failed";
      await failLlmRun(activeRun, error, status);
    }
    if (isTimeoutLikeError(error)) {
      throw new OpenAiTimeoutError();
    }
    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export async function generateStructuredParentBrief(input: {
  systemPrompt: string;
  userPrompt: string;
} & OpenAiTelemetryOptions) {
  const model = process.env.OPENAI_MODEL || "gpt-5.4";
  const { response } = await createLoggedResponse({
    model,
    telemetry: input.telemetry,
    timeoutMs: input.timeoutMs,
    requestBody: {
      model,
      input: [
        { role: "system", content: [{ type: "input_text", text: input.systemPrompt }] },
        { role: "user", content: [{ type: "input_text", text: input.userPrompt }] }
      ]
    }
  });

  return response.output_text;
}

export async function runScenarioChatWithWebSearch(input: {
  systemPrompt: string;
  userPrompt: string;
} & OpenAiTelemetryOptions) {
  const model = process.env.OPENAI_MODEL || "gpt-5.4";
  const { response } = await createLoggedResponse({
    model,
    telemetry: input.telemetry,
    timeoutMs: input.timeoutMs,
    requestBody: {
      model,
      tools: [{ type: "web_search_preview" }],
      input: [
        { role: "system", content: [{ type: "input_text", text: input.systemPrompt }] },
        { role: "user", content: [{ type: "input_text", text: input.userPrompt }] }
      ]
    }
  });

  return response.output_text;
}

export async function runStructuredScenarioChatWithWebSearch(input: {
  systemPrompt: string;
  userPrompt: string;
} & OpenAiTelemetryOptions): Promise<{
  output: ScenarioModelOutput;
  llmRunId?: string;
}> {
  const model = process.env.OPENAI_MODEL || "gpt-5.4";
  const { response, llmRunId } = await createLoggedResponse({
    model,
    telemetry: input.telemetry,
    timeoutMs: input.timeoutMs,
    requestBody: {
      model,
      tools: [{ type: "web_search_preview" }],
      text: {
        format: {
          type: "json_schema",
          name: "student_scenario_guidance",
          strict: true,
          schema: scenarioModelOutputJsonSchema(),
        },
      },
      input: [
        { role: "system", content: [{ type: "input_text", text: input.systemPrompt }] },
        { role: "user", content: [{ type: "input_text", text: input.userPrompt }] }
      ]
    }
  });

  const raw = response.output_text?.trim();
  if (!raw) {
    throw new Error("No structured scenario response was returned");
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    throw new Error("Scenario response was not valid JSON");
  }

  const parsed = scenarioModelOutputSchema.safeParse(decoded);
  if (!parsed.success) {
    throw new Error("Scenario response did not match the required schema");
  }

  return {
    output: parsed.data,
    llmRunId,
  };
}

export async function inferStructuredCourseworkFromOfficialText(input: {
  institutionDisplayName: string;
  programDisplayName: string;
  kind: "major" | "minor";
  candidatePages: Array<{
    url: string;
    title?: string;
    text: string;
  }>;
} & OpenAiTelemetryOptions): Promise<CourseworkInference | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !input.candidatePages.length) {
    return null;
  }

  const model = process.env.OPENAI_MODEL || "gpt-5.4";
  const sourcePayload = input.candidatePages.slice(0, 3).map((page) => ({
    url: page.url,
    title: page.title || "",
    text: page.text.slice(0, 7000),
  }));

  const response = await createLoggedResponse({
      model,
      telemetry: input.telemetry,
      timeoutMs: input.timeoutMs ?? COURSEWORK_INFERENCE_TIMEOUT_MS,
      requestBody: {
        model,
        text: {
          format: {
            type: "json_schema",
            name: "program_coursework_extraction",
            strict: true,
            schema: courseworkInferenceJsonSchema(),
          },
        },
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text:
                  "You extract official university major or minor coursework from provided source text. Only return courses explicitly supported by the snippets. Do not invent courses, requirements, or credits. If the evidence is weak, return an empty courses array and say so in the summary.",
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: JSON.stringify(
                  {
                    institution: input.institutionDisplayName,
                    program: input.programDisplayName,
                    kind: input.kind,
                    instructions: [
                      "Only use the provided official source snippets.",
                      "Return a course only when the source text explicitly names it or clearly encodes its course code and title.",
                      "Prefer required/core coursework over electives when possible.",
                      "If unsure, omit the course.",
                    ],
                    sources: sourcePayload,
                  },
                  null,
                  2
                ),
              },
            ],
          },
        ],
      }
  }).catch((error) => {
    if (isTimeoutLikeError(error)) return null;
    throw error;
  });

  if (!response) {
    return null;
  }

  const raw = response.response.output_text?.trim();
  if (!raw) {
    return null;
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return null;
  }

  const parsed = courseworkInferenceSchema.safeParse(decoded);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

export async function inferAcademicOfferingsFromInstitutionKnowledge(input: {
  institutionDisplayName: string;
  institutionWebsiteUrl?: string | null;
} & OpenAiTelemetryOptions): Promise<AcademicOfferingsInference | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const model = process.env.OPENAI_MODEL || "gpt-5.4";
  const { response } = await createLoggedResponse({
    model,
    telemetry: input.telemetry,
    timeoutMs: input.timeoutMs ?? COURSEWORK_INFERENCE_TIMEOUT_MS,
    requestBody: {
      model,
      text: {
        format: {
          type: "json_schema",
          name: "academic_offerings_inference",
          strict: true,
          schema: academicOfferingsInferenceJsonSchema(),
        },
      },
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You identify likely undergraduate majors, minors, and concentrations for a university. Return structured JSON only. Prefer caution over recall. If confidence is weak, return fewer items, lower sourceConfidence, and explain uncertainty. Do not invent catalog years.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                `Institution: ${input.institutionDisplayName}`,
                input.institutionWebsiteUrl ? `Website: ${input.institutionWebsiteUrl}` : "Website: unknown",
                "Return likely undergraduate majors, minors, and concentrations for this institution.",
                "Use broad institutional knowledge when needed, but mark uncertainty clearly.",
                "Avoid generic labels like 'Programs' or 'Academics'.",
              ].join("\n"),
            },
          ],
        },
      ],
    },
  });

  const raw = response.output_text?.trim();
  if (!raw) {
    return null;
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    throw new Error("Academic offerings inference response was not valid JSON");
  }

  const parsed = academicOfferingsInferenceSchema.safeParse(decoded);
  if (!parsed.success) {
    throw new Error("Academic offerings inference response did not match the required schema");
  }

  return parsed.data;
}

export async function inferNormalizedJobTarget(input: {
  title: string;
  employer?: string;
  location?: string;
  sourceUrl?: string;
  jobDescriptionText?: string;
  allowedRoleFamilies: Array<{
    canonicalName: string;
    sectorCluster: string;
  }>;
} & OpenAiTelemetryOptions): Promise<JobTargetNormalization> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required");
  }

  const model = process.env.OPENAI_MODEL || "gpt-5.4";
  const { response } = await createLoggedResponse({
    model,
    telemetry: input.telemetry,
    timeoutMs: input.timeoutMs ?? JOB_TARGET_NORMALIZATION_TIMEOUT_MS,
    requestBody: {
      model,
      text: {
        format: {
          type: "json_schema",
          name: "job_target_normalization",
          strict: true,
          schema: jobTargetNormalizationJsonSchema(),
        },
      },
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You normalize a student-selected job target into the closest allowed Rising Senior role family. Choose only from the allowed role families provided. If the evidence is weak, return null for normalizedRoleFamily and explain why.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify(
                {
                  jobTarget: {
                    title: input.title,
                    employer: input.employer || null,
                    location: input.location || null,
                    sourceUrl: input.sourceUrl || null,
                    jobDescriptionText: input.jobDescriptionText?.slice(0, 12000) || null,
                  },
                  allowedRoleFamilies: input.allowedRoleFamilies,
                  instructions: [
                    "Choose the single closest allowed role family.",
                    "Use the job title first, then the description.",
                    "If the title is broad but the description is specific, prefer the description.",
                    "Return a short reasoning statement.",
                  ],
                },
                null,
                2
              ),
            },
          ],
        },
      ],
    },
  });

  const raw = response.output_text?.trim();
  if (!raw) {
    throw new Error("No job target normalization response was returned");
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    throw new Error("Job target normalization response was not valid JSON");
  }

  const parsed = jobTargetNormalizationSchema.safeParse(decoded);
  if (!parsed.success) {
    throw new Error("Job target normalization response did not match the required schema");
  }

  return parsed.data;
}

export async function runStructuredCommunicationTranslation(input: {
  systemPrompt: string;
  userPrompt: string;
} & OpenAiTelemetryOptions): Promise<{
  output: CommunicationTranslationModelOutput;
  llmRunId?: string;
}> {
  const model = process.env.OPENAI_MODEL || "gpt-5.4";
  const { response, llmRunId } = await createLoggedResponse({
    model,
    telemetry: input.telemetry,
    timeoutMs: input.timeoutMs ?? COMMUNICATION_TRANSLATION_TIMEOUT_MS,
    requestBody: {
      model,
      text: {
        format: {
          type: "json_schema",
          name: "communication_translation_strategy",
          strict: true,
          schema: communicationTranslationModelOutputJsonSchema(),
        },
      },
      input: [
        { role: "system", content: [{ type: "input_text", text: input.systemPrompt }] },
        { role: "user", content: [{ type: "input_text", text: input.userPrompt }] },
      ],
    },
  });

  const raw = response.output_text?.trim();
  if (!raw) {
    throw new Error("No communication translation response was returned");
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    throw new Error("Communication translation response was not valid JSON");
  }

  const parsed = communicationTranslationModelOutputSchema.safeParse(decoded);
  if (!parsed.success) {
    throw new Error("Communication translation response did not match the required schema");
  }

  return {
    output: parsed.data,
    llmRunId,
  };
}
