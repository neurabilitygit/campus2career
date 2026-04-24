import test from "node:test";
import assert from "node:assert/strict";
import {
  buildParentBriefCoachSummaryFromFeed,
  isActionItemVisibleToViewer,
  isFlagVisibleToViewer,
  isNoteVisibleToViewer,
  isRecommendationVisibleToViewer,
} from "./visibility";

test("coach_private note does not appear in parent-facing summary input", () => {
  const summary = buildParentBriefCoachSummaryFromFeed({
    recommendations: [],
    actionItems: [],
    flags: [],
    notes: [
      {
        coachNoteId: "note-1",
        coachUserId: "coach-1",
        studentProfileId: "student-1",
        householdId: "household-1",
        noteType: "session_note",
        title: "Private note",
        body: "Keep this private",
        tags: [],
        visibility: "coach_private",
        sessionDate: null,
        linkedEvidenceIds: [],
        linkedActionItemIds: [],
        createdAt: "",
        updatedAt: "",
        archivedAt: null,
      },
      {
        coachNoteId: "note-2",
        coachUserId: "coach-1",
        studentProfileId: "student-1",
        householdId: "household-1",
        noteType: "follow_up_note",
        title: "Parent-safe note",
        body: "Visible to parent",
        tags: [],
        visibility: "parent_visible",
        sessionDate: null,
        linkedEvidenceIds: [],
        linkedActionItemIds: [],
        createdAt: "",
        updatedAt: "",
        archivedAt: null,
      },
    ],
  });

  assert.deepEqual(summary.noteTitles, ["Parent-safe note"]);
});

test("student_visible recommendation is shown to the student but not the parent", () => {
  const recommendation = {
    visibility: "student_visible",
    status: "active",
  } as const;

  assert.equal(isRecommendationVisibleToViewer(recommendation as any, "student"), true);
  assert.equal(isRecommendationVisibleToViewer(recommendation as any, "parent"), false);
});

test("parent_visible recommendation is shown to the parent but not the student", () => {
  const recommendation = {
    visibility: "parent_visible",
    status: "active",
  } as const;

  assert.equal(isRecommendationVisibleToViewer(recommendation as any, "parent"), true);
  assert.equal(isRecommendationVisibleToViewer(recommendation as any, "student"), false);
});

test("coach-sourced action item visibility respects viewer-specific flags", () => {
  assert.equal(
    isActionItemVisibleToViewer(
      { visibleToStudent: true, visibleToParent: false, status: "not_started" } as any,
      "student"
    ),
    true
  );
  assert.equal(
    isActionItemVisibleToViewer(
      { visibleToStudent: true, visibleToParent: false, status: "not_started" } as any,
      "parent"
    ),
    false
  );
});

test("flags respect visibility and archived status", () => {
  assert.equal(
    isFlagVisibleToViewer(
      { visibility: "student_and_parent_visible", status: "open" } as any,
      "parent"
    ),
    true
  );
  assert.equal(
    isFlagVisibleToViewer(
      { visibility: "student_and_parent_visible", status: "archived" } as any,
      "parent"
    ),
    false
  );
});

test("note visibility helper does not expose coach-private notes to the student", () => {
  assert.equal(isNoteVisibleToViewer({ visibility: "coach_private" } as any, "student"), false);
  assert.equal(isNoteVisibleToViewer({ visibility: "student_visible" } as any, "student"), true);
});
