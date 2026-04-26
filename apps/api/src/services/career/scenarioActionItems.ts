import crypto from "node:crypto";
import type {
  CareerScenarioActionItemRecord,
  CareerScenarioAnalysisResult,
  CareerScenarioRecord,
} from "../../../../../packages/shared/src/contracts/careerScenario";
import type { ScoringOutput } from "../../../../../packages/shared/src/scoring/types";

type ScenarioActionItemDraft = Omit<
  CareerScenarioActionItemRecord,
  "careerScenarioActionItemId" | "careerScenarioId" | "studentProfileId" | "createdAt" | "updatedAt"
>;

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function uniqueByTitle(items: ScenarioActionItemDraft[]): ScenarioActionItemDraft[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.sourceKind}:${normalize(item.title)}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function inferScenarioCategory(value: string): string {
  const normalized = normalize(value);
  if (normalized.includes("degree requirements") || normalized.includes("curriculum")) return "curriculum";
  if (normalized.includes("internship") || normalized.includes("project") || normalized.includes("outcome")) return "experience";
  if (normalized.includes("evidence")) return "evidence";
  if (normalized.includes("skill") || normalized.includes("proof of") || normalized.includes("build visible evidence")) return "skills";
  return "scenario_alignment";
}

function inferPriority(value: number): "high" | "medium" | "low" {
  if (value <= 1) return "high";
  if (value <= 3) return "medium";
  return "low";
}

function inferRecommendationPriority(scoring: ScoringOutput["recommendations"][number]): "high" | "medium" | "low" {
  if (scoring.estimatedSignalStrength === "high") return "high";
  if (scoring.effortLevel === "low") return "medium";
  return "low";
}

function inferTimeframe(priority: "high" | "medium" | "low"): string {
  if (priority === "high") return "This month";
  if (priority === "medium") return "This term";
  return "Ongoing";
}

export function buildCareerScenarioActionItemDrafts(input: {
  scenario: CareerScenarioRecord;
  analysisResult: CareerScenarioAnalysisResult;
  scoring: ScoringOutput;
}): ScenarioActionItemDraft[] {
  const scenarioItems: ScenarioActionItemDraft[] = input.analysisResult.scenarioSpecificActions.map((title, index) => {
    const priority = inferPriority(index);
    return {
      title,
      description: input.analysisResult.summary,
      rationale:
        input.analysisResult.likelyGaps[index] ||
        input.analysisResult.missingEvidence[index] ||
        input.analysisResult.warnings[0] ||
        `This action came from the saved ${input.scenario.scenarioName} scenario analysis.`,
      actionCategory: inferScenarioCategory(title),
      priority,
      timeframe: inferTimeframe(priority),
      sourceKind: "scenario_specific",
      status: "active",
      sortOrder: index,
    };
  });

  const recommendationItems: ScenarioActionItemDraft[] = input.scoring.recommendations.map((recommendation, index) => {
    const priority = inferRecommendationPriority(recommendation);
    return {
      title: recommendation.title,
      description: recommendation.description,
      rationale: recommendation.whyThisMatchesStudent || input.analysisResult.summary,
      actionCategory: recommendation.recommendationType,
      priority,
      timeframe: inferTimeframe(priority),
      sourceKind: "recommendation",
      status: "active",
      sortOrder: scenarioItems.length + index,
    };
  });

  const evidenceGapItems: ScenarioActionItemDraft[] = (input.scoring.evidenceQuality?.recommendedEvidenceActions || []).map(
    (title, index) => ({
      title,
      description: "Improve the confidence and completeness of the evidence used for this career scenario.",
      rationale:
        input.analysisResult.missingEvidence[index] ||
        input.analysisResult.warnings[0] ||
        "Evidence quality is still limiting confidence in this scenario read.",
      actionCategory: "evidence",
      priority: "medium",
      timeframe: "This term",
      sourceKind: "evidence_gap",
      status: "active",
      sortOrder: scenarioItems.length + recommendationItems.length + index,
    })
  );

  return uniqueByTitle([...scenarioItems, ...recommendationItems, ...evidenceGapItems]).slice(0, 8);
}

export function materializeCareerScenarioActionItems(input: {
  scenario: CareerScenarioRecord;
  drafts: ScenarioActionItemDraft[];
}): CareerScenarioActionItemRecord[] {
  const now = new Date().toISOString();
  return input.drafts.map((draft) => ({
    careerScenarioActionItemId: crypto.randomUUID(),
    careerScenarioId: input.scenario.careerScenarioId,
    studentProfileId: input.scenario.studentProfileId,
    title: draft.title,
    description: draft.description ?? null,
    rationale: draft.rationale ?? null,
    actionCategory: draft.actionCategory ?? null,
    priority: draft.priority,
    timeframe: draft.timeframe ?? null,
    sourceKind: draft.sourceKind,
    status: draft.status,
    sortOrder: draft.sortOrder,
    createdAt: now,
    updatedAt: now,
  }));
}
