"use client";

import Link from "next/link";
import { SectionCard } from "../layout/SectionCard";

type ActiveCareerScenarioBannerProps = {
  scenario: {
    careerScenarioId: string;
    scenarioName: string;
    status: string;
    targetRole?: string | null;
    targetProfession?: string | null;
    lastRunAt?: string | null;
    actionItems?: Array<{
      title: string;
      rationale?: string | null;
      priority?: string;
    }>;
    analysisResult?: {
      scenarioSpecificActions?: string[];
      recommendedActions?: string[];
    } | null;
  } | null | undefined;
  linkHref?: string;
  missingFallback: string;
};

function titleCase(value?: string | null) {
  if (!value) return "Unknown";
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export function ActiveCareerScenarioBanner(props: ActiveCareerScenarioBannerProps) {
  if (!props.scenario) {
    return (
      <SectionCard title="Career Goal" subtitle={props.missingFallback} testId="career-goal-banner-card">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <Link href={props.linkHref || "/career-scenarios"} className="ui-button ui-button--primary">
            Create a Career Goal
          </Link>
        </div>
      </SectionCard>
    );
  }

  const target = props.scenario.targetRole || props.scenario.targetProfession || "Target not yet defined";
  const scenarioActions =
    props.scenario.actionItems?.length
      ? props.scenario.actionItems.slice(0, 3).map((item) => item.title)
      : props.scenario.analysisResult?.scenarioSpecificActions?.length
      ? props.scenario.analysisResult.scenarioSpecificActions.slice(0, 3)
      : props.scenario.analysisResult?.recommendedActions?.slice(0, 3) || [];

  return (
    <SectionCard
      title="Active Career Goal"
      subtitle={`${props.scenario.scenarioName} is currently driving the job-specific readiness context for this workspace.`}
      testId="career-goal-banner-card"
      introTarget="active-career-goal"
    >
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{props.scenario.scenarioName}</div>
            <div style={{ color: "#475569" }}>{target}</div>
          </div>
          <Link href={props.linkHref || "/career-scenarios"} className="ui-button ui-button--secondary">
            Open Career Goal
          </Link>
        </div>
        <div style={{ color: "#64748b" }}>
          Status: <strong>{titleCase(props.scenario.status)}</strong>
          {props.scenario.lastRunAt ? ` · Last analysis ${new Date(props.scenario.lastRunAt).toLocaleString()}` : ""}
        </div>
        {scenarioActions.length ? (
          <div className="ui-soft-panel">
            <strong>Career Goal action items</strong>
            <ul style={{ marginBottom: 0 }}>
              {scenarioActions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {props.scenario.status === "needs_rerun" ? (
          <div className="ui-soft-panel" style={{ background: "#fff7ed", borderColor: "rgba(180,83,9,0.22)" }}>
            <strong>Career Goal refresh recommended</strong>
            <p style={{ margin: "6px 0 0 0", color: "#7c2d12", lineHeight: 1.6 }}>
              Student information, curriculum evidence, or Career Goal assumptions changed after the last analysis.
            </p>
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}
