"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "../../components/layout/AppShell";
import { SectionCard } from "../../components/layout/SectionCard";
import { KeyValueList } from "../../components/layout/KeyValueList";
import { SessionGate } from "../../components/SessionGate";
import { FieldInfoLabel } from "../../components/forms/FieldInfoLabel";
import { useAuthContext } from "../../hooks/useAuthContext";
import { useApiData } from "../../hooks/useApiData";
import { apiFetch } from "../../lib/apiClient";
import { compareCareerScenarios } from "../../lib/careerScenarioCompare";
import { buildDirectAddressName, formatNamedReference } from "../../lib/personalization";
import { workspaceHrefForRole } from "../../lib/workspaceAccess";
import type {
  CareerScenarioAnalysisResult,
  CareerScenarioRecord,
  CareerScenarioSummary,
} from "../../../../../packages/shared/src/contracts/careerScenario";
import type { CoachRosterItem } from "../../../../../packages/shared/src/contracts/coach";

type CareerScenarioListResponse = {
  ok: boolean;
  count: number;
  scenarios: CareerScenarioSummary[];
};

type CareerScenarioActiveResponse = {
  ok: boolean;
  activeScenario?: CareerScenarioRecord | null;
};

type CareerScenarioItemResponse = {
  ok: boolean;
  scenario: CareerScenarioRecord;
};

type CoachRosterResponse = {
  ok: boolean;
  count: number;
  roster: CoachRosterItem[];
};

type CareerScenarioFormState = {
  careerScenarioId?: string;
  scenarioName: string;
  jobDescriptionText: string;
  targetRole: string;
  targetProfession: string;
  targetIndustry: string;
  targetSector: string;
  targetGeography: string;
  employerName: string;
  jobPostingUrl: string;
  notes: string;
  assumptions: {
    skills: string;
    credentials: string;
    internships: string;
    projects: string;
    majorMinorConcentrationAssumptions: string;
    graduationTimeline: string;
    preferredGeographies: string;
  };
};

const blankForm: CareerScenarioFormState = {
  scenarioName: "",
  jobDescriptionText: "",
  targetRole: "",
  targetProfession: "",
  targetIndustry: "",
  targetSector: "",
  targetGeography: "",
  employerName: "",
  jobPostingUrl: "",
  notes: "",
  assumptions: {
    skills: "",
    credentials: "",
    internships: "",
    projects: "",
    majorMinorConcentrationAssumptions: "",
    graduationTimeline: "",
    preferredGeographies: "",
  },
};

function titleCase(value?: string | null) {
  if (!value) return "Not set";
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function csvToList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function listToCsv(values?: string[] | null): string {
  return (values || []).join(", ");
}

function mapScenarioToForm(scenario: CareerScenarioRecord): CareerScenarioFormState {
  return {
    careerScenarioId: scenario.careerScenarioId,
    scenarioName: scenario.scenarioName,
    jobDescriptionText: scenario.jobDescriptionText || "",
    targetRole: scenario.targetRole || "",
    targetProfession: scenario.targetProfession || "",
    targetIndustry: scenario.targetIndustry || "",
    targetSector: scenario.targetSector || "",
    targetGeography: scenario.targetGeography || "",
    employerName: scenario.employerName || "",
    jobPostingUrl: scenario.jobPostingUrl || "",
    notes: scenario.notes || "",
    assumptions: {
      skills: listToCsv(scenario.assumptions.skills),
      credentials: listToCsv(scenario.assumptions.credentials),
      internships: listToCsv(scenario.assumptions.internships),
      projects: listToCsv(scenario.assumptions.projects),
      majorMinorConcentrationAssumptions: listToCsv(scenario.assumptions.majorMinorConcentrationAssumptions),
      graduationTimeline: scenario.assumptions.graduationTimeline || "",
      preferredGeographies: listToCsv(scenario.assumptions.preferredGeographies),
    },
  };
}

function buildUpsertPayload(form: CareerScenarioFormState) {
  return {
    careerScenarioId: form.careerScenarioId,
    scenarioName: form.scenarioName,
    isActive: true,
    jobDescriptionText: form.jobDescriptionText || null,
    targetRole: form.targetRole || null,
    targetProfession: form.targetProfession || null,
    targetIndustry: form.targetIndustry || null,
    targetSector: form.targetSector || null,
    targetGeography: form.targetGeography || null,
    employerName: form.employerName || null,
    jobPostingUrl: form.jobPostingUrl || null,
    notes: form.notes || null,
    assumptions: {
      skills: csvToList(form.assumptions.skills),
      credentials: csvToList(form.assumptions.credentials),
      internships: csvToList(form.assumptions.internships),
      projects: csvToList(form.assumptions.projects),
      majorMinorConcentrationAssumptions: csvToList(form.assumptions.majorMinorConcentrationAssumptions),
      graduationTimeline: form.assumptions.graduationTimeline || null,
      preferredGeographies: csvToList(form.assumptions.preferredGeographies),
    },
    sourceType: form.jobDescriptionText.trim() ? "pasted_job_description" : "manual_target",
  };
}

function buildScenarioItemPath(args: {
  apiBase: string;
  careerScenarioId: string | null;
  role?: string | null;
  effectiveStudentProfileId?: string | null;
}) {
  if (!args.careerScenarioId) return "";
  const query = new URLSearchParams({ careerScenarioId: args.careerScenarioId });
  if (args.role === "coach" && args.effectiveStudentProfileId) {
    query.set("studentProfileId", args.effectiveStudentProfileId);
  }
  return `${args.apiBase}/item?${query.toString()}`;
}

function ScenarioResults(props: {
  scenario: CareerScenarioRecord;
  analysis: CareerScenarioAnalysisResult | null | undefined;
  onBack: () => void;
}) {
  const analysis = props.analysis;
  return (
    <SectionCard
      title="Career Goal result"
      subtitle="This view compares the saved Career Goal with the evidence the platform already has on file."
      testId="career-goal-result-card"
    >
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ color: "#64748b", fontSize: 13, fontWeight: 800, textTransform: "uppercase" }}>Active Career Goal</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{props.scenario.scenarioName}</div>
            <div style={{ color: "#475569" }}>
              {props.scenario.targetRole || props.scenario.targetProfession || "Target role not yet defined"}
            </div>
          </div>
          <button type="button" className="ui-button ui-button--secondary" onClick={props.onBack}>
            Back to Career Goal list
          </button>
        </div>

        <KeyValueList
          items={[
            { label: "Status", value: titleCase(props.scenario.status) },
            { label: "Source", value: titleCase(props.scenario.sourceType) },
            { label: "Last analysis", value: props.scenario.lastRunAt ? new Date(props.scenario.lastRunAt).toLocaleString() : "Not yet run" },
          ]}
        />

        {analysis ? (
          <div style={{ display: "grid", gap: 14 }}>
            <div className="ui-soft-panel">
              <strong>{titleCase(analysis.qualificationLabel)} Career Goal fit</strong>
              <p style={{ margin: "6px 0 0 0", color: "#475569", lineHeight: 1.6 }}>{analysis.summary}</p>
            </div>
            {props.scenario.actionItems?.length ? (
              <div className="ui-soft-panel" style={{ background: "#f8fbff" }}>
                <strong>Career Goal action items</strong>
                <ul style={{ marginBottom: 0 }}>
                  {props.scenario.actionItems.map((item) => <li key={item.careerScenarioActionItemId}>{item.title}</li>)}
                </ul>
              </div>
            ) : analysis.scenarioSpecificActions?.length ? (
              <div className="ui-soft-panel" style={{ background: "#f8fbff" }}>
                <strong>Career Goal-specific next actions</strong>
                <ul style={{ marginBottom: 0 }}>
                  {analysis.scenarioSpecificActions.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            ) : null}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <div className="ui-soft-panel">
                <strong>Strengths</strong>
                <ul style={{ marginBottom: 0 }}>
                  {(analysis.matchedStrengths || []).map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
              <div className="ui-soft-panel">
                <strong>Gaps</strong>
                <ul style={{ marginBottom: 0 }}>
                  {(analysis.likelyGaps || []).map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
              <div className="ui-soft-panel">
                <strong>Missing evidence</strong>
                <ul style={{ marginBottom: 0 }}>
                  {(analysis.missingEvidence || []).map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
              <div className="ui-soft-panel">
                <strong>Recommended actions</strong>
                <ul style={{ marginBottom: 0 }}>
                  {(analysis.recommendedActions || []).map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <div className="ui-soft-panel">
                <strong>Academic implications</strong>
                <ul style={{ marginBottom: 0 }}>
                  {(analysis.academicImplications || []).map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
              <div className="ui-soft-panel">
                <strong>Skills implications</strong>
                <ul style={{ marginBottom: 0 }}>
                  {(analysis.skillsImplications || []).map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
              <div className="ui-soft-panel">
                <strong>Experience implications</strong>
                <ul style={{ marginBottom: 0 }}>
                  {(analysis.experienceImplications || []).map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
              <div className="ui-soft-panel">
                <strong>Curriculum implications</strong>
                <ul style={{ marginBottom: 0 }}>
                  {(analysis.curriculumImplications || []).map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            </div>
            {(analysis.warnings || []).length ? (
              <div className="ui-soft-panel" style={{ borderColor: "rgba(180, 83, 9, 0.22)", background: "#fff7ed" }}>
                <strong>Confidence notes</strong>
                <ul style={{ marginBottom: 0 }}>
                  {analysis.warnings.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <p style={{ margin: 0, color: "#64748b" }}>This Career Goal has not been analyzed yet.</p>
        )}
      </div>
    </SectionCard>
  );
}

function ScenarioComparisonSection(props: {
  left: CareerScenarioRecord | null | undefined;
  right: CareerScenarioRecord | null | undefined;
  leftId: string;
  rightId: string;
  scenarios: CareerScenarioSummary[];
  disabled?: boolean;
  onChangeLeft: (value: string) => void;
  onChangeRight: (value: string) => void;
}) {
  const comparison = compareCareerScenarios(props.left, props.right);

  return (
    <SectionCard
      title="Compare Career Goals"
      subtitle="Review two saved Career Goals side by side so you can see how different targets change score, gaps, and next actions."
      testId="career-goal-compare-card"
    >
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <FieldInfoLabel
              label="Career Goal A"
              info="Choose the first saved Career Goal to compare."
              example="Pfizer data analyst"
            />
            <select value={props.leftId} onChange={(event) => props.onChangeLeft(event.target.value)} disabled={props.disabled}>
              {props.scenarios.map((scenario) => (
                <option key={scenario.careerScenarioId} value={scenario.careerScenarioId}>
                  {scenario.scenarioName}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <FieldInfoLabel
              label="Career Goal B"
              info="Choose the second saved Career Goal to compare."
              example="Pfizer analytics consultant"
            />
            <select value={props.rightId} onChange={(event) => props.onChangeRight(event.target.value)} disabled={props.disabled}>
              {props.scenarios
                .filter((scenario) => scenario.careerScenarioId !== props.leftId || props.scenarios.length === 1)
                .map((scenario) => (
                  <option key={scenario.careerScenarioId} value={scenario.careerScenarioId}>
                    {scenario.scenarioName}
                  </option>
                ))}
            </select>
          </label>
        </div>

        {!comparison ? (
          <p style={{ margin: 0, color: "#64748b" }}>Choose two saved Career Goals to compare them side by side.</p>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            <KeyValueList
              items={[
                {
                  label: "Overall score change",
                  value:
                    comparison.overallScoreDelta == null
                      ? "Not available"
                      : `${comparison.rightScenarioName} ${comparison.overallScoreDelta >= 0 ? "+" : ""}${comparison.overallScoreDelta} vs ${comparison.leftScenarioName}`,
                },
                {
                  label: "Qualification shift",
                  value: comparison.qualificationShift || "Not available",
                },
              ]}
            />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
              {[props.left, props.right].map((scenario, index) => (
                <div key={scenario?.careerScenarioId || index} className="ui-soft-panel">
                    <strong>{scenario?.scenarioName || (index === 0 ? "Career Goal A" : "Career Goal B")}</strong>
                  <div style={{ color: "#475569", marginTop: 6 }}>
                    {scenario?.targetRole || scenario?.targetProfession || "Target role not yet defined"}
                  </div>
                  <div style={{ color: "#64748b", marginTop: 8 }}>
                    Score: {typeof scenario?.readinessScoreSnapshot?.overallScore === "number" ? scenario.readinessScoreSnapshot.overallScore : "Not available"}
                    {scenario?.analysisResult?.qualificationLabel ? ` · ${titleCase(scenario.analysisResult.qualificationLabel)}` : ""}
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <strong>Career Goal-specific actions</strong>
                    <ul style={{ marginBottom: 0 }}>
                      {(index === 0 ? comparison.leftActions : comparison.rightActions).map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <strong>Distinct gaps</strong>
                    <ul style={{ marginBottom: 0 }}>
                      {(index === 0 ? comparison.distinctLeftGaps : comparison.distinctRightGaps).map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

function CareerScenarioContent() {
  const auth = useAuthContext();
  const role = auth.data?.context?.authenticatedRoleType;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [nonce, setNonce] = useState(0);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [comparisonLeftId, setComparisonLeftId] = useState<string | null>(null);
  const [comparisonRightId, setComparisonRightId] = useState<string | null>(null);
  const [form, setForm] = useState<CareerScenarioFormState>(blankForm);
  const [state, setState] = useState<{ saving: boolean; error: string | null; success: string | null }>({
    saving: false,
    error: null,
    success: null,
  });

  const roster = useApiData<CoachRosterResponse>("/coaches/me/roster", role === "coach", nonce);
  const coachStudentProfileId =
    role === "coach"
      ? searchParams.get("studentProfileId") || roster.data?.roster?.[0]?.studentProfileId || null
      : null;
  const effectiveStudentProfileId = role === "coach" ? coachStudentProfileId : auth.data?.context?.studentProfileId || null;
  const selectedCoachRelationship =
    role === "coach"
      ? roster.data?.roster?.find((item) => item.studentProfileId === effectiveStudentProfileId) || null
      : null;
  const canEdit =
    role === "student" ||
    role === "admin" ||
    (role === "coach" && !!selectedCoachRelationship?.permissions?.createRecommendations);

  const apiBase = useMemo(() => {
    if (role === "parent") return "/parents/me/career-scenarios";
    if (role === "coach") return "/coaches/me/career-scenarios";
    return "/students/me/career-scenarios";
  }, [role]);

  const listPath = useMemo(() => {
    if (role === "coach" && effectiveStudentProfileId) {
      return `${apiBase}?studentProfileId=${encodeURIComponent(effectiveStudentProfileId)}`;
    }
    return apiBase;
  }, [apiBase, role, effectiveStudentProfileId]);

  const activePath = useMemo(() => {
    if (role === "coach" && effectiveStudentProfileId) {
      return `${apiBase}/active?studentProfileId=${encodeURIComponent(effectiveStudentProfileId)}`;
    }
    return `${apiBase}/active`;
  }, [apiBase, role, effectiveStudentProfileId]);

  const itemPath = useMemo(
    () =>
      buildScenarioItemPath({
        apiBase,
        careerScenarioId: selectedScenarioId,
        role,
        effectiveStudentProfileId,
      }),
    [apiBase, effectiveStudentProfileId, role, selectedScenarioId]
  );
  const comparisonLeftPath = useMemo(
    () =>
      buildScenarioItemPath({
        apiBase,
        careerScenarioId: comparisonLeftId,
        role,
        effectiveStudentProfileId,
      }),
    [apiBase, comparisonLeftId, effectiveStudentProfileId, role]
  );
  const comparisonRightPath = useMemo(
    () =>
      buildScenarioItemPath({
        apiBase,
        careerScenarioId: comparisonRightId,
        role,
        effectiveStudentProfileId,
      }),
    [apiBase, comparisonRightId, effectiveStudentProfileId, role]
  );

  const list = useApiData<CareerScenarioListResponse>(listPath, !!role && (role !== "coach" || !!effectiveStudentProfileId), nonce);
  const active = useApiData<CareerScenarioActiveResponse>(activePath, !!role && (role !== "coach" || !!effectiveStudentProfileId), nonce);
  const selectedScenario = useApiData<CareerScenarioItemResponse>(itemPath, !!selectedScenarioId, nonce);
  const comparisonLeft = useApiData<CareerScenarioItemResponse>(comparisonLeftPath, !!comparisonLeftId, nonce);
  const comparisonRight = useApiData<CareerScenarioItemResponse>(comparisonRightPath, !!comparisonRightId, nonce);

  useEffect(() => {
    if (selectedScenario.data?.scenario) {
      setForm(mapScenarioToForm(selectedScenario.data.scenario));
    }
  }, [selectedScenario.data?.scenario]);

  const scenarios = list.data?.scenarios || [];
  const activeScenario = active.data?.activeScenario || null;

  useEffect(() => {
    if (!scenarios.length) {
      setComparisonLeftId(null);
      setComparisonRightId(null);
      return;
    }

    const preferredLeft =
      selectedScenarioId ||
      activeScenario?.careerScenarioId ||
      scenarios[0]?.careerScenarioId ||
      null;
    const preferredRight =
      scenarios.find((item) => item.careerScenarioId !== preferredLeft)?.careerScenarioId ||
      preferredLeft;

    setComparisonLeftId((current) => {
      if (current && scenarios.some((item) => item.careerScenarioId === current)) {
        return current;
      }
      return preferredLeft;
    });
    setComparisonRightId((current) => {
      if (current && scenarios.some((item) => item.careerScenarioId === current) && current !== preferredLeft) {
        return current;
      }
      return preferredRight;
    });
  }, [activeScenario?.careerScenarioId, scenarios, selectedScenarioId]);

  const directName =
    buildDirectAddressName({
      preferredName: auth.data?.context?.authenticatedPreferredName,
      firstName: auth.data?.context?.authenticatedFirstName,
      lastName: auth.data?.context?.authenticatedLastName,
      fallback: "you",
    }) || "you";

  const studentReference =
    role === "parent" || role === "coach"
      ? formatNamedReference(
          {
            preferredName: auth.data?.context?.studentPreferredName,
            firstName: auth.data?.context?.studentFirstName,
            lastName: auth.data?.context?.studentLastName,
          },
          { fallback: role === "parent" ? "your student" : "this student", preferPreferred: true }
        )
      : directName;

  async function runAction(
    path: string,
    body: Record<string, unknown>,
    success: string,
    opts?: { resetToBlank?: boolean; useResponseScenario?: boolean }
  ) {
    setState({ saving: true, error: null, success: null });
    try {
      const response = await apiFetch(path, {
        method: "POST",
        body: JSON.stringify(
          role === "coach" && effectiveStudentProfileId
            ? { ...body, studentProfileId: effectiveStudentProfileId }
            : body
        ),
      });
      if (opts?.useResponseScenario && response?.scenario?.careerScenarioId) {
        setSelectedScenarioId(response.scenario.careerScenarioId);
      }
      if (opts?.resetToBlank) {
        setSelectedScenarioId(null);
        setForm(blankForm);
      }
      setNonce((value) => value + 1);
      setState({ saving: false, error: null, success });
    } catch (error: any) {
      setState({ saving: false, error: error?.message || "Request failed", success: null });
    }
  }

  return (
    <AppShell
      title="Career Goal"
      subtitle={`Use saved career goals to compare how well ${studentReference} lines up with a real target role, job description, or profession.`}
      backAction={false}
    >
      {role === "coach" ? (
        <SectionCard
          title="Selected student"
          subtitle="Career goals always stay scoped to the student you are actively working with."
          testId="career-goal-selected-student-card"
        >
          {roster.loading ? <p>Loading coach roster...</p> : null}
          {roster.error ? <p style={{ color: "crimson" }}>{roster.error}</p> : null}
          {!roster.loading ? (
            <div style={{ display: "grid", gap: 10, maxWidth: 420 }}>
              <select
                value={effectiveStudentProfileId || ""}
                onChange={(event) => {
                  const next = event.target.value;
                  router.replace(next ? `/career-scenarios?studentProfileId=${encodeURIComponent(next)}` : "/career-scenarios");
                  setSelectedScenarioId(null);
                  setComparisonLeftId(null);
                  setComparisonRightId(null);
                  setForm(blankForm);
                  setState({ saving: false, error: null, success: null });
                }}
              >
                {(roster.data?.roster || []).map((item) => (
                  <option key={item.studentProfileId} value={item.studentProfileId}>
                    {item.studentDisplayName}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </SectionCard>
      ) : null}

      <SectionCard
        title="Career Goal workspace"
        subtitle={
          activeScenario
            ? `Active career goal: ${activeScenario.scenarioName}. Dashboards now read readiness in that job-specific context.`
            : "Create a Career Goal to see job-specific readiness guidance."
        }
        testId="career-goal-workspace-card"
        introTarget="career-goal-workspace"
      >
        <div style={{ display: "grid", gap: 16 }}>
          <KeyValueList
            items={[
              { label: "Active career goal", value: activeScenario?.scenarioName || "None selected" },
              { label: "Target role", value: activeScenario?.targetRole || activeScenario?.targetProfession || "Not set" },
              { label: "Status", value: titleCase(activeScenario?.status) },
            ]}
          />
          {activeScenario?.status === "needs_rerun" ? (
            <div className="ui-soft-panel" style={{ background: "#fff7ed", borderColor: "rgba(180,83,9,0.22)" }}>
              <strong>Career Goal needs rerun</strong>
              <p style={{ margin: "6px 0 0 0", color: "#7c2d12", lineHeight: 1.6 }}>
                Student information or evidence changed after the last analysis, so this career goal should be re-run before you treat it as current.
              </p>
            </div>
          ) : null}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              className="ui-button ui-button--primary"
              onClick={() => {
                setSelectedScenarioId(null);
                setForm(blankForm);
                setState({ saving: false, error: null, success: null });
              }}
              disabled={!canEdit}
            >
              Create new Career Goal
            </button>
            <Link className="ui-button ui-button--secondary" href={workspaceHrefForRole(role || null)}>
              Back to dashboard
            </Link>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Saved Career Goals"
        subtitle="Switch between saved career goals, promote one to active, or remove old what-if cases when they are no longer useful."
        testId="career-goal-saved-list-card"
      >
        {list.loading ? <p>Loading saved career goals...</p> : null}
        {list.error ? <p style={{ color: "crimson" }}>{list.error}</p> : null}
        {!list.loading && !scenarios.length ? (
          <p style={{ margin: 0, color: "#64748b" }}>No career goals have been saved yet. Create one to start comparing career directions.</p>
        ) : null}
        <div style={{ display: "grid", gap: 12 }}>
          {scenarios.map((scenario) => (
            <div
              key={scenario.careerScenarioId}
              data-testid={`career-goal-saved-item-${scenario.careerScenarioId}`}
              style={{
                border: "1px solid #dbe4f0",
                borderRadius: 18,
                padding: 16,
                background: scenario.isActive ? "#f8fbff" : "#fff",
                display: "grid",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18 }}>{scenario.scenarioName}</div>
                  <div style={{ color: "#475569" }}>{scenario.targetRole || scenario.targetProfession || "Target not yet defined"}</div>
                </div>
                <div style={{ color: "#64748b", fontSize: 14 }}>
                  {scenario.isActive ? "Active" : titleCase(scenario.status)}
                </div>
              </div>
              <KeyValueList
                items={[
                  { label: "Source", value: titleCase(scenario.sourceType) },
                  { label: "Last run", value: scenario.lastRunAt ? new Date(scenario.lastRunAt).toLocaleString() : "Not yet run" },
                ]}
              />
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button type="button" className="ui-button ui-button--secondary" onClick={() => setSelectedScenarioId(scenario.careerScenarioId)}>
                  Open Career Goal
                </button>
                {scenarios.length > 1 ? (
                  <button
                    type="button"
                    className="ui-button ui-button--secondary"
                    onClick={() => {
                      setComparisonLeftId(activeScenario?.careerScenarioId || scenario.careerScenarioId);
                      setComparisonRightId(scenario.careerScenarioId);
                    }}
                  >
                    Compare Career Goals
                  </button>
                ) : null}
                {canEdit && !scenario.isActive ? (
                  <button
                    type="button"
                    className="ui-button ui-button--secondary"
                    onClick={() =>
                      runAction(`${apiBase}/set-active`, { careerScenarioId: scenario.careerScenarioId }, "Active Career Goal updated", {
                        useResponseScenario: true,
                      })
                    }
                  >
                    Set as active
                  </button>
                ) : null}
                {canEdit ? (
                  <button
                    type="button"
                    className="ui-button ui-button--secondary"
                    onClick={() => {
                      const nextName = `${scenario.scenarioName} copy`;
                      void runAction(`${apiBase}/duplicate`, { careerScenarioId: scenario.careerScenarioId, newName: nextName }, "Career Goal duplicated", {
                        useResponseScenario: true,
                      });
                    }}
                  >
                    Duplicate Career Goal
                  </button>
                ) : null}
                {canEdit ? (
                  <button
                    type="button"
                    className="ui-button ui-button--secondary"
                    onClick={() => {
                      if (!window.confirm("Delete this Career Goal? This removes it from your saved Career Goals but does not delete student information.")) {
                        return;
                      }
                      void runAction(`${apiBase}/delete`, { careerScenarioId: scenario.careerScenarioId }, "Career Goal deleted", {
                        resetToBlank: selectedScenarioId === scenario.careerScenarioId,
                      });
                    }}
                  >
                    Delete Career Goal
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {scenarios.length > 1 ? (
        <ScenarioComparisonSection
          left={comparisonLeft.data?.scenario || null}
          right={comparisonRight.data?.scenario || null}
          leftId={comparisonLeftId || scenarios[0]?.careerScenarioId || ""}
          rightId={
            comparisonRightId ||
            scenarios.find((item) => item.careerScenarioId !== (comparisonLeftId || scenarios[0]?.careerScenarioId))?.careerScenarioId ||
            scenarios[0]?.careerScenarioId ||
            ""
          }
          scenarios={scenarios}
          disabled={list.loading}
          onChangeLeft={(value) => {
            setComparisonLeftId(value);
            if (value === comparisonRightId) {
              const alternate = scenarios.find((item) => item.careerScenarioId !== value)?.careerScenarioId || value;
              setComparisonRightId(alternate);
            }
          }}
          onChangeRight={(value) => setComparisonRightId(value)}
        />
      ) : null}

      <SectionCard
        title={selectedScenarioId ? "Edit Career Goal" : "New Career Goal"}
        subtitle="Paste a real job description, refine the target assumptions, then save or re-run the Career Goal to see role-specific readiness guidance."
        testId="career-goal-editor-card"
      >
        {!canEdit ? (
          <p style={{ margin: 0, color: "#64748b" }}>
            This account can review saved Career Goals for {studentReference}, but editing stays with the student or an authorized coach workflow.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <FieldInfoLabel
                  label="Career Goal name"
                  info="Use a unique name so you can compare this target against other roles later."
                  example="Johnson & Johnson Quality Analyst"
                />
                <input value={form.scenarioName} onChange={(event) => setForm((current) => ({ ...current, scenarioName: event.target.value }))} />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <FieldInfoLabel
                  label="Target role or profession"
                  info="Name the job title, profession, or direction you want this Career Goal to represent."
                  example="Data Analyst"
                />
                <input value={form.targetRole} onChange={(event) => setForm((current) => ({ ...current, targetRole: event.target.value }))} />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <FieldInfoLabel label="Employer (optional)" info="Add the organization if this Career Goal is tied to a specific posting." example="JPMorgan Chase" />
                <input value={form.employerName} onChange={(event) => setForm((current) => ({ ...current, employerName: event.target.value }))} />
              </label>
            </div>

            <label style={{ display: "grid", gap: 6 }}>
              <FieldInfoLabel
                label="Pasted job description"
                info="Paste a real job posting or a realistic career-target description. The system will compare it against the student information already on file."
                example="Responsibilities include SQL analysis, dashboard reporting, stakeholder communication, and internship experience."
              />
              <textarea
                rows={8}
                value={form.jobDescriptionText}
                onChange={(event) => setForm((current) => ({ ...current, jobDescriptionText: event.target.value }))}
                style={{ width: "100%", borderRadius: 18, border: "1px solid rgba(73, 102, 149, 0.18)", padding: "14px 16px", fontFamily: "inherit" }}
              />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <FieldInfoLabel label="Target profession" info="Use this if the role title and the broader profession are not the same." example="Clinical research" />
                <input value={form.targetProfession} onChange={(event) => setForm((current) => ({ ...current, targetProfession: event.target.value }))} />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <FieldInfoLabel label="Industry or sector" info="Use the industry context you want the dashboard to assume for this Career Goal." example="Fintech" />
                <input value={form.targetSector} onChange={(event) => setForm((current) => ({ ...current, targetSector: event.target.value }))} />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <FieldInfoLabel label="Geography" info="Use a city, region, or remote assumption if location affects the target." example="New York metro" />
                <input value={form.targetGeography} onChange={(event) => setForm((current) => ({ ...current, targetGeography: event.target.value }))} />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <FieldInfoLabel label="Job posting URL" info="Paste the posting link if you want to keep a traceable source." example="https://careers.example.com/jobs/123" />
                <input value={form.jobPostingUrl} onChange={(event) => setForm((current) => ({ ...current, jobPostingUrl: event.target.value }))} />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <FieldInfoLabel label="Skills assumptions" info="Add extra skill assumptions that should travel with this Career Goal." example="SQL, Tableau, stakeholder communication" />
                <input value={form.assumptions.skills} onChange={(event) => setForm((current) => ({ ...current, assumptions: { ...current.assumptions, skills: event.target.value } }))} />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <FieldInfoLabel label="Credentials assumptions" info="Add certifications or credentials that matter for this target." example="CPA, RN license" />
                <input value={form.assumptions.credentials} onChange={(event) => setForm((current) => ({ ...current, assumptions: { ...current.assumptions, credentials: event.target.value } }))} />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <FieldInfoLabel label="Projects or internships assumptions" info="Add the kinds of experience this path expects, even if the student does not have them yet." example="Summer analyst internship, capstone dashboard project" />
                <input value={form.assumptions.projects} onChange={(event) => setForm((current) => ({ ...current, assumptions: { ...current.assumptions, projects: event.target.value } }))} />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <FieldInfoLabel label="Graduation timeline assumption" info="Use this if the Career Goal depends on a tighter or slower graduation path." example="Graduate by May 2027" />
                <input value={form.assumptions.graduationTimeline} onChange={(event) => setForm((current) => ({ ...current, assumptions: { ...current.assumptions, graduationTimeline: event.target.value } }))} />
              </label>
            </div>

            <label style={{ display: "grid", gap: 6 }}>
              <FieldInfoLabel label="Career Goal notes" info="Capture assumptions, hiring context, or details you want to remember when you return to this Career Goal." example="Treat this as a stretch target for next summer." />
              <textarea
                rows={4}
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                style={{ width: "100%", borderRadius: 18, border: "1px solid rgba(73, 102, 149, 0.18)", padding: "14px 16px", fontFamily: "inherit" }}
              />
            </label>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              {selectedScenarioId ? (
                <button
                  type="button"
                  className="ui-button ui-button--secondary"
                  onClick={() => {
                    setSelectedScenarioId(null);
                    setForm(blankForm);
                    setState({ saving: false, error: null, success: null });
                  }}
                >
                  Back to Career Goal list
                </button>
              ) : null}
              <button
                type="button"
                className="ui-button ui-button--primary"
                disabled={state.saving}
                onClick={() => {
                  const payload = buildUpsertPayload(form);
                  void runAction(
                    form.careerScenarioId ? `${apiBase}/update` : apiBase,
                    payload,
                    form.careerScenarioId ? "Career Goal updated" : "Career Goal saved",
                    { useResponseScenario: true }
                  );
                }}
              >
                {state.saving ? "Saving..." : form.careerScenarioId ? "Save Career Goal" : "Save Career Goal"}
              </button>

              {form.careerScenarioId ? (
                <button
                  type="button"
                  className="ui-button ui-button--secondary"
                  disabled={state.saving}
                  onClick={() => {
                    const payload = buildUpsertPayload({ ...form, careerScenarioId: undefined });
                    void runAction(apiBase, payload, "Career Goal saved as new", { useResponseScenario: true });
                  }}
                >
                  Save as new Career Goal
                </button>
              ) : null}

              {form.careerScenarioId ? (
                <button
                  type="button"
                  className="ui-button ui-button--secondary"
                  disabled={state.saving}
                  onClick={() => void runAction(`${apiBase}/analyze`, { careerScenarioId: form.careerScenarioId }, "Career Goal analysis refreshed", { useResponseScenario: true })}
                >
                  Run or re-run analysis
                </button>
              ) : null}

              {state.success ? <span style={{ color: "#166534" }}>{state.success}</span> : null}
              {state.error ? <span style={{ color: "crimson" }}>{state.error}</span> : null}
            </div>
          </div>
        )}
      </SectionCard>

      {selectedScenario.data?.scenario ? (
        <ScenarioResults
          scenario={selectedScenario.data.scenario}
          analysis={selectedScenario.data.scenario.analysisResult}
          onBack={() => {
            setSelectedScenarioId(null);
            setForm(blankForm);
          }}
        />
      ) : null}
    </AppShell>
  );
}

export default function CareerScenarioPage() {
  return (
    <SessionGate fallbackTitle="Sign in required">
      <CareerScenarioContent />
    </SessionGate>
  );
}
