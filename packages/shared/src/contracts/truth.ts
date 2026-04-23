export type TruthStatus = "direct" | "inferred" | "placeholder" | "fallback" | "unresolved";

export type ConfidenceLabel = "low" | "medium" | "high";

export interface EvidenceTruthSummary {
  truthStatus: TruthStatus;
  confidenceLabel: ConfidenceLabel;
  sourceLabel: string;
  note?: string | null;
}
