import type { JobTargetNormalizationResult } from "../../../../../packages/shared/src/contracts/career";
import {
  TARGET_ROLE_SEEDS,
  getTargetRoleSeedByCanonicalName,
} from "../../../../../packages/shared/src/market/targetRoleSeeds";
import { inferNormalizedJobTarget } from "../openai/responsesClient";

function normalizeText(value: string | undefined | null): string {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scoreSeed(seed: (typeof TARGET_ROLE_SEEDS)[number], haystack: string): number {
  let score = 0;
  const terms = [seed.canonicalName, ...seed.onetSearchTerms, ...seed.typicalEntryTitles];

  for (const rawTerm of terms) {
    const term = normalizeText(rawTerm);
    if (!term) continue;
    if (haystack === term) score += 240;
    else if (haystack.includes(term)) score += 120;
    else {
      const tokens = term.split(" ").filter(Boolean);
      const overlapping = tokens.filter((token) => haystack.includes(token)).length;
      score += overlapping * 18;
    }
  }

  return score;
}

export function deterministicallyNormalizeJobTarget(input: {
  title: string;
  employer?: string;
  location?: string;
  jobDescriptionText?: string;
}): JobTargetNormalizationResult {
  const haystack = normalizeText(
    [input.title, input.employer, input.location, input.jobDescriptionText].filter(Boolean).join(" ")
  );

  const ranked = TARGET_ROLE_SEEDS.map((seed) => ({
    seed,
    score: scoreSeed(seed, haystack),
  })).sort((a, b) => b.score - a.score);

  const match = ranked[0];
  if (!match || match.score <= 0) {
    return {
      normalizedRoleFamily: null,
      normalizedSectorCluster: null,
      onetCode: null,
      normalizationConfidence: 0.2,
      confidenceLabel: "low",
      normalizationReasoning: "No strong deterministic role match was found from the job title and description.",
      source: "deterministic",
      truthStatus: "unresolved",
      topRequiredSkills: [],
    };
  }

  const confidence =
    match.score >= 180 ? 0.9 :
    match.score >= 90 ? 0.7 : 0.45;

  return {
    normalizedRoleFamily: match.seed.canonicalName,
    normalizedSectorCluster: match.seed.sectorCluster,
    onetCode: match.seed.overrideOnetSocCode ?? null,
    normalizationConfidence: confidence,
    confidenceLabel: confidence >= 0.85 ? "high" : confidence >= 0.6 ? "medium" : "low",
    normalizationReasoning: `Deterministic normalization matched the job against "${match.seed.canonicalName}" using title and role-term overlap.`,
    source: "deterministic",
    truthStatus: "inferred",
    topRequiredSkills: [],
  };
}

function confidenceLabelToNumeric(value: "low" | "medium" | "high" | undefined): number | null {
  if (!value) return null;
  if (value === "high") return 0.9;
  if (value === "medium") return 0.7;
  return 0.4;
}

export async function normalizeJobTarget(input: {
  title: string;
  employer?: string;
  location?: string;
  sourceUrl?: string;
  jobDescriptionText?: string;
}): Promise<JobTargetNormalizationResult> {
  const deterministic = deterministicallyNormalizeJobTarget(input);

  try {
    const llm = await inferNormalizedJobTarget({
      title: input.title,
      employer: input.employer,
      location: input.location,
      sourceUrl: input.sourceUrl,
      jobDescriptionText: input.jobDescriptionText,
      allowedRoleFamilies: TARGET_ROLE_SEEDS.map((seed) => ({
        canonicalName: seed.canonicalName,
        sectorCluster: seed.sectorCluster,
      })),
      telemetry: {
        runType: "job_normalize",
        promptVersion: "job_target_normalization_v1",
        inputPayload: {
          title: input.title,
          employer: input.employer,
          location: input.location,
          sourceUrl: input.sourceUrl,
          jobDescriptionText: input.jobDescriptionText?.slice(0, 10000) || null,
        },
      },
    });

    const seed = llm.normalizedRoleFamily
      ? getTargetRoleSeedByCanonicalName(llm.normalizedRoleFamily)
      : null;

    if (!seed) {
      return deterministic;
    }

    return {
      normalizedRoleFamily: seed.canonicalName,
      normalizedSectorCluster: seed.sectorCluster,
      onetCode: llm.onetCode || seed.overrideOnetSocCode || null,
      normalizationConfidence:
        confidenceLabelToNumeric(llm.confidenceLabel) ?? deterministic.normalizationConfidence ?? null,
      confidenceLabel: llm.confidenceLabel,
      normalizationReasoning: llm.reasoning || deterministic.normalizationReasoning || null,
      source: "llm",
      truthStatus: "inferred",
      topRequiredSkills: llm.topRequiredSkills || [],
    };
  } catch {
    return deterministic;
  }
}
