import crypto from "node:crypto";
import type {
  FinalizeLlmRunInput,
  LlmTelemetryContext,
} from "../../../../../packages/shared/src/contracts/llm";
import { LlmRunRepository } from "../../repositories/llm/llmRunRepository";

const repo = new LlmRunRepository();

export interface ActiveLlmRun {
  llmRunId: string;
  startedAtMs: number;
}

function newRunId(): string {
  return crypto.randomUUID();
}

export async function startLlmRun(input: {
  model: string;
  context: LlmTelemetryContext;
}): Promise<ActiveLlmRun> {
  const llmRunId = newRunId();
  const startedAtMs = Date.now();

  await repo.createRun({
    llmRunId,
    studentProfileId: input.context.studentProfileId ?? null,
    householdId: input.context.householdId ?? null,
    runType: input.context.runType,
    model: input.model,
    promptVersion: input.context.promptVersion,
    inputPayload: input.context.inputPayload,
  });

  return { llmRunId, startedAtMs };
}

export async function completeLlmRun(
  run: ActiveLlmRun,
  outputPayload?: unknown
): Promise<void> {
  const finalizeInput: FinalizeLlmRunInput = {
    llmRunId: run.llmRunId,
    status: "succeeded",
    outputPayload,
    latencyMs: Date.now() - run.startedAtMs,
  };

  await repo.finalizeRun(finalizeInput);
}

export async function failLlmRun(
  run: ActiveLlmRun,
  error: unknown,
  status: "failed" | "timed_out" = "failed",
  outputPayload?: unknown
): Promise<void> {
  const providerError =
    error instanceof Error ? error.message : String(error);

  await repo.finalizeRun({
    llmRunId: run.llmRunId,
    status,
    outputPayload,
    providerError,
    latencyMs: Date.now() - run.startedAtMs,
  });
}
