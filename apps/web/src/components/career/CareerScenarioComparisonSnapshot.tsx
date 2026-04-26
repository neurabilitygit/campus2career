"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { CareerScenarioRecord, CareerScenarioSummary } from "../../../../../packages/shared/src/contracts/careerScenario";
import { compareCareerScenarios } from "../../lib/careerScenarioCompare";
import { useApiData } from "../../hooks/useApiData";
import { SectionCard } from "../layout/SectionCard";

type ScenarioListResponse = {
  ok: boolean;
  count: number;
  scenarios: CareerScenarioSummary[];
};

type ScenarioItemResponse = {
  ok: boolean;
  scenario: CareerScenarioRecord;
};

type ComparisonSnapshotProps = {
  activeScenarioId?: string | null;
  listPath: string;
  buildItemPath: (careerScenarioId: string) => string;
  linkHref: string;
  subjectLabel?: string;
};

function titleCase(value?: string | null) {
  if (!value) return "Unknown";
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDelta(value: number | null | undefined) {
  if (typeof value !== "number") return "Unknown";
  if (value === 0) return "No change";
  return `${value > 0 ? "+" : ""}${value}`;
}

export function CareerScenarioComparisonSnapshot(props: ComparisonSnapshotProps) {
  const scenarios = useApiData<ScenarioListResponse>(props.listPath, !!props.activeScenarioId);
  const [alternateScenarioId, setAlternateScenarioId] = useState<string>("");

  const alternateOptions = useMemo(
    () => (scenarios.data?.scenarios || []).filter((item) => item.careerScenarioId !== props.activeScenarioId),
    [props.activeScenarioId, scenarios.data?.scenarios]
  );

  useEffect(() => {
    if (!alternateOptions.length) {
      setAlternateScenarioId("");
      return;
    }
    setAlternateScenarioId((current) =>
      alternateOptions.some((item) => item.careerScenarioId === current) ? current : alternateOptions[0].careerScenarioId
    );
  }, [alternateOptions]);

  const activeItem = useApiData<ScenarioItemResponse>(
    props.activeScenarioId ? props.buildItemPath(props.activeScenarioId) : "",
    !!props.activeScenarioId
  );
  const alternateItem = useApiData<ScenarioItemResponse>(
    alternateScenarioId ? props.buildItemPath(alternateScenarioId) : "",
    !!alternateScenarioId
  );

  if (!props.activeScenarioId) {
    return null;
  }

  if (scenarios.loading) {
    return (
      <SectionCard
        title="Career Goal comparison snapshot"
        subtitle="Compare the active career goal against another saved version without leaving the dashboard."
        testId="career-goal-comparison-snapshot-card"
      >
        <p style={{ margin: 0 }}>Loading saved Career Goals...</p>
      </SectionCard>
    );
  }

  if (!alternateOptions.length) {
    return (
      <SectionCard
        title="Career Goal comparison snapshot"
        subtitle="Compare the active career goal against another saved version without leaving the dashboard."
        testId="career-goal-comparison-snapshot-card"
      >
        <div style={{ display: "grid", gap: 12 }}>
          <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>
            Save another career goal for {props.subjectLabel || "this student"} to compare role-specific readiness, gaps,
            and next actions side by side from the dashboard.
          </p>
          <Link href={props.linkHref} className="ui-button ui-button--secondary" style={{ width: "fit-content" }}>
            Open Career Goal
          </Link>
        </div>
      </SectionCard>
    );
  }

  const comparison = compareCareerScenarios(activeItem.data?.scenario, alternateItem.data?.scenario);

  return (
    <SectionCard
      title="Career Goal comparison snapshot"
      subtitle="Stay in the dashboard while comparing the active career goal with a saved alternate path."
      testId="career-goal-comparison-snapshot-card"
    >
      <div style={{ display: "grid", gap: 14 }}>
        <label style={{ display: "grid", gap: 6, maxWidth: 420 }}>
          <span style={{ color: "#475569", fontWeight: 700 }}>Compare active career goal against</span>
          <select value={alternateScenarioId} onChange={(event) => setAlternateScenarioId(event.target.value)}>
            {alternateOptions.map((item) => (
              <option key={item.careerScenarioId} value={item.careerScenarioId}>
                {item.scenarioName}
              </option>
            ))}
          </select>
        </label>

        {activeItem.loading || alternateItem.loading ? <p style={{ margin: 0 }}>Refreshing comparison...</p> : null}
        {activeItem.error ? <p style={{ margin: 0, color: "crimson" }}>{activeItem.error}</p> : null}
        {alternateItem.error ? <p style={{ margin: 0, color: "crimson" }}>{alternateItem.error}</p> : null}

        {comparison ? (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              <div className="ui-soft-panel">
                <strong>Overall score change</strong>
                <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>{formatDelta(comparison.overallScoreDelta)}</div>
                <div style={{ color: "#64748b" }}>
                  {comparison.leftScenarioName} {comparison.leftOverallScore ?? "?"} {"->"} {comparison.rightScenarioName}{" "}
                  {comparison.rightOverallScore ?? "?"}
                </div>
              </div>
              <div className="ui-soft-panel">
                <strong>Qualification shift</strong>
                <div style={{ marginTop: 8, color: "#334155", lineHeight: 1.6 }}>
                  {comparison.qualificationShift ? titleCase(comparison.qualificationShift) : "Not enough analysis yet"}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
              <div className="ui-soft-panel">
                <strong>{comparison.leftScenarioName}</strong>
                <p style={{ margin: "8px 0 0 0", color: "#475569" }}>Active Career Goal-only gaps</p>
                <ul style={{ marginBottom: 0 }}>
                  {(comparison.distinctLeftGaps.length ? comparison.distinctLeftGaps : comparison.leftActions).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="ui-soft-panel">
                <strong>{comparison.rightScenarioName}</strong>
                <p style={{ margin: "8px 0 0 0", color: "#475569" }}>Alternate Career Goal-only gaps or next actions</p>
                <ul style={{ marginBottom: 0 }}>
                  {(comparison.distinctRightGaps.length ? comparison.distinctRightGaps : comparison.rightActions).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        ) : null}

        <div>
          <Link href={props.linkHref} className="ui-button ui-button--secondary">
            Open Career Goal
          </Link>
        </div>
      </div>
    </SectionCard>
  );
}
