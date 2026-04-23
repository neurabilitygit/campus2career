export type WorkerJobExecutionMode = "real" | "partial" | "fallback" | "stub";

export interface WorkerJobResult {
  jobName: string;
  mode: WorkerJobExecutionMode;
  summary: string;
  details?: Record<string, unknown>;
}

export function assertStubWorkerJobsAllowed(jobName: string): void {
  const allowed = String(process.env.ALLOW_STUB_WORKER_JOBS || "").toLowerCase() === "true";
  if (allowed) {
    return;
  }

  throw new Error(
    `${jobName} is still a stubbed worker job and is blocked by default. Set ALLOW_STUB_WORKER_JOBS=true only for intentional development-only execution.`
  );
}
