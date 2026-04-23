import { query } from "../../db/client";
import type {
  AiDocumentRecord,
  CreateAiDocumentInput,
} from "../../../../../packages/shared/src/contracts/llm";

type AiDocumentRow = {
  ai_document_id: string;
  student_profile_id: string;
  source_llm_run_id: string | null;
  document_type: AiDocumentRecord["documentType"];
  title: string | null;
  body_markdown: string;
  structured_payload: unknown;
  visible_to: AiDocumentRecord["visibleTo"];
  created_at: Date | string;
};

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function mapDocumentRow(row: AiDocumentRow): AiDocumentRecord {
  return {
    aiDocumentId: row.ai_document_id,
    studentProfileId: row.student_profile_id,
    sourceLlmRunId: row.source_llm_run_id,
    documentType: row.document_type,
    title: row.title,
    bodyMarkdown: row.body_markdown,
    structuredPayload: row.structured_payload,
    visibleTo: row.visible_to,
    createdAt: toIsoString(row.created_at),
  };
}

export class AiDocumentRepository {
  async createDocument(input: CreateAiDocumentInput): Promise<void> {
    await query(
      `
      insert into ai_documents (
        ai_document_id,
        student_profile_id,
        source_llm_run_id,
        document_type,
        title,
        body_markdown,
        structured_payload,
        visible_to,
        created_at
      ) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,now())
      `,
      [
        input.aiDocumentId,
        input.studentProfileId,
        input.sourceLlmRunId ?? null,
        input.documentType,
        input.title ?? null,
        input.bodyMarkdown,
        JSON.stringify(input.structuredPayload ?? null),
        input.visibleTo,
      ]
    );
  }

  async listForStudent(input: {
    studentProfileId: string;
    documentType?: AiDocumentRecord["documentType"] | string;
    limit?: number;
  }): Promise<AiDocumentRecord[]> {
    const result = await query<AiDocumentRow>(
      `
      select
        ai_document_id,
        student_profile_id,
        source_llm_run_id,
        document_type,
        title,
        body_markdown,
        structured_payload,
        visible_to,
        created_at
      from ai_documents
      where student_profile_id = $1
        and ($2::text is null or document_type = $2::text)
      order by created_at desc
      limit $3
      `,
      [
        input.studentProfileId,
        input.documentType ?? null,
        input.limit ?? 25,
      ]
    );

    return result.rows.map(mapDocumentRow);
  }
}
