"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { SectionCard } from "../../components/layout/SectionCard";
import { SessionGate } from "../../components/SessionGate";
import { FieldInfoLabel } from "../../components/forms/FieldInfoLabel";
import { useAuthContext } from "../../hooks/useAuthContext";
import { useApiData } from "../../hooks/useApiData";
import { apiFetch } from "../../lib/apiClient";
import type {
  CoachEditableProfile,
  ParentEditableProfile,
  ParentHouseholdMember,
  StudentEditableProfile,
} from "../../../../../packages/shared/src/contracts/profile";
import { neurodivergentCategoryOptions } from "../../../../../packages/shared/src/contracts/profile";
import { buildDirectAddressName } from "../../lib/personalization";
import { useSaveNavigation } from "../../lib/saveNavigation";

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

type ProfileResponse<T> = {
  ok: boolean;
  profile: T | null;
};

type StudentAcademicProfileResponse = {
  ok: boolean;
  studentProfileId: string;
  profile: {
    school_name?: string | null;
    expected_graduation_date?: string | null;
    major_primary?: string | null;
    major_secondary?: string | null;
    preferred_geographies?: string[] | null;
    career_goal_summary?: string | null;
    academic_notes?: string | null;
  } | null;
};

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

type DirectoryOptionsResponse = {
  ok: boolean;
  institution: {
    institutionId: string;
    canonicalName: string;
    displayName: string;
  } | null;
  majors: Array<{
    majorId: string;
    canonicalName: string;
    displayName: string;
    isSelected: boolean;
  }>;
  minors: Array<{
    minorId: string;
    canonicalName: string;
    displayName: string;
  }>;
};

function commaSeparatedValues(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeOptionalDateInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : undefined;
}

function StudentProfileEditor() {
  const saveNavigation = useSaveNavigation();
  const auth = useAuthContext();
  const previewStudentFallback = auth.data?.context?.testContextPreviewStudents?.[0] || null;
  const selectedStudentProfileId =
    auth.data?.context?.studentProfileId ||
    (auth.data?.context?.testContextOverrideRole === "student"
      ? previewStudentFallback?.studentProfileId || null
      : null);
  const isStudentPreview = auth.data?.context?.testContextOverrideRole === "student";
  const canLoadStudentContext = auth.isAuthenticated && !auth.loading && !!auth.data?.context;

  function withStudentScope(path: string) {
    if (!isStudentPreview || !selectedStudentProfileId) {
      return path;
    }
    const url = new URL(path, "http://localhost");
    url.searchParams.set("studentProfileId", selectedStudentProfileId);
    return `${url.pathname}${url.search}`;
  }

  const accountProfilePath = withStudentScope("/students/me/account-profile");
  const academicProfilePath = withStudentScope("/students/me/profile");
  const catalogAssignmentPath = withStudentScope("/students/me/academic/catalog-assignment");

  const data = useApiData<ProfileResponse<StudentEditableProfile>>(
    accountProfilePath,
    canLoadStudentContext
  );
  const academicProfile = useApiData<StudentAcademicProfileResponse>(
    academicProfilePath,
    canLoadStudentContext
  );
  const catalogAssignment = useApiData<CatalogAssignmentResponse>(
    catalogAssignmentPath,
    auth.isAuthenticated && !auth.loading && !!auth.data?.context
  );
  const [form, setForm] = useState({
    fullName: "",
    preferredName: "",
    age: "",
    gender: "",
    housingStatus: "",
    knownNeurodivergentCategories: [] as string[],
    otherNeurodivergentDescription: "",
    communicationPreferences: "",
    personalChoices: "",
  });
  const [academicForm, setAcademicForm] = useState({
    schoolName: "",
    expectedGraduationDate: "",
    majorPrimary: "",
    majorSecondary: "",
  });
  const [selectedInstitutionCanonicalName, setSelectedInstitutionCanonicalName] = useState("");
  const [selectedInstitutionDisplayName, setSelectedInstitutionDisplayName] = useState("");
  const [selectedCatalogLabel, setSelectedCatalogLabel] = useState("");
  const [selectedDegreeKey, setSelectedDegreeKey] = useState("");
  const [selectedMajorCanonicalName, setSelectedMajorCanonicalName] = useState("");
  const [selectedMinorCanonicalName, setSelectedMinorCanonicalName] = useState("");
  const [directoryOptions, setDirectoryOptions] = useState<DirectoryOptionsResponse | null>(null);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const profile = data.data?.profile;
    if (!profile) {
      return;
    }
    setForm({
      fullName: profile.fullName || "",
      preferredName: profile.preferredName || "",
      age: profile.age == null ? "" : String(profile.age),
      gender: profile.gender || "",
      housingStatus: profile.housingStatus || "",
      knownNeurodivergentCategories: profile.knownNeurodivergentCategories || [],
      otherNeurodivergentDescription: profile.otherNeurodivergentDescription || "",
      communicationPreferences: profile.communicationPreferences || "",
      personalChoices: profile.personalChoices || "",
    });
  }, [data.data?.profile]);

  useEffect(() => {
    if (!canLoadStudentContext) {
      return;
    }

    const profile = academicProfile.data?.profile;
    if (!profile) {
      return;
    }

    setAcademicForm((current) => ({
      schoolName: current.schoolName || profile.school_name || "",
      expectedGraduationDate:
        current.expectedGraduationDate || profile.expected_graduation_date || "",
      majorPrimary: current.majorPrimary || profile.major_primary || "",
      majorSecondary: current.majorSecondary || profile.major_secondary || "",
    }));
  }, [academicProfile.data?.profile, canLoadStudentContext]);

  useEffect(() => {
    if (!canLoadStudentContext) {
      return;
    }

    const assignment = catalogAssignment.data?.assignment;
    if (!assignment) {
      return;
    }

    setSelectedInstitutionCanonicalName(assignment.institution_canonical_name || "");
    setSelectedInstitutionDisplayName(assignment.institution_display_name || "");
    setSelectedCatalogLabel(assignment.catalog_label || "");
    if (assignment.degree_type && assignment.program_name) {
      setSelectedDegreeKey(
        JSON.stringify({
          degreeType: assignment.degree_type,
          programName: assignment.program_name,
        })
      );
    }
    setSelectedMajorCanonicalName(assignment.major_canonical_name || "");
    setSelectedMinorCanonicalName(assignment.minor_canonical_name || "");

    setAcademicForm((current) => ({
      schoolName: current.schoolName || assignment.institution_display_name || "",
      expectedGraduationDate: current.expectedGraduationDate,
      majorPrimary: current.majorPrimary || assignment.major_display_name || "",
      majorSecondary: current.majorSecondary || assignment.minor_display_name || "",
    }));
  }, [canLoadStudentContext, catalogAssignment.data?.assignment]);

  useEffect(() => {
    let active = true;

    if (!canLoadStudentContext || !selectedInstitutionCanonicalName) {
      setDirectoryOptions(null);
      setDirectoryLoading(false);
      setDirectoryError("");
      return () => {
        active = false;
      };
    }

    const params = new URLSearchParams();
    params.set("institutionCanonicalName", selectedInstitutionCanonicalName);
    if (selectedCatalogLabel) {
      params.set("catalogLabel", selectedCatalogLabel);
    }
    if (selectedDegreeKey) {
      const selectedDegree = JSON.parse(selectedDegreeKey) as {
        degreeType: string;
        programName: string;
      };
      params.set("degreeType", selectedDegree.degreeType);
      params.set("programName", selectedDegree.programName);
    }
    if (selectedMajorCanonicalName) {
      params.set("majorCanonicalName", selectedMajorCanonicalName);
    }

    setDirectoryLoading(true);
    setDirectoryError("");

    apiFetch(withStudentScope(`/v1/academic/directory/options?${params.toString()}`))
      .then((result) => {
        if (!active) {
          return;
        }
        setDirectoryOptions(result as DirectoryOptionsResponse);
        setDirectoryLoading(false);
      })
      .catch((directoryLoadError) => {
        if (!active) {
          return;
        }
        setDirectoryOptions(null);
        setDirectoryLoading(false);
        setDirectoryError(
          directoryLoadError instanceof Error
            ? directoryLoadError.message
            : "Could not load school-specific major options."
        );
      });

    return () => {
      active = false;
    };
  }, [
    canLoadStudentContext,
    selectedCatalogLabel,
    selectedDegreeKey,
    selectedInstitutionCanonicalName,
    selectedMajorCanonicalName,
  ]);

  useEffect(() => {
    if (!directoryOptions?.institution) {
      return;
    }

    if (!selectedInstitutionDisplayName) {
      setSelectedInstitutionDisplayName(directoryOptions.institution.displayName);
    }

    if (!selectedMajorCanonicalName && academicForm.majorPrimary) {
      const matchedMajor = directoryOptions.majors.find(
        (major) =>
          major.displayName.toLowerCase() === academicForm.majorPrimary.trim().toLowerCase() ||
          major.canonicalName === academicForm.majorPrimary
      );
      if (matchedMajor) {
        setSelectedMajorCanonicalName(matchedMajor.canonicalName);
      }
    }

    if (!selectedMinorCanonicalName && academicForm.majorSecondary) {
      const matchedMinor = directoryOptions.minors.find(
        (minor) =>
          minor.displayName.toLowerCase() === academicForm.majorSecondary.trim().toLowerCase() ||
          minor.canonicalName === academicForm.majorSecondary
      );
      if (matchedMinor) {
        setSelectedMinorCanonicalName(matchedMinor.canonicalName);
      }
    }
  }, [
    academicForm.majorPrimary,
    academicForm.majorSecondary,
    directoryOptions,
    selectedInstitutionDisplayName,
    selectedMajorCanonicalName,
    selectedMinorCanonicalName,
  ]);

  const directName =
    buildDirectAddressName({
      preferredName:
        isStudentPreview
          ? auth.data?.context?.studentPreferredName || previewStudentFallback?.studentPreferredName
          : auth.data?.context?.authenticatedPreferredName,
      firstName:
        isStudentPreview
          ? auth.data?.context?.studentFirstName || previewStudentFallback?.studentFirstName
          : auth.data?.context?.authenticatedFirstName,
      lastName:
        isStudentPreview
          ? auth.data?.context?.studentLastName || previewStudentFallback?.studentLastName
          : auth.data?.context?.authenticatedLastName,
      fallback: "you",
    }) || "you";

  const selectedMajor =
    directoryOptions?.majors.find((major) => major.canonicalName === selectedMajorCanonicalName) || null;
  const selectedMinor =
    directoryOptions?.minors.find((minor) => minor.canonicalName === selectedMinorCanonicalName) || null;
  const hasStructuredMajorOptions = Boolean(directoryOptions?.majors.length);
  const hasStructuredMinorOptions = Boolean(directoryOptions?.minors.length);
  const schoolContextValue = selectedInstitutionDisplayName || academicForm.schoolName;
  const academicAssignmentReadyForStructuredSave =
    !!selectedInstitutionCanonicalName &&
    !!selectedCatalogLabel &&
    !!selectedDegreeKey &&
    !!selectedMajorCanonicalName;

  async function save() {
    setStatus("Saving profile...");
    setError("");
    try {
      await apiFetch(accountProfilePath, {
        method: "POST",
        body: JSON.stringify({
          fullName: form.fullName,
          preferredName: form.preferredName || null,
          age: form.age ? Number(form.age) : null,
          gender: form.gender || null,
          housingStatus: form.housingStatus || null,
          knownNeurodivergentCategories: form.knownNeurodivergentCategories,
          otherNeurodivergentDescription: form.otherNeurodivergentDescription || null,
          communicationPreferences: form.communicationPreferences || null,
          personalChoices: form.personalChoices || null,
        }),
      });

      const resolvedSchoolName = schoolContextValue.trim();
      const resolvedMajorPrimary = (selectedMajor?.displayName || academicForm.majorPrimary).trim();
      const resolvedMajorSecondary = (selectedMinor?.displayName || academicForm.majorSecondary).trim();
      const currentAcademicProfile = academicProfile.data?.profile;

      if (resolvedSchoolName && resolvedMajorPrimary) {
        await apiFetch(academicProfilePath, {
          method: "POST",
          body: JSON.stringify({
            schoolName: resolvedSchoolName,
            expectedGraduationDate:
              normalizeOptionalDateInput(academicForm.expectedGraduationDate) ||
              currentAcademicProfile?.expected_graduation_date ||
              undefined,
            majorPrimary: resolvedMajorPrimary,
            majorSecondary: resolvedMajorSecondary || undefined,
            preferredGeographies: currentAcademicProfile?.preferred_geographies || [],
            careerGoalSummary: currentAcademicProfile?.career_goal_summary || undefined,
            academicNotes: currentAcademicProfile?.academic_notes || undefined,
          }),
        });
      }

      if (academicAssignmentReadyForStructuredSave) {
        const selectedDegree = JSON.parse(selectedDegreeKey) as {
          degreeType: string;
          programName: string;
        };
        await apiFetch(catalogAssignmentPath, {
          method: "POST",
          body: JSON.stringify({
            institutionCanonicalName: selectedInstitutionCanonicalName,
            catalogLabel: selectedCatalogLabel,
            degreeType: selectedDegree.degreeType,
            programName: selectedDegree.programName,
            majorCanonicalName: selectedMajorCanonicalName,
            minorCanonicalName: selectedMinorCanonicalName || undefined,
          }),
        });
      }

      saveNavigation.returnAfterSave("/student");
    } catch (saveError: any) {
      setStatus("");
      setError(saveError?.message || "Could not save the profile.");
    }
  }

  return (
    <SectionCard
      title="Student profile"
      subtitle={`Update the personal details that help the platform address ${directName} more clearly. Your saved school and major context also stay visible here so the profile does not drift away from the academic path.`}
    >
      {data.loading || academicProfile.loading || catalogAssignment.loading ? <p>Loading profile...</p> : null}
      {data.error ? <p style={{ color: "crimson" }}>{data.error}</p> : null}
      {academicProfile.error ? <p style={{ color: "crimson" }}>{academicProfile.error}</p> : null}
      {catalogAssignment.error ? <p style={{ color: "crimson" }}>{catalogAssignment.error}</p> : null}
      {!data.loading && !data.error && !academicProfile.error && !catalogAssignment.error ? (
        <div style={{ display: "grid", gap: 18 }}>
          <div
            style={{
              display: "grid",
              gap: 14,
              borderRadius: 16,
              border: "1px solid #d9e3f0",
              background: "#f7faff",
              padding: "16px 18px",
            }}
          >
            <div style={{ display: "grid", gap: 4 }}>
              <strong style={{ color: "#15355b" }}>Academic path context</strong>
              <p style={{ margin: 0, color: "#4b6078", lineHeight: 1.6 }}>
                School and major details carry forward from Academic path so the profile reflects
                the same student context the dashboards use.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
              <label style={labelStyle}>
                <FieldInfoLabel
                  label="School from academic path"
                  info="This comes from the school selected in Academic path."
                  example="Synthetic State University"
                />
                <input
                  style={{
                    ...inputStyle,
                    background: selectedInstitutionCanonicalName ? "#eef4fb" : "#ffffff",
                    color: selectedInstitutionCanonicalName ? "#17365c" : undefined,
                  }}
                  value={schoolContextValue}
                  onChange={(event) =>
                    setAcademicForm((current) => ({ ...current, schoolName: event.target.value }))
                  }
                  readOnly={Boolean(selectedInstitutionCanonicalName)}
                  placeholder="Open Academic path to choose a school"
                />
              </label>

              <div style={{ display: "grid", alignContent: "end", gap: 10 }}>
                <Link href="/onboarding/profile" className="ui-button ui-button--secondary">
                  Open academic path
                </Link>
                <span style={{ color: "#5b6f89", fontSize: 13 }}>
                  Change the school, catalog, or degree-program context there.
                </span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
              <label style={labelStyle}>
                <FieldInfoLabel
                  label="Primary major"
                  info={
                    hasStructuredMajorOptions
                      ? "These options come from the selected school's saved academic path."
                      : "If the school has not loaded structured major options yet, enter the major manually."
                  }
                  example="Economics"
                />
                {hasStructuredMajorOptions ? (
                  <select
                    style={inputStyle}
                    value={selectedMajorCanonicalName}
                    onChange={(event) => {
                      const nextCanonicalName = event.target.value;
                      const nextMajor =
                        directoryOptions?.majors.find((major) => major.canonicalName === nextCanonicalName) || null;
                      setSelectedMajorCanonicalName(nextCanonicalName);
                      setAcademicForm((current) => ({
                        ...current,
                        majorPrimary: nextMajor?.displayName || "",
                      }));
                    }}
                  >
                    <option value="">Select a primary major</option>
                    {directoryOptions?.majors.map((major) => (
                      <option key={major.majorId} value={major.canonicalName}>
                        {major.displayName}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    style={inputStyle}
                    placeholder="Primary major"
                    value={academicForm.majorPrimary}
                    onChange={(event) =>
                      setAcademicForm((current) => ({ ...current, majorPrimary: event.target.value }))
                    }
                  />
                )}
              </label>

              <label style={labelStyle}>
                <FieldInfoLabel
                  label="Secondary major or minor"
                  info={
                    hasStructuredMinorOptions
                      ? "Use this for the saved minor if the school directory already offers one."
                      : "Use this for a second major, minor, or adjacent academic track."
                  }
                  example="Data Science minor"
                />
                {hasStructuredMinorOptions ? (
                  <select
                    style={inputStyle}
                    value={selectedMinorCanonicalName}
                    onChange={(event) => {
                      const nextCanonicalName = event.target.value;
                      const nextMinor =
                        directoryOptions?.minors.find((minor) => minor.canonicalName === nextCanonicalName) || null;
                      setSelectedMinorCanonicalName(nextCanonicalName);
                      setAcademicForm((current) => ({
                        ...current,
                        majorSecondary: nextMinor?.displayName || "",
                      }));
                    }}
                  >
                    <option value="">No secondary major or minor</option>
                    {directoryOptions?.minors.map((minor) => (
                      <option key={minor.minorId} value={minor.canonicalName}>
                        {minor.displayName}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    style={inputStyle}
                    placeholder="Secondary major or minor"
                    value={academicForm.majorSecondary}
                    onChange={(event) =>
                      setAcademicForm((current) => ({ ...current, majorSecondary: event.target.value }))
                    }
                  />
                )}
              </label>
            </div>

            {directoryLoading ? <span style={{ color: "#4b6078" }}>Loading school-specific major options...</span> : null}
            {!directoryLoading && directoryError ? <span style={{ color: "crimson" }}>{directoryError}</span> : null}
            {!directoryLoading && !directoryError && selectedInstitutionCanonicalName && !hasStructuredMajorOptions ? (
              <span style={{ color: "#4b6078" }}>
                Structured major options are not available for this school yet, so the profile stays on manual major entry.
              </span>
            ) : null}
          </div>

          <label style={labelStyle}>
            <FieldInfoLabel
              label="Full name"
              info="Use the full name that should appear on your account."
              example="Maya Rivera"
            />
            <input
              style={inputStyle}
              value={form.fullName}
              onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
            />
          </label>

          <label style={labelStyle}>
            <FieldInfoLabel
              label="Preferred name"
              info="Use the name you want the app to use when speaking directly to you."
              example="Maya"
            />
            <input
              style={inputStyle}
              value={form.preferredName}
              onChange={(event) => setForm((current) => ({ ...current, preferredName: event.target.value }))}
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            <label style={labelStyle}>
              <FieldInfoLabel
                label="Age"
                info="Optional. Add this only if you want it stored."
                example="20"
              />
              <input
                type="number"
                min={0}
                max={130}
                style={inputStyle}
                value={form.age}
                onChange={(event) => setForm((current) => ({ ...current, age: event.target.value }))}
              />
            </label>

            <label style={labelStyle}>
              <FieldInfoLabel
                label="Gender"
                info="Optional. Choose the closest fit or prefer not to say."
                example="Prefer not to say"
              />
              <select
                style={inputStyle}
                value={form.gender}
                onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))}
              >
                <option value="">Optional</option>
                <option value="Woman">Woman</option>
                <option value="Man">Man</option>
                <option value="Nonbinary">Nonbinary</option>
                <option value="Self describe">Self describe</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </label>
          </div>

          <label style={labelStyle}>
            <FieldInfoLabel
              label="Living situation or housing status"
              info="Optional context that may shape scheduling or support needs."
              example="On campus during the semester"
            />
            <input
              style={inputStyle}
              value={form.housingStatus}
              onChange={(event) => setForm((current) => ({ ...current, housingStatus: event.target.value }))}
            />
          </label>

          <div style={{ display: "grid", gap: 10 }}>
            <FieldInfoLabel
              label="Neurodivergent categories"
              info="Optional. Select any categories you want the system to keep in mind."
              example="ADHD"
            />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
              {neurodivergentCategoryOptions.map((option) => {
                const checked = form.knownNeurodivergentCategories.includes(option);
                return (
                  <label
                    key={option}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "12px 14px",
                      borderRadius: 14,
                      border: "1px solid #dbe4f0",
                      background: checked ? "#eef6ff" : "#fff",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setForm((current) => ({
                          ...current,
                          knownNeurodivergentCategories: checked
                            ? current.knownNeurodivergentCategories.filter((item) => item !== option)
                            : [...current.knownNeurodivergentCategories, option],
                        }))
                      }
                    />
                    <span>{option}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <label style={labelStyle}>
            <FieldInfoLabel
              label="Other neurodivergent context"
              info="Use this only if you chose Other and want to add a short note."
              example="Sensory processing differences"
            />
            <textarea
              rows={3}
              style={{ ...inputStyle, fontFamily: "inherit" }}
              value={form.otherNeurodivergentDescription}
              onChange={(event) =>
                setForm((current) => ({ ...current, otherNeurodivergentDescription: event.target.value }))
              }
            />
          </label>

          <label style={labelStyle}>
            <FieldInfoLabel
              label="Communication preferences"
              info="Add any personal communication notes you want the platform to respect."
              example="Short checklists work better than long messages"
            />
            <textarea
              rows={4}
              style={{ ...inputStyle, fontFamily: "inherit" }}
              value={form.communicationPreferences}
              onChange={(event) => setForm((current) => ({ ...current, communicationPreferences: event.target.value }))}
            />
          </label>

          <label style={labelStyle}>
            <FieldInfoLabel
              label="Personal choices or preferences"
              info="Add any optional context that helps the system keep recommendations realistic."
              example="I prefer local internships during the school year"
            />
            <textarea
              rows={4}
              style={{ ...inputStyle, fontFamily: "inherit" }}
              value={form.personalChoices}
              onChange={(event) => setForm((current) => ({ ...current, personalChoices: event.target.value }))}
            />
          </label>

          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" className="ui-button ui-button--primary" onClick={() => void save()}>
              Save profile
            </button>
            {status ? <span style={{ color: "#166534", fontWeight: 700 }}>{status}</span> : null}
            {error ? <span style={{ color: "crimson" }}>{error}</span> : null}
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}

function ParentProfileEditor() {
  const saveNavigation = useSaveNavigation();
  const data = useApiData<ProfileResponse<ParentEditableProfile>>("/parents/me/profile", true);
  const [form, setForm] = useState({
    fullName: "",
    preferredName: "",
    familyUnitName: "",
    relationshipToStudent: "",
    householdMembers: [] as ParentHouseholdMember[],
    familyStructure: "",
    partnershipStructure: "",
    knownNeurodivergentCategories: [] as string[],
    demographicInformation: "",
    communicationPreferences: "",
    parentGoalsOrConcerns: "",
  });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const profile = data.data?.profile;
    if (!profile) {
      return;
    }
    setForm({
      fullName: profile.fullName || "",
      preferredName: profile.preferredName || "",
      familyUnitName: profile.familyUnitName || "",
      relationshipToStudent: profile.relationshipToStudent || "",
      householdMembers: profile.householdMembers || [],
      familyStructure: profile.familyStructure || "",
      partnershipStructure: profile.partnershipStructure || "",
      knownNeurodivergentCategories: profile.knownNeurodivergentCategories || [],
      demographicInformation: profile.demographicInformation || "",
      communicationPreferences: profile.communicationPreferences || "",
      parentGoalsOrConcerns: profile.parentGoalsOrConcerns || "",
    });
  }, [data.data?.profile]);

  async function save() {
    setStatus("");
    setError("");
    try {
      await apiFetch("/parents/me/profile", {
        method: "POST",
        body: JSON.stringify(form),
      });
      saveNavigation.returnAfterSave("/parent");
    } catch (saveError: any) {
      setError(saveError?.message || "Could not save the profile.");
    }
  }

  return (
    <SectionCard
      title="Parent profile"
      subtitle="Update family context and communication preferences at your discretion. Sensitive details stay optional."
    >
      {data.loading ? <p>Loading profile...</p> : null}
      {data.error ? <p style={{ color: "crimson" }}>{data.error}</p> : null}
      {!data.loading && !data.error ? (
        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            <label style={labelStyle}>
              <FieldInfoLabel label="Full name" info="Use the full name that should appear on your account." example="Elena Rivera" />
              <input style={inputStyle} value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} />
            </label>
            <label style={labelStyle}>
              <FieldInfoLabel label="Preferred name" info="Use the name you want the platform to use in direct messages." example="Elena" />
              <input style={inputStyle} value={form.preferredName} onChange={(event) => setForm((current) => ({ ...current, preferredName: event.target.value }))} />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            <label style={labelStyle}>
              <FieldInfoLabel label="Family unit name" info="Optional label for the family context shown in your account." example="Rivera family" />
              <input style={inputStyle} value={form.familyUnitName} onChange={(event) => setForm((current) => ({ ...current, familyUnitName: event.target.value }))} />
            </label>
            <label style={labelStyle}>
              <FieldInfoLabel label="Relationship to the student" info="Optional. Describe how you relate to the student." example="Parent" />
              <input style={inputStyle} value={form.relationshipToStudent} onChange={(event) => setForm((current) => ({ ...current, relationshipToStudent: event.target.value }))} />
            </label>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <FieldInfoLabel
              label="Household members"
              info="Add any household members you want reflected in the family context."
              example="Jordan Rivera - Sibling"
            />
            {(form.householdMembers || []).map((member, index) => (
              <div key={`${member.name}-${index}`} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12 }}>
                <input
                  style={inputStyle}
                  placeholder="Name"
                  value={member.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      householdMembers: current.householdMembers.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, name: event.target.value } : item
                      ),
                    }))
                  }
                />
                <input
                  style={inputStyle}
                  placeholder="Relationship"
                  value={member.relationship || ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      householdMembers: current.householdMembers.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, relationship: event.target.value } : item
                      ),
                    }))
                  }
                />
                <button
                  type="button"
                  className="ui-button ui-button--secondary"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      householdMembers: current.householdMembers.filter((_, itemIndex) => itemIndex !== index),
                    }))
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            <div>
              <button
                type="button"
                className="ui-button ui-button--secondary"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    householdMembers: [...current.householdMembers, { name: "", relationship: "" }],
                  }))
                }
              >
                Add household member
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            <label style={labelStyle}>
              <FieldInfoLabel label="Family structure" info="Optional. Add only what feels useful." example="Two-household family" />
              <input style={inputStyle} value={form.familyStructure} onChange={(event) => setForm((current) => ({ ...current, familyStructure: event.target.value }))} />
            </label>
            <label style={labelStyle}>
              <FieldInfoLabel label="Partnership structure" info="Optional. Use your own words if you want to store this context." example="Married" />
              <input style={inputStyle} value={form.partnershipStructure} onChange={(event) => setForm((current) => ({ ...current, partnershipStructure: event.target.value }))} />
            </label>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <FieldInfoLabel label="Known neurodivergent categories" info="Optional. Add only what you want stored." example="ADHD" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
              {neurodivergentCategoryOptions.map((option) => {
                const checked = form.knownNeurodivergentCategories.includes(option);
                return (
                  <label key={option} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 14, border: "1px solid #dbe4f0", background: checked ? "#f8f2ff" : "#fff" }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setForm((current) => ({
                          ...current,
                          knownNeurodivergentCategories: checked
                            ? current.knownNeurodivergentCategories.filter((item) => item !== option)
                            : [...current.knownNeurodivergentCategories, option],
                        }))
                      }
                    />
                    <span>{option}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <label style={labelStyle}>
            <FieldInfoLabel label="Demographic information" info="Optional. Add only what you want kept in the profile." example="Spanish-speaking household" />
            <textarea rows={3} style={{ ...inputStyle, fontFamily: "inherit" }} value={form.demographicInformation} onChange={(event) => setForm((current) => ({ ...current, demographicInformation: event.target.value }))} />
          </label>

          <label style={labelStyle}>
            <FieldInfoLabel label="Communication preferences" info="Describe how you want family communication handled." example="Short summaries before detailed recommendations" />
            <textarea rows={4} style={{ ...inputStyle, fontFamily: "inherit" }} value={form.communicationPreferences} onChange={(event) => setForm((current) => ({ ...current, communicationPreferences: event.target.value }))} />
          </label>

          <label style={labelStyle}>
            <FieldInfoLabel label="Parent goals or concerns" info="Capture the outcomes or concerns you want the system to keep in mind." example="Help Maya stay consistent without creating extra tension at home" />
            <textarea rows={4} style={{ ...inputStyle, fontFamily: "inherit" }} value={form.parentGoalsOrConcerns} onChange={(event) => setForm((current) => ({ ...current, parentGoalsOrConcerns: event.target.value }))} />
          </label>

          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" className="ui-button ui-button--primary" onClick={() => void save()}>
              Save profile
            </button>
            {status ? <span style={{ color: "#166534", fontWeight: 700 }}>{status}</span> : null}
            {error ? <span style={{ color: "crimson" }}>{error}</span> : null}
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}

function CoachProfileEditor() {
  const saveNavigation = useSaveNavigation();
  const data = useApiData<ProfileResponse<CoachEditableProfile>>("/coaches/me/profile", true);
  const [form, setForm] = useState({
    fullName: "",
    preferredName: "",
    professionalTitle: "",
    organizationName: "",
    coachingSpecialties: "",
    communicationPreferences: "",
  });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const profile = data.data?.profile;
    if (!profile) {
      return;
    }
    setForm({
      fullName: profile.fullName || "",
      preferredName: profile.preferredName || "",
      professionalTitle: profile.professionalTitle || "",
      organizationName: profile.organizationName || "",
      coachingSpecialties: (profile.coachingSpecialties || []).join(", "),
      communicationPreferences: profile.communicationPreferences || "",
    });
  }, [data.data?.profile]);

  async function save() {
    setStatus("");
    setError("");
    try {
      await apiFetch("/coaches/me/profile", {
        method: "POST",
        body: JSON.stringify({
          fullName: form.fullName,
          preferredName: form.preferredName || null,
          professionalTitle: form.professionalTitle || null,
          organizationName: form.organizationName || null,
          coachingSpecialties: commaSeparatedValues(form.coachingSpecialties),
          communicationPreferences: form.communicationPreferences || null,
        }),
      });
      saveNavigation.returnAfterSave("/coach");
    } catch (saveError: any) {
      setError(saveError?.message || "Could not save the profile.");
    }
  }

  return (
    <SectionCard
      title="Coach profile"
      subtitle="Keep your coaching identity and communication style current so coach-facing actions stay clearly attributed."
    >
      {data.loading ? <p>Loading profile...</p> : null}
      {data.error ? <p style={{ color: "crimson" }}>{data.error}</p> : null}
      {!data.loading && !data.error ? (
        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            <label style={labelStyle}>
              <FieldInfoLabel label="Full name" info="Use the full name that should appear in coach workflows." example="Taylor Brooks" />
              <input style={inputStyle} value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} />
            </label>
            <label style={labelStyle}>
              <FieldInfoLabel label="Preferred name" info="Use the name the platform can use in direct coach-facing language." example="Taylor" />
              <input style={inputStyle} value={form.preferredName} onChange={(event) => setForm((current) => ({ ...current, preferredName: event.target.value }))} />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            <label style={labelStyle}>
              <FieldInfoLabel label="Professional title" info="Optional title shown in coach workflows." example="Career Coach" />
              <input style={inputStyle} value={form.professionalTitle} onChange={(event) => setForm((current) => ({ ...current, professionalTitle: event.target.value }))} />
            </label>
            <label style={labelStyle}>
              <FieldInfoLabel label="Organization name" info="Optional organization or practice name." example="North Star Advising" />
              <input style={inputStyle} value={form.organizationName} onChange={(event) => setForm((current) => ({ ...current, organizationName: event.target.value }))} />
            </label>
          </div>

          <label style={labelStyle}>
            <FieldInfoLabel label="Coaching specialties" info="List specialties separated by commas." example="Internships, networking, interview prep" />
            <input style={inputStyle} value={form.coachingSpecialties} onChange={(event) => setForm((current) => ({ ...current, coachingSpecialties: event.target.value }))} />
          </label>

          <label style={labelStyle}>
            <FieldInfoLabel label="Communication preferences" info="Add any communication notes you want reflected in coach tools." example="Follow-up drafts should stay concise and concrete" />
            <textarea rows={4} style={{ ...inputStyle, fontFamily: "inherit" }} value={form.communicationPreferences} onChange={(event) => setForm((current) => ({ ...current, communicationPreferences: event.target.value }))} />
          </label>

          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" className="ui-button ui-button--primary" onClick={() => void save()}>
              Save profile
            </button>
            {status ? <span style={{ color: "#166534", fontWeight: 700 }}>{status}</span> : null}
            {error ? <span style={{ color: "crimson" }}>{error}</span> : null}
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}

function ProfileContent() {
  const auth = useAuthContext();
  const role = auth.data?.context?.authenticatedRoleType;
  const isStudentPreview = auth.data?.context?.testContextOverrideRole === "student";
  const previewStudentFallback = auth.data?.context?.testContextPreviewStudents?.[0] || null;
  const directName =
    buildDirectAddressName({
      preferredName:
        isStudentPreview
          ? auth.data?.context?.studentPreferredName || previewStudentFallback?.studentPreferredName
          : auth.data?.context?.authenticatedPreferredName,
      firstName:
        isStudentPreview
          ? auth.data?.context?.studentFirstName || previewStudentFallback?.studentFirstName
          : auth.data?.context?.authenticatedFirstName,
      lastName:
        isStudentPreview
          ? auth.data?.context?.studentLastName || previewStudentFallback?.studentLastName
          : auth.data?.context?.authenticatedLastName,
      fallback: "you",
    }) || "you";

  const subtitle = useMemo(() => {
    if (role === "student") {
      return `${directName}, update your personal profile details here and keep the saved school and major context aligned with the academic path.`;
    }
    if (role === "parent") {
      return `${directName}, keep family context and communication preferences current so parent-facing guidance stays clear and respectful.`;
    }
    if (role === "coach") {
      return `${directName}, keep your coaching identity current so recommendations, action items, and follow-up drafts stay clearly attributed.`;
    }
    return "Update the profile details available to your current account role.";
  }, [directName, role]);

  return (
    <AppShell title="Profile" subtitle={subtitle}>
      {role === "student" ? <StudentProfileEditor /> : null}
      {role === "parent" ? <ParentProfileEditor /> : null}
      {role === "coach" ? <CoachProfileEditor /> : null}
      {!role ? <SectionCard title="Profile"><p>We could not determine your account role yet.</p></SectionCard> : null}
    </AppShell>
  );
}

export default function ProfilePage() {
  return (
    <SessionGate fallbackTitle="Sign in required">
      <ProfileContent />
    </SessionGate>
  );
}
