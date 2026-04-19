import { inferBandFromImportance, inferSkillCategory, type NormalizedOccupation, type NormalizedSkillRequirement } from "./normalizers";

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
  return (
    asArray(raw?.occupation) ||
    asArray(raw?.occupations) ||
    asArray(raw?.results) ||
    asArray(raw?.row) ||
    asArray(raw?.search_results) ||
    []
  );
}

export function normalizeOnetSearchResultToOccupation(raw: any, canonicalName: string): NormalizedOccupation | null {
  const rows = extractOnetSearchRows(raw);
  const first = rows[0];

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
      item?.level ??
      60;

    const importanceScore = Number(importanceRaw);
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
