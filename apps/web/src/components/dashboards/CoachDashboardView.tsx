"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "../layout/AppShell";
import { SectionCard } from "../layout/SectionCard";
import { KeyValueList } from "../layout/KeyValueList";
import { RequireRole } from "../RequireRole";
import { FieldInfoLabel } from "../forms/FieldInfoLabel";
import { useApiData } from "../../hooks/useApiData";
import { apiFetch } from "../../lib/apiClient";

type MappingDiagnosticsResponse = {
  ok?: boolean;
  mappingCount?: number;
  mappings?: Array<{
    canonicalName: string;
    onetCode: string | null;
    description: string | null;
    jobZone: number | null;
    skillCount: number;
    topSkills: string[];
  }>;
};

type CoachRosterResponse = {
  ok: boolean;
  count: number;
  roster: Array<{
    studentProfileId: string;
    studentDisplayName: string;
    relationshipStatus: string;
    readinessStatus?: string | null;
    evidenceCompletenessStatus?: string | null;
    openActionItems: number;
    activeFlags: number;
    lastCoachNoteDate?: string | null;
    nextReviewDate?: string | null;
  }>;
};

type CoachWorkspaceResponse = {
  ok: boolean;
  selectedStudentProfileId: string | null;
  workspace: null | {
    relationship: {
      studentProfileId: string;
      studentDisplayName: string;
      relationshipStatus: string;
      householdId?: string | null;
      permissions: {
        createNotes: boolean;
        createRecommendations: boolean;
        createActionItems: boolean;
        sendCommunications: boolean;
        viewParentFacingSummaries: boolean;
      };
    };
    summary: {
      studentDisplayName: string;
      relationshipStatus: string;
      nextReviewDate?: string | null;
      readinessStatus?: string | null;
      overallScore?: number | null;
      evidenceStrength?: string | null;
      missingEvidence?: string[];
      outcomeSummary: {
        totalActive: number;
        latestActionDate?: string | null;
        countsByType: Record<string, number>;
      };
      academicSummary: {
        schoolName?: string | null;
        majorPrimary?: string | null;
        majorSecondary?: string | null;
        expectedGraduationDate?: string | null;
      };
      parentContextAllowed: boolean;
    };
    recentStudentActions: string[];
    parentConcernSummaries: Array<{
      category: string;
      urgency: string;
      parentConcerns?: string | null;
      preferredOutcome?: string | null;
      updatedAt: string;
    }>;
    notes: Array<{
      coachNoteId: string;
      title: string;
      body: string;
      noteType: string;
      visibility: string;
      createdAt?: string;
    }>;
    findings: Array<{
      coachFindingId: string;
      title: string;
      explanation: string;
      findingCategory: string;
      severity: string;
      visibility: string;
    }>;
    recommendations: Array<{
      coachRecommendationId: string;
      title: string;
      recommendedNextStep: string;
      priority: string;
      visibility: string;
      status: string;
      dueDate?: string | null;
      coachDisplayName?: string | null;
    }>;
    actionItems: Array<{
      coachActionItemId: string;
      title: string;
      description?: string | null;
      priority: string;
      dueDate?: string | null;
      status: string;
      assignedTo: string;
      visibleToStudent: boolean;
      visibleToParent: boolean;
      coachDisplayName?: string | null;
    }>;
    flags: Array<{
      coachFlagId: string;
      title: string;
      description: string;
      flagType: string;
      severity: string;
      status: string;
      visibility: string;
    }>;
    outboundMessages: Array<{
      coachOutboundMessageId: string;
      recipientType: string;
      channel: string;
      subject?: string | null;
      body: string;
      status: string;
      providerMode: string;
      sentAt?: string | null;
    }>;
  };
};

function titleCase(value: string | undefined | null): string {
  if (!value) return "Unknown";
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString();
}

function buildWorkspaceUrl(studentProfileId?: string | null) {
  if (!studentProfileId) return "/coaches/me/workspace";
  return `/coaches/me/workspace?studentProfileId=${encodeURIComponent(studentProfileId)}`;
}

export default function CoachDashboardView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [nonce, setNonce] = useState(0);
  const [rosterSearch, setRosterSearch] = useState("");
  const [actionState, setActionState] = useState<{ saving: boolean; sending: boolean; error: string | null; success: string | null }>({
    saving: false,
    sending: false,
    error: null,
    success: null,
  });
  const [noteForm, setNoteForm] = useState({
    noteType: "session_note",
    visibility: "coach_private",
    title: "",
    body: "",
  });
  const [findingForm, setFindingForm] = useState({
    findingCategory: "execution_risk",
    severity: "medium",
    visibility: "coach_private",
    title: "",
    explanation: "",
  });
  const [recommendationForm, setRecommendationForm] = useState({
    recommendationCategory: "communication",
    priority: "high",
    visibility: "student_visible",
    status: "active",
    title: "",
    rationale: "",
    recommendedNextStep: "",
    dueDate: "",
  });
  const [actionItemForm, setActionItemForm] = useState({
    priority: "high",
    assignedTo: "student",
    title: "",
    description: "",
    dueDate: "",
    visibleToStudent: true,
    visibleToParent: false,
  });
  const [flagForm, setFlagForm] = useState({
    flagType: "coach_attention_needed",
    severity: "warning",
    visibility: "coach_private",
    title: "",
    description: "",
  });
  const [messageForm, setMessageForm] = useState({
    recipientType: "student",
    channel: "email",
    status: "draft",
    subject: "",
    body: "",
  });

  const roster = useApiData<CoachRosterResponse>("/coaches/me/roster", true, nonce);
  const selectedStudentProfileId =
    searchParams.get("studentProfileId") || roster.data?.roster?.[0]?.studentProfileId || null;
  const workspace = useApiData<CoachWorkspaceResponse>(
    buildWorkspaceUrl(selectedStudentProfileId),
    !!selectedStudentProfileId || !!roster.data?.roster?.length,
    nonce
  );
  const mappings = useApiData<MappingDiagnosticsResponse>("/v1/market/diagnostics/role-mappings");
  const fixtures = useApiData("/v1/market/fixtures/validate");

  const filteredRoster = useMemo(() => {
    const query = rosterSearch.trim().toLowerCase();
    if (!query) return roster.data?.roster || [];
    return (roster.data?.roster || []).filter((item) => item.studentDisplayName.toLowerCase().includes(query));
  }, [roster.data?.roster, rosterSearch]);

  const workspaceData = workspace.data?.workspace;
  const selectedName = workspaceData?.summary.studentDisplayName || "No student selected";
  const mainRisk = workspaceData?.summary.missingEvidence?.[0] || workspaceData?.flags?.[0]?.title || "No major coach flag is open right now.";
  const nextAction =
    workspaceData?.actionItems?.find((item) => item.status !== "completed" && item.status !== "archived")?.title ||
    workspaceData?.recommendations?.find((item) => item.status !== "archived")?.title ||
    "Choose one next coach action for the current student.";

  async function submit(endpoint: string, body: unknown, success: string, reset?: () => void) {
    setActionState({ saving: true, sending: false, error: null, success: null });
    try {
      await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });
      reset?.();
      setActionState({ saving: false, sending: false, error: null, success });
      setNonce((value) => value + 1);
    } catch (error) {
      setActionState({
        saving: false,
        sending: false,
        error: error instanceof Error ? error.message : String(error),
        success: null,
      });
    }
  }

  async function sendMock(coachOutboundMessageId: string) {
    if (!selectedStudentProfileId) return;
    setActionState({ saving: false, sending: true, error: null, success: null });
    try {
      await apiFetch("/coaches/me/outbound-messages/send-mock", {
        method: "POST",
        body: JSON.stringify({
          studentProfileId: selectedStudentProfileId,
          coachOutboundMessageId,
        }),
      });
      setActionState({ saving: false, sending: false, error: null, success: "Mock coach delivery recorded" });
      setNonce((value) => value + 1);
    } catch (error) {
      setActionState({
        saving: false,
        sending: false,
        error: error instanceof Error ? error.message : String(error),
        success: null,
      });
    }
  }

  function switchStudent(studentProfileId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("studentProfileId", studentProfileId);
    router.replace(`/coach?${params.toString()}`);
  }

  return (
    <AppShell
      title="Coach workspace"
      subtitle="Move between authorized students, review the latest picture quickly, and turn your judgment into visible next steps."
    >
      <RequireRole expectedRoles={["coach", "admin"]} fallbackTitle="Coach sign-in required">
        <SectionCard title="Coach roster" subtitle="Only assigned students appear here. Pick one to open the review workspace." tone="highlight">
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ display: "grid", gap: 6, minWidth: 240, flex: "1 1 260px" }}>
                <FieldInfoLabel
                  label="Search assigned students"
                  info="Filter the roster to the student you want to review."
                  example="Search Maya"
                />
                <input
                  value={rosterSearch}
                  onChange={(event) => setRosterSearch(event.target.value)}
                  placeholder="Search assigned students"
                />
              </label>
              <label style={{ display: "grid", gap: 6, minWidth: 240, flex: "1 1 240px" }}>
                <FieldInfoLabel
                  label="Active student"
                  info="Choose which assigned student should load into the workspace."
                  example="Maya Chen"
                />
                <select
                  value={selectedStudentProfileId || ""}
                  onChange={(event) => switchStudent(event.target.value)}
                >
                  {(roster.data?.roster || []).map((item) => (
                    <option key={item.studentProfileId} value={item.studentProfileId}>
                      {item.studentDisplayName}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {roster.loading ? <p>Loading coach roster...</p> : null}
            {roster.error ? <p style={{ color: "crimson" }}>{roster.error}</p> : null}
            {!roster.loading && !roster.error ? (
              <div className="ui-summary-grid">
                {filteredRoster.map((item) => (
                  <button
                    key={item.studentProfileId}
                    type="button"
                    onClick={() => switchStudent(item.studentProfileId)}
                    className="ui-summary-tile"
                    style={{
                      textAlign: "left",
                      borderColor:
                        item.studentProfileId === selectedStudentProfileId
                          ? "var(--role-accent, #0f6cbd)"
                          : "rgba(148, 163, 184, 0.18)",
                    }}
                  >
                    <div className="ui-summary-tile__label">{item.studentDisplayName}</div>
                    <div style={{ fontWeight: 800 }}>{titleCase(item.relationshipStatus)}</div>
                    <div style={{ color: "#52657d", fontSize: 14, lineHeight: 1.5 }}>
                      Readiness: {titleCase(item.readinessStatus)} · Evidence: {titleCase(item.evidenceCompletenessStatus)}
                    </div>
                    <div style={{ color: "#52657d", fontSize: 14, lineHeight: 1.5 }}>
                      {item.openActionItems} open actions · {item.activeFlags} active flags
                    </div>
                    <div style={{ color: "#52657d", fontSize: 14 }}>
                      Last note {formatDate(item.lastCoachNoteDate)} · Next review {formatDate(item.nextReviewDate)}
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard title={`${selectedName} review workspace`} subtitle="Use this to prepare for the next session without rebuilding the picture by hand.">
          {workspace.loading ? <p>Loading coach workspace...</p> : null}
          {workspace.error ? <p style={{ color: "crimson" }}>{workspace.error}</p> : null}
          {!workspace.loading && !workspace.error && !workspaceData ? (
            <p style={{ margin: 0, color: "#64748b" }}>No assigned student is selected yet.</p>
          ) : null}
          {!workspace.loading && !workspace.error && workspaceData ? (
            <div style={{ display: "grid", gap: 16 }}>
              <div className="ui-summary-grid">
                {[
                  {
                    label: "Active student",
                    value: selectedName,
                    detail: `${titleCase(workspaceData.summary.relationshipStatus)} relationship`,
                  },
                  {
                    label: "Current readiness",
                    value:
                      typeof workspaceData.summary.overallScore === "number"
                        ? `${workspaceData.summary.overallScore} · ${titleCase(workspaceData.summary.readinessStatus)}`
                        : "Not yet scored",
                    detail: `Evidence ${titleCase(workspaceData.summary.evidenceStrength)}`,
                  },
                  {
                    label: "Main risk",
                    value: mainRisk,
                    detail: "The first thing to address in the next review",
                  },
                  {
                    label: "Next coach move",
                    value: nextAction,
                    detail: "Fastest way to convert insight into follow-through",
                  },
                ].map((item) => (
                  <div key={item.label} className="ui-summary-tile">
                    <div className="ui-summary-tile__label">{item.label}</div>
                    <div style={{ fontWeight: 800, lineHeight: 1.45 }}>{item.value}</div>
                    <div style={{ color: "#52657d", fontSize: 14, lineHeight: 1.5 }}>{item.detail}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                <SectionCard title="Student summary" tone="quiet">
                  <KeyValueList
                    items={[
                      { label: "School", value: workspaceData.summary.academicSummary.schoolName || "Unknown" },
                      { label: "Primary major", value: workspaceData.summary.academicSummary.majorPrimary || "Unknown" },
                      { label: "Secondary major", value: workspaceData.summary.academicSummary.majorSecondary || "None" },
                      { label: "Expected graduation", value: workspaceData.summary.academicSummary.expectedGraduationDate || "Unknown" },
                      { label: "Next review date", value: workspaceData.summary.nextReviewDate || "Not set" },
                    ]}
                  />
                </SectionCard>
                <SectionCard title="Evidence gaps" tone="quiet">
                  {workspaceData.summary.missingEvidence.length ? (
                    <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 8 }}>
                      {workspaceData.summary.missingEvidence.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  ) : (
                    <p style={{ margin: 0, color: "#64748b" }}>No major missing-evidence blocker is showing.</p>
                  )}
                </SectionCard>
                <SectionCard title="Outcome status" tone="quiet">
                  <KeyValueList
                    items={[
                      { label: "Total active outcomes", value: workspaceData.summary.outcomeSummary.totalActive },
                      { label: "Applications", value: workspaceData.summary.outcomeSummary.countsByType.internship_application ?? 0 },
                      { label: "Interviews", value: workspaceData.summary.outcomeSummary.countsByType.interview ?? 0 },
                      { label: "Offers", value: workspaceData.summary.outcomeSummary.countsByType.offer ?? 0 },
                      { label: "Accepted roles", value: workspaceData.summary.outcomeSummary.countsByType.accepted_role ?? 0 },
                    ]}
                  />
                </SectionCard>
                <SectionCard title="Recent student actions" tone="quiet">
                  {workspaceData.recentStudentActions.length ? (
                    <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 8 }}>
                      {workspaceData.recentStudentActions.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  ) : (
                    <p style={{ margin: 0, color: "#64748b" }}>No recent student actions are available yet.</p>
                  )}
                </SectionCard>
              </div>

              {workspaceData.summary.parentContextAllowed ? (
                <SectionCard title="Parent concerns shared with the coach" subtitle="These are only shown when permission and consent allow it." tone="quiet">
                  {workspaceData.parentConcernSummaries.length ? (
                    <div style={{ display: "grid", gap: 10 }}>
                      {workspaceData.parentConcernSummaries.map((item) => (
                        <div key={`${item.category}-${item.updatedAt}`} className="ui-soft-panel">
                          <div style={{ fontWeight: 800 }}>{titleCase(item.category)} · {titleCase(item.urgency)}</div>
                          <div style={{ color: "#334155", lineHeight: 1.5 }}>{item.parentConcerns || "No detailed concern text was recorded."}</div>
                          {item.preferredOutcome ? (
                            <div style={{ color: "#64748b", fontSize: 14 }}>Preferred outcome: {item.preferredOutcome}</div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ margin: 0, color: "#64748b" }}>No parent concern entries are currently available for this student.</p>
                  )}
                </SectionCard>
              ) : null}
            </div>
          ) : null}
        </SectionCard>

        {workspaceData ? (
          <>
            <SectionCard title="Create coach records" subtitle="Capture what changed, what matters, and what should happen next.">
              <div style={{ display: "grid", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                  <details open>
                    <summary style={{ fontWeight: 800, cursor: "pointer" }}>Add review note</summary>
                    <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                      <label style={{ display: "grid", gap: 6 }}>
                        <FieldInfoLabel
                          label="Note title"
                          info="Give the note a short label so it is easy to scan later."
                          example="Mid-semester check-in"
                        />
                        <input placeholder="Short title" value={noteForm.title} onChange={(e) => setNoteForm((v) => ({ ...v, title: e.target.value }))} />
                      </label>
                      <label style={{ display: "grid", gap: 6 }}>
                        <FieldInfoLabel
                          label="Note type"
                          info="Choose the kind of coach note you are capturing."
                          example="Session note"
                        />
                        <select value={noteForm.noteType} onChange={(e) => setNoteForm((v) => ({ ...v, noteType: e.target.value }))}>
                          <option value="session_note">Session note</option>
                          <option value="observation">Observation</option>
                          <option value="risk_note">Risk note</option>
                          <option value="strength_note">Strength note</option>
                          <option value="parent_context_note">Parent context note</option>
                          <option value="follow_up_note">Follow-up note</option>
                          <option value="other">Other</option>
                        </select>
                      </label>
                      <label style={{ display: "grid", gap: 6 }}>
                        <FieldInfoLabel
                          label="Visibility"
                          info="Control who can see this note after it is saved."
                          example="Coach private"
                        />
                        <select value={noteForm.visibility} onChange={(e) => setNoteForm((v) => ({ ...v, visibility: e.target.value }))}>
                          <option value="coach_private">Coach private</option>
                          <option value="student_visible">Student visible</option>
                          <option value="parent_visible">Parent visible</option>
                          <option value="student_and_parent_visible">Student and parent visible</option>
                          <option value="internal_system_context">Internal system context</option>
                        </select>
                      </label>
                      <label style={{ display: "grid", gap: 6 }}>
                        <FieldInfoLabel
                          label="Note body"
                          info="Capture what changed, what you observed, or what to revisit."
                          example="Student agreed to send two outreach emails before Friday."
                        />
                        <textarea rows={4} placeholder="What changed, what you observed, or what to revisit next session" value={noteForm.body} onChange={(e) => setNoteForm((v) => ({ ...v, body: e.target.value }))} />
                      </label>
                      <button
                        type="button"
                        className="ui-button ui-button--primary"
                        onClick={() =>
                          submit(
                            "/coaches/me/notes",
                            { studentProfileId: selectedStudentProfileId, ...noteForm },
                            "Coach note saved",
                            () => setNoteForm({ noteType: "session_note", visibility: "coach_private", title: "", body: "" })
                          )
                        }
                      >
                        Save note
                      </button>
                    </div>
                  </details>

                  <details>
                    <summary style={{ fontWeight: 800, cursor: "pointer" }}>Add finding</summary>
                    <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                      <label style={{ display: "grid", gap: 6 }}>
                        <FieldInfoLabel
                          label="Finding title"
                          info="Name the conclusion you want future reviews to notice quickly."
                          example="Interview prep is the biggest bottleneck"
                        />
                        <input placeholder="Finding title" value={findingForm.title} onChange={(e) => setFindingForm((v) => ({ ...v, title: e.target.value }))} />
                      </label>
                      <label style={{ display: "grid", gap: 6 }}>
                        <FieldInfoLabel
                          label="Finding category"
                          info="Group the finding by the area it affects most."
                          example="Execution risk"
                        />
                        <select value={findingForm.findingCategory} onChange={(e) => setFindingForm((v) => ({ ...v, findingCategory: e.target.value }))}>
                          <option value="academic_gap">Academic gap</option>
                          <option value="career_direction">Career direction</option>
                          <option value="execution_risk">Execution risk</option>
                          <option value="communication_issue">Communication issue</option>
                          <option value="motivation_or_confidence">Motivation or confidence</option>
                          <option value="experience_gap">Experience gap</option>
                          <option value="network_gap">Network gap</option>
                          <option value="application_strategy">Application strategy</option>
                          <option value="strength">Strength</option>
                          <option value="other">Other</option>
                        </select>
                      </label>
                      <label style={{ display: "grid", gap: 6 }}>
                        <FieldInfoLabel
                          label="Importance"
                          info="Show how much attention this finding should get right now."
                          example="High"
                        />
                        <select value={findingForm.severity} onChange={(e) => setFindingForm((v) => ({ ...v, severity: e.target.value }))}>
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="urgent">Urgent</option>
                        </select>
                      </label>
                      <label style={{ display: "grid", gap: 6 }}>
                        <FieldInfoLabel
                          label="Visibility"
                          info="Choose whether this finding stays private or can be shared."
                          example="Student visible"
                        />
                        <select value={findingForm.visibility} onChange={(e) => setFindingForm((v) => ({ ...v, visibility: e.target.value }))}>
                          <option value="coach_private">Coach private</option>
                          <option value="student_visible">Student visible</option>
                          <option value="parent_visible">Parent visible</option>
                          <option value="student_and_parent_visible">Student and parent visible</option>
                          <option value="internal_system_context">Internal system context</option>
                        </select>
                      </label>
                      <label style={{ display: "grid", gap: 6 }}>
                        <FieldInfoLabel
                          label="Finding explanation"
                          info="State the conclusion clearly and explain the evidence behind it."
                          example="Resume improved, but outreach follow-through is still inconsistent."
                        />
                        <textarea rows={4} placeholder="State the conclusion clearly and explain the evidence basis" value={findingForm.explanation} onChange={(e) => setFindingForm((v) => ({ ...v, explanation: e.target.value }))} />
                      </label>
                      <button
                        type="button"
                        className="ui-button ui-button--primary"
                        onClick={() =>
                          submit(
                            "/coaches/me/findings",
                            { studentProfileId: selectedStudentProfileId, ...findingForm },
                            "Coach finding saved",
                            () => setFindingForm({ findingCategory: "execution_risk", severity: "medium", visibility: "coach_private", title: "", explanation: "" })
                          )
                        }
                      >
                        Save finding
                      </button>
                    </div>
                  </details>

                  <details>
                    <summary style={{ fontWeight: 800, cursor: "pointer" }}>Add recommendation</summary>
                    <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                      <label style={{ display: "grid", gap: 6 }}>
                        <FieldInfoLabel
                          label="Recommendation title"
                          info="Summarize the intervention in a short, actionable phrase."
                          example="Start weekly alumni outreach"
                        />
                        <input placeholder="Recommendation title" value={recommendationForm.title} onChange={(e) => setRecommendationForm((v) => ({ ...v, title: e.target.value }))} />
                      </label>
                      <label style={{ display: "grid", gap: 6 }}>
                        <FieldInfoLabel
                          label="Recommendation category"
                          info="Group the recommendation by the kind of help it provides."
                          example="Networking"
                        />
                        <select value={recommendationForm.recommendationCategory} onChange={(e) => setRecommendationForm((v) => ({ ...v, recommendationCategory: e.target.value }))}>
                          <option value="academic">Academic</option>
                          <option value="career_target">Career target</option>
                          <option value="resume">Resume</option>
                          <option value="internship_search">Internship search</option>
                          <option value="networking">Networking</option>
                          <option value="interview_prep">Interview prep</option>
                          <option value="project_or_portfolio">Project or portfolio</option>
                          <option value="communication">Communication</option>
                          <option value="outcome_tracking">Outcome tracking</option>
                          <option value="other">Other</option>
                        </select>
                      </label>
                      <label style={{ display: "grid", gap: 6 }}>
                        <FieldInfoLabel
                          label="Priority"
                          info="Show how quickly this recommendation should be acted on."
                          example="High"
                        />
                        <select value={recommendationForm.priority} onChange={(e) => setRecommendationForm((v) => ({ ...v, priority: e.target.value }))}>
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="urgent">Urgent</option>
                        </select>
                      </label>
                      <label style={{ display: "grid", gap: 6 }}>
                        <FieldInfoLabel
                          label="Visibility"
                          info="Choose who should be able to see this recommendation."
                          example="Student and parent visible"
                        />
                        <select value={recommendationForm.visibility} onChange={(e) => setRecommendationForm((v) => ({ ...v, visibility: e.target.value }))}>
                          <option value="coach_private">Coach private</option>
                          <option value="student_visible">Student visible</option>
                          <option value="parent_visible">Parent visible</option>
                          <option value="student_and_parent_visible">Student and parent visible</option>
                          <option value="internal_system_context">Internal system context</option>
                        </select>
                      </label>
                      <label style={{ display: "grid", gap: 6 }}>
                        <FieldInfoLabel
                          label="Why this matters now"
                          info="Explain the reason this recommendation should be prioritized."
                          example="Applications are stalling because outreach has not started."
                        />
                        <textarea rows={3} placeholder="Why this matters now" value={recommendationForm.rationale} onChange={(e) => setRecommendationForm((v) => ({ ...v, rationale: e.target.value }))} />
                      </label>
                      <label style={{ display: "grid", gap: 6 }}>
                        <FieldInfoLabel
                          label="Recommended next step"
                          info="State the next concrete action the student or parent should take."
                          example="Send three alumni outreach messages by Thursday."
                        />
                        <textarea rows={3} placeholder="Recommended next step" value={recommendationForm.recommendedNextStep} onChange={(e) => setRecommendationForm((v) => ({ ...v, recommendedNextStep: e.target.value }))} />
                      </label>
                      <label style={{ display: "grid", gap: 6 }}>
                        <FieldInfoLabel
                          label="Due date"
                          info="Add a target date if this recommendation needs follow-through."
                          example="2026-05-01"
                        />
                        <input type="date" value={recommendationForm.dueDate} onChange={(e) => setRecommendationForm((v) => ({ ...v, dueDate: e.target.value }))} />
                      </label>
                      <button
                        type="button"
                        className="ui-button ui-button--primary"
                        onClick={() =>
                          submit(
                            "/coaches/me/recommendations",
                            { studentProfileId: selectedStudentProfileId, ...recommendationForm },
                            "Coach recommendation saved",
                            () =>
                              setRecommendationForm({
                                recommendationCategory: "communication",
                                priority: "high",
                                visibility: "student_visible",
                                status: "active",
                                title: "",
                                rationale: "",
                                recommendedNextStep: "",
                                dueDate: "",
                              })
                          )
                        }
                      >
                        Save recommendation
                      </button>
                    </div>
                  </details>

                  <details>
                    <summary style={{ fontWeight: 800, cursor: "pointer" }}>Add coach-sourced action</summary>
                    <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                      <label style={{ display: "grid", gap: 6 }}>
                        <FieldInfoLabel
                          label="Action title"
                          info="Name the follow-through step in a short, actionable way."
                          example="Finish resume revision"
                        />
                        <input placeholder="Action title" value={actionItemForm.title} onChange={(e) => setActionItemForm((v) => ({ ...v, title: e.target.value }))} />
                      </label>
                      <label style={{ display: "grid", gap: 6 }}>
                        <FieldInfoLabel
                          label="Action description"
                          info="Explain what good follow-through looks like."
                          example="Update bullets for the lab role and send the draft for review."
                        />
                        <textarea rows={3} placeholder="What should happen next and what good follow-through looks like" value={actionItemForm.description} onChange={(e) => setActionItemForm((v) => ({ ...v, description: e.target.value }))} />
                      </label>
                      <label style={{ display: "grid", gap: 6 }}>
                        <FieldInfoLabel
                          label="Priority"
                          info="Show how urgent this follow-through item is."
                          example="Medium"
                        />
                        <select value={actionItemForm.priority} onChange={(e) => setActionItemForm((v) => ({ ...v, priority: e.target.value }))}>
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="urgent">Urgent</option>
                        </select>
                      </label>
                      <label style={{ display: "grid", gap: 6 }}>
                        <FieldInfoLabel
                          label="Assigned to"
                          info="Choose who should own this action item."
                          example="Student"
                        />
                        <select value={actionItemForm.assignedTo} onChange={(e) => setActionItemForm((v) => ({ ...v, assignedTo: e.target.value }))}>
                          <option value="student">Student</option>
                          <option value="parent">Parent</option>
                          <option value="coach">Coach</option>
                          <option value="shared">Shared</option>
                        </select>
                      </label>
                      <label style={{ display: "grid", gap: 6 }}>
                        <FieldInfoLabel
                          label="Due date"
                          info="Add a target date when this follow-up should be done."
                          example="2026-05-03"
                        />
                        <input type="date" value={actionItemForm.dueDate} onChange={(e) => setActionItemForm((v) => ({ ...v, dueDate: e.target.value }))} />
                      </label>
                      <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <input type="checkbox" checked={actionItemForm.visibleToStudent} onChange={(e) => setActionItemForm((v) => ({ ...v, visibleToStudent: e.target.checked }))} />
                        <span>
                          <FieldInfoLabel
                            label="Visible to student"
                            info="Turn this on when the student should see the action item."
                            example="Checked for a student task"
                          />
                        </span>
                      </label>
                      <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <input type="checkbox" checked={actionItemForm.visibleToParent} onChange={(e) => setActionItemForm((v) => ({ ...v, visibleToParent: e.target.checked }))} />
                        <span>
                          <FieldInfoLabel
                            label="Visible to parent"
                            info="Turn this on when a parent should see or support this action."
                            example="Checked when a parent can help schedule time"
                          />
                        </span>
                      </label>
                      <button
                        type="button"
                        className="ui-button ui-button--primary"
                        onClick={() =>
                          submit(
                            "/coaches/me/action-items",
                            { studentProfileId: selectedStudentProfileId, ...actionItemForm },
                            "Coach action item saved",
                            () =>
                              setActionItemForm({
                                priority: "high",
                                assignedTo: "student",
                                title: "",
                                description: "",
                                dueDate: "",
                                visibleToStudent: true,
                                visibleToParent: false,
                              })
                          )
                        }
                      >
                        Save action item
                      </button>
                    </div>
                  </details>

                  <details>
                    <summary style={{ fontWeight: 800, cursor: "pointer" }}>Add flag</summary>
                    <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                      <label style={{ display: "grid", gap: 6 }}>
                        <FieldInfoLabel
                          label="Flag title"
                          info="Give the concern a short name that is easy to scan later."
                          example="Application activity has stalled"
                        />
                        <input placeholder="Flag title" value={flagForm.title} onChange={(e) => setFlagForm((v) => ({ ...v, title: e.target.value }))} />
                      </label>
                      <label style={{ display: "grid", gap: 6 }}>
                        <FieldInfoLabel
                          label="Flag type"
                          info="Choose the kind of issue that needs attention."
                          example="Missing evidence"
                        />
                        <select value={flagForm.flagType} onChange={(e) => setFlagForm((v) => ({ ...v, flagType: e.target.value }))}>
                          <option value="missing_evidence">Missing evidence</option>
                          <option value="academic_risk">Academic risk</option>
                          <option value="application_stall">Application stall</option>
                          <option value="communication_breakdown">Communication breakdown</option>
                          <option value="missed_deadline">Missed deadline</option>
                          <option value="no_outcome_activity">No outcome activity</option>
                          <option value="high_parent_concern">High parent concern</option>
                          <option value="coach_attention_needed">Coach attention needed</option>
                          <option value="other">Other</option>
                        </select>
                      </label>
                      <label style={{ display: "grid", gap: 6 }}>
                        <FieldInfoLabel
                          label="Severity"
                          info="Show how quickly this issue should be reviewed."
                          example="Warning"
                        />
                        <select value={flagForm.severity} onChange={(e) => setFlagForm((v) => ({ ...v, severity: e.target.value }))}>
                          <option value="info">Info</option>
                          <option value="warning">Warning</option>
                          <option value="high">High</option>
                          <option value="urgent">Urgent</option>
                        </select>
                      </label>
                      <label style={{ display: "grid", gap: 6 }}>
                        <FieldInfoLabel
                          label="Visibility"
                          info="Choose who should be able to see this flag."
                          example="Parent visible"
                        />
                        <select value={flagForm.visibility} onChange={(e) => setFlagForm((v) => ({ ...v, visibility: e.target.value }))}>
                          <option value="coach_private">Coach private</option>
                          <option value="student_visible">Student visible</option>
                          <option value="parent_visible">Parent visible</option>
                          <option value="student_and_parent_visible">Student and parent visible</option>
                          <option value="internal_system_context">Internal system context</option>
                        </select>
                      </label>
                      <label style={{ display: "grid", gap: 6 }}>
                        <FieldInfoLabel
                          label="Flag description"
                          info="Describe what needs attention and why it matters."
                          example="No interview follow-up has been recorded in the last three weeks."
                        />
                        <textarea rows={3} placeholder="Describe what needs attention and why" value={flagForm.description} onChange={(e) => setFlagForm((v) => ({ ...v, description: e.target.value }))} />
                      </label>
                      <button
                        type="button"
                        className="ui-button ui-button--primary"
                        onClick={() =>
                          submit(
                            "/coaches/me/flags",
                            { studentProfileId: selectedStudentProfileId, ...flagForm },
                            "Coach flag saved",
                            () =>
                              setFlagForm({
                                flagType: "coach_attention_needed",
                                severity: "warning",
                                visibility: "coach_private",
                                title: "",
                                description: "",
                              })
                          )
                        }
                      >
                        Save flag
                      </button>
                    </div>
                  </details>
                </div>

                <details>
                  <summary style={{ fontWeight: 800, cursor: "pointer" }}>Create follow-up message</summary>
                  <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                      <label style={{ display: "grid", gap: 6 }}>
                        <FieldInfoLabel
                          label="Recipient"
                          info="Choose whether this follow-up is meant for the student or the parent."
                          example="Student"
                        />
                        <select value={messageForm.recipientType} onChange={(e) => setMessageForm((v) => ({ ...v, recipientType: e.target.value }))}>
                          <option value="student">Student</option>
                          <option value="parent">Parent</option>
                        </select>
                      </label>
                      <label style={{ display: "grid", gap: 6 }}>
                        <FieldInfoLabel
                          label="Channel"
                          info="Pick the delivery channel you would use if sending is approved."
                          example="Email"
                        />
                        <select value={messageForm.channel} onChange={(e) => setMessageForm((v) => ({ ...v, channel: e.target.value }))}>
                          <option value="email">Email</option>
                          <option value="sms">SMS</option>
                          <option value="whatsapp">WhatsApp</option>
                        </select>
                      </label>
                      <label style={{ display: "grid", gap: 6 }}>
                        <FieldInfoLabel
                          label="Draft status"
                          info="Leave this as draft until the message is ready for review or mock send."
                          example="Draft"
                        />
                        <select value={messageForm.status} onChange={(e) => setMessageForm((v) => ({ ...v, status: e.target.value }))}>
                          <option value="draft">Draft</option>
                          <option value="ready">Ready to send</option>
                        </select>
                      </label>
                    </div>
                    <label style={{ display: "grid", gap: 6 }}>
                      <FieldInfoLabel
                        label="Subject"
                        info="Add a short subject line when the channel is email."
                        example="Quick follow-up before Friday"
                      />
                      <input placeholder="Subject (optional for email)" value={messageForm.subject} onChange={(e) => setMessageForm((v) => ({ ...v, subject: e.target.value }))} />
                    </label>
                    <label style={{ display: "grid", gap: 6 }}>
                      <FieldInfoLabel
                        label="Message body"
                        info="Draft a calm, professional follow-up the coach would want to send."
                        example="Please send your updated resume before tomorrow so we can review it together."
                      />
                      <textarea rows={4} placeholder="Write a calm, professional follow-up message" value={messageForm.body} onChange={(e) => setMessageForm((v) => ({ ...v, body: e.target.value }))} />
                    </label>
                    <button
                      type="button"
                      className="ui-button ui-button--primary"
                      onClick={() =>
                        submit(
                          "/coaches/me/outbound-messages/draft",
                          { studentProfileId: selectedStudentProfileId, ...messageForm },
                          messageForm.status === "ready" ? "Coach message marked ready" : "Coach draft saved",
                          () => setMessageForm({ recipientType: "student", channel: "email", status: "draft", subject: "", body: "" })
                        )
                      }
                    >
                      Save follow-up message
                    </button>
                  </div>
                </details>

                {actionState.error ? <p style={{ color: "crimson", margin: 0 }}>{actionState.error}</p> : null}
                {actionState.success ? <p style={{ color: "#166534", margin: 0 }}>{actionState.success}</p> : null}
              </div>
            </SectionCard>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
              <SectionCard title="Recommendations" tone="quiet">
                {workspaceData.recommendations.length ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    {workspaceData.recommendations.map((item) => (
                      <div key={item.coachRecommendationId} className="ui-soft-panel">
                        <div style={{ fontWeight: 800 }}>{item.title}</div>
                        <div style={{ color: "#334155", lineHeight: 1.5 }}>{item.recommendedNextStep}</div>
                        <div style={{ color: "#64748b", fontSize: 14 }}>
                          {titleCase(item.priority)} · {titleCase(item.status)} · {titleCase(item.visibility)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ margin: 0, color: "#64748b" }}>No recommendations saved yet.</p>
                )}
              </SectionCard>

              <SectionCard title="Coach-sourced actions" tone="quiet">
                {workspaceData.actionItems.length ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    {workspaceData.actionItems.map((item) => (
                      <div key={item.coachActionItemId} className="ui-soft-panel">
                        <div style={{ fontWeight: 800 }}>{item.title}</div>
                        {item.description ? <div style={{ color: "#334155", lineHeight: 1.5 }}>{item.description}</div> : null}
                        <div style={{ color: "#64748b", fontSize: 14 }}>
                          {titleCase(item.priority)} · {titleCase(item.status)} · Assigned to {titleCase(item.assignedTo)}
                          {item.dueDate ? ` · Due ${formatDate(item.dueDate)}` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ margin: 0, color: "#64748b" }}>No coach action items saved yet.</p>
                )}
              </SectionCard>

              <SectionCard title="Flags and alerts" tone="quiet">
                {workspaceData.flags.length ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    {workspaceData.flags.map((item) => (
                      <div key={item.coachFlagId} className="ui-soft-panel">
                        <div style={{ fontWeight: 800 }}>{item.title}</div>
                        <div style={{ color: "#334155", lineHeight: 1.5 }}>{item.description}</div>
                        <div style={{ color: "#64748b", fontSize: 14 }}>
                          {titleCase(item.severity)} · {titleCase(item.status)} · {titleCase(item.visibility)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ margin: 0, color: "#64748b" }}>No open coach flags are saved yet.</p>
                )}
              </SectionCard>

              <SectionCard title="Review notes" tone="quiet">
                {workspaceData.notes.length ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    {workspaceData.notes.map((item) => (
                      <div key={item.coachNoteId} className="ui-soft-panel">
                        <div style={{ fontWeight: 800 }}>{item.title}</div>
                        <div style={{ color: "#334155", lineHeight: 1.5 }}>{item.body}</div>
                        <div style={{ color: "#64748b", fontSize: 14 }}>
                          {titleCase(item.noteType)} · {titleCase(item.visibility)} · {formatDate(item.createdAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ margin: 0, color: "#64748b" }}>No notes are saved for this student yet.</p>
                )}
              </SectionCard>
            </div>

            <SectionCard title="Follow-up communication" subtitle="Drafts stay inside the system unless you intentionally mock-send them.">
              {workspaceData.outboundMessages.length ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {workspaceData.outboundMessages.map((item) => (
                    <div key={item.coachOutboundMessageId} className="ui-soft-panel">
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <strong>{titleCase(item.recipientType)} via {titleCase(item.channel)}</strong>
                        <span style={{ color: "#64748b", fontSize: 14 }}>{titleCase(item.status)} · {titleCase(item.providerMode)}</span>
                      </div>
                      {item.subject ? <div style={{ color: "#334155", fontWeight: 700, marginTop: 6 }}>{item.subject}</div> : null}
                      <div style={{ color: "#334155", lineHeight: 1.6, marginTop: 6 }}>{item.body}</div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                        {item.status !== "sent" ? (
                          <button
                            type="button"
                            className="ui-button ui-button--secondary"
                            onClick={() => sendMock(item.coachOutboundMessageId)}
                            disabled={actionState.sending}
                          >
                            {actionState.sending ? "Sending…" : "Mock send"}
                          </button>
                        ) : null}
                        {item.sentAt ? <span style={{ color: "#64748b", fontSize: 14 }}>Sent {formatDate(item.sentAt)}</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, color: "#64748b" }}>No outbound drafts are saved for this student yet.</p>
              )}
            </SectionCard>
          </>
        ) : null}

        <SectionCard
          title="Technical diagnostics"
          subtitle="These checks are still useful, but they are secondary to the coach’s student review workflow."
          tone="quiet"
        >
          <div style={{ display: "grid", gap: 16 }}>
            {fixtures.loading ? <p>Loading fixture validation...</p> : null}
            {fixtures.error ? <p style={{ color: "crimson" }}>{fixtures.error}</p> : null}
            {mappings.loading ? <p>Loading role mappings...</p> : null}
            {mappings.error ? <p style={{ color: "crimson" }}>{mappings.error}</p> : null}
            {!fixtures.loading && !fixtures.error ? (
              <details className="ui-soft-panel">
                <summary style={{ fontWeight: 800, cursor: "pointer" }}>Validation payload</summary>
                <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", marginBottom: 0 }}>
                  {JSON.stringify(fixtures.data, null, 2)}
                </pre>
              </details>
            ) : null}
            {!mappings.loading && !mappings.error ? (
              <div style={{ display: "grid", gap: 10 }}>
                {(mappings.data?.mappings || []).slice(0, 6).map((mapping) => (
                  <div key={mapping.canonicalName} className="ui-soft-panel">
                    <strong>{mapping.canonicalName}</strong>
                    <div style={{ color: "#334155", marginTop: 6 }}>
                      {mapping.onetCode || "Unmapped"} · Job zone {mapping.jobZone ?? "Unknown"} · {mapping.skillCount} imported skills
                    </div>
                    <div style={{ color: "#64748b", fontSize: 14, marginTop: 6 }}>
                      {mapping.topSkills.length ? mapping.topSkills.join(", ") : "No imported skills visible"}
                    </div>
                  </div>
                ))}
                <Link href="/diagnostic" className="ui-button ui-button--secondary" style={{ width: "fit-content" }}>
                  Open detailed diagnostics
                </Link>
              </div>
            ) : null}
          </div>
        </SectionCard>
      </RequireRole>
    </AppShell>
  );
}
