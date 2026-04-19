"use client";

import { useState } from "react";
import { AppShell } from "../../../components/layout/AppShell";
import { SectionCard } from "../../../components/layout/SectionCard";
import { RequireRole } from "../../../components/RequireRole";
import { apiFetch } from "../../../lib/apiClient";

export default function OnboardingNetworkPage() {
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");

  async function save() {
    setStatus("Saving...");
    try {
      const result = await apiFetch("/students/me/onboarding/network-baseline", {
        method: "POST",
        body: JSON.stringify({ notes }),
      });
      setStatus(`Saved: ${JSON.stringify(result)}`);
    } catch (err: any) {
      setStatus(`Error: ${err?.message || String(err)}`);
    }
  }

  return (
    <AppShell title="Onboarding: Network Baseline">
      <RequireRole expectedRoles={["student", "admin"]} fallbackTitle="Student sign-in required">
        <SectionCard title="Initial network inventory">
          <p>Use one line per contact. Format: Name - role, organization, notes.</p>
          <textarea rows={10} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Jordan Lee - VP Finance, family friend, warm intro candidate" />
          <div style={{ marginTop: 16 }}>
            <button onClick={save}>Save network baseline</button>
            {status ? <p>{status}</p> : null}
          </div>
        </SectionCard>
      </RequireRole>
    </AppShell>
  );
}
