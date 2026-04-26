import crypto from "node:crypto";
import { withTransaction, type DbExecutor } from "../../db/client";
import { CareerScenarioRepository } from "../../repositories/career/careerScenarioRepository";
import { JobTargetRepository } from "../../repositories/career/jobTargetRepository";
import { StudentReadRepository } from "../../repositories/student/studentReadRepository";
import { normalizeJobTarget } from "../llm/jobNormalization";
import { buildStudentScoringInput } from "../student/aggregateStudentContext";
import { runScoring } from "../scoring";
import type { RequestContext } from "../auth/resolveRequestContext";
import type {
  CareerScenarioRecord,
  CareerScenarioSummary,
  CareerScenarioUpsertInput,
} from "../../../../../packages/shared/src/contracts/careerScenario";
import {
  analyzeCareerScenario,
  buildScenarioStatusAfterAnalysis,
  extractJobDescriptionRequirements,
  mergeScenarioAssumptions,
} from "./scenarioAnalysis";
import { buildCareerScenarioActionItemDrafts, materializeCareerScenarioActionItems } from "./scenarioActionItems";
import { AppError } from "../../utils/appError";

const repo = new CareerScenarioRepository();
const jobTargetRepo = new JobTargetRepository();
const studentReadRepo = new StudentReadRepository();

function newId() {
  return crypto.randomUUID();
}

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

function validateScenarioNameUniqueness(existing: CareerScenarioSummary[], nextName: string, currentId?: string | null) {
  const conflict = existing.find(
    (item) =>
      item.careerScenarioId !== currentId &&
      item.scenarioName.trim().toLowerCase() === nextName.trim().toLowerCase()
  );
  if (conflict) {
    throw new AppError({
      status: 400,
      code: "career_scenario_name_conflict",
      message: "Scenario names must be unique for this student.",
      details: {
        conflictingCareerScenarioId: conflict.careerScenarioId,
      },
    });
  }
}

async function maybeCreateDefaultScenarioFromLegacyInputs(studentProfileId: string, userId: string): Promise<void> {
  const existing = await repo.listForStudent(studentProfileId);
  if (existing.length) return;

  const [profile, primaryJobTarget] = await Promise.all([
    studentReadRepo.getStudentProfile(studentProfileId),
    jobTargetRepo.getPrimaryForStudent(studentProfileId),
  ]);

  if (!profile && !primaryJobTarget) {
    return;
  }

  const meaningfulLegacyTarget =
    normalizeText(primaryJobTarget?.title) ||
    normalizeText(primaryJobTarget?.jobDescriptionText) ||
    normalizeText(profile?.career_goal_summary);

  if (!meaningfulLegacyTarget) {
    return;
  }

  const derivedName =
    primaryJobTarget?.title ||
    profile?.career_goal_summary ||
    "Current target";

  const assumptions = {
    preferredGeographies: profile?.preferred_geographies || [],
    notes: profile?.career_goal_summary || null,
  };

  const scenarioId = newId();
  try {
    await repo.create({
      careerScenarioId: scenarioId,
      studentProfileId,
      linkedJobTargetId: primaryJobTarget?.jobTargetId ?? null,
      scenarioName: derivedName,
      status: "draft",
      isActive: true,
      jobDescriptionText: primaryJobTarget?.jobDescriptionText ?? null,
      targetRole: primaryJobTarget?.normalizedRoleFamily || primaryJobTarget?.title || profile?.career_goal_summary || null,
      targetProfession: primaryJobTarget?.title || null,
      targetSector: primaryJobTarget?.normalizedSectorCluster || null,
      targetGeography: primaryJobTarget?.location || profile?.preferred_geographies?.[0] || null,
      employerName: primaryJobTarget?.employer || null,
      jobPostingUrl: primaryJobTarget?.sourceUrl || null,
      notes: profile?.career_goal_summary || null,
      assumptions,
      extractedRequirements: extractJobDescriptionRequirements({
        jobDescriptionText: primaryJobTarget?.jobDescriptionText,
        targetRole: primaryJobTarget?.title || null,
        targetSector: primaryJobTarget?.normalizedSectorCluster || null,
      }),
      sourceType: primaryJobTarget?.jobDescriptionText ? "pasted_job_description" : "imported",
      createdByUserId: userId,
      updatedByUserId: userId,
    });
  } catch (error: any) {
    if (error?.code === "23505") {
      return;
    }
    throw error;
  }
}

async function normalizeScenarioTarget(input: CareerScenarioUpsertInput) {
  const freeformTarget =
    input.targetRole ||
    input.targetProfession ||
    input.scenarioName;
  if (!freeformTarget) {
    return { normalizedRoleFamily: null, normalizedSectorCluster: null };
  }

  const normalized = await normalizeJobTarget({
    title: freeformTarget,
    employer: input.employerName || undefined,
    location: input.targetGeography || undefined,
    sourceUrl: input.jobPostingUrl || undefined,
    jobDescriptionText: input.jobDescriptionText || undefined,
  });

  return {
    normalizedRoleFamily: normalized.normalizedRoleFamily || null,
    normalizedSectorCluster: normalized.normalizedSectorCluster || null,
  };
}

export class CareerScenarioService {
  private async hydrateScenario(record: CareerScenarioRecord | null, executor?: DbExecutor): Promise<CareerScenarioRecord | null> {
    if (!record) return null;
    const actionItems = await repo.listActionItemsForScenario(record.studentProfileId, record.careerScenarioId, executor);
    return {
      ...record,
      actionItems,
    };
  }

  async listScenarios(studentProfileId: string, actorUserId: string): Promise<CareerScenarioSummary[]> {
    await maybeCreateDefaultScenarioFromLegacyInputs(studentProfileId, actorUserId);
    return repo.listForStudent(studentProfileId);
  }

  async getScenario(studentProfileId: string, careerScenarioId: string, actorUserId: string): Promise<CareerScenarioRecord | null> {
    await maybeCreateDefaultScenarioFromLegacyInputs(studentProfileId, actorUserId);
    return this.hydrateScenario(await repo.getById(studentProfileId, careerScenarioId));
  }

  async getActiveScenarioForDashboard(studentProfileId: string, actorUserId: string): Promise<CareerScenarioRecord | null> {
    await maybeCreateDefaultScenarioFromLegacyInputs(studentProfileId, actorUserId);
    return this.hydrateScenario(await repo.getActiveForStudent(studentProfileId));
  }

  async createScenario(studentProfileId: string, input: CareerScenarioUpsertInput, actorUserId: string) {
    return withTransaction(async (tx) => {
      const existing = await repo.listForStudent(studentProfileId, tx);
      validateScenarioNameUniqueness(existing, input.scenarioName);
      if (input.isActive ?? true) {
        await repo.clearActive(studentProfileId, tx);
      }

      const normalized = await normalizeScenarioTarget(input);
      const extractedRequirements = extractJobDescriptionRequirements({
        jobDescriptionText: input.jobDescriptionText,
        targetRole: normalized.normalizedRoleFamily || input.targetRole,
        targetProfession: input.targetProfession,
        targetSector: normalized.normalizedSectorCluster || input.targetSector,
      });

      const scenarioId = newId();
      const nextStatus = input.status || "draft";
      await repo.create(
        {
          careerScenarioId: scenarioId,
          studentProfileId,
          scenarioName: input.scenarioName.trim(),
          status: nextStatus,
          isActive: input.isActive ?? true,
          jobDescriptionText: normalizeText(input.jobDescriptionText),
          targetRole: normalized.normalizedRoleFamily || normalizeText(input.targetRole),
          targetProfession: normalizeText(input.targetProfession),
          targetIndustry: normalizeText(input.targetIndustry),
          targetSector: normalized.normalizedSectorCluster || normalizeText(input.targetSector),
          targetGeography: normalizeText(input.targetGeography),
          employerName: normalizeText(input.employerName),
          jobPostingUrl: normalizeText(input.jobPostingUrl),
          notes: normalizeText(input.notes),
          assumptions: input.assumptions || {},
          extractedRequirements,
          sourceType:
            input.sourceType ||
            (input.jobDescriptionText ? "pasted_job_description" : "manual_target"),
          createdByUserId: actorUserId,
          updatedByUserId: actorUserId,
        },
        tx
      );

      return this.analyzeScenario(studentProfileId, scenarioId, actorUserId, tx);
    });
  }

  async updateScenario(studentProfileId: string, careerScenarioId: string, input: CareerScenarioUpsertInput, actorUserId: string) {
    return withTransaction(async (tx) => {
      const existing = await repo.getById(studentProfileId, careerScenarioId, tx);
      if (!existing) {
        throw new AppError({ status: 404, code: "career_scenario_not_found", message: "Career scenario not found." });
      }

      const summaries = await repo.listForStudent(studentProfileId, tx);
      validateScenarioNameUniqueness(summaries, input.scenarioName, careerScenarioId);

      const nextIsActive = input.isActive ?? existing.isActive;
      if (nextIsActive) {
        await repo.clearActive(studentProfileId, tx);
      }

      const normalized = await normalizeScenarioTarget(input);
      const extractedRequirements = extractJobDescriptionRequirements({
        jobDescriptionText: input.jobDescriptionText,
        targetRole: normalized.normalizedRoleFamily || input.targetRole,
        targetProfession: input.targetProfession,
        targetSector: normalized.normalizedSectorCluster || input.targetSector,
      });

      await repo.update(
        {
          careerScenarioId,
          studentProfileId,
          linkedJobTargetId: existing.linkedJobTargetId,
          scenarioName: input.scenarioName.trim(),
          status: "needs_rerun",
          isActive: nextIsActive,
          jobDescriptionText: normalizeText(input.jobDescriptionText),
          targetRole: normalized.normalizedRoleFamily || normalizeText(input.targetRole),
          targetProfession: normalizeText(input.targetProfession),
          targetIndustry: normalizeText(input.targetIndustry),
          targetSector: normalized.normalizedSectorCluster || normalizeText(input.targetSector),
          targetGeography: normalizeText(input.targetGeography),
          employerName: normalizeText(input.employerName),
          jobPostingUrl: normalizeText(input.jobPostingUrl),
          notes: normalizeText(input.notes),
          assumptions: input.assumptions || existing.assumptions || {},
          extractedRequirements,
          analysisResult: null,
          readinessScoreSnapshot: null,
          recommendationsSnapshot: null,
          sourceType:
            input.sourceType ||
            (input.jobDescriptionText ? "pasted_job_description" : existing.sourceType),
          updatedByUserId: actorUserId,
          lastRunAt: null,
        },
        tx
      );

      return this.analyzeScenario(studentProfileId, careerScenarioId, actorUserId, tx);
    });
  }

  async duplicateScenario(studentProfileId: string, careerScenarioId: string, newName: string, actorUserId: string) {
    const existing = await this.getScenario(studentProfileId, careerScenarioId, actorUserId);
    if (!existing) {
      throw new AppError({ status: 404, code: "career_scenario_not_found", message: "Career scenario not found." });
    }
    return this.createScenario(
      studentProfileId,
      {
        scenarioName: newName,
        isActive: true,
        jobDescriptionText: existing.jobDescriptionText,
        targetRole: existing.targetRole,
        targetProfession: existing.targetProfession,
        targetIndustry: existing.targetIndustry,
        targetSector: existing.targetSector,
        targetGeography: existing.targetGeography,
        employerName: existing.employerName,
        jobPostingUrl: existing.jobPostingUrl,
        notes: existing.notes,
        assumptions: existing.assumptions,
        sourceType: existing.sourceType,
      },
      actorUserId
    );
  }

  async deleteScenario(studentProfileId: string, careerScenarioId: string, actorUserId: string): Promise<void> {
    await withTransaction(async (tx) => {
      const scenario = await repo.getById(studentProfileId, careerScenarioId, tx);
      if (!scenario) {
        throw new AppError({ status: 404, code: "career_scenario_not_found", message: "Career scenario not found." });
      }
      await repo.replaceActionItemsForScenario(studentProfileId, careerScenarioId, [], tx);
      await repo.softDelete(studentProfileId, careerScenarioId, actorUserId, tx);
    });
  }

  async setActiveScenario(studentProfileId: string, careerScenarioId: string, actorUserId: string): Promise<CareerScenarioRecord | null> {
    await withTransaction(async (tx) => {
      const scenario = await repo.getById(studentProfileId, careerScenarioId, tx);
      if (!scenario) {
        throw new AppError({ status: 404, code: "career_scenario_not_found", message: "Career scenario not found." });
      }
      await repo.setActive(studentProfileId, careerScenarioId, actorUserId, tx);
    });
    return this.hydrateScenario(await repo.getById(studentProfileId, careerScenarioId));
  }

  async analyzeScenario(
    studentProfileId: string,
    careerScenarioId: string,
    actorUserId: string,
    executor?: Parameters<typeof repo.getById>[2]
  ): Promise<CareerScenarioRecord | null> {
    if (!executor) {
      return withTransaction((tx) => this.analyzeScenario(studentProfileId, careerScenarioId, actorUserId, tx));
    }

    const scenario = await repo.getById(studentProfileId, careerScenarioId, executor);
    if (!scenario) {
      throw new AppError({ status: 404, code: "career_scenario_not_found", message: "Career scenario not found." });
    }

    const profile = await studentReadRepo.getStudentProfile(studentProfileId);
    const assumptions = mergeScenarioAssumptions({
      scenario,
      fallbackPreferredGeographies: profile?.preferred_geographies || [],
    });
    const scoringInput = await buildStudentScoringInput(studentProfileId, {
      targetRoleFamily: scenario.targetRole || undefined,
      targetSectorCluster: scenario.targetSector || undefined,
      preferredGeographies: assumptions.preferredGeographies,
    });
    const scoring = runScoring(scoringInput);
    const extractedRequirements =
      scenario.extractedRequirements ||
      extractJobDescriptionRequirements({
        jobDescriptionText: scenario.jobDescriptionText,
        targetRole: scenario.targetRole,
        targetProfession: scenario.targetProfession,
        targetSector: scenario.targetSector,
      });
    const analysisResult = analyzeCareerScenario({
      scenario,
      extractedRequirements,
      scoringInput,
      scoring,
    });
    const actionItems = materializeCareerScenarioActionItems({
      scenario,
      drafts: buildCareerScenarioActionItemDrafts({
        scenario,
        analysisResult,
        scoring,
      }),
    });
    const nextStatus = buildScenarioStatusAfterAnalysis({ isActive: scenario.isActive });

    await repo.update(
      {
        careerScenarioId,
        studentProfileId,
        linkedJobTargetId: scenario.linkedJobTargetId,
        scenarioName: scenario.scenarioName,
        status: nextStatus,
        isActive: scenario.isActive,
        jobDescriptionText: scenario.jobDescriptionText,
        targetRole: scenario.targetRole,
        targetProfession: scenario.targetProfession,
        targetIndustry: scenario.targetIndustry,
        targetSector: scenario.targetSector,
        targetGeography: scenario.targetGeography,
        employerName: scenario.employerName,
        jobPostingUrl: scenario.jobPostingUrl,
        notes: scenario.notes,
        assumptions,
        extractedRequirements,
        analysisResult,
        readinessScoreSnapshot: scoring,
        recommendationsSnapshot: scoring.recommendations,
        sourceType: scenario.sourceType,
        updatedByUserId: actorUserId,
        lastRunAt: new Date().toISOString(),
      },
      executor
    );
    await repo.replaceActionItemsForScenario(studentProfileId, careerScenarioId, actionItems, executor);

    return this.hydrateScenario(await repo.getById(studentProfileId, careerScenarioId, executor), executor);
  }

  async markStudentScenariosNeedsRerun(studentProfileId: string): Promise<void> {
    await repo.markNeedsRerunForStudent(studentProfileId);
  }
}

export const careerScenarioService = new CareerScenarioService();

export function canEditCareerScenariosForRole(role: RequestContext["authenticatedRoleType"]): boolean {
  return role === "student" || role === "coach" || role === "admin";
}
