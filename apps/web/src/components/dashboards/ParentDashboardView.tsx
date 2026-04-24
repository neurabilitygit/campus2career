"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "../layout/AppShell";
import { SectionCard } from "../layout/SectionCard";
import { RequireRole } from "../RequireRole";
import { useApiData } from "../../hooks/useApiData";
import { useAuthContext } from "../../hooks/useAuthContext";
import { formatStudentReference, normalizeFirstName } from "../../lib/studentName";
import { apiFetch } from "../../lib/apiClient";
import { OutcomeTrackingSection } from "../outcomes/OutcomeTrackingSection";
import { VisibleCoachFeedSection } from "../coach/VisibleCoachFeedSection";

type TrajectoryStatus = "on_track" | "watch" | "at_risk";
type RoleType = "parent" | "coach" | "student" | "admin";

type ScoringResponse = {
  scoring?: {
    targetRoleFamily?: string;
    targetSectorCluster?: string;
    trajectoryStatus?: TrajectoryStatus;
    overallScore?: number;
    topStrengths?: string[];
    topRisks?: string[];
    recommendations?: Array<{
      title: string;
      description?: string;
      whyThisMatchesStudent?: string;
      linkedSkillName?: string;
      effortLevel?: string;
      estimatedSignalStrength?: string;
    }>;
    subScores?: Record<string, number>;
    subScoreDetails?: Record<
      string,
      {
        evidenceLevel?: "strong" | "moderate" | "weak" | "missing";
      }
    >;
    skillGaps?: Array<{
      skillName: string;
      gapSeverity: string;
      evidenceSummary?: string;
    }>;
    evidenceQuality?: {
      overallEvidenceLevel?: "strong" | "moderate" | "weak" | "missing";
      missingEvidence?: string[];
      weakEvidence?: string[];
      assessmentMode?: "measured" | "provisional";
      recommendedEvidenceActions?: string[];
    };
  };
};

type BriefRecord = {
  trajectoryStatus: TrajectoryStatus;
  monthLabel: string;
  keyMarketChanges?: string | null;
  progressSummary?: string | null;
  topRisks?: string | null;
  recommendedParentQuestions?: string | null;
  recommendedParentActions?: string | null;
  generatedAt?: string;
};

type BriefResponse = {
  brief?: BriefRecord | null;
  monthLabel?: string;
  resolvedContext?: {
    authenticatedRoleType?: RoleType;
    studentProfileId?: string | null;
    householdId?: string | null;
  };
};

const statusTone: Record<TrajectoryStatus, { label: string; accent: string; background: string; description: string }> = {
  on_track: {
    label: "On track",
    accent: "#047857",
    background: "linear-gradient(135deg, rgba(16,185,129,0.16), rgba(110,231,183,0.2))",
    description: "The student is building credible momentum toward the current target role.",
  },
  watch: {
    label: "Needs attention",
    accent: "#b45309",
    background: "linear-gradient(135deg, rgba(245,158,11,0.16), rgba(253,224,71,0.22))",
    description: "The path is still recoverable, but several signals need active follow-through.",
  },
  at_risk: {
    label: "At risk",
    accent: "#b91c1c",
    background: "linear-gradient(135deg, rgba(248,113,113,0.18), rgba(253,186,116,0.2))",
    description: "The current evidence is weak for the target role, so parent support should focus on a few concrete corrective moves.",
  },
};

function titleCase(value: string | undefined | null): string {
  if (!value) return "Not yet defined";
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function splitPipeList(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function scoreLabel(score: number | undefined): string {
  if (typeof score !== "number") return "Unknown";
  if (score >= 75) return "Strong";
  if (score >= 55) return "Developing";
  return "Weak";
}

function evidenceLabel(value: string | undefined): string {
  if (!value) return "Unknown";
  return titleCase(value);
}

function ParentNarrative(props: {
  scoring: ScoringResponse["scoring"];
  brief: BriefRecord | null | undefined;
  monthLabel: string;
  studentFirstName: string | null;
}) {
  const targetRole = titleCase(props.scoring?.targetRoleFamily);
  const targetSector = titleCase(props.scoring?.targetSectorCluster);
  const status = props.scoring?.trajectoryStatus || props.brief?.trajectoryStatus || "watch";
  const statusCard = statusTone[status];
  const nextAction = props.scoring?.recommendations?.[0];
  const studentLabel = formatStudentReference(props.studentFirstName, {
    fallback: "the student",
  });
  const studentPossessive = formatStudentReference(props.studentFirstName, {
    possessive: true,
    fallback: "the student's",
  });
  const topRisk =
    props.scoring?.topRisks?.[0] ||
    splitPipeList(props.brief?.topRisks)[0] ||
    "No major risk has been surfaced yet.";

  return (
    <SectionCard title="Parent Summary">
      <div
        style={{
          display: "grid",
          gap: 18,
          padding: 20,
          borderRadius: 20,
          background: statusCard.background,
          border: `1px solid ${statusCard.accent}33`,
        }}
      >
        <div style={{ display: "grid", gap: 8 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              width: "fit-content",
              padding: "8px 12px",
              borderRadius: 999,
              background: "#ffffffc7",
              color: statusCard.accent,
              fontWeight: 800,
            }}
          >
            {statusCard.label}
          </div>
          <h2 style={{ margin: 0, fontSize: 28, lineHeight: 1.1 }}>
            Current goal: {targetRole}
          </h2>
          <p style={{ margin: 0, color: "#334155", lineHeight: 1.6 }}>
            Right now {studentLabel} is being tracked toward the <strong>{targetRole}</strong> path in{" "}
            <strong>{targetSector}</strong>. {statusCard.description}
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <div style={{ background: "#fff", borderRadius: 16, padding: 16 }}>
            <div style={{ color: "#64748b", fontSize: 13, fontWeight: 700, textTransform: "uppercase" }}>Overall score</div>
            <div style={{ fontSize: 34, fontWeight: 800, marginTop: 6 }}>
              {props.scoring?.overallScore ?? "?"}
            </div>
            <div style={{ color: "#334155" }}>{scoreLabel(props.scoring?.overallScore)}</div>
          </div>
          <div style={{ background: "#fff", borderRadius: 16, padding: 16 }}>
            <div style={{ color: "#64748b", fontSize: 13, fontWeight: 700, textTransform: "uppercase" }}>Top concern</div>
            <div style={{ marginTop: 8, color: "#0f172a", lineHeight: 1.5 }}>{topRisk}</div>
          </div>
          <div style={{ background: "#fff", borderRadius: 16, padding: 16 }}>
            <div style={{ color: "#64748b", fontSize: 13, fontWeight: 700, textTransform: "uppercase" }}>Next best action</div>
            <div style={{ marginTop: 8, color: "#0f172a", lineHeight: 1.5 }}>
              {nextAction?.title || splitPipeList(props.brief?.recommendedParentActions)[0] || "Generate the monthly brief to get a recommended next move."}
            </div>
          </div>
        </div>

        <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>
          Reporting month: <strong>{props.monthLabel}</strong>. This view keeps the current live picture and the saved monthly parent summary in one place.
        </p>
      </div>
    </SectionCard>
  );
}

function BulletList(props: {
  items: string[];
  empty: string;
}) {
  if (!props.items.length) {
    return <p style={{ margin: 0, color: "#64748b" }}>{props.empty}</p>;
  }

  return (
    <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 10 }}>
      {props.items.map((item) => (
        <li key={item} style={{ lineHeight: 1.6 }}>
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function ParentDashboardView() {
  const auth = useAuthContext();
  const scoring = useApiData<ScoringResponse>("/students/me/scoring");
  const [briefRefresh, setBriefRefresh] = useState(0);
  const [generateBusy, setGenerateBusy] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const brief = useApiData<BriefResponse>("/v1/briefs/live", true, briefRefresh);

  const recommendedActions = useMemo(() => {
    const fromScoring =
      scoring.data?.scoring?.recommendations?.slice(0, 3).map((item) => item.title) || [];
    if (fromScoring.length) return fromScoring;
    return splitPipeList(brief.data?.brief?.recommendedParentActions);
  }, [brief.data?.brief?.recommendedParentActions, scoring.data?.scoring?.recommendations]);

  const strengths = scoring.data?.scoring?.topStrengths || [];
  const risks = scoring.data?.scoring?.topRisks || splitPipeList(brief.data?.brief?.topRisks);
  const parentQuestions = splitPipeList(brief.data?.brief?.recommendedParentQuestions);
  const progressNotes = splitPipeList(brief.data?.brief?.progressSummary);
  const studentFirstName = normalizeFirstName(auth.data?.context?.studentFirstName);
  const studentPossessive = formatStudentReference(studentFirstName, {
    possessive: true,
    fallback: "the student's",
  });
  const studentObject = formatStudentReference(studentFirstName, {
    fallback: "the student",
  });
  const scoringBreakdown = scoring.data?.scoring?.subScores || {};
  const highPriorityGaps =
    scoring.data?.scoring?.skillGaps
      ?.filter((gap) => gap.gapSeverity === "high" || gap.gapSeverity === "medium")
      .slice(0, 3) || [];
  const missingEvidence = scoring.data?.scoring?.evidenceQuality?.missingEvidence || [];
  const twoColumnGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 16,
  } as const;

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
    <AppShell
      title="Parent dashboard"
      subtitle={`See ${studentPossessive} direction, current level of risk, and the most helpful ways to support progress without overload.`}
    >
      <RequireRole expectedRoles={["parent", "admin"]} fallbackTitle="Parent sign-in required">
        <ParentNarrative
          scoring={scoring.data?.scoring}
          brief={brief.data?.brief}
          monthLabel={brief.data?.monthLabel || "Current month"}
          studentFirstName={studentFirstName}
        />

        <OutcomeTrackingSection mode="parent" />

        <VisibleCoachFeedSection mode="parent" />

        <SectionCard
          title="Communication translator"
          subtitle="Use this before reaching out when a topic matters but the wording needs to land more calmly."
          tone="highlight"
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 14,
            }}
          >
            <Link
              href="/parent/communication"
              className="ui-feature-link-card"
            >
              <strong style={{ display: "block", fontSize: 18 }}>Open communication workspace</strong>
              <p style={{ margin: "8px 0 0", color: "#52657d", lineHeight: 1.6 }}>
                Capture concerns, generate a translation strategy, and save a reviewable message draft.
              </p>
            </Link>
            <Link
              href="/parent/onboarding"
              className="ui-feature-link-card"
            >
              <strong style={{ display: "block", fontSize: 18 }}>Set parent communication baseline</strong>
              <p style={{ margin: "8px 0 0", color: "#52657d", lineHeight: 1.6 }}>
                Tell the system what tends not to work so translation starts from a calmer family context.
              </p>
            </Link>
          </div>
        </SectionCard>

        <div style={twoColumnGridStyle}>
          <SectionCard
            title="What needs attention now"
            subtitle="Start here when you want to understand where support matters most right now."
            tone="warm"
          >
            <div style={{ display: "grid", gap: 16 }}>
              <BulletList
                items={risks}
                empty="No major risks are currently listed."
              />
              {highPriorityGaps.length ? (
                <div style={{ display: "grid", gap: 10 }}>
                  <strong>Priority skill gaps</strong>
                  {highPriorityGaps.map((gap) => (
                    <div
                      key={gap.skillName}
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: 14,
                        padding: 14,
                        background: "#fffaf8",
                      }}
                    >
                      <div style={{ fontWeight: 800 }}>{titleCase(gap.skillName)}</div>
                      <div style={{ color: "#475569", marginTop: 6 }}>
                        Severity: {titleCase(gap.gapSeverity)}. {gap.evidenceSummary || "Evidence is currently thin relative to the target role."}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard
            title="Where a parent can help next"
            subtitle="Use the smallest actions that improve momentum without increasing pressure."
          >
            <BulletList
              items={recommendedActions}
              empty="No parent actions have been generated yet. Use the monthly update card below to create the first saved summary."
            />
          </SectionCard>
        </div>

        <div style={twoColumnGridStyle}>
          <SectionCard
            title="How reliable this picture is"
            subtitle={`This helps you tell the difference between a true readiness gap and an area where ${studentObject} still needs to add evidence.`}
            tone="quiet"
          >
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ fontWeight: 800, color: "#22456f" }}>
                Evidence: {evidenceLabel(scoring.data?.scoring?.evidenceQuality?.overallEvidenceLevel)} ·{" "}
                {scoring.data?.scoring?.evidenceQuality?.assessmentMode === "provisional"
                  ? "Directionally useful"
                  : "Supported by stored evidence"}
              </div>
              <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>
                {scoring.data?.scoring?.evidenceQuality?.assessmentMode === "provisional"
                  ? `Some readiness areas are marked uncertain because ${studentFirstName || "the student"} has not provided enough evidence yet.`
                  : `The current read is supported by a meaningful amount of stored evidence for ${studentFirstName || "the student"}.`}
              </p>
              {scoring.data?.scoring?.evidenceQuality?.recommendedEvidenceActions?.length ? (
                <BulletList
                  items={scoring.data.scoring.evidenceQuality.recommendedEvidenceActions.slice(0, 4)}
                  empty=""
                />
              ) : null}
            </div>
          </SectionCard>

          <SectionCard
            title="What would make this read more reliable"
            subtitle={`These missing pieces would make ${studentPossessive} picture more specific and easier to trust.`}
            tone="quiet"
          >
            <BulletList
              items={missingEvidence}
              empty="No major missing-evidence warning is showing right now."
            />
          </SectionCard>

          <SectionCard
            title="What already looks promising"
            subtitle={`These are the clearest signs of traction in ${studentPossessive} current story.`}
            tone="quiet"
          >
            <BulletList
              items={strengths}
              empty="No clear strengths have been surfaced yet. That usually means the student has not built enough visible evidence for the chosen role."
            />
          </SectionCard>
        </div>

        <SectionCard
          title="How the score breaks down"
          subtitle={`Use this only when you want more detail on where ${studentObject} already looks strong and where support may matter most.`}
        >
          {scoring.loading ? <p>Loading live scoring...</p> : null}
          {scoring.error ? <p style={{ color: "crimson" }}>{scoring.error}</p> : null}
          {!scoring.loading && !scoring.error ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
              }}
            >
              {Object.entries(scoringBreakdown).map(([key, value]) => (
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
                  <div style={{ color: "#22456f", marginTop: 8, fontWeight: 700, fontSize: 14 }}>
                    Evidence: {evidenceLabel(scoring.data?.scoring?.subScoreDetails?.[key]?.evidenceLevel)}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </SectionCard>

        <div style={twoColumnGridStyle}>
          <SectionCard
            title={`Helpful questions to ask ${studentFirstName || "your student"}`}
            subtitle="Use these as conversation starters, not a script."
            tone="quiet"
          >
            <BulletList
              items={parentQuestions}
              empty="No parent prompts have been generated yet. The monthly brief will add conversation prompts here."
            />
          </SectionCard>

          <SectionCard
            title="Recent progress signals"
            subtitle={`This section becomes more useful as ${studentPossessive} coursework, experiences, and uploads accumulate.`}
          >
            <BulletList
              items={progressNotes}
              empty="No recent accomplishments are showing yet. Uploads, projects, coursework, or experience entries will make this section more useful."
            />
          </SectionCard>
        </div>

        <SectionCard
          title="Monthly parent update"
          subtitle="Save a parent-friendly summary for the current reporting month so you can revisit a stable snapshot later."
          actions={
            <button
              type="button"
              onClick={() => void generateBrief()}
              disabled={generateBusy}
              className="ui-button ui-button--primary"
            >
              {generateBusy ? "Generating…" : "Generate / refresh this month"}
            </button>
          }
        >
          <div style={{ display: "grid", gap: 14 }}>
            <p style={{ margin: 0, color: "#475569", fontSize: 14, lineHeight: 1.6 }}>
              If a brief has not been generated yet, this dashboard still uses the live student picture above. Refreshing creates or updates the saved parent summary for this month.
            </p>
            {generateError ? <p style={{ color: "crimson", margin: 0 }}>{generateError}</p> : null}
            {brief.loading ? <p style={{ margin: 0 }}>Loading monthly brief...</p> : null}
            {brief.error ? <p style={{ color: "crimson", margin: 0 }}>{brief.error}</p> : null}
            {!brief.loading && !brief.error && !brief.data?.brief ? (
              <p style={{ color: "#475569", margin: 0 }}>
                No saved brief exists yet for {brief.data?.monthLabel || "this month"}. The dashboard is using current live scoring and recommendations for now.
              </p>
            ) : null}
            {!brief.loading && !brief.error && brief.data?.brief ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 12,
                }}
              >
                <div className="ui-soft-panel">
                  <strong>Status</strong>
                  <div style={{ marginTop: 6 }}>{titleCase(brief.data.brief.trajectoryStatus)}</div>
                </div>
                <div className="ui-soft-panel">
                  <strong>Generated</strong>
                  <div style={{ marginTop: 6 }}>
                    {brief.data.brief.generatedAt ? new Date(brief.data.brief.generatedAt).toLocaleString() : "Unknown"}
                  </div>
                </div>
                {brief.data.brief.keyMarketChanges ? (
                  <div className="ui-soft-panel" style={{ gridColumn: "1 / -1" }}>
                    <strong>Market context</strong>
                    <div style={{ marginTop: 6 }}>{brief.data.brief.keyMarketChanges}</div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </SectionCard>
      </RequireRole>
    </AppShell>
  );
}
