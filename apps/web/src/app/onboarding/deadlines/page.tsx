"use client";

import { useState } from "react";
import { AppShell } from "../../../components/layout/AppShell";
import { SectionCard } from "../../../components/layout/SectionCard";
import { RequireRole } from "../../../components/RequireRole";
import { apiFetch } from "../../../lib/apiClient";

export default function OnboardingDeadlinesPage() {
  const [title, setTitle] = useState("");
  const [deadlineType, setDeadlineType] = useState("internship_window");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");

  async function save() {
    setStatus("Saving...");
    try {
      const result = await apiFetch("/students/me/deadlines", {
        method: "POST",
        body: JSON.stringify({
          title,
          dueDate,
          deadlineType,
          notes,
        }),
      });
      setStatus(`Saved: ${JSON.stringify(result)}`);
    } catch (err: any) {
      setStatus(`Error: ${err?.message || String(err)}`);
    }
  }

  return (
    <AppShell title="Onboarding: Deadlines">
      <RequireRole expectedRoles={["student", "admin"]} fallbackTitle="Student sign-in required">
        <SectionCard title="Manual deadline entry">
          <div style={{ display: "grid", gap: 12 }}>
            <input placeholder="Deadline title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <select value={deadlineType} onChange={(e) => setDeadlineType(e.target.value)}>
              <option value="internship_window">Internship window</option>
              <option value="application_due">Application due</option>
              <option value="decision_point">Decision point</option>
              <option value="test_date">Test date</option>
            </select>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            <textarea placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
            <button onClick={save}>Add deadline</button>
            {status ? <p>{status}</p> : null}
          </div>
        </SectionCard>
      </RequireRole>
    </AppShell>
  );
}
