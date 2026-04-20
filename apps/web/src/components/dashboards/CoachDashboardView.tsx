"use client";

import { AppShell } from "../layout/AppShell";
import { SectionCard } from "../layout/SectionCard";
import { KeyValueList } from "../layout/KeyValueList";
import { RequireRole } from "../RequireRole";
import { useApiData } from "../../hooks/useApiData";

type MappingDiagnosticsResponse = {
  ok?: boolean;
  mappingCount?: number;
  mappings?: Array<{
    canonicalName: string;
    onetCode: string | null;
    description: string | null;
    jobZone: number | null;
    skillCount: number;
    topSkills: string[];
  }>;
};

export default function CoachDashboardView() {
  const auth = useApiData("/auth/me");
  const mappings = useApiData<MappingDiagnosticsResponse>("/v1/market/diagnostics/role-mappings");
  const fixtures = useApiData("/v1/market/fixtures/validate");

  return (
    <AppShell title="Coach Dashboard" subtitle="Inspect market role mappings, imported skill coverage, and normalization diagnostics.">
      <RequireRole expectedRoles={["coach", "admin"]} fallbackTitle="Coach sign-in required">
        <SectionCard title="Resolved Context">
          <KeyValueList items={[
            { label: "Authenticated role", value: auth.data?.context?.authenticatedRoleType || "Unknown" },
            { label: "Household ID", value: auth.data?.context?.householdId || "None" },
            { label: "Student profile ID", value: auth.data?.context?.studentProfileId || "None" },
            { label: "Imported role mappings", value: mappings.data?.mappingCount ?? "Unknown" },
          ]} />
        </SectionCard>

        <SectionCard title="Canonical Role Mapping Inspector">
          <p style={{ marginTop: 0, color: "#475569", lineHeight: 1.6 }}>
            This view shows which O*NET occupation each canonical application role is currently tied to, along with
            job zone and visible skill coverage. It is the fastest way to spot bad surrogate mappings after an import.
          </p>
          {mappings.loading ? <p>Loading role mappings...</p> : null}
          {mappings.error ? <p style={{ color: "crimson" }}>{mappings.error}</p> : null}
          {!mappings.loading && !mappings.error ? (
            <div style={{ display: "grid", gap: 14 }}>
              {(mappings.data?.mappings || []).map((mapping) => (
                <div
                  key={mapping.canonicalName}
                  style={{
                    border: "1px solid #dbe4f0",
                    borderRadius: 16,
                    padding: 16,
                    background: "#fbfdff",
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 16,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "grid", gap: 6 }}>
                      <strong style={{ fontSize: 18 }}>{mapping.canonicalName}</strong>
                      <span style={{ color: "#475569", lineHeight: 1.5 }}>
                        {mapping.description || "No description available."}
                      </span>
                    </div>
                    <div
                      style={{
                        padding: "8px 12px",
                        borderRadius: 999,
                        background: mapping.skillCount > 0 ? "#dcfce7" : "#fee2e2",
                        color: mapping.skillCount > 0 ? "#166534" : "#991b1b",
                        fontWeight: 800,
                      }}
                    >
                      {mapping.skillCount} skills
                    </div>
                  </div>

                  <KeyValueList
                    items={[
                      { label: "O*NET-SOC code", value: mapping.onetCode || "Unmapped" },
                      { label: "Job zone", value: mapping.jobZone ?? "Unknown" },
                      {
                        label: "Top imported skills",
                        value: mapping.topSkills.length ? mapping.topSkills.join(", ") : "None imported",
                      },
                    ]}
                  />
                </div>
              ))}
            </div>
          ) : null}
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
