import type { WorkerJobResult } from "./jobStatus";
import { assertStubWorkerJobsAllowed } from "./jobStatus";

export async function generateParentBriefsJob(): Promise<WorkerJobResult> {
  assertStubWorkerJobsAllowed("generate-parent-briefs");

  return {
    jobName: "generate-parent-briefs",
    mode: "stub",
    summary:
      "This worker job is not implemented yet. It does not select real students and must not generate parent briefs from demo payloads in production.",
    details: {
      blockedByDefault: true,
      risk: "Would fabricate persisted parent-brief records if allowed to run against demo payloads.",
    },
  };
}
