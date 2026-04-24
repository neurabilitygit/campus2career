import type { CoachActionItemRecord, CoachFlagRecord, CoachNoteRecord, CoachRecommendationRecord } from "../../../../../packages/shared/src/contracts/coach";

export function isNoteVisibleToViewer(
  note: Pick<CoachNoteRecord, "visibility">,
  viewer: "student" | "parent"
): boolean {
  if (viewer === "student") {
    return note.visibility === "student_visible" || note.visibility === "student_and_parent_visible";
  }
  return note.visibility === "parent_visible" || note.visibility === "student_and_parent_visible";
}

export function isRecommendationVisibleToViewer(
  recommendation: Pick<CoachRecommendationRecord, "visibility" | "status">,
  viewer: "student" | "parent"
): boolean {
  if (recommendation.status === "archived") {
    return false;
  }
  if (viewer === "student") {
    return recommendation.visibility === "student_visible" || recommendation.visibility === "student_and_parent_visible";
  }
  return recommendation.visibility === "parent_visible" || recommendation.visibility === "student_and_parent_visible";
}

export function isActionItemVisibleToViewer(
  actionItem: Pick<CoachActionItemRecord, "visibleToStudent" | "visibleToParent" | "status">,
  viewer: "student" | "parent"
): boolean {
  if (actionItem.status === "archived") {
    return false;
  }
  return viewer === "student" ? actionItem.visibleToStudent : actionItem.visibleToParent;
}

export function isFlagVisibleToViewer(
  flag: Pick<CoachFlagRecord, "visibility" | "status">,
  viewer: "student" | "parent"
): boolean {
  if (flag.status === "archived") {
    return false;
  }
  if (viewer === "student") {
    return flag.visibility === "student_visible" || flag.visibility === "student_and_parent_visible";
  }
  return flag.visibility === "parent_visible" || flag.visibility === "student_and_parent_visible";
}

export function buildParentBriefCoachSummaryFromFeed(input: {
  recommendations: CoachRecommendationRecord[];
  actionItems: CoachActionItemRecord[];
  flags: CoachFlagRecord[];
  notes?: CoachNoteRecord[];
}) {
  return {
    recommendationTitles: input.recommendations
      .filter((item) => isRecommendationVisibleToViewer(item, "parent"))
      .slice(0, 4)
      .map((item) => item.title),
    actionTitles: input.actionItems
      .filter((item) => isActionItemVisibleToViewer(item, "parent"))
      .slice(0, 4)
      .map((item) => item.title),
    flagTitles: input.flags
      .filter((item) => isFlagVisibleToViewer(item, "parent"))
      .slice(0, 4)
      .map((item) => item.title),
    noteTitles: (input.notes || [])
      .filter((item) => isNoteVisibleToViewer(item, "parent"))
      .slice(0, 4)
      .map((item) => item.title),
  };
}
