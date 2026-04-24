import { cleanProgramDisplayName, isClearlyNonProgramLabel, looksLikeProgramName } from "./catalogDiscoveryService";

export type Top50ReviewFlag =
  | "ready_to_seed"
  | "offerings_noisy"
  | "requirements_pdf_likely"
  | "manual_adapter_recommended";

export interface Top50ReviewInput {
  exactMatch: boolean;
  websiteUrlPresent: boolean;
  officialProgramsUrlPresent: boolean;
  officialCatalogUrlPresent: boolean;
  catalogs: number;
  programs: number;
  majors: number;
  minors: number;
  concentrations: number;
  requirementSets: number;
  sampleMajors: string[];
  latestOfferingsStatus?: string | null;
  latestRequirementsStatus?: string | null;
}

export interface Top50ReviewAssessment {
  flags: Top50ReviewFlag[];
  primaryRecommendation: Top50ReviewFlag;
  reasons: string[];
}

function sampleLooksNoisy(sampleMajors: string[]) {
  const normalized = sampleMajors
    .map((value) => cleanProgramDisplayName(value))
    .filter(Boolean);
  if (!normalized.length) return false;

  return normalized.some((label) => {
    const lower = label.toLowerCase();
    return (
      !looksLikeProgramName(label) ||
      isClearlyNonProgramLabel(label) ||
      /^(a-z|archive|athletics|bookstore|calendars|close)$/i.test(lower) ||
      /^(about|advising|back)\b/i.test(lower) ||
      /\b(applicants?|career|core|imaging|pathway|policy|program|recreation|scholar|services|story|support|thesis)\b/i.test(lower)
    );
  });
}

export function assessTop50SchoolReadiness(input: Top50ReviewInput): Top50ReviewAssessment {
  const flags = new Set<Top50ReviewFlag>();
  const reasons: string[] = [];

  if (!input.exactMatch || !input.websiteUrlPresent) {
    flags.add("manual_adapter_recommended");
    reasons.push("The institution could not be resolved with enough certainty or is missing a usable website URL.");
  }

  if (!input.officialProgramsUrlPresent || !input.officialCatalogUrlPresent) {
    flags.add("manual_adapter_recommended");
    reasons.push("The curated manifest is missing an official programs URL or catalog URL for this school.");
  }

  const noisy = sampleLooksNoisy(input.sampleMajors);
  if (
    noisy ||
    input.latestOfferingsStatus === "questionable" ||
    input.latestOfferingsStatus === "failed" ||
    (input.majors > 120 && input.minors === 0)
  ) {
    flags.add("offerings_noisy");
    reasons.push("Current offerings coverage looks noisy or unbalanced and should be reviewed before reuse.");
  }

  if (
    input.requirementSets === 0 ||
    input.latestRequirementsStatus === "failed" ||
    input.latestRequirementsStatus === "questionable" ||
    input.latestRequirementsStatus === "needs_review" ||
    input.latestRequirementsStatus === "upload_required"
  ) {
    flags.add("requirements_pdf_likely");
    reasons.push("Requirement coverage is missing or weak enough that a PDF-backed fallback is likely.");
  }

  if (flags.size === 0) {
    flags.add("ready_to_seed");
    reasons.push("The school resolves cleanly, has official source hints, and does not currently show obvious coverage warnings.");
  }

  const orderedFlags = Array.from(flags).sort((a, b) => {
    const priority: Record<Top50ReviewFlag, number> = {
      manual_adapter_recommended: 0,
      offerings_noisy: 1,
      requirements_pdf_likely: 2,
      ready_to_seed: 3,
    };
    return priority[a] - priority[b];
  });

  return {
    flags: orderedFlags,
    primaryRecommendation: orderedFlags[0],
    reasons,
  };
}
