"use client";

import { useState } from "react";
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
  const [selected, setSelected] = useState<string[]>([]);
  const [status, setStatus] = useState("");

  function toggle(value: string) {
    setSelected((curr) =>
      curr.includes(value) ? curr.filter((v) => v !== value) : [...curr, value]
    );
  }

  async function save() {
    setStatus("Saving...");
    try {
      const result = await apiFetch("/students/me/onboarding/cluster-selection", {
        method: "POST",
        body: JSON.stringify({
          sectorClusters: selected,
        }),
      });
      setStatus(`Saved: ${JSON.stringify(result)}`);
    } catch (err: any) {
      setStatus(`Error: ${err?.message || String(err)}`);
    }
  }

  return (
    <AppShell title="Onboarding: Sector Clusters">
      <RequireRole expectedRoles={["student", "admin"]} fallbackTitle="Student sign-in required">
        <SectionCard title="Choose initial sectors">
          <div style={{ display: "grid", gap: 8 }}>
            {sectors.map((sector) => (
              <label key={sector} style={{ display: "flex", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={selected.includes(sector)}
                  onChange={() => toggle(sector)}
                />
                <span>{sector}</span>
              </label>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <button onClick={save}>Save sectors</button>
            {status ? <p>{status}</p> : null}
          </div>
        </SectionCard>
      </RequireRole>
    </AppShell>
  );
}
