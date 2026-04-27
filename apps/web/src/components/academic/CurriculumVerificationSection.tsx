"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SectionCard } from "../layout/SectionCard";
import { KeyValueList } from "../layout/KeyValueList";
import { FieldInfoLabel } from "../forms/FieldInfoLabel";
import { useApiData } from "../../hooks/useApiData";
import { apiFetch } from "../../lib/apiClient";
import { useSaveNavigation } from "../../lib/saveNavigation";

type CurriculumReviewResponse = {
  ok: boolean;
  curriculum: {
    verification: {
      curriculumVerificationStatus: "missing" | "present_unverified" | "verified" | "needs_attention";
      effectiveStatus: "missing" | "present_unverified" | "verified" | "needs_attention";
      curriculumVerifiedAt?: string | null;
      curriculumVerificationNotes?: string | null;
      curriculumRequestedAt?: string | null;
      coachReviewedAt?: string | null;
      canVerify: boolean;
      canRequestPopulation: boolean;
      canUploadPdf: boolean;
      canCoachReview: boolean;
    };
    summary: {
      institutionName?: string | null;
      degreeProgram?: string | null;
      major?: string | null;
      catalogYear?: string | null;
      requirementSetSummary?: string | null;
      completionPercent?: number | null;
      completenessIndicator: "missing" | "partial" | "good";
      sourceLabel: string;
      sourceUrl?: string | null;
      sourceNote?: string | null;
      totalRequirementGroups: number;
      totalRequirementItems: number;
    };
    details: {
      creditRequirements?: number | null;
      requirementGroups: Array<{
        requirementGroupId: string;
        groupName: string;
        groupType: string;
        minCoursesRequired?: number | null;
        minCreditsRequired?: number | null;
        notes?: string | null;
        items: Array<{
          requirementItemId: string;
          itemType: string;
          label: string;
          creditsIfUsed?: number | null;
          uncertain: boolean;
        }>;
      }>;
      missingOrUncertainFields: string[];
      parsingNotes: string[];
      latestPdfUploadId?: string | null;
    };
    alerts: Array<{
      level: "high" | "info";
      code: "missing_curriculum" | "unverified_curriculum" | "verified_curriculum";
      message: string;
    }>;
  };
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Not yet";
  return new Date(value).toLocaleString();
}

function statusTone(status: string) {
  switch (status) {
    case "verified":
      return {
        badge: "Verified",
        border: "#b7e4cf",
        background: "#ecfdf3",
        color: "#166534",
      };
    case "missing":
      return {
        badge: "Missing",
        border: "#fecaca",
        background: "#fff5f5",
        color: "#b42318",
      };
    default:
      return {
        badge: "Needs review",
        border: "#f2d9ad",
        background: "#fff8e7",
        color: "#7a5817",
      };
  }
}

function buildStudentCurriculumReviewHref() {
  return "/student?section=evidence#curriculum-review";
}

function buildParentCurriculumNudgeHref(subjectLabel: string, studentProfileId?: string | null) {
  const params = new URLSearchParams({
    section: "translator",
    prefillGoal: "reminder",
    prefillTone: "gentle",
    prefillMessage: `${subjectLabel} still needs to review and approve the degree requirements so the readiness score is working from accurate curriculum information. Please complete that review this week and flag anything that looks incomplete or wrong.`,
  });
  if (studentProfileId) {
    params.set("studentProfileId", studentProfileId);
  }
  return `/communication?${params.toString()}`;
}

function buildCoachCommunicationContextHref(studentProfileId?: string | null) {
  const params = new URLSearchParams({
    section: "context",
    coachPrompt: "curriculum_review_nudge",
  });
  if (studentProfileId) {
    params.set("studentProfileId", studentProfileId);
  }
  return `/communication?${params.toString()}`;
}

function buildCoachReminderDraftHref(subjectLabel: string, studentProfileId?: string | null) {
  const params = new URLSearchParams({
    prefillRecipientType: "student",
    prefillMessageSubject: "Please review your degree requirements",
    prefillMessageBody: `${subjectLabel} still needs to review and approve the degree requirements so scoring can be trusted. Please complete that review and confirm whether anything looks incomplete, outdated, or inaccurate.`,
  });
  if (studentProfileId) {
    params.set("studentProfileId", studentProfileId);
  }
  return `/coach?${params.toString()}#coach-follow-up-message`;
}

export function CurriculumVerificationSection(props: {
  title?: string;
  subtitle?: string;
  uploadHref?: string;
  subjectLabel?: string;
  selectedStudentProfileId?: string | null;
  mode?: "student" | "parent" | "coach";
}) {
  const saveNavigation = useSaveNavigation();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [confirmReviewed, setConfirmReviewed] = useState(false);
  const [verificationNotes, setVerificationNotes] = useState("");
  const [actionState, setActionState] = useState<{
    saving: boolean;
    requesting: boolean;
    coachReviewing: boolean;
    error: string | null;
    success: string | null;
  }>({
    saving: false,
    requesting: false,
    coachReviewing: false,
    error: null,
    success: null,
  });

  const reviewPath = props.selectedStudentProfileId
    ? `/students/me/academic/curriculum-review?studentProfileId=${encodeURIComponent(props.selectedStudentProfileId)}`
    : "/students/me/academic/curriculum-review";
  const verifyPath = props.selectedStudentProfileId
    ? `/students/me/academic/curriculum-review/verify?studentProfileId=${encodeURIComponent(props.selectedStudentProfileId)}`
    : "/students/me/academic/curriculum-review/verify";
  const requestPopulationPath = props.selectedStudentProfileId
    ? `/students/me/academic/curriculum-review/request-population?studentProfileId=${encodeURIComponent(props.selectedStudentProfileId)}`
    : "/students/me/academic/curriculum-review/request-population";
  const coachReviewPath = props.selectedStudentProfileId
    ? `/students/me/academic/curriculum-review/coach-review?studentProfileId=${encodeURIComponent(props.selectedStudentProfileId)}`
    : "/students/me/academic/curriculum-review/coach-review";

  const review = useApiData<CurriculumReviewResponse>(
    reviewPath,
    true,
    refreshNonce
  );

  const curriculum = review.data?.curriculum;
  const tone = statusTone(curriculum?.verification.effectiveStatus || "missing");
  const alert = curriculum?.alerts?.[0];
  const details = curriculum?.details;
  const uploadHref = props.uploadHref || "/uploads/catalog";
  const mode = props.mode || "student";
  const subjectLabel = props.subjectLabel || "this student";
  const studentReviewHref = buildStudentCurriculumReviewHref();
  const parentNudgeHref = buildParentCurriculumNudgeHref(subjectLabel, props.selectedStudentProfileId);
  const coachCommunicationContextHref = buildCoachCommunicationContextHref(props.selectedStudentProfileId);
  const coachReminderDraftHref = buildCoachReminderDraftHref(subjectLabel, props.selectedStudentProfileId);

  async function saveVerification() {
    if (!confirmReviewed) {
      setActionState((current) => ({
        ...current,
        error: "Check the visual inspection box before saving verification.",
        success: null,
      }));
      return;
    }

    try {
      setActionState((current) => ({ ...current, saving: true, error: null, success: null }));
      await apiFetch(verifyPath, {
        method: "POST",
        body: JSON.stringify({
          confirmReviewed: true,
          verificationNotes: verificationNotes || undefined,
        }),
      });
      setActionState((current) => ({
        ...current,
        saving: false,
        success: "Curriculum review saved.",
      }));
      saveNavigation.reloadAfterSave();
    } catch (error: any) {
      setActionState((current) => ({
        ...current,
        saving: false,
        error: error?.message || String(error),
      }));
    }
  }

  async function requestPopulation() {
    try {
      setActionState((current) => ({ ...current, requesting: true, error: null, success: null }));
      const result = await apiFetch(requestPopulationPath, {
        method: "POST",
      }) as { message?: string };
      setActionState((current) => ({
        ...current,
        requesting: false,
        success: result.message || "Curriculum population requested.",
      }));
      setRefreshNonce((value) => value + 1);
    } catch (error: any) {
      setActionState((current) => ({
        ...current,
        requesting: false,
        error: error?.message || String(error),
      }));
    }
  }

  async function saveCoachReview() {
    try {
      setActionState((current) => ({ ...current, coachReviewing: true, error: null, success: null }));
      const result = await apiFetch(coachReviewPath, {
        method: "POST",
      }) as { message?: string };
      setActionState((current) => ({
        ...current,
        coachReviewing: false,
        success: result.message || "Coach curriculum review saved.",
      }));
      saveNavigation.reloadAfterSave();
    } catch (error: any) {
      setActionState((current) => ({
        ...current,
        coachReviewing: false,
        error: error?.message || String(error),
      }));
    }
  }

  const summaryRows = useMemo(
    () => [
      { label: "Institution", value: curriculum?.summary.institutionName || "Unknown" },
      { label: "Degree program", value: curriculum?.summary.degreeProgram || "Unknown" },
      { label: "Major", value: curriculum?.summary.major || "Unknown" },
      { label: "Catalog year", value: curriculum?.summary.catalogYear || "Unknown" },
      { label: "Requirement set", value: curriculum?.summary.requirementSetSummary || "Unknown" },
      {
        label: "Completion",
        value:
          typeof curriculum?.summary.completionPercent === "number"
            ? `${curriculum.summary.completionPercent}%`
            : "Unknown",
      },
      { label: "Source", value: curriculum?.summary.sourceLabel || "Unknown" },
    ],
    [curriculum]
  );

  return (
    <div id="curriculum-review" data-intro-target="curriculum-review">
      <SectionCard
      title={props.title || "Curriculum Verification"}
      subtitle={
        props.subtitle ||
        `Review the degree requirements for ${props.subjectLabel || "this student"} before treating scoring as authoritative.`
      }
      >
      {review.loading ? <p style={{ margin: 0 }}>Loading curriculum review status...</p> : null}
      {review.error ? <p style={{ margin: 0, color: "crimson" }}>{review.error}</p> : null}
      {!review.loading && !review.error && curriculum ? (
        <div style={{ display: "grid", gap: 16 }}>
          <div
            style={{
              display: "grid",
              gap: 10,
              padding: 16,
              borderRadius: 18,
              border: `1px solid ${tone.border}`,
              background: tone.background,
              color: tone.color,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <strong>{tone.badge}</strong>
              <span style={{ fontSize: 13 }}>
                {curriculum.verification.effectiveStatus === "verified"
                  ? `Verified ${formatDate(curriculum.verification.curriculumVerifiedAt)}`
                  : alert?.message}
              </span>
            </div>
            {curriculum.verification.curriculumRequestedAt ? (
              <div style={{ fontSize: 13 }}>
                Population last requested: {formatDate(curriculum.verification.curriculumRequestedAt)}
              </div>
            ) : null}
            {curriculum.verification.coachReviewedAt ? (
              <div style={{ fontSize: 13 }}>
                Coach reviewed: {formatDate(curriculum.verification.coachReviewedAt)}
              </div>
            ) : null}
          </div>

          <KeyValueList items={summaryRows} columns={2} />

          {curriculum.verification.effectiveStatus !== "verified" ? (
            <div
              style={{
                display: "grid",
                gap: 12,
                padding: 16,
                borderRadius: 18,
                border: "1px solid #f2d9ad",
                background: "#fff8e7",
                color: "#7a5817",
              }}
            >
              <p style={{ margin: 0, lineHeight: 1.6 }}>
                Degree requirements must be reviewed before scoring because the readiness score depends on accurate curriculum information.
              </p>
              {mode === "student" ? (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Link href={studentReviewHref} className="ui-button ui-button--primary">
                    Review degree requirements now
                  </Link>
                </div>
              ) : null}
              {mode === "parent" ? (
                <div style={{ display: "grid", gap: 10 }}>
                  <p style={{ margin: 0, lineHeight: 1.6 }}>
                    {`Want the system to help nudge ${subjectLabel} to finish this review so scoring can be trusted?`}
                  </p>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Link href={parentNudgeHref} className="ui-button ui-button--primary">
                      Open communication translator
                    </Link>
                  </div>
                </div>
              ) : null}
              {mode === "coach" ? (
                <div style={{ display: "grid", gap: 10 }}>
                  <p style={{ margin: 0, lineHeight: 1.6 }}>
                    {`Want to nudge ${subjectLabel} to complete this review? Start from the communication context, then draft a calm follow-up for the student.`}
                  </p>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Link href={coachCommunicationContextHref} className="ui-button ui-button--secondary">
                      Open communication context
                    </Link>
                    <Link href={coachReminderDraftHref} className="ui-button ui-button--primary">
                      Draft coach reminder
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {curriculum.verification.effectiveStatus === "missing" ? (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {curriculum.verification.canRequestPopulation ? (
                  <button
                    type="button"
                    className="ui-button ui-button--secondary"
                    onClick={requestPopulation}
                    disabled={actionState.requesting}
                  >
                    {actionState.requesting ? "Requesting..." : "Ask the system to populate curriculum information"}
                  </button>
                ) : null}
                {curriculum.verification.canUploadPdf ? (
                  <Link href={uploadHref} className="ui-button ui-button--primary">
                    Upload a PDF of degree requirements
                  </Link>
                ) : null}
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="ui-button ui-button--secondary"
                  onClick={() => setExpanded((current) => !current)}
                >
                  {expanded ? "Hide curriculum details" : "Review curriculum details"}
                </button>
                {curriculum.verification.canRequestPopulation ? (
                  <button
                    type="button"
                    className="ui-button ui-button--ghost"
                    onClick={requestPopulation}
                    disabled={actionState.requesting}
                  >
                    {actionState.requesting ? "Requesting..." : "Ask the system to repopulate curriculum"}
                  </button>
                ) : null}
                {curriculum.verification.canUploadPdf ? (
                  <Link href={uploadHref} className="ui-button ui-button--ghost">
                    Upload a PDF
                  </Link>
                ) : null}
              </div>

              {expanded ? (
                <div style={{ display: "grid", gap: 14 }}>
                  {typeof details?.creditRequirements === "number" ? (
                    <p style={{ margin: 0, color: "#334155" }}>
                      Credit requirement: <strong>{details.creditRequirements}</strong>
                    </p>
                  ) : null}

                  {details?.requirementGroups.length ? (
                    <div style={{ display: "grid", gap: 12 }}>
                      {details.requirementGroups.map((group) => (
                        <div
                          key={group.requirementGroupId}
                          style={{
                            borderRadius: 16,
                            border: "1px solid #dbe4f0",
                            background: "#fff",
                            padding: 16,
                            display: "grid",
                            gap: 10,
                          }}
                        >
                          <div>
                            <strong>{group.groupName}</strong>
                            <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                              {group.groupType.replace(/_/g, " ")}
                              {group.minCoursesRequired ? ` · min courses ${group.minCoursesRequired}` : ""}
                              {group.minCreditsRequired ? ` · min credits ${group.minCreditsRequired}` : ""}
                            </div>
                          </div>
                          {group.notes ? <div style={{ color: "#475569" }}>{group.notes}</div> : null}
                          <ul style={{ margin: 0, paddingLeft: 20, color: "#334155", display: "grid", gap: 6 }}>
                            {group.items.map((item) => (
                              <li key={item.requirementItemId}>
                                {item.label}
                                {item.creditsIfUsed ? ` · ${item.creditsIfUsed} credits` : ""}
                                {item.uncertain ? " · uncertain label" : ""}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ margin: 0, color: "#64748b" }}>No structured requirement groups are available yet.</p>
                  )}

                  {details?.missingOrUncertainFields.length ? (
                    <div>
                      <strong>Missing or uncertain fields</strong>
                      <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                        {details.missingOrUncertainFields.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </div>
                  ) : null}

                  {details?.parsingNotes.length ? (
                    <div>
                      <strong>Parsing and source notes</strong>
                      <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                        {details.parsingNotes.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </div>
                  ) : null}

                  {curriculum.summary.sourceUrl ? (
                    <p style={{ margin: 0 }}>
                      Source:{" "}
                      <a href={curriculum.summary.sourceUrl} target="_blank" rel="noreferrer">
                        {curriculum.summary.sourceUrl}
                      </a>
                    </p>
                  ) : null}
                </div>
              ) : null}

              {curriculum.verification.canVerify && curriculum.verification.effectiveStatus !== "verified" ? (
                <div
                  style={{
                    display: "grid",
                    gap: 12,
                    borderRadius: 18,
                    border: "1px solid #dbe4f0",
                    background: "#f8fbff",
                    padding: 16,
                  }}
                >
                  <label style={{ display: "flex", gap: 10, alignItems: "flex-start", color: "#183153", lineHeight: 1.6 }}>
                    <input
                      type="checkbox"
                      checked={confirmReviewed}
                      onChange={(event) => setConfirmReviewed(event.target.checked)}
                      style={{ marginTop: 4 }}
                    />
                    <span>
                      I have visually inspected these degree requirements and confirm they look complete enough to use for scoring.
                    </span>
                  </label>
                  <label style={{ display: "grid", gap: 6, color: "#183153" }}>
                    <FieldInfoLabel
                      label="Verification notes (optional)"
                      info="Add any quick context about what looked complete, incomplete, or still uncertain."
                      example="Core requirements look right, but the elective bucket may still need an advisor check."
                    />
                    <textarea
                      value={verificationNotes}
                      onChange={(event) => setVerificationNotes(event.target.value)}
                      rows={3}
                      style={{
                        width: "100%",
                        borderRadius: 12,
                        border: "1px solid #d0d8e8",
                        padding: "12px 14px",
                        fontSize: 14,
                        background: "#ffffff",
                      }}
                      placeholder="Example: Core philosophy requirements look complete, but elective buckets may still need a quick advisor check."
                    />
                  </label>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="ui-button ui-button--primary"
                      onClick={saveVerification}
                      disabled={actionState.saving || !confirmReviewed}
                    >
                      {actionState.saving ? "Saving..." : "Save curriculum verification"}
                    </button>
                  </div>
                </div>
              ) : null}

              {!curriculum.verification.canVerify && curriculum.verification.canCoachReview ? (
                <div
                  style={{
                    display: "grid",
                    gap: 10,
                    borderRadius: 18,
                    border: "1px solid #dbe4f0",
                    background: "#f8fbff",
                    padding: 16,
                  }}
                >
                  <p style={{ margin: 0, color: "#4b5d79", lineHeight: 1.6 }}>
                    Coaches can log a review, but family or student verification still controls whether scoring is treated as authoritative.
                  </p>
                  <div>
                    <button
                      type="button"
                      className="ui-button ui-button--secondary"
                      onClick={saveCoachReview}
                      disabled={actionState.coachReviewing}
                    >
                      {actionState.coachReviewing ? "Saving..." : "Mark reviewed by coach"}
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}

          {actionState.error ? <p style={{ margin: 0, color: "crimson" }}>{actionState.error}</p> : null}
          {actionState.success ? <p style={{ margin: 0, color: "#166534" }}>{actionState.success}</p> : null}
        </div>
      ) : null}
      </SectionCard>
    </div>
  );
}
