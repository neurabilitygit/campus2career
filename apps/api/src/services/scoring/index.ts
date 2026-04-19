import type {
  StudentScoringInput,
  ScoringOutput,
  SubScores,
  SkillGapItem,
  ProficiencyBand,
} from "../../../../../packages/shared/src/scoring/types";
import { SKILL_LEXICON } from "../../../../../packages/shared/src/scoring/roleSkillLexicon";
import { getRecommendationsForSkill } from "../../../../../packages/shared/src/scoring/recommendationCatalog";
import { applyHeuristics } from "../heuristics";

const strengthToNumeric = {
  low: 0.35,
  medium: 0.65,
  high: 0.9,
} as const;

const bandNumeric: Record<ProficiencyBand, number> = {
  none: 0,
  basic: 0.35,
  intermediate: 0.65,
  advanced: 0.9,
};

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function textContainsEvidence(text: string | undefined, terms: string[]) {
  if (!text) return false;
  const hay = text.toLowerCase();
  return terms.some((t) => hay.includes(t.toLowerCase()));
}

function inferSkillEvidenceScore(input: StudentScoringInput, skillName: string): number {
  const key = skillName.toLowerCase();
  const lexiconTerms = SKILL_LEXICON[key] || [key];

  let score = 0;

  for (const course of input.courseCoverage.filter((c) => c.skillName.toLowerCase() === key)) {
    score += strengthToNumeric[course.coverageStrength] * (course.confidenceScore || 0.5) * 30;
  }

  for (const exp of input.experiences) {
    const tools = (exp.toolsUsed || []).join(" ").toLowerCase();
    const summary = `${exp.title} ${exp.deliverablesSummary || ""} ${tools}`;
    if (textContainsEvidence(summary, lexiconTerms)) {
      score += 20 + ((exp.relevanceRating || 3) * 2);
    }
  }

  for (const artifact of input.artifacts) {
    const summary = `${artifact.artifactType} ${artifact.extractedSummary || ""} ${(artifact.tags || []).join(" ")}`;
    if (textContainsEvidence(summary, lexiconTerms)) {
      score += 15;
    }
  }

  if (key === "ai_fluency" && input.signals.aiToolComfortLevel) {
    score += input.signals.aiToolComfortLevel === "high" ? 25 : input.signals.aiToolComfortLevel === "medium" ? 15 : 5;
  }

  return Math.min(score, 100);
}

function estimateBandFromScore(score: number): ProficiencyBand {
  if (score >= 80) return "advanced";
  if (score >= 55) return "intermediate";
  if (score >= 25) return "basic";
  return "none";
}

function requiredBandToMinScore(band: Exclude<ProficiencyBand, "none">): number {
  if (band === "advanced") return 80;
  if (band === "intermediate") return 55;
  return 25;
}

function buildSkillGaps(input: StudentScoringInput): SkillGapItem[] {
  const items: SkillGapItem[] = [];

  for (const req of input.occupationSkills) {
    const evidenceScore = inferSkillEvidenceScore(input, req.skillName);
    const currentBand = estimateBandFromScore(evidenceScore);
    const requiredMin = requiredBandToMinScore(req.requiredProficiencyBand);
    const delta = requiredMin - evidenceScore;

    if (delta <= 0) continue;

    const gapSeverity =
      delta >= 35 ? "high" :
      delta >= 15 ? "medium" : "low";

    items.push({
      skillName: req.skillName,
      requiredLevel: req.requiredProficiencyBand,
      estimatedCurrentLevel: currentBand,
      gapSeverity,
      evidenceSummary: `Estimated evidence score ${Math.round(evidenceScore)} vs required threshold ${requiredMin}.`,
      recommendationPriority: gapSeverity === "high" ? 5 : gapSeverity === "medium" ? 3 : 2,
    });
  }

  return items.sort((a, b) => b.recommendationPriority - a.recommendationPriority);
}

function computeSubScores(input: StudentScoringInput, gaps: SkillGapItem[]): SubScores {
  const totalSkills = Math.max(input.occupationSkills.length, 1);
  const unmetWeight = gaps.reduce((acc, g) => {
    const req = input.occupationSkills.find((r) => r.skillName.toLowerCase() === g.skillName.toLowerCase());
    return acc + (req?.importanceScore || 10);
  }, 0);

  const totalWeight = input.occupationSkills.reduce((acc, s) => acc + (s.importanceScore || 10), 0) || 1;
  const roleAlignment = clamp(100 - (unmetWeight / totalWeight) * 100);

  const experienceStrength = clamp(
    (input.experiences.length * 18) +
    input.experiences.reduce((a, e) => a + ((e.relevanceRating || 3) * 4), 0)
  );

  const proofOfWorkStrength = clamp(
    input.artifacts.length * 12 +
    (input.signals.hasIndependentProjectBySeniorYear ? 25 : 0)
  );

  const networkStrength = clamp(
    (input.contacts.length * 6) +
    (input.outreach.length * 4) +
    (input.signals.hasFirstOrSecondDegreeProfessionalNetwork ? 20 : 0) +
    (input.signals.hasCarefullyCultivatedMentors ? 20 : 0)
  );

  const executionMomentum = clamp(
    80 - ((input.signals.repeatedDeadlineMisses || 0) * 12)
  );

  // v1 static default; should later come from market_signals aggregation
  const marketDemand = 70;

  return {
    roleAlignment,
    marketDemand,
    experienceStrength,
    proofOfWorkStrength,
    networkStrength,
    executionMomentum,
  };
}

function deriveTrajectoryStatus(
  subscores: SubScores,
  heuristicFlagsCountCritical: number,
  signals: StudentScoringInput["signals"]
): "on_track" | "watch" | "at_risk" {
  const weighted =
    subscores.roleAlignment * 0.23 +
    subscores.marketDemand * 0.12 +
    subscores.experienceStrength * 0.20 +
    subscores.proofOfWorkStrength * 0.15 +
    subscores.networkStrength * 0.15 +
    subscores.executionMomentum * 0.15;

  if (heuristicFlagsCountCritical >= 2) return "at_risk";
  if (!signals.hasInternshipByJuniorYear && signals.currentAcademicYear === "junior") return "at_risk";
  if (!signals.hasFirstOrSecondDegreeProfessionalNetwork) return weighted >= 70 ? "watch" : "at_risk";
  if (weighted >= 75) return "on_track";
  if (weighted >= 55) return "watch";
  return "at_risk";
}

export function runScoring(input: StudentScoringInput): ScoringOutput {
  const skillGaps = buildSkillGaps(input);
  const heuristicFlags = applyHeuristics(input, skillGaps);
  const subScores = computeSubScores(input, skillGaps);
  const criticalFlags = heuristicFlags.filter((f) => f.severity === "critical").length;
  const trajectoryStatus = deriveTrajectoryStatus(subScores, criticalFlags, input.signals);

  const recommendations = skillGaps
    .flatMap((gap) => getRecommendationsForSkill(gap.skillName))
    .slice(0, 12);

  const overallScore = clamp(
    Math.round(
      subScores.roleAlignment * 0.23 +
      subScores.marketDemand * 0.12 +
      subScores.experienceStrength * 0.20 +
      subScores.proofOfWorkStrength * 0.15 +
      subScores.networkStrength * 0.15 +
      subScores.executionMomentum * 0.15
    )
  );

  const topStrengths: string[] = [];
  if (subScores.roleAlignment >= 75) topStrengths.push("Good alignment between current evidence and target role family");
  if (subScores.experienceStrength >= 60) topStrengths.push("Experience profile is stronger than a typical early candidate");
  if (subScores.networkStrength >= 55) topStrengths.push("Professional network is becoming a meaningful asset");
  if (subScores.proofOfWorkStrength >= 50) topStrengths.push("Proof-of-work signal is visible and helpful");

  const topRisks: string[] = [
    ...heuristicFlags
      .filter((f) => f.severity !== "info")
      .map((f) => f.title),
    ...skillGaps
      .filter((g) => g.gapSeverity !== "low")
      .slice(0, 3)
      .map((g) => `Gap in ${g.skillName}`),
  ].slice(0, 5);

  return {
    studentId: input.studentId,
    targetRoleFamily: input.targetRoleFamily,
    targetSectorCluster: input.targetSectorCluster,
    trajectoryStatus,
    overallScore,
    subScores,
    topStrengths,
    topRisks,
    heuristicFlags,
    skillGaps,
    recommendations,
  };
}
