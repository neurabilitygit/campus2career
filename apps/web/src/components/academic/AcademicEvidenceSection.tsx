"use client";

import Link from "next/link";
import { useState } from "react";
import { SectionCard } from "../layout/SectionCard";
import { KeyValueList } from "../layout/KeyValueList";
import { apiFetch } from "../../lib/apiClient";
import { useApiData } from "../../hooks/useApiData";

type AcademicEvidenceResponse = {
  ok: boolean;
  academicEvidence: {
    assignment: {
      institutionCanonicalName?: string | null;
      institutionDisplayName?: string | null;
      catalogLabel?: string | null;
      degreeType?: string | null;
      programName?: string | null;
      majorDisplayName?: string | null;
      minorDisplayName?: string | null;
      concentrationDisplayName?: string | null;
    } | null;
    offerings: {
      counts: {
        catalogs: number;
        degreePrograms: number;
        majors: number;
        minors: number;
        concentrations: number;
      };
      sourceLabel: string;
      status: string;
      latestAttempt?: {
        status: string;
        source_attempted: string;
        source_note?: string | null;
        reasonableness_notes?: string | null;
      } | null;
    };
    degreeRequirements: {
      status: string;
      sourceLabel: string;
      latestAttempt?: {
        status: string;
        source_attempted: string;
        source_note?: string | null;
        reasonableness_notes?: string | null;
      } | null;
    };
    curriculum: {
      verification: {
        effectiveStatus: "missing" | "present_unverified" | "verified" | "needs_attention";
      };
    };
  };
};

function toneForStatus(status: string) {
  switch (status) {
    case "succeeded":
    case "verified":
      return { border: "#b7e4cf", background: "#ecfdf3", color: "#166534", label: "Ready" };
    case "questionable":
    case "needs_review":
    case "present_unverified":
      return { border: "#f2d9ad", background: "#fff8e7", color: "#7a5817", label: "Needs review" };
    case "missing":
    case "failed":
    case "upload_required":
      return { border: "#fecaca", background: "#fff5f5", color: "#b42318", label: "Attention needed" };
    default:
      return { border: "#d8e2f0", background: "#f8fbff", color: "#274c7a", label: "Not started" };
  }
}

export function AcademicEvidenceSection(props: {
  mode: "student" | "parent" | "coach";
  selectedStudentProfileId?: string | null;
}) {
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [actionState, setActionState] = useState<{ busy: string | null; message: string | null; error: string | null }>({
    busy: null,
    message: null,
    error: null,
  });

  const suffix = props.selectedStudentProfileId
    ? `?studentProfileId=${encodeURIComponent(props.selectedStudentProfileId)}`
    : "";
  const data = useApiData<AcademicEvidenceResponse>(`/students/me/academic-evidence${suffix}`, true, refreshNonce);
  const assignment = data.data?.academicEvidence.assignment;
  const offerings = data.data?.academicEvidence.offerings;
  const requirements = data.data?.academicEvidence.degreeRequirements;
  const curriculumStatus = data.data?.academicEvidence.curriculum.verification.effectiveStatus || "missing";

  async function triggerDiscovery(path: string, body?: unknown, busyKey?: string) {
    try {
      setActionState({ busy: busyKey || "action", message: null, error: null });
      const result = (await apiFetch(
        `${path}${suffix}`,
        body
          ? {
              method: "POST",
              body: JSON.stringify(body),
            }
          : { method: "POST" }
      )) as { message?: string };
      setActionState({ busy: null, message: result.message || "Academic evidence updated.", error: null });
      setRefreshNonce((value) => value + 1);
    } catch (error: any) {
      setActionState({ busy: null, message: null, error: error?.message || String(error) });
    }
  }

  const offeringsTone = toneForStatus(offerings?.status || "not_started");
  const requirementsTone = toneForStatus(curriculumStatus === "verified" ? "verified" : requirements?.status || "not_started");

  return (
    <SectionCard
      title="Academic Evidence"
      subtitle="This is where the system tracks school selection, program discovery, degree requirement quality, and whether the curriculum is ready to support scoring."
      tone="quiet"
      introTarget="academic-evidence"
    >
      {data.loading ? <p style={{ margin: 0 }}>Loading academic evidence...</p> : null}
      {data.error ? <p style={{ margin: 0, color: "crimson" }}>{data.error}</p> : null}
      {!data.loading && !data.error ? (
        <div style={{ display: "grid", gap: 16 }}>
          <KeyValueList
            items={[
              { label: "Institution", value: assignment?.institutionDisplayName || "Not selected" },
              { label: "Catalog", value: assignment?.catalogLabel || "Not selected" },
              {
                label: "Program",
                value:
                  assignment?.degreeType && assignment?.programName
                    ? `${assignment.degreeType} · ${assignment.programName}`
                    : "Not selected",
              },
              { label: "Major", value: assignment?.majorDisplayName || "Not selected" },
              { label: "Minor", value: assignment?.minorDisplayName || "None selected" },
              { label: "Concentration", value: assignment?.concentrationDisplayName || "None selected" },
            ]}
          />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
            <div style={{ border: `1px solid ${offeringsTone.border}`, background: offeringsTone.background, borderRadius: 16, padding: 16, display: "grid", gap: 8 }}>
              <strong style={{ color: offeringsTone.color }}>Program discovery · {offeringsTone.label}</strong>
              <p style={{ margin: 0, color: offeringsTone.color, lineHeight: 1.6 }}>
                Source: {offerings?.sourceLabel || "Unknown"}
                {" · "}Majors: {offerings?.counts.majors ?? 0}
                {" · "}Minors: {offerings?.counts.minors ?? 0}
              </p>
              {offerings?.latestAttempt?.source_note ? (
                <p style={{ margin: 0, color: offeringsTone.color, lineHeight: 1.6 }}>
                  {offerings.latestAttempt.source_note}
                </p>
              ) : null}
            </div>
            <div style={{ border: `1px solid ${requirementsTone.border}`, background: requirementsTone.background, borderRadius: 16, padding: 16, display: "grid", gap: 8 }}>
              <strong style={{ color: requirementsTone.color }}>Degree requirements · {requirementsTone.label}</strong>
              <p style={{ margin: 0, color: requirementsTone.color, lineHeight: 1.6 }}>
                Source: {requirements?.sourceLabel || "Unknown"}
                {" · "}Curriculum review: {curriculumStatus === "verified" ? "Verified" : "Still required"}
              </p>
              {requirements?.latestAttempt?.source_note ? (
                <p style={{ margin: 0, color: requirementsTone.color, lineHeight: 1.6 }}>
                  {requirements.latestAttempt.source_note}
                </p>
              ) : null}
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {props.mode === "student" ? (
              <Link href="/onboarding/profile" className="ui-button ui-button--secondary">
                Update school and program
              </Link>
            ) : null}
            {assignment?.institutionCanonicalName ? (
              <button
                type="button"
                className="ui-button ui-button--secondary"
                onClick={() =>
                  triggerDiscovery(
                    "/students/me/academic-evidence/discover-offerings",
                    { institutionCanonicalName: assignment.institutionCanonicalName },
                    "offerings"
                  )
                }
                disabled={actionState.busy === "offerings"}
              >
                {actionState.busy === "offerings" ? "Discovering..." : "Discover offerings"}
              </button>
            ) : null}
            {assignment?.institutionCanonicalName ? (
              <button
                type="button"
                className="ui-button ui-button--secondary"
                onClick={() =>
                  triggerDiscovery(
                    "/students/me/academic-evidence/discover-degree-requirements",
                    undefined,
                    "requirements"
                  )
                }
                disabled={actionState.busy === "requirements"}
              >
                {actionState.busy === "requirements" ? "Loading..." : "Discover degree requirements"}
              </button>
            ) : null}
            {props.mode !== "coach" ? (
              <Link href="/uploads/catalog" className="ui-button ui-button--ghost">
                Upload degree requirements PDF
              </Link>
            ) : null}
          </div>

          {actionState.message ? <p style={{ margin: 0, color: "#166534" }}>{actionState.message}</p> : null}
          {actionState.error ? <p style={{ margin: 0, color: "crimson" }}>{actionState.error}</p> : null}

          {offerings?.status === "needs_review" || offerings?.status === "failed" ? (
            <p style={{ margin: 0, color: "#7a5817", lineHeight: 1.6 }}>
              If the automated offering search still looks incomplete, continue in the school and program form and use manual entry for the academic path.
            </p>
          ) : null}
        </div>
      ) : null}
    </SectionCard>
  );
}
