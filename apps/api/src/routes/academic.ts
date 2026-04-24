import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { resolveRequestContext } from "../services/auth/resolveRequestContext";
import { badRequest, forbidden, json, unauthorized } from "../utils/http";
import {
  assignStudentCatalog,
  getPrimaryRequirementSetGraphForStudent,
  getPrimaryStudentCatalogContext,
  replaceCatalogCourseAliases,
  replaceCoursePrerequisites,
  replaceResolvedRequirementGroups,
  upsertAcademicCatalog,
  upsertCatalogCourse,
  upsertDegreeProgram,
  upsertInstitution,
  upsertMajor,
  upsertRequirementSet,
} from "../services/academic/catalogService";
import { extractStructuredTranscript } from "../services/academic/transcriptExtraction";
import {
  discoverInstitutionCatalog,
  discoverProgramRequirements,
} from "../services/academic/catalogDiscoveryService";
import {
  buildCurriculumReviewPayload,
  canCoachReviewCurriculum,
  canVerifyCurriculum,
  linkCurriculumPdfUpload,
  saveCoachCurriculumReview,
  saveCurriculumPopulationRequest,
  saveCurriculumVerification,
} from "../services/academic/curriculumReview";
import { resolveCoachRelationshipOrThrow } from "../services/coach/workspace";
import { extractCatalogRequirementsFromArtifact } from "../services/academic/catalogArtifactExtractionService";
import {
  autoMatchTranscriptToPrimaryCatalog,
  getLatestStudentTranscriptGraphForStudent,
  persistStudentTranscriptGraph,
} from "../services/academic/transcriptService";
import { ArtifactRepository } from "../repositories/student/artifactRepository";
import { downloadArtifactFromStorage } from "../services/storage/artifactDownload";
import { extractDocumentText } from "../services/academic/documentExtraction";
import { readJsonBody } from "../utils/body";

const artifactRepo = new ArtifactRepository();

const studentCatalogAssignmentBodySchema = z.object({
  institutionCanonicalName: z.string().trim().min(1),
  catalogLabel: z.string().trim().min(1),
  degreeType: z.string().trim().min(1),
  programName: z.string().trim().min(1),
  majorCanonicalName: z.string().trim().min(1),
  minorCanonicalName: z.string().trim().min(1).optional(),
  concentrationCanonicalName: z.string().trim().min(1).optional(),
  assignmentSource: z
    .enum(["student_selected", "transcript_inferred", "advisor_confirmed", "system_inferred"])
    .optional(),
  isPrimary: z.boolean().optional(),
});

const transcriptExtractionBodySchema = z.object({
  transcriptText: z.string().trim().min(1).max(200000),
  academicArtifactId: z.string().trim().optional(),
  institutionCanonicalName: z.string().trim().optional(),
  transcriptSummary: z.string().trim().max(2000).optional(),
});

const transcriptExtractionFromArtifactBodySchema = z.object({
  academicArtifactId: z.string().trim().min(1),
  institutionCanonicalName: z.string().trim().optional(),
  transcriptSummary: z.string().trim().max(2000).optional(),
});

const catalogExtractionFromArtifactBodySchema = z.object({
  academicArtifactId: z.string().trim().min(1),
  institutionCanonicalName: z.string().trim().min(1),
  catalogLabel: z.string().trim().min(1).optional(),
  degreeType: z.string().trim().min(1).optional(),
  programName: z.string().trim().min(1).optional(),
  programKind: z.enum(["major", "minor"]),
  programCanonicalName: z.string().trim().min(1).optional(),
  programDisplayName: z.string().trim().min(1).optional(),
});

const catalogIngestionBodySchema = z.object({
  institution: z.object({
    canonicalName: z.string().trim().min(1),
    displayName: z.string().trim().min(1),
    countryCode: z.string().trim().max(8).optional(),
    stateRegion: z.string().trim().max(128).optional(),
    city: z.string().trim().max(128).optional(),
    websiteUrl: z.string().trim().url().optional(),
  }),
  catalog: z.object({
    catalogLabel: z.string().trim().min(1),
    startYear: z.number().int().min(1900).max(3000),
    endYear: z.number().int().min(1900).max(3000),
    sourceUrl: z.string().trim().url().optional(),
    sourceFormat: z.enum(["html", "pdf", "api", "manual"]).optional(),
    extractionStatus: z.enum(["draft", "parsed", "reviewed", "published", "deprecated"]).optional(),
  }),
  degreeProgram: z.object({
    degreeType: z.string().trim().min(1),
    programName: z.string().trim().min(1),
    schoolName: z.string().trim().optional(),
    totalCreditsRequired: z.number().nonnegative().optional(),
    residencyCreditsRequired: z.number().nonnegative().optional(),
    minimumGpaRequired: z.number().nonnegative().optional(),
  }),
  major: z.object({
    canonicalName: z.string().trim().min(1),
    displayName: z.string().trim().min(1),
    cipCode: z.string().trim().optional(),
    departmentName: z.string().trim().optional(),
  }),
  courses: z.array(
    z.object({
      courseCode: z.string().trim().min(1),
      courseTitle: z.string().trim().min(1),
      department: z.string().trim().optional(),
      creditsMin: z.number().nonnegative().optional(),
      creditsMax: z.number().nonnegative().optional(),
      description: z.string().trim().optional(),
      levelHint: z.enum(["introductory", "intermediate", "advanced", "graduate", "mixed"]).optional(),
      aliases: z
        .array(
          z.object({
            aliasCode: z.string().trim().optional(),
            aliasTitle: z.string().trim().optional(),
            sourceType: z.enum(["catalog", "transfer-guide", "manual", "transcript-observed"]),
          })
        )
        .optional(),
      prerequisites: z
        .array(
          z.object({
            prerequisiteCourseCode: z.string().trim().optional(),
            prerequisiteCourseTitle: z.string().trim().optional(),
            logicGroup: z.string().trim().optional(),
            relationshipType: z.enum(["prerequisite", "corequisite", "recommended"]),
          })
        )
        .optional(),
    })
  ).superRefine((courses, ctx) => {
    for (let index = 0; index < courses.length; index += 1) {
      const course = courses[index];
      if (
        course.creditsMin != null &&
        course.creditsMax != null &&
        course.creditsMax < course.creditsMin
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "creditsMax"],
          message: "creditsMax must be greater than or equal to creditsMin",
        });
      }
    }
  }),
  requirements: z.object({
    displayName: z.string().trim().min(1),
    totalCreditsRequired: z.number().nonnegative().optional(),
    groups: z.array(
      z.object({
        groupName: z.string().trim().min(1),
        groupType: z.enum(["all_of", "choose_n", "credits_bucket", "one_of", "capstone", "gpa_rule"]),
        minCoursesRequired: z.number().int().nonnegative().optional(),
        minCreditsRequired: z.number().nonnegative().optional(),
        displayOrder: z.number().int().nonnegative().optional(),
        notes: z.string().trim().optional(),
        items: z.array(
          z.object({
            itemLabel: z.string().trim().optional(),
            itemType: z.enum(["course", "course_pattern", "free_elective", "department_elective", "manual_rule"]),
            courseCode: z.string().trim().optional(),
            coursePrefix: z.string().trim().optional(),
            minLevel: z.number().int().nonnegative().optional(),
            creditsIfUsed: z.number().nonnegative().optional(),
            displayOrder: z.number().int().nonnegative().optional(),
          })
        ).min(1),
      })
    ).min(1),
  }),
}).superRefine((body, ctx) => {
  if (body.catalog.endYear < body.catalog.startYear) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["catalog", "endYear"],
      message: "endYear must be greater than or equal to startYear",
    });
  }
});

const catalogDiscoveryBodySchema = z.object({
  institutionCanonicalName: z.string().trim().min(1),
});

const programRequirementDiscoveryBodySchema = z.object({
  institutionCanonicalName: z.string().trim().min(1),
  catalogLabel: z.string().trim().min(1),
  degreeType: z.string().trim().min(1),
  programName: z.string().trim().min(1),
  majorCanonicalName: z.string().trim().min(1).optional(),
  minorCanonicalName: z.string().trim().min(1).optional(),
}).refine((body) => !!body.majorCanonicalName || !!body.minorCanonicalName, {
  message: "At least one of majorCanonicalName or minorCanonicalName is required",
  path: ["majorCanonicalName"],
});

const curriculumVerificationBodySchema = z.object({
  confirmReviewed: z.literal(true),
  verificationNotes: z.string().trim().max(1200).optional(),
});

const curriculumUploadLinkBodySchema = z.object({
  academicArtifactId: z.string().trim().min(1),
});

function formatZodErrorMessage(error: z.ZodError): string {
  return (
    error.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`).join("; ") ||
    "Invalid request body"
  );
}

async function resolveAcademicStudentScope(req: IncomingMessage) {
  const ctx = await resolveRequestContext(req);
  if (!ctx.studentProfileId) {
    return { ctx, studentProfileId: null as string | null };
  }

  if (ctx.authenticatedRoleType !== "coach") {
    return { ctx, studentProfileId: ctx.studentProfileId };
  }

  const requestedStudentProfileId = new URL(req.url || "/", "http://localhost").searchParams.get("studentProfileId");
  const relationship = await resolveCoachRelationshipOrThrow(ctx, requestedStudentProfileId);
  if (requestedStudentProfileId && !relationship) {
    return { ctx, studentProfileId: null as string | null };
  }
  return {
    ctx,
    studentProfileId: relationship?.studentProfileId || ctx.studentProfileId,
  };
}

export async function studentCatalogAssignmentRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    let raw: unknown;
    try {
      raw = await readJsonBody(req);
    } catch {
      return badRequest(res, "Invalid JSON body");
    }

    const parsed = studentCatalogAssignmentBodySchema.safeParse(raw);
    if (!parsed.success) {
      return badRequest(res, formatZodErrorMessage(parsed.error));
    }

    const ctx = await resolveRequestContext(req);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated user");
    }

    const assignmentId = await assignStudentCatalog({
      studentProfileId: ctx.studentProfileId,
      institutionCanonicalName: parsed.data.institutionCanonicalName,
      catalogLabel: parsed.data.catalogLabel,
      degreeType: parsed.data.degreeType,
      programName: parsed.data.programName,
      majorCanonicalName: parsed.data.majorCanonicalName,
      minorCanonicalName: parsed.data.minorCanonicalName,
      concentrationCanonicalName: parsed.data.concentrationCanonicalName,
      assignmentSource: parsed.data.assignmentSource ?? "student_selected",
      isPrimary: parsed.data.isPrimary ?? true,
    });

    return json(res, 200, {
      ok: true,
      studentCatalogAssignmentId: assignmentId,
      message: "Student catalog assignment saved",
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    if (typeof error?.message === "string" && error.message.includes("not found")) {
      return badRequest(res, error.message);
    }
    throw error;
  }
}

export async function latestTranscriptGraphRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await resolveRequestContext(req);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated user");
    }

    const transcriptGraph = await getLatestStudentTranscriptGraphForStudent(ctx.studentProfileId);

    return json(res, 200, {
      ok: true,
      transcriptGraph,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    throw error;
  }
}

export async function catalogDiscoveryRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    let raw: unknown;
    try {
      raw = await readJsonBody(req);
    } catch {
      return badRequest(res, "Invalid JSON body");
    }

    const parsed = catalogDiscoveryBodySchema.safeParse(raw);
    if (!parsed.success) {
      return badRequest(res, formatZodErrorMessage(parsed.error));
    }

    const ctx = await resolveRequestContext(req);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated user");
    }

    const result = await discoverInstitutionCatalog({
      institutionCanonicalName: parsed.data.institutionCanonicalName,
    });

    return json(res, 200, {
      ok: true,
      ...result,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    if (typeof error?.message === "string" && error.message.includes("not found")) {
      return badRequest(res, error.message);
    }
    throw error;
  }
}

export async function programRequirementDiscoveryRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    let raw: unknown;
    try {
      raw = await readJsonBody(req);
    } catch {
      return badRequest(res, "Invalid JSON body");
    }

    const parsed = programRequirementDiscoveryBodySchema.safeParse(raw);
    if (!parsed.success) {
      return badRequest(res, formatZodErrorMessage(parsed.error));
    }

    const ctx = await resolveRequestContext(req);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated user");
    }

    const result = await discoverProgramRequirements({
      institutionCanonicalName: parsed.data.institutionCanonicalName,
      catalogLabel: parsed.data.catalogLabel,
      degreeType: parsed.data.degreeType,
      programName: parsed.data.programName,
      majorCanonicalName: parsed.data.majorCanonicalName,
      minorCanonicalName: parsed.data.minorCanonicalName,
    });

    return json(res, 200, {
      ok: true,
      ...result,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    if (typeof error?.message === "string" && error.message.includes("not found")) {
      return badRequest(res, error.message);
    }
    throw error;
  }
}

export async function primaryRequirementGraphRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await resolveRequestContext(req);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated user");
    }

    const requirementGraph = await getPrimaryRequirementSetGraphForStudent(ctx.studentProfileId);

    return json(res, 200, {
      ok: true,
      requirementGraph,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    throw error;
  }
}

export async function curriculumReviewRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const { ctx, studentProfileId } = await resolveAcademicStudentScope(req);
    if (!studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated user");
    }

    const curriculum = await buildCurriculumReviewPayload(
      studentProfileId,
      ctx.authenticatedRoleType
    );

    return json(res, 200, {
      ok: true,
      curriculum,
      resolvedContext: ctx,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    throw error;
  }
}

export async function curriculumVerifyRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    let raw: unknown;
    try {
      raw = await readJsonBody(req);
    } catch {
      return badRequest(res, "Invalid JSON body");
    }

    const parsed = curriculumVerificationBodySchema.safeParse(raw);
    if (!parsed.success) {
      return badRequest(res, formatZodErrorMessage(parsed.error));
    }

    const { ctx, studentProfileId } = await resolveAcademicStudentScope(req);
    if (!studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated user");
    }
    if (!canVerifyCurriculum(ctx.authenticatedRoleType)) {
      return forbidden(res, "This role cannot verify curriculum for scoring");
    }

    const curriculum = await buildCurriculumReviewPayload(
      studentProfileId,
      ctx.authenticatedRoleType
    );
    if (curriculum.verification.effectiveStatus === "missing") {
      return badRequest(res, "Curriculum information must exist before it can be visually verified");
    }

    const verifiedAt = await saveCurriculumVerification({
      studentProfileId,
      userId: ctx.authenticatedUserId,
      status: "verified",
      verificationNotes: parsed.data.verificationNotes,
      curriculumSource: curriculum.summary.sourceProvenance,
    });

    return json(res, 200, {
      ok: true,
      verifiedAt,
      message: "Curriculum review saved",
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    throw error;
  }
}

export async function curriculumRequestPopulationRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const { ctx, studentProfileId } = await resolveAcademicStudentScope(req);
    if (!studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated user");
    }

    const assignment = await getPrimaryStudentCatalogContext(studentProfileId);
    const requestedAt = await saveCurriculumPopulationRequest({
      studentProfileId,
      userId: ctx.authenticatedUserId,
      curriculumSource: "unknown",
      status: assignment ? "present_unverified" : "missing",
    });

    if (
      !assignment?.institution_canonical_name ||
      !assignment.catalog_label ||
      !assignment.degree_type ||
      !assignment.program_name ||
      (!assignment.major_canonical_name && !assignment.minor_canonical_name)
    ) {
      return json(res, 200, {
        ok: true,
        requestedAt,
        populated: false,
        message:
          "Curriculum population has been requested, but the academic path is still incomplete. Save the school, catalog, program, and major first or upload a degree-requirement PDF.",
      });
    }

    const result = await discoverProgramRequirements({
      institutionCanonicalName: assignment.institution_canonical_name,
      catalogLabel: assignment.catalog_label,
      degreeType: assignment.degree_type,
      programName: assignment.program_name,
      majorCanonicalName: assignment.major_canonical_name || undefined,
      minorCanonicalName: assignment.minor_canonical_name || undefined,
    });

    return json(res, 200, {
      ok: true,
      requestedAt,
      populated: result.status === "requirements_discovered",
      result,
      message:
        result.status === "requirements_discovered"
          ? "Curriculum discovery ran successfully. Review the requirement details before using them for scoring."
          : "Curriculum population has been requested, but a degree-requirement PDF is still recommended.",
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    if (typeof error?.message === "string" && error.message.includes("not found")) {
      return badRequest(res, error.message);
    }
    throw error;
  }
}

export async function curriculumLinkUploadRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    let raw: unknown;
    try {
      raw = await readJsonBody(req);
    } catch {
      return badRequest(res, "Invalid JSON body");
    }

    const parsed = curriculumUploadLinkBodySchema.safeParse(raw);
    if (!parsed.success) {
      return badRequest(res, formatZodErrorMessage(parsed.error));
    }

    const { ctx, studentProfileId } = await resolveAcademicStudentScope(req);
    if (!studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated user");
    }

    const artifact = await artifactRepo.getAcademicArtifactById(parsed.data.academicArtifactId);
    if (!artifact || artifact.student_profile_id !== studentProfileId) {
      return badRequest(res, "Academic artifact not found for the authenticated student");
    }

    await linkCurriculumPdfUpload({
      studentProfileId,
      academicArtifactId: artifact.academic_artifact_id,
      curriculumSource: "artifact_pdf",
    });

    return json(res, 200, {
      ok: true,
      message: "Curriculum PDF linked to this student record",
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    throw error;
  }
}

export async function curriculumCoachReviewRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const { ctx, studentProfileId } = await resolveAcademicStudentScope(req);
    if (!studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated user");
    }
    if (!canCoachReviewCurriculum(ctx.authenticatedRoleType)) {
      return forbidden(res, "This role cannot save a coach curriculum review");
    }

    const curriculum = await buildCurriculumReviewPayload(
      studentProfileId,
      ctx.authenticatedRoleType
    );
    if (curriculum.verification.effectiveStatus === "missing") {
      return badRequest(res, "Curriculum information must exist before a coach review can be saved");
    }

    const reviewedAt = await saveCoachCurriculumReview({
      studentProfileId,
      userId: ctx.authenticatedUserId,
      curriculumSource: curriculum.summary.sourceProvenance,
    });

    return json(res, 200, {
      ok: true,
      reviewedAt,
      message: "Coach curriculum review saved",
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    throw error;
  }
}

export async function transcriptExtractRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    let raw: unknown;
    try {
      raw = await readJsonBody(req);
    } catch {
      return badRequest(res, "Invalid JSON body");
    }

    const parsed = transcriptExtractionBodySchema.safeParse(raw);
    if (!parsed.success) {
      return badRequest(res, formatZodErrorMessage(parsed.error));
    }

    const ctx = await resolveRequestContext(req);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated user");
    }

    const extracted = extractStructuredTranscript({
      studentProfileId: ctx.studentProfileId,
      transcriptText: parsed.data.transcriptText,
      academicArtifactId: parsed.data.academicArtifactId,
      institutionCanonicalName: parsed.data.institutionCanonicalName,
      transcriptSummary: parsed.data.transcriptSummary,
    });

    const studentTranscriptId = await persistStudentTranscriptGraph(extracted);
    const matching = await autoMatchTranscriptToPrimaryCatalog(ctx.studentProfileId, studentTranscriptId);
    const transcriptGraph = await getLatestStudentTranscriptGraphForStudent(ctx.studentProfileId);

    return json(res, 200, {
      ok: true,
      studentTranscriptId,
      extractedTerms: extracted.terms.length,
      extractedCourses: extracted.terms.reduce((sum, term) => sum + term.courses.length, 0),
      matching,
      transcriptGraph,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    if (error?.message === "TRANSCRIPT_EXTRACTION_EMPTY") {
      return badRequest(res, "No transcript courses could be extracted from the provided text");
    }
    throw error;
  }
}

export async function catalogIngestionRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    let raw: unknown;
    try {
      raw = await readJsonBody(req);
    } catch {
      return badRequest(res, "Invalid JSON body");
    }

    const parsed = catalogIngestionBodySchema.safeParse(raw);
    if (!parsed.success) {
      return badRequest(res, formatZodErrorMessage(parsed.error));
    }

    const ctx = await resolveRequestContext(req);
    if (ctx.authenticatedRoleType !== "admin" && ctx.authenticatedRoleType !== "coach") {
      return forbidden(res, "Admin or coach role required");
    }

    const institutionCanonicalName = parsed.data.institution.canonicalName;
    const catalogLabel = parsed.data.catalog.catalogLabel;
    const degreeType = parsed.data.degreeProgram.degreeType;
    const programName = parsed.data.degreeProgram.programName;
    const majorCanonicalName = parsed.data.major.canonicalName;

    const institutionId = await upsertInstitution(parsed.data.institution);
    const academicCatalogId = await upsertAcademicCatalog({
      institutionCanonicalName,
      ...parsed.data.catalog,
    });
    const degreeProgramId = await upsertDegreeProgram({
      institutionCanonicalName,
      catalogLabel,
      ...parsed.data.degreeProgram,
    });
    const majorId = await upsertMajor({
      institutionCanonicalName,
      catalogLabel,
      degreeType,
      programName,
      ...parsed.data.major,
    });

    const ingestedCourseIds: string[] = [];
    for (const course of parsed.data.courses) {
      const catalogCourseId = await upsertCatalogCourse({
        institutionCanonicalName,
        catalogLabel,
        courseCode: course.courseCode,
        courseTitle: course.courseTitle,
        department: course.department,
        creditsMin: course.creditsMin,
        creditsMax: course.creditsMax,
        description: course.description,
        levelHint: course.levelHint,
      });
      ingestedCourseIds.push(catalogCourseId);

      if (course.aliases?.length) {
        await replaceCatalogCourseAliases({
          institutionCanonicalName,
          catalogLabel,
          courseCode: course.courseCode,
          aliases: course.aliases,
        });
      }

      if (course.prerequisites?.length) {
        await replaceCoursePrerequisites({
          institutionCanonicalName,
          catalogLabel,
          courseCode: course.courseCode,
          prerequisites: course.prerequisites,
        });
      }
    }

    const requirementSetId = await upsertRequirementSet({
      institutionCanonicalName,
      catalogLabel,
      degreeType,
      programName,
      majorCanonicalName,
      setType: "major",
      displayName: parsed.data.requirements.displayName,
      totalCreditsRequired: parsed.data.requirements.totalCreditsRequired,
      provenanceMethod: "manual",
      sourceUrl: parsed.data.catalog.sourceUrl,
      sourceNote: "Admin or coach catalog ingestion",
    });

    await replaceResolvedRequirementGroups({
      institutionCanonicalName,
      catalogLabel,
      requirementSetId,
      groups: parsed.data.requirements.groups,
    });

    return json(res, 200, {
      ok: true,
      institutionId,
      academicCatalogId,
      degreeProgramId,
      majorId,
      requirementSetId,
      ingestedCourseCount: ingestedCourseIds.length,
      ingestedRequirementGroupCount: parsed.data.requirements.groups.length,
      message: "Academic catalog ingested",
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    if (typeof error?.message === "string" && error.message.includes("not found")) {
      return badRequest(res, error.message);
    }
    throw error;
  }
}

export async function transcriptExtractFromArtifactRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    let raw: unknown;
    try {
      raw = await readJsonBody(req);
    } catch {
      return badRequest(res, "Invalid JSON body");
    }

    const parsed = transcriptExtractionFromArtifactBodySchema.safeParse(raw);
    if (!parsed.success) {
      return badRequest(res, formatZodErrorMessage(parsed.error));
    }

    const ctx = await resolveRequestContext(req);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated user");
    }

    const artifact = await artifactRepo.getAcademicArtifactById(parsed.data.academicArtifactId);
    if (!artifact || artifact.student_profile_id !== ctx.studentProfileId) {
      return badRequest(res, "Academic artifact not found for the authenticated student");
    }

    const downloadedArtifact = await downloadArtifactFromStorage({
      objectPath: artifact.file_uri,
    });
    const extractedDocument = extractDocumentText({
      buffer: downloadedArtifact.buffer,
      fileName: downloadedArtifact.fileName,
      contentType: downloadedArtifact.contentType,
    });

    if (!extractedDocument.text.trim()) {
      return badRequest(res, "No readable text could be extracted from the stored artifact");
    }

    const extracted = extractStructuredTranscript({
      studentProfileId: ctx.studentProfileId,
      academicArtifactId: artifact.academic_artifact_id,
      institutionCanonicalName: parsed.data.institutionCanonicalName,
      transcriptSummary:
        parsed.data.transcriptSummary ||
        `Extracted from uploaded artifact using ${extractedDocument.method}.`,
      transcriptText: extractedDocument.text,
    });

    const studentTranscriptId = await persistStudentTranscriptGraph(extracted);
    const matching = await autoMatchTranscriptToPrimaryCatalog(ctx.studentProfileId, studentTranscriptId);
    const transcriptGraph = await getLatestStudentTranscriptGraphForStudent(ctx.studentProfileId);

    return json(res, 200, {
      ok: true,
      studentTranscriptId,
      extractionMethod: extractedDocument.method,
      extractedTerms: extracted.terms.length,
      extractedCourses: extracted.terms.reduce((sum, term) => sum + term.courses.length, 0),
      matching,
      transcriptGraph,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    if (error?.message === "TRANSCRIPT_EXTRACTION_EMPTY") {
      return badRequest(res, "No transcript courses could be extracted from the stored artifact");
    }
    throw error;
  }
}

export async function catalogExtractFromArtifactRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    let raw: unknown;
    try {
      raw = await readJsonBody(req);
    } catch {
      return badRequest(res, "Invalid JSON body");
    }

    const parsed = catalogExtractionFromArtifactBodySchema.safeParse(raw);
    if (!parsed.success) {
      return badRequest(res, formatZodErrorMessage(parsed.error));
    }

    const ctx = await resolveRequestContext(req);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated user");
    }

    const artifact = await artifactRepo.getAcademicArtifactById(parsed.data.academicArtifactId);
    if (!artifact || artifact.student_profile_id !== ctx.studentProfileId) {
      return badRequest(res, "Academic artifact not found for the authenticated student");
    }

    const downloadedArtifact = await downloadArtifactFromStorage({
      objectPath: artifact.file_uri,
    });
    const extractedDocument = extractDocumentText({
      buffer: downloadedArtifact.buffer,
      fileName: downloadedArtifact.fileName,
      contentType: downloadedArtifact.contentType,
    });

    if (!extractedDocument.text.trim()) {
      return badRequest(res, "No readable text could be extracted from the stored artifact");
    }

    const extracted = await extractCatalogRequirementsFromArtifact({
      artifactText: extractedDocument.text,
      institutionCanonicalName: parsed.data.institutionCanonicalName,
      catalogLabel: parsed.data.catalogLabel,
      degreeType: parsed.data.degreeType,
      programName: parsed.data.programName,
      programKind: parsed.data.programKind,
      programCanonicalName: parsed.data.programCanonicalName,
      programDisplayName: parsed.data.programDisplayName,
      academicArtifactId: artifact.academic_artifact_id,
    });

    await artifactRepo.markArtifactParsed({
      artifactId: artifact.academic_artifact_id,
      extractedSummary: `Catalog PDF extracted via ${extractedDocument.method}. ${extracted.extractedCourseCount} courses parsed for ${extracted.programDisplayName}.`,
      parseTruthStatus: "inferred",
      parseConfidenceLabel: extracted.extractedCourseCount >= 6 ? "high" : "medium",
      extractionMethod: extractedDocument.method,
      parseNotes:
        extracted.extractedCourseCount >= 6
          ? "Course rows were extracted from the uploaded catalog artifact and converted into structured requirements."
          : "Only a limited number of course rows were extracted from the uploaded catalog artifact; manual review is still advisable.",
    });

    return json(res, 200, {
      ok: true,
      extractionMethod: extractedDocument.method,
      ...extracted,
      message: "Catalog requirements extracted from uploaded PDF artifact",
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") {
      return unauthorized(res);
    }
    if (error?.message === "CATALOG_ARTIFACT_EXTRACTION_EMPTY") {
      return badRequest(res, "Not enough recognizable course rows were found in the uploaded PDF");
    }
    if (error?.message === "CATALOG_PROGRAM_NAME_UNRESOLVED") {
      return badRequest(res, "The program name could not be resolved from the uploaded PDF");
    }
    if (typeof error?.message === "string" && error.message.includes("not found")) {
      return badRequest(res, error.message);
    }
    throw error;
  }
}
