import { seedTargetRoleFamilies } from "./jobs/seed-target-role-families";
import { seedBroadSkillRequirements } from "./jobs/seed-broad-skill-requirements";
import { syncOnet } from "./jobs/sync-onet";
import { syncBls } from "./jobs/sync-bls";
import { recomputeScores } from "./jobs/recompute-scores";
import { generateParentBriefsJob } from "./jobs/generate-parent-briefs";
import { generateAlerts } from "./jobs/generate-alerts";
import { refreshInsights } from "./jobs/refresh-insights";
import { processParseJobs } from "./jobs/process-parse-jobs";

const jobRegistry = {
  "seed-target-role-families": seedTargetRoleFamilies,
  "seed-broad-skill-requirements": seedBroadSkillRequirements,
  "sync-onet": syncOnet,
  "sync-bls": syncBls,
  "recompute-scores": recomputeScores,
  "generate-parent-briefs": generateParentBriefsJob,
  "generate-alerts": generateAlerts,
  "refresh-insights": refreshInsights,
  "process-parse-jobs": processParseJobs,
} as const;

type WorkerJobName = keyof typeof jobRegistry;

function listJobs() {
  console.log("Available jobs:");
  for (const jobName of Object.keys(jobRegistry)) {
    console.log(`- ${jobName}`);
  }
}

async function runJob(jobName: WorkerJobName) {
  console.log(`Running worker job: ${jobName}`);
  await jobRegistry[jobName]();
  console.log(`Worker job completed: ${jobName}`);
}

async function runParseLoop(intervalMs: number) {
  console.log(`Starting parse queue loop (interval ${intervalMs}ms)`);
  while (true) {
    await processParseJobs();
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

async function main() {
  console.log("Campus2Career worker started");
  const requestedJob = (process.env.WORKER_JOB || process.argv[2] || "process-parse-jobs") as WorkerJobName | "list";
  const pollIntervalMs = Number(process.env.WORKER_POLL_INTERVAL_MS || "0");

  if (requestedJob === "list") {
    listJobs();
    return;
  }

  if (!(requestedJob in jobRegistry)) {
    console.error(`Unknown worker job: ${requestedJob}`);
    listJobs();
    process.exitCode = 1;
    return;
  }

  if (requestedJob === "process-parse-jobs" && pollIntervalMs > 0) {
    await runParseLoop(pollIntervalMs);
    return;
  }

  await runJob(requestedJob);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

export {
  seedTargetRoleFamilies,
  seedBroadSkillRequirements,
  syncOnet,
  syncBls,
  recomputeScores,
  generateParentBriefsJob,
  generateAlerts,
  refreshInsights,
  processParseJobs,
};
