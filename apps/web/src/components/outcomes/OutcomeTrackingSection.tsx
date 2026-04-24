"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  OutcomeStatus,
  OutcomeType,
  OutcomeVerificationStatus,
  StudentOutcomeRecord,
  StudentOutcomeSummary,
} from "../../../../../packages/shared/src/contracts/outcomes";
import { useApiData } from "../../hooks/useApiData";
import { apiFetch } from "../../lib/apiClient";
import { useSaveNavigation } from "../../lib/saveNavigation";
import { FieldInfoLabel } from "../forms/FieldInfoLabel";
import { SectionCard } from "../layout/SectionCard";

type OutcomeListResponse = {
  ok: boolean;
  count: number;
  outcomes: StudentOutcomeRecord[];
};

type OutcomeSummaryResponse = {
  ok: boolean;
  summary: StudentOutcomeSummary;
};

type OutcomeTrackingMode = "student" | "parent" | "coach";

const outcomeTypeOptions: Array<{ value: OutcomeType; label: string }> = [
  { value: "internship_application", label: "Application" },
  { value: "interview", label: "Interview" },
  { value: "offer", label: "Offer received" },
  { value: "accepted_role", label: "Accepted role" },
];

const statusOptionsByType: Record<OutcomeType, Array<{ value: OutcomeStatus; label: string }>> = {
  internship_application: [
    { value: "not_started", label: "Not started" },
    { value: "in_progress", label: "In progress" },
    { value: "applied", label: "Applied" },
  ],
  interview: [
    { value: "not_started", label: "Not started" },
    { value: "in_progress", label: "In progress" },
    { value: "interviewing", label: "Interviewing" },
  ],
  offer: [
    { value: "not_started", label: "Not started" },
    { value: "in_progress", label: "In progress" },
    { value: "offer", label: "Offer" },
  ],
  accepted_role: [
    { value: "not_started", label: "Not started" },
    { value: "in_progress", label: "In progress" },
    { value: "accepted", label: "Accepted" },
  ],
};

const verificationLabels: Record<OutcomeVerificationStatus, string> = {
  self_reported: "Self-reported",
  coach_reviewed: "Coach reviewed",
  parent_reported: "Parent-reported",
  verified: "Verified",
  disputed: "Disputed",
};

const reporterLabels: Record<StudentOutcomeRecord["reportedByRole"], string> = {
  student: "Student",
  parent: "Parent",
  coach: "Coach",
  admin: "Admin",
};

const summaryTileStyle: React.CSSProperties = {
  borderRadius: 18,
  padding: 18,
  background: "rgba(255, 255, 255, 0.9)",
  border: "1px solid rgba(148, 163, 184, 0.18)",
  boxShadow: "0 12px 28px rgba(15, 23, 42, 0.05)",
};

function titleCase(value: string | undefined | null): string {
  if (!value) return "Unknown";
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function defaultActionDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function endpointPrefix(mode: OutcomeTrackingMode): string {
  if (mode === "student") return "/students/me/outcomes";
  if (mode === "parent") return "/parents/me/outcomes";
  return "/coaches/me/outcomes";
}

function sectionCopy(mode: OutcomeTrackingMode) {
  if (mode === "student") {
    return {
      title: "Outcome tracking",
      subtitle:
        "Capture applications, interviews, offers, and accepted roles so your progress is visible over time.",
      empty:
        "No career progress has been reported yet. Add your first application, interview, offer, or accepted role to start the timeline.",
      actionLabel: "Report a new outcome",
    };
  }

  if (mode === "parent") {
    return {
      title: "Outcome progress",
      subtitle:
        "See the student’s reported applications, interviews, offers, and acceptances. Parent-reported items stay clearly labeled.",
      empty:
        "No outcome activity has been reported for this student yet. You can add an update if you have trustworthy information to capture.",
      actionLabel: "Report an outcome update",
    };
  }

  return {
    title: "Outcome review",
    subtitle:
      "Review the student’s reported applications, interviews, offers, and acceptances. Coach-reviewed items remain distinct from self-reported entries.",
    empty:
      "No outcome activity has been reported for this student yet. Add a coaching update or review new records when they arrive.",
    actionLabel: "Add reviewed outcome",
  };
}

export function OutcomeTrackingSection(props: {
  mode: OutcomeTrackingMode;
  subjectLabel?: string;
}) {
  const saveNavigation = useSaveNavigation();
  const copy = sectionCopy(props.mode);
  const subjectLabel = props.subjectLabel || (props.mode === "parent" ? "your student" : "this student");
  const prefix = endpointPrefix(props.mode);
  const [nonce, setNonce] = useState(0);
  const [form, setForm] = useState({
    outcomeType: "internship_application" as OutcomeType,
    status: "applied" as OutcomeStatus,
    employerName: "",
    roleTitle: "",
    actionDate: defaultActionDate(),
    notes: "",
  });
  const [editingOutcomeId, setEditingOutcomeId] = useState<string | null>(null);
  const [actionState, setActionState] = useState<{
    saving: boolean;
    reviewing: string | null;
    archiving: string | null;
    error: string | null;
    success: string | null;
  }>({
    saving: false,
    reviewing: null,
    archiving: null,
    error: null,
    success: null,
  });

  const summary = useApiData<OutcomeSummaryResponse>(`${prefix}/summary`, true, nonce);
  const outcomes = useApiData<OutcomeListResponse>(prefix, true, nonce);

  const canCreate = true;
  const canEdit = props.mode === "student" || props.mode === "parent";
  const canArchive = props.mode === "student" || props.mode === "parent";
  const canReview = props.mode === "coach";

  useEffect(() => {
    const validStatuses = statusOptionsByType[form.outcomeType].map((option) => option.value);
    if (!validStatuses.includes(form.status)) {
      setForm((current) => ({
        ...current,
        status: validStatuses[0],
      }));
    }
  }, [form.outcomeType, form.status]);

  const reviewQueue = useMemo(
    () =>
      (outcomes.data?.outcomes || []).filter(
        (outcome) =>
          outcome.verificationStatus !== "coach_reviewed" &&
          outcome.verificationStatus !== "verified"
      ),
    [outcomes.data?.outcomes]
  );

  async function handleCreateOutcome() {
    setActionState((current) => ({
      ...current,
      saving: true,
      error: null,
      success: null,
    }));

    try {
      const result = await apiFetch(prefix, {
        method: editingOutcomeId ? "PATCH" : "POST",
        body: JSON.stringify({
          ...(editingOutcomeId ? { studentOutcomeId: editingOutcomeId } : {}),
          outcomeType: form.outcomeType,
          status: form.status,
          employerName: form.employerName.trim() || undefined,
          roleTitle: form.roleTitle.trim() || undefined,
          actionDate: form.actionDate,
          notes: form.notes.trim() || undefined,
        }),
      });

      setForm({
        outcomeType: "internship_application",
        status: "applied",
        employerName: "",
        roleTitle: "",
        actionDate: defaultActionDate(),
        notes: "",
      });
      setEditingOutcomeId(null);
      setActionState({
        saving: false,
        reviewing: null,
        archiving: null,
        error: null,
        success:
          (result as { message?: string }).message ||
          (editingOutcomeId ? "Outcome updated" : "Outcome saved"),
      });
      saveNavigation.reloadAfterSave();
    } catch (error) {
      setActionState({
        saving: false,
        reviewing: null,
        archiving: null,
        error: error instanceof Error ? error.message : String(error),
        success: null,
      });
    }
  }

  function startEdit(outcome: StudentOutcomeRecord) {
    setEditingOutcomeId(outcome.studentOutcomeId);
    setForm({
      outcomeType: outcome.outcomeType,
      status: outcome.status,
      employerName: outcome.employerName || "",
      roleTitle: outcome.roleTitle || "",
      actionDate: outcome.actionDate.slice(0, 10),
      notes: outcome.notes || "",
    });
    setActionState((current) => ({
      ...current,
      error: null,
      success: null,
    }));
  }

  function cancelEdit() {
    setEditingOutcomeId(null);
    setForm({
      outcomeType: "internship_application",
      status: "applied",
      employerName: "",
      roleTitle: "",
      actionDate: defaultActionDate(),
      notes: "",
    });
  }

  async function handleArchive(studentOutcomeId: string) {
    setActionState((current) => ({
      ...current,
      archiving: studentOutcomeId,
      error: null,
      success: null,
    }));

    try {
      const result = await apiFetch(`${prefix}/archive`, {
        method: "POST",
        body: JSON.stringify({ studentOutcomeId }),
      });
      setActionState((current) => ({
        ...current,
        archiving: null,
        error: null,
        success: (result as { message?: string }).message || "Outcome archived",
      }));
      setNonce((value) => value + 1);
    } catch (error) {
      setActionState((current) => ({
        ...current,
        archiving: null,
        error: error instanceof Error ? error.message : String(error),
        success: null,
      }));
    }
  }

  async function handleReview(studentOutcomeId: string) {
    setActionState((current) => ({
      ...current,
      reviewing: studentOutcomeId,
      error: null,
      success: null,
    }));

    try {
      const result = await apiFetch("/coaches/me/outcomes/review", {
        method: "POST",
        body: JSON.stringify({ studentOutcomeId }),
      });
      setActionState((current) => ({
        ...current,
        reviewing: null,
        error: null,
        success: (result as { message?: string }).message || "Outcome reviewed",
      }));
      setNonce((value) => value + 1);
    } catch (error) {
      setActionState((current) => ({
        ...current,
        reviewing: null,
        error: error instanceof Error ? error.message : String(error),
        success: null,
      }));
    }
  }

  return (
    <SectionCard
      title={copy.title}
      subtitle={
        props.mode === "parent"
          ? `Track ${subjectLabel}'s reported applications, interviews, offers, and accepted roles in one place.`
          : props.mode === "coach"
            ? `Review ${subjectLabel}'s reported applications, interviews, offers, and accepted roles with source labels still visible.`
            : copy.subtitle
      }
    >
      <div style={{ display: "grid", gap: 20 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 12,
          }}
        >
          {summary.loading ? <p style={{ margin: 0 }}>Loading outcome summary...</p> : null}
          {summary.error ? <p style={{ margin: 0, color: "crimson" }}>{summary.error}</p> : null}
          {!summary.loading && !summary.error ? (
            <>
              <div style={summaryTileStyle}>
                <div className="ui-summary-tile__label">Applications</div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>
                  {summary.data?.summary.countsByType.internship_application ?? 0}
                </div>
                <div style={{ color: "#52657d" }}>Reported applications</div>
              </div>
              <div style={summaryTileStyle}>
                <div className="ui-summary-tile__label">Interviews</div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>
                  {summary.data?.summary.countsByType.interview ?? 0}
                </div>
                <div style={{ color: "#52657d" }}>Reported interviews</div>
              </div>
              <div style={summaryTileStyle}>
                <div className="ui-summary-tile__label">Offers</div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>
                  {summary.data?.summary.countsByType.offer ?? 0}
                </div>
                <div style={{ color: "#52657d" }}>Offers received</div>
              </div>
              <div style={summaryTileStyle}>
                <div className="ui-summary-tile__label">Accepted roles</div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>
                  {summary.data?.summary.countsByType.accepted_role ?? 0}
                </div>
                <div style={{ color: "#52657d" }}>Accepted positions</div>
              </div>
            </>
          ) : null}
        </div>

        {canCreate ? (
          <div className="ui-soft-panel" style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <strong>{editingOutcomeId ? "Edit outcome" : copy.actionLabel}</strong>
              <p style={{ margin: 0, color: "#52657d", lineHeight: 1.6 }}>
                Keep this factual and timestamped. Verification stays visible so early outcome data is useful later without overstating certainty.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 14,
              }}
            >
              <label style={{ display: "grid", gap: 8 }}>
                <FieldInfoLabel
                  label="Outcome type"
                  info="Choose the stage you are reporting. Example: Interview."
                />
                <select
                  value={form.outcomeType}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      outcomeType: event.target.value as OutcomeType,
                    }))
                  }
                >
                  {outcomeTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "grid", gap: 8 }}>
                <FieldInfoLabel
                  label="Status"
                  info="Pick the state that matches this stage. Example: Applied."
                />
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      status: event.target.value as OutcomeStatus,
                    }))
                  }
                >
                  {statusOptionsByType[form.outcomeType].map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "grid", gap: 8 }}>
                <FieldInfoLabel
                  label="Employer or organization"
                  info="Name the company, lab, or organization. Example: Pfizer."
                />
                <input
                  value={form.employerName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      employerName: event.target.value,
                    }))
                  }
                  placeholder="Pfizer"
                />
              </label>

              <label style={{ display: "grid", gap: 8 }}>
                <FieldInfoLabel
                  label="Role title"
                  info="Use the title shown in the application or offer. Example: Data Analyst Intern."
                />
                <input
                  value={form.roleTitle}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      roleTitle: event.target.value,
                    }))
                  }
                  placeholder="Data Analyst Intern"
                />
              </label>

              <label style={{ display: "grid", gap: 8 }}>
                <FieldInfoLabel
                  label="Date"
                  info="Use the date this step happened. Example: 2026-04-20."
                />
                <input
                  type="date"
                  value={form.actionDate}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      actionDate: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <label style={{ display: "grid", gap: 8 }}>
              <FieldInfoLabel
                label="Notes"
                info="Add brief context only if it helps. Example: Final-round interview completed."
              />
              <textarea
                rows={3}
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                placeholder="Short context that will still make sense later"
              />
            </label>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                className="ui-button ui-button--primary"
                disabled={actionState.saving}
                onClick={handleCreateOutcome}
              >
                {actionState.saving
                  ? "Saving..."
                  : editingOutcomeId
                    ? "Save changes"
                    : copy.actionLabel}
              </button>
              {editingOutcomeId ? (
                <button
                  type="button"
                  className="ui-button ui-button--secondary"
                  onClick={cancelEdit}
                >
                  Cancel edit
                </button>
              ) : null}
              {actionState.error ? <span style={{ color: "crimson" }}>{actionState.error}</span> : null}
              {actionState.success ? <span style={{ color: "#166534" }}>{actionState.success}</span> : null}
            </div>
          </div>
        ) : null}

        {canReview ? (
          <div className="ui-soft-panel" style={{ display: "grid", gap: 8 }}>
            <strong>Needs review</strong>
            <p style={{ margin: 0, color: "#52657d", lineHeight: 1.6 }}>
              {reviewQueue.length
                ? `${reviewQueue.length} reported ${
                    reviewQueue.length === 1 ? "item still needs" : "items still need"
                  } coach review.`
                : "No reported items are waiting for coach review right now."}
            </p>
          </div>
        ) : null}

        <div style={{ display: "grid", gap: 12 }}>
          <strong>Recent timeline</strong>
          {outcomes.loading ? <p style={{ margin: 0 }}>Loading outcome timeline...</p> : null}
          {outcomes.error ? <p style={{ margin: 0, color: "crimson" }}>{outcomes.error}</p> : null}
          {!outcomes.loading && !outcomes.error && !(outcomes.data?.outcomes.length) ? (
            <p style={{ margin: 0, color: "#52657d" }}>{copy.empty}</p>
          ) : null}
          {!outcomes.loading && !outcomes.error ? (
            <div style={{ display: "grid", gap: 12 }}>
              {(outcomes.data?.outcomes || []).slice(0, 10).map((outcome) => (
                <div
                  key={outcome.studentOutcomeId}
                  style={{
                    borderRadius: 18,
                    border: "1px solid rgba(148, 163, 184, 0.2)",
                    background: "rgba(255,255,255,0.88)",
                    padding: 16,
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "grid", gap: 6 }}>
                      <strong>
                        {titleCase(outcome.outcomeType)}{outcome.roleTitle ? ` · ${outcome.roleTitle}` : ""}
                      </strong>
                      <div style={{ color: "#52657d", lineHeight: 1.5 }}>
                        {outcome.employerName || "Employer not specified"} · {formatDate(outcome.actionDate)}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span className="ui-pill">{titleCase(outcome.status)}</span>
                      <span className="ui-pill">{verificationLabels[outcome.verificationStatus]}</span>
                    </div>
                  </div>

                  <div style={{ color: "#334155", lineHeight: 1.6 }}>
                    Reported by {reporterLabels[outcome.reportedByRole]}
                    {outcome.targetRoleFamily ? ` · linked to ${titleCase(outcome.targetRoleFamily)}` : ""}
                  </div>

                  {outcome.notes ? (
                    <div style={{ color: "#475569", lineHeight: 1.6 }}>{outcome.notes}</div>
                  ) : null}

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {canEdit ? (
                      <button
                        type="button"
                        className="ui-button ui-button--secondary"
                        onClick={() => startEdit(outcome)}
                      >
                        Edit
                      </button>
                    ) : null}
                    {canArchive ? (
                      <button
                        type="button"
                        className="ui-button ui-button--secondary"
                        disabled={actionState.archiving === outcome.studentOutcomeId}
                        onClick={() => handleArchive(outcome.studentOutcomeId)}
                      >
                        {actionState.archiving === outcome.studentOutcomeId ? "Archiving..." : "Archive"}
                      </button>
                    ) : null}
                    {canReview &&
                    outcome.verificationStatus !== "coach_reviewed" &&
                    outcome.verificationStatus !== "verified" ? (
                      <button
                        type="button"
                        className="ui-button ui-button--primary"
                        disabled={actionState.reviewing === outcome.studentOutcomeId}
                        onClick={() => handleReview(outcome.studentOutcomeId)}
                      >
                        {actionState.reviewing === outcome.studentOutcomeId
                          ? "Reviewing..."
                          : "Mark coach reviewed"}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </SectionCard>
  );
}
