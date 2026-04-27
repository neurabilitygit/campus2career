"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  StudentActionPlanDecision,
  StudentActionPlanOption,
  StudentActionPlanResponse,
} from "../../../../../packages/shared/src/contracts/actionPlan";
import { useApiData } from "../../hooks/useApiData";
import { useAuthContext } from "../../hooks/useAuthContext";
import { apiFetch } from "../../lib/apiClient";
import { SectionCard } from "../layout/SectionCard";

type DraftState = {
  decision: StudentActionPlanDecision | null;
  planningNotes: string;
  nextStepDate: string;
};

function badgeCopy(sourceKind: StudentActionPlanOption["sourceKind"]) {
  if (sourceKind === "recommendation") return "Recommended action";
  if (sourceKind === "risk") return "Risk to address";
  if (sourceKind === "requirement_gap") return "Requirement follow-up";
  return "Saved plan item";
}

function dueLabel(value: StudentActionPlanOption["dueStatus"]) {
  if (value === "overdue") return "Overdue";
  if (value === "due_soon") return "Due soon";
  if (value === "scheduled") return "Scheduled";
  return null;
}

function decisionLabel(value: StudentActionPlanDecision) {
  if (value === "ignore") return "Ignore";
  if (value === "explore") return "Explore";
  return "Accept";
}

export function StudentActionPlanSection(props: {
  mode: "student" | "parent";
  subjectLabel: string;
  title?: string;
  subtitle?: string;
}) {
  const auth = useAuthContext();
  const plan = useApiData<StudentActionPlanResponse>("/students/me/action-plan", true);
  const canEdit = auth.data?.context?.effectiveCapabilities?.includes("edit_student_profile") || false;
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, { error?: string; success?: string }>>({});

  useEffect(() => {
    const options = plan.data?.plan.options || [];
    const nextDrafts: Record<string, DraftState> = {};
    const nextExpanded: Record<string, boolean> = {};
    for (const option of options) {
      nextDrafts[option.actionKey] = {
        decision: option.decision,
        planningNotes: option.planningNotes || "",
        nextStepDate: option.nextStepDate || "",
      };
      if (option.planningNotes || option.nextStepDate || option.decision === "accept" || option.decision === "explore") {
        nextExpanded[option.actionKey] = true;
      }
    }
    setDrafts(nextDrafts);
    setExpanded(nextExpanded);
  }, [plan.data?.plan.options]);

  const selectedTitles = plan.data?.plan.summary.selectedTitles || [];
  const alertCopy = useMemo(() => {
    const summary = plan.data?.plan.summary;
    if (!summary) return null;
    if (summary.overdueCount > 0) {
      return `${summary.overdueCount} action ${summary.overdueCount === 1 ? "is" : "are"} overdue and should be revisited now.`;
    }
    if (summary.dueSoonCount > 0) {
      return `${summary.dueSoonCount} action ${summary.dueSoonCount === 1 ? "is" : "are"} due soon.`;
    }
    if (summary.acceptedCount || summary.exploredCount) {
      return `${summary.acceptedCount} accepted and ${summary.exploredCount} exploring action${summary.acceptedCount + summary.exploredCount === 1 ? "" : "s"} are shaping the current student plan.`;
    }
    return null;
  }, [plan.data?.plan.summary]);

  async function saveOption(option: StudentActionPlanOption) {
    const draft = drafts[option.actionKey];
    if (!draft?.decision) {
      setMessages((current) => ({
        ...current,
        [option.actionKey]: { error: "Choose Ignore, Explore, or Accept first." },
      }));
      return;
    }

    if ((draft.decision === "accept" || draft.decision === "explore") && !draft.nextStepDate) {
      setMessages((current) => ({
        ...current,
        [option.actionKey]: { error: "Choose a next-step date so this action can be tracked." },
      }));
      return;
    }

    setSavingKey(option.actionKey);
    setMessages((current) => ({ ...current, [option.actionKey]: {} }));
    try {
      await apiFetch("/students/me/action-plan", {
        method: "POST",
        body: JSON.stringify({
          title: option.title,
          decision: draft.decision,
          planningNotes: draft.planningNotes.trim() || null,
          nextStepDate: draft.decision === "ignore" ? null : draft.nextStepDate || null,
          actionCategory: option.actionCategory,
          priorityLevel: option.priorityLevel,
        }),
      });
      setMessages((current) => ({
        ...current,
        [option.actionKey]: { success: "Action plan updated." },
      }));
      await plan.refresh();
    } catch (error: any) {
      setMessages((current) => ({
        ...current,
        [option.actionKey]: { error: error?.message || "Could not update the action plan." },
      }));
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <SectionCard
      title={props.title || "Student action plan"}
      subtitle={
        props.subtitle ||
        (props.mode === "student"
          ? "Choose whether to ignore, explore, or accept each next step, then assign a next-step date so progress can be tracked."
          : `See how ${props.subjectLabel} is responding to the current next-step recommendations and which actions now anchor the shared plan.`)
      }
    >
      {plan.loading ? <p>Loading action plan...</p> : null}
      {plan.error ? <p style={{ color: "crimson" }}>{plan.error}</p> : null}
      {!plan.loading && !plan.error ? (
        <div style={{ display: "grid", gap: 16 }}>
          {alertCopy ? (
            <div
              style={{
                border: "1px solid #dbe4f0",
                borderRadius: 16,
                padding: "14px 16px",
                background: "#f8fbff",
                color: "#334155",
                lineHeight: 1.6,
              }}
            >
              {alertCopy}
            </div>
          ) : null}

          {selectedTitles.length ? (
            <div style={{ display: "grid", gap: 8 }}>
              <strong>Currently shaping the plan</strong>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {selectedTitles.map((title) => (
                  <span
                    key={title}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 12px",
                      borderRadius: 999,
                      background: "rgba(15, 118, 110, 0.08)",
                      border: "1px solid rgba(15, 118, 110, 0.18)",
                      color: "#0f766e",
                      fontWeight: 700,
                    }}
                  >
                    {title}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {(plan.data?.plan.options || []).map((option) => {
            const draft = drafts[option.actionKey] || {
              decision: option.decision,
              planningNotes: option.planningNotes || "",
              nextStepDate: option.nextStepDate || "",
            };
            const message = messages[option.actionKey];
            const currentDueLabel = dueLabel(option.dueStatus);
            const showPlanningPanel =
              expanded[option.actionKey] || draft.decision === "accept" || draft.decision === "explore";

            return (
              <div
                key={option.actionKey}
                data-testid="action-plan-option"
                data-action-key={option.actionKey}
                style={{
                  display: "grid",
                  gap: 14,
                  padding: 16,
                  borderRadius: 18,
                  border: "1px solid #dbe4f0",
                  background: option.isCurrentRecommendation ? "#fff" : "#fbfdff",
                }}
              >
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "6px 10px",
                        borderRadius: 999,
                        background: "#eef4ff",
                        color: "#22456f",
                        fontSize: 12,
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {badgeCopy(option.sourceKind)}
                    </span>
                    {currentDueLabel ? (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "6px 10px",
                          borderRadius: 999,
                          background:
                            option.dueStatus === "overdue"
                              ? "rgba(185, 28, 28, 0.1)"
                              : option.dueStatus === "due_soon"
                                ? "rgba(180, 83, 9, 0.1)"
                                : "rgba(34, 69, 111, 0.08)",
                          color:
                            option.dueStatus === "overdue"
                              ? "#b91c1c"
                              : option.dueStatus === "due_soon"
                                ? "#b45309"
                                : "#22456f",
                          fontSize: 12,
                          fontWeight: 800,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {currentDueLabel}
                      </span>
                    ) : null}
                  </div>
                  <strong data-testid="action-plan-option-title" style={{ fontSize: 18 }}>
                    {option.title}
                  </strong>
                  {option.description ? (
                    <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>{option.description}</p>
                  ) : null}
                  {option.rationale ? (
                    <p style={{ margin: 0, color: "#22456f", lineHeight: 1.6 }}>
                      Why this matters now: {option.rationale}
                    </p>
                  ) : null}
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {(["ignore", "explore", "accept"] as StudentActionPlanDecision[]).map((decision) => {
                    const checked = draft.decision === decision;
                    return (
                      <label
                        key={decision}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "10px 12px",
                          borderRadius: 14,
                          border: checked ? "1px solid #173d6b" : "1px solid #d0d8e8",
                          background: checked ? "#eef4ff" : "#fff",
                          color: "#183153",
                          fontWeight: 700,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!canEdit}
                          onChange={() =>
                            setDrafts((current) => ({
                              ...current,
                              [option.actionKey]: {
                                ...draft,
                                decision,
                                nextStepDate: decision === "ignore" ? "" : draft.nextStepDate,
                              },
                            }))
                          }
                        />
                        {decisionLabel(decision)}
                      </label>
                    );
                  })}
                </div>

                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <button
                    type="button"
                    className="ui-button ui-button--secondary"
                    onClick={() =>
                      setExpanded((current) => ({
                        ...current,
                        [option.actionKey]: !current[option.actionKey],
                      }))
                    }
                  >
                    {showPlanningPanel ? "Hide next-step stub" : "Plan this step"}
                  </button>
                  {option.nextStepDate ? (
                    <span style={{ color: "#52657d" }}>Next step date: {option.nextStepDate}</span>
                  ) : null}
                </div>

                {showPlanningPanel ? (
                  <div style={{ display: "grid", gap: 12 }}>
                    <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
                      How to act on this
                      <textarea
                        rows={3}
                        value={draft.planningNotes}
                        disabled={!canEdit}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [option.actionKey]: {
                              ...draft,
                              planningNotes: event.target.value,
                            },
                          }))
                        }
                        placeholder="Stub: sketch the first conversation, deliverable, research step, or outreach move that would make this action real."
                        style={{
                          borderRadius: 12,
                          border: "1px solid #d0d8e8",
                          padding: "12px 14px",
                          fontFamily: "inherit",
                          width: "100%",
                        }}
                      />
                    </label>
                    <label style={{ display: "grid", gap: 6, fontWeight: 600, maxWidth: 240 }}>
                      Next-step date
                      <input
                        type="date"
                        value={draft.nextStepDate}
                        disabled={!canEdit || draft.decision === "ignore"}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [option.actionKey]: {
                              ...draft,
                              nextStepDate: event.target.value,
                            },
                          }))
                        }
                        style={{
                          borderRadius: 12,
                          border: "1px solid #d0d8e8",
                          padding: "12px 14px",
                        }}
                      />
                    </label>
                  </div>
                ) : null}

                {canEdit ? (
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    <button
                      type="button"
                      className="ui-button ui-button--primary"
                      disabled={savingKey === option.actionKey}
                      onClick={() => void saveOption(option)}
                    >
                      {savingKey === option.actionKey ? "Saving…" : "Save action choice"}
                    </button>
                    {message?.success ? <span style={{ color: "#0f766e" }}>{message.success}</span> : null}
                    {message?.error ? <span style={{ color: "crimson" }}>{message.error}</span> : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </SectionCard>
  );
}
