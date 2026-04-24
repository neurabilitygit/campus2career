import type {
  AssessmentMode,
  EvidenceLevel,
  StudentScoringInput,
  ScoringOutput,
  SubScores,
  SkillGapItem,
  ProficiencyBand,
  SubScoreEvidenceDetail,
  EvidenceCategory,
} from "../../../../../packages/shared/src/scoring/types";
import type { ConfidenceLabel } from "../../../../../packages/shared/src/contracts/truth";
import { SKILL_LEXICON } from "../../../../../packages/shared/src/scoring/roleSkillLexicon";
import { getRecommendationsForSkill } from "../../../../../packages/shared/src/scoring/recommendationCatalog";
import { applyHeuristics } from "../heuristics";
import {
  buildEvidenceAssessments,
  buildSubscoreEvidenceSummary,
  summarizeOverallEvidence,
} from "./evidenceIntegrity";

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

function scoreStatus(score: number): "strong" | "developing" | "weak" {
  if (score >= 75) return "strong";
  if (score >= 55) return "developing";
  return "weak";
}

function evidenceLevelRank(level: EvidenceLevel): number {
  if (level === "strong") return 4;
  if (level === "moderate") return 3;
  if (level === "weak") return 2;
  return 1;
}

function minEvidenceLevel(left: EvidenceLevel, right: EvidenceLevel): EvidenceLevel {
  return evidenceLevelRank(left) <= evidenceLevelRank(right) ? left : right;
}

function confidenceToNumeric(label: ConfidenceLabel): number {
  if (label === "high") return 3;
  if (label === "medium") return 2;
  return 1;
}

function minConfidence(left: ConfidenceLabel, right: ConfidenceLabel): ConfidenceLabel {
  return confidenceToNumeric(left) <= confidenceToNumeric(right) ? left : right;
}

function listToSentence(values: string[]): string {
  if (!values.length) return "none";
  return values.join(", ");
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

function countSkillEvidenceSources(input: StudentScoringInput, skillName: string): number {
  const key = skillName.toLowerCase();
  let count = 0;
  if (input.courseCoverage.some((course) => course.skillName.toLowerCase() === key)) {
    count += 1;
  }
  if (
    input.experiences.some((exp) =>
      textContainsEvidence(
        `${exp.title} ${exp.deliverablesSummary || ""} ${(exp.toolsUsed || []).join(" ")}`,
        skillLexiconTerms(skillName)
      )
    )
  ) {
    count += 1;
  }
  if (
    input.artifacts.some((artifact) =>
      textContainsEvidence(
        `${artifact.artifactType} ${artifact.extractedSummary || ""} ${(artifact.tags || []).join(" ")}`,
        skillLexiconTerms(skillName)
      )
    )
  ) {
    count += 1;
  }
  if (key === "ai_fluency" && input.signals.aiToolComfortLevel) {
    count += 1;
  }
  return count;
}

function roleAlignmentEvidenceLevel(input: StudentScoringInput): EvidenceLevel {
  const skillEvidenceSources = input.occupationSkills
    .map((req) => countSkillEvidenceSources(input, req.skillName))
    .filter((count) => count > 0).length;

  if (input.targetResolution?.truthStatus === "unresolved" || input.occupationSkills.length === 0) {
    return "missing";
  }
  if (
    input.targetResolution?.truthStatus === "fallback" ||
    input.occupationSkillTruth?.truthStatus === "fallback"
  ) {
    return skillEvidenceSources >= 1 ? "weak" : "missing";
  }
  if (skillEvidenceSources >= 4) return "strong";
  if (skillEvidenceSources >= 2) return "moderate";
  if (skillEvidenceSources >= 1) return "weak";
  return "missing";
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

function computeMarketDemand(input: StudentScoringInput): SubScoreEvidenceDetail {
  const signals = input.marketSignals || [];
  if (!signals.length) {
    const score = 55;
    return {
      score,
      status: scoreStatus(score),
      evidenceLevel: "missing",
      evidenceStatus: "missing",
      confidenceLabel: "low",
      requiredEvidence: ["market_signals", "target_role"],
      availableEvidence: input.targetResolution ? ["target_role"] : [],
      missingEvidence: ["market_signals"],
      weakEvidence: [],
      sourceFlags: [],
      evidenceNotes: [],
      recommendedEvidence: ["Load market signals for the target role", "Confirm target role"],
      explanation:
        "Market demand cannot be evaluated confidently because no persisted role-specific market signals are loaded.",
      interpretation: "No persisted market signals are loaded, so market demand is using a conservative baseline rather than role-specific evidence.",
      knownSignals: [],
      missingSignals: ["Role-specific labor market signals", "Recent demand or openings trend"],
    };
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

  let normalizedScore = clamp(Math.round(score));
  const fallbackSignals = input.marketSignalTruth?.truthStatus === "fallback";
  if (fallbackSignals) {
    normalizedScore = clamp(Math.round(55 + (normalizedScore - 55) * 0.55), 35, 68);
  }

  const confidenceLabel =
    input.marketSignalTruth?.confidenceLabel ||
    (signals.some((signal) => signal.confidenceLevel === "high") ? "high" : "medium");
  const evidenceLevel =
    fallbackSignals
      ? "weak"
      : signals.length >= 3
        ? "strong"
        : signals.length >= 2
          ? "moderate"
          : "weak";

  return {
    score: normalizedScore,
    status: scoreStatus(normalizedScore),
    evidenceLevel,
    evidenceStatus:
      evidenceLevel === "strong"
        ? "supported"
        : evidenceLevel === "moderate"
          ? "partial"
          : fallbackSignals
            ? "uncertain"
            : "partial",
    confidenceLabel,
    requiredEvidence: ["market_signals", "target_role"],
    availableEvidence: ["market_signals", "target_role"],
    missingEvidence: fallbackSignals ? [] : [],
    weakEvidence: evidenceLevel === "weak" ? ["market_signals"] : [],
    sourceFlags: fallbackSignals ? ["placeholder"] : [],
    evidenceNotes: fallbackSignals ? ["Available market inputs are seeded fallback signals."] : [],
    recommendedEvidence: fallbackSignals ? ["Load market signals for the target role"] : [],
    explanation: fallbackSignals
      ? "Market demand is directionally useful, but the current market evidence is seeded fallback data rather than strong live signal coverage."
      : `Market demand is supported by ${signals.length} imported signal${signals.length === 1 ? "" : "s"} for the target role.`,
    interpretation: fallbackSignals
      ? "Market demand is based on seeded or fallback signals, so this should be read as directional context rather than a firm market conclusion."
      : `Market demand reflects ${signals.length} imported signal${signals.length === 1 ? "" : "s"} for the target role.`,
    knownSignals: signals.slice(0, 3).map((signal) => signal.signalType.replace(/_/g, " ")),
    missingSignals: fallbackSignals ? ["Live or institution-reviewed market inputs"] : [],
  };
}

function computeAcademicReadiness(input: StudentScoringInput): SubScoreEvidenceDetail {
  const transcript = input.transcript;
  const requirementProgress = input.requirementProgress;

  if (!transcript && !requirementProgress?.boundToCatalog) {
    const score = 50;
    return {
      score,
      status: scoreStatus(score),
      evidenceLevel: "missing",
      evidenceStatus: "missing",
      confidenceLabel: "low",
      requiredEvidence: ["transcript", "academic_requirements", "student_profile"],
      availableEvidence: ["student_profile"],
      missingEvidence: ["transcript", "academic_requirements"],
      weakEvidence: [],
      sourceFlags: ["unresolved"],
      evidenceNotes: [],
      recommendedEvidence: ["Upload transcript", "Confirm degree program"],
      explanation:
        "Academic readiness cannot be evaluated reliably because transcript and structured degree-requirement evidence are both missing.",
      interpretation: "Academic readiness is provisional because no parsed transcript and no structured requirement binding are available yet.",
      knownSignals: [],
      missingSignals: ["Parsed transcript", "Structured requirement binding"],
    };
  }

  let score = 45;
  let evidenceLevel: EvidenceLevel = "weak";
  let confidenceLabel: ConfidenceLabel = "low";
  const knownSignals: string[] = [];
  const missingSignals: string[] = [];
  const sourceFlags: Array<"inferred" | "unresolved" | "placeholder" | "stale" | "self_reported"> = [];
  const evidenceNotes: string[] = [];

  if (transcript) {
    score += 8;
    score += Math.min(transcript.completedCourseCount, 12) * 1.5;
    const matchRate =
      transcript.completedCourseCount > 0
        ? transcript.matchedCatalogCourseCount / transcript.completedCourseCount
        : 0;
    score += matchRate * 16;
    knownSignals.push("Parsed transcript");
    if (transcript.matchedCatalogCourseCount > 0) {
      knownSignals.push("Transcript-to-catalog matches");
    } else if (transcript.completedCourseCount > 0) {
      missingSignals.push("Catalog matches for completed courses");
    }
    evidenceLevel =
      transcript.matchedCatalogCourseCount >= 8
        ? "strong"
        : transcript.matchedCatalogCourseCount >= 3
          ? "moderate"
          : "weak";
    confidenceLabel = transcript.extractionConfidenceLabel || confidenceLabel;
    if (transcript.truthStatus === "inferred") {
      sourceFlags.push("inferred");
    }
    if (transcript.institutionResolutionTruthStatus === "unresolved") {
      sourceFlags.push("unresolved");
    }
    if (transcript.institutionResolutionNote) {
      evidenceNotes.push(transcript.institutionResolutionNote);
    }
  } else {
    missingSignals.push("Parsed transcript");
  }

  if (requirementProgress?.boundToCatalog) {
    score += 12;
    score += requirementProgress.completionPercent * 0.28;
    const groupRate =
      requirementProgress.totalRequirementGroups > 0
        ? requirementProgress.satisfiedRequirementGroups / requirementProgress.totalRequirementGroups
        : 0;
    score += groupRate * 14;

    if (requirementProgress.inferredConfidence === "high") score += 6;
    else if (requirementProgress.inferredConfidence === "medium") score += 3;
    knownSignals.push("Structured requirement progress");
    evidenceLevel = minEvidenceLevel(
      evidenceLevel,
      requirementProgress.truthStatus === "direct"
        ? "strong"
        : requirementProgress.truthStatus === "inferred"
          ? "moderate"
        : requirementProgress.truthStatus === "fallback"
            ? "weak"
            : "missing"
    );
    confidenceLabel = minConfidence(confidenceLabel, requirementProgress.inferredConfidence);
    if (requirementProgress.truthStatus === "inferred") {
      sourceFlags.push("inferred");
    }
    if (requirementProgress.truthStatus === "fallback") {
      sourceFlags.push("placeholder");
    }
    evidenceNotes.push(...(requirementProgress.coverageNotes || []));
  } else {
    missingSignals.push("Bound degree requirements");
  }

  if (!transcript || !requirementProgress?.boundToCatalog) {
    score = Math.max(Math.min(score, 62), 48);
  }

  const normalizedScore = clamp(Math.round(score));
  return {
    score: normalizedScore,
    status: scoreStatus(normalizedScore),
    evidenceLevel,
    evidenceStatus:
      !transcript || !requirementProgress?.boundToCatalog
        ? "uncertain"
        : evidenceLevel === "strong"
          ? "supported"
          : evidenceLevel === "moderate"
            ? "partial"
            : "uncertain",
    confidenceLabel,
    requiredEvidence: ["transcript", "academic_requirements", "student_profile"],
    availableEvidence: [
      ...(transcript ? ["transcript" as const] : []),
      ...(requirementProgress?.boundToCatalog ? ["academic_requirements" as const] : []),
      ...((input.preferredGeographies?.length || input.targetRoleFamily) ? ["student_profile" as const] : []),
    ],
    missingEvidence: [
      ...(!transcript ? ["transcript" as const] : []),
      ...(!requirementProgress?.boundToCatalog ? ["academic_requirements" as const] : []),
    ],
    weakEvidence: evidenceLevel === "weak" ? ["transcript", "academic_requirements"] : [],
    sourceFlags: Array.from(new Set(sourceFlags)),
    evidenceNotes: Array.from(new Set(evidenceNotes)).slice(0, 6),
    recommendedEvidence: [
      ...(!transcript ? ["Upload transcript"] : []),
      ...(!requirementProgress?.boundToCatalog ? ["Confirm degree program"] : []),
    ],
    explanation:
      !transcript || !requirementProgress?.boundToCatalog
        ? "Academic readiness is only partially assessable because transcript and requirement evidence are incomplete."
        : "Academic readiness is supported by transcript progress and structured degree requirements.",
    interpretation:
      !transcript || !requirementProgress?.boundToCatalog
        ? "Academic readiness is based on partial academic evidence and should be treated as provisional."
        : "Academic readiness reflects transcript progress and structured degree requirements.",
    knownSignals,
    missingSignals,
  };
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

function computeSubScores(input: StudentScoringInput, gaps: SkillGapItem[]): {
  subScores: SubScores;
  subScoreDetails: Record<keyof SubScores, SubScoreEvidenceDetail>;
} {
  const unmetWeight = gaps.reduce((acc, g) => {
    const req = input.occupationSkills.find((r) => r.skillName.toLowerCase() === g.skillName.toLowerCase());
    return acc + (req?.importanceScore || 10);
  }, 0);

  const totalWeight = input.occupationSkills.reduce((acc, s) => acc + (s.importanceScore || 10), 0) || 1;
  const academicReadinessDetail = computeAcademicReadiness(input);
  const academicReadiness = academicReadinessDetail.score;
  const requirementCompletionBoost =
    input.requirementProgress?.boundToCatalog
      ? Math.round((input.requirementProgress.completionPercent - 50) * 0.12)
      : 0;
  const transcriptPenalty =
    input.transcript && input.transcript.completedCourseCount > 0 && input.transcript.matchedCatalogCourseCount === 0
      ? -6
      : 0;
  let roleAlignment = clamp(100 - (unmetWeight / totalWeight) * 100 + requirementCompletionBoost + transcriptPenalty);
  const roleAlignmentEvidence = roleAlignmentEvidenceLevel(input);
  const roleAlignmentConfidence =
    input.targetResolution?.confidenceLabel === "low" || input.occupationSkillTruth?.confidenceLabel === "low"
      ? "low"
      : input.targetResolution?.confidenceLabel === "medium" || input.occupationSkillTruth?.confidenceLabel === "medium"
        ? "medium"
        : "high";
  if (roleAlignmentEvidence === "missing") {
    roleAlignment = Math.max(Math.min(roleAlignment, 58), 48);
  } else if (roleAlignmentEvidence === "weak") {
    roleAlignment = clamp(Math.round(52 + (roleAlignment - 52) * 0.65), 0, 72);
  }
  const experienceRoleRelevance = scoreExperienceRoleRelevance(input);
  const jobZoneAdjustment =
    input.occupationMetadata?.jobZone === 5 ? -6 :
    input.occupationMetadata?.jobZone === 4 ? -3 :
    input.occupationMetadata?.jobZone === 1 ? 3 : 0;

  const experienceStrength = input.experiences.length
    ? clamp(
        42 +
          (input.experiences.length * 12) +
          input.experiences.reduce((a, e) => a + ((e.relevanceRating || 3) * 3), 0) +
          (experienceRoleRelevance * 0.25) +
          jobZoneAdjustment
      )
    : 50;

  const proofOfWorkStrength = input.artifacts.length
    ? clamp(
        40 +
          input.artifacts.length * 10 +
          (input.signals.hasIndependentProjectBySeniorYear ? 15 : 0) +
          (input.occupationMetadata?.jobZone === 5 ? -4 : 0)
      )
    : 48;

  const networkStrength = input.contacts.length || input.outreach.length
    ? clamp(
        38 +
          (input.contacts.length * 5) +
          (input.outreach.length * 3) +
          (input.signals.hasFirstOrSecondDegreeProfessionalNetwork ? 10 : 0) +
          (input.signals.hasCarefullyCultivatedMentors ? 10 : 0)
      )
    : 48;

  const deadlineCount = input.deadlines?.length || 0;
  const completedDeadlineCount = (input.deadlines || []).filter((deadline) => deadline.completed).length;
  const deadlineCompletionRate =
    deadlineCount > 0 ? completedDeadlineCount / Math.max(deadlineCount, 1) : 0;
  const executionMomentum = clamp(
    (deadlineCount > 0 ? 58 : 50) +
      (deadlineCompletionRate * 18) -
      ((input.signals.repeatedDeadlineMisses || 0) * 12) +
      (input.transcript?.parsedStatus === "matched" ? 5 : 0) -
      ((input.requirementProgress?.missingRequiredCourses.length || 0) > 5 ? 4 : 0)
  );

  const marketDemandDetail = computeMarketDemand(input);
  const marketDemand = marketDemandDetail.score;

  const categoryAssessments = buildEvidenceAssessments(input);

  function withEvidenceSummary(
    detail: SubScoreEvidenceDetail,
    requiredEvidence: EvidenceCategory[]
  ): SubScoreEvidenceDetail {
    const summary = buildSubscoreEvidenceSummary({
      score: detail.score,
      strength: detail.evidenceLevel,
      confidenceLabel: detail.confidenceLabel,
      requiredEvidence,
      categoryAssessments,
      defaultExplanation: detail.explanation || detail.interpretation,
      knownSignals: detail.knownSignals,
      missingSignals: detail.missingSignals,
    });

    return {
      ...detail,
      ...summary,
      interpretation: summary.explanation || detail.explanation || detail.interpretation,
    };
  }

  const roleAlignmentDetail: SubScoreEvidenceDetail = {
    score: roleAlignment,
    status: scoreStatus(roleAlignment),
    evidenceLevel: roleAlignmentEvidence,
    evidenceStatus:
      roleAlignmentEvidence === "strong"
        ? "supported"
        : roleAlignmentEvidence === "moderate"
          ? "partial"
          : roleAlignmentEvidence === "weak"
            ? "uncertain"
            : "missing",
    confidenceLabel: roleAlignmentConfidence,
    requiredEvidence: [],
    availableEvidence: [],
    missingEvidence: [],
    weakEvidence: [],
    sourceFlags:
      roleAlignmentEvidence === "missing"
        ? ["unresolved"]
        : input.targetResolution?.truthStatus === "fallback" || input.occupationSkillTruth?.truthStatus === "fallback"
          ? ["inferred"]
          : [],
    evidenceNotes: [],
    recommendedEvidence: [],
    explanation:
      roleAlignmentEvidence === "missing"
        ? "Role alignment cannot be evaluated reliably because the target role or role-skill map is not grounded strongly enough yet."
        : roleAlignmentEvidence === "weak"
          ? "Role alignment is directionally useful, but it still depends on inferred or fallback target evidence."
          : "Role alignment reflects the current skill evidence against the resolved target role.",
    interpretation:
      roleAlignmentEvidence === "missing"
        ? "Role alignment is mostly unresolved because the target role or required skill map is still too weakly grounded."
        : roleAlignmentEvidence === "weak"
          ? "Role alignment is directional only because the target or skill map still depends on fallback assumptions."
          : "Role alignment reflects the current skill evidence against the resolved target role.",
    knownSignals: [
      ...(input.targetResolution ? [`Target: ${input.targetResolution.sourceLabel}`] : []),
      ...(input.occupationSkills.length ? [`${input.occupationSkills.length} role skills loaded`] : []),
    ],
    missingSignals: roleAlignmentEvidence === "strong" ? [] : ["More role-specific evidence across coursework, experiences, or artifacts"],
  };

  const experienceDetail: SubScoreEvidenceDetail = {
    score: experienceStrength,
    status: scoreStatus(experienceStrength),
    evidenceLevel:
      input.experiences.length >= 3 ? "strong" : input.experiences.length >= 1 ? "moderate" : "missing",
    evidenceStatus: input.experiences.length ? "supported" : "missing",
    confidenceLabel: input.experiences.length >= 2 ? "medium" : "low",
    requiredEvidence: [],
    availableEvidence: [],
    missingEvidence: [],
    weakEvidence: [],
    sourceFlags: [],
    evidenceNotes: [],
    recommendedEvidence: [],
    explanation:
      input.experiences.length === 0
        ? "Experience strength cannot be evaluated confidently because no structured experience history is stored yet."
        : "Experience strength reflects stored experiences and how closely they map to top role skills.",
    interpretation:
      input.experiences.length === 0
        ? "Experience strength is provisional because no structured experiences are stored yet."
        : "Experience strength reflects stored experiences and how closely they map to top role skills.",
    knownSignals: input.experiences.length ? [`${input.experiences.length} structured experience record(s)`] : [],
    missingSignals: input.experiences.length ? [] : ["Internship, job, research, or project experience records"],
  };

  const proofOfWorkDetail: SubScoreEvidenceDetail = {
    score: proofOfWorkStrength,
    status: scoreStatus(proofOfWorkStrength),
    evidenceLevel:
      input.artifacts.length >= 3 ? "strong" : input.artifacts.length >= 1 ? "moderate" : "missing",
    evidenceStatus: input.artifacts.length ? "partial" : "missing",
    confidenceLabel:
      input.artifacts.some((artifact) => artifact.parseConfidenceLabel === "high")
        ? "medium"
        : input.artifacts.length
          ? "low"
          : "low",
    requiredEvidence: [],
    availableEvidence: [],
    missingEvidence: [],
    weakEvidence: [],
    sourceFlags: input.artifacts.some((artifact) => artifact.parseTruthStatus === "placeholder") ? ["placeholder"] : [],
    evidenceNotes: [],
    recommendedEvidence: [],
    explanation:
      input.artifacts.length === 0
        ? "Proof-of-work strength cannot be evaluated confidently because no portfolio or project evidence is stored yet."
        : "Proof-of-work strength reflects visible uploaded artifacts, with lower confidence when parses are summary-only.",
    interpretation:
      input.artifacts.length === 0
        ? "Proof-of-work strength is provisional because no portfolio or artifact evidence is stored yet."
        : "Proof-of-work strength reflects visible uploaded artifacts, with lower confidence when parses are summary-only.",
    knownSignals: input.artifacts.length ? [`${input.artifacts.length} artifact record(s)`] : [],
    missingSignals: input.artifacts.length ? [] : ["Portfolio, resume, project, or presentation artifacts"],
  };

  const networkDetail: SubScoreEvidenceDetail = {
    score: networkStrength,
    status: scoreStatus(networkStrength),
    evidenceLevel:
      input.contacts.length + input.outreach.length >= 5
        ? "strong"
        : input.contacts.length + input.outreach.length >= 1
          ? "moderate"
          : "missing",
    evidenceStatus: input.contacts.length || input.outreach.length ? "partial" : "missing",
    confidenceLabel: input.contacts.length || input.outreach.length ? "medium" : "low",
    requiredEvidence: [],
    availableEvidence: [],
    missingEvidence: [],
    weakEvidence: [],
    sourceFlags: [],
    evidenceNotes: [],
    recommendedEvidence: [],
    explanation:
      !input.contacts.length && !input.outreach.length
        ? "Network strength cannot be evaluated confidently because no contact or outreach history is stored yet."
        : "Network strength reflects stored contacts, mentorship warmth, and outreach activity.",
    interpretation:
      !input.contacts.length && !input.outreach.length
        ? "Network strength is provisional because no contacts or outreach history are stored yet."
        : "Network strength reflects stored contacts, mentorship warmth, and outreach activity.",
    knownSignals: [
      ...(input.contacts.length ? [`${input.contacts.length} contact(s)`] : []),
      ...(input.outreach.length ? [`${input.outreach.length} outreach interaction(s)`] : []),
    ],
    missingSignals: input.contacts.length || input.outreach.length ? [] : ["Contacts, mentor relationships, or outreach history"],
  };

  const executionDetail: SubScoreEvidenceDetail = {
    score: executionMomentum,
    status: scoreStatus(executionMomentum),
    evidenceLevel: deadlineCount >= 4 ? "strong" : deadlineCount >= 1 ? "moderate" : "missing",
    evidenceStatus: deadlineCount ? "partial" : "missing",
    confidenceLabel: deadlineCount >= 2 ? "medium" : "low",
    requiredEvidence: [],
    availableEvidence: [],
    missingEvidence: [],
    weakEvidence: [],
    sourceFlags: [],
    evidenceNotes: [],
    recommendedEvidence: [],
    explanation:
      deadlineCount === 0
        ? "Execution momentum is only partially assessable because no tracked deadlines are stored yet."
        : "Execution momentum reflects deadline tracking and missed-deadline patterns rather than a generic optimistic default.",
    interpretation:
      deadlineCount === 0
        ? "Execution momentum is provisional because no tracked deadlines are stored yet."
        : "Execution momentum reflects deadline tracking and missed-deadline patterns rather than a generic optimistic default.",
    knownSignals: deadlineCount ? [`${deadlineCount} tracked deadline(s)`] : [],
    missingSignals: deadlineCount ? [] : ["Tracked deadlines or execution checkpoints"],
  };

  return {
    subScores: {
      roleAlignment,
      marketDemand,
      academicReadiness,
      experienceStrength,
      proofOfWorkStrength,
      networkStrength,
      executionMomentum,
    },
    subScoreDetails: {
      roleAlignment: withEvidenceSummary(roleAlignmentDetail, [
        "target_role",
        "student_profile",
        "academic_requirements",
        "transcript",
        "experience_history",
        "project_proof_of_work",
      ]),
      marketDemand: marketDemandDetail,
      academicReadiness: withEvidenceSummary(academicReadinessDetail, [
        "transcript",
        "academic_requirements",
        "student_profile",
      ]),
      experienceStrength: withEvidenceSummary(experienceDetail, [
        "experience_history",
        "resume",
        "application_outcome_activity",
        "target_role",
      ]),
      proofOfWorkStrength: withEvidenceSummary(proofOfWorkDetail, [
        "project_proof_of_work",
        "resume",
        "target_role",
      ]),
      networkStrength: withEvidenceSummary(networkDetail, ["network_activity"]),
      executionMomentum: withEvidenceSummary(executionDetail, [
        "execution_activity",
        "application_outcome_activity",
      ]),
    },
  };
}

function deriveTrajectoryStatus(
  subscores: SubScores,
  heuristicFlagsCountCritical: number,
  signals: StudentScoringInput["signals"],
  input: StudentScoringInput
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
  if (!signals.hasInternshipByJuniorYear && signals.currentAcademicYear === "junior" && input.experiences.length > 0) {
    return "at_risk";
  }
  if (weighted >= 75) return "on_track";
  if (weighted >= 55) return "watch";
  return "at_risk";
}

export function runScoring(input: StudentScoringInput): ScoringOutput {
  const skillGaps = buildSkillGaps(input);
  const heuristicFlags = applyHeuristics(input, skillGaps);
  const { subScores, subScoreDetails } = computeSubScores(input, skillGaps);
  const categoryAssessments = buildEvidenceAssessments(input);
  const criticalFlags = heuristicFlags.filter((f) => f.severity === "critical").length;
  const trajectoryStatus = deriveTrajectoryStatus(subScores, criticalFlags, input.signals, input);

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

  const missingEvidence = Object.entries(subScoreDetails)
    .filter(([, detail]) => detail.evidenceLevel === "missing")
    .map(([key, detail]) => `${key}: ${detail.missingSignals[0] || detail.explanation || detail.interpretation}`);
  const weakEvidence = Object.entries(subScoreDetails)
    .filter(([, detail]) => detail.evidenceLevel === "weak" || detail.evidenceLevel === "moderate")
    .map(([key, detail]) => `${key}: ${detail.explanation || detail.interpretation}`);
  const knownEvidence = Object.entries(subScoreDetails)
    .filter(([, detail]) => detail.knownSignals.length > 0)
    .map(([, detail]) => detail.knownSignals.join(", "));
  const overallEvidenceLevel =
    missingEvidence.length >= 3
      ? "missing"
      : missingEvidence.length >= 2 ||
          (missingEvidence.length >= 1 && weakEvidence.length >= 4) ||
          (weakEvidence.length >= 6 && knownEvidence.length < 5)
        ? "weak"
        : weakEvidence.length >= 1 || missingEvidence.length >= 1
          ? "moderate"
          : "strong";
  const assessmentMode: AssessmentMode = overallEvidenceLevel === "strong" || overallEvidenceLevel === "moderate"
    ? "measured"
    : "provisional";
  const evidenceSummary = summarizeOverallEvidence(categoryAssessments);
  const evidenceQuality = {
    overallEvidenceLevel,
    confidenceLabel:
      overallEvidenceLevel === "strong"
        ? "high"
        : overallEvidenceLevel === "moderate"
          ? "medium"
          : "low",
    assessmentMode,
    categoryAssessments,
    strongestEvidenceCategories: evidenceSummary.strongestEvidenceCategories,
    weakestEvidenceCategories: evidenceSummary.weakestEvidenceCategories,
    blockedByMissingEvidence: evidenceSummary.blockedByMissingEvidence,
    recommendedEvidenceActions: evidenceSummary.recommendedEvidenceActions,
    knownEvidence: Array.from(new Set(knownEvidence)).slice(0, 8),
    weakEvidence: weakEvidence.slice(0, 8),
    missingEvidence: missingEvidence.slice(0, 8),
    provisionalReasons: [
      ...(input.dataQualityNotes || []),
      ...(assessmentMode === "provisional"
        ? ["The score is provisional because multiple subscore areas still depend on limited or missing evidence."]
        : []),
    ].slice(0, 10),
  } as const;

  const topStrengths: string[] = [];
  if (subScores.roleAlignment >= 75) topStrengths.push("Good alignment between current evidence and target role family");
  if (subScores.academicReadiness >= 70) topStrengths.push("Transcript and degree-requirement progress are supporting the target path");
  if (subScores.experienceStrength >= 60) topStrengths.push("Experience profile is stronger than a typical early candidate");
  if (subScores.networkStrength >= 55) topStrengths.push("Professional network is becoming a meaningful asset");
  if (subScores.proofOfWorkStrength >= 50) topStrengths.push("Proof-of-work signal is visible and helpful");
  if (evidenceQuality.overallEvidenceLevel === "strong" || evidenceQuality.overallEvidenceLevel === "moderate") {
    topStrengths.push("The current score is grounded in a meaningful amount of stored evidence");
  }
  if (evidenceQuality.strongestEvidenceCategories.length) {
    topStrengths.push(
      `Strongest evidence areas: ${evidenceQuality.strongestEvidenceCategories
        .slice(0, 3)
        .map((item) => item.replace(/_/g, " "))
        .join(", ")}`
    );
  }

  const topRisks: string[] = [
      ...(assessmentMode === "provisional"
        ? ["The current score is provisional because several evidence areas are still weak or missing"]
        : []),
    ...heuristicFlags
      .filter((f) => f.severity !== "info")
      .map((f) => f.title),
    ...skillGaps
      .filter((g) => g.gapSeverity !== "low")
      .slice(0, 3)
      .map((g) => `Gap in ${g.skillName}`),
  ].slice(0, 5);

  if (subScores.academicReadiness <= 45) {
    const academicRisk = "Transcript and degree progress are not yet strongly supporting the stated target";
    if (assessmentMode === "provisional") {
      topRisks.splice(1, 0, academicRisk);
    } else {
      topRisks.unshift(academicRisk);
    }
  }

  if (input.requirementProgress?.missingRequiredCourses.length) {
    topRisks.push(
      `Missing or unmapped core requirements include ${input.requirementProgress.missingRequiredCourses.slice(0, 3).join(", ")}`
    );
  }
  if (evidenceQuality.blockedByMissingEvidence.length) {
    topRisks.push(
      `Missing evidence is limiting confidence in ${evidenceQuality.blockedByMissingEvidence
        .slice(0, 2)
        .map((item) => item.replace(/_/g, " "))
        .join(" and ")}`
    );
  }

  return {
    studentId: input.studentId,
    targetRoleFamily: input.targetRoleFamily,
    targetSectorCluster: input.targetSectorCluster,
    trajectoryStatus,
    overallScore,
    subScores,
    subScoreDetails,
    evidenceQuality,
    topStrengths,
    topRisks: topRisks.slice(0, 5),
    heuristicFlags,
    skillGaps,
    recommendations,
  };
}
