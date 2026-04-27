import {
  inferBandFromImportance,
  inferSkillCategory,
  type NormalizedMarketSignal,
  type NormalizedOccupation,
  type NormalizedSkillRequirement,
} from "./normalizers";

/**
 * Defensive extractors for common O*NET response variants.
 * These are designed so the repo can start consuming live payloads without exploding
 * if the service returns a slightly different nesting shape.
 */

function asArray<T = any>(value: any): T[] {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

export function extractOnetSearchRows(raw: any): any[] {
  const candidates = [
    asArray(raw?.occupation),
    asArray(raw?.occupations),
    asArray(raw?.career),
    asArray(raw?.results),
    asArray(raw?.row),
    asArray(raw?.search_results),
  ];
  return candidates.find((rows) => rows.length > 0) || [];
}

export function normalizeOnetSearchResultToOccupation(
  raw: any,
  canonicalName: string,
  options?: { preferredOnetSocCodes?: string[] }
): NormalizedOccupation | null {
  const rows = extractOnetSearchRows(raw);
  const preferredCodes = (options?.preferredOnetSocCodes || []).map((code) => code.trim()).filter(Boolean);
  const first =
    preferredCodes
      .map((preferredCode) =>
        rows.find((row) => {
          const code = row?.code || row?.onet_code || row?.id;
          return typeof code === "string" && code === preferredCode;
        })
      )
      .find(Boolean) || rows[0];

  if (!first) {
    return {
      canonicalName,
      title: canonicalName,
      description: `Fallback canonical occupation for ${canonicalName}`,
      source: "onet",
    };
  }

  return {
    canonicalName,
    onetCode: first.code || first.onet_code || first.id || undefined,
    title: first.title || first.name || canonicalName,
    description: first.description || first.summary || `Resolved from O*NET for ${canonicalName}`,
    source: "onet",
  };
}

export function normalizeOnetOverviewToOccupation(raw: any, canonicalName: string, onetCode?: string): NormalizedOccupation {
  return {
    canonicalName,
    onetCode: raw?.code || onetCode,
    title: raw?.title || canonicalName,
    description: raw?.what_they_do || raw?.description || `Resolved from O*NET for ${canonicalName}`,
    source: "onet",
  };
}

export function applyOnetJobZoneToOccupation(occupation: NormalizedOccupation, raw: any): NormalizedOccupation {
  const jobZone = Number(raw?.code ?? raw?.job_zone ?? raw?.zone);
  if (!Number.isFinite(jobZone)) {
    return occupation;
  }

  return {
    ...occupation,
    jobZone,
  };
}

function extractCandidateSkills(raw: any): any[] {
  const direct = [
    ...asArray(raw?.skills),
    ...asArray(raw?.skill),
    ...asArray(raw?.importance),
    ...asArray(raw?.element),
    ...asArray(raw?.descriptor),
  ];

  if (direct.length > 0) return direct;

  // Search recursively in common nested keys
  const nestedCandidates = [
    raw?.worker_characteristics,
    raw?.worker_requirements,
    raw?.experience_requirements,
    raw?.occupation_requirements,
    raw?.skills_data,
  ];

  for (const block of nestedCandidates) {
    const arr = [
      ...asArray(block?.skills),
      ...asArray(block?.skill),
      ...asArray(block?.element),
      ...asArray(block?.descriptor),
    ];
    if (arr.length > 0) return arr;
  }

  return [];
}

export function normalizeOnetDetailsToSkillRequirements(raw: any, canonicalName: string): NormalizedSkillRequirement[] {
  const items = extractCandidateSkills(raw);
  const output: NormalizedSkillRequirement[] = [];

  for (const item of items) {
    const skillName = item?.name || item?.title || item?.label || item?.element_name;
    if (!skillName) continue;

    const importanceRaw =
      item?.importance ??
      item?.score ??
      item?.value ??
      item?.data_value ??
      item?.level;

    const fallbackImportanceScore = Math.max(50, 92 - output.length * 4);
    const importanceScore = Number.isFinite(Number(importanceRaw)) ? Number(importanceRaw) : fallbackImportanceScore;

    if (!Number.isFinite(importanceScore)) continue;

    output.push({
      occupationCanonicalName: canonicalName,
      skillName,
      skillCategory: inferSkillCategory(skillName),
      importanceScore,
      requiredProficiencyBand: inferBandFromImportance(importanceScore),
      evidenceSource: "onet",
    });
  }

  // de-duplicate by skill name, taking the highest importance score
  const bySkill = new Map<string, NormalizedSkillRequirement>();
  for (const row of output) {
    const key = row.skillName.toLowerCase();
    const existing = bySkill.get(key);
    if (!existing || row.importanceScore > existing.importanceScore) {
      bySkill.set(key, row);
    }
  }

  return Array.from(bySkill.values()).sort((a, b) => b.importanceScore - a.importanceScore).slice(0, 20);
}

export function normalizeOnetTechnologySkillsToSkillRequirements(
  raw: any,
  canonicalName: string
): NormalizedSkillRequirement[] {
  const categories = asArray(raw?.category);
  const output: NormalizedSkillRequirement[] = [];

  for (const category of categories) {
    for (const example of asArray(category?.example)) {
      const skillName = example?.title;
      if (!skillName) continue;

      output.push({
        occupationCanonicalName: canonicalName,
        skillName,
        skillCategory: "technical",
        importanceScore: Math.max(50, 92 - output.length * 3),
        requiredProficiencyBand: output.length < 4 ? "advanced" : output.length < 10 ? "intermediate" : "basic",
        evidenceSource: "onet_technology_skills",
      });
    }
  }

  const bySkill = new Map<string, NormalizedSkillRequirement>();
  for (const row of output) {
    const key = row.skillName.toLowerCase();
    if (!bySkill.has(key)) {
      bySkill.set(key, row);
    }
  }

  return Array.from(bySkill.values()).slice(0, 20);
}

function normalizeAnnualMedianWageToSignalValue(annualMedian: number): number {
  const minWage = 30000;
  const maxWage = 200000;
  const clamped = Math.min(Math.max(annualMedian, minWage), maxWage);
  const normalized = (Math.log(clamped) - Math.log(minWage)) / (Math.log(maxWage) - Math.log(minWage));
  return Number((normalized * 10).toFixed(2));
}

export function normalizeOnetCareerOutlookToMarketSignals(input: {
  raw: any;
  occupationCanonicalName: string;
  effectiveDate: string;
}): NormalizedMarketSignal[] {
  const signals: NormalizedMarketSignal[] = [];
  const occupationCanonicalName = input.occupationCanonicalName;
  const outlookCategory = String(input.raw?.outlook?.category || "").trim();
  const brightOutlookItems = asArray(input.raw?.bright_outlook);
  const brightOutlookTitles = new Set(
    brightOutlookItems
      .map((item) => String(item?.title || item?.code || "").trim())
      .filter(Boolean)
  );

  if (outlookCategory) {
    const signalValue =
      outlookCategory === "Bright" ? 8.5 :
      outlookCategory === "Average" ? 6 :
      4;

    signals.push({
      occupationCanonicalName,
      signalType: "demand_growth",
      signalValue,
      signalDirection: outlookCategory === "Bright" ? "rising" : "stable",
      sourceName: "O*NET My Next Move / BLS Employment Projections",
      effectiveDate: input.effectiveDate,
      confidenceLevel: "high",
    });
  }

  if (brightOutlookTitles.has("Openings")) {
    signals.push({
      occupationCanonicalName,
      signalType: "openings_trend",
      signalValue: 8.8,
      signalDirection: "rising",
      sourceName: "O*NET My Next Move / BLS Employment Projections",
      effectiveDate: input.effectiveDate,
      confidenceLevel: "high",
    });
  }

  if (brightOutlookTitles.has("New & Emerging")) {
    signals.push({
      occupationCanonicalName,
      signalType: "openings_trend",
      signalValue: 7.8,
      signalDirection: "rising",
      sourceName: "O*NET My Next Move / BLS Employment Projections",
      effectiveDate: input.effectiveDate,
      confidenceLevel: "medium",
    });
  }

  const annualMedian =
    input.raw?.salary?.annual_median ??
    input.raw?.salary?.annual_median_over;
  const numericAnnualMedian = annualMedian != null ? Number(annualMedian) : NaN;
  if (Number.isFinite(numericAnnualMedian)) {
    signals.push({
      occupationCanonicalName,
      signalType: "wage",
      signalValue: normalizeAnnualMedianWageToSignalValue(numericAnnualMedian),
      signalDirection: "stable",
      sourceName: "O*NET My Next Move / BLS OEWS",
      effectiveDate: input.effectiveDate,
      confidenceLevel: "high",
    });
  }

  return signals;
}
