import type {
  ScoringOutput,
  StudentScoringInput,
  SubScores,
} from "../../../../../packages/shared/src/scoring/types";

type DriverDirection = "positive" | "negative" | "neutral";

export interface ScoreExplanationDriver {
  key: keyof SubScores;
  label: string;
  score: number;
  direction: DriverDirection;
  detail: string;
}

export interface ScoreCounterfactualChange {
  key: keyof SubScores;
  label: string;
  delta: number;
  detail: string;
}

export interface ScoreExplanationResult {
  summaryHeadline: string;
  summaryText: string;
  strongestDrivers: ScoreExplanationDriver[];
  biggestGaps: ScoreExplanationDriver[];
  dataQualityAlerts: string[];
  evidenceSummary: {
    known: string[];
    weak: string[];
    missing: string[];
    assessmentMode: "measured" | "provisional";
    strongestCategories?: string[];
    weakestCategories?: string[];
    recommendedEvidenceActions?: string[];
  };
  immediateActions: string[];
  counterfactual?: {
    compareToRoleFamily: string;
    deltaOverallScore: number;
    summaryText: string;
    biggestChanges: ScoreCounterfactualChange[];
  } | null;
}

const SUBSCORE_LABELS: Record<keyof SubScores, string> = {
  roleAlignment: "Role alignment",
  marketDemand: "Market demand",
  academicReadiness: "Academic readiness",
  experienceStrength: "Experience strength",
  proofOfWorkStrength: "Proof of work",
  networkStrength: "Network strength",
  executionMomentum: "Execution momentum",
};

function titleCase(value: string): string {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function driverDirection(score: number): DriverDirection {
  if (score >= 70) return "positive";
  if (score <= 45) return "negative";
  return "neutral";
}

function bestSignalSummary(input: StudentScoringInput): string {
  const signals = (input.marketSignals || []).slice().sort((left, right) => (right.signalValue || 0) - (left.signalValue || 0));
  const best = signals.find((signal) =>
    ["demand_growth", "openings_trend", "internship_availability", "wage"].includes(signal.signalType)
  );
  if (!best) {
    return "No role-specific market signals are loaded yet, so this score is using a conservative market baseline.";
  }

  const value = best.signalValue == null ? "unknown" : String(best.signalValue);
  return `${titleCase(best.signalType)} from ${best.sourceName} is ${best.signalDirection || "stable"} at ${value}.`;
}

function describeDriver(key: keyof SubScores, score: number, input: StudentScoringInput, scoring: ScoringOutput): string {
  switch (key) {
    case "roleAlignment":
      if (scoring.skillGaps.length) {
        const topGaps = scoring.skillGaps.slice(0, 2).map((gap) => gap.skillName).join(" and ");
        return `The current evidence profile is still missing required signal in ${topGaps}, which lowers the fit to this role.`;
      }
      return "The skills currently evidenced by coursework, projects, and experience line up well with the target role.";
    case "marketDemand":
      return bestSignalSummary(input);
    case "academicReadiness":
      if (input.requirementProgress?.boundToCatalog) {
        return `Your degree path is bound to ${input.requirementProgress.majorDisplayName || "the selected major"} and shows ${input.requirementProgress.completionPercent}% requirement completion.`;
      }
      if (input.transcript?.completedCourseCount) {
        return `A transcript is loaded with ${input.transcript.completedCourseCount} completed courses, but the degree path is not fully bound to requirements yet.`;
      }
      return "No transcript-backed degree progress is available yet, so academics are scored conservatively.";
    case "experienceStrength":
      if (input.experiences.length) {
        return `${input.experiences.length} experience entr${input.experiences.length === 1 ? "y is" : "ies are"} contributing to role readiness.`;
      }
      return "No experience evidence is stored yet for this student.";
    case "proofOfWorkStrength":
      if (input.artifacts.length) {
        return `${input.artifacts.length} uploaded artifact${input.artifacts.length === 1 ? "" : "s"} are contributing portfolio signal.`;
      }
      return "No portfolio, project, resume, or other proof-of-work artifacts are loaded yet.";
    case "networkStrength":
      if (input.contacts.length || input.outreach.length) {
        return `${input.contacts.length} contacts and ${input.outreach.length} outreach interactions are currently influencing the network score.`;
      }
      return "No contact or outreach history is loaded yet, so networking signal is near zero.";
    case "executionMomentum":
      return input.signals.repeatedDeadlineMisses
        ? `${input.signals.repeatedDeadlineMisses} missed or overdue deadlines are reducing the momentum score.`
        : "The platform is not seeing a missed-deadline pattern, so execution momentum remains healthy.";
    default:
      return "This score component is contributing to the overall trajectory assessment.";
  }
}

function buildDrivers(input: StudentScoringInput, scoring: ScoringOutput): ScoreExplanationDriver[] {
  return (Object.keys(scoring.subScores) as Array<keyof SubScores>).map((key) => {
    const score = scoring.subScores[key];
    return {
      key,
      label: SUBSCORE_LABELS[key],
      score,
      direction: driverDirection(score),
      detail: describeDriver(key, score, input, scoring),
    };
  });
}

function buildDataQualityAlerts(input: StudentScoringInput): string[] {
  const alerts: string[] = [...(input.dataQualityNotes || [])];

  if (input.targetResolution?.truthStatus && input.targetResolution.truthStatus !== "direct") {
    alerts.push(
      input.targetResolution.note ||
        `Target role resolution is currently ${input.targetResolution.truthStatus} via ${input.targetResolution.sourceLabel}.`
    );
  }

  if (!input.transcript?.courseCount) {
    alerts.push("No parsed transcript is loaded yet, so coursework progress is still estimated conservatively.");
  } else if (input.transcript.truthStatus !== "direct") {
    alerts.push(
      `Transcript-derived coursework is currently ${input.transcript.truthStatus} evidence${
        input.transcript.extractionMethod ? ` from ${input.transcript.extractionMethod}` : ""
      }.`
    );
  }
  if (!input.requirementProgress?.boundToCatalog) {
    alerts.push("The student is not fully bound to a structured degree requirement set yet.");
  } else {
    alerts.push(...(input.requirementProgress.coverageNotes || []));
  }
  if (!input.experiences.length) {
    alerts.push("No experience records are stored yet.");
  }
  if (!input.artifacts.length) {
    alerts.push("No portfolio or artifact evidence is stored yet.");
  }
  if (!input.contacts.length && !input.outreach.length) {
    alerts.push("No networking history is stored yet.");
  }

  return Array.from(new Set(alerts));
}

function buildEvidenceSummary(input: StudentScoringInput, scoring: ScoringOutput) {
  return {
    known: scoring.evidenceQuality.knownEvidence,
    weak: scoring.evidenceQuality.weakEvidence,
    missing: scoring.evidenceQuality.missingEvidence,
    assessmentMode: scoring.evidenceQuality.assessmentMode,
    strongestCategories: (scoring.evidenceQuality.strongestEvidenceCategories || []).map((item) =>
      titleCase(item)
    ),
    weakestCategories: (scoring.evidenceQuality.weakestEvidenceCategories || []).map((item) =>
      titleCase(item)
    ),
    recommendedEvidenceActions: scoring.evidenceQuality.recommendedEvidenceActions || [],
  };
}

function buildImmediateActions(scoring: ScoringOutput, input: StudentScoringInput): string[] {
  const actions = new Set<string>();

  for (const item of scoring.recommendations.slice(0, 4)) {
    actions.add(item.title);
  }

  for (const risk of scoring.topRisks.slice(0, 2)) {
    actions.add(risk);
  }

  for (const course of input.requirementProgress?.missingRequiredCourses.slice(0, 2) || []) {
    actions.add(`Review requirement coverage for ${course}`);
  }

  return Array.from(actions).slice(0, 5);
}

function explainCounterfactualChange(
  key: keyof SubScores,
  delta: number,
  selectedInput: StudentScoringInput,
  comparisonInput: StudentScoringInput
): string {
  switch (key) {
    case "marketDemand":
      return delta > 0
        ? `The comparison role carries stronger imported market signals than ${titleCase(selectedInput.targetRoleFamily)}.`
        : `The current role carries stronger imported market signals than ${titleCase(comparisonInput.targetRoleFamily)}.`;
    case "roleAlignment":
      return delta > 0
        ? `The student’s current evidence looks like a tighter fit for ${titleCase(comparisonInput.targetRoleFamily)}.`
        : `The student’s current evidence looks like a tighter fit for ${titleCase(selectedInput.targetRoleFamily)}.`;
    case "experienceStrength":
      return delta > 0
        ? `Existing experiences map a bit better to ${titleCase(comparisonInput.targetRoleFamily)}.`
        : `Existing experiences map a bit better to ${titleCase(selectedInput.targetRoleFamily)}.`;
    case "proofOfWorkStrength":
      return delta > 0
        ? `Current artifacts look more relevant for ${titleCase(comparisonInput.targetRoleFamily)}.`
        : `Current artifacts look more relevant for ${titleCase(selectedInput.targetRoleFamily)}.`;
    default:
      return `This subscore changes when the target role changes from ${titleCase(selectedInput.targetRoleFamily)} to ${titleCase(comparisonInput.targetRoleFamily)}.`;
  }
}

export function explainScore(input: {
  selectedInput: StudentScoringInput;
  selectedScoring: ScoringOutput;
  comparisonInput?: StudentScoringInput;
  comparisonScoring?: ScoringOutput;
}): ScoreExplanationResult {
  const drivers = buildDrivers(input.selectedInput, input.selectedScoring);
  const strongestDrivers = drivers
    .filter((driver) => driver.direction !== "negative")
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);
  const biggestGaps = drivers
    .filter((driver) => driver.direction !== "positive")
    .sort((left, right) => left.score - right.score)
    .slice(0, 3);

  const topGap = biggestGaps[0];
  const topStrength = strongestDrivers[0];
  const summaryHeadline = `${titleCase(input.selectedScoring.targetRoleFamily)} is currently ${titleCase(input.selectedScoring.trajectoryStatus)} at ${input.selectedScoring.overallScore}/100`;
  const summaryText = [
    input.selectedScoring.evidenceQuality.assessmentMode === "provisional"
      ? "This is a provisional readiness read because several evidence areas are still missing or weak."
      : null,
    topStrength ? `${topStrength.label} is helping most right now.` : null,
    topGap ? `${topGap.label} is the biggest drag on the score.` : null,
    input.selectedScoring.recommendations[0]?.title
      ? `The clearest next move is: ${input.selectedScoring.recommendations[0].title}.`
      : null,
  ].filter(Boolean).join(" ");

  let counterfactual: ScoreExplanationResult["counterfactual"] = null;

  if (input.comparisonInput && input.comparisonScoring) {
    const changes = (Object.keys(input.selectedScoring.subScores) as Array<keyof SubScores>)
      .map((key) => ({
        key,
        label: SUBSCORE_LABELS[key],
        delta: input.comparisonScoring!.subScores[key] - input.selectedScoring.subScores[key],
        detail: explainCounterfactualChange(key, input.comparisonScoring!.subScores[key] - input.selectedScoring.subScores[key], input.selectedInput, input.comparisonInput!),
      }))
      .filter((item) => item.delta !== 0)
      .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
      .slice(0, 4);

    const deltaOverallScore = input.comparisonScoring.overallScore - input.selectedScoring.overallScore;
    const compareLabel = titleCase(input.comparisonScoring.targetRoleFamily);
    const deltaText =
      deltaOverallScore === 0
        ? `${compareLabel} lands at the same overall score as the current target.`
        : deltaOverallScore > 0
          ? `${compareLabel} scores ${deltaOverallScore} point${deltaOverallScore === 1 ? "" : "s"} higher than the current target.`
          : `${compareLabel} scores ${Math.abs(deltaOverallScore)} point${Math.abs(deltaOverallScore) === 1 ? "" : "s"} lower than the current target.`;

    counterfactual = {
      compareToRoleFamily: input.comparisonScoring.targetRoleFamily,
      deltaOverallScore,
      summaryText: deltaText,
      biggestChanges: changes,
    };
  }

  return {
    summaryHeadline,
    summaryText,
    strongestDrivers,
    biggestGaps,
    dataQualityAlerts: buildDataQualityAlerts(input.selectedInput),
    evidenceSummary: buildEvidenceSummary(input.selectedInput, input.selectedScoring),
    immediateActions: buildImmediateActions(input.selectedScoring, input.selectedInput),
    counterfactual,
  };
}
