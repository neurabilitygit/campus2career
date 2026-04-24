import type {
  CoachPermissionSet,
  CoachStudentRelationshipRecord,
} from "../../../../../packages/shared/src/contracts/coach";
import type { RequestContext } from "../auth/resolveRequestContext";

export function canAccessCoachWorkspace(role: string): boolean {
  return role === "coach" || role === "admin";
}

export function isCoachPreviewContext(ctx: RequestContext): boolean {
  return (
    ctx.authenticatedRoleType === "coach" &&
    !!ctx.testContextSwitchingEnabled &&
    ctx.testContextOverrideRole === "coach" &&
    !!ctx.studentProfileId
  );
}

export function buildPreviewRelationship(ctx: RequestContext): CoachStudentRelationshipRecord | null {
  if (!isCoachPreviewContext(ctx) || !ctx.studentProfileId) {
    return null;
  }

  const studentName = [ctx.studentFirstName, ctx.studentLastName].filter(Boolean).join(" ").trim();
  const coachName = [ctx.authenticatedFirstName, ctx.authenticatedLastName].filter(Boolean).join(" ").trim();

  return {
    coachStudentRelationshipId: `preview:${ctx.authenticatedUserId}:${ctx.studentProfileId}`,
    coachUserId: ctx.authenticatedUserId,
    coachDisplayName: coachName || null,
    studentProfileId: ctx.studentProfileId,
    studentDisplayName: studentName || "Preview student",
    householdId: ctx.householdId ?? null,
    relationshipStatus: "active",
    startDate: null,
    endDate: null,
    nextReviewDate: null,
    createdByUserId: ctx.authenticatedUserId,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    permissions: {
      viewStudentProfile: true,
      viewEvidence: true,
      createNotes: true,
      createRecommendations: true,
      createActionItems: true,
      sendCommunications: true,
      viewParentFacingSummaries: true,
    },
  };
}

export function requireRelationshipPermission(
  relationship: CoachStudentRelationshipRecord,
  permission: keyof CoachPermissionSet
): boolean {
  return !!relationship.permissions[permission];
}
