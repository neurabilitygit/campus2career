import OpenAI from "openai";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is required");
    client = new OpenAI({ apiKey });
  }
  return client;
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
