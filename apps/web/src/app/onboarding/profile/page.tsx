"use client";

import { useState } from "react";
import { AppShell } from "../../../components/layout/AppShell";
import { SectionCard } from "../../../components/layout/SectionCard";
import { RequireRole } from "../../../components/RequireRole";
import { apiFetch } from "../../../lib/apiClient";

export default function OnboardingProfilePage() {
  const [form, setForm] = useState({
    schoolName: "",
    expectedGraduationDate: "",
    majorPrimary: "",
    majorSecondary: "",
    preferredGeographies: "",
    careerGoalSummary: "",
  });
  const [status, setStatus] = useState<string>("");

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setStatus("Saving...");
    try {
      const result = await apiFetch("/students/me/profile", {
        method: "POST",
        body: JSON.stringify({
          schoolName: form.schoolName,
          expectedGraduationDate: form.expectedGraduationDate,
          majorPrimary: form.majorPrimary,
          majorSecondary: form.majorSecondary,
          preferredGeographies: form.preferredGeographies
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          careerGoalSummary: form.careerGoalSummary,
        }),
      });
      setStatus(`Saved: ${JSON.stringify(result)}`);
    } catch (err: any) {
      setStatus(`Error: ${err?.message || String(err)}`);
    }
  }

  return (
    <AppShell title="Onboarding: Student Profile">
      <RequireRole expectedRoles={["student", "admin"]} fallbackTitle="Student sign-in required">
        <SectionCard title="Core profile">
          <div style={{ display: "grid", gap: 12 }}>
            <input placeholder="School name" value={form.schoolName} onChange={(e) => update("schoolName", e.target.value)} />
            <input type="date" placeholder="Expected graduation date" value={form.expectedGraduationDate} onChange={(e) => update("expectedGraduationDate", e.target.value)} />
            <input placeholder="Primary major" value={form.majorPrimary} onChange={(e) => update("majorPrimary", e.target.value)} />
            <input placeholder="Secondary major or minor" value={form.majorSecondary} onChange={(e) => update("majorSecondary", e.target.value)} />
            <input placeholder="Preferred geographies, comma-separated" value={form.preferredGeographies} onChange={(e) => update("preferredGeographies", e.target.value)} />
            <textarea placeholder="Career goal summary" value={form.careerGoalSummary} onChange={(e) => update("careerGoalSummary", e.target.value)} rows={5} />
            <button onClick={save}>Save profile</button>
            {status ? <p>{status}</p> : null}
          </div>
        </SectionCard>
      </RequireRole>
    </AppShell>
  );
}
