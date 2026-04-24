import test from "node:test";
import assert from "node:assert/strict";
import {
  inferOutcomeActionDateLabel,
  inferOutcomeSourceType,
  inferOutcomeVerificationStatus,
  isValidOutcomeStatusForType,
  sortOutcomeTimeline,
} from "./validation";

test("isValidOutcomeStatusForType enforces outcome-specific status combinations", () => {
  assert.equal(isValidOutcomeStatusForType("internship_application", "applied"), true);
  assert.equal(isValidOutcomeStatusForType("internship_application", "offer"), false);
  assert.equal(isValidOutcomeStatusForType("accepted_role", "accepted"), true);
  assert.equal(isValidOutcomeStatusForType("accepted_role", "interviewing"), false);
});

test("reporter inference maps to source and verification states", () => {
  assert.equal(inferOutcomeSourceType("student"), "student_report");
  assert.equal(inferOutcomeVerificationStatus("student"), "self_reported");
  assert.equal(inferOutcomeSourceType("parent"), "parent_report");
  assert.equal(inferOutcomeVerificationStatus("parent"), "parent_reported");
  assert.equal(inferOutcomeSourceType("coach"), "coach_report");
  assert.equal(inferOutcomeVerificationStatus("coach"), "coach_reviewed");
  assert.equal(inferOutcomeActionDateLabel("offer"), "offer_date");
});

test("sortOutcomeTimeline orders newest action first and breaks ties by created date", () => {
  const sorted = sortOutcomeTimeline([
    {
      studentOutcomeId: "1",
      studentProfileId: "student-1",
      householdId: null,
      jobTargetId: null,
      targetRoleFamily: null,
      targetSectorCluster: null,
      outcomeType: "interview",
      status: "interviewing",
      employerName: "A",
      roleTitle: "Analyst",
      sourceType: "student_report",
      reportedByUserId: "user-1",
      reportedByRole: "student",
      verificationStatus: "self_reported",
      actionDate: "2026-04-20",
      actionDateLabel: "interview_date",
      notes: null,
      archivedAt: null,
      createdAt: "2026-04-20T09:00:00.000Z",
      updatedAt: "2026-04-20T09:00:00.000Z",
    },
    {
      studentOutcomeId: "2",
      studentProfileId: "student-1",
      householdId: null,
      jobTargetId: null,
      targetRoleFamily: null,
      targetSectorCluster: null,
      outcomeType: "offer",
      status: "offer",
      employerName: "B",
      roleTitle: "Analyst",
      sourceType: "student_report",
      reportedByUserId: "user-1",
      reportedByRole: "student",
      verificationStatus: "self_reported",
      actionDate: "2026-04-21",
      actionDateLabel: "offer_date",
      notes: null,
      archivedAt: null,
      createdAt: "2026-04-21T09:00:00.000Z",
      updatedAt: "2026-04-21T09:00:00.000Z",
    },
    {
      studentOutcomeId: "3",
      studentProfileId: "student-1",
      householdId: null,
      jobTargetId: null,
      targetRoleFamily: null,
      targetSectorCluster: null,
      outcomeType: "offer",
      status: "offer",
      employerName: "C",
      roleTitle: "Associate",
      sourceType: "student_report",
      reportedByUserId: "user-1",
      reportedByRole: "student",
      verificationStatus: "self_reported",
      actionDate: "2026-04-21",
      actionDateLabel: "offer_date",
      notes: null,
      archivedAt: null,
      createdAt: "2026-04-21T12:00:00.000Z",
      updatedAt: "2026-04-21T12:00:00.000Z",
    },
  ]);

  assert.deepEqual(
    sorted.map((item) => item.studentOutcomeId),
    ["3", "2", "1"]
  );
});
