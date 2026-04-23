import type { WorkerJobResult } from "./jobStatus";
import { assertStubWorkerJobsAllowed } from "./jobStatus";

export async function recomputeScores(): Promise<WorkerJobResult> {
  assertStubWorkerJobsAllowed("recompute-scores");

  return {
    jobName: "recompute-scores",
    mode: "stub",
    summary:
      "Score recomputation is not implemented as a worker-side batch job yet. Use the live scoring route, which recomputes scores on demand from current evidence.",
    details: {
      blockedByDefault: true,
      safeAlternative: "GET /v1/students/me/scoring or POST /v1/students/me/scoring/preview",
    },
  };
}
