"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../components/layout/AppShell";
import { SectionCard } from "../../../components/layout/SectionCard";
import { RequireRole } from "../../../components/RequireRole";
import { apiFetch } from "../../../lib/apiClient";

export default function OnboardingDeadlinesPage() {
  const router = useRouter();
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
      setStatus("Saved. Taking you to the student dashboard...");
      startTransition(() => {
        router.push("/student");
      });
    } catch (err: any) {
      setStatus("");
      setError(err?.message || String(err));
    }
  }

  return (
    <AppShell
      title="Add an important date"
      subtitle="A few well-chosen deadlines make the student plan much more concrete and time-aware."
    >
      <RequireRole expectedRoles={["student", "admin"]} fallbackTitle="Student sign-in required">
        <SectionCard
          title="Deadline details"
          subtitle="Use this for internship windows, application deadlines, tests, or any decision point you want the student plan to respect."
          tone="highlight"
        >
          <div style={{ display: "grid", gap: 12 }}>
            <input
              placeholder="What is this date for?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ borderRadius: 16, border: "1px solid rgba(73, 102, 149, 0.18)", padding: "12px 14px" }}
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
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={{ borderRadius: 16, border: "1px solid rgba(73, 102, 149, 0.18)", padding: "12px 14px" }}
            />
            <textarea
              placeholder="Add any notes the student or parent should remember"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              style={{ borderRadius: 16, border: "1px solid rgba(73, 102, 149, 0.18)", padding: "12px 14px" }}
            />
            <button
              onClick={save}
              style={{
                width: "fit-content",
                border: "none",
                borderRadius: 999,
                padding: "13px 18px",
                background: "linear-gradient(135deg, #155eef, #16a3ff)",
                color: "#ffffff",
                fontWeight: 800,
              }}
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
