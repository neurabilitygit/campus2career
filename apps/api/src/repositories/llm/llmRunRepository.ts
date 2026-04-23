import { query } from "../../db/client";
import type {
  CreateLlmRunInput,
  FinalizeLlmRunInput,
  LlmRunRecord,
} from "../../../../../packages/shared/src/contracts/llm";

type LlmRunRow = {
  llm_run_id: string;
  student_profile_id: string | null;
  household_id: string | null;
  run_type: LlmRunRecord["runType"];
  model: string;
  prompt_version: string;
  status: LlmRunRecord["status"];
  input_payload: unknown;
  output_payload: unknown;
  provider_error: string | null;
  latency_ms: number | null;
  created_at: Date | string;
  completed_at: Date | string | null;
};

function toIsoString(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function mapRunRow(row: LlmRunRow): LlmRunRecord {
  return {
    llmRunId: row.llm_run_id,
    studentProfileId: row.student_profile_id,
    householdId: row.household_id,
    runType: row.run_type,
    model: row.model,
    promptVersion: row.prompt_version,
    status: row.status,
    inputPayload: row.input_payload,
    outputPayload: row.output_payload,
    providerError: row.provider_error,
    latencyMs: row.latency_ms,
    createdAt: toIsoString(row.created_at) || "",
    completedAt: toIsoString(row.completed_at),
  };
}

export class LlmRunRepository {
  async createRun(input: CreateLlmRunInput): Promise<void> {
    await query(
      `
      insert into llm_runs (
        llm_run_id,
        student_profile_id,
        household_id,
        run_type,
        model,
        prompt_version,
        status,
        input_payload,
        output_payload,
        provider_error,
        latency_ms,
        created_at,
        completed_at
      ) values ($1,$2,$3,$4,$5,$6,'started',$7::jsonb,null,null,null,now(),null)
      `,
      [
        input.llmRunId,
        input.studentProfileId ?? null,
        input.householdId ?? null,
        input.runType,
        input.model,
        input.promptVersion,
        JSON.stringify(input.inputPayload ?? null),
      ]
    );
  }

  async finalizeRun(input: FinalizeLlmRunInput): Promise<void> {
    await query(
      `
      update llm_runs
      set
        status = $2,
        output_payload = $3::jsonb,
        provider_error = $4,
        latency_ms = $5,
        completed_at = now()
      where llm_run_id = $1
      `,
      [
        input.llmRunId,
        input.status,
        JSON.stringify(input.outputPayload ?? null),
        input.providerError ?? null,
        input.latencyMs ?? null,
      ]
    );
  }

  async getRunById(llmRunId: string): Promise<LlmRunRecord | null> {
    const result = await query<LlmRunRow>(
      `
      select
        llm_run_id,
        student_profile_id,
        household_id,
        run_type,
        model,
        prompt_version,
        status,
        input_payload,
        output_payload,
        provider_error,
        latency_ms,
        created_at,
        completed_at
      from llm_runs
      where llm_run_id = $1
      limit 1
      `,
      [llmRunId]
    );

    const row = result.rows[0];
    return row ? mapRunRow(row) : null;
  }
}
