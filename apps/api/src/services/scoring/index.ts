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

function skillLexiconTerms(skillName: string): string[] {
  const key = skillName.toLowerCase();
  return SKILL_LEXICON[key] || [key];
}

function inferSkillEvidenceScore(input: StudentScoringInput, skillName: string): number {
  const key = skillName.toLowerCase();
  const lexiconTerms = skillLexiconTerms(skillName);

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

function scoreExperienceRoleRelevance(input: StudentScoringInput): number {
  const topSkills = input.occupationSkills
    .sort((a, b) => b.importanceScore - a.importanceScore)
    .slice(0, 8);

  if (!topSkills.length || !input.experiences.length) {
    return 0;
  }

  let matchedEvidence = 0;

  for (const exp of input.experiences) {
    const tools = (exp.toolsUsed || []).join(" ");
    const summary = `${exp.title} ${exp.deliverablesSummary || ""} ${tools}`;
    for (const skill of topSkills) {
      if (textContainsEvidence(summary, skillLexiconTerms(skill.skillName))) {
        matchedEvidence += skill.importanceScore;
      }
    }
  }

  const maxEvidence = topSkills.reduce((sum, skill) => sum + skill.importanceScore, 0) * Math.max(input.experiences.length, 1);
  return clamp((matchedEvidence / Math.max(maxEvidence, 1)) * 100);
}

function computeMarketDemand(input: StudentScoringInput): number {
  const signals = input.marketSignals || [];
  if (!signals.length) {
    return 70;
  }

  let score = 60;

  for (const signal of signals) {
    const weight = signal.scope === "role" ? 1.15 : 0.8;
    const confidenceMultiplier =
      signal.confidenceLevel === "high" ? 1 :
      signal.confidenceLevel === "medium" ? 0.8 :
      signal.confidenceLevel === "low" ? 0.6 : 0.75;

    const value = signal.signalValue ?? 0;

    if (signal.signalType === "unemployment_pressure") {
      score += (10 - Math.min(value, 10)) * 4.2 * weight * confidenceMultiplier;
    } else if (signal.signalType === "demand_growth" || signal.signalType === "openings_trend" || signal.signalType === "internship_availability" || signal.signalType === "wage") {
      score += Math.min(value, 10) * 2.5 * weight * confidenceMultiplier;
    } else if (signal.signalType === "hiring_slowdown" || signal.signalType === "ai_disruption_signal") {
      score -= Math.min(value, 10) * 2.5 * weight * confidenceMultiplier;
    }

    if (signal.signalDirection === "rising" && (signal.signalType === "demand_growth" || signal.signalType === "openings_trend" || signal.signalType === "internship_availability" || signal.signalType === "wage")) {
      score += 6 * confidenceMultiplier;
    }
    if (signal.signalDirection === "falling" && signal.signalType === "unemployment_pressure") {
      score += 5 * confidenceMultiplier;
    }
    if (signal.signalDirection === "rising" && signal.signalType === "unemployment_pressure") {
      score -= 6 * confidenceMultiplier;
    }
    if (signal.signalDirection === "rising" && (signal.signalType === "hiring_slowdown" || signal.signalType === "ai_disruption_signal")) {
      score -= 5 * confidenceMultiplier;
    }
  }

  return clamp(Math.round(score));
}

function computeAcademicReadiness(input: StudentScoringInput): number {
  const transcript = input.transcript;
  const requirementProgress = input.requirementProgress;

  if (!transcript && !requirementProgress?.boundToCatalog) {
    return 35;
  }

  let score = 35;

  if (transcript) {
    score += 10;
    score += Math.min(transcript.completedCourseCount, 12) * 1.5;
    const matchRate =
      transcript.completedCourseCount > 0
        ? transcript.matchedCatalogCourseCount / transcript.completedCourseCount
        : 0;
    score += matchRate * 20;
  }

  if (requirementProgress?.boundToCatalog) {
    score += 10;
    score += requirementProgress.completionPercent * 0.32;
    const groupRate =
      requirementProgress.totalRequirementGroups > 0
        ? requirementProgress.satisfiedRequirementGroups / requirementProgress.totalRequirementGroups
        : 0;
    score += groupRate * 15;

    if (requirementProgress.inferredConfidence === "high") score += 6;
    else if (requirementProgress.inferredConfidence === "medium") score += 3;
  }

  return clamp(Math.round(score));
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
  const unmetWeight = gaps.reduce((acc, g) => {
    const req = input.occupationSkills.find((r) => r.skillName.toLowerCase() === g.skillName.toLowerCase());
    return acc + (req?.importanceScore || 10);
  }, 0);

  const totalWeight = input.occupationSkills.reduce((acc, s) => acc + (s.importanceScore || 10), 0) || 1;
  const academicReadiness = computeAcademicReadiness(input);
  const requirementCompletionBoost =
    input.requirementProgress?.boundToCatalog
      ? Math.round((input.requirementProgress.completionPercent - 50) * 0.12)
      : 0;
  const transcriptPenalty =
    input.transcript && input.transcript.completedCourseCount > 0 && input.transcript.matchedCatalogCourseCount === 0
      ? -6
      : 0;
  const roleAlignment = clamp(100 - (unmetWeight / totalWeight) * 100 + requirementCompletionBoost + transcriptPenalty);
  const experienceRoleRelevance = scoreExperienceRoleRelevance(input);
  const jobZoneAdjustment =
    input.occupationMetadata?.jobZone === 5 ? -6 :
    input.occupationMetadata?.jobZone === 4 ? -3 :
    input.occupationMetadata?.jobZone === 1 ? 3 : 0;

  const experienceStrength = clamp(
    (input.experiences.length * 18) +
    input.experiences.reduce((a, e) => a + ((e.relevanceRating || 3) * 4), 0) +
    (experienceRoleRelevance * 0.35) +
    jobZoneAdjustment
  );

  const proofOfWorkStrength = clamp(
    input.artifacts.length * 12 +
    (input.signals.hasIndependentProjectBySeniorYear ? 25 : 0) +
    (input.occupationMetadata?.jobZone === 5 ? -4 : 0)
  );

  const networkStrength = clamp(
    (input.contacts.length * 6) +
    (input.outreach.length * 4) +
    (input.signals.hasFirstOrSecondDegreeProfessionalNetwork ? 20 : 0) +
    (input.signals.hasCarefullyCultivatedMentors ? 20 : 0)
  );

  const executionMomentum = clamp(
    80 -
      ((input.signals.repeatedDeadlineMisses || 0) * 12) +
      (input.transcript?.parsedStatus === "matched" ? 6 : 0) -
      ((input.requirementProgress?.missingRequiredCourses.length || 0) > 5 ? 6 : 0)
  );

  const marketDemand = computeMarketDemand(input);

  return {
    roleAlignment,
    marketDemand,
    academicReadiness,
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
    subscores.roleAlignment * 0.18 +
    subscores.marketDemand * 0.10 +
    subscores.academicReadiness * 0.20 +
    subscores.experienceStrength * 0.16 +
    subscores.proofOfWorkStrength * 0.12 +
    subscores.networkStrength * 0.12 +
    subscores.executionMomentum * 0.12;

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
      subScores.roleAlignment * 0.18 +
      subScores.marketDemand * 0.10 +
      subScores.academicReadiness * 0.20 +
      subScores.experienceStrength * 0.16 +
      subScores.proofOfWorkStrength * 0.12 +
      subScores.networkStrength * 0.12 +
      subScores.executionMomentum * 0.12
    )
  );

  const topStrengths: string[] = [];
  if (subScores.roleAlignment >= 75) topStrengths.push("Good alignment between current evidence and target role family");
  if (subScores.academicReadiness >= 70) topStrengths.push("Transcript and degree-requirement progress are supporting the target path");
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

  if (subScores.academicReadiness <= 45) {
    topRisks.unshift("Transcript and degree progress are not yet strongly supporting the stated target");
  }

  if (input.requirementProgress?.missingRequiredCourses.length) {
    topRisks.push(
      `Missing or unmapped core requirements include ${input.requirementProgress.missingRequiredCourses.slice(0, 3).join(", ")}`
    );
  }

  return {
    studentId: input.studentId,
    targetRoleFamily: input.targetRoleFamily,
    targetSectorCluster: input.targetSectorCluster,
    trajectoryStatus,
    overallScore,
    subScores,
    topStrengths,
    topRisks: topRisks.slice(0, 5),
    heuristicFlags,
    skillGaps,
    recommendations,
  };
}
