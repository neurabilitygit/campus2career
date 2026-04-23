import type { WorkerJobResult } from "./jobStatus";
import { assertStubWorkerJobsAllowed } from "./jobStatus";

export async function refreshInsights(): Promise<WorkerJobResult> {
  assertStubWorkerJobsAllowed("refresh-insights");

  return {
    jobName: "refresh-insights",
    mode: "stub",
    summary:
      "Insight refresh is not implemented as a real worker pipeline yet, so this job is blocked to avoid implying that evidence-backed insights were regenerated.",
    details: {
      blockedByDefault: true,
    },
  };
}
