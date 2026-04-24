import type {
  OutcomeActionDateLabel,
  OutcomeReporterRole,
  OutcomeSourceType,
  OutcomeStatus,
  OutcomeType,
  OutcomeVerificationStatus,
  StudentOutcomeRecord,
} from "../../../../../packages/shared/src/contracts/outcomes";

const validStatusesByType: Record<OutcomeType, OutcomeStatus[]> = {
  internship_application: ["not_started", "in_progress", "applied"],
  interview: ["not_started", "in_progress", "interviewing"],
  offer: ["not_started", "in_progress", "offer"],
  accepted_role: ["not_started", "in_progress", "accepted"],
};

const actionDateLabelByType: Record<OutcomeType, OutcomeActionDateLabel> = {
  internship_application: "applied_date",
  interview: "interview_date",
  offer: "offer_date",
  accepted_role: "accepted_date",
};

const sourceTypeByRole: Record<OutcomeReporterRole, OutcomeSourceType> = {
  student: "student_report",
  parent: "parent_report",
  coach: "coach_report",
  admin: "admin_report",
};

const verificationStatusByRole: Record<OutcomeReporterRole, OutcomeVerificationStatus> = {
  student: "self_reported",
  parent: "parent_reported",
  coach: "coach_reviewed",
  admin: "verified",
};

export function isValidOutcomeStatusForType(
  outcomeType: OutcomeType,
  status: OutcomeStatus
): boolean {
  return validStatusesByType[outcomeType].includes(status);
}

export function getValidOutcomeStatusesForType(outcomeType: OutcomeType): OutcomeStatus[] {
  return validStatusesByType[outcomeType];
}

export function inferOutcomeActionDateLabel(outcomeType: OutcomeType): OutcomeActionDateLabel {
  return actionDateLabelByType[outcomeType];
}

export function inferOutcomeSourceType(reportedByRole: OutcomeReporterRole): OutcomeSourceType {
  return sourceTypeByRole[reportedByRole];
}

export function inferOutcomeVerificationStatus(
  reportedByRole: OutcomeReporterRole
): OutcomeVerificationStatus {
  return verificationStatusByRole[reportedByRole];
}

export function sortOutcomeTimeline(outcomes: StudentOutcomeRecord[]): StudentOutcomeRecord[] {
  return [...outcomes].sort((left, right) => {
    const actionDateDelta =
      new Date(right.actionDate).getTime() - new Date(left.actionDate).getTime();
    if (actionDateDelta !== 0) {
      return actionDateDelta;
    }
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}
