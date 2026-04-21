import {
  type AcademicCatalogInput,
  type CatalogCourseAliasInput,
  type CatalogCourseInput,
  type CoursePrerequisiteInput,
  type DegreeProgramInput,
  type InstitutionInput,
  type MajorInput,
  type RequirementGroupGraphNode,
  type RequirementGroupInput,
  type RequirementItemGraphNode,
  type RequirementItemInput,
  type RequirementSetGraph,
  type RequirementSetInput,
  type StudentCatalogAssignmentInput,
} from "../../../../../packages/shared/src/contracts/academic";
import { CatalogRepository } from "../../repositories/academic/catalogRepository";
import { stableId } from "../market/idFactory";

const repo = new CatalogRepository();

function normalizeKeyPart(value: string): string {
  return value.trim().toLowerCase();
}

export async function upsertInstitution(input: InstitutionInput) {
  const institutionId = stableId("institution", normalizeKeyPart(input.canonicalName));
  await repo.upsertInstitution({
    institutionId,
    canonicalName: input.canonicalName,
    displayName: input.displayName,
    countryCode: input.countryCode ?? null,
    stateRegion: input.stateRegion ?? null,
    city: input.city ?? null,
    websiteUrl: input.websiteUrl ?? null,
  });
  return institutionId;
}

export async function upsertAcademicCatalog(input: AcademicCatalogInput) {
  const institution = await repo.getInstitutionByCanonicalName(input.institutionCanonicalName);
  if (!institution) {
    throw new Error(`Institution not found: ${input.institutionCanonicalName}`);
  }

  const academicCatalogId = stableId(
    "academic_catalog",
    `${normalizeKeyPart(input.institutionCanonicalName)}:${normalizeKeyPart(input.catalogLabel)}`
  );

  await repo.upsertAcademicCatalog({
    academicCatalogId,
    institutionId: institution.institution_id,
    catalogLabel: input.catalogLabel,
    startYear: input.startYear,
    endYear: input.endYear,
    sourceUrl: input.sourceUrl ?? null,
    sourceFormat: input.sourceFormat ?? null,
    extractionStatus: input.extractionStatus ?? "draft",
  });

  return academicCatalogId;
}

export async function upsertDegreeProgram(input: DegreeProgramInput) {
  const institution = await repo.getInstitutionByCanonicalName(input.institutionCanonicalName);
  if (!institution) {
    throw new Error(`Institution not found: ${input.institutionCanonicalName}`);
  }

  const catalog = await repo.getAcademicCatalog(institution.institution_id, input.catalogLabel);
  if (!catalog) {
    throw new Error(`Academic catalog not found: ${input.catalogLabel}`);
  }

  const degreeProgramId = stableId(
    "degree_program",
    `${normalizeKeyPart(input.institutionCanonicalName)}:${normalizeKeyPart(input.catalogLabel)}:${normalizeKeyPart(input.degreeType)}:${normalizeKeyPart(input.programName)}`
  );

  await repo.upsertDegreeProgram({
    degreeProgramId,
    academicCatalogId: catalog.academic_catalog_id,
    degreeType: input.degreeType,
    programName: input.programName,
    schoolName: input.schoolName ?? null,
    totalCreditsRequired: input.totalCreditsRequired ?? null,
    residencyCreditsRequired: input.residencyCreditsRequired ?? null,
    minimumGpaRequired: input.minimumGpaRequired ?? null,
  });

  return degreeProgramId;
}

export async function upsertMajor(input: MajorInput) {
  const institution = await repo.getInstitutionByCanonicalName(input.institutionCanonicalName);
  if (!institution) {
    throw new Error(`Institution not found: ${input.institutionCanonicalName}`);
  }

  const catalog = await repo.getAcademicCatalog(institution.institution_id, input.catalogLabel);
  if (!catalog) {
    throw new Error(`Academic catalog not found: ${input.catalogLabel}`);
  }

  const degreeProgram = await repo.getDegreeProgram(
    catalog.academic_catalog_id,
    input.degreeType,
    input.programName
  );
  if (!degreeProgram) {
    throw new Error(`Degree program not found: ${input.degreeType} ${input.programName}`);
  }

  const majorId = stableId(
    "major",
    `${normalizeKeyPart(input.institutionCanonicalName)}:${normalizeKeyPart(input.catalogLabel)}:${normalizeKeyPart(input.degreeType)}:${normalizeKeyPart(input.programName)}:${normalizeKeyPart(input.canonicalName)}`
  );

  await repo.upsertMajor({
    majorId,
    degreeProgramId: degreeProgram.degree_program_id,
    canonicalName: input.canonicalName,
    displayName: input.displayName,
    cipCode: input.cipCode ?? null,
    departmentName: input.departmentName ?? null,
    isActive: true,
  });

  return majorId;
}

export async function upsertMinor(input: {
  institutionCanonicalName: string;
  catalogLabel: string;
  degreeType: string;
  programName: string;
  canonicalName: string;
  displayName: string;
  departmentName?: string;
}) {
  const institution = await repo.getInstitutionByCanonicalName(input.institutionCanonicalName);
  if (!institution) {
    throw new Error(`Institution not found: ${input.institutionCanonicalName}`);
  }

  const catalog = await repo.getAcademicCatalog(institution.institution_id, input.catalogLabel);
  if (!catalog) {
    throw new Error(`Academic catalog not found: ${input.catalogLabel}`);
  }

  const degreeProgram = await repo.getDegreeProgram(
    catalog.academic_catalog_id,
    input.degreeType,
    input.programName
  );
  if (!degreeProgram) {
    throw new Error(`Degree program not found: ${input.degreeType} ${input.programName}`);
  }

  const minorId = stableId(
    "minor",
    `${normalizeKeyPart(input.institutionCanonicalName)}:${normalizeKeyPart(input.catalogLabel)}:${normalizeKeyPart(input.degreeType)}:${normalizeKeyPart(input.programName)}:${normalizeKeyPart(input.canonicalName)}`
  );

  await repo.upsertMinor({
    minorId,
    degreeProgramId: degreeProgram.degree_program_id,
    canonicalName: input.canonicalName,
    displayName: input.displayName,
    departmentName: input.departmentName ?? null,
    isActive: true,
  });

  return minorId;
}

export async function assignStudentCatalog(input: StudentCatalogAssignmentInput) {
  const institution = await repo.getInstitutionByCanonicalName(input.institutionCanonicalName);
  if (!institution) {
    throw new Error(`Institution not found: ${input.institutionCanonicalName}`);
  }

  const catalog = await repo.getAcademicCatalog(institution.institution_id, input.catalogLabel);
  if (!catalog) {
    throw new Error(`Academic catalog not found: ${input.catalogLabel}`);
  }

  let degreeProgramId: string | null = null;
  let majorId: string | null = null;
  let minorId: string | null = null;
  let concentrationId: string | null = null;

  if (input.degreeType && input.programName) {
    const degreeProgram = await repo.getDegreeProgram(
      catalog.academic_catalog_id,
      input.degreeType,
      input.programName
    );
    if (!degreeProgram) {
      throw new Error(`Degree program not found: ${input.degreeType} ${input.programName}`);
    }
    degreeProgramId = degreeProgram.degree_program_id;

    if (input.majorCanonicalName) {
      const major = await repo.getMajor(degreeProgram.degree_program_id, input.majorCanonicalName);
      if (!major) {
        throw new Error(`Major not found: ${input.majorCanonicalName}`);
      }
      majorId = major.major_id;

      if (input.concentrationCanonicalName) {
        const concentration = await repo.getConcentration(major.major_id, input.concentrationCanonicalName);
        if (!concentration) {
          throw new Error(`Concentration not found: ${input.concentrationCanonicalName}`);
        }
        concentrationId = concentration.concentration_id;
      }
    }

    if (input.minorCanonicalName) {
      const minor = await repo.getMinor(degreeProgram.degree_program_id, input.minorCanonicalName);
      if (!minor) {
        throw new Error(`Minor not found: ${input.minorCanonicalName}`);
      }
      minorId = minor.minor_id;
    }
  }

  const existingPrimaryAssignment =
    input.isPrimary !== false
      ? await repo.getPrimaryStudentCatalogAssignment(input.studentProfileId)
      : null;

  const assignmentId =
    existingPrimaryAssignment?.student_catalog_assignment_id ||
    stableId(
      "student_catalog_assignment",
      `${input.studentProfileId}:${normalizeKeyPart(input.institutionCanonicalName)}:${normalizeKeyPart(input.catalogLabel)}:${input.isPrimary !== false ? "primary" : "secondary"}`
    );

  await repo.upsertStudentCatalogAssignment({
    studentCatalogAssignmentId: assignmentId,
    studentProfileId: input.studentProfileId,
    institutionId: institution.institution_id,
    academicCatalogId: catalog.academic_catalog_id,
    degreeProgramId,
    majorId,
    minorId,
    concentrationId,
    assignmentSource: input.assignmentSource,
    isPrimary: input.isPrimary ?? true,
  });

  return assignmentId;
}

export async function getPrimaryStudentCatalogAssignment(studentProfileId: string) {
  return repo.getPrimaryStudentCatalogAssignment(studentProfileId);
}

export async function getPrimaryStudentCatalogContext(studentProfileId: string) {
  return repo.getPrimaryStudentCatalogContext(studentProfileId);
}

export async function upsertCatalogCourse(input: CatalogCourseInput) {
  const institution = await repo.getInstitutionByCanonicalName(input.institutionCanonicalName);
  if (!institution) {
    throw new Error(`Institution not found: ${input.institutionCanonicalName}`);
  }

  const catalog = await repo.getAcademicCatalog(institution.institution_id, input.catalogLabel);
  if (!catalog) {
    throw new Error(`Academic catalog not found: ${input.catalogLabel}`);
  }

  const catalogCourseId = stableId(
    "catalog_course",
    `${normalizeKeyPart(input.institutionCanonicalName)}:${normalizeKeyPart(input.catalogLabel)}:${normalizeKeyPart(input.courseCode)}`
  );

  await repo.upsertCatalogCourse({
    catalogCourseId,
    academicCatalogId: catalog.academic_catalog_id,
    courseCode: input.courseCode,
    courseTitle: input.courseTitle,
    department: input.department ?? null,
    creditsMin: input.creditsMin ?? null,
    creditsMax: input.creditsMax ?? null,
    description: input.description ?? null,
    levelHint: input.levelHint ?? null,
  });

  return catalogCourseId;
}

export async function replaceCatalogCourseAliases(input: {
  institutionCanonicalName: string;
  catalogLabel: string;
  courseCode: string;
  aliases: CatalogCourseAliasInput[];
}) {
  const institution = await repo.getInstitutionByCanonicalName(input.institutionCanonicalName);
  if (!institution) {
    throw new Error(`Institution not found: ${input.institutionCanonicalName}`);
  }

  const catalog = await repo.getAcademicCatalog(institution.institution_id, input.catalogLabel);
  if (!catalog) {
    throw new Error(`Academic catalog not found: ${input.catalogLabel}`);
  }

  const course = await repo.getCatalogCourse(catalog.academic_catalog_id, input.courseCode);
  if (!course) {
    throw new Error(`Catalog course not found: ${input.courseCode}`);
  }

  await repo.replaceCatalogCourseAliases({
    catalogCourseId: course.catalog_course_id,
    aliases: input.aliases.map((alias, index) => ({
      catalogCourseAliasId: stableId(
        "catalog_course_alias",
        `${course.catalog_course_id}:${alias.aliasCode || alias.aliasTitle || index}:${alias.sourceType}`
      ),
      aliasCode: alias.aliasCode ?? null,
      aliasTitle: alias.aliasTitle ?? null,
      sourceType: alias.sourceType,
    })),
  });
}

export async function replaceCoursePrerequisites(input: {
  institutionCanonicalName: string;
  catalogLabel: string;
  courseCode: string;
  prerequisites: CoursePrerequisiteInput[];
}) {
  const institution = await repo.getInstitutionByCanonicalName(input.institutionCanonicalName);
  if (!institution) {
    throw new Error(`Institution not found: ${input.institutionCanonicalName}`);
  }

  const catalog = await repo.getAcademicCatalog(institution.institution_id, input.catalogLabel);
  if (!catalog) {
    throw new Error(`Academic catalog not found: ${input.catalogLabel}`);
  }

  const course = await repo.getCatalogCourse(catalog.academic_catalog_id, input.courseCode);
  if (!course) {
    throw new Error(`Catalog course not found: ${input.courseCode}`);
  }

  const prerequisiteCourses = await Promise.all(
    input.prerequisites.map(async (prerequisite) => {
      if (!prerequisite.prerequisiteCourseCode) {
        return null;
      }

      const prerequisiteCourse = await repo.getCatalogCourse(
        catalog.academic_catalog_id,
        prerequisite.prerequisiteCourseCode
      );
      if (!prerequisiteCourse) {
        throw new Error(`Prerequisite catalog course not found: ${prerequisite.prerequisiteCourseCode}`);
      }
      return prerequisiteCourse;
    })
  );

  await repo.replaceCoursePrerequisites({
    catalogCourseId: course.catalog_course_id,
    prerequisites: input.prerequisites.map((prerequisite, index) => ({
      coursePrerequisiteId: stableId(
        "course_prerequisite",
        `${course.catalog_course_id}:${prerequisite.prerequisiteCourseCode || prerequisite.prerequisiteCourseTitle || index}:${prerequisite.relationshipType}:${prerequisite.logicGroup || "default"}`
      ),
      prerequisiteCourseId: prerequisiteCourses[index]?.catalog_course_id ?? null,
      logicGroup: prerequisite.logicGroup ?? null,
      relationshipType: prerequisite.relationshipType,
    })),
  });
}

export async function upsertRequirementSet(input: RequirementSetInput) {
  const institution = await repo.getInstitutionByCanonicalName(input.institutionCanonicalName);
  if (!institution) {
    throw new Error(`Institution not found: ${input.institutionCanonicalName}`);
  }

  const catalog = await repo.getAcademicCatalog(institution.institution_id, input.catalogLabel);
  if (!catalog) {
    throw new Error(`Academic catalog not found: ${input.catalogLabel}`);
  }

  const degreeProgram = await repo.getDegreeProgram(
    catalog.academic_catalog_id,
    input.degreeType,
    input.programName
  );
  if (!degreeProgram) {
    throw new Error(`Degree program not found: ${input.degreeType} ${input.programName}`);
  }

  let majorId: string | null = null;
  if (input.majorCanonicalName) {
    const major = await repo.getMajor(degreeProgram.degree_program_id, input.majorCanonicalName);
    if (!major) {
      throw new Error(`Major not found: ${input.majorCanonicalName}`);
    }
    majorId = major.major_id;
  }

  let minorId: string | null = null;
  if (input.minorCanonicalName) {
    const minor = await repo.getMinor(degreeProgram.degree_program_id, input.minorCanonicalName);
    if (!minor) {
      throw new Error(`Minor not found: ${input.minorCanonicalName}`);
    }
    minorId = minor.minor_id;
  }

  const requirementSetId = stableId(
    "requirement_set",
    `${degreeProgram.degree_program_id}:${input.setType}:${normalizeKeyPart(input.majorCanonicalName || input.minorCanonicalName || input.displayName)}`
  );

  await repo.upsertRequirementSet({
    requirementSetId,
    majorId,
    minorId,
    concentrationId: null,
    setType: input.setType,
    displayName: input.displayName,
    totalCreditsRequired: input.totalCreditsRequired ?? null,
    provenanceMethod: input.provenanceMethod ?? null,
    sourceUrl: input.sourceUrl ?? null,
    sourceNote: input.sourceNote ?? null,
  });

  return requirementSetId;
}

export async function replaceRequirementGroups(input: {
  requirementSetId: string;
  groups: Array<RequirementGroupInput & { items: RequirementItemInput[] }>;
}) {
  await repo.replaceRequirementGroups({
    requirementSetId: input.requirementSetId,
    groups: input.groups.map((group, index) => ({
      requirementGroupId: stableId(
        "requirement_group",
        `${input.requirementSetId}:${group.groupName}:${group.displayOrder ?? index}`
      ),
      groupName: group.groupName,
      groupType: group.groupType,
      minCoursesRequired: group.minCoursesRequired ?? null,
      minCreditsRequired: group.minCreditsRequired ?? null,
      displayOrder: group.displayOrder ?? index,
      notes: group.notes ?? null,
    })),
  });

  for (let groupIndex = 0; groupIndex < input.groups.length; groupIndex++) {
    const group = input.groups[groupIndex];
    const requirementGroupId = stableId(
      "requirement_group",
      `${input.requirementSetId}:${group.groupName}:${group.displayOrder ?? groupIndex}`
    );

    await repo.replaceRequirementItems({
      requirementGroupId,
      items: group.items.map((item, itemIndex) => ({
        requirementItemId: stableId(
          "requirement_item",
          `${requirementGroupId}:${item.courseCode || item.itemLabel || item.itemType}:${item.displayOrder ?? itemIndex}`
        ),
        catalogCourseId: null,
        itemLabel: item.itemLabel ?? null,
        itemType: item.itemType,
        coursePrefix: item.coursePrefix ?? null,
        minLevel: item.minLevel ?? null,
        creditsIfUsed: item.creditsIfUsed ?? null,
        displayOrder: item.displayOrder ?? itemIndex,
      })),
    });
  }
}

export async function replaceResolvedRequirementGroups(input: {
  institutionCanonicalName: string;
  catalogLabel: string;
  requirementSetId: string;
  groups: Array<RequirementGroupInput & { items: RequirementItemInput[] }>;
}) {
  const institution = await repo.getInstitutionByCanonicalName(input.institutionCanonicalName);
  if (!institution) {
    throw new Error(`Institution not found: ${input.institutionCanonicalName}`);
  }

  const catalog = await repo.getAcademicCatalog(institution.institution_id, input.catalogLabel);
  if (!catalog) {
    throw new Error(`Academic catalog not found: ${input.catalogLabel}`);
  }

  await repo.replaceRequirementGroups({
    requirementSetId: input.requirementSetId,
    groups: input.groups.map((group, index) => ({
      requirementGroupId: stableId(
        "requirement_group",
        `${input.requirementSetId}:${group.groupName}:${group.displayOrder ?? index}`
      ),
      groupName: group.groupName,
      groupType: group.groupType,
      minCoursesRequired: group.minCoursesRequired ?? null,
      minCreditsRequired: group.minCreditsRequired ?? null,
      displayOrder: group.displayOrder ?? index,
      notes: group.notes ?? null,
    })),
  });

  for (let groupIndex = 0; groupIndex < input.groups.length; groupIndex++) {
    const group = input.groups[groupIndex];
    const requirementGroupId = stableId(
      "requirement_group",
      `${input.requirementSetId}:${group.groupName}:${group.displayOrder ?? groupIndex}`
    );

    const resolvedItems = await Promise.all(
      group.items.map(async (item) => {
        if (!item.courseCode) {
          return null;
        }
        const course = await repo.getCatalogCourse(catalog.academic_catalog_id, item.courseCode);
        if (!course) {
          throw new Error(`Catalog course not found for requirement item: ${item.courseCode}`);
        }
        return course;
      })
    );

    await repo.replaceRequirementItems({
      requirementGroupId,
      items: group.items.map((item, itemIndex) => ({
        requirementItemId: stableId(
          "requirement_item",
          `${requirementGroupId}:${item.courseCode || item.itemLabel || item.itemType}:${item.displayOrder ?? itemIndex}`
        ),
        catalogCourseId: resolvedItems[itemIndex]?.catalog_course_id ?? null,
        itemLabel: item.itemLabel ?? null,
        itemType: item.itemType,
        coursePrefix: item.coursePrefix ?? null,
        minLevel: item.minLevel ?? null,
        creditsIfUsed: item.creditsIfUsed ?? null,
        displayOrder: item.displayOrder ?? itemIndex,
      })),
    });
  }
}

export async function getRequirementSetGraphByMajor(input: {
  institutionCanonicalName: string;
  catalogLabel: string;
  degreeType: string;
  programName: string;
  majorCanonicalName: string;
  setType?: RequirementSetInput["setType"];
}): Promise<RequirementSetGraph | null> {
  const institution = await repo.getInstitutionByCanonicalName(input.institutionCanonicalName);
  if (!institution) {
    throw new Error(`Institution not found: ${input.institutionCanonicalName}`);
  }

  const catalog = await repo.getAcademicCatalog(institution.institution_id, input.catalogLabel);
  if (!catalog) {
    throw new Error(`Academic catalog not found: ${input.catalogLabel}`);
  }

  const degreeProgram = await repo.getDegreeProgram(
    catalog.academic_catalog_id,
    input.degreeType,
    input.programName
  );
  if (!degreeProgram) {
    throw new Error(`Degree program not found: ${input.degreeType} ${input.programName}`);
  }

  const major = await repo.getMajor(degreeProgram.degree_program_id, input.majorCanonicalName);
  if (!major) {
    throw new Error(`Major not found: ${input.majorCanonicalName}`);
  }

  const requirementSet = await repo.getRequirementSetByMajor(major.major_id, input.setType ?? "major");
  if (!requirementSet) {
    return null;
  }

  const groups = await repo.listRequirementGroups(requirementSet.requirement_set_id);
  const groupGraph: RequirementGroupGraphNode[] = [];

  for (const group of groups) {
    const items = await repo.listRequirementItems(group.requirement_group_id);
    const itemGraph: RequirementItemGraphNode[] = items.map((item) => ({
      requirementItemId: item.requirement_item_id,
      itemLabel: item.item_label,
      itemType: item.item_type,
      catalogCourseId: item.catalog_course_id,
      coursePrefix: item.course_prefix,
      minLevel: item.min_level,
      creditsIfUsed: item.credits_if_used,
      displayOrder: item.display_order,
      courseCode: null,
    }));

    groupGraph.push({
      requirementGroupId: group.requirement_group_id,
      groupName: group.group_name,
      groupType: group.group_type,
      minCoursesRequired: group.min_courses_required,
      minCreditsRequired: group.min_credits_required,
      displayOrder: group.display_order,
      notes: group.notes,
      items: itemGraph,
    });
  }

  return {
    requirementSetId: requirementSet.requirement_set_id,
    setType: requirementSet.set_type,
    displayName: requirementSet.display_name,
    totalCreditsRequired: requirementSet.total_credits_required,
    provenanceMethod: requirementSet.provenance_method,
    sourceUrl: requirementSet.source_url,
    sourceNote: requirementSet.source_note,
    groups: groupGraph,
  };
}

export async function getPrimaryRequirementSetGraphForStudent(studentProfileId: string) {
  const context = await repo.getPrimaryStudentCatalogContext(studentProfileId);
  if (!context?.degree_type || !context.program_name || !context.major_canonical_name) {
    return null;
  }

  return getRequirementSetGraphByMajor({
    institutionCanonicalName: context.institution_canonical_name,
    catalogLabel: context.catalog_label,
    degreeType: context.degree_type,
    programName: context.program_name,
    majorCanonicalName: context.major_canonical_name,
    setType: "major",
  });
}
