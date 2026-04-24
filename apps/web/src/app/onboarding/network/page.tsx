"use client";

import { useState } from "react";
import { AppShell } from "../../../components/layout/AppShell";
import { SectionCard } from "../../../components/layout/SectionCard";
import { RequireRole } from "../../../components/RequireRole";
import { FieldInfoLabel } from "../../../components/forms/FieldInfoLabel";
import { apiFetch } from "../../../lib/apiClient";
import { useSaveNavigation } from "../../../lib/saveNavigation";

export default function OnboardingNetworkPage() {
  const saveNavigation = useSaveNavigation();
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function save() {
    setStatus("Saving your network notes...");
    setError("");
    try {
      await apiFetch("/students/me/onboarding/network-baseline", {
        method: "POST",
        body: JSON.stringify({ notes }),
      });
      saveNavigation.returnAfterSave("/student?section=guidance");
    } catch (err: any) {
      setStatus("");
      setError(err?.message || String(err));
    }
  }

  return (
    <AppShell
      title="Capture helpful connections"
      subtitle="This is useful early, but it can stay lightweight. Even a few names help the platform suggest warmer next steps."
    >
      <RequireRole expectedRoles={["student", "admin"]} fallbackTitle="Student sign-in required">
        <SectionCard
          title="Relationship notes"
          subtitle="Use one line per person. A simple format works well: name, role, organization, and why they matter. You can add more later."
          tone="highlight"
        >
          <div style={{ display: "grid", gap: 14 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <FieldInfoLabel
                label="Relationship notes"
                info="List people who may offer advice, introductions, or context."
                example="Jordan Lee - family friend at Deloitte, open to a warm intro"
              />
              <textarea
                rows={10}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Jordan Lee - VP Finance, family friend, open to a warm introduction"
                style={{
                  width: "100%",
                  minHeight: 220,
                  borderRadius: 20,
                  border: "1px solid rgba(73, 102, 149, 0.18)",
                  padding: "16px 18px",
                  background: "rgba(255,255,255,0.82)",
                }}
              />
            </label>
            <div style={{ display: "grid", gap: 10 }}>
              <button
                onClick={save}
                className="ui-button ui-button--primary"
              >
                Save and continue
              </button>
              {status ? <p style={{ margin: 0, color: "#155eef" }}>{status}</p> : null}
              {error ? <p style={{ margin: 0, color: "crimson" }}>{error}</p> : null}
            </div>
          </div>
        </SectionCard>
      </RequireRole>
    </AppShell>
  );
}
