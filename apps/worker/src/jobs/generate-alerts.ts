import type { WorkerJobResult } from "./jobStatus";
import { assertStubWorkerJobsAllowed } from "./jobStatus";

export async function generateAlerts(): Promise<WorkerJobResult> {
  assertStubWorkerJobsAllowed("generate-alerts");

  return {
    jobName: "generate-alerts",
    mode: "stub",
    summary:
      "Alert generation is not implemented as a real worker pipeline yet, so this job is blocked to avoid pretending alerts were refreshed.",
    details: {
      blockedByDefault: true,
    },
  };
}
