import OpenAI from "openai";
import { z } from "zod";

let client: OpenAI | null = null;
const COURSEWORK_INFERENCE_TIMEOUT_MS = 10000;

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
      creditsMin: z.number().nonnegative().max(20).optional(),
      creditsMax: z.number().nonnegative().max(20).optional(),
      evidence: z.string().trim().min(1).max(500),
    })
  ).max(60),
});

type CourseworkInference = z.infer<typeof courseworkInferenceSchema>;

function courseworkInferenceJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["confidence", "summary", "courses"],
    properties: {
      confidence: {
        type: "string",
        enum: ["low", "medium", "high"],
      },
      sourceUrl: {
        anyOf: [{ type: "string", format: "uri" }, { type: "null" }],
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
          required: ["courseCode", "courseTitle", "evidence"],
          properties: {
            courseCode: { type: "string" },
            courseTitle: { type: "string" },
            creditsMin: { type: "number" },
            creditsMax: { type: "number" },
            evidence: { type: "string" },
          },
        },
      },
    },
  } as const;
}

export async function generateStructuredParentBrief(input: {
  systemPrompt: string;
  userPrompt: string;
}) {
  const model = process.env.OPENAI_MODEL || "gpt-5.4";
  const response = await getClient().responses.create({
    model,
    input: [
      { role: "system", content: [{ type: "input_text", text: input.systemPrompt }] },
      { role: "user", content: [{ type: "input_text", text: input.userPrompt }] }
    ]
  });

  return response.output_text;
}

export async function runScenarioChatWithWebSearch(input: {
  systemPrompt: string;
  userPrompt: string;
}) {
  const model = process.env.OPENAI_MODEL || "gpt-5.4";
  const response = await getClient().responses.create({
    model,
    tools: [{ type: "web_search_preview" }],
    input: [
      { role: "system", content: [{ type: "input_text", text: input.systemPrompt }] },
      { role: "user", content: [{ type: "input_text", text: input.userPrompt }] }
    ]
  });

  return response.output_text;
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
}): Promise<CourseworkInference | null> {
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

  const response = await Promise.race([
    getClient().responses.create({
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
    }),
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), COURSEWORK_INFERENCE_TIMEOUT_MS);
    }),
  ]);

  if (!response) {
    return null;
  }

  const raw = response.output_text?.trim();
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
