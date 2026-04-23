"use client";

import { useDeferredValue, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "../../../components/layout/AppShell";
import { SectionCard } from "../../../components/layout/SectionCard";
import { RequireRole } from "../../../components/RequireRole";
import { apiFetch } from "../../../lib/apiClient";
import { useApiData } from "../../../hooks/useApiData";
import { useSession } from "../../../hooks/useSession";

type StudentProfileResponse = {
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
    concentration_canonical_name?: string | null;
    concentration_display_name?: string | null;
  } | null;
};

type InstitutionSearchResult = {
  institutionId: string;
  canonicalName: string;
  displayName: string;
  stateRegion?: string | null;
  city?: string | null;
  websiteUrl?: string | null;
  countryCode?: string | null;
};

type InstitutionSearchResponse = {
  ok: boolean;
  institutions: InstitutionSearchResult[];
};

type DirectoryOptionsResponse = {
  ok: boolean;
  institution: {
    institutionId: string;
    canonicalName: string;
    displayName: string;
    city?: string | null;
    stateRegion?: string | null;
    websiteUrl?: string | null;
    countryCode?: string | null;
  } | null;
  catalogs: Array<{
    academicCatalogId: string;
    catalogLabel: string;
    startYear: number;
    endYear: number;
    sourceUrl?: string | null;
    sourceFormat?: string | null;
    extractionStatus?: string | null;
    isSelected: boolean;
  }>;
  degreePrograms: Array<{
    degreeProgramId: string;
    degreeType: string;
    programName: string;
    schoolName?: string | null;
    totalCreditsRequired?: number | null;
    isSelected: boolean;
  }>;
  majors: Array<{
    majorId: string;
    canonicalName: string;
    displayName: string;
    departmentName?: string | null;
    cipCode?: string | null;
    isSelected: boolean;
  }>;
  minors: Array<{
    minorId: string;
    canonicalName: string;
    displayName: string;
    departmentName?: string | null;
  }>;
  concentrations: Array<{
    concentrationId: string;
    canonicalName: string;
    displayName: string;
  }>;
};

type CatalogDiscoveryResponse = {
  ok: boolean;
  status: "existing_catalog" | "discovered_programs" | "upload_required";
  uploadRecommended: boolean;
  websiteUrl?: string | null;
  sourcePages: string[];
  discoveredDegreeProgramCount: number;
  discoveredMajorCount: number;
  discoveredMinorCount: number;
  catalogLabel?: string | null;
  message: string;
};

type ProgramRequirementDiscoveryResponse = {
  ok: boolean;
  status: "requirements_discovered" | "upload_required";
  uploadRecommended: boolean;
  usedLlmAssistance?: boolean;
  uploadUrl?: string | null;
  message: string;
  diagnostics?: string[];
  major?: {
    provenanceMethod?: "direct_scrape" | "llm_assisted";
    sourcePage?: string | null;
    sourceNote?: string | null;
    diagnostics?: string[];
  } | null;
  minor?: {
    provenanceMethod?: "direct_scrape" | "llm_assisted";
    sourcePage?: string | null;
    sourceNote?: string | null;
    diagnostics?: string[];
  } | null;
};

type StudentCommunicationPreferencesResponse = {
  ok: boolean;
  preferences: {
    preferredChannels?: Array<"email" | "sms" | "whatsapp">;
    dislikedChannels?: Array<"email" | "sms" | "whatsapp">;
    preferredTone?:
      | "gentle"
      | "neutral"
      | "direct"
      | "encouraging"
      | "question_led"
      | "summary_first"
      | null;
    sensitiveTopics?: string[];
    preferredFrequency?: "as_needed" | "weekly" | "biweekly" | "monthly" | null;
    bestTimeOfDay?: "morning" | "afternoon" | "evening" | "late_night" | "weekend" | "variable" | null;
    preferredGuidanceFormats?: Array<
      "direct_instructions" | "choices" | "reminders" | "questions" | "summaries"
    >;
    identifyParentOrigin?: boolean;
    allowParentConcernRephrasing?: boolean;
    consentParentTranslatedMessages?: boolean;
    notes?: string | null;
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

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: "none",
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  fontWeight: 600,
  color: "#183153",
};

export default function OnboardingProfilePage() {
  const { isAuthenticated } = useSession();
  const profile = useApiData<StudentProfileResponse>("/students/me/profile", isAuthenticated);
  const assignment = useApiData<CatalogAssignmentResponse>(
    "/students/me/academic/catalog-assignment",
    isAuthenticated
  );
  const communicationPreferences = useApiData<StudentCommunicationPreferencesResponse>(
    "/students/me/communication-preferences",
    isAuthenticated
  );

  const [form, setForm] = useState({
    schoolName: "",
    expectedGraduationDate: "",
    majorPrimary: "",
    majorSecondary: "",
    preferredGeographies: "",
    careerGoalSummary: "",
    academicNotes: "",
  });
  const [status, setStatus] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [searchResults, setSearchResults] = useState<InstitutionSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [selectedInstitutionCanonicalName, setSelectedInstitutionCanonicalName] = useState("");
  const [selectedInstitutionDisplayName, setSelectedInstitutionDisplayName] = useState("");
  const [selectedCatalogLabel, setSelectedCatalogLabel] = useState("");
  const [selectedDegreeKey, setSelectedDegreeKey] = useState("");
  const [selectedMajorCanonicalName, setSelectedMajorCanonicalName] = useState("");
  const [selectedMinorCanonicalName, setSelectedMinorCanonicalName] = useState("");
  const [selectedConcentrationCanonicalName, setSelectedConcentrationCanonicalName] = useState("");

  const [directoryOptions, setDirectoryOptions] = useState<DirectoryOptionsResponse | null>(null);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [directoryRefreshNonce, setDirectoryRefreshNonce] = useState(0);
  const [catalogDiscovery, setCatalogDiscovery] = useState<CatalogDiscoveryResponse | null>(null);
  const [catalogDiscoveryLoading, setCatalogDiscoveryLoading] = useState(false);
  const [catalogDiscoveryError, setCatalogDiscoveryError] = useState<string | null>(null);
  const [catalogDiscoveryAttemptedFor, setCatalogDiscoveryAttemptedFor] = useState<string | null>(null);
  const [programRequirementsDiscovery, setProgramRequirementsDiscovery] =
    useState<ProgramRequirementDiscoveryResponse | null>(null);
  const [didHydrateProfile, setDidHydrateProfile] = useState(false);
  const [didHydrateAssignment, setDidHydrateAssignment] = useState(false);
  const [didHydrateCommunicationPreferences, setDidHydrateCommunicationPreferences] = useState(false);
  const [communicationForm, setCommunicationForm] = useState({
    preferredChannels: [] as Array<"email" | "sms" | "whatsapp">,
    dislikedChannels: [] as Array<"email" | "sms" | "whatsapp">,
    preferredTone: "",
    sensitiveTopics: "",
    preferredFrequency: "",
    bestTimeOfDay: "",
    preferredGuidanceFormats: [] as Array<
      "direct_instructions" | "choices" | "reminders" | "questions" | "summaries"
    >,
    identifyParentOrigin: true,
    allowParentConcernRephrasing: false,
    consentParentTranslatedMessages: false,
    notes: "",
  });

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetDirectorySelection() {
    setSelectedCatalogLabel("");
    setSelectedDegreeKey("");
    setSelectedMajorCanonicalName("");
    setSelectedMinorCanonicalName("");
    setSelectedConcentrationCanonicalName("");
    setDirectoryOptions(null);
    setDirectoryRefreshNonce(0);
    setCatalogDiscovery(null);
    setCatalogDiscoveryError(null);
    setCatalogDiscoveryLoading(false);
    setCatalogDiscoveryAttemptedFor(null);
    setProgramRequirementsDiscovery(null);
  }

  function selectInstitution(institution: InstitutionSearchResult) {
    setSelectedInstitutionCanonicalName(institution.canonicalName);
    setSelectedInstitutionDisplayName(institution.displayName);
    setSearchQuery(institution.displayName);
    setSearchResults([]);
    setSearchError(null);
    resetDirectorySelection();
    setForm((current) => ({
      ...current,
      schoolName: institution.displayName,
    }));
  }

  useEffect(() => {
    if (!isAuthenticated || profile.loading || didHydrateProfile) {
      return;
    }

    setDidHydrateProfile(true);
    const currentProfile = profile.data?.profile;
    if (!currentProfile) {
      return;
    }

    setForm((current) => ({
      schoolName: currentProfile.school_name || current.schoolName,
      expectedGraduationDate:
        currentProfile.expected_graduation_date || current.expectedGraduationDate,
      majorPrimary: currentProfile.major_primary || current.majorPrimary,
      majorSecondary: currentProfile.major_secondary || current.majorSecondary,
      preferredGeographies: (currentProfile.preferred_geographies || []).join(", "),
      careerGoalSummary: currentProfile.career_goal_summary || current.careerGoalSummary,
      academicNotes: currentProfile.academic_notes || current.academicNotes,
    }));
  }, [didHydrateProfile, isAuthenticated, profile.data, profile.loading]);

  useEffect(() => {
    if (!isAuthenticated || assignment.loading || didHydrateAssignment) {
      return;
    }

    setDidHydrateAssignment(true);
    const currentAssignment = assignment.data?.assignment;
    if (!currentAssignment) {
      return;
    }

    setSelectedInstitutionCanonicalName(currentAssignment.institution_canonical_name || "");
    setSelectedInstitutionDisplayName(currentAssignment.institution_display_name || "");
    setSearchQuery(currentAssignment.institution_display_name || "");
    setSelectedCatalogLabel(currentAssignment.catalog_label || "");
    if (currentAssignment.degree_type && currentAssignment.program_name) {
      setSelectedDegreeKey(
        JSON.stringify({
          degreeType: currentAssignment.degree_type,
          programName: currentAssignment.program_name,
        })
      );
    }
    setSelectedMajorCanonicalName(currentAssignment.major_canonical_name || "");
    setSelectedMinorCanonicalName(currentAssignment.minor_canonical_name || "");
    setSelectedConcentrationCanonicalName(currentAssignment.concentration_canonical_name || "");

    setForm((current) => ({
      ...current,
      schoolName: current.schoolName || currentAssignment.institution_display_name || "",
      majorPrimary: current.majorPrimary || currentAssignment.major_display_name || "",
      majorSecondary: current.majorSecondary || currentAssignment.minor_display_name || "",
    }));
  }, [assignment.data, assignment.loading, didHydrateAssignment, isAuthenticated]);

  useEffect(() => {
    if (
      !isAuthenticated ||
      communicationPreferences.loading ||
      didHydrateCommunicationPreferences
    ) {
      return;
    }

    setDidHydrateCommunicationPreferences(true);
    const currentPreferences = communicationPreferences.data?.preferences;
    if (!currentPreferences) {
      return;
    }

    setCommunicationForm({
      preferredChannels: currentPreferences.preferredChannels || [],
      dislikedChannels: currentPreferences.dislikedChannels || [],
      preferredTone: currentPreferences.preferredTone || "",
      sensitiveTopics: (currentPreferences.sensitiveTopics || []).join(", "),
      preferredFrequency: currentPreferences.preferredFrequency || "",
      bestTimeOfDay: currentPreferences.bestTimeOfDay || "",
      preferredGuidanceFormats: currentPreferences.preferredGuidanceFormats || [],
      identifyParentOrigin: currentPreferences.identifyParentOrigin ?? true,
      allowParentConcernRephrasing: currentPreferences.allowParentConcernRephrasing ?? false,
      consentParentTranslatedMessages:
        currentPreferences.consentParentTranslatedMessages ?? false,
      notes: currentPreferences.notes || "",
    });
  }, [
    communicationPreferences.data,
    communicationPreferences.loading,
    didHydrateCommunicationPreferences,
    isAuthenticated,
  ]);

  function toggleChannel(
    field: "preferredChannels" | "dislikedChannels",
    value: "email" | "sms" | "whatsapp"
  ) {
    setCommunicationForm((current) => ({
      ...current,
      [field]: current[field].includes(value)
        ? current[field].filter((item) => item !== value)
        : [...current[field], value],
    }));
  }

  function toggleGuidanceFormat(
    value: "direct_instructions" | "choices" | "reminders" | "questions" | "summaries"
  ) {
    setCommunicationForm((current) => ({
      ...current,
      preferredGuidanceFormats: current.preferredGuidanceFormats.includes(value)
        ? current.preferredGuidanceFormats.filter((item) => item !== value)
        : [...current.preferredGuidanceFormats, value],
    }));
  }

  useEffect(() => {
    let active = true;

    const query = deferredSearchQuery.trim();
    if (!isAuthenticated || query.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError(null);
      return () => {
        active = false;
      };
    }

    setSearchLoading(true);
    setSearchError(null);

    apiFetch(
      `/v1/academic/institutions/search?q=${encodeURIComponent(query)}&limit=8`
    )
      .then((result: InstitutionSearchResponse) => {
        if (!active) return;
        setSearchResults(result.institutions || []);
        setSearchLoading(false);
      })
      .catch((error) => {
        if (!active) return;
        setSearchError(error instanceof Error ? error.message : String(error));
        setSearchLoading(false);
      });

    return () => {
      active = false;
    };
  }, [deferredSearchQuery, isAuthenticated]);

  useEffect(() => {
    let active = true;

    if (!isAuthenticated || !selectedInstitutionCanonicalName) {
      setDirectoryOptions(null);
      setDirectoryLoading(false);
      setDirectoryError(null);
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
    setDirectoryError(null);

    apiFetch(`/v1/academic/directory/options?${params.toString()}`)
      .then((result: DirectoryOptionsResponse) => {
        if (!active) return;
        setDirectoryOptions(result);
        setDirectoryLoading(false);
      })
      .catch((error) => {
        if (!active) return;
        setDirectoryError(error instanceof Error ? error.message : String(error));
        setDirectoryLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    isAuthenticated,
    selectedInstitutionCanonicalName,
    selectedCatalogLabel,
    selectedDegreeKey,
    selectedMajorCanonicalName,
    directoryRefreshNonce,
  ]);

  useEffect(() => {
    let active = true;

    if (
      !isAuthenticated ||
      !selectedInstitutionCanonicalName ||
      directoryLoading ||
      !!directoryError ||
      !directoryOptions ||
      directoryOptions.catalogs.length > 0 ||
      catalogDiscoveryLoading ||
      catalogDiscoveryAttemptedFor === selectedInstitutionCanonicalName
    ) {
      return () => {
        active = false;
      };
    }

    setCatalogDiscoveryLoading(true);
    setCatalogDiscoveryError(null);
    setCatalogDiscoveryAttemptedFor(selectedInstitutionCanonicalName);

    apiFetch("/students/me/academic/catalog-discovery", {
      method: "POST",
      body: JSON.stringify({
        institutionCanonicalName: selectedInstitutionCanonicalName,
      }),
    })
      .then((result: CatalogDiscoveryResponse) => {
        if (!active) return;
        setCatalogDiscovery(result);
        setCatalogDiscoveryLoading(false);
        if (result.status === "existing_catalog" || result.status === "discovered_programs") {
          setDirectoryRefreshNonce((value) => value + 1);
        }
      })
      .catch((error) => {
        if (!active) return;
        setCatalogDiscoveryError(error instanceof Error ? error.message : String(error));
        setCatalogDiscoveryLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    catalogDiscoveryAttemptedFor,
    catalogDiscoveryLoading,
    directoryError,
    directoryLoading,
    directoryOptions,
    isAuthenticated,
    selectedInstitutionCanonicalName,
  ]);

  useEffect(() => {
    if (!directoryOptions?.institution) {
      return;
    }

    setSelectedInstitutionDisplayName(directoryOptions.institution.displayName);

    if (!selectedCatalogLabel) {
      const selectedCatalog = directoryOptions.catalogs.find((catalog) => catalog.isSelected);
      if (selectedCatalog) {
        setSelectedCatalogLabel(selectedCatalog.catalogLabel);
      }
    }

    if (!selectedDegreeKey) {
      const selectedProgram = directoryOptions.degreePrograms.find((program) => program.isSelected);
      if (selectedProgram) {
        setSelectedDegreeKey(
          JSON.stringify({
            degreeType: selectedProgram.degreeType,
            programName: selectedProgram.programName,
          })
        );
      }
    }

    if (!selectedMajorCanonicalName) {
      const selectedMajor = directoryOptions.majors.find((major) => major.isSelected);
      if (selectedMajor) {
        setSelectedMajorCanonicalName(selectedMajor.canonicalName);
      }
    }

    if (!form.schoolName) {
      setForm((current) => ({
        ...current,
        schoolName: directoryOptions.institution?.displayName || current.schoolName,
      }));
    }
  }, [
    directoryOptions,
    form.schoolName,
    selectedCatalogLabel,
    selectedDegreeKey,
    selectedMajorCanonicalName,
  ]);

  const selectedProgram = (() => {
    if (!directoryOptions || !selectedDegreeKey) {
      return null;
    }

    const parsed = JSON.parse(selectedDegreeKey) as {
      degreeType: string;
      programName: string;
    };

    return (
      directoryOptions.degreePrograms.find(
        (program) =>
          program.degreeType === parsed.degreeType &&
          program.programName === parsed.programName
      ) || null
    );
  })();

  const selectedMajor =
    directoryOptions?.majors.find((major) => major.canonicalName === selectedMajorCanonicalName) ||
    null;
  const selectedMinor =
    directoryOptions?.minors.find((minor) => minor.canonicalName === selectedMinorCanonicalName) ||
    null;
  const selectedDegreeContext = (() => {
    if (!selectedDegreeKey) {
      return null;
    }
    return JSON.parse(selectedDegreeKey) as {
      degreeType: string;
      programName: string;
    };
  })();
  const catalogUploadHref = (() => {
    const params = new URLSearchParams();
    if (selectedInstitutionCanonicalName) {
      params.set("institutionCanonicalName", selectedInstitutionCanonicalName);
    }
    if (selectedInstitutionDisplayName) {
      params.set("institutionDisplayName", selectedInstitutionDisplayName);
    }
    if (selectedCatalogLabel) {
      params.set("catalogLabel", selectedCatalogLabel);
    }
    if (selectedDegreeContext?.degreeType) {
      params.set("degreeType", selectedDegreeContext.degreeType);
    }
    if (selectedDegreeContext?.programName) {
      params.set("programName", selectedDegreeContext.programName);
    }
    if (selectedMajorCanonicalName) {
      params.set("majorCanonicalName", selectedMajorCanonicalName);
    }
    if (selectedMajor?.displayName) {
      params.set("majorDisplayName", selectedMajor.displayName);
    }
    if (selectedMinorCanonicalName) {
      params.set("minorCanonicalName", selectedMinorCanonicalName);
    }
    if (selectedMinor?.displayName) {
      params.set("minorDisplayName", selectedMinor.displayName);
    }
    const query = params.toString();
    return query ? `/uploads/catalog?${query}` : "/uploads/catalog";
  })();

  const hasStructuredAcademicSelection =
    !!selectedInstitutionCanonicalName &&
    !!selectedCatalogLabel &&
    !!selectedDegreeKey &&
    !!selectedMajorCanonicalName;

  const summaryRows = [
    { label: "Institution", value: selectedInstitutionDisplayName || form.schoolName || "Not selected" },
    { label: "Catalog", value: selectedCatalogLabel || "Not selected" },
    {
      label: "Degree program",
      value: selectedProgram ? `${selectedProgram.degreeType} · ${selectedProgram.programName}` : "Not selected",
    },
    { label: "Major", value: selectedMajor?.displayName || "Not selected" },
    { label: "Minor", value: selectedMinor?.displayName || "None selected" },
    {
      label: "Concentration",
      value:
        directoryOptions?.concentrations.find(
          (concentration) => concentration.canonicalName === selectedConcentrationCanonicalName
        )?.displayName || "None selected",
    },
  ];

  async function save() {
    setStatus("Saving your academic path...");
    setErrorMessage("");
    try {
      const resolvedSchoolName = selectedInstitutionDisplayName || form.schoolName;
      const resolvedMajorPrimary = selectedMajor?.displayName || form.majorPrimary;
      const resolvedMajorSecondary = selectedMinor?.displayName || form.majorSecondary;

      const profileResult = await apiFetch("/students/me/profile", {
        method: "POST",
        body: JSON.stringify({
          schoolName: resolvedSchoolName,
          expectedGraduationDate: form.expectedGraduationDate,
          majorPrimary: resolvedMajorPrimary,
          majorSecondary: resolvedMajorSecondary,
          preferredGeographies: form.preferredGeographies
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          careerGoalSummary: form.careerGoalSummary,
          academicNotes: form.academicNotes,
        }),
      });

      await apiFetch("/students/me/communication-preferences", {
        method: "POST",
        body: JSON.stringify({
          preferredChannels: communicationForm.preferredChannels,
          dislikedChannels: communicationForm.dislikedChannels,
          preferredTone: communicationForm.preferredTone || undefined,
          sensitiveTopics: communicationForm.sensitiveTopics
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          preferredFrequency: communicationForm.preferredFrequency || undefined,
          bestTimeOfDay: communicationForm.bestTimeOfDay || undefined,
          preferredGuidanceFormats: communicationForm.preferredGuidanceFormats,
          identifyParentOrigin: communicationForm.identifyParentOrigin,
          allowParentConcernRephrasing: communicationForm.allowParentConcernRephrasing,
          consentParentTranslatedMessages:
            communicationForm.consentParentTranslatedMessages,
          notes: communicationForm.notes || undefined,
        }),
      });

      let catalogAssignmentResult: unknown = null;
      let requirementDiscoveryResult: unknown = null;

      if (
        selectedInstitutionCanonicalName &&
        selectedCatalogLabel &&
        selectedDegreeKey &&
        selectedMajorCanonicalName
      ) {
        const selectedDegree = JSON.parse(selectedDegreeKey) as {
          degreeType: string;
          programName: string;
        };

        catalogAssignmentResult = await apiFetch("/students/me/academic/catalog-assignment", {
          method: "POST",
          body: JSON.stringify({
            institutionCanonicalName: selectedInstitutionCanonicalName,
            catalogLabel: selectedCatalogLabel,
            degreeType: selectedDegree.degreeType,
            programName: selectedDegree.programName,
            majorCanonicalName: selectedMajorCanonicalName,
            minorCanonicalName: selectedMinorCanonicalName || undefined,
            concentrationCanonicalName: selectedConcentrationCanonicalName || undefined,
          }),
        });

        requirementDiscoveryResult = await apiFetch(
          "/students/me/academic/program-requirements/discover",
          {
            method: "POST",
            body: JSON.stringify({
              institutionCanonicalName: selectedInstitutionCanonicalName,
              catalogLabel: selectedCatalogLabel,
              degreeType: selectedDegree.degreeType,
              programName: selectedDegree.programName,
              majorCanonicalName: selectedMajorCanonicalName,
              minorCanonicalName: selectedMinorCanonicalName || undefined,
            }),
          }
        );
        setProgramRequirementsDiscovery(
          requirementDiscoveryResult as ProgramRequirementDiscoveryResponse
        );
      }

      setStatus(
        catalogAssignmentResult
          ? "Your academic path was saved. The platform is now connecting it to program requirements so the dashboard can use that context."
          : "Your profile was saved. You can open the dashboard now and come back later to strengthen the academic path."
      );
    } catch (error: any) {
      setStatus("");
      setErrorMessage(error?.message || String(error));
    }
  }

  return (
    <AppShell
      title="Build the student academic path"
      subtitle="Choose the school and major first so the dashboard can explain fit, gaps, and next steps in the right context."
    >
      <RequireRole expectedRoles={["student", "admin"]} fallbackTitle="Student sign-in required">
        <SectionCard
          title="School and program selection"
          subtitle="Start with the college or university. If structured curriculum data is available, the platform can use it right away to make the dashboard more specific."
          tone="highlight"
        >
          <div style={{ display: "grid", gap: 16 }}>
            <label style={labelStyle}>
              Search for your college or university
              <input
                style={inputStyle}
                placeholder="Start typing a school name"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>

            {selectedInstitutionDisplayName ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  padding: "14px 16px",
                  borderRadius: 14,
                  background: "#eef6ff",
                  border: "1px solid #c7defd",
                }}
              >
                <div style={{ display: "grid", gap: 4 }}>
                  <strong style={{ color: "#11345c" }}>Selected institution</strong>
                  <span style={{ color: "#325176" }}>{selectedInstitutionDisplayName}</span>
                </div>
                <button
                  onClick={() => {
                    setSelectedInstitutionCanonicalName("");
                    setSelectedInstitutionDisplayName("");
                    setSearchQuery("");
                    setSearchResults([]);
                    resetDirectorySelection();
                  }}
                  style={{
                    borderRadius: 999,
                    border: "1px solid #94b6ea",
                    background: "#ffffff",
                    padding: "10px 14px",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Clear selection
                </button>
              </div>
            ) : null}

            {searchLoading ? <p style={{ margin: 0 }}>Searching institutions...</p> : null}
            {searchError ? <p style={{ margin: 0, color: "crimson" }}>{searchError}</p> : null}

            {!selectedInstitutionCanonicalName && searchResults.length > 0 ? (
              <div style={{ display: "grid", gap: 10 }}>
                {searchResults.map((institution) => (
                  <button
                    key={institution.institutionId}
                    onClick={() => selectInstitution(institution)}
                    style={{
                      textAlign: "left",
                      borderRadius: 14,
                      border: "1px solid #d8e2f0",
                      padding: "14px 16px",
                      background: "#ffffff",
                      cursor: "pointer",
                    }}
                  >
                    <strong style={{ display: "block", color: "#143156" }}>
                      {institution.displayName}
                    </strong>
                    <span style={{ color: "#56708f", fontSize: 14 }}>
                      {[institution.city, institution.stateRegion].filter(Boolean).join(", ") ||
                        institution.countryCode ||
                        "Institution"}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            {selectedInstitutionCanonicalName ? (
              <div style={{ display: "grid", gap: 14 }}>
                {directoryLoading ? <p style={{ margin: 0 }}>Loading catalog options...</p> : null}
                {directoryError ? (
                  <p style={{ margin: 0, color: "crimson" }}>{directoryError}</p>
                ) : null}
                {catalogDiscoveryLoading ? (
                  <div
                    style={{
                      borderRadius: 14,
                      border: "1px solid #d6e2ff",
                      background: "#f5f8ff",
                      padding: "14px 16px",
                      color: "#274c7a",
                    }}
                  >
                    Searching the school website for catalog, major, and minor pages...
                  </div>
                ) : null}
                {catalogDiscoveryError ? (
                  <p style={{ margin: 0, color: "crimson" }}>{catalogDiscoveryError}</p>
                ) : null}
                {catalogDiscovery ? (
                  <div
                    style={{
                      borderRadius: 14,
                      border: `1px solid ${
                        catalogDiscovery.uploadRecommended ? "#f2d9ad" : "#c7defd"
                      }`,
                      background: catalogDiscovery.uploadRecommended ? "#fff8e7" : "#eef6ff",
                      padding: "14px 16px",
                      color: catalogDiscovery.uploadRecommended ? "#7a5817" : "#22456f",
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <strong>
                      {catalogDiscovery.uploadRecommended
                        ? "We need one more source"
                        : "We found school program data"}
                    </strong>
                    <p style={{ margin: 0, lineHeight: 1.6 }}>{catalogDiscovery.message}</p>
                    {!catalogDiscovery.uploadRecommended ? (
                      <p style={{ margin: 0, fontSize: 14 }}>
                        Degree programs: {catalogDiscovery.discoveredDegreeProgramCount}
                        {" · "}Majors: {catalogDiscovery.discoveredMajorCount}
                        {" · "}Minors: {catalogDiscovery.discoveredMinorCount}
                      </p>
                    ) : null}
                    {catalogDiscovery.uploadRecommended ? (
                      <p style={{ margin: 0, lineHeight: 1.6 }}>
                        If the site does not expose a reliable curriculum page, upload a PDF from
                        the school catalog or department site using the{" "}
                        <Link href={catalogUploadHref}>program PDF upload flow</Link>.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {directoryOptions?.catalogs.length ? (
                  <label style={labelStyle}>
                    Catalog year
                    <select
                      style={selectStyle}
                      value={selectedCatalogLabel}
                      onChange={(event) => {
                        setSelectedCatalogLabel(event.target.value);
                        setSelectedDegreeKey("");
                        setSelectedMajorCanonicalName("");
                        setSelectedMinorCanonicalName("");
                        setSelectedConcentrationCanonicalName("");
                      }}
                    >
                      <option value="">Select a catalog</option>
                      {directoryOptions.catalogs.map((catalog) => (
                        <option key={catalog.academicCatalogId} value={catalog.catalogLabel}>
                          {catalog.catalogLabel}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div
                    style={{
                      borderRadius: 14,
                      border: "1px solid #f2d9ad",
                      background: "#fff8e7",
                      padding: "14px 16px",
                      color: "#7a5817",
                    }}
                  >
                    We do not have a structured academic catalog loaded for this school yet. The
                    system is trying website discovery automatically, and if that still comes up short
                    you can continue with the manual fields below or upload a PDF using the{" "}
                    <Link href={catalogUploadHref}>program PDF upload flow</Link>.
                  </div>
                )}

                {directoryOptions?.degreePrograms.length ? (
                  <label style={labelStyle}>
                    Degree program
                    <select
                      style={selectStyle}
                      value={selectedDegreeKey}
                      onChange={(event) => {
                        setSelectedDegreeKey(event.target.value);
                        setSelectedMajorCanonicalName("");
                        setSelectedMinorCanonicalName("");
                        setSelectedConcentrationCanonicalName("");
                      }}
                    >
                      <option value="">Select a degree program</option>
                      {directoryOptions.degreePrograms.map((program) => {
                        const value = JSON.stringify({
                          degreeType: program.degreeType,
                          programName: program.programName,
                        });
                        return (
                          <option key={program.degreeProgramId} value={value}>
                            {program.degreeType} · {program.programName}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                ) : null}

                {selectedProgram?.totalCreditsRequired ? (
                  <p style={{ margin: 0, color: "#4b5d79" }}>
                    Program credits required: {selectedProgram.totalCreditsRequired}
                  </p>
                ) : null}

                {directoryOptions?.majors.length ? (
                  <label style={labelStyle}>
                    Major
                    <select
                      style={selectStyle}
                      value={selectedMajorCanonicalName}
                      onChange={(event) => {
                        setSelectedMajorCanonicalName(event.target.value);
                        setSelectedConcentrationCanonicalName("");
                      }}
                    >
                      <option value="">Select a major</option>
                      {directoryOptions.majors.map((major) => (
                        <option key={major.majorId} value={major.canonicalName}>
                          {major.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {directoryOptions?.minors.length ? (
                  <label style={labelStyle}>
                    Minor (optional)
                    <select
                      style={selectStyle}
                      value={selectedMinorCanonicalName}
                      onChange={(event) => setSelectedMinorCanonicalName(event.target.value)}
                    >
                      <option value="">No minor selected</option>
                      {directoryOptions.minors.map((minor) => (
                        <option key={minor.minorId} value={minor.canonicalName}>
                          {minor.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {directoryOptions?.concentrations.length ? (
                  <label style={labelStyle}>
                    Concentration (optional)
                    <select
                      style={selectStyle}
                      value={selectedConcentrationCanonicalName}
                      onChange={(event) =>
                        setSelectedConcentrationCanonicalName(event.target.value)
                      }
                    >
                      <option value="">No concentration selected</option>
                      {directoryOptions.concentrations.map((concentration) => (
                        <option
                          key={concentration.concentrationId}
                          value={concentration.canonicalName}
                        >
                          {concentration.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {programRequirementsDiscovery?.uploadRecommended ? (
                  <div
                    style={{
                      borderRadius: 14,
                      border: "1px solid #f2d9ad",
                      background: "#fff8e7",
                      padding: "14px 16px",
                      color: "#7a5817",
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <strong>Program requirement details still need a source document</strong>
                    <p style={{ margin: 0, lineHeight: 1.6 }}>
                      {programRequirementsDiscovery.message}
                    </p>
                    <p style={{ margin: 0 }}>
                      Upload the major or minor requirement PDF with the{" "}
                      <Link href={catalogUploadHref}>program PDF upload flow</Link>
                      .
                    </p>
                    {programRequirementsDiscovery.diagnostics?.length ? (
                      <div style={{ display: "grid", gap: 6 }}>
                        <strong style={{ fontSize: 14 }}>Why the automatic lookup stopped</strong>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {programRequirementsDiscovery.diagnostics.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {programRequirementsDiscovery && !programRequirementsDiscovery.uploadRecommended && programRequirementsDiscovery.usedLlmAssistance ? (
                  <div
                    style={{
                      borderRadius: 14,
                      border: "1px solid #f2d9ad",
                      background: "#fff8e7",
                      padding: "14px 16px",
                      color: "#7a5817",
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <strong>Coursework was populated with LLM assistance</strong>
                    <p style={{ margin: 0, lineHeight: 1.6 }}>
                      {programRequirementsDiscovery.message}
                    </p>
                    <p style={{ margin: 0, lineHeight: 1.6 }}>
                      The system used official school-page text as the source, but the coursework list was
                      structured with LLM assistance instead of a fully direct parser. You can continue, and you
                      can strengthen this record later by uploading the official program PDF through the{" "}
                      <Link href={catalogUploadHref}>program PDF upload flow</Link>.
                    </p>
                    {programRequirementsDiscovery.diagnostics?.length ? (
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {programRequirementsDiscovery.diagnostics.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard
          title={hasStructuredAcademicSelection ? "Profile details" : "Core profile"}
          subtitle={
            hasStructuredAcademicSelection
              ? "Your school and program are set. Add only the extra context that will help the dashboard guide the next decisions."
              : "If your school path is not fully available yet, you can still continue here and strengthen the record later."
          }
        >
          <div style={{ display: "grid", gap: 14 }}>
            {hasStructuredAcademicSelection ? (
              <div
                style={{
                  borderRadius: 14,
                  border: "1px solid #d9e3f0",
                  background: "#f7faff",
                  padding: "16px 18px",
                  display: "grid",
                  gap: 12,
                }}
              >
                <strong style={{ color: "#15355b" }}>Selected academic path</strong>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 12,
                  }}
                >
                  {summaryRows.map((row) => (
                    <div
                      key={row.label}
                      style={{
                        borderRadius: 12,
                        background: "#ffffff",
                        border: "1px solid #e1e8f2",
                        padding: "12px 14px",
                        display: "grid",
                        gap: 4,
                      }}
                    >
                      <span style={{ color: "#5b6f89", fontSize: 12, fontWeight: 700 }}>
                        {row.label}
                      </span>
                      <span style={{ color: "#17365c", fontWeight: 600 }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <label style={labelStyle}>
                  School name
                  <input
                    style={inputStyle}
                    placeholder="School name"
                    value={form.schoolName}
                    onChange={(event) => update("schoolName", event.target.value)}
                  />
                </label>

                <label style={labelStyle}>
                  Primary major or academic path
                  <input
                    style={inputStyle}
                    placeholder="Primary major"
                    value={form.majorPrimary}
                    onChange={(event) => update("majorPrimary", event.target.value)}
                  />
                </label>

                <label style={labelStyle}>
                  Secondary major, minor, or academic path
                  <input
                    style={inputStyle}
                    placeholder="Secondary major or minor"
                    value={form.majorSecondary}
                    onChange={(event) => update("majorSecondary", event.target.value)}
                  />
                </label>
              </>
            )}

            <label style={labelStyle}>
              Expected graduation date
              <input
                style={inputStyle}
                type="date"
                placeholder="Expected graduation date"
                value={form.expectedGraduationDate}
                onChange={(event) => update("expectedGraduationDate", event.target.value)}
              />
            </label>

            <label style={labelStyle}>
              Preferred geographies
              <input
                style={inputStyle}
                placeholder="For example: New York, Boston, remote"
                value={form.preferredGeographies}
                onChange={(event) => update("preferredGeographies", event.target.value)}
              />
            </label>

            <label style={labelStyle}>
              Career goal summary
              <textarea
                style={{ ...inputStyle, minHeight: 120, resize: "vertical" }}
                placeholder="What kind of role or trajectory are you aiming for?"
                value={form.careerGoalSummary}
                onChange={(event) => update("careerGoalSummary", event.target.value)}
                rows={5}
              />
            </label>

            <label style={labelStyle}>
              Academic notes
              <textarea
                style={{ ...inputStyle, minHeight: 110, resize: "vertical" }}
                placeholder="Add context that the structured catalog does not capture, such as unofficial plans, transfer details, pre-professional tracks, or advisor guidance."
                value={form.academicNotes}
                onChange={(event) => update("academicNotes", event.target.value)}
                rows={4}
              />
            </label>

            <div
              style={{
                display: "grid",
                gap: 16,
                padding: "18px 18px 20px",
                borderRadius: 18,
                border: "1px solid #dbe4f0",
                background: "#f8fbff",
              }}
            >
              <strong style={{ color: "#15355b" }}>How guidance lands best</strong>
              <p style={{ margin: 0, color: "#52657d", lineHeight: 1.6 }}>
                These preferences shape student-facing guidance and control whether translated parent-originated messages may be delivered.
              </p>

              <div style={{ display: "grid", gap: 8 }}>
                <strong>Preferred channels</strong>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {(["email", "sms", "whatsapp"] as const).map((channel) => (
                    <label key={channel} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={communicationForm.preferredChannels.includes(channel)}
                        onChange={() => toggleChannel("preferredChannels", channel)}
                      />
                      <span>{channel.toUpperCase()}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <strong>Channels to avoid when possible</strong>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {(["email", "sms", "whatsapp"] as const).map((channel) => (
                    <label key={channel} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={communicationForm.dislikedChannels.includes(channel)}
                        onChange={() => toggleChannel("dislikedChannels", channel)}
                      />
                      <span>{channel.toUpperCase()}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                <label style={labelStyle}>
                  Preferred tone
                  <select
                    style={selectStyle}
                    value={communicationForm.preferredTone}
                    onChange={(event) =>
                      setCommunicationForm((current) => ({
                        ...current,
                        preferredTone: event.target.value,
                      }))
                    }
                  >
                    <option value="">Choose one</option>
                    <option value="gentle">Gentle</option>
                    <option value="neutral">Neutral</option>
                    <option value="direct">Direct</option>
                    <option value="encouraging">Encouraging</option>
                    <option value="question_led">Question-led</option>
                    <option value="summary_first">Summary first</option>
                  </select>
                </label>

                <label style={labelStyle}>
                  Preferred frequency
                  <select
                    style={selectStyle}
                    value={communicationForm.preferredFrequency}
                    onChange={(event) =>
                      setCommunicationForm((current) => ({
                        ...current,
                        preferredFrequency: event.target.value,
                      }))
                    }
                  >
                    <option value="">Choose one</option>
                    <option value="as_needed">As needed</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Every two weeks</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </label>

                <label style={labelStyle}>
                  Best time of day
                  <select
                    style={selectStyle}
                    value={communicationForm.bestTimeOfDay}
                    onChange={(event) =>
                      setCommunicationForm((current) => ({
                        ...current,
                        bestTimeOfDay: event.target.value,
                      }))
                    }
                  >
                    <option value="">Choose one</option>
                    <option value="morning">Morning</option>
                    <option value="afternoon">Afternoon</option>
                    <option value="evening">Evening</option>
                    <option value="late_night">Late night</option>
                    <option value="weekend">Weekend</option>
                    <option value="variable">Variable</option>
                  </select>
                </label>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <strong>Guidance formats that work best</strong>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {([
                    ["direct_instructions", "Direct instructions"],
                    ["choices", "Choices"],
                    ["reminders", "Reminders"],
                    ["questions", "Questions"],
                    ["summaries", "Summaries"],
                  ] as const).map(([value, label]) => (
                    <label key={value} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={communicationForm.preferredGuidanceFormats.includes(value)}
                        onChange={() => toggleGuidanceFormat(value)}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <label style={labelStyle}>
                Topics that feel sensitive
                <input
                  style={inputStyle}
                  placeholder="Money, uncertainty, grades"
                  value={communicationForm.sensitiveTopics}
                  onChange={(event) =>
                    setCommunicationForm((current) => ({
                      ...current,
                      sensitiveTopics: event.target.value,
                    }))
                  }
                />
              </label>

              <label style={labelStyle}>
                Notes about how advice lands best
                <textarea
                  style={{ ...inputStyle, minHeight: 100, resize: "vertical" }}
                  value={communicationForm.notes}
                  onChange={(event) =>
                    setCommunicationForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  rows={4}
                />
              </label>

              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", lineHeight: 1.6 }}>
                <input
                  type="checkbox"
                  checked={communicationForm.identifyParentOrigin}
                  onChange={(event) =>
                    setCommunicationForm((current) => ({
                      ...current,
                      identifyParentOrigin: event.target.checked,
                    }))
                  }
                  style={{ marginTop: 4 }}
                />
                <span>If a translated parent-originated message is shown to me, identify it as coming from my parent.</span>
              </label>

              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", lineHeight: 1.6 }}>
                <input
                  type="checkbox"
                  checked={communicationForm.allowParentConcernRephrasing}
                  onChange={(event) =>
                    setCommunicationForm((current) => ({
                      ...current,
                      allowParentConcernRephrasing: event.target.checked,
                    }))
                  }
                  style={{ marginTop: 4 }}
                />
                <span>The system may rephrase a parent concern for tone and clarity before showing it to me.</span>
              </label>

              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", lineHeight: 1.6 }}>
                <input
                  type="checkbox"
                  checked={communicationForm.consentParentTranslatedMessages}
                  onChange={(event) =>
                    setCommunicationForm((current) => ({
                      ...current,
                      consentParentTranslatedMessages: event.target.checked,
                    }))
                  }
                  style={{ marginTop: 4 }}
                />
                <span>I consent to receiving translated parent-originated messages when they are handled respectfully and transparently.</span>
              </label>
            </div>

            <button
              onClick={save}
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
              Save academic path
            </button>

            {status ? (
              <div
                style={{
                  display: "grid",
                  gap: 12,
                  borderRadius: 18,
                  padding: 16,
                  background: "linear-gradient(180deg, rgba(240, 253, 250, 0.95), rgba(236, 248, 255, 0.95))",
                  border: "1px solid rgba(15, 159, 116, 0.18)",
                }}
              >
                <p style={{ margin: 0, color: "#204861", lineHeight: 1.6 }}>{status}</p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Link
                    href="/student?section=strategy"
                    style={{
                      textDecoration: "none",
                      borderRadius: 999,
                      padding: "11px 16px",
                      background: "linear-gradient(135deg, #155eef, #16a3ff)",
                      color: "#ffffff",
                      fontWeight: 800,
                    }}
                  >
                    Open student dashboard
                  </Link>
                  <Link
                    href="/uploads"
                    style={{
                      textDecoration: "none",
                      borderRadius: 999,
                      padding: "11px 16px",
                      background: "#ffffff",
                      border: "1px solid rgba(73, 102, 149, 0.16)",
                      fontWeight: 700,
                    }}
                  >
                    Go to documents
                  </Link>
                  <Link
                    href="/onboarding/sectors"
                    style={{
                      textDecoration: "none",
                      borderRadius: 999,
                      padding: "11px 16px",
                      background: "#ffffff",
                      border: "1px solid rgba(73, 102, 149, 0.16)",
                      fontWeight: 700,
                    }}
                  >
                    Choose career interests
                  </Link>
                </div>
              </div>
            ) : null}
            {errorMessage ? <p style={{ margin: 0, color: "crimson" }}>{errorMessage}</p> : null}
          </div>
        </SectionCard>
      </RequireRole>
    </AppShell>
  );
}
