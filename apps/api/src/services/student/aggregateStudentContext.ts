import { StudentReadRepository } from "../../repositories/student/studentReadRepository";
import { JobTargetRepository } from "../../repositories/career/jobTargetRepository";
import { CareerScenarioRepository } from "../../repositories/career/careerScenarioRepository";
import { OutcomeRepository } from "../../repositories/outcomes/outcomeRepository";
import type { StudentScoringInput } from "../../../../../packages/shared/src/scoring/types";
import {
  TARGET_ROLE_SEEDS,
  getTargetRoleSeedByCanonicalName,
} from "../../../../../packages/shared/src/market/targetRoleSeeds";
import { buildAcademicScoringEvidence } from "../academic/scoringEvidence";
import { AppError } from "../../utils/appError";
import { ensurePersistedPrimaryJobTarget } from "./scoringTargetRepair";

export interface AggregatedStudentContext {
  studentProfileId: string;
  studentName: string;
  targetGoal: string;
  targetGoalSource:
    | "active_career_scenario"
    | "career_goal_summary"
    | "primary_job_target_title"
    | "major_fallback"
    | "unresolved";
  targetGoalTruthStatus: "direct" | "fallback" | "unresolved";
  accomplishments: string[];
  upcomingDeadlines: string[];
  parentVisibleInsights: string[];
}

const repo = new StudentReadRepository();
const jobTargetRepo = new JobTargetRepository();
const careerScenarioRepo = new CareerScenarioRepository();
const outcomeRepo = new OutcomeRepository();

const sectorToRole = new Map(
  TARGET_ROLE_SEEDS.map((seed) => [seed.sectorCluster, { role: seed.canonicalName, sector: seed.sectorCluster }] as const)
);

function normalizeSectorCluster(value: string | undefined | null): string | null {
  if (!value) return null;
  return value
    .trim()
    .toLowerCase()
    .replace(/\s*&\s*/g, "_")
    .replace(/,\s*/g, "_")
    .replace(/\s*\/\s*/g, "_")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function resolveTargetRole(input: {
  selectedSector?: string | null;
  primaryJobTarget?: {
    jobTargetId?: string | null;
    normalizedRoleFamily?: string | null;
    normalizedSectorCluster?: string | null;
    normalizationConfidenceLabel?: "low" | "medium" | "high" | null;
    normalizationSource?: "deterministic" | "llm" | null;
    normalizationTruthStatus?: "direct" | "inferred" | "placeholder" | "fallback" | "unresolved" | null;
    normalizationReasoning?: string | null;
  } | null;
  overrideTargetRoleFamily?: string;
  overrideTargetSectorCluster?: string;
}): {
  targetRoleFamily: string;
  targetSectorCluster: string;
  targetResolution: NonNullable<StudentScoringInput["targetResolution"]>;
} | null {
  if (input.overrideTargetRoleFamily) {
    const seed = getTargetRoleSeedByCanonicalName(input.overrideTargetRoleFamily);
    const usedExplicitSector = !!input.overrideTargetSectorCluster;
    const usedSeedSector = !usedExplicitSector && !!seed?.sectorCluster;
    const usedDefaultSector = !usedExplicitSector && !usedSeedSector;
    return {
      targetRoleFamily: seed?.canonicalName || input.overrideTargetRoleFamily,
      targetSectorCluster: input.overrideTargetSectorCluster || seed?.sectorCluster || "finance_financial_services",
      targetResolution: {
        truthStatus: usedDefaultSector ? "fallback" : "direct",
        confidenceLabel: usedDefaultSector ? "low" : "high",
        resolutionKind: usedDefaultSector ? "defaulted_sector_from_role_seed" : "user_override",
        sourceLabel: "explicit scoring preview override",
        note: usedExplicitSector
          ? "Both role and sector were supplied explicitly for this scoring run."
          : usedSeedSector
            ? "Role was supplied explicitly; sector was backfilled from the seeded role definition."
            : "Role was supplied explicitly; sector fell back to the conservative default cluster.",
      },
    };
  }

  if (input.primaryJobTarget?.normalizedRoleFamily) {
    const seed = getTargetRoleSeedByCanonicalName(input.primaryJobTarget.normalizedRoleFamily);
    const sectorCluster =
      input.primaryJobTarget.normalizedSectorCluster ||
      seed?.sectorCluster ||
      "finance_financial_services";
    const usedNormalizedSector = !!input.primaryJobTarget.normalizedSectorCluster;
    const usedSeedSector = !usedNormalizedSector && !!seed?.sectorCluster;
    const resolutionKind =
      usedNormalizedSector
        ? "normalized_job_target"
        : "defaulted_sector_from_role_seed";
    return {
      targetRoleFamily: seed?.canonicalName || input.primaryJobTarget.normalizedRoleFamily,
      targetSectorCluster: sectorCluster,
      targetResolution: {
        truthStatus:
          !usedNormalizedSector && !usedSeedSector
            ? "fallback"
            : input.primaryJobTarget.normalizationTruthStatus || "inferred",
        confidenceLabel:
          !usedNormalizedSector && !usedSeedSector
            ? "low"
            : input.primaryJobTarget.normalizationConfidenceLabel || "medium",
        resolutionKind,
        sourceLabel: input.primaryJobTarget.normalizationSource
          ? `normalized primary job target (${input.primaryJobTarget.normalizationSource})`
          : "normalized primary job target",
        sourceJobTargetId: input.primaryJobTarget.jobTargetId || null,
        note:
          input.primaryJobTarget.normalizationReasoning ||
          (resolutionKind === "defaulted_sector_from_role_seed"
            ? "The saved job target resolved the role, but the sector cluster had to be backfilled from the canonical role seed."
            : "The saved job target provided the resolved target role."),
      },
    };
  }

  const normalizedSector = normalizeSectorCluster(input.selectedSector);
  const mapped = normalizedSector ? sectorToRole.get(normalizedSector) : undefined;
  if (!mapped) {
    return null;
  }

  return {
    targetRoleFamily: mapped.role,
    targetSectorCluster: mapped.sector,
    targetResolution: {
      truthStatus: "fallback",
      confidenceLabel: "low",
      resolutionKind: "selected_sector_mapping",
      sourceLabel: "selected sector to seed-role mapping",
      note: "No exact target job was saved, so the system mapped the first selected sector to a seeded canonical role family.",
    },
  };
}

function deriveAcademicYear(expectedGraduationDate?: string | null): "freshman" | "sophomore" | "junior" | "senior" | "other" {
  if (!expectedGraduationDate) return "other";
  const grad = new Date(expectedGraduationDate);
  const now = new Date();
  const months = (grad.getFullYear() - now.getFullYear()) * 12 + (grad.getMonth() - now.getMonth());
  if (months > 36) return "freshman";
  if (months > 24) return "sophomore";
  if (months > 12) return "junior";
  if (months >= -3) return "senior";
  return "other";
}

function summarizeRequirementTruthStatus(
  requirementProgress: StudentScoringInput["requirementProgress"]
): "direct" | "inferred" | "placeholder" | "fallback" | "unresolved" {
  if (!requirementProgress?.boundToCatalog) {
    return "unresolved";
  }
  if (requirementProgress.provenanceMethod === "llm_assisted") {
    return "inferred";
  }
  if (requirementProgress.provenanceMethod === "synthetic_seed") {
    return "fallback";
  }
  return "direct";
}

function buildScoringInputQualityNotes(input: {
  targetResolution: NonNullable<StudentScoringInput["targetResolution"]>;
  occupationSkillTruth: NonNullable<StudentScoringInput["occupationSkillTruth"]>;
  marketSignalTruth: NonNullable<StudentScoringInput["marketSignalTruth"]>;
  transcript?: StudentScoringInput["transcript"];
  requirementProgress?: StudentScoringInput["requirementProgress"];
  artifacts: StudentScoringInput["artifacts"];
}): string[] {
  const notes: string[] = [];

  if (input.targetResolution.truthStatus !== "direct") {
    notes.push(
      input.targetResolution.note ||
        `Target role resolution is currently ${input.targetResolution.truthStatus} via ${input.targetResolution.sourceLabel}.`
    );
  }

  if (input.occupationSkillTruth.truthStatus !== "direct") {
    notes.push(input.occupationSkillTruth.note || "Role skill requirements were filled from a fallback source.");
  }

  if (input.marketSignalTruth.truthStatus !== "direct") {
    notes.push(input.marketSignalTruth.note || "Market signal inputs are currently using a fallback baseline.");
  }

  if (input.transcript) {
    if (input.transcript.institutionResolutionTruthStatus === "unresolved") {
      notes.push(
        input.transcript.institutionResolutionNote ||
          "A transcript is loaded, but the institution could not be matched cleanly enough for higher-confidence binding."
      );
    }
  } else {
    notes.push("No parsed transcript is loaded yet, so academic progress is still conservative.");
  }

  if (input.requirementProgress) {
    if (!input.requirementProgress.boundToCatalog) {
      notes.push("The student is not yet bound to a structured catalog requirement set.");
    }
    if (
      input.requirementProgress.boundToCatalog &&
      input.requirementProgress.curriculumVerificationStatus !== "verified"
    ) {
      notes.push("Structured degree requirements are present but have not been visually reviewed and verified yet.");
    }
    notes.push(...(input.requirementProgress.coverageNotes || []));
  }

  const unresolvedArtifacts = input.artifacts.filter(
    (artifact) => artifact.parseTruthStatus === "unresolved" || artifact.parseTruthStatus === "placeholder"
  );
  if (unresolvedArtifacts.length) {
    notes.push(
      `${unresolvedArtifacts.length} uploaded artifact${unresolvedArtifacts.length === 1 ? "" : "s"} still require manual review before being treated as strong evidence.`
    );
  }

  return Array.from(new Set(notes));
}

export async function aggregateStudentContext(studentProfileId: string): Promise<AggregatedStudentContext> {
  const [profile, insights, deadlines, accomplishments, primaryJobTarget, activeScenario] = await Promise.all([
    repo.getStudentProfile(studentProfileId),
    repo.getParentVisibleInsights(studentProfileId),
    repo.getUpcomingDeadlines(studentProfileId),
    repo.getRecentAccomplishments(studentProfileId),
    jobTargetRepo.getPrimaryForStudent(studentProfileId),
    careerScenarioRepo.getActiveForStudent(studentProfileId),
  ]);

  if (!profile) {
    throw new Error(`Student profile not found for ${studentProfileId}`);
  }

  const targetGoalParts = [profile.major_primary, profile.major_secondary].filter(Boolean).join(" / ");
  const targetGoal =
    activeScenario?.scenarioName ||
    activeScenario?.targetRole ||
    profile.career_goal_summary ||
    primaryJobTarget?.title ||
    targetGoalParts ||
    "Career target not yet defined";
  const targetGoalSource =
    activeScenario?.careerScenarioId
      ? "active_career_scenario"
      : profile.career_goal_summary
      ? "career_goal_summary"
      : primaryJobTarget?.title
        ? "primary_job_target_title"
        : targetGoalParts
          ? "major_fallback"
          : "unresolved";
  const targetGoalTruthStatus =
    targetGoalSource === "active_career_scenario" ||
    targetGoalSource === "career_goal_summary" ||
    targetGoalSource === "primary_job_target_title"
      ? "direct"
      : targetGoalSource === "major_fallback"
        ? "fallback"
        : "unresolved";

  return {
    studentProfileId,
    studentName: [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Student",
    targetGoal,
    targetGoalSource,
    targetGoalTruthStatus,
    accomplishments: accomplishments.map((a) =>
      [a.title, a.organization, a.deliverables_summary].filter(Boolean).join(" - ")
    ),
    upcomingDeadlines: deadlines.map((d) =>
      `${d.title} (${d.deadline_type}) due ${d.due_date}`
    ),
    parentVisibleInsights: insights.map((i) => i.parent_safe_summary || i.insight_statement),
  };
}

export async function buildStudentScoringInput(
  studentProfileId: string,
  options?: {
    targetRoleFamily?: string;
    targetSectorCluster?: string;
    preferredGeographies?: string[];
  }
): Promise<StudentScoringInput> {
  const profile = await repo.getStudentProfile(studentProfileId);
  if (!profile) throw new Error(`Student profile not found for ${studentProfileId}`);

  const [sectors, primaryJobTarget, activeScenario] = await Promise.all([
    repo.getSelectedSectors(studentProfileId),
    jobTargetRepo.getPrimaryForStudent(studentProfileId),
    careerScenarioRepo.getActiveForStudent(studentProfileId),
  ]);
  const persistedPrimaryJobTarget = await ensurePersistedPrimaryJobTarget({
    studentProfileId,
    profile,
    primaryJobTarget,
    activeScenario,
  });
  const selectedSector = sectors[0]?.sector_cluster;
  const scenarioPreferredGeographies =
    activeScenario?.assumptions?.preferredGeographies?.length
      ? activeScenario.assumptions.preferredGeographies
      : activeScenario?.targetGeography
        ? [activeScenario.targetGeography]
        : [];
  const resolvedTarget = resolveTargetRole({
    selectedSector,
    primaryJobTarget: persistedPrimaryJobTarget,
    overrideTargetRoleFamily: options?.targetRoleFamily || activeScenario?.targetRole || undefined,
    overrideTargetSectorCluster: options?.targetSectorCluster || activeScenario?.targetSector || undefined,
  });
  if (!resolvedTarget) {
    throw new AppError({
      status: 400,
      code: "target_role_unresolved",
      message:
        "A target role could not be resolved. Save an exact target job or select at least one sector before scoring.",
      details: {
        studentProfileId,
        selectedSector: selectedSector || null,
        hasPrimaryJobTarget: !!primaryJobTarget,
      },
    });
  }
  const { targetRoleFamily, targetSectorCluster, targetResolution } = resolvedTarget;

  const [
    occupationMetadata,
    occupationSkillRows,
    marketSignals,
    courseCoverageRows,
    experiences,
    artifacts,
    contacts,
    outreach,
    deadlines,
    academicEvidence,
    outcomeSummary,
    recentOutcomes,
  ] = await Promise.all([
    repo.getOccupationMetadataForCanonicalRole(targetRoleFamily),
    repo.getOccupationSkillsForCanonicalRole(targetRoleFamily),
    repo.getMarketSignalsForCanonicalRole(targetRoleFamily),
    repo.getCourseCoverage(studentProfileId),
    repo.getRecentAccomplishments(studentProfileId),
    repo.getArtifacts(studentProfileId),
    repo.getContacts(studentProfileId),
    repo.getOutreach(studentProfileId),
    repo.getUpcomingDeadlines(studentProfileId),
    buildAcademicScoringEvidence(studentProfileId),
    outcomeRepo.getSummaryForStudent(studentProfileId),
    outcomeRepo.listForStudent(studentProfileId),
  ] as const);

  const completedDeadlines = deadlines.filter((d) => d.completed).length;
  const overdueOpenDeadlines = deadlines.filter((d) => !d.completed && new Date(d.due_date) < new Date()).length;
  const onlySeededMarketSignals =
    marketSignals.length > 0 && marketSignals.every((signal) => /^ci_seed/i.test(signal.source_name));
  const occupationSkills = occupationSkillRows.length
    ? occupationSkillRows.map((r) => ({
        skillName: r.skill_name,
        skillCategory: r.skill_category,
        importanceScore: Number(r.importance_score),
        requiredProficiencyBand: r.required_proficiency_band,
      }))
    : [
        { skillName: "stakeholder_communication", skillCategory: "communication" as const, importanceScore: 70, requiredProficiencyBand: "intermediate" as const },
        { skillName: "ai_fluency", skillCategory: "ai_fluency" as const, importanceScore: 50, requiredProficiencyBand: "basic" as const },
      ];
  const occupationSkillTruth: NonNullable<StudentScoringInput["occupationSkillTruth"]> = occupationSkillRows.length
    ? {
        truthStatus: "direct" as const,
        confidenceLabel: "high" as const,
        sourceLabel: "occupation_skill_requirements",
      }
    : {
        truthStatus: "fallback" as const,
        confidenceLabel: "low" as const,
        sourceLabel: "hardcoded role-skill fallback",
        note: "No persisted occupation skill requirements were found for the resolved role, so the system fell back to a minimal seeded skill set.",
      };
  const marketSignalTruth: NonNullable<StudentScoringInput["marketSignalTruth"]> = marketSignals.length
    ? {
        truthStatus: onlySeededMarketSignals ? "fallback" : "direct",
        confidenceLabel: (
          onlySeededMarketSignals
            ? "low"
            : marketSignals.some((signal) => signal.confidence_level === "high")
              ? "high"
              : "medium"
        ),
        sourceLabel: onlySeededMarketSignals ? "ci seeded market_signals" : "market_signals",
        note: onlySeededMarketSignals
          ? "The available market signals are synthetic seed rows, so market demand should be treated as fallback context rather than live labor-market truth."
          : undefined,
      }
    : {
        truthStatus: "fallback" as const,
        confidenceLabel: "low" as const,
        sourceLabel: "market baseline fallback",
        note: "No persisted role-specific or macro market signals were found, so market demand will use the conservative default baseline.",
      };
  const artifactsForScoring = artifacts.map((a) => ({
    artifactId: a.academic_artifact_id,
    artifactType: a.artifact_type,
    extractedSummary: a.extracted_summary || undefined,
    tags: [a.parsed_status],
    sourceLabel: a.source_label || undefined,
    parseTruthStatus: a.parse_truth_status,
    parseConfidenceLabel: a.parse_confidence_label,
    extractionMethod: a.extraction_method,
    parseNotes: a.parse_notes,
  }));
  const dataQualityNotes = buildScoringInputQualityNotes({
    targetResolution,
    occupationSkillTruth,
    marketSignalTruth,
    transcript: academicEvidence.transcript,
    requirementProgress: academicEvidence.requirementProgress
      ? {
          ...academicEvidence.requirementProgress,
          truthStatus: summarizeRequirementTruthStatus(academicEvidence.requirementProgress),
        }
      : undefined,
    artifacts: artifactsForScoring,
  });
  const requirementProgress = academicEvidence.requirementProgress
    ? {
        ...academicEvidence.requirementProgress,
        truthStatus: summarizeRequirementTruthStatus(academicEvidence.requirementProgress),
      }
    : undefined;
  const activeScenarioNote =
    activeScenario?.careerScenarioId && !options?.targetRoleFamily
      ? [`Scoring is currently aligned to the active career scenario "${activeScenario.scenarioName}".`]
      : [];

  return {
    studentId: studentProfileId,
    targetRoleFamily,
    targetSectorCluster,
    targetResolution,
    preferredGeographies:
      options?.preferredGeographies?.length
        ? options.preferredGeographies
        : scenarioPreferredGeographies.length
          ? scenarioPreferredGeographies
          : profile.preferred_geographies || [],
    occupationMetadata: occupationMetadata
      ? {
          onetCode: occupationMetadata.onet_code || undefined,
          jobZone: occupationMetadata.job_zone ?? undefined,
          description: occupationMetadata.description || undefined,
        }
      : undefined,
    transcript: academicEvidence.transcript,
    requirementProgress,
    occupationSkillTruth,
    marketSignalTruth,
    dataQualityNotes: [...activeScenarioNote, ...dataQualityNotes],
    occupationSkills,
    marketSignals: marketSignals.map((signal) => ({
      signalType: signal.signal_type,
      signalValue: signal.signal_value == null ? undefined : Number(signal.signal_value),
      signalDirection: signal.signal_direction || undefined,
      sourceName: signal.source_name,
      effectiveDate: signal.effective_date,
      confidenceLevel: signal.confidence_level || undefined,
      scope: signal.scope,
    })),
    courseCoverage: courseCoverageRows.map((r) => ({
      courseId: r.course_id,
      skillName: r.skill_name,
      coverageStrength: r.coverage_strength,
      confidenceScore: Number(r.confidence_score),
    })),
    experiences: experiences.map((e) => ({
      experienceId: e.experience_id,
      title: e.title,
      toolsUsed: e.tools_used || [],
      deliverablesSummary: e.deliverables_summary || undefined,
      relevanceRating: e.relevance_rating || undefined,
    })),
    artifacts: artifactsForScoring,
    contacts: contacts.map((c) => ({
      contactId: c.contact_id,
      warmthLevel: c.warmth_level || undefined,
      relationshipType: c.relationship_type || undefined,
    })),
    outreach: outreach.map((o) => ({
      interactionId: o.outreach_interaction_id,
      interactionType: o.interaction_type,
      outcome: o.outcome || undefined,
    })),
    outcomes: {
      summary: outcomeSummary,
      latestReportedByRole: recentOutcomes[0]?.reportedByRole || null,
      latestVerificationStatus: recentOutcomes[0]?.verificationStatus || null,
      latestUpdatedAt: recentOutcomes[0]?.updatedAt || null,
    },
    deadlines: deadlines.map((d) => ({
      deadlineType: d.deadline_type,
      dueDate: d.due_date,
      completed: !!d.completed,
    })),
    signals: {
      currentAcademicYear: deriveAcademicYear(profile.expected_graduation_date),
      hasInternshipByJuniorYear: experiences.some((e) => /intern/i.test(e.title)),
      hasIndependentProjectBySeniorYear: artifacts.some((a) =>
        ["project", "portfolio", "presentation"].includes(a.artifact_type)
      ),
      hasFirstOrSecondDegreeProfessionalNetwork: contacts.length > 0,
      hasCarefullyCultivatedMentors: contacts.some((c) => c.warmth_level === "strong"),
      aiToolComfortLevel: undefined,
      repeatedDeadlineMisses: overdueOpenDeadlines + Math.max(0, deadlines.length - completedDeadlines - 2),
    },
  };
}
