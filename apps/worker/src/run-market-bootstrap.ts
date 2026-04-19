import { seedTargetRoleFamilies } from "./jobs/seed-target-role-families";
import { seedBroadSkillRequirements } from "./jobs/seed-broad-skill-requirements";
import { syncOnet } from "./jobs/sync-onet";
import { syncBls } from "./jobs/sync-bls";

async function main() {
  await seedTargetRoleFamilies();
  await seedBroadSkillRequirements();
  await syncOnet();
  await syncBls();
  console.log("Market bootstrap complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
