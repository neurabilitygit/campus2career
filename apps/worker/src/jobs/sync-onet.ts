import { TARGET_ROLE_SEEDS } from "../../../../packages/shared/src/market/targetRoleSeeds";
import {
  getOnetAuthConfigFromEnv,
  searchOccupationsByKeyword,
  getOccupationDetails,
} from "../../../api/src/services/market/onetClient";
import {
  normalizeOnetSearchResultToOccupation,
  normalizeOnetDetailsToSkillRequirements,
} from "../../../api/src/services/market/onetParsers";
import {
  persistNormalizedOccupation,
  persistNormalizedSkill,
} from "../../../api/src/services/market/persistence";

export async function syncOnet() {
  console.log("Starting O*NET sync with exact normalization...");

  const auth = getOnetAuthConfigFromEnv();

  for (const seed of TARGET_ROLE_SEEDS) {
    try {
      const rawSearch = await searchOccupationsByKeyword(seed.onetSearchTerms[0], auth);
      const normalizedOccupation = normalizeOnetSearchResultToOccupation(rawSearch, seed.canonicalName);

      if (!normalizedOccupation) {
        console.warn(`No occupation normalization result for ${seed.canonicalName}`);
        continue;
      }

      await persistNormalizedOccupation(normalizedOccupation);

      if (normalizedOccupation.onetCode) {
        try {
          const rawDetails = await getOccupationDetails(normalizedOccupation.onetCode, auth);
          const normalizedSkills = normalizeOnetDetailsToSkillRequirements(rawDetails, seed.canonicalName);

          for (const skill of normalizedSkills) {
            await persistNormalizedSkill(skill);
          }

          console.log(`Synced O*NET occupation and ${normalizedSkills.length} skills for ${seed.canonicalName}`);
        } catch (detailError) {
          console.error(`Failed O*NET detail fetch for ${seed.canonicalName}`, detailError);
        }
      } else {
        console.log(`Synced O*NET occupation without code for ${seed.canonicalName}`);
      }
    } catch (error) {
      console.error(`O*NET search failed for ${seed.canonicalName}`, error);
    }
  }

  console.log("O*NET sync complete.");
}
