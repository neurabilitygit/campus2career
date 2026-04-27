"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "../../../components/layout/AppShell";
import { SectionCard } from "../../../components/layout/SectionCard";
import { RequireRole } from "../../../components/RequireRole";
import { FieldInfoLabel } from "../../../components/forms/FieldInfoLabel";
import { apiFetch } from "../../../lib/apiClient";
import { uploadFileViaSignedUrl } from "../../../lib/storageUpload";
import { useApiData } from "../../../hooks/useApiData";
import { useSession } from "../../../hooks/useSession";

type CatalogAssignmentResponse = {
  ok: boolean;
  assignment: {
    institution_canonical_name?: string | null;
    institution_display_name?: string | null;
    catalog_label?: string | null;
    degree_type?: string | null;
    program_name?: string | null;
    major_canonical_name?: string | null;
    major_display_name?: string | null;
    minor_canonical_name?: string | null;
    minor_display_name?: string | null;
  } | null;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid #d0d8e8",
  padding: "12px 14px",
  fontSize: 15,
  background: "#ffffff",
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  fontWeight: 600,
  color: "#183153",
};

export default function CatalogUploadPage() {
  return (
    <Suspense fallback={<CatalogUploadPageLoading />}>
      <CatalogUploadPageInner />
    </Suspense>
  );
}

function CatalogUploadPageLoading() {
  return (
    <AppShell
      title="Add a program requirement PDF"
      subtitle="Preparing the document flow for coursework and degree requirements..."
    >
      <RequireRole expectedRoles={["student", "parent", "coach", "admin"]} fallbackTitle="Sign in to review curriculum requirements">
        <SectionCard title="Loading">
          <p>Loading catalog upload context...</p>
        </SectionCard>
      </RequireRole>
    </AppShell>
  );
}

function CatalogUploadPageInner() {
  const { isAuthenticated } = useSession();
  const searchParams = useSearchParams();
  const assignment = useApiData<CatalogAssignmentResponse>(
    "/students/me/academic/catalog-assignment",
    isAuthenticated
  );

  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [form, setForm] = useState({
    institutionCanonicalName: "",
    institutionDisplayName: "",
    catalogLabel: "",
    degreeType: "",
    programName: "",
    programKind: "major",
    programCanonicalName: "",
    programDisplayName: "",
    majorCanonicalName: "",
    majorDisplayName: "",
    minorCanonicalName: "",
    minorDisplayName: "",
  });

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const urlProgramKind = searchParams.get("programKind");
    const programKind = urlProgramKind === "minor" ? "minor" : "major";

    const assignmentData = assignment.data?.assignment;
    const majorCanonicalName =
      searchParams.get("majorCanonicalName") ||
      assignmentData?.major_canonical_name ||
      "";
    const majorDisplayName =
      searchParams.get("majorDisplayName") ||
      assignmentData?.major_display_name ||
      "";
    const minorCanonicalName =
      searchParams.get("minorCanonicalName") ||
      assignmentData?.minor_canonical_name ||
      "";
    const minorDisplayName =
      searchParams.get("minorDisplayName") ||
      assignmentData?.minor_display_name ||
      "";

    setForm({
      institutionCanonicalName:
        searchParams.get("institutionCanonicalName") ||
        assignmentData?.institution_canonical_name ||
        "",
      institutionDisplayName:
        searchParams.get("institutionDisplayName") ||
        assignmentData?.institution_display_name ||
        "",
      catalogLabel:
        searchParams.get("catalogLabel") ||
        assignmentData?.catalog_label ||
        "",
      degreeType:
        searchParams.get("degreeType") ||
        assignmentData?.degree_type ||
        "Undergraduate",
      programName:
        searchParams.get("programName") ||
        assignmentData?.program_name ||
        "",
      programKind,
      programCanonicalName:
        programKind === "minor" ? minorCanonicalName : majorCanonicalName,
      programDisplayName:
        programKind === "minor" ? minorDisplayName : majorDisplayName,
      majorCanonicalName,
      majorDisplayName,
      minorCanonicalName,
      minorDisplayName,
    });
  }, [assignment.data?.assignment, isAuthenticated, searchParams]);

  function setField(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleProgramKindChange(value: "major" | "minor") {
    setForm((current) => ({
      ...current,
      programKind: value,
      programCanonicalName:
        value === "minor" ? current.minorCanonicalName : current.majorCanonicalName,
      programDisplayName:
        value === "minor" ? current.minorDisplayName : current.majorDisplayName,
    }));
  }

  async function uploadAndExtract() {
    if (!file) {
      setError("Choose a PDF first.");
      return;
    }
    if (!form.institutionCanonicalName || !form.programKind) {
      setError("Institution and program context are required before extraction.");
      return;
    }

    try {
      setError(null);
      setResult(null);
      setStatus("Uploading PDF...");
      const upload = await uploadFileViaSignedUrl({
        artifactType: "other",
        file,
      });

      const academicArtifactId = (upload as any)?.completion?.academicArtifactId;
      if (!academicArtifactId) {
        throw new Error("Upload completed but no academicArtifactId was returned.");
      }

      setStatus("Extracting structured catalog data from uploaded PDF...");
      const extraction = await apiFetch("/students/me/academic/catalog/extract-from-artifact", {
        method: "POST",
        body: JSON.stringify({
          academicArtifactId,
          institutionCanonicalName: form.institutionCanonicalName,
          catalogLabel: form.catalogLabel || undefined,
          degreeType: form.degreeType || undefined,
          programName: form.programName || undefined,
          programKind: form.programKind,
          programCanonicalName: form.programCanonicalName || undefined,
          programDisplayName: form.programDisplayName || undefined,
        }),
      });

      await apiFetch("/students/me/academic/curriculum-review/link-upload", {
        method: "POST",
        body: JSON.stringify({
          academicArtifactId,
        }),
      });

      setStatus("Catalog PDF extracted successfully.");
      setResult({
        upload,
        extraction,
      });
    } catch (err: any) {
      setStatus("");
      setError(err?.message || String(err));
    }
  }

  return (
    <AppShell
      title="Add a program requirement PDF"
      subtitle="Use this when the school website is incomplete or unclear and you want the system to learn from an official PDF instead."
    >
      <RequireRole expectedRoles={["student", "parent", "coach", "admin"]} fallbackTitle="Sign in to review curriculum requirements">
        <SectionCard
          title="Program details"
          subtitle="This tells the system which school and academic path the uploaded document belongs to."
          tone="highlight"
        >
          <div style={{ display: "grid", gap: 14 }}>
            <p style={{ margin: 0, color: "#4b5d79", lineHeight: 1.6 }}>
              Upload a PDF from the college catalog, department site, degree checklist, or official requirement page.
              We&apos;ll extract recognizable courses and use them to strengthen your academic path.
            </p>

            <label style={labelStyle}>
              <FieldInfoLabel
                label="School"
                info="Use the institution this requirement document belongs to."
                example="Harvard University"
              />
              <input
                style={inputStyle}
                value={form.institutionDisplayName || form.institutionCanonicalName}
                onChange={(event) => setField("institutionDisplayName", event.target.value)}
                placeholder="School name"
              />
            </label>

            <label style={labelStyle}>
              <FieldInfoLabel
                label="Catalog label"
                info="Name the academic year or catalog edition for this document."
                example="2026-2027"
              />
              <input
                style={inputStyle}
                value={form.catalogLabel}
                onChange={(event) => setField("catalogLabel", event.target.value)}
                placeholder="For example: 2026-2027"
              />
            </label>

            <label style={labelStyle}>
              <FieldInfoLabel
                label="Degree level"
                info="Enter the level or degree type attached to this path."
                example="Undergraduate"
              />
              <input
                style={inputStyle}
                value={form.degreeType}
                onChange={(event) => setField("degreeType", event.target.value)}
                placeholder="Undergraduate"
              />
            </label>

            <label style={labelStyle}>
              <FieldInfoLabel
                label="Program group"
                info="Name the broader program grouping used by the school."
                example="Undergraduate concentrations"
              />
              <input
                style={inputStyle}
                value={form.programName}
                onChange={(event) => setField("programName", event.target.value)}
                placeholder="For example: Undergraduate concentrations"
              />
            </label>

            <label style={labelStyle}>
              <FieldInfoLabel
                label="Requirement type"
                info="Tell the system whether the PDF describes a major or a minor."
                example="Major"
              />
              <select
                style={inputStyle}
                value={form.programKind}
                onChange={(event) =>
                  handleProgramKindChange(event.target.value === "minor" ? "minor" : "major")
                }
              >
                <option value="major">Major</option>
                <option value="minor">Minor</option>
              </select>
            </label>

            <label style={labelStyle}>
              <FieldInfoLabel
                label="Major or minor name"
                info="Use the exact academic path this PDF describes."
                example="Philosophy"
              />
              <input
                style={inputStyle}
                value={form.programDisplayName}
                onChange={(event) => setField("programDisplayName", event.target.value)}
                placeholder="Biology"
              />
            </label>

            {!form.institutionCanonicalName ? (
              <div
                style={{
                  borderRadius: 16,
                  padding: "14px 16px",
                  background: "#fff8e7",
                  border: "1px solid #f2d9ad",
                  color: "#7a5817",
                  lineHeight: 1.6,
                }}
              >
                If this page was opened directly and your school was not selected first, go back to the
                profile page and choose the school there. That gives this upload the cleanest
                path into the academic directory.
              </div>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard
          title="Upload the PDF"
          subtitle="Choose the official document that lists the courses or requirements for this path."
        >
          <div style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <FieldInfoLabel
                label="Requirement PDF"
                info="Upload the official page or checklist that lists the courses or rules for this path."
                example="Department requirement PDF for the philosophy major"
              />
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                style={{
                  borderRadius: 16,
                  border: "1px solid rgba(73, 102, 149, 0.18)",
                  padding: "12px 14px",
                  background: "rgba(255,255,255,0.82)",
                }}
              />
            </label>
            <button
              onClick={uploadAndExtract}
              className="ui-button ui-button--primary"
            >
              Upload and extract
            </button>

            {status ? <p style={{ margin: 0, color: "#155eef" }}>{status}</p> : null}
            {error ? <p style={{ margin: 0, color: "crimson" }}>{error}</p> : null}
            {result ? (
              <div
                style={{
                  borderRadius: 18,
                  padding: 18,
                  background: "linear-gradient(180deg, rgba(240, 253, 250, 0.95), rgba(236, 248, 255, 0.95))",
                  border: "1px solid rgba(15, 159, 116, 0.18)",
                  display: "grid",
                  gap: 10,
                  margin: 0,
                }}
              >
                <strong style={{ fontSize: 18 }}>Program document processed</strong>
                <p style={{ margin: 0, color: "#33546b", lineHeight: 1.6 }}>
                  The PDF was uploaded and extraction has been requested for this academic path.
                  You can return to onboarding or your dashboard while the system finishes processing.
                </p>
              </div>
            ) : null}
          </div>
        </SectionCard>
      </RequireRole>
    </AppShell>
  );
}
