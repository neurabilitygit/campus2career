export type LlmRunType =
  | "scenario_chat"
  | "parent_brief"
  | "transcript_reconcile"
  | "job_normalize"
  | "score_explain"
  | "requirements_repair";

export type LlmRunStatus = "started" | "succeeded" | "failed" | "timed_out";

export type AiDocumentType = "parent_brief" | "scenario_guidance" | "score_explanation";

export type AiDocumentVisibility = "student" | "parent" | "coach" | "shared";

export interface LlmRunRecord {
  llmRunId: string;
  studentProfileId?: string | null;
  householdId?: string | null;
  runType: LlmRunType;
  model: string;
  promptVersion: string;
  status: LlmRunStatus;
  inputPayload: unknown;
  outputPayload?: unknown;
  providerError?: string | null;
  latencyMs?: number | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface CreateLlmRunInput {
  llmRunId: string;
  studentProfileId?: string | null;
  householdId?: string | null;
  runType: LlmRunType;
  model: string;
  promptVersion: string;
  status?: Extract<LlmRunStatus, "started">;
  inputPayload: unknown;
}

export interface FinalizeLlmRunInput {
  llmRunId: string;
  status: Exclude<LlmRunStatus, "started">;
  outputPayload?: unknown;
  providerError?: string | null;
  latencyMs?: number | null;
}

export interface AiDocumentRecord {
  aiDocumentId: string;
  studentProfileId: string;
  sourceLlmRunId?: string | null;
  documentType: AiDocumentType;
  title?: string | null;
  bodyMarkdown: string;
  structuredPayload?: unknown;
  visibleTo: AiDocumentVisibility;
  createdAt: string;
}

export interface CreateAiDocumentInput {
  aiDocumentId: string;
  studentProfileId: string;
  sourceLlmRunId?: string | null;
  documentType: AiDocumentType;
  title?: string | null;
  bodyMarkdown: string;
  structuredPayload?: unknown;
  visibleTo: AiDocumentVisibility;
}

export interface LlmTelemetryContext {
  runType: LlmRunType;
  promptVersion: string;
  studentProfileId?: string | null;
  householdId?: string | null;
  inputPayload: unknown;
}
