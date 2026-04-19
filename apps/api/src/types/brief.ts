export type TrajectoryStatus = "on_track" | "watch" | "at_risk";

export interface ParentBrief {
  monthLabel: string;
  trajectoryStatus: TrajectoryStatus;
  strengths: string[];
  gaps: string[];
  recommendedParentActions: string[];
}
