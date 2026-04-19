"use client";

import { useState } from "react";
import { AppShell } from "../layout/AppShell";
import { SectionCard } from "../layout/SectionCard";
import { KeyValueList } from "../layout/KeyValueList";
import { RequireRole } from "../RequireRole";
import { useApiData } from "../../hooks/useApiData";
import { apiFetch } from "../../lib/apiClient";

export default function ParentDashboardView() {
  const auth = useApiData("/auth/me");
  const [briefRefresh, setBriefRefresh] = useState(0);
  const [generateBusy, setGenerateBusy] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const brief = useApiData("/v1/briefs/live", true, briefRefresh);

  async function generateBrief() {
    setGenerateError(null);
    setGenerateBusy(true);
    try {
      await apiFetch("/v1/briefs/generate", { method: "POST", body: "{}" });
      setBriefRefresh((n) => n + 1);
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerateBusy(false);
    }
  }

  return (
    <AppShell title="Parent Dashboard" subtitle="Monthly guidance, trajectory view, and recommended parent actions.">
      <RequireRole expectedRoles={["parent", "admin"]} fallbackTitle="Parent sign-in required">
        <SectionCard title="Resolved Context">
          <KeyValueList items={[
            { label: "Authenticated role", value: auth.data?.context?.authenticatedRoleType || "Unknown" },
            { label: "Household ID", value: auth.data?.context?.householdId || "None" },
            { label: "Student profile ID", value: auth.data?.context?.studentProfileId || "None" },
          ]} />
        </SectionCard>

        <SectionCard title="Parent brief (this reporting month)">
          <p style={{ marginTop: 0, color: "#444", fontSize: 14 }}>
            Persisted brief for the current reporting month (env <code>BRIEF_MONTH_TZ</code>, default UTC). Generate creates or overwrites this month&apos;s row.
          </p>
          <button type="button" onClick={() => void generateBrief()} disabled={generateBusy}>
            {generateBusy ? "Generating…" : "Generate / refresh this month"}
          </button>
          {generateError ? <p style={{ color: "crimson" }}>{generateError}</p> : null}
          {brief.loading ? <p>Loading brief...</p> : null}
          {brief.error ? <p style={{ color: "crimson" }}>{brief.error}</p> : null}
          {!brief.loading && !brief.error ? (
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{JSON.stringify(brief.data, null, 2)}</pre>
          ) : null}
        </SectionCard>
      </RequireRole>
    </AppShell>
  );
}
