import { OccupationRepository } from "../../repositories/market/occupationRepository";
import { stableId } from "./idFactory";
import type { NormalizedOccupation, NormalizedSkillRequirement, NormalizedMarketSignal } from "./normalizers";

const repo = new OccupationRepository();

export async function persistNormalizedOccupation(occ: NormalizedOccupation) {
  await repo.upsertOccupationCluster({
    occupationClusterId: stableId("occupation_cluster", occ.canonicalName),
    canonicalName: occ.canonicalName,
    onetCode: occ.onetCode,
    description: occ.description,
  });
}

export async function persistNormalizedSkill(req: NormalizedSkillRequirement) {
  await repo.upsertOccupationSkillRequirement({
    occupationSkillRequirementId: stableId("occupation_skill_requirement", `${req.occupationCanonicalName}:${req.skillName}`),
    occupationClusterId: stableId("occupation_cluster", req.occupationCanonicalName),
    skillName: req.skillName,
    skillCategory: req.skillCategory,
    importanceScore: req.importanceScore,
    requiredProficiencyBand: req.requiredProficiencyBand,
    evidenceSource: req.evidenceSource,
  });
}

export async function persistNormalizedMarketSignal(signal: NormalizedMarketSignal) {
  await repo.upsertMarketSignal({
    marketSignalId: stableId("market_signal", `${signal.occupationCanonicalName || "macro"}:${signal.signalType}:${signal.geographyCode || "national"}:${signal.effectiveDate}`),
    occupationClusterId: signal.occupationCanonicalName ? stableId("occupation_cluster", signal.occupationCanonicalName) : undefined,
    geographyCode: signal.geographyCode,
    signalType: signal.signalType,
    signalValue: signal.signalValue,
    signalDirection: signal.signalDirection,
    sourceName: signal.sourceName,
    effectiveDate: signal.effectiveDate,
    confidenceLevel: signal.confidenceLevel,
  });
}
