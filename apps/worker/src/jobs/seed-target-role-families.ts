import { TARGET_ROLE_SEEDS } from "../../../../packages/shared/src/market/targetRoleSeeds";
import { persistNormalizedOccupation } from "../../../api/src/services/market/persistence";

export async function seedTargetRoleFamilies() {
  console.log("Seeding target role families into occupation_clusters...");
  for (const seed of TARGET_ROLE_SEEDS) {
    await persistNormalizedOccupation({
      canonicalName: seed.canonicalName,
      title: seed.canonicalName,
      description: `Seed role family for ${seed.sectorCluster}`,
      source: "onet",
    });
  }
  console.log(`Seeded ${TARGET_ROLE_SEEDS.length} target role families.`);
}
