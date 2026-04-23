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
  const mappings = useApiData<MappingDiagnosticsResponse>("/v1/market/diagnostics/role-mappings");
  const fixtures = useApiData("/v1/market/fixtures/validate");
  const mappingItems = mappings.data?.mappings || [];
  const unmappedCount = mappingItems.filter((mapping) => !mapping.onetCode).length;
  const missingSkillCount = mappingItems.filter((mapping) => mapping.skillCount === 0).length;
  const mainRisk = unmappedCount
    ? `${unmappedCount} role ${unmappedCount === 1 ? "mapping is" : "mappings are"} missing an O*NET link.`
    : missingSkillCount
      ? `${missingSkillCount} role ${missingSkillCount === 1 ? "mapping has" : "mappings have"} no visible skill coverage.`
      : fixtures.error
        ? "Fixture validation needs attention."
        : "No major mapping risk is showing right now.";
  const nextAction = unmappedCount
    ? "Review unmapped roles first."
    : missingSkillCount
      ? "Review roles with zero imported skills."
      : fixtures.error
        ? "Open the validation details and confirm the failing checks."
        : "Spot-check a few high-priority role mappings before relying on new scores.";
  const sortedMappings = mappingItems.slice().sort((left, right) => {
    const leftPriority = (left.onetCode ? 0 : 2) + (left.skillCount === 0 ? 1 : 0);
    const rightPriority = (right.onetCode ? 0 : 2) + (right.skillCount === 0 ? 1 : 0);
    return rightPriority - leftPriority;
  });

  return (
    <AppShell
      title="Coach dashboard"
      subtitle="Review role coverage, market mapping quality, and the checks that support trustworthy scoring."
    >
      <RequireRole expectedRoles={["coach", "admin"]} fallbackTitle="Coach sign-in required">
        <SectionCard
          title="Current platform picture"
          subtitle="Start here before drilling into mapping details."
          tone="highlight"
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            {[
              {
                label: "Current status",
                value: fixtures.loading ? "Checking" : fixtures.error ? "Needs attention" : "Healthy",
                detail: `${mappings.data?.mappingCount ?? "Unknown"} mapped role paths loaded`,
              },
              {
                label: "Main risk",
                value: mainRisk,
                detail: "The most important thing to review before trusting edge-case scoring",
              },
              {
                label: "Next review action",
                value: nextAction,
                detail: "Fastest next check",
              },
              {
                label: "Evidence still missing",
                value: unmappedCount || missingSkillCount
                  ? `${unmappedCount} unmapped, ${missingSkillCount} without visible skills`
                  : "No major mapping coverage gap",
                detail: "Coverage gaps surfaced from current imports",
              },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  border: "1px solid rgba(73, 102, 149, 0.12)",
                  borderRadius: 16,
                  padding: 16,
                  background: "#ffffff",
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ color: "#5f728a", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.05 }}>
                  {item.label}
                </div>
                <div style={{ fontWeight: 800, lineHeight: 1.45 }}>{item.value}</div>
                <div style={{ color: "#52657d", fontSize: 14, lineHeight: 1.5 }}>{item.detail}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Role mappings to review"
          subtitle="The highest-risk mappings surface first so you can quickly spot missing links or thin skill coverage."
        >
          <p style={{ marginTop: 0, color: "#475569", lineHeight: 1.6 }}>
            This view shows which O*NET occupation each application role is currently tied to, along with job zone and visible skill coverage.
          </p>
          {mappings.loading ? <p>Loading role mappings...</p> : null}
          {mappings.error ? <p style={{ color: "crimson" }}>{mappings.error}</p> : null}
          {!mappings.loading && !mappings.error ? (
            <div style={{ display: "grid", gap: 14 }}>
              {sortedMappings.map((mapping) => (
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

        <SectionCard
          title="Validation details"
          subtitle="These checks help confirm that market fixtures and derived scoring inputs still behave the way the app expects."
          tone="quiet"
        >
          {fixtures.loading ? <p>Loading fixtures...</p> : null}
          {fixtures.error ? <p style={{ color: "crimson" }}>{fixtures.error}</p> : null}
          {!fixtures.loading && !fixtures.error ? (
            <details
              style={{
                borderRadius: 18,
                padding: "14px 16px",
                background: "rgba(255,255,255,0.82)",
                border: "1px solid rgba(73, 102, 149, 0.12)",
              }}
            >
              <summary style={{ fontWeight: 800 }}>Open validation payload</summary>
              <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", marginBottom: 0 }}>
                {JSON.stringify(fixtures.data, null, 2)}
              </pre>
            </details>
          ) : null}
        </SectionCard>
      </RequireRole>
    </AppShell>
  );
}
