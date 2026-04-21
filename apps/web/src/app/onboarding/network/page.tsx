"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../components/layout/AppShell";
import { SectionCard } from "../../../components/layout/SectionCard";
import { RequireRole } from "../../../components/RequireRole";
import { apiFetch } from "../../../lib/apiClient";

export default function OnboardingNetworkPage() {
  const router = useRouter();
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
      setStatus("Saved. Taking you to important dates...");
      startTransition(() => {
        router.push("/onboarding/deadlines");
      });
    } catch (err: any) {
      setStatus("");
      setError(err?.message || String(err));
    }
  }

  return (
    <AppShell
      title="Capture the current network"
      subtitle="This helps the platform spot warm-introduction opportunities and understand where the student already has support."
    >
      <RequireRole expectedRoles={["student", "admin"]} fallbackTitle="Student sign-in required">
        <SectionCard
          title="Relationship notes"
          subtitle="Use one line per person. A simple format works well: name, role, organization, and why they matter."
          tone="highlight"
        >
          <div style={{ display: "grid", gap: 14 }}>
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
            <div style={{ display: "grid", gap: 10 }}>
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
          </div>
        </SectionCard>
      </RequireRole>
    </AppShell>
  );
}
