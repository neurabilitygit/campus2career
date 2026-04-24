"use client";

import { useState } from "react";
import { AppShell } from "../../../components/layout/AppShell";
import { SectionCard } from "../../../components/layout/SectionCard";
import { RequireRole } from "../../../components/RequireRole";
import { FieldInfoLabel } from "../../../components/forms/FieldInfoLabel";
import { apiFetch } from "../../../lib/apiClient";
import { useSaveNavigation } from "../../../lib/saveNavigation";

export default function OnboardingDeadlinesPage() {
  const saveNavigation = useSaveNavigation();
  const [title, setTitle] = useState("");
  const [deadlineType, setDeadlineType] = useState("internship_window");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function save() {
    setStatus("Saving your deadline...");
    setError("");
    try {
      await apiFetch("/students/me/deadlines", {
        method: "POST",
        body: JSON.stringify({
          title,
          dueDate,
          deadlineType,
          notes,
        }),
      });
      saveNavigation.returnAfterSave("/student");
    } catch (err: any) {
      setStatus("");
      setError(err?.message || String(err));
    }
  }

  return (
    <AppShell
      title="Add an important date"
      subtitle="One or two important dates are enough to make your plan much more concrete and time-aware."
    >
      <RequireRole expectedRoles={["student", "admin"]} fallbackTitle="Student sign-in required">
        <SectionCard
          title="Next date that matters"
          subtitle="Use this for internship windows, application deadlines, tests, or any decision point the plan should respect."
          tone="highlight"
        >
          <div style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <FieldInfoLabel
                label="What is this date for?"
                info="Name the milestone so the plan can anchor around it."
                example="Summer internship application deadline"
              />
              <input
                placeholder="What is this date for?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ borderRadius: 16, border: "1px solid rgba(73, 102, 149, 0.18)", padding: "12px 14px" }}
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <FieldInfoLabel
                label="Type of date"
                info="Choose the kind of milestone this is."
                example="Application due"
              />
              <select
                value={deadlineType}
                onChange={(e) => setDeadlineType(e.target.value)}
                style={{ borderRadius: 16, border: "1px solid rgba(73, 102, 149, 0.18)", padding: "12px 14px" }}
              >
                <option value="internship_window">Internship window</option>
                <option value="application_due">Application due</option>
                <option value="decision_point">Decision point</option>
                <option value="test_date">Test date</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <FieldInfoLabel
                label="Due date"
                info="Use the date you need to act by."
                example="2026-10-15"
              />
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={{ borderRadius: 16, border: "1px solid rgba(73, 102, 149, 0.18)", padding: "12px 14px" }}
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <FieldInfoLabel
                label="Notes"
                info="Add details worth remembering about this date."
                example="Need transcript and one recommender"
              />
              <textarea
                placeholder="Add any notes you or your family should remember"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                style={{ borderRadius: 16, border: "1px solid rgba(73, 102, 149, 0.18)", padding: "12px 14px" }}
              />
            </label>
            <button
              onClick={save}
              className="ui-button ui-button--primary"
            >
              Save and continue
            </button>
            {status ? <p style={{ margin: 0, color: "#155eef" }}>{status}</p> : null}
            {error ? <p style={{ margin: 0, color: "crimson" }}>{error}</p> : null}
          </div>
        </SectionCard>
      </RequireRole>
    </AppShell>
  );
}
