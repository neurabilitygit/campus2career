"use client";

import { useDeferredValue, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "../../../components/layout/AppShell";
import { SectionCard } from "../../../components/layout/SectionCard";
import { RequireRole } from "../../../components/RequireRole";
import { FieldInfoLabel } from "../../../components/forms/FieldInfoLabel";
import { apiFetch } from "../../../lib/apiClient";
import { useSaveNavigation } from "../../../lib/saveNavigation";
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
  status: "succeeded" | "needs_review";
  sourceUsed: "seeded_database" | "scrape" | "llm_training_data" | "manual_input";
  manualInputRequired: boolean;
  uploadRecommended: boolean;
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
  const saveNavigation = useSaveNavigation();
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
  const [isInstitutionPickerOpen, setIsInstitutionPickerOpen] = useState(true);

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
  const [manualProgramForm, setManualProgramForm] = useState({
    catalogLabel: "",
    degreeType: "Undergraduate",
    programName: "",
    majorDisplayName: "",
    minorDisplayName: "",
    concentrationDisplayName: "",
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
    setIsInstitutionPickerOpen(false);
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
    if (currentAssignment.institution_canonical_name || currentAssignment.institution_display_name) {
      setIsInstitutionPickerOpen(false);
    }
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

    apiFetch("/students/me/academic-evidence/discover-offerings", {
      method: "POST",
      body: JSON.stringify({
        institutionCanonicalName: selectedInstitutionCanonicalName,
      }),
    })
      .then((result: CatalogDiscoveryResponse) => {
        if (!active) return;
        setCatalogDiscovery(result);
        setCatalogDiscoveryLoading(false);
        if (!result.manualInputRequired) {
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

        requirementDiscoveryResult = await apiFetch("/students/me/academic-evidence/discover-degree-requirements", {
          method: "POST",
        });
        setProgramRequirementsDiscovery(
          {
            ok: true,
            status:
              (requirementDiscoveryResult as any).uploadRequired
                ? "upload_required"
                : "requirements_discovered",
            uploadRecommended: Boolean((requirementDiscoveryResult as any).uploadRequired),
            usedLlmAssistance: (requirementDiscoveryResult as any).sourceUsed === "llm_training_data",
            uploadUrl: (requirementDiscoveryResult as any).uploadRequired ? catalogUploadHref : null,
            message: (requirementDiscoveryResult as any).message || "Requirement discovery updated.",
            diagnostics: (requirementDiscoveryResult as any).diagnostics || [],
          } as ProgramRequirementDiscoveryResponse
        );
      }

      saveNavigation.returnAfterSave("/student");
    } catch (error: any) {
      setStatus("");
      setErrorMessage(error?.message || String(error));
    }
  }

  async function saveManualAcademicPath() {
    if (!selectedInstitutionCanonicalName || !selectedInstitutionDisplayName) {
      setCatalogDiscoveryError("Choose a college or university before saving a manual academic path.");
      return;
    }

    try {
      setCatalogDiscoveryLoading(true);
      setCatalogDiscoveryError(null);
      await apiFetch("/students/me/academic-evidence/manual-offering", {
        method: "POST",
        body: JSON.stringify({
          institutionCanonicalName: selectedInstitutionCanonicalName,
          institutionDisplayName: selectedInstitutionDisplayName,
          catalogLabel: manualProgramForm.catalogLabel || undefined,
          degreeType: manualProgramForm.degreeType,
          programName: manualProgramForm.programName,
          majorDisplayName: manualProgramForm.majorDisplayName,
          minorDisplayName: manualProgramForm.minorDisplayName || undefined,
          concentrationDisplayName: manualProgramForm.concentrationDisplayName || undefined,
        }),
      });

      const catalogLabel =
        manualProgramForm.catalogLabel || `Manual ${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
      const slugify = (value: string) =>
        value
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");

      setSelectedCatalogLabel(catalogLabel);
      setSelectedDegreeKey(
        JSON.stringify({
          degreeType: manualProgramForm.degreeType,
          programName: manualProgramForm.programName,
        })
      );
      setSelectedMajorCanonicalName(slugify(manualProgramForm.majorDisplayName));
      setSelectedMinorCanonicalName(
        manualProgramForm.minorDisplayName ? slugify(manualProgramForm.minorDisplayName) : ""
      );
      setSelectedConcentrationCanonicalName(
        manualProgramForm.concentrationDisplayName ? slugify(manualProgramForm.concentrationDisplayName) : ""
      );
      setForm((current) => ({
        ...current,
        schoolName: selectedInstitutionDisplayName,
        majorPrimary: manualProgramForm.majorDisplayName,
        majorSecondary: manualProgramForm.minorDisplayName || current.majorSecondary,
      }));
      setCatalogDiscovery({
        ok: true,
        status: "needs_review",
        sourceUsed: "manual_input",
        manualInputRequired: false,
        uploadRecommended: false,
        message: "Manual academic path saved. Review the degree requirements once a source is available.",
      });
      setDirectoryRefreshNonce((value) => value + 1);
      setCatalogDiscoveryLoading(false);
    } catch (error: any) {
      setCatalogDiscoveryLoading(false);
      setCatalogDiscoveryError(error?.message || String(error));
    }
  }

  return (
    <AppShell
      title="Build your academic path"
      subtitle="Choose your school and major first so the dashboard can explain fit, gaps, and next steps in the right context."
    >
      <RequireRole expectedRoles={["student", "admin"]} fallbackTitle="Student sign-in required">
        <SectionCard
          title="School and program selection"
          subtitle="Start with the college or university. If structured curriculum data is available, the platform can use it right away to make the dashboard more specific."
          tone="highlight"
        >
          <div style={{ display: "grid", gap: 16 }}>
            {isInstitutionPickerOpen || !selectedInstitutionDisplayName ? (
              <label style={labelStyle}>
                <FieldInfoLabel
                  label="Search for your college or university"
                  info="Find the school first so the system can use the right catalog when available."
                  example="Harvard University"
                />
                <input
                  style={inputStyle}
                  placeholder="Start typing a school name"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </label>
            ) : null}

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
                    setIsInstitutionPickerOpen(true);
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
                  Change college
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
                      {catalogDiscovery.manualInputRequired
                        ? "Manual academic path entry is ready"
                        : catalogDiscovery.uploadRecommended
                          ? "We need one more source"
                          : "We found school program data"}
                    </strong>
                    <p style={{ margin: 0, lineHeight: 1.6 }}>{catalogDiscovery.message}</p>
                    {!catalogDiscovery.uploadRecommended && !catalogDiscovery.manualInputRequired ? (
                      <p style={{ margin: 0, fontSize: 14 }}>
                        Source used:{" "}
                        {catalogDiscovery.sourceUsed === "seeded_database"
                          ? "Seeded database"
                          : catalogDiscovery.sourceUsed === "scrape"
                            ? "Scraped school website"
                            : "LLM-assisted"}
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

                {selectedInstitutionCanonicalName &&
                (!directoryOptions?.majors.length || catalogDiscovery?.manualInputRequired) ? (
                  <div
                    style={{
                      borderRadius: 14,
                      border: "1px solid #d8e2f0",
                      background: "#f8fbff",
                      padding: "16px 18px",
                      display: "grid",
                      gap: 14,
                    }}
                  >
                    <strong style={{ color: "#15355b" }}>Manual academic path entry</strong>
                    <p style={{ margin: 0, color: "#4b5d79", lineHeight: 1.6 }}>
                      If automated discovery still looks incomplete, enter the academic path manually here.
                      This keeps the dashboard moving while you gather a stronger catalog or PDF source.
                    </p>
                    <label style={labelStyle}>
                      <FieldInfoLabel
                        label="Catalog label (optional)"
                        info="Use the catalog edition if you know it. Otherwise the system will create a manual catalog label."
                        example="2026-2027"
                      />
                      <input
                        style={inputStyle}
                        placeholder="2026-2027"
                        value={manualProgramForm.catalogLabel}
                        onChange={(event) =>
                          setManualProgramForm((current) => ({ ...current, catalogLabel: event.target.value }))
                        }
                      />
                    </label>
                    <label style={labelStyle}>
                      <FieldInfoLabel
                        label="Degree type"
                        info="Choose the broad degree type tied to the program."
                        example="Undergraduate"
                      />
                      <select
                        style={selectStyle}
                        value={manualProgramForm.degreeType}
                        onChange={(event) =>
                          setManualProgramForm((current) => ({ ...current, degreeType: event.target.value }))
                        }
                      >
                        <option value="Undergraduate">Undergraduate</option>
                        <option value="Graduate">Graduate</option>
                      </select>
                    </label>
                    <label style={labelStyle}>
                      <FieldInfoLabel
                        label="Program name"
                        info="Use the broader school or degree-program bucket if the institution separates majors by college or school."
                        example="Columbia College majors"
                      />
                      <input
                        style={inputStyle}
                        placeholder="Program name"
                        value={manualProgramForm.programName}
                        onChange={(event) =>
                          setManualProgramForm((current) => ({ ...current, programName: event.target.value }))
                        }
                      />
                    </label>
                    <label style={labelStyle}>
                      <FieldInfoLabel
                        label="Major"
                        info="Enter the main field of study exactly as the school describes it when possible."
                        example="Economics"
                      />
                      <input
                        style={inputStyle}
                        placeholder="Major name"
                        value={manualProgramForm.majorDisplayName}
                        onChange={(event) =>
                          setManualProgramForm((current) => ({ ...current, majorDisplayName: event.target.value }))
                        }
                      />
                    </label>
                    <label style={labelStyle}>
                      <FieldInfoLabel
                        label="Minor (optional)"
                        info="Add a minor only if you are formally pursuing one."
                        example="Data Science"
                      />
                      <input
                        style={inputStyle}
                        placeholder="Minor name"
                        value={manualProgramForm.minorDisplayName}
                        onChange={(event) =>
                          setManualProgramForm((current) => ({ ...current, minorDisplayName: event.target.value }))
                        }
                      />
                    </label>
                    <label style={labelStyle}>
                      <FieldInfoLabel
                        label="Concentration (optional)"
                        info="Use this if the school tracks a concentration within the major."
                        example="Business analytics"
                      />
                      <input
                        style={inputStyle}
                        placeholder="Concentration name"
                        value={manualProgramForm.concentrationDisplayName}
                        onChange={(event) =>
                          setManualProgramForm((current) => ({ ...current, concentrationDisplayName: event.target.value }))
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="ui-button ui-button--secondary"
                      onClick={saveManualAcademicPath}
                      disabled={
                        catalogDiscoveryLoading ||
                        !manualProgramForm.programName.trim() ||
                        !manualProgramForm.majorDisplayName.trim()
                      }
                    >
                      {catalogDiscoveryLoading ? "Saving..." : "Save manual academic path"}
                    </button>
                  </div>
                ) : null}

                {directoryOptions?.catalogs.length ? (
                  <label style={labelStyle}>
                    <FieldInfoLabel
                      label="Catalog year"
                      info="Choose the catalog edition that matches your degree requirements."
                      example="2026-2027"
                    />
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
                    <FieldInfoLabel
                      label="Degree program"
                      info="Pick the broader degree track tied to the selected catalog."
                      example="Undergraduate · Columbia College majors"
                    />
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
                    <FieldInfoLabel
                      label="Major"
                      info="Choose the primary field of study you are following."
                      example="Philosophy"
                    />
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
                    <FieldInfoLabel
                      label="Minor (optional)"
                      info="Add a minor only if you are formally pursuing one."
                      example="Economics"
                    />
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
                    <FieldInfoLabel
                      label="Concentration (optional)"
                      info="Use this if the school tracks a concentration within the major."
                      example="Ethics and Political Philosophy"
                    />
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
                  <FieldInfoLabel
                    label="School name"
                    info="Enter the college or university if it was not selected above."
                    example="University at Buffalo"
                  />
                  <input
                    style={inputStyle}
                    placeholder="School name"
                    value={form.schoolName}
                    onChange={(event) => update("schoolName", event.target.value)}
                  />
                </label>

                <label style={labelStyle}>
                  <FieldInfoLabel
                    label="Primary major or academic path"
                    info="Enter the main course of study if the structured picker is not available."
                    example="Anthropology"
                  />
                  <input
                    style={inputStyle}
                    placeholder="Primary major"
                    value={form.majorPrimary}
                    onChange={(event) => update("majorPrimary", event.target.value)}
                  />
                </label>

                <label style={labelStyle}>
                  <FieldInfoLabel
                    label="Secondary major, minor, or academic path"
                    info="Use this for a second major, minor, or adjacent academic track."
                    example="Data Science minor"
                  />
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
              <FieldInfoLabel
                label="Expected graduation date"
                info="Use the best estimate for when you expect to finish."
                example="2027-05-15"
              />
              <input
                style={inputStyle}
                type="date"
                placeholder="Expected graduation date"
                value={form.expectedGraduationDate}
                onChange={(event) => update("expectedGraduationDate", event.target.value)}
              />
            </label>

            <label style={labelStyle}>
              <FieldInfoLabel
                label="Preferred geographies"
                info="List where you would realistically consider working."
                example="New York, Boston, remote"
              />
              <input
                style={inputStyle}
                placeholder="For example: New York, Boston, remote"
                value={form.preferredGeographies}
                onChange={(event) => update("preferredGeographies", event.target.value)}
              />
            </label>

            <label style={labelStyle}>
              <FieldInfoLabel
                label="Career goal summary"
                info="Describe the path you are leaning toward right now."
                example="Data analyst role in healthcare or biotech"
              />
              <textarea
                style={{ ...inputStyle, minHeight: 120, resize: "vertical" }}
                placeholder="What kind of role or trajectory are you aiming for?"
                value={form.careerGoalSummary}
                onChange={(event) => update("careerGoalSummary", event.target.value)}
                rows={5}
              />
            </label>

            <label style={labelStyle}>
              <FieldInfoLabel
                label="Academic notes"
                info="Add context the catalog does not capture, such as transfers or advisor guidance."
                example="Considering a pre-law path and two transfer credits may apply"
              />
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
                <FieldInfoLabel
                  label="Preferred channels"
                  info="Choose the ways guidance is most comfortable to receive."
                  example="Email and SMS"
                />
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
                <FieldInfoLabel
                  label="Channels to avoid when possible"
                  info="Flag formats that tend to feel intrusive or easy to ignore."
                  example="WhatsApp"
                />
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
                  <FieldInfoLabel
                    label="Preferred tone"
                    info="Choose the tone that makes advice easiest to hear."
                    example="Direct"
                  />
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
                  <FieldInfoLabel
                    label="Preferred frequency"
                    info="Show how often you want guidance to show up."
                    example="Weekly"
                  />
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
                  <FieldInfoLabel
                    label="Best time of day"
                    info="Pick the time when advice is most likely to land well."
                    example="Evening"
                  />
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
                <FieldInfoLabel
                  label="Guidance formats that work best"
                  info="Choose the kinds of guidance that feel most useful."
                  example="Choices and summaries"
                />
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
                <FieldInfoLabel
                  label="Topics that feel sensitive"
                  info="List subjects that should be handled with extra care."
                  example="Money, grades, uncertainty"
                />
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
                <FieldInfoLabel
                  label="Notes about how advice lands best"
                  info="Add anything else that makes guidance easier to accept."
                  example="Short messages work better than long explanations"
                />
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
                <span>
                  <FieldInfoLabel
                    label="If a translated parent-originated message is shown to me, identify it as coming from my parent."
                    info="Keep the source transparent if a parent-related message is ever shown to you."
                    example="The message clearly says it was based on parent input"
                  />
                </span>
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
                <span>
                  <FieldInfoLabel
                    label="The system may rephrase a parent concern for tone and clarity before showing it to me."
                    info="Allow the system to soften or clarify wording without hiding that it came from a parent."
                    example="Turn a tense message into a shorter and calmer version"
                  />
                </span>
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
                <span>
                  <FieldInfoLabel
                    label="I consent to receiving translated parent-originated messages when they are handled respectfully and transparently."
                    info="This controls whether parent-originated translated messages may be delivered to you."
                    example="Unchecked means parent input stays as coaching context only"
                  />
                </span>
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
