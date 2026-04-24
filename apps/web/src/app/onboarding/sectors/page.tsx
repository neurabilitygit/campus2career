"use client";

import { useState } from "react";
import { AppShell } from "../../../components/layout/AppShell";
import { SectionCard } from "../../../components/layout/SectionCard";
import { RequireRole } from "../../../components/RequireRole";
import { FieldInfoLabel } from "../../../components/forms/FieldInfoLabel";
import { apiFetch } from "../../../lib/apiClient";
import { useSaveNavigation } from "../../../lib/saveNavigation";

const sectors = [
  "Technology & Startups",
  "Fintech",
  "Management Consulting",
  "Finance & Financial Services",
  "Accounting, Audit & Risk",
  "Data & Analytics",
  "Cybersecurity",
  "Marketing & Growth",
  "Actuarial & Risk Analytics",
  "Law & Public Policy",
  "Healthcare",
  "Medicine & Clinical Care",
  "Nursing & Advanced Practice",
  "Pharmacy & Drug Development",
  "Allied Health & Rehabilitation",
  "Pharmaceutical, Biotech & Clinical Research",
  "Operations & Strategy"
];

export default function OnboardingSectorsPage() {
  const saveNavigation = useSaveNavigation();
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
      saveNavigation.returnAfterSave("/student?section=strategy");
    } catch (err: any) {
      setStatus("");
      setError(err?.message || String(err));
    }
  }

  return (
    <AppShell
      title="Choose starting career areas"
      subtitle="This gives the dashboard an initial direction. It does not lock you into a final path."
    >
      <RequireRole expectedRoles={["student", "admin"]} fallbackTitle="Student sign-in required">
        <SectionCard
          title="Pick a starting direction"
          subtitle="Choose the areas that feel closest right now. You can refine this later after seeing the score and role options."
          tone="highlight"
        >
          <div style={{ marginBottom: 14 }}>
            <FieldInfoLabel
              label="Career areas"
              info="Choose the broad areas that feel closest right now."
              example="Healthcare and Data & Analytics"
            />
          </div>
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
