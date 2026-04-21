"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../layout/AppShell";
import { SectionCard } from "../layout/SectionCard";
import { KeyValueList } from "../layout/KeyValueList";
import { RequireRole } from "../RequireRole";
import { useApiData, useApiJsonPost } from "../../hooks/useApiData";
import { listTargetRoleOptions } from "../../../../../packages/shared/src/market/targetRoleSeeds";

const DEFAULT_SCENARIO_QUESTION =
  "What if I keep my current major but focus this semester on the highest-signal gap-closing actions?";

type StructuredScenarioResponse = {
  mode: "llm" | "fallback";
  headline: string;
  summary: string;
  whyThisMattersNow: string;
  recommendedActions: Array<{
    title: string;
    rationale: string;
    timeframe: string;
  }>;
  risksToWatch: string[];
  encouragement: string;
  basedOn: string[];
  providerError?: string;
};

type ScoringPayload = {
  targetRoleFamily?: string;
  targetSectorCluster?: string;
  trajectoryStatus?: string;
  overallScore?: number;
  subScores?: Record<string, number>;
  topRisks?: string[];
  topStrengths?: string[];
  recommendations?: Array<{
    title: string;
    description?: string;
    whyThisMatchesStudent?: string;
  }>;
  skillGaps?: Array<{
    skillName: string;
    gapSeverity: string;
    evidenceSummary?: string;
  }>;
};

type ScoringInputPayload = {
  occupationMetadata?: {
    onetCode?: string;
    jobZone?: number;
    description?: string;
  };
  marketSignals?: Array<{
    signalType: string;
    signalValue?: number;
    signalDirection?: string;
    sourceName: string;
    effectiveDate: string;
    confidenceLevel?: string;
    scope: "role" | "macro";
  }>;
  occupationSkills?: Array<{
    skillName: string;
    importanceScore: number;
    requiredProficiencyBand: string;
  }>;
  transcript?: {
    parsedStatus?: string;
    transcriptSummary?: string;
    termCount: number;
    courseCount: number;
    completedCourseCount: number;
    matchedCatalogCourseCount: number;
    unmatchedCourseCount: number;
    creditsEarned: number;
  };
  requirementProgress?: {
    boundToCatalog: boolean;
    institutionDisplayName?: string;
    catalogLabel?: string;
    degreeType?: string;
    programName?: string;
    majorDisplayName?: string;
    requirementSetDisplayName?: string;
    totalRequirementItems: number;
    satisfiedRequirementItems: number;
    totalRequirementGroups: number;
    satisfiedRequirementGroups: number;
    creditsApplied: number;
    totalCreditsRequired?: number;
    completionPercent: number;
    missingRequiredCourses: string[];
    inferredConfidence: "low" | "medium" | "high";
  };
};

type ScoringResponse = {
  scoring?: ScoringPayload;
  scoringInput?: ScoringInputPayload;
  comparison?: {
    scoring?: ScoringPayload;
    scoringInput?: ScoringInputPayload;
    deltaOverallScore?: number;
    deltaSubScores?: Record<string, number>;
  } | null;
  resolvedContext?: {
    authenticatedRoleType?: string;
    studentProfileId?: string | null;
    householdId?: string | null;
  };
};

type ScenarioResponse = {
  response?: StructuredScenarioResponse;
  resolvedContext?: {
    authenticatedRoleType?: string;
    studentProfileId?: string | null;
    householdId?: string | null;
  };
};

function titleCase(value: string | undefined | null): string {
  if (!value) return "Unknown";
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDelta(value: number | undefined): string {
  if (typeof value !== "number") return "Unknown";
  if (value === 0) return "No change";
  return `${value > 0 ? "+" : ""}${value}`;
}

function scoreLabel(score: number | undefined): string {
  if (typeof score !== "number") return "Unknown";
  if (score >= 75) return "Strong";
  if (score >= 55) return "Developing";
  return "Weak";
}

function academicBindingLabel(
  requirementProgress: ScoringInputPayload["requirementProgress"] | undefined
): string {
  if (!requirementProgress) {
    return "Not bound";
  }

  if (requirementProgress.boundToCatalog) {
    return "Bound";
  }

  if (requirementProgress.institutionDisplayName || requirementProgress.catalogLabel || requirementProgress.majorDisplayName) {
    return "Assignment saved, requirements pending";
  }

  return "Not bound";
}

const roleOptions = listTargetRoleOptions();

export default function StudentDashboardView() {
  const auth = useApiData("/auth/me");
  const [selectedRole, setSelectedRole] = useState("");
  const [compareRole, setCompareRole] = useState("");
  const [draftQuestion, setDraftQuestion] = useState(DEFAULT_SCENARIO_QUESTION);
  const [draftStyle, setDraftStyle] = useState("direct");
  const [applied, setApplied] = useState({
    scenarioQuestion: DEFAULT_SCENARIO_QUESTION,
    communicationStyle: "direct",
  });
  const [requestedScenario, setRequestedScenario] = useState(false);

  const scoringBody = useMemo(
    () => ({
      ...(selectedRole ? { targetRoleFamily: selectedRole } : {}),
      ...(compareRole ? { compareToRoleFamily: compareRole } : {}),
    }),
    [selectedRole, compareRole]
  );

  const scoring = useApiJsonPost<ScoringResponse>("/students/me/scoring/preview", scoringBody, true);

  useEffect(() => {
    const resolvedRole = scoring.data?.scoring?.targetRoleFamily;
    if (!selectedRole && resolvedRole) {
      setSelectedRole(resolvedRole);
    }
  }, [scoring.data?.scoring?.targetRoleFamily, selectedRole]);

  const scenarioBody = useMemo(
    () => ({
      scenarioQuestion: applied.scenarioQuestion,
      communicationStyle: applied.communicationStyle,
      ...(selectedRole ? { targetRoleFamily: selectedRole } : {}),
      ...(scoring.data?.scoring?.targetSectorCluster
        ? { targetSectorCluster: scoring.data.scoring.targetSectorCluster }
        : {}),
    }),
    [applied.communicationStyle, applied.scenarioQuestion, scoring.data?.scoring?.targetSectorCluster, selectedRole]
  );

  const scenario = useApiJsonPost<ScenarioResponse>("/v1/chat/scenario/live", scenarioBody, requestedScenario);
  const marketSignals = scoring.data?.scoringInput?.marketSignals || [];
  const topOccupationSkills = scoring.data?.scoringInput?.occupationSkills?.slice(0, 8) || [];
  const transcript = scoring.data?.scoringInput?.transcript;
  const requirementProgress = scoring.data?.scoringInput?.requirementProgress;
  const comparison = scoring.data?.comparison;
  const hasAssignmentWithoutRequirements =
    !!requirementProgress &&
    !requirementProgress.boundToCatalog &&
    !!(
      requirementProgress.institutionDisplayName ||
      requirementProgress.catalogLabel ||
      requirementProgress.majorDisplayName
    );

  return (
    <AppShell title="Student Dashboard" subtitle="Scoring, academic progress, market inputs, and role-specific guidance.">
      <RequireRole expectedRoles={["student", "admin"]} fallbackTitle="Student sign-in required">
        <SectionCard title="Resolved Context">
          <KeyValueList items={[
            { label: "Authenticated role", value: auth.data?.context?.authenticatedRoleType || "Unknown" },
            { label: "Student profile ID", value: auth.data?.context?.studentProfileId || "None" },
            { label: "Household ID", value: auth.data?.context?.householdId || "None" },
          ]} />
        </SectionCard>

        <SectionCard title="Target Job Selection">
          <div style={{ display: "grid", gap: 16 }}>
            <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>
              Choose the specific job path you want the system to score. You can also compare your current path against a second target to see how the score changes.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 14,
              }}
            >
              <label style={{ display: "grid", gap: 6 }}>
                <span>Primary target job</span>
                <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
                  <option value="">Use default inferred target</option>
                  {roleOptions.map((option) => (
                    <option key={option.canonicalName} value={option.canonicalName}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span>Compare against</span>
                <select value={compareRole} onChange={(e) => setCompareRole(e.target.value)}>
                  <option value="">No comparison</option>
                  {roleOptions
                    .filter((option) => option.canonicalName !== selectedRole)
                    .map((option) => (
                      <option key={option.canonicalName} value={option.canonicalName}>
                        {option.label}
                      </option>
                    ))}
                </select>
              </label>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Score Summary">
          {scoring.loading ? <p>Loading scoring...</p> : null}
          {scoring.error ? <p style={{ color: "crimson" }}>{scoring.error}</p> : null}
          {!scoring.loading && !scoring.error ? (
            <div style={{ display: "grid", gap: 16 }}>
              <KeyValueList
                items={[
                  { label: "Target role", value: titleCase(scoring.data?.scoring?.targetRoleFamily) },
                  { label: "Target sector", value: titleCase(scoring.data?.scoring?.targetSectorCluster) },
                  { label: "Trajectory status", value: titleCase(scoring.data?.scoring?.trajectoryStatus) },
                  { label: "Overall score", value: scoring.data?.scoring?.overallScore ?? "Unknown" },
                ]}
              />
              {comparison?.scoring ? (
                <div
                  style={{
                    border: "1px solid #dbe4f0",
                    borderRadius: 16,
                    padding: 16,
                    background: "#f8fbff",
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <strong>Comparison: {titleCase(comparison.scoring.targetRoleFamily)}</strong>
                  <div style={{ color: "#475569" }}>
                    Overall score delta relative to the selected role: {formatDelta(comparison.deltaOverallScore)}
                  </div>
                  <KeyValueList
                    items={Object.entries(comparison.deltaSubScores || {}).map(([key, value]) => ({
                      label: titleCase(key),
                      value: formatDelta(value),
                    }))}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </SectionCard>

        <SectionCard title="Academic Progress Used In Scoring">
          {scoring.loading ? <p>Loading academic progress...</p> : null}
          {scoring.error ? <p style={{ color: "crimson" }}>Academic scoring context is unavailable because the scoring request failed.</p> : null}
          {!scoring.loading && !scoring.error ? (
            <div style={{ display: "grid", gap: 16 }}>
              <KeyValueList
                items={[
                  { label: "Transcript status", value: titleCase(transcript?.parsedStatus) },
                  { label: "Transcript terms", value: transcript?.termCount ?? 0 },
                  { label: "Transcript courses", value: transcript?.courseCount ?? 0 },
                  { label: "Completed courses", value: transcript?.completedCourseCount ?? 0 },
                  { label: "Catalog-matched courses", value: transcript?.matchedCatalogCourseCount ?? 0 },
                  { label: "Credits earned", value: transcript?.creditsEarned ?? 0 },
                ]}
              />
              <KeyValueList
                items={[
                  { label: "Catalog binding", value: academicBindingLabel(requirementProgress) },
                  { label: "Institution", value: requirementProgress?.institutionDisplayName || "Unknown" },
                  { label: "Catalog", value: requirementProgress?.catalogLabel || "Unknown" },
                  { label: "Program", value: requirementProgress?.programName || "Unknown" },
                  { label: "Major", value: requirementProgress?.majorDisplayName || "Unknown" },
                  { label: "Requirement completion", value: `${requirementProgress?.completionPercent ?? 0}%` },
                ]}
              />
              {hasAssignmentWithoutRequirements ? (
                <div
                  style={{
                    border: "1px solid #dbe4f0",
                    borderRadius: 14,
                    padding: "14px 16px",
                    background: "#f8fbff",
                    color: "#475569",
                    lineHeight: 1.6,
                  }}
                >
                  Your academic path has been saved, but the system has not yet extracted a structured
                  requirement graph for this program. Scoring can still use market and activity data,
                  but curriculum-aware requirement completion will stay limited until those requirements
                  are loaded or a catalog PDF is uploaded.
                </div>
              ) : null}
              {transcript?.transcriptSummary ? (
                <div>
                  <strong>Transcript summary</strong>
                  <p style={{ marginBottom: 0, color: "#475569", lineHeight: 1.6 }}>{transcript.transcriptSummary}</p>
                </div>
              ) : null}
              <div>
                <strong>Missing or unmapped core requirements</strong>
                {requirementProgress?.missingRequiredCourses?.length ? (
                  <ul style={{ marginBottom: 0 }}>
                    {requirementProgress.missingRequiredCourses.map((course) => <li key={course}>{course}</li>)}
                  </ul>
                ) : (
                  <p style={{ marginBottom: 0, color: "#64748b" }}>No missing core requirement list is currently surfaced.</p>
                )}
              </div>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard title="Market Inputs Used In Scoring">
          {scoring.loading ? <p>Loading market inputs...</p> : null}
          {scoring.error ? <p style={{ color: "crimson" }}>Scoring input unavailable because the scoring request failed.</p> : null}
          {!scoring.loading && !scoring.error ? (
            <div style={{ display: "grid", gap: 16 }}>
              <KeyValueList
                items={[
                  { label: "Resolved O*NET code", value: scoring.data?.scoringInput?.occupationMetadata?.onetCode || "Unmapped" },
                  { label: "Job zone", value: scoring.data?.scoringInput?.occupationMetadata?.jobZone ?? "Unknown" },
                  { label: "Occupation description", value: scoring.data?.scoringInput?.occupationMetadata?.description || "None loaded" },
                ]}
              />

              <div style={{ display: "grid", gap: 10 }}>
                <strong>Imported market signals</strong>
                {marketSignals.length ? marketSignals.map((signal) => (
                  <div
                    key={`${signal.sourceName}-${signal.signalType}-${signal.effectiveDate}`}
                    style={{
                      border: "1px solid #dbe4f0",
                      borderRadius: 14,
                      padding: 14,
                      background: "#fbfdff",
                    }}
                  >
                    <div style={{ fontWeight: 800 }}>{titleCase(signal.signalType)}</div>
                    <div style={{ color: "#475569", marginTop: 6 }}>
                      Source: {signal.sourceName} · Scope: {signal.scope} · Value: {signal.signalValue ?? "Unknown"} · Direction: {signal.signalDirection || "Unknown"} · Effective: {signal.effectiveDate}
                    </div>
                  </div>
                )) : <p style={{ margin: 0, color: "#64748b" }}>No market signals are loaded for this role yet.</p>}
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <strong>Top imported role skills</strong>
                {topOccupationSkills.length ? topOccupationSkills.map((skill) => (
                  <div
                    key={skill.skillName}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 14,
                      padding: 12,
                      background: "#fff",
                    }}
                  >
                    <div style={{ fontWeight: 800 }}>{skill.skillName}</div>
                    <div style={{ color: "#475569", marginTop: 4 }}>
                      Importance: {skill.importanceScore} · Required level: {titleCase(skill.requiredProficiencyBand)}
                    </div>
                  </div>
                )) : <p style={{ margin: 0, color: "#64748b" }}>No imported occupation skill requirements are loaded for this role.</p>}
              </div>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard title="Subscores And Guidance">
          {scoring.loading ? <p>Loading subscores...</p> : null}
          {scoring.error ? <p style={{ color: "crimson" }}>{scoring.error}</p> : null}
          {!scoring.loading && !scoring.error ? (
            <div style={{ display: "grid", gap: 16 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 12,
                }}
              >
                {Object.entries(scoring.data?.scoring?.subScores || {}).map(([key, value]) => (
                  <div
                    key={key}
                    style={{
                      border: "1px solid #dbe4f0",
                      borderRadius: 16,
                      padding: 16,
                      background: "#f8fbff",
                    }}
                  >
                    <div style={{ fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>{titleCase(key)}</div>
                    <div style={{ fontSize: 28, fontWeight: 800 }}>{value}</div>
                    <div style={{ color: "#475569" }}>{scoreLabel(value)}</div>
                  </div>
                ))}
              </div>
              <div>
                <strong>Top risks</strong>
                <ul style={{ marginBottom: 0 }}>
                  {(scoring.data?.scoring?.topRisks || []).map((risk) => <li key={risk}>{risk}</li>)}
                </ul>
              </div>
              <div>
                <strong>Recommended next actions</strong>
                <ul style={{ marginBottom: 0 }}>
                  {(scoring.data?.scoring?.recommendations || []).slice(0, 5).map((item) => <li key={item.title}>{item.title}</li>)}
                </ul>
              </div>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard title="Scenario Guidance">
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span>Your question</span>
              <textarea
                value={draftQuestion}
                onChange={(e) => setDraftQuestion(e.target.value)}
                rows={4}
                style={{ width: "100%", maxWidth: 640, fontFamily: "inherit" }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 280 }}>
              <span>Communication style</span>
              <select value={draftStyle} onChange={(e) => setDraftStyle(e.target.value)}>
                <option value="direct">Direct</option>
                <option value="supportive">Supportive</option>
                <option value="coaching">Coaching</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => {
                setApplied({
                  scenarioQuestion: draftQuestion.trim() || DEFAULT_SCENARIO_QUESTION,
                  communicationStyle: draftStyle.trim() || "direct",
                });
                setRequestedScenario(true);
              }}
            >
              {scenario.loading ? "Processing…" : "Get guidance"}
            </button>
          </div>
          {scenario.loading ? <p>Processing scenario guidance...</p> : null}
          {scenario.error ? <p style={{ color: "crimson" }}>{scenario.error}</p> : null}
          {!scenario.loading && !scenario.error && !scenario.data?.response && requestedScenario ? (
            <p style={{ color: "#475569" }}>No scenario response was returned.</p>
          ) : null}
          {!scenario.loading && !scenario.error && scenario.data?.response ? (
            <div style={{ display: "grid", gap: 16 }}>
              <div
                style={{
                  borderRadius: 18,
                  padding: 18,
                  background: scenario.data.response.mode === "fallback"
                    ? "linear-gradient(135deg, rgba(251,191,36,0.16), rgba(253,230,138,0.24))"
                    : "linear-gradient(135deg, rgba(21,94,239,0.12), rgba(34,197,94,0.12))",
                  border: "1px solid rgba(148,163,184,0.28)",
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 20 }}>{scenario.data.response.headline}</div>
                <p style={{ marginBottom: 0, color: "#334155", lineHeight: 1.7 }}>{scenario.data.response.summary}</p>
              </div>
              <div>
                <strong>Why this matters now</strong>
                <p style={{ marginBottom: 0, color: "#475569", lineHeight: 1.7 }}>
                  {scenario.data.response.whyThisMattersNow}
                </p>
              </div>
              <div>
                <strong>Recommended actions</strong>
                <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
                  {scenario.data.response.recommendedActions.map((action) => (
                    <div
                      key={`${action.title}-${action.timeframe}`}
                      style={{
                        border: "1px solid #dbe4f0",
                        borderRadius: 14,
                        padding: 14,
                        background: "#fff",
                      }}
                    >
                      <div style={{ fontWeight: 800 }}>{action.title}</div>
                      <div style={{ color: "#475569", marginTop: 6 }}>{action.rationale}</div>
                      <div style={{ color: "#64748b", marginTop: 6, fontSize: 14 }}>{action.timeframe}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <strong>Risks to watch</strong>
                <ul style={{ marginBottom: 0 }}>
                  {scenario.data.response.risksToWatch.map((risk) => <li key={risk}>{risk}</li>)}
                </ul>
              </div>
              <div>
                <strong>What this guidance was based on</strong>
                <ul style={{ marginBottom: 0 }}>
                  {scenario.data.response.basedOn.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
              <div>
                <strong>Closing note</strong>
                <p style={{ marginBottom: 0, color: "#475569", lineHeight: 1.7 }}>
                  {scenario.data.response.encouragement}
                </p>
              </div>
              {scenario.data.response.mode === "fallback" ? (
                <p style={{ margin: 0, color: "#92400e" }}>
                  AI response fallback was used so guidance stayed available. Provider detail: {scenario.data.response.providerError || "Unavailable"}
                </p>
              ) : null}
            </div>
          ) : null}
        </SectionCard>
      </RequireRole>
    </AppShell>
  );
}
