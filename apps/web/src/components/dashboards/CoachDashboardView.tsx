"use client";

import { AppShell } from "../layout/AppShell";
import { SectionCard } from "../layout/SectionCard";
import { KeyValueList } from "../layout/KeyValueList";
import { RequireRole } from "../RequireRole";
import { useApiData } from "../../hooks/useApiData";

export default function CoachDashboardView() {
  const auth = useApiData("/auth/me");
  const fixtures = useApiData("/v1/market/fixtures/validate");

  return (
    <AppShell title="Coach Dashboard" subtitle="Context inspection and market normalization diagnostics.">
      <RequireRole expectedRoles={["coach", "admin"]} fallbackTitle="Coach sign-in required">
        <SectionCard title="Resolved Context">
          <KeyValueList items={[
            { label: "Authenticated role", value: auth.data?.context?.authenticatedRoleType || "Unknown" },
            { label: "Household ID", value: auth.data?.context?.householdId || "None" },
            { label: "Student profile ID", value: auth.data?.context?.studentProfileId || "None" },
          ]} />
        </SectionCard>

        <SectionCard title="Fixture Validation">
          {fixtures.loading ? <p>Loading fixtures...</p> : null}
          {fixtures.error ? <p style={{ color: "crimson" }}>{fixtures.error}</p> : null}
          {!fixtures.loading && !fixtures.error ? (
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{JSON.stringify(fixtures.data, null, 2)}</pre>
          ) : null}
        </SectionCard>
      </RequireRole>
    </AppShell>
  );
}
