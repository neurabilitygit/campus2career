import crypto from "node:crypto";
import { JobTargetRepository } from "../../repositories/career/jobTargetRepository";
import { deterministicallyNormalizeJobTarget } from "../llm/jobNormalization";

const jobTargetRepo = new JobTargetRepository();

function normalizeText(value: string | null | undefined, maxLength: number = 240): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

export async function syncPrimaryJobTargetFromStudentIntent(input: {
  studentProfileId: string;
  title?: string | null;
  employer?: string | null;
  location?: string | null;
  sourceType: "manual" | "job_posting" | "partner_feed";
  sourceUrl?: string | null;
  jobDescriptionText?: string | null;
  normalizedRoleFamily?: string | null;
  normalizedSectorCluster?: string | null;
  onetCode?: string | null;
  normalizationConfidence?: number | null;
  normalizationConfidenceLabel?: "low" | "medium" | "high" | null;
  normalizationReasoning?: string | null;
  normalizationSource?: "deterministic" | "llm" | null;
  normalizationTruthStatus?: "direct" | "inferred" | "placeholder" | "fallback" | "unresolved" | null;
  allowOverwriteExistingPrimary?: boolean;
}) {
  const title = normalizeText(input.title);
  const employer = normalizeText(input.employer);
  const location = normalizeText(input.location);
  const sourceUrl = normalizeText(input.sourceUrl, 500);
  const jobDescriptionText = normalizeText(input.jobDescriptionText, 50000);
  const existingPrimary = await jobTargetRepo.getPrimaryForStudent(input.studentProfileId);

  if (existingPrimary && input.allowOverwriteExistingPrimary === false) {
    return existingPrimary;
  }

  if (!title && !input.normalizedRoleFamily) {
    return existingPrimary;
  }

  const normalized =
    input.normalizedRoleFamily
      ? {
          normalizedRoleFamily: input.normalizedRoleFamily ?? null,
          normalizedSectorCluster: input.normalizedSectorCluster ?? null,
          onetCode: input.onetCode ?? null,
          normalizationConfidence: input.normalizationConfidence ?? null,
          confidenceLabel: input.normalizationConfidenceLabel ?? null,
          normalizationReasoning: input.normalizationReasoning ?? null,
          source: input.normalizationSource ?? "deterministic",
          truthStatus: input.normalizationTruthStatus ?? "inferred",
        }
      : deterministicallyNormalizeJobTarget({
          title: title || existingPrimary?.title || "Career target",
          employer: employer || existingPrimary?.employer || undefined,
          location: location || existingPrimary?.location || undefined,
          jobDescriptionText: jobDescriptionText || existingPrimary?.jobDescriptionText || undefined,
        });

  const nextTitle = title || normalized.normalizedRoleFamily || existingPrimary?.title;
  if (!nextTitle) {
    return existingPrimary;
  }

  if (existingPrimary?.jobTargetId) {
    await jobTargetRepo.updatePrimaryIntent({
      studentProfileId: input.studentProfileId,
      jobTargetId: existingPrimary.jobTargetId,
      title: nextTitle,
      employer,
      location,
      sourceType: input.sourceType,
      sourceUrl,
      jobDescriptionText,
      normalizedRoleFamily: normalized.normalizedRoleFamily ?? null,
      normalizedSectorCluster: normalized.normalizedSectorCluster ?? null,
      onetCode: normalized.onetCode ?? null,
      normalizationConfidence: normalized.normalizationConfidence ?? null,
      normalizationConfidenceLabel: normalized.confidenceLabel ?? null,
      normalizationReasoning: normalized.normalizationReasoning ?? null,
      normalizationSource: normalized.source,
      normalizationTruthStatus: normalized.truthStatus,
    });
    return await jobTargetRepo.getPrimaryForStudent(input.studentProfileId);
  }

  await jobTargetRepo.create({
    jobTargetId: crypto.randomUUID(),
    studentProfileId: input.studentProfileId,
    title: nextTitle,
    employer,
    location,
    sourceType: input.sourceType,
    sourceUrl,
    jobDescriptionText,
    normalizedRoleFamily: normalized.normalizedRoleFamily ?? null,
    normalizedSectorCluster: normalized.normalizedSectorCluster ?? null,
    onetCode: normalized.onetCode ?? null,
    normalizationConfidence: normalized.normalizationConfidence ?? null,
    normalizationConfidenceLabel: normalized.confidenceLabel ?? null,
    normalizationReasoning: normalized.normalizationReasoning ?? null,
    normalizationSource: normalized.source,
    normalizationTruthStatus: normalized.truthStatus,
    isPrimary: true,
  });

  return await jobTargetRepo.getPrimaryForStudent(input.studentProfileId);
}
