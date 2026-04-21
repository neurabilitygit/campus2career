"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../components/layout/AppShell";
import { SectionCard } from "../../../components/layout/SectionCard";
import { RequireRole } from "../../../components/RequireRole";
import { apiFetch } from "../../../lib/apiClient";

const sectors = [
  "Technology & Startups",
  "Fintech",
  "Management Consulting",
  "Finance & Financial Services",
  "Accounting, Audit & Risk",
  "Data & Analytics",
  "Healthcare",
  "Pharmaceutical, Biotech & Clinical Research",
  "Operations & Strategy"
];

export default function OnboardingSectorsPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  function toggle(value: string) {
    setSelected((curr) =>
      curr.includes(value) ? curr.filter((v) => v !== value) : [...curr, value]
    );
  }

  async function save() {
    setStatus("Saving your interests...");
    setError("");
    try {
      await apiFetch("/students/me/onboarding/cluster-selection", {
        method: "POST",
        body: JSON.stringify({
          sectorClusters: selected,
        }),
      });
      setStatus("Saved. Taking you to the document center...");
      startTransition(() => {
        router.push("/uploads");
      });
    } catch (err: any) {
      setStatus("");
      setError(err?.message || String(err));
    }
  }

  return (
    <AppShell
      title="Choose career interest areas"
      subtitle="This does not lock the student into a path. It simply tells the system where to begin when scoring and suggesting next moves."
    >
      <RequireRole expectedRoles={["student", "admin"]} fallbackTitle="Student sign-in required">
        <SectionCard
          title="Select the most relevant areas"
          subtitle="Pick a few that feel closest to the student’s current interests. You can always change them later."
          tone="highlight"
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 12,
            }}
          >
            {sectors.map((sector) => (
              <label
                key={sector}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  padding: "14px 16px",
                  borderRadius: 18,
                  background: selected.includes(sector) ? "#eef6ff" : "rgba(255,255,255,0.78)",
                  border: `1px solid ${selected.includes(sector) ? "#bfd8ff" : "rgba(73, 102, 149, 0.12)"}`,
                  boxShadow: selected.includes(sector) ? "0 12px 26px rgba(21, 94, 239, 0.08)" : "none",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(sector)}
                  onChange={() => toggle(sector)}
                  style={{ marginTop: 3 }}
                />
                <span>{sector}</span>
              </label>
            ))}
          </div>

          <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
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
