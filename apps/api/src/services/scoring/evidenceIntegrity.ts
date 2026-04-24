import type {
  ConfidenceLabel,
  TruthStatus,
} from "../../../../../packages/shared/src/contracts/truth";
import type {
  EvidenceAssessment,
  EvidenceAssessmentStatus,
  EvidenceCategory,
  EvidenceFlag,
  EvidenceLevel,
  EvidenceSourceMetadata,
  StudentScoringInput,
  SubScoreEvidenceDetail,
} from "../../../../../packages/shared/src/scoring/types";

function levelRank(level: EvidenceLevel): number {
  if (level === "strong") return 4;
  if (level === "moderate") return 3;
  if (level === "weak") return 2;
  return 1;
}

function maxLevel(left: EvidenceLevel, right: EvidenceLevel): EvidenceLevel {
  return levelRank(left) >= levelRank(right) ? left : right;
}

function flagsForTruthStatus(truthStatus?: TruthStatus | null): EvidenceFlag[] {
  if (truthStatus === "inferred") return ["inferred"];
  if (truthStatus === "placeholder") return ["placeholder"];
  if (truthStatus === "unresolved") return ["unresolved"];
  return [];
}

function calculateAssessmentStatus(
  strength: EvidenceLevel,
  confidenceLabel: ConfidenceLabel,
  sourceFlags: EvidenceFlag[]
): EvidenceAssessmentStatus {
  if (strength === "missing") {
    return "missing";
  }
  if (sourceFlags.includes("unresolved") || confidenceLabel === "low") {
    return "uncertain";
  }
  if (strength === "weak") {
    return "partial";
  }
  return "supported";
}

function isStaleDate(value?: string | null, maxAgeDays: number = 365): boolean {
  if (!value) return false;
  const updatedAt = new Date(value).getTime();
  if (Number.isNaN(updatedAt)) return false;
  const ageMs = Date.now() - updatedAt;
  return ageMs > maxAgeDays * 24 * 60 * 60 * 1000;
}

function summarizeCompleteness(
  availableEvidence: EvidenceCategory[],
  missingEvidence: EvidenceCategory[]
): number {
  const total = availableEvidence.length + missingEvidence.length;
  if (total === 0) return 0;
  return Math.round((availableEvidence.length / total) * 100);
}

function categoryLabel(category: EvidenceCategory): string {
  return category.replace(/_/g, " ");
}

export function recommendedEvidenceAction(category: EvidenceCategory): string {
  switch (category) {
    case "transcript":
      return "Upload transcript";
    case "academic_requirements":
      return "Confirm degree program";
    case "resume":
      return "Add resume";
    case "experience_history":
      return "Add internship, work, or research experience";
    case "project_proof_of_work":
      return "Add project or portfolio evidence";
    case "target_role":
      return "Confirm target role";
    case "market_signals":
      return "Load market signals for the target role";
    case "network_activity":
      return "Add network activity or outreach history";
    case "execution_activity":
      return "Track deadlines or milestone activity";
    case "application_outcome_activity":
      return "Record applications, interviews, or offers";
    case "student_profile":
      return "Complete student profile details";
    case "parent_coach_context":
      return "Add coach or parent context if it should inform support";
    default:
      return `Add ${categoryLabel(category)}`;
  }
}

function buildSourceMetadata(input: {
  category: EvidenceCategory;
  sourceType: string;
  sourceId?: string | null;
  sourceLabel: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  reportedBy?: "student" | "parent" | "coach" | "admin" | "system" | null;
  verificationState?: string | null;
  confidenceLabel?: ConfidenceLabel | null;
  truthStatus?: TruthStatus | null;
}): EvidenceSourceMetadata {
  const stale = isStaleDate(input.updatedAt || input.createdAt);
  return {
    category: input.category,
    sourceType: input.sourceType,
    sourceId: input.sourceId ?? null,
    sourceLabel: input.sourceLabel,
    createdAt: input.createdAt ?? null,
    updatedAt: input.updatedAt ?? null,
    reportedBy: input.reportedBy ?? null,
    verificationState: input.verificationState ?? null,
    confidenceLabel: input.confidenceLabel ?? null,
    truthStatus: input.truthStatus ?? null,
    stale,
  };
}

export function buildEvidenceAssessments(input: StudentScoringInput): EvidenceAssessment[] {
  const transcriptMetadata: EvidenceSourceMetadata[] = input.transcript
    ? [
        buildSourceMetadata({
          category: "transcript",
          sourceType: input.transcript.extractionMethod || "transcript_graph",
          sourceLabel: input.transcript.transcriptSummary || "Parsed transcript",
          confidenceLabel: input.transcript.extractionConfidenceLabel || "low",
          truthStatus: input.transcript.truthStatus,
        }),
      ]
    : [];

  const transcriptFlags: EvidenceFlag[] = [
    ...flagsForTruthStatus(input.transcript?.truthStatus),
    ...(input.transcript?.institutionResolutionTruthStatus === "unresolved"
      ? (["unresolved"] as EvidenceFlag[])
      : []),
    ...transcriptMetadata.filter((item) => item.stale).map(() => "stale" as const),
  ];
  const transcriptStrength: EvidenceLevel =
    !input.transcript
      ? "missing"
      : input.transcript.matchedCatalogCourseCount >= 8
        ? "strong"
        : input.transcript.completedCourseCount >= 4
          ? "moderate"
          : "weak";

  const transcriptAssessment: EvidenceAssessment = {
    category: "transcript",
    strength: transcriptStrength,
    status: calculateAssessmentStatus(
      transcriptStrength,
      input.transcript?.extractionConfidenceLabel || "low",
      transcriptFlags
    ),
    confidenceLabel: input.transcript?.extractionConfidenceLabel || "low",
    requiredEvidence: ["transcript"],
    availableEvidence: input.transcript ? ["transcript"] : [],
    missingEvidence: input.transcript ? [] : ["transcript"],
    weakEvidence: transcriptStrength === "weak" ? ["transcript"] : [],
    inferredEvidence: transcriptFlags.includes("inferred") ? ["transcript"] : [],
    placeholderEvidence: transcriptFlags.includes("placeholder") ? ["transcript"] : [],
    staleEvidence: transcriptFlags.includes("stale") ? ["transcript"] : [],
    completenessPercent: input.transcript ? 100 : 0,
    explanation:
      !input.transcript
        ? "Transcript evidence is missing, so academic readiness cannot be fully assessed."
        : transcriptStrength === "strong"
          ? "Transcript evidence is strong enough to support academic-readiness interpretation."
          : "Transcript evidence exists but is still limited or only partially matched.",
    evidenceNotes: [
      ...(input.transcript?.institutionResolutionNote ? [input.transcript.institutionResolutionNote] : []),
      ...(input.transcript?.unmatchedCourseCount
        ? [`${input.transcript.unmatchedCourseCount} transcript course(s) remain unmatched.`]
        : []),
    ],
    recommendedEvidence: input.transcript ? [] : [recommendedEvidenceAction("transcript")],
    sourceMetadata: transcriptMetadata,
    sourceFlags: Array.from(new Set(transcriptFlags)),
  };

  const requirementSourceMetadata: EvidenceSourceMetadata[] = input.requirementProgress
    ? [
        buildSourceMetadata({
          category: "academic_requirements",
          sourceType: input.requirementProgress.provenanceMethod || "requirement_graph",
          sourceLabel:
            input.requirementProgress.requirementSetDisplayName ||
            input.requirementProgress.majorDisplayName ||
            "Structured degree requirements",
          confidenceLabel: input.requirementProgress.inferredConfidence,
          truthStatus: input.requirementProgress.truthStatus,
        }),
      ]
    : [];
  const requirementFlags: EvidenceFlag[] = [
    ...flagsForTruthStatus(input.requirementProgress?.truthStatus),
    ...requirementSourceMetadata.filter((item) => item.stale).map(() => "stale" as const),
  ];
  const requirementStrength: EvidenceLevel =
    input.requirementProgress?.boundToCatalog
      ? input.requirementProgress.truthStatus === "direct" &&
        input.requirementProgress.inferredConfidence === "high"
        ? "strong"
        : input.requirementProgress.inferredConfidence === "medium"
          ? "moderate"
          : "weak"
      : "missing";
  const requirementAssessment: EvidenceAssessment = {
    category: "academic_requirements",
    strength: requirementStrength,
    status: calculateAssessmentStatus(
      requirementStrength,
      input.requirementProgress?.inferredConfidence || "low",
      requirementFlags
    ),
    confidenceLabel: input.requirementProgress?.inferredConfidence || "low",
    requiredEvidence: ["academic_requirements"],
    availableEvidence: input.requirementProgress?.boundToCatalog ? ["academic_requirements"] : [],
    missingEvidence: input.requirementProgress?.boundToCatalog ? [] : ["academic_requirements"],
    weakEvidence: requirementStrength === "weak" ? ["academic_requirements"] : [],
    inferredEvidence: requirementFlags.includes("inferred") ? ["academic_requirements"] : [],
    placeholderEvidence: requirementFlags.includes("placeholder") ? ["academic_requirements"] : [],
    staleEvidence: requirementFlags.includes("stale") ? ["academic_requirements"] : [],
    completenessPercent: input.requirementProgress?.boundToCatalog ? 100 : 0,
    explanation:
      input.requirementProgress?.boundToCatalog
        ? "Structured requirement evidence is available for degree-progress evaluation."
        : "Academic requirement evidence is missing or not yet bound to a structured catalog.",
    evidenceNotes: [...(input.requirementProgress?.coverageNotes || [])],
    recommendedEvidence: input.requirementProgress?.boundToCatalog
      ? []
      : [recommendedEvidenceAction("academic_requirements")],
    sourceMetadata: requirementSourceMetadata,
    sourceFlags: Array.from(new Set(requirementFlags)),
  };

  const resumeArtifacts = input.artifacts.filter((artifact) => artifact.artifactType === "resume");
  const resumeFlags: EvidenceFlag[] = [
    ...resumeArtifacts.flatMap((artifact) => flagsForTruthStatus(artifact.parseTruthStatus || null)),
    ...(resumeArtifacts.some((artifact) => artifact.parseNotes?.toLowerCase().includes("summary-only"))
      ? ["placeholder" as const]
      : []),
  ];
  const resumeAssessment: EvidenceAssessment = {
    category: "resume",
    strength:
      resumeArtifacts.length === 0
        ? "missing"
        : resumeArtifacts.some((artifact) => artifact.parseConfidenceLabel === "high")
          ? "moderate"
          : "weak",
    status: calculateAssessmentStatus(
      resumeArtifacts.length === 0
        ? "missing"
        : resumeArtifacts.some((artifact) => artifact.parseConfidenceLabel === "high")
          ? "moderate"
          : "weak",
      resumeArtifacts.some((artifact) => artifact.parseConfidenceLabel === "high") ? "medium" : "low",
      resumeFlags
    ),
    confidenceLabel: resumeArtifacts.some((artifact) => artifact.parseConfidenceLabel === "high")
      ? "medium"
      : "low",
    requiredEvidence: ["resume"],
    availableEvidence: resumeArtifacts.length ? ["resume"] : [],
    missingEvidence: resumeArtifacts.length ? [] : ["resume"],
    weakEvidence:
      resumeArtifacts.length && !resumeArtifacts.some((artifact) => artifact.parseConfidenceLabel === "high")
        ? ["resume"]
        : [],
    inferredEvidence: resumeFlags.includes("inferred") ? ["resume"] : [],
    placeholderEvidence: resumeFlags.includes("placeholder") ? ["resume"] : [],
    staleEvidence: [],
    completenessPercent: resumeArtifacts.length ? 100 : 0,
    explanation:
      resumeArtifacts.length === 0
        ? "No resume evidence is available yet."
        : resumeFlags.includes("placeholder")
          ? "Resume evidence exists but is currently summary-only and should not be treated as strong proof."
          : "Resume evidence is available and can support experience interpretation.",
    evidenceNotes: resumeArtifacts
      .map((artifact) => artifact.parseNotes)
      .filter((note): note is string => !!note)
      .slice(0, 3),
    recommendedEvidence: resumeArtifacts.length ? [] : [recommendedEvidenceAction("resume")],
    sourceMetadata: resumeArtifacts.map((artifact) =>
      buildSourceMetadata({
        category: "resume",
        sourceType: artifact.extractionMethod || "artifact",
        sourceId: artifact.artifactId,
        sourceLabel: artifact.sourceLabel || "Resume artifact",
        confidenceLabel: artifact.parseConfidenceLabel || "low",
        truthStatus: artifact.parseTruthStatus || null,
      })
    ),
    sourceFlags: Array.from(new Set(resumeFlags)),
  };

  const experienceAssessment: EvidenceAssessment = {
    category: "experience_history",
    strength:
      input.experiences.length >= 3 ? "strong" : input.experiences.length >= 1 ? "moderate" : "missing",
    status: calculateAssessmentStatus(
      input.experiences.length >= 3 ? "strong" : input.experiences.length >= 1 ? "moderate" : "missing",
      input.experiences.length >= 2 ? "medium" : "low",
      []
    ),
    confidenceLabel: input.experiences.length >= 2 ? "medium" : "low",
    requiredEvidence: ["experience_history"],
    availableEvidence: input.experiences.length ? ["experience_history"] : [],
    missingEvidence: input.experiences.length ? [] : ["experience_history"],
    weakEvidence: [],
    inferredEvidence: [],
    placeholderEvidence: [],
    staleEvidence: [],
    completenessPercent: input.experiences.length ? 100 : 0,
    explanation:
      input.experiences.length === 0
        ? "No structured experience history is available yet."
        : "Structured experience history is available for readiness interpretation.",
    evidenceNotes: [],
    recommendedEvidence: input.experiences.length ? [] : [recommendedEvidenceAction("experience_history")],
    sourceMetadata: input.experiences.map((experience) =>
      buildSourceMetadata({
        category: "experience_history",
        sourceType: "experience_record",
        sourceId: experience.experienceId,
        sourceLabel: experience.title,
        confidenceLabel: experience.relevanceRating && experience.relevanceRating >= 4 ? "medium" : "low",
      })
    ),
    sourceFlags: [],
  };

  const portfolioArtifacts = input.artifacts.filter(
    (artifact) => artifact.artifactType !== "resume" && artifact.artifactType !== "transcript"
  );
  const portfolioFlags: EvidenceFlag[] = portfolioArtifacts.flatMap((artifact) =>
    flagsForTruthStatus(artifact.parseTruthStatus || null)
  );
  const portfolioStrength: EvidenceLevel =
    portfolioArtifacts.length >= 3
      ? "strong"
      : portfolioArtifacts.length >= 1
        ? "moderate"
        : "missing";
  const portfolioAssessment: EvidenceAssessment = {
    category: "project_proof_of_work",
    strength: portfolioStrength,
    status: calculateAssessmentStatus(
      portfolioStrength,
      portfolioArtifacts.some((artifact) => artifact.parseConfidenceLabel === "high") ? "medium" : "low",
      portfolioFlags
    ),
    confidenceLabel: portfolioArtifacts.some((artifact) => artifact.parseConfidenceLabel === "high")
      ? "medium"
      : "low",
    requiredEvidence: ["project_proof_of_work"],
    availableEvidence: portfolioArtifacts.length ? ["project_proof_of_work"] : [],
    missingEvidence: portfolioArtifacts.length ? [] : ["project_proof_of_work"],
    weakEvidence: portfolioStrength === "moderate" ? ["project_proof_of_work"] : [],
    inferredEvidence: portfolioFlags.includes("inferred") ? ["project_proof_of_work"] : [],
    placeholderEvidence: portfolioFlags.includes("placeholder") ? ["project_proof_of_work"] : [],
    staleEvidence: [],
    completenessPercent: portfolioArtifacts.length ? 100 : 0,
    explanation:
      portfolioArtifacts.length === 0
        ? "No project or portfolio evidence is available yet."
        : "Project or proof-of-work evidence is available from uploaded artifacts.",
    evidenceNotes: portfolioArtifacts
      .map((artifact) => artifact.parseNotes)
      .filter((note): note is string => !!note)
      .slice(0, 3),
    recommendedEvidence: portfolioArtifacts.length ? [] : [recommendedEvidenceAction("project_proof_of_work")],
    sourceMetadata: portfolioArtifacts.map((artifact) =>
      buildSourceMetadata({
        category: "project_proof_of_work",
        sourceType: artifact.extractionMethod || "artifact",
        sourceId: artifact.artifactId,
        sourceLabel: artifact.sourceLabel || artifact.artifactType,
        confidenceLabel: artifact.parseConfidenceLabel || "low",
        truthStatus: artifact.parseTruthStatus || null,
      })
    ),
    sourceFlags: Array.from(new Set(portfolioFlags)),
  };

  const targetRoleFlags: EvidenceFlag[] = [
    ...flagsForTruthStatus(input.targetResolution?.truthStatus),
    ...(input.targetResolution?.resolutionKind === "selected_sector_mapping" ||
    input.targetResolution?.resolutionKind === "defaulted_sector_from_role_seed"
      ? ["self_reported" as const]
      : []),
  ];
  const targetRoleAssessment: EvidenceAssessment = {
    category: "target_role",
    strength:
      input.targetResolution?.truthStatus === "direct"
        ? "strong"
        : input.targetResolution?.truthStatus === "inferred" || input.targetResolution?.truthStatus === "fallback"
          ? "weak"
          : "missing",
    status: calculateAssessmentStatus(
      input.targetResolution?.truthStatus === "direct"
        ? "strong"
        : input.targetResolution?.truthStatus === "inferred" || input.targetResolution?.truthStatus === "fallback"
          ? "weak"
          : "missing",
      input.targetResolution?.confidenceLabel || "low",
      targetRoleFlags
    ),
    confidenceLabel: input.targetResolution?.confidenceLabel || "low",
    requiredEvidence: ["target_role"],
    availableEvidence: input.targetResolution ? ["target_role"] : [],
    missingEvidence: input.targetResolution ? [] : ["target_role"],
    weakEvidence:
      input.targetResolution && input.targetResolution.truthStatus !== "direct" ? ["target_role"] : [],
    inferredEvidence: targetRoleFlags.includes("inferred") ? ["target_role"] : [],
    placeholderEvidence: [],
    staleEvidence: [],
    completenessPercent: input.targetResolution ? 100 : 0,
    explanation:
      !input.targetResolution
        ? "No target role could be resolved."
        : input.targetResolution.truthStatus === "direct"
          ? "The target role is explicitly grounded."
          : "The target role is still inferred or fallback-based, so role-fit interpretation stays cautious.",
    evidenceNotes: input.targetResolution?.note ? [input.targetResolution.note] : [],
    recommendedEvidence:
      input.targetResolution?.truthStatus === "direct" ? [] : [recommendedEvidenceAction("target_role")],
    sourceMetadata: input.targetResolution
      ? [
          buildSourceMetadata({
            category: "target_role",
            sourceType: input.targetResolution.resolutionKind,
            sourceId: input.targetResolution.sourceJobTargetId || null,
            sourceLabel: input.targetResolution.sourceLabel,
            confidenceLabel: input.targetResolution.confidenceLabel,
            truthStatus: input.targetResolution.truthStatus,
          }),
        ]
      : [],
    sourceFlags: Array.from(new Set(targetRoleFlags)),
  };

  const marketSignalFlags: EvidenceFlag[] = [
    ...flagsForTruthStatus(input.marketSignalTruth?.truthStatus),
    ...(input.marketSignals?.length && input.marketSignals.every((signal) => /^ci_seed/i.test(signal.sourceName))
      ? ["placeholder" as const]
      : []),
  ];
  const marketSignalStrength: EvidenceLevel =
    !input.marketSignals?.length
      ? "missing"
      : input.marketSignalTruth?.truthStatus === "direct" && input.marketSignals.length >= 3
        ? "strong"
        : input.marketSignals.length >= 2
          ? "moderate"
          : "weak";
  const marketSignalAssessment: EvidenceAssessment = {
    category: "market_signals",
    strength: marketSignalStrength,
    status: calculateAssessmentStatus(
      marketSignalStrength,
      input.marketSignalTruth?.confidenceLabel || "low",
      marketSignalFlags
    ),
    confidenceLabel: input.marketSignalTruth?.confidenceLabel || "low",
    requiredEvidence: ["market_signals", "target_role"],
    availableEvidence: input.marketSignals?.length ? ["market_signals"] : [],
    missingEvidence: input.marketSignals?.length ? [] : ["market_signals"],
    weakEvidence: marketSignalStrength === "weak" ? ["market_signals"] : [],
    inferredEvidence: marketSignalFlags.includes("inferred") ? ["market_signals"] : [],
    placeholderEvidence: marketSignalFlags.includes("placeholder") ? ["market_signals"] : [],
    staleEvidence: input.marketSignals?.some((signal) => isStaleDate(signal.effectiveDate))
      ? ["market_signals"]
      : [],
    completenessPercent: input.marketSignals?.length ? 100 : 0,
    explanation:
      input.marketSignals?.length
        ? "Market signal evidence is available for the resolved role."
        : "No role-specific market signals are loaded yet.",
    evidenceNotes: input.marketSignalTruth?.note ? [input.marketSignalTruth.note] : [],
    recommendedEvidence: input.marketSignals?.length ? [] : [recommendedEvidenceAction("market_signals")],
    sourceMetadata: (input.marketSignals || []).map((signal) =>
      buildSourceMetadata({
        category: "market_signals",
        sourceType: signal.signalType,
        sourceLabel: `${signal.signalType} from ${signal.sourceName}`,
        updatedAt: signal.effectiveDate,
        confidenceLabel: signal.confidenceLevel || input.marketSignalTruth?.confidenceLabel || "low",
        truthStatus: input.marketSignalTruth?.truthStatus || null,
      })
    ),
    sourceFlags: Array.from(new Set(marketSignalFlags)),
  };

  const networkAssessment: EvidenceAssessment = {
    category: "network_activity",
    strength:
      input.contacts.length + input.outreach.length >= 5
        ? "strong"
        : input.contacts.length + input.outreach.length >= 1
          ? "moderate"
          : "missing",
    status: calculateAssessmentStatus(
      input.contacts.length + input.outreach.length >= 5
        ? "strong"
        : input.contacts.length + input.outreach.length >= 1
          ? "moderate"
          : "missing",
      input.contacts.length || input.outreach.length ? "medium" : "low",
      []
    ),
    confidenceLabel: input.contacts.length || input.outreach.length ? "medium" : "low",
    requiredEvidence: ["network_activity"],
    availableEvidence: input.contacts.length || input.outreach.length ? ["network_activity"] : [],
    missingEvidence: input.contacts.length || input.outreach.length ? [] : ["network_activity"],
    weakEvidence: [],
    inferredEvidence: [],
    placeholderEvidence: [],
    staleEvidence: [],
    completenessPercent: input.contacts.length || input.outreach.length ? 100 : 0,
    explanation:
      input.contacts.length || input.outreach.length
        ? "Network evidence is available from contacts and outreach."
        : "No network activity evidence is available yet.",
    evidenceNotes: [],
    recommendedEvidence:
      input.contacts.length || input.outreach.length ? [] : [recommendedEvidenceAction("network_activity")],
    sourceMetadata: [
      ...input.contacts.map((contact) =>
        buildSourceMetadata({
          category: "network_activity",
          sourceType: "contact_record",
          sourceId: contact.contactId,
          sourceLabel: contact.relationshipType || "Contact",
          confidenceLabel:
            contact.warmthLevel === "strong"
              ? "high"
              : contact.warmthLevel === "warm"
                ? "medium"
                : "low",
        })
      ),
      ...input.outreach.map((interaction) =>
        buildSourceMetadata({
          category: "network_activity",
          sourceType: "outreach_record",
          sourceId: interaction.interactionId,
          sourceLabel: interaction.interactionType,
          confidenceLabel: "medium",
        })
      ),
    ],
    sourceFlags: [],
  };

  const executionStrength: EvidenceLevel =
    (input.deadlines?.length || 0) >= 4
      ? "strong"
      : (input.deadlines?.length || 0) >= 1
        ? "moderate"
        : "missing";
  const executionAssessment: EvidenceAssessment = {
    category: "execution_activity",
    strength: executionStrength,
    status: calculateAssessmentStatus(executionStrength, (input.deadlines?.length || 0) >= 2 ? "medium" : "low", []),
    confidenceLabel: (input.deadlines?.length || 0) >= 2 ? "medium" : "low",
    requiredEvidence: ["execution_activity"],
    availableEvidence: input.deadlines?.length ? ["execution_activity"] : [],
    missingEvidence: input.deadlines?.length ? [] : ["execution_activity"],
    weakEvidence: [],
    inferredEvidence: [],
    placeholderEvidence: [],
    staleEvidence: [],
    completenessPercent: input.deadlines?.length ? 100 : 0,
    explanation:
      input.deadlines?.length
        ? "Execution evidence is available from tracked deadlines and milestones."
        : "No tracked deadlines or milestones are available yet.",
    evidenceNotes:
      input.deadlines?.length && input.signals.repeatedDeadlineMisses
        ? [`${input.signals.repeatedDeadlineMisses} repeated missed or overdue deadline signal(s) detected.`]
        : [],
    recommendedEvidence: input.deadlines?.length ? [] : [recommendedEvidenceAction("execution_activity")],
    sourceMetadata: (input.deadlines || []).map((deadline, index) =>
      buildSourceMetadata({
        category: "execution_activity",
        sourceType: "deadline",
        sourceId: `${deadline.deadlineType}:${deadline.dueDate}:${index}`,
        sourceLabel: deadline.deadlineType,
        updatedAt: deadline.dueDate,
        confidenceLabel: "medium",
      })
    ),
    sourceFlags: [],
  };

  const outcomeStrength: EvidenceLevel =
    input.outcomes?.summary.totalActive
      ? input.outcomes.summary.countsByVerification.verified > 0 ||
        input.outcomes.summary.countsByVerification.coach_reviewed > 0
        ? "strong"
        : "weak"
      : "missing";
  const outcomeFlags: EvidenceFlag[] = [];
  if (input.outcomes?.latestReportedByRole && input.outcomes.latestReportedByRole !== "admin") {
    outcomeFlags.push("self_reported");
  }
  const outcomeAssessment: EvidenceAssessment = {
    category: "application_outcome_activity",
    strength: outcomeStrength,
    status: calculateAssessmentStatus(
      outcomeStrength,
      input.outcomes?.summary.totalActive ? "medium" : "low",
      outcomeFlags
    ),
    confidenceLabel: input.outcomes?.summary.totalActive ? "medium" : "low",
    requiredEvidence: ["application_outcome_activity"],
    availableEvidence: input.outcomes?.summary.totalActive ? ["application_outcome_activity"] : [],
    missingEvidence: input.outcomes?.summary.totalActive ? [] : ["application_outcome_activity"],
    weakEvidence: outcomeStrength === "weak" ? ["application_outcome_activity"] : [],
    inferredEvidence: [],
    placeholderEvidence: [],
    staleEvidence:
      input.outcomes?.latestUpdatedAt && isStaleDate(input.outcomes.latestUpdatedAt) ? ["application_outcome_activity"] : [],
    completenessPercent: input.outcomes?.summary.totalActive ? 100 : 0,
    explanation:
      input.outcomes?.summary.totalActive
        ? "Outcome tracking evidence is available from recorded applications, interviews, offers, or accepted roles."
        : "No application or outcome activity has been recorded yet.",
    evidenceNotes: input.outcomes?.summary.totalActive
      ? [
          `${input.outcomes.summary.countsByType.internship_application} applications, ${input.outcomes.summary.countsByType.interview} interviews, ${input.outcomes.summary.countsByType.offer} offers, ${input.outcomes.summary.countsByType.accepted_role} accepted roles.`,
        ]
      : [],
    recommendedEvidence:
      input.outcomes?.summary.totalActive ? [] : [recommendedEvidenceAction("application_outcome_activity")],
    sourceMetadata: input.outcomes
      ? [
          buildSourceMetadata({
            category: "application_outcome_activity",
            sourceType: "student_outcomes",
            sourceLabel: `${input.outcomes.summary.totalActive} recorded outcome(s)`,
            updatedAt: input.outcomes.latestUpdatedAt || input.outcomes.summary.latestActionDate || null,
            reportedBy: input.outcomes.latestReportedByRole || null,
            verificationState: input.outcomes.latestVerificationStatus || null,
            confidenceLabel: input.outcomes.summary.totalActive ? "medium" : "low",
          }),
        ]
      : [],
    sourceFlags: Array.from(new Set(outcomeFlags)),
  };

  const profileFilledFields = [
    input.preferredGeographies?.length ? "preferred geographies" : "",
    input.targetRoleFamily ? "target role family" : "",
    input.targetSectorCluster ? "target sector cluster" : "",
  ].filter(Boolean);
  const profileStrength: EvidenceLevel =
    profileFilledFields.length >= 3 ? "strong" : profileFilledFields.length >= 1 ? "moderate" : "missing";
  const profileAssessment: EvidenceAssessment = {
    category: "student_profile",
    strength: profileStrength,
    status: calculateAssessmentStatus(profileStrength, profileStrength === "strong" ? "high" : "medium", []),
    confidenceLabel: profileStrength === "strong" ? "high" : profileStrength === "moderate" ? "medium" : "low",
    requiredEvidence: ["student_profile"],
    availableEvidence: profileFilledFields.length ? ["student_profile"] : [],
    missingEvidence: profileFilledFields.length ? [] : ["student_profile"],
    weakEvidence: profileStrength === "moderate" ? ["student_profile"] : [],
    inferredEvidence: [],
    placeholderEvidence: [],
    staleEvidence: [],
    completenessPercent: summarizeCompleteness(
      profileFilledFields.length ? ["student_profile"] : [],
      profileFilledFields.length ? [] : ["student_profile"]
    ),
    explanation:
      profileFilledFields.length
        ? "The student profile provides baseline context for targeting and interpretation."
        : "The student profile is too sparse to provide strong supporting context.",
    evidenceNotes: profileFilledFields.length ? [`Available profile context: ${profileFilledFields.join(", ")}.`] : [],
    recommendedEvidence: profileFilledFields.length ? [] : [recommendedEvidenceAction("student_profile")],
    sourceMetadata: profileFilledFields.length
      ? [
          buildSourceMetadata({
            category: "student_profile",
            sourceType: "student_profile",
            sourceLabel: "Student profile",
            reportedBy: "student",
            confidenceLabel: profileStrength === "strong" ? "high" : "medium",
          }),
        ]
      : [],
    sourceFlags: [],
  };

  const parentCoachAssessment: EvidenceAssessment = {
    category: "parent_coach_context",
    strength: "missing",
    status: "missing",
    confidenceLabel: "low",
    requiredEvidence: [],
    availableEvidence: [],
    missingEvidence: ["parent_coach_context"],
    weakEvidence: [],
    inferredEvidence: [],
    placeholderEvidence: [],
    staleEvidence: [],
    completenessPercent: 0,
    explanation:
      "Parent and coach context is not currently a direct scoring input, so it does not strengthen or weaken readiness scores yet.",
    evidenceNotes: ["This category is tracked for future support and reporting, not as an active scoring input in V1."],
    recommendedEvidence: [],
    sourceMetadata: [],
    sourceFlags: ["unresolved"],
  };

  return [
    transcriptAssessment,
    requirementAssessment,
    resumeAssessment,
    experienceAssessment,
    portfolioAssessment,
    targetRoleAssessment,
    marketSignalAssessment,
    networkAssessment,
    executionAssessment,
    outcomeAssessment,
    profileAssessment,
    parentCoachAssessment,
  ];
}

export function buildSubscoreEvidenceSummary(input: {
  score: number;
  strength: EvidenceLevel;
  confidenceLabel: ConfidenceLabel;
  requiredEvidence: EvidenceCategory[];
  categoryAssessments: EvidenceAssessment[];
  defaultExplanation: string;
  knownSignals: string[];
  missingSignals: string[];
}): Pick<
  SubScoreEvidenceDetail,
  | "evidenceStatus"
  | "requiredEvidence"
  | "availableEvidence"
  | "missingEvidence"
  | "weakEvidence"
  | "sourceFlags"
  | "evidenceNotes"
  | "recommendedEvidence"
  | "explanation"
> {
  const relevantAssessments = input.categoryAssessments.filter((assessment) =>
    input.requiredEvidence.includes(assessment.category)
  );
  const availableEvidence = relevantAssessments
    .filter((assessment) => assessment.strength !== "missing")
    .map((assessment) => assessment.category);
  const missingEvidence = relevantAssessments
    .filter((assessment) => assessment.strength === "missing")
    .map((assessment) => assessment.category);
  const weakEvidence = relevantAssessments
    .filter((assessment) => assessment.strength === "weak")
    .map((assessment) => assessment.category);
  const sourceFlags = Array.from(
    new Set(relevantAssessments.flatMap((assessment) => assessment.sourceFlags))
  );
  const evidenceNotes = Array.from(
    new Set(relevantAssessments.flatMap((assessment) => assessment.evidenceNotes))
  ).slice(0, 6);
  const recommendedEvidence = Array.from(
    new Set(relevantAssessments.flatMap((assessment) => assessment.recommendedEvidence))
  ).slice(0, 4);

  const evidenceStatus = calculateAssessmentStatus(
    input.strength,
    input.confidenceLabel,
    sourceFlags
  );

  const explanation =
    missingEvidence.length > 0
      ? `${input.defaultExplanation} This area cannot be assessed confidently because ${missingEvidence
          .map(categoryLabel)
          .join(" and ")} ${
          missingEvidence.length === 1 ? "is" : "are"
        } missing.`
      : weakEvidence.length > 0 || sourceFlags.includes("inferred") || sourceFlags.includes("placeholder")
        ? `${input.defaultExplanation} This is directionally useful, but some supporting evidence is still limited or indirect.`
        : input.defaultExplanation;

  return {
    evidenceStatus,
    requiredEvidence: input.requiredEvidence,
    availableEvidence,
    missingEvidence,
    weakEvidence,
    sourceFlags,
    evidenceNotes,
    recommendedEvidence,
    explanation,
  };
}

export function summarizeOverallEvidence(categoryAssessments: EvidenceAssessment[]): {
  strongestEvidenceCategories: EvidenceCategory[];
  weakestEvidenceCategories: EvidenceCategory[];
  blockedByMissingEvidence: EvidenceCategory[];
  recommendedEvidenceActions: string[];
} {
  const strongestEvidenceCategories = categoryAssessments
    .filter((assessment) => assessment.strength === "strong")
    .map((assessment) => assessment.category)
    .slice(0, 4);
  const weakestEvidenceCategories = categoryAssessments
    .filter((assessment) => assessment.strength === "weak")
    .map((assessment) => assessment.category)
    .slice(0, 6);
  const blockedByMissingEvidence = categoryAssessments
    .filter((assessment) => assessment.strength === "missing")
    .map((assessment) => assessment.category)
    .slice(0, 6);
  const recommendedEvidenceActions = Array.from(
    new Set(
      categoryAssessments
        .flatMap((assessment) => assessment.recommendedEvidence)
        .filter(Boolean)
    )
  ).slice(0, 8);

  return {
    strongestEvidenceCategories,
    weakestEvidenceCategories,
    blockedByMissingEvidence,
    recommendedEvidenceActions,
  };
}

export function evidenceStrengthFromAssessments(assessments: EvidenceAssessment[]): EvidenceLevel {
  if (assessments.every((assessment) => assessment.strength === "missing")) {
    return "missing";
  }

  return assessments.reduce<EvidenceLevel>((current, assessment) => {
    if (assessment.strength === "missing") {
      return current;
    }
    return maxLevel(current, assessment.strength);
  }, "missing");
}
