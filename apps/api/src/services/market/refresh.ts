import { TARGET_ROLE_SEEDS, type TargetRoleSeed } from "../../../../../packages/shared/src/market/targetRoleSeeds";
import {
  fetchLatestBlsSeries,
} from "./blsClient";
import {
  getCareerJobOutlook,
  getOccupationJobZone,
  getOccupationOverview,
  getOccupationSkillsSummary,
  getOccupationTechnologySkillsSummary,
  getOnetAuthConfigFromEnv,
  searchOccupationsByKeyword,
  type OnetAuthConfig,
} from "./onetClient";
import {
  normalizeBlsSeriesToMarketSignal,
} from "./blsParsers";
import {
  applyOnetJobZoneToOccupation,
  normalizeOnetCareerOutlookToMarketSignals,
  normalizeOnetDetailsToSkillRequirements,
  normalizeOnetTechnologySkillsToSkillRequirements,
  normalizeOnetOverviewToOccupation,
  normalizeOnetSearchResultToOccupation,
} from "./onetParsers";
import {
  persistNormalizedOccupation,
  replaceNormalizedMacroMarketSignals,
  replaceNormalizedMarketSignalsForOccupation,
  replaceNormalizedSkillsForOccupation,
} from "./persistence";
import type { NormalizedMarketSignal } from "./normalizers";

const BLS_NATIONAL_UNEMPLOYMENT_SERIES_ID = "LNS14000000";

type RefreshRoleResult = {
  canonicalName: string;
  onetCode?: string;
  skillCount: number;
  signalCount: number;
  refreshed: boolean;
  reason?: string;
};

export interface RefreshMarketDependencies {
  searchOccupationsByKeyword: typeof searchOccupationsByKeyword;
  getOccupationOverview: typeof getOccupationOverview;
  getOccupationSkillsSummary: typeof getOccupationSkillsSummary;
  getOccupationTechnologySkillsSummary: typeof getOccupationTechnologySkillsSummary;
  getOccupationJobZone: typeof getOccupationJobZone;
  getCareerJobOutlook: typeof getCareerJobOutlook;
  fetchLatestBlsSeries: typeof fetchLatestBlsSeries;
  persistNormalizedOccupation: typeof persistNormalizedOccupation;
  replaceNormalizedSkillsForOccupation: typeof replaceNormalizedSkillsForOccupation;
  replaceNormalizedMarketSignalsForOccupation: typeof replaceNormalizedMarketSignalsForOccupation;
  replaceNormalizedMacroMarketSignals: typeof replaceNormalizedMacroMarketSignals;
}

const defaultDependencies: RefreshMarketDependencies = {
  searchOccupationsByKeyword,
  getOccupationOverview,
  getOccupationSkillsSummary,
  getOccupationTechnologySkillsSummary,
  getOccupationJobZone,
  getCareerJobOutlook,
  fetchLatestBlsSeries,
  persistNormalizedOccupation,
  replaceNormalizedSkillsForOccupation,
  replaceNormalizedMarketSignalsForOccupation,
  replaceNormalizedMacroMarketSignals,
};

function uniqueCodes(seed: TargetRoleSeed): string[] {
  return Array.from(
    new Set(
      [seed.overrideOnetSocCode, ...(seed.preferredOnetSocCodes || [])]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))
    )
  );
}

async function resolveOccupationForSeed(
  seed: TargetRoleSeed,
  onetAuthConfig: OnetAuthConfig,
  deps: RefreshMarketDependencies
) {
  const preferredCodes = uniqueCodes(seed);

  for (const keyword of [seed.canonicalName, ...seed.onetSearchTerms]) {
    const searchRaw = await deps.searchOccupationsByKeyword(keyword, onetAuthConfig);
    const occupation = normalizeOnetSearchResultToOccupation(searchRaw, seed.canonicalName, {
      preferredOnetSocCodes: preferredCodes,
    });
    if (occupation?.onetCode) {
      return occupation;
    }
  }

  if (preferredCodes[0]) {
    return {
      canonicalName: seed.canonicalName,
      onetCode: preferredCodes[0],
      title: seed.canonicalName,
      description: `Resolved from configured O*NET mapping for ${seed.canonicalName}`,
      source: "onet" as const,
    };
  }

  return null;
}

export async function refreshRoleMarketReference(
  seed: TargetRoleSeed,
  onetAuthConfig: OnetAuthConfig,
  deps: RefreshMarketDependencies = defaultDependencies
): Promise<RefreshRoleResult> {
  try {
    const resolved = await resolveOccupationForSeed(seed, onetAuthConfig, deps);
    if (!resolved?.onetCode) {
      return {
        canonicalName: seed.canonicalName,
        skillCount: 0,
        signalCount: 0,
        refreshed: false,
        reason: "No O*NET occupation code could be resolved",
      };
    }

    const [overviewRaw, skillsRaw, jobZoneRaw] = await Promise.all([
      deps.getOccupationOverview(resolved.onetCode, onetAuthConfig),
      deps.getOccupationSkillsSummary(resolved.onetCode, onetAuthConfig),
      deps.getOccupationJobZone(resolved.onetCode, onetAuthConfig),
    ]);

    const effectiveDate = `${new Date().getUTCFullYear()}-01-01`;
    const occupation = applyOnetJobZoneToOccupation(
      normalizeOnetOverviewToOccupation(overviewRaw, seed.canonicalName, resolved.onetCode),
      jobZoneRaw
    );
    let skills = normalizeOnetDetailsToSkillRequirements(skillsRaw, seed.canonicalName);
    if (!skills.length) {
      const technologySkillsRaw = await deps.getOccupationTechnologySkillsSummary(
        resolved.onetCode,
        onetAuthConfig
      );
      skills = normalizeOnetTechnologySkillsToSkillRequirements(technologySkillsRaw, seed.canonicalName);
    }

    let marketSignals: NormalizedMarketSignal[] = [];
    try {
      const outlookRaw = await deps.getCareerJobOutlook(resolved.onetCode, onetAuthConfig);
      marketSignals = normalizeOnetCareerOutlookToMarketSignals({
        raw: outlookRaw,
        occupationCanonicalName: seed.canonicalName,
        effectiveDate,
      });
    } catch {
      marketSignals = [];
    }

    await deps.persistNormalizedOccupation(occupation);
    await deps.replaceNormalizedSkillsForOccupation(seed.canonicalName, skills);
    await deps.replaceNormalizedMarketSignalsForOccupation(seed.canonicalName, marketSignals);

    return {
      canonicalName: seed.canonicalName,
      onetCode: occupation.onetCode,
      skillCount: skills.length,
      signalCount: marketSignals.length,
      refreshed: true,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown O*NET refresh failure";
    return {
      canonicalName: seed.canonicalName,
      skillCount: 0,
      signalCount: 0,
      refreshed: false,
      reason,
    };
  }
}

export async function refreshMarketReferenceData(
  input: {
    roleCanonicalNames?: string[];
    onetAuthConfig?: OnetAuthConfig;
  } = {},
  deps: RefreshMarketDependencies = defaultDependencies
) {
  const requestedNames = new Set((input.roleCanonicalNames || []).map((name) => name.trim().toLowerCase()).filter(Boolean));
  const seeds = TARGET_ROLE_SEEDS.filter((seed) =>
    requestedNames.size === 0 || requestedNames.has(seed.canonicalName.toLowerCase())
  );
  let onetAuthConfig: OnetAuthConfig | null = input.onetAuthConfig || null;
  if (!onetAuthConfig) {
    try {
      onetAuthConfig = getOnetAuthConfigFromEnv();
    } catch {
      onetAuthConfig = null;
    }
  }
  const roles: RefreshRoleResult[] = [];

  for (const seed of seeds) {
    if (!onetAuthConfig) {
      roles.push({
        canonicalName: seed.canonicalName,
        skillCount: 0,
        signalCount: 0,
        refreshed: false,
        reason: "Skipped because no O*NET credentials are configured",
      });
      continue;
    }

    roles.push(await refreshRoleMarketReference(seed, onetAuthConfig, deps));
  }

  const macroUnemploymentRaw = await deps.fetchLatestBlsSeries(BLS_NATIONAL_UNEMPLOYMENT_SERIES_ID);
  const macroUnemploymentSignal = normalizeBlsSeriesToMarketSignal({
    raw: macroUnemploymentRaw,
    sourceName: `BLS:${BLS_NATIONAL_UNEMPLOYMENT_SERIES_ID}`,
    signalType: "unemployment_pressure",
    geographyCode: "us",
  });

  if (macroUnemploymentSignal) {
    await deps.replaceNormalizedMacroMarketSignals("unemployment_pressure", [macroUnemploymentSignal]);
  }

  return {
    refreshedAt: new Date().toISOString(),
    roles,
    macroSignals: macroUnemploymentSignal ? 1 : 0,
  };
}
