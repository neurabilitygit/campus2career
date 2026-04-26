"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "../layout/AppShell";
import { SectionCard } from "../layout/SectionCard";
import { KeyValueList } from "../layout/KeyValueList";
import { RequireRole } from "../RequireRole";
import { FieldInfoLabel } from "../forms/FieldInfoLabel";
import { CurriculumVerificationSection } from "../academic/CurriculumVerificationSection";
import { AcademicEvidenceSection } from "../academic/AcademicEvidenceSection";
import { useAuthContext } from "../../hooks/useAuthContext";
import { useApiData, useApiJsonPost } from "../../hooks/useApiData";
import { apiFetch } from "../../lib/apiClient";
import { OutcomeTrackingSection } from "../outcomes/OutcomeTrackingSection";
import { VisibleCoachFeedSection } from "../coach/VisibleCoachFeedSection";
import { ActiveCareerScenarioBanner } from "../career/ActiveCareerScenarioBanner";
import { CareerScenarioComparisonSnapshot } from "../career/CareerScenarioComparisonSnapshot";
import { listTargetRoleOptions } from "../../../../../packages/shared/src/market/targetRoleSeeds";
import type { JobTargetNormalizationResult, StudentJobTargetRecord } from "../../../../../packages/shared/src/contracts/career";
import { buildDirectAddressName } from "../../lib/personalization";
import { useSaveNavigation } from "../../lib/saveNavigation";

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
  evidenceQuality?: {
    assessmentMode?: "measured" | "provisional";
    overallEvidenceLevel?: "strong" | "moderate" | "weak" | "missing";
    confidenceLabel?: string;
    knownEvidence?: string[];
    weakEvidence?: string[];
    missingEvidence?: string[];
    provisionalReasons?: string[];
    strongestEvidenceCategories?: string[];
    weakestEvidenceCategories?: string[];
    blockedByMissingEvidence?: string[];
    recommendedEvidenceActions?: string[];
  };
  subScoreDetails?: Record<
    string,
    {
      evidenceLevel?: "strong" | "moderate" | "weak" | "missing";
      confidenceLabel?: string;
      explanation?: string;
      recommendedEvidence?: string[];
    }
  >;
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
    provenanceMethod?: "direct_scrape" | "artifact_pdf" | "manual" | "llm_assisted" | "synthetic_seed" | null;
    sourceUrl?: string | null;
    sourceNote?: string | null;
    totalRequirementItems: number;
    satisfiedRequirementItems: number;
    totalRequirementGroups: number;
    satisfiedRequirementGroups: number;
    creditsApplied: number;
    totalCreditsRequired?: number;
    completionPercent: number;
    missingRequiredCourses: string[];
    inferredConfidence: "low" | "medium" | "high";
    curriculumVerificationStatus?: "missing" | "present_unverified" | "verified" | "needs_attention";
    curriculumVerifiedAt?: string | null;
    curriculumVerificationNotes?: string | null;
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

type JobTargetsResponse = {
  ok: true;
  count: number;
  jobTargets: StudentJobTargetRecord[];
};

type CreateJobTargetResponse = {
  ok: true;
  jobTargetId: string;
  isPrimary: boolean;
  normalized: JobTargetNormalizationResult;
  message: string;
};

type SetPrimaryJobTargetResponse = {
  ok: true;
  primary?: StudentJobTargetRecord | null;
  message: string;
};

type ScoreExplanationResponse = {
  explanation?: {
    summaryHeadline: string;
    summaryText: string;
    strongestDrivers: Array<{
      key: string;
      label: string;
      score: number;
      direction: "positive" | "negative" | "neutral";
      detail: string;
    }>;
    biggestGaps: Array<{
      key: string;
      label: string;
      score: number;
      direction: "positive" | "negative" | "neutral";
      detail: string;
    }>;
    dataQualityAlerts: string[];
    evidenceSummary: {
      known: string[];
      weak: string[];
      missing: string[];
      assessmentMode: "measured" | "provisional";
    };
    immediateActions: string[];
    counterfactual?: {
      compareToRoleFamily: string;
      deltaOverallScore: number;
      summaryText: string;
      biggestChanges: Array<{
        key: string;
        label: string;
        delta: number;
        detail: string;
      }>;
    } | null;
  };
};

type StudentCommunicationMessagesResponse = {
  ok: boolean;
  count: number;
  messages: Array<{
    communicationMessageDraftId: string;
    selectedChannel: string;
    messageBody: string;
    deliveredAt?: string | null;
    createdAt?: string | null;
  }>;
};

type CommunicationSummaryResponse = {
  summary?: {
    sharedThemes?: string[];
    frictionSignals?: string[];
  };
  completion?: {
    student?: { completionPercent: number };
  };
};

type CareerScenarioActiveResponse = {
  ok: boolean;
  activeScenario?: {
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
  } | null;
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

function evidenceLabel(value: string | undefined): string {
  if (!value) return "Unknown";
  return titleCase(value);
}

function confidenceLabel(value: number | null | undefined): string {
  if (typeof value !== "number") return "Unknown";
  if (value >= 0.85) return "High";
  if (value >= 0.6) return "Medium";
  return "Low";
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

const summaryTileStyle: React.CSSProperties = {
  borderRadius: 18,
  padding: 18,
  background: "rgba(255, 255, 255, 0.9)",
  border: "1px solid rgba(148, 163, 184, 0.18)",
  boxShadow: "0 12px 28px rgba(15, 23, 42, 0.05)",
};

const roleOptions = listTargetRoleOptions();
const studentSectionItems = [
  {
    key: "strategy",
    href: "/student?section=strategy",
    label: "Big picture",
    description: "Status, target, and what matters most",
  },
  {
    key: "evidence",
    href: "/student?section=evidence",
    label: "Evidence",
    description: "What the system can verify so far",
  },
  {
    key: "guidance",
    href: "/student?section=guidance",
    label: "Next steps",
    description: "Risks, actions, and practical guidance",
  },
  {
    key: "outcomes",
    href: "/student?section=outcomes",
    label: "Outcome tracking",
    description: "Applications, interviews, offers, and accepted roles",
  },
] as const;

type StudentSectionKey = (typeof studentSectionItems)[number]["key"];

export default function StudentDashboardView() {
  const saveNavigation = useSaveNavigation();
  const auth = useAuthContext();
  const searchParams = useSearchParams();
  const [selectedRole, setSelectedRole] = useState("");
  const [compareRole, setCompareRole] = useState("");
  const [jobTargetsNonce, setJobTargetsNonce] = useState(0);
  const [jobTargetDraft, setJobTargetDraft] = useState({
    title: "",
    employer: "",
    location: "",
    jobDescriptionText: "",
  });
  const [jobTargetAction, setJobTargetAction] = useState<{
    saving: boolean;
    settingPrimary: string | null;
    error: string | null;
    success: string | null;
    normalization: JobTargetNormalizationResult | null;
  }>({
    saving: false,
    settingPrimary: null,
    error: null,
    success: null,
    normalization: null,
  });
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

  const scoring = useApiJsonPost<ScoringResponse>("/students/me/scoring/preview", scoringBody, true, {
    timeoutMs: 12000,
  });
  const explanation = useApiJsonPost<ScoreExplanationResponse>("/students/me/scoring/explain", scoringBody, true, {
    timeoutMs: 12000,
  });
  const jobTargets = useApiData<JobTargetsResponse>("/students/me/job-targets", true, jobTargetsNonce);
  const communicationMessages = useApiData<StudentCommunicationMessagesResponse>(
    "/students/me/communication-messages",
    true
  );
  const communicationSummary = useApiData<CommunicationSummaryResponse>("/communication/summary", true);
  const activeCareerScenario = useApiData<CareerScenarioActiveResponse>("/students/me/career-scenarios/active", true);

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

  const scenario = useApiJsonPost<ScenarioResponse>("/v1/chat/scenario/live", scenarioBody, requestedScenario, {
    timeoutMs: 30000,
  });
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
  const usesLlmAssistedRequirements = requirementProgress?.provenanceMethod === "llm_assisted";
  const topRecommendation = scoring.data?.scoring?.recommendations?.[0];
  const primaryRisk = scoring.data?.scoring?.topRisks?.[0];
  const targetRoleLabel = titleCase(scoring.data?.scoring?.targetRoleFamily);
  const targetSectorLabel = titleCase(scoring.data?.scoring?.targetSectorCluster);
  const trajectoryLabel = titleCase(scoring.data?.scoring?.trajectoryStatus);
  const evidenceSummary = explanation.data?.explanation?.evidenceSummary;
  const evidenceStillMissing = evidenceSummary?.missing?.length
    ? evidenceSummary.missing
    : explanation.data?.explanation?.dataQualityAlerts || [];
  const evidenceKnown =
    evidenceSummary?.known || scoring.data?.scoring?.evidenceQuality?.knownEvidence || [];
  const assessmentMode =
    evidenceSummary?.assessmentMode || scoring.data?.scoring?.evidenceQuality?.assessmentMode;
  const savedJobTargets = jobTargets.data?.jobTargets || [];
  const primaryJobTarget = savedJobTargets.find((jobTarget) => jobTarget.isPrimary) || null;
  const requestedSection = searchParams.get("section");
  const activeSection: StudentSectionKey =
    requestedSection === "evidence" ||
    requestedSection === "guidance" ||
    requestedSection === "outcomes"
      ? requestedSection
      : "strategy";
  const directName =
    buildDirectAddressName({
      preferredName: auth.data?.context?.authenticatedPreferredName,
      firstName: auth.data?.context?.authenticatedFirstName,
      lastName: auth.data?.context?.authenticatedLastName,
      fallback: "you",
    }) || "you";

  async function handleSaveJobTarget() {
    const title = jobTargetDraft.title.trim();
    if (!title) {
      setJobTargetAction((current) => ({
        ...current,
        error: "Add a job title before saving.",
        success: null,
        normalization: null,
      }));
      return;
    }

    setJobTargetAction({
      saving: true,
      settingPrimary: null,
      error: null,
      success: null,
      normalization: null,
    });

    try {
      const result = await apiFetch("/students/me/job-targets", {
        method: "POST",
        body: JSON.stringify({
          title,
          employer: jobTargetDraft.employer.trim() || undefined,
          location: jobTargetDraft.location.trim() || undefined,
          jobDescriptionText: jobTargetDraft.jobDescriptionText.trim() || undefined,
          isPrimary: true,
        }),
      }) as CreateJobTargetResponse;

      setJobTargetDraft({
        title: "",
        employer: "",
        location: "",
        jobDescriptionText: "",
      });
      setSelectedRole("");
      setJobTargetsNonce((value) => value + 1);
      setJobTargetAction({
        saving: false,
        settingPrimary: null,
        error: null,
        success: result.message,
        normalization: result.normalized,
      });
      saveNavigation.reloadAfterSave();
    } catch (error) {
      setJobTargetAction({
        saving: false,
        settingPrimary: null,
        error: error instanceof Error ? error.message : String(error),
        success: null,
        normalization: null,
      });
    }
  }

  async function handleSetPrimaryJobTarget(jobTargetId: string) {
    setJobTargetAction((current) => ({
      ...current,
      settingPrimary: jobTargetId,
      error: null,
      success: null,
    }));

    try {
      const result = await apiFetch("/students/me/job-targets/primary", {
        method: "PATCH",
        body: JSON.stringify({ jobTargetId }),
      }) as SetPrimaryJobTargetResponse;

      setSelectedRole("");
      setJobTargetsNonce((value) => value + 1);
      setJobTargetAction((current) => ({
        ...current,
        saving: false,
        settingPrimary: null,
        error: null,
        success: result.message,
      }));
    } catch (error) {
      setJobTargetAction((current) => ({
        ...current,
        saving: false,
        settingPrimary: null,
        error: error instanceof Error ? error.message : String(error),
        success: null,
      }));
    }
  }

  return (
    <AppShell
      title="Student dashboard"
      subtitle={`${directName}, track your target role, current readiness, academic progress, and the most important next move.`}
      secondaryNavTitle="Student sections"
      secondaryNavItems={[...studentSectionItems]}
      activeSecondaryNavKey={activeSection}
    >
      <RequireRole expectedRoles={["student", "admin"]} fallbackTitle="Student sign-in required">
        <ActiveCareerScenarioBanner
          scenario={activeCareerScenario.data?.activeScenario}
          linkHref="/career-scenarios"
          missingFallback="Create a Career Goal to see job-specific readiness guidance tied to a saved role or pasted job description."
        />

        <CareerScenarioComparisonSnapshot
          activeScenarioId={activeCareerScenario.data?.activeScenario?.careerScenarioId}
          listPath="/students/me/career-scenarios"
          buildItemPath={(careerScenarioId) =>
            `/students/me/career-scenarios/item?careerScenarioId=${encodeURIComponent(careerScenarioId)}`
          }
          linkHref="/career-scenarios"
          subjectLabel={directName}
        />

        {activeSection === "strategy" ? (
          <>
            <div data-intro-target="dashboard-overview">
              <SectionCard
                title="Current picture"
                subtitle="Start here for the current status, the main risk, the best next move, and what still needs to be filled in."
                tone="highlight"
              >
              {scoring.loading ? <p style={{ margin: 0 }}>Building your current snapshot...</p> : null}
              {scoring.error ? <p style={{ margin: 0, color: "crimson" }}>{scoring.error}</p> : null}
              {!scoring.loading && !scoring.error ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 14,
                  }}
                >
                  <div style={summaryTileStyle}>
                    <div style={{ color: "#5f728a", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.05 }}>
                      Current status
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>{trajectoryLabel}</div>
                    <div style={{ marginTop: 6, color: "#52657d", lineHeight: 1.55 }}>
                      {scoring.data?.scoring?.overallScore ?? "?"}/100 for {targetRoleLabel} in {targetSectorLabel}
                    </div>
                    <div style={{ marginTop: 8, color: "#22456f", fontWeight: 700 }}>
                      Evidence: {evidenceLabel(scoring.data?.scoring?.evidenceQuality?.overallEvidenceLevel)}
                    </div>
                  </div>
                  <div style={summaryTileStyle}>
                    <div style={{ color: "#5f728a", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.05 }}>
                      Main risk
                    </div>
                    <div style={{ marginTop: 8, lineHeight: 1.55 }}>{primaryRisk || "No specific concern is showing yet."}</div>
                  </div>
                  <div style={summaryTileStyle}>
                    <div style={{ color: "#5f728a", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.05 }}>
                      Best next move
                    </div>
                    <div style={{ marginTop: 8, lineHeight: 1.55 }}>
                      {topRecommendation?.title || "Add more student information to unlock a clearer next step."}
                    </div>
                  </div>
                  <div style={summaryTileStyle}>
                    <div style={{ color: "#5f728a", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.05 }}>
                      Evidence still missing
                    </div>
                    <div style={{ marginTop: 8, lineHeight: 1.55 }}>
                      {evidenceStillMissing.length
                        ? evidenceStillMissing.slice(0, 2).join(" ")
                        : "No major missing-evidence warning is showing right now."}
                    </div>
                  </div>
                </div>
              ) : null}
              </SectionCard>
            </div>

            <VisibleCoachFeedSection mode="student" />

            <div data-intro-target="next-actions">
              <SectionCard
                title="What is helping and what is still missing"
                subtitle="This explains why the score looks the way it does before you make any changes to the target role."
              >
              {explanation.loading ? <p>Building score explanation...</p> : null}
              {explanation.error ? <p style={{ color: "crimson" }}>{explanation.error}</p> : null}
              {!explanation.loading && !explanation.error && explanation.data?.explanation ? (
                <div style={{ display: "grid", gap: 16 }}>
                  <div
                    style={{
                      borderRadius: 18,
                      padding: 18,
                      background: "linear-gradient(135deg, color-mix(in srgb, var(--role-soft, #eef3f8) 82%, white), rgba(255,255,255,0.98))",
                      border: "1px solid rgba(148,163,184,0.28)",
                      display: "grid",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: 20 }}>
                        {explanation.data.explanation.summaryHeadline}
                      </div>
                      <div
                        style={{
                          borderRadius: 999,
                          padding: "8px 12px",
                          background: assessmentMode === "provisional" ? "#fff8e7" : "color-mix(in srgb, var(--role-soft, #eef3f8) 88%, white)",
                          color: assessmentMode === "provisional" ? "#7a5817" : "var(--role-accent, #22456f)",
                          fontWeight: 800,
                          fontSize: 13,
                        }}
                      >
                        {assessmentMode === "provisional" ? "Provisional read" : "Measured read"}
                      </div>
                    </div>
                    <p style={{ marginBottom: 0, color: "#334155", lineHeight: 1.7 }}>
                      {explanation.data.explanation.summaryText}
                    </p>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                      gap: 14,
                    }}
                  >
                    <div style={{ display: "grid", gap: 10 }}>
                      <strong>What is helping most</strong>
                      {explanation.data.explanation.strongestDrivers.map((driver) => (
                        <div
                          key={driver.key}
                          style={{
                            border: "1px solid #dbe4f0",
                            borderRadius: 14,
                            padding: 14,
                            background: "#fbfdff",
                          }}
                        >
                          <div style={{ fontWeight: 800 }}>{driver.label}</div>
                          <div style={{ color: "#155e75", marginTop: 4 }}>{driver.score}</div>
                          <div style={{ color: "#475569", marginTop: 6 }}>{driver.detail}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "grid", gap: 10 }}>
                      <strong>What needs work next</strong>
                      {explanation.data.explanation.biggestGaps.map((driver) => (
                        <div
                          key={driver.key}
                          style={{
                            border: "1px solid #f1d5db",
                            borderRadius: 14,
                            padding: 14,
                            background: "#fff7f8",
                          }}
                        >
                          <div style={{ fontWeight: 800 }}>{driver.label}</div>
                          <div style={{ color: "#b42318", marginTop: 4 }}>{driver.score}</div>
                          <div style={{ color: "#475569", marginTop: 6 }}>{driver.detail}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {evidenceStillMissing.length ? (
                    <div>
                      <strong>Evidence still missing</strong>
                      <ul style={{ marginBottom: 0 }}>
                        {evidenceStillMissing.map((alert) => <li key={alert}>{alert}</li>)}
                      </ul>
                    </div>
                  ) : null}

                  {explanation.data.explanation.immediateActions.length ? (
                    <div>
                      <strong>Best next actions</strong>
                      <ul style={{ marginBottom: 0 }}>
                        {explanation.data.explanation.immediateActions.map((action) => <li key={action}>{action}</li>)}
                      </ul>
                    </div>
                  ) : null}

                  {explanation.data.explanation.counterfactual ? (
                    <div
                      style={{
                      border: "1px solid #dbe4f0",
                      borderRadius: 16,
                      padding: 16,
                      background: "color-mix(in srgb, var(--role-soft, #eef3f8) 72%, white)",
                      display: "grid",
                      gap: 10,
                      }}
                    >
                      <strong>Comparison explanation: {titleCase(explanation.data.explanation.counterfactual.compareToRoleFamily)}</strong>
                      <div style={{ color: "#475569" }}>{explanation.data.explanation.counterfactual.summaryText}</div>
                      {explanation.data.explanation.counterfactual.biggestChanges.length ? (
                        <KeyValueList
                          items={explanation.data.explanation.counterfactual.biggestChanges.map((change) => ({
                            label: `${change.label} (${formatDelta(change.delta)})`,
                            value: change.detail,
                          }))}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
              </SectionCard>
            </div>

            <div data-intro-target="readiness-score">
              <SectionCard
                title="Score details"
                subtitle="Use this to confirm the target, the overall score, and whether the current read is measured or still provisional."
              >
              {scoring.loading ? <p>Loading scoring...</p> : null}
              {scoring.error ? <p style={{ color: "crimson" }}>{scoring.error}</p> : null}
              {!scoring.loading && !scoring.error ? (
                <div style={{ display: "grid", gap: 16 }}>
                  <KeyValueList
                    items={[
                      { label: "Saved exact target", value: primaryJobTarget?.title || "None saved" },
                      { label: "Target role", value: titleCase(scoring.data?.scoring?.targetRoleFamily) },
                      { label: "Target sector", value: titleCase(scoring.data?.scoring?.targetSectorCluster) },
                      { label: "Current status", value: titleCase(scoring.data?.scoring?.trajectoryStatus) },
                      { label: "Overall score", value: scoring.data?.scoring?.overallScore ?? "Unknown" },
                      { label: "Read type", value: assessmentMode === "provisional" ? "Provisional" : "Measured" },
                      {
                        label: "Evidence strength",
                        value: evidenceLabel(scoring.data?.scoring?.evidenceQuality?.overallEvidenceLevel),
                      },
                    ]}
                  />
                  {requirementProgress?.curriculumVerificationStatus !== "verified" ? (
                    <div
                      style={{
                        border: "1px solid #f2d9ad",
                        borderRadius: 16,
                        padding: "14px 16px",
                        background: "#fff8e7",
                        color: "#7a5817",
                        lineHeight: 1.6,
                      }}
                    >
                      Degree requirements must be reviewed before scoring because the readiness score depends on accurate curriculum information.
                    </div>
                  ) : null}
                  {scoring.data?.scoring?.evidenceQuality?.recommendedEvidenceActions?.length ? (
                    <div>
                      <strong>Fastest ways to improve confidence</strong>
                      <ul style={{ marginBottom: 0 }}>
                        {scoring.data.scoring.evidenceQuality.recommendedEvidenceActions.slice(0, 4).map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {evidenceKnown.length ? (
                    <div>
                      <strong>Evidence already on file</strong>
                      <ul style={{ marginBottom: 0 }}>
                        {evidenceKnown.slice(0, 5).map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </div>
                  ) : null}
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
            </div>

            <SectionCard
              title="Career Goal focus"
              subtitle="Saved exact targets and pasted job descriptions now live in Career Goal so you can compare multiple options without overwriting your baseline."
            >
              <div style={{ display: "grid", gap: 16 }}>
                {activeCareerScenario.data?.activeScenario ? (
                  <div className="ui-soft-panel">
                    <strong>{activeCareerScenario.data.activeScenario.scenarioName}</strong>
                    <p style={{ margin: "6px 0 0 0", color: "#475569", lineHeight: 1.6 }}>
                      {activeCareerScenario.data.activeScenario.targetRole ||
                        activeCareerScenario.data.activeScenario.targetProfession ||
                        "Target role not yet defined"}
                    </p>
                  </div>
                ) : (
                  <div
                    style={{
                      borderRadius: 18,
                      padding: 18,
                      background: "color-mix(in srgb, var(--role-soft, #eef3f8) 70%, white)",
                      border: "1px solid rgba(148, 163, 184, 0.18)",
                      color: "#475569",
                      lineHeight: 1.6,
                    }}
                  >
                    No active career goal exists yet. Create one to save a real job description, compare multiple roles, and make the dashboard more job-specific.
                  </div>
                )}
                {primaryJobTarget ? (
                  <div style={{ color: "#64748b", lineHeight: 1.6 }}>
                    Legacy saved target on file: <strong>{primaryJobTarget.title}</strong>. You can bring that into Career Goal as a fuller, named career goal without losing the older record.
                  </div>
                ) : null}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <Link href="/career-scenarios" className="ui-button ui-button--primary">
                    Open Career Goal
                  </Link>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Try another role path"
              subtitle="Use this to see how the score changes under a different path. Leave the first field empty to score against the saved exact target above."
            >
              <div style={{ display: "grid", gap: 16 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                    gap: 14,
                  }}
                >
                  <label style={{ display: "grid", gap: 6 }}>
                    <FieldInfoLabel
                      label="Temporary score override"
                      info="Preview scoring against a different role without changing your saved target."
                      example="Data Analyst"
                    />
                    <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
                      <option value="">Use saved exact target or inferred default</option>
                      {roleOptions.map((option) => (
                        <option key={option.canonicalName} value={option.canonicalName}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: "grid", gap: 6 }}>
                    <FieldInfoLabel
                      label="Compare against"
                      info="See how the score changes when you line your current path up with another role."
                      example="Clinical Research Coordinator"
                    />
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
                <div style={{ color: "#52657d", lineHeight: 1.6 }}>
                  {selectedRole
                    ? `The score preview is currently forced to ${titleCase(selectedRole)}.`
                    : primaryJobTarget
                      ? `The score preview is currently using the saved target "${primaryJobTarget.title}".`
                      : "No saved exact target exists yet, so the system is still using the inferred default role."}
                </div>
              </div>
            </SectionCard>
          </>
        ) : null}

        {activeSection === "evidence" ? (
          <>
            <SectionCard
              title="Academic evidence on file"
              subtitle="This shows how much the system currently understands about the transcript and degree path behind the score."
            >
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
              {usesLlmAssistedRequirements ? (
                <div
                  style={{
                    border: "1px solid #f2d9ad",
                    borderRadius: 14,
                    padding: "14px 16px",
                    background: "#fff8e7",
                    color: "#7a5817",
                    lineHeight: 1.6,
                  }}
                >
                  Coursework requirements for this program were populated with LLM assistance from official
                  school-page text rather than a directly parsed requirement source. Continue using them, but
                  review against the school catalog or upload a program PDF for a stronger source record.
                </div>
              ) : null}
              {transcript?.transcriptSummary ? (
                <div>
                  <strong>Transcript summary</strong>
                  <p style={{ marginBottom: 0, color: "#475569", lineHeight: 1.6 }}>{transcript.transcriptSummary}</p>
                </div>
              ) : null}
              <div>
                <strong>Missing or still-unmapped core requirements</strong>
                {requirementProgress?.missingRequiredCourses?.length ? (
                  <ul style={{ marginBottom: 0 }}>
                    {requirementProgress.missingRequiredCourses.map((course) => <li key={course}>{course}</li>)}
                  </ul>
                ) : (
                  <p style={{ marginBottom: 0, color: "#64748b" }}>No missing core requirement list is being shown yet.</p>
                )}
              </div>
              {requirementProgress?.sourceUrl ? (
                <div>
                  <strong>Requirement source</strong>
                  <p style={{ marginBottom: 0, color: "#475569", lineHeight: 1.6 }}>
                    <a href={requirementProgress.sourceUrl} target="_blank" rel="noreferrer">
                      {requirementProgress.sourceUrl}
                    </a>
                    {requirementProgress.sourceNote ? ` — ${requirementProgress.sourceNote}` : ""}
                  </p>
                </div>
              ) : requirementProgress?.sourceNote ? (
                <div>
                  <strong>Requirement source</strong>
                  <p style={{ marginBottom: 0, color: "#475569", lineHeight: 1.6 }}>
                    {requirementProgress.sourceNote}
                  </p>
                </div>
              ) : null}
                </div>
              ) : null}
            </SectionCard>

            <AcademicEvidenceSection mode="student" />

            <CurriculumVerificationSection
              title="Degree Requirements Review"
              subtitle={`${directName}, inspect the curriculum details below and confirm they look complete before relying on them for scoring.`}
              subjectLabel={directName}
            />

            <SectionCard
              title="Career market context"
              subtitle="These signals help explain the role environment and the skills the market is asking for."
              tone="quiet"
            >
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
          </>
        ) : null}

        {activeSection === "guidance" ? (
          <>
            <SectionCard
              title="What needs attention next"
              subtitle="Start with the next move, then use the breakdown below if you want to understand the detail."
            >
              {scoring.loading ? <p>Loading subscores...</p> : null}
              {scoring.error ? <p style={{ color: "crimson" }}>{scoring.error}</p> : null}
              {!scoring.loading && !scoring.error ? (
                <div style={{ display: "grid", gap: 16 }}>
              <div>
                <strong>Recommended next actions</strong>
                <ul style={{ marginBottom: 0 }}>
                  {(scoring.data?.scoring?.recommendations || []).slice(0, 5).map((item) => <li key={item.title}>{item.title}</li>)}
                </ul>
              </div>
              <div>
                <strong>Main risks</strong>
                <ul style={{ marginBottom: 0 }}>
                  {(scoring.data?.scoring?.topRisks || []).map((risk) => <li key={risk}>{risk}</li>)}
                </ul>
              </div>
              {evidenceStillMissing.length ? (
                <div>
                  <strong>Evidence still missing</strong>
                  <ul style={{ marginBottom: 0 }}>
                    {evidenceStillMissing.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              ) : null}
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
                    <div style={{ color: "#22456f", marginTop: 8, fontWeight: 700, fontSize: 14 }}>
                      Evidence: {evidenceLabel(scoring.data?.scoring?.subScoreDetails?.[key]?.evidenceLevel)}
                    </div>
                    <div style={{ color: "#52657d", marginTop: 6, lineHeight: 1.5, fontSize: 14 }}>
                      {scoring.data?.scoring?.subScoreDetails?.[key]?.explanation ||
                        "This area will become more reliable as more evidence is added."}
                    </div>
                  </div>
                ))}
              </div>
                </div>
              ) : null}
            </SectionCard>

            <SectionCard
              title="Ask for guidance"
              subtitle="Ask about a real decision or concern and the platform will turn the current student context into practical advice."
            >
              <div
                style={{
                  marginBottom: 18,
                  padding: 16,
                  borderRadius: 16,
                  background: "#f8fbff",
                  border: "1px solid #dbe4f0",
                  display: "grid",
                  gap: 8,
                }}
              >
                <strong>Communication preferences snapshot</strong>
                <div style={{ color: "#334155", lineHeight: 1.6 }}>
                  Profile completion: {communicationSummary.data?.completion?.student?.completionPercent ?? 0}%.
                  {(communicationSummary.data?.summary?.sharedThemes || []).length
                    ? ` Shared themes: ${communicationSummary.data?.summary?.sharedThemes?.join(", ")}.`
                    : " Add a few communication responses to help the system adapt its tone."}
                </div>
                <div>
                  <Link href="/communication?section=preferences">Open Communication preferences</Link>
                </div>
              </div>
              {(communicationMessages.data?.messages || []).length ? (
                <div
                  style={{
                    marginBottom: 18,
                    padding: 16,
                    borderRadius: 16,
                    background: "#f8fbff",
                    border: "1px solid #dbe4f0",
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <strong>Recent translated family message</strong>
                  <div style={{ color: "#334155", lineHeight: 1.7 }}>
                    {communicationMessages.data?.messages?.[0]?.messageBody}
                  </div>
                  <small style={{ color: "#64748b" }}>
                    Delivered via {titleCase(communicationMessages.data?.messages?.[0]?.selectedChannel)}{" "}
                    {communicationMessages.data?.messages?.[0]?.deliveredAt
                      ? `on ${new Date(communicationMessages.data.messages[0].deliveredAt as string).toLocaleString()}`
                      : ""}
                  </small>
                  <div>
                    <Link href="/student/messages">Open full message history</Link>
                  </div>
                </div>
              ) : null}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <FieldInfoLabel
                label="What do you want help thinking through?"
                info="Ask about a real decision, obstacle, or next step."
                example="Should I focus on one analytics project or networking first?"
              />
              <textarea
                value={draftQuestion}
                onChange={(e) => setDraftQuestion(e.target.value)}
                rows={4}
                style={{
                  width: "100%",
                  maxWidth: 720,
                  fontFamily: "inherit",
                  borderRadius: 18,
                  border: "1px solid rgba(73, 102, 149, 0.18)",
                  padding: "14px 16px",
                  background: "rgba(255,255,255,0.82)",
                }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 280 }}>
              <FieldInfoLabel
                label="How should the response feel?"
                info="Choose the style that would be easiest for you to use right now."
                example="Direct"
              />
              <select
                value={draftStyle}
                onChange={(e) => setDraftStyle(e.target.value)}
                style={{
                  borderRadius: 16,
                  border: "1px solid rgba(73, 102, 149, 0.18)",
                  padding: "12px 14px",
                  background: "rgba(255,255,255,0.82)",
                }}
              >
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
              className="ui-button ui-button--primary"
            >
              {scenario.loading ? "Processing…" : "Get guidance"}
            </button>
              </div>
              {scenario.loading ? <p>Processing Career Goal guidance...</p> : null}
              {scenario.error ? <p style={{ color: "crimson" }}>{scenario.error}</p> : null}
              {!scenario.loading && !scenario.error && !scenario.data?.response && requestedScenario ? (
                <p style={{ color: "#475569" }}>No Career Goal response was returned.</p>
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
          </>
        ) : null}

        {activeSection === "outcomes" ? <OutcomeTrackingSection mode="student" /> : null}
      </RequireRole>
    </AppShell>
  );
}
