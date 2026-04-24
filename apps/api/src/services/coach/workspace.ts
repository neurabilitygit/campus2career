import type {
  CoachActionItemRecord,
  CoachFlagRecord,
  CoachNoteRecord,
  CoachRecommendationRecord,
  CoachRosterItem,
  CoachStudentRelationshipRecord,
  CoachWorkspaceSummary,
} from "../../../../../packages/shared/src/contracts/coach";
import { CoachRepository } from "../../repositories/coach/coachRepository";
import { StudentReadRepository } from "../../repositories/student/studentReadRepository";
import { OutcomeRepository } from "../../repositories/outcomes/outcomeRepository";
import { aggregateStudentContext, buildStudentScoringInput } from "../student/aggregateStudentContext";
import { runScoring } from "../scoring";
import { buildPreviewRelationship } from "./access";
import { buildParentBriefCoachSummaryFromFeed } from "./visibility";
import type { RequestContext } from "../auth/resolveRequestContext";

const coachRepo = new CoachRepository();
const studentReadRepo = new StudentReadRepository();
const outcomeRepo = new OutcomeRepository();

export interface CoachWorkspaceRecord {
  relationship: CoachStudentRelationshipRecord;
  summary: CoachWorkspaceSummary;
  recentStudentActions: string[];
  parentConcernSummaries: Array<{
    category: string;
    urgency: string;
    parentConcerns: string | null;
    preferredOutcome: string | null;
    updatedAt: string;
  }>;
  notes: CoachNoteRecord[];
  findings: import("../../../../../packages/shared/src/contracts/coach").CoachFindingRecord[];
  recommendations: CoachRecommendationRecord[];
  actionItems: CoachActionItemRecord[];
  flags: CoachFlagRecord[];
  outboundMessages: import("../../../../../packages/shared/src/contracts/coach").CoachOutboundMessageRecord[];
}

function titleCase(value: string | null | undefined): string {
  if (!value) return "Unknown";
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function enrichRosterItem(item: CoachRosterItem): Promise<CoachRosterItem> {
  try {
    const input = await buildStudentScoringInput(item.studentProfileId);
    const scoring = runScoring(input);
    return {
      ...item,
      readinessStatus: scoring.trajectoryStatus,
      evidenceCompletenessStatus: scoring.evidenceQuality.overallEvidenceLevel,
    };
  } catch {
    return item;
  }
}

export async function listCoachRoster(ctx: RequestContext): Promise<CoachRosterItem[]> {
  const roster = await coachRepo.listRelationshipsForCoach(ctx.authenticatedUserId);
  if (roster.length) {
    return Promise.all(roster.map(enrichRosterItem));
  }

  const preview = buildPreviewRelationship(ctx);
  if (!preview) {
    return [];
  }

  return [
    await enrichRosterItem({
      ...preview,
      readinessStatus: null,
      evidenceCompletenessStatus: null,
      openActionItems: 0,
      activeFlags: 0,
      lastCoachNoteDate: null,
    }),
  ];
}

export async function resolveCoachRelationshipOrThrow(
  ctx: RequestContext,
  studentProfileId?: string | null
): Promise<CoachStudentRelationshipRecord | null> {
  const roster = await listCoachRoster(ctx);
  if (!roster.length) {
    return null;
  }

  if (studentProfileId) {
    return roster.find((item) => item.studentProfileId === studentProfileId) || null;
  }

  return roster[0];
}

export async function buildCoachWorkspace(
  ctx: RequestContext,
  relationship: CoachStudentRelationshipRecord
): Promise<CoachWorkspaceRecord> {
  const studentProfileId = relationship.studentProfileId;
  const [profile, scoringInput, outcomes, recentOutcomes, recentAccomplishments, outreach, deadlines, notes, findings, recommendations, actionItems, flags, outboundMessages, aggregateCtx] =
    await Promise.all([
      studentReadRepo.getStudentProfile(studentProfileId),
      buildStudentScoringInput(studentProfileId).catch(() => null),
      outcomeRepo.getSummaryForStudent(studentProfileId),
      outcomeRepo.listForStudent(studentProfileId),
      studentReadRepo.getRecentAccomplishments(studentProfileId),
      studentReadRepo.getOutreach(studentProfileId),
      studentReadRepo.getUpcomingDeadlines(studentProfileId),
      coachRepo.listNotesForCoachStudent(ctx.authenticatedUserId, studentProfileId),
      coachRepo.listFindingsForCoachStudent(ctx.authenticatedUserId, studentProfileId),
      coachRepo.listRecommendationsForCoachStudent(ctx.authenticatedUserId, studentProfileId),
      coachRepo.listActionItemsForCoachStudent(ctx.authenticatedUserId, studentProfileId),
      coachRepo.listFlagsForCoachStudent(ctx.authenticatedUserId, studentProfileId),
      coachRepo.listOutboundMessagesForCoachStudent(ctx.authenticatedUserId, studentProfileId),
      aggregateStudentContext(studentProfileId).catch(() => null),
    ]);

  const scoring = scoringInput ? runScoring(scoringInput) : null;
  const studentUserId = await coachRepo.getStudentUserId(studentProfileId);
  const parentContextAllowed =
    !!studentUserId &&
    relationship.permissions.viewParentFacingSummaries &&
    (await coachRepo.hasCoachScopeConsent(studentUserId, ctx.authenticatedUserId, "parent_summary"));
  const parentConcernSummaries = parentContextAllowed
    ? await coachRepo.listParentConcernSummaries(studentProfileId)
    : [];

  const recentStudentActions = [
    ...recentOutcomes.slice(0, 3).map((outcome) => `${titleCase(outcome.outcomeType)} at ${outcome.employerName || "unknown employer"} (${outcome.status})`),
    ...recentAccomplishments.slice(0, 2).map((item) => `${item.title}${item.organization ? ` at ${item.organization}` : ""}`),
    ...outreach.slice(0, 2).map((item) => `${titleCase(item.interaction_type)}${item.outcome ? `: ${item.outcome}` : ""}`),
    ...deadlines.slice(0, 2).map((item) => `Deadline: ${item.title} on ${item.due_date}`),
  ].slice(0, 8);

  return {
    relationship,
    summary: {
      studentProfileId,
      studentDisplayName:
        relationship.studentDisplayName ||
        aggregateCtx?.studentName ||
        "Student",
      householdId: relationship.householdId,
      relationshipStatus: relationship.relationshipStatus,
      nextReviewDate: relationship.nextReviewDate,
      readinessStatus: scoring?.trajectoryStatus || null,
      overallScore: typeof scoring?.overallScore === "number" ? scoring.overallScore : null,
      evidenceStrength: scoring?.evidenceQuality?.overallEvidenceLevel || null,
      missingEvidence: scoring?.evidenceQuality?.missingEvidence || [],
      outcomeSummary: {
        totalActive: outcomes.totalActive,
        latestActionDate: outcomes.latestActionDate,
        countsByType: outcomes.countsByType,
      },
      academicSummary: {
        schoolName: profile?.school_name || null,
        majorPrimary: profile?.major_primary || null,
        majorSecondary: profile?.major_secondary || null,
        expectedGraduationDate: profile?.expected_graduation_date || null,
      },
      parentContextAllowed,
    },
    recentStudentActions,
    parentConcernSummaries,
    notes,
    findings,
    recommendations,
    actionItems,
    flags,
    outboundMessages,
  };
}

export async function getVisibleCoachFeed(studentProfileId: string, viewer: "student" | "parent") {
  const [recommendations, actionItems, flags, notes] = await Promise.all([
    coachRepo.listVisibleRecommendationsForViewer(studentProfileId, viewer),
    coachRepo.listVisibleActionItemsForViewer(studentProfileId, viewer),
    coachRepo.listVisibleFlagsForViewer(studentProfileId, viewer),
    coachRepo.listVisibleNotesForViewer(studentProfileId, viewer),
  ]);

  return {
    recommendations,
    actionItems,
    flags,
    notes,
  };
}

export async function getParentBriefCoachSummary(studentProfileId: string) {
  const { recommendations, actionItems, flags, notes } = await getVisibleCoachFeed(studentProfileId, "parent");
  const summary = buildParentBriefCoachSummaryFromFeed({
    recommendations,
    actionItems,
    flags,
    notes,
  });
  return {
    recommendationTitles: summary.recommendationTitles,
    actionTitles: summary.actionTitles,
    flagTitles: summary.flagTitles,
  };
}
