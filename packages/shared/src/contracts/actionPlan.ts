export type StudentActionPlanDecision = "ignore" | "explore" | "accept";

export type StudentActionPlanSourceKind =
  | "recommendation"
  | "risk"
  | "requirement_gap"
  | "saved_plan";

export type StudentActionPlanDueStatus = "overdue" | "due_soon" | "scheduled" | null;

export interface StudentActionPlanOption {
  actionKey: string;
  title: string;
  description: string | null;
  rationale: string | null;
  sourceKind: StudentActionPlanSourceKind;
  actionCategory: string | null;
  priorityLevel: number | null;
  decision: StudentActionPlanDecision | null;
  planningNotes: string | null;
  nextStepDate: string | null;
  dueStatus: StudentActionPlanDueStatus;
  isCurrentRecommendation: boolean;
}

export interface StudentActionPlanSummary {
  acceptedCount: number;
  exploredCount: number;
  ignoredCount: number;
  overdueCount: number;
  dueSoonCount: number;
  selectedTitles: string[];
  primaryTitle: string | null;
}

export interface StudentActionPlanResponse {
  ok: true;
  plan: {
    options: StudentActionPlanOption[];
    summary: StudentActionPlanSummary;
  };
}
