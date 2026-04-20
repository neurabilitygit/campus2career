"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "../../../components/layout/AppShell";
import { SectionCard } from "../../../components/layout/SectionCard";
import { RequireRole } from "../../../components/RequireRole";
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
      title="Upload Catalog Or Program PDF"
      subtitle="Preparing the catalog upload flow..."
    >
      <RequireRole expectedRoles={["student", "admin"]} fallbackTitle="Student sign-in required">
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
  const [didHydrate, setDidHydrate] = useState(false);
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
    if (didHydrate || !isAuthenticated || assignment.loading) {
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

    setDidHydrate(true);
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
  }, [assignment.data, assignment.loading, didHydrate, isAuthenticated, searchParams]);

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
      title="Upload Catalog Or Program PDF"
      subtitle="Use this when the school website cannot be parsed reliably for your major or minor requirements."
    >
      <RequireRole expectedRoles={["student", "admin"]} fallbackTitle="Student sign-in required">
        <SectionCard title="Program context">
          <div style={{ display: "grid", gap: 14 }}>
            <p style={{ margin: 0, color: "#4b5d79", lineHeight: 1.6 }}>
              Upload a PDF from the college catalog, department site, degree checklist, or requirement page.
              The system will extract recognizable courses and store them into the academic directory and requirement graph.
            </p>

            <label style={labelStyle}>
              Institution
              <input
                style={inputStyle}
                value={form.institutionDisplayName || form.institutionCanonicalName}
                onChange={(event) => setField("institutionDisplayName", event.target.value)}
                placeholder="Institution name"
              />
            </label>

            <label style={labelStyle}>
              Institution canonical name
              <input
                style={inputStyle}
                value={form.institutionCanonicalName}
                onChange={(event) => setField("institutionCanonicalName", event.target.value)}
                placeholder="institution canonical name"
              />
            </label>

            <label style={labelStyle}>
              Catalog label
              <input
                style={inputStyle}
                value={form.catalogLabel}
                onChange={(event) => setField("catalogLabel", event.target.value)}
                placeholder="Uploaded 2026-2027"
              />
            </label>

            <label style={labelStyle}>
              Degree type
              <input
                style={inputStyle}
                value={form.degreeType}
                onChange={(event) => setField("degreeType", event.target.value)}
                placeholder="Undergraduate"
              />
            </label>

            <label style={labelStyle}>
              Degree program bucket
              <input
                style={inputStyle}
                value={form.programName}
                onChange={(event) => setField("programName", event.target.value)}
                placeholder="Auto-discovered undergraduate programs"
              />
            </label>

            <label style={labelStyle}>
              Program kind
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
              Program display name
              <input
                style={inputStyle}
                value={form.programDisplayName}
                onChange={(event) => setField("programDisplayName", event.target.value)}
                placeholder="Biology"
              />
            </label>

            <label style={labelStyle}>
              Program canonical name
              <input
                style={inputStyle}
                value={form.programCanonicalName}
                onChange={(event) => setField("programCanonicalName", event.target.value)}
                placeholder="biology"
              />
            </label>
          </div>
        </SectionCard>

        <SectionCard title="Upload And Extract">
          <div style={{ display: "grid", gap: 12 }}>
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
            <button
              onClick={uploadAndExtract}
              style={{
                border: "none",
                borderRadius: 14,
                padding: "13px 18px",
                background: "linear-gradient(135deg, #155eef, #16a3ff)",
                color: "#ffffff",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Upload PDF And Extract
            </button>

            {status ? <p>{status}</p> : null}
            {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
            {result ? (
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  borderRadius: 14,
                  padding: 14,
                  background: "#f4f7fb",
                  border: "1px solid #d9e3f0",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 13,
                  margin: 0,
                }}
              >
                {JSON.stringify(result, null, 2)}
              </pre>
            ) : null}
          </div>
        </SectionCard>
      </RequireRole>
    </AppShell>
  );
}
