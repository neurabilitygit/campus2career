import { query } from "../../db/client";

export interface InstitutionRow {
  institution_id: string;
  canonical_name: string;
  display_name: string;
  country_code: string | null;
  state_region: string | null;
  city: string | null;
  website_url: string | null;
}

export interface AcademicCatalogRow {
  academic_catalog_id: string;
  institution_id: string;
  catalog_label: string;
  start_year: number;
  end_year: number;
  source_url: string | null;
  source_format: "html" | "pdf" | "api" | "manual" | null;
  extraction_status: "draft" | "parsed" | "reviewed" | "published" | "deprecated";
}

export interface DegreeProgramRow {
  degree_program_id: string;
  academic_catalog_id: string;
  degree_type: string;
  program_name: string;
  school_name: string | null;
  total_credits_required: number | null;
  residency_credits_required: number | null;
  minimum_gpa_required: number | null;
}

export interface MajorRow {
  major_id: string;
  degree_program_id: string;
  canonical_name: string;
  display_name: string;
  cip_code: string | null;
  department_name: string | null;
  is_active: boolean;
}

export interface MinorRow {
  minor_id: string;
  degree_program_id: string;
  canonical_name: string;
  display_name: string;
  department_name: string | null;
  is_active: boolean;
}

export interface ConcentrationRow {
  concentration_id: string;
  major_id: string;
  canonical_name: string;
  display_name: string;
}

export interface StudentCatalogAssignmentRow {
  student_catalog_assignment_id: string;
  student_profile_id: string;
  institution_id: string;
  academic_catalog_id: string;
  degree_program_id: string | null;
  major_id: string | null;
  minor_id: string | null;
  concentration_id: string | null;
  assignment_source: "student_selected" | "transcript_inferred" | "advisor_confirmed" | "system_inferred";
  is_primary: boolean;
}

export interface StudentCatalogContextRow {
  student_catalog_assignment_id: string;
  student_profile_id: string;
  institution_id: string;
  institution_canonical_name: string;
  institution_display_name: string;
  academic_catalog_id: string;
  catalog_label: string;
  degree_program_id: string | null;
  degree_type: string | null;
  program_name: string | null;
  major_id: string | null;
  major_canonical_name: string | null;
  major_display_name: string | null;
  minor_id: string | null;
  minor_canonical_name: string | null;
  minor_display_name: string | null;
  concentration_id: string | null;
  concentration_canonical_name: string | null;
  concentration_display_name: string | null;
  assignment_source: "student_selected" | "transcript_inferred" | "advisor_confirmed" | "system_inferred";
  is_primary: boolean;
}

export interface CatalogCourseRow {
  catalog_course_id: string;
  academic_catalog_id: string;
  course_code: string;
  course_title: string;
  department: string | null;
  credits_min: number | null;
  credits_max: number | null;
  description: string | null;
  level_hint: "introductory" | "intermediate" | "advanced" | "graduate" | "mixed" | null;
}

export interface RequirementSetRow {
  requirement_set_id: string;
  major_id: string | null;
  minor_id: string | null;
  concentration_id: string | null;
  set_type: "major" | "minor" | "concentration" | "degree_core" | "general_education";
  display_name: string;
  total_credits_required: number | null;
}

export interface RequirementGroupRow {
  requirement_group_id: string;
  requirement_set_id: string;
  group_name: string;
  group_type: "all_of" | "choose_n" | "credits_bucket" | "one_of" | "capstone" | "gpa_rule";
  min_courses_required: number | null;
  min_credits_required: number | null;
  display_order: number | null;
  notes: string | null;
}

export interface RequirementItemRow {
  requirement_item_id: string;
  requirement_group_id: string;
  catalog_course_id: string | null;
  item_label: string | null;
  item_type: "course" | "course_pattern" | "free_elective" | "department_elective" | "manual_rule";
  course_prefix: string | null;
  min_level: number | null;
  credits_if_used: number | null;
  display_order: number | null;
}

export class CatalogRepository {
  async searchInstitutions(input: { query?: string; limit?: number }): Promise<InstitutionRow[]> {
    const normalizedQuery = input.query?.trim() || "";
    const limit = Math.max(1, Math.min(input.limit || 20, 50));

    const result = await query<InstitutionRow>(
      `
      select *
      from institutions
      where
        $1 = ''
        or lower(display_name) like lower('%' || $1 || '%')
        or lower(canonical_name) like lower('%' || $1 || '%')
        or lower(coalesce(city, '')) like lower('%' || $1 || '%')
        or lower(coalesce(state_region, '')) like lower('%' || $1 || '%')
      order by
        case
          when lower(display_name) = lower($1) then 0
          when lower(display_name) like lower($1 || '%') then 1
          when lower(display_name) like lower('%' || $1 || '%') then 2
          else 3
        end,
        display_name asc
      limit $2
      `,
      [normalizedQuery, limit]
    );

    return result.rows;
  }

  async upsertInstitution(input: {
    institutionId: string;
    canonicalName: string;
    displayName: string;
    countryCode?: string | null;
    stateRegion?: string | null;
    city?: string | null;
    websiteUrl?: string | null;
  }): Promise<void> {
    await query(
      `
      insert into institutions (
        institution_id,
        canonical_name,
        display_name,
        country_code,
        state_region,
        city,
        website_url
      ) values ($1,$2,$3,$4,$5,$6,$7)
      on conflict (canonical_name) do update set
        display_name = excluded.display_name,
        country_code = excluded.country_code,
        state_region = excluded.state_region,
        city = excluded.city,
        website_url = excluded.website_url
      `,
      [
        input.institutionId,
        input.canonicalName,
        input.displayName,
        input.countryCode ?? null,
        input.stateRegion ?? null,
        input.city ?? null,
        input.websiteUrl ?? null,
      ]
    );
  }

  async getInstitutionByCanonicalName(canonicalName: string): Promise<InstitutionRow | null> {
    const result = await query<InstitutionRow>(
      `select * from institutions where canonical_name = $1 limit 1`,
      [canonicalName]
    );
    return result.rows[0] || null;
  }

  async findInstitutionByName(name: string): Promise<InstitutionRow | null> {
    const result = await query<InstitutionRow>(
      `
      select *
      from institutions
      where lower(canonical_name) = lower($1)
         or lower(display_name) = lower($1)
      limit 1
      `,
      [name]
    );
    return result.rows[0] || null;
  }

  async upsertAcademicCatalog(input: {
    academicCatalogId: string;
    institutionId: string;
    catalogLabel: string;
    startYear: number;
    endYear: number;
    sourceUrl?: string | null;
    sourceFormat?: "html" | "pdf" | "api" | "manual" | null;
    extractionStatus?: "draft" | "parsed" | "reviewed" | "published" | "deprecated";
  }): Promise<void> {
    await query(
      `
      insert into academic_catalogs (
        academic_catalog_id,
        institution_id,
        catalog_label,
        start_year,
        end_year,
        source_url,
        source_format,
        extraction_status
      ) values ($1,$2,$3,$4,$5,$6,$7,$8)
      on conflict (institution_id, catalog_label) do update set
        start_year = excluded.start_year,
        end_year = excluded.end_year,
        source_url = excluded.source_url,
        source_format = excluded.source_format,
        extraction_status = excluded.extraction_status
      `,
      [
        input.academicCatalogId,
        input.institutionId,
        input.catalogLabel,
        input.startYear,
        input.endYear,
        input.sourceUrl ?? null,
        input.sourceFormat ?? null,
        input.extractionStatus ?? "draft",
      ]
    );
  }

  async getAcademicCatalog(institutionId: string, catalogLabel: string): Promise<AcademicCatalogRow | null> {
    const result = await query<AcademicCatalogRow>(
      `
      select *
      from academic_catalogs
      where institution_id = $1 and catalog_label = $2
      limit 1
      `,
      [institutionId, catalogLabel]
    );
    return result.rows[0] || null;
  }

  async listAcademicCatalogsForInstitution(institutionId: string): Promise<AcademicCatalogRow[]> {
    const result = await query<AcademicCatalogRow>(
      `
      select *
      from academic_catalogs
      where institution_id = $1
      order by end_year desc, start_year desc, catalog_label desc
      `,
      [institutionId]
    );
    return result.rows;
  }

  async upsertDegreeProgram(input: {
    degreeProgramId: string;
    academicCatalogId: string;
    degreeType: string;
    programName: string;
    schoolName?: string | null;
    totalCreditsRequired?: number | null;
    residencyCreditsRequired?: number | null;
    minimumGpaRequired?: number | null;
  }): Promise<void> {
    await query(
      `
      insert into degree_programs (
        degree_program_id,
        academic_catalog_id,
        degree_type,
        program_name,
        school_name,
        total_credits_required,
        residency_credits_required,
        minimum_gpa_required
      ) values ($1,$2,$3,$4,$5,$6,$7,$8)
      on conflict (academic_catalog_id, degree_type, program_name) do update set
        school_name = excluded.school_name,
        total_credits_required = excluded.total_credits_required,
        residency_credits_required = excluded.residency_credits_required,
        minimum_gpa_required = excluded.minimum_gpa_required
      `,
      [
        input.degreeProgramId,
        input.academicCatalogId,
        input.degreeType,
        input.programName,
        input.schoolName ?? null,
        input.totalCreditsRequired ?? null,
        input.residencyCreditsRequired ?? null,
        input.minimumGpaRequired ?? null,
      ]
    );
  }

  async getDegreeProgram(academicCatalogId: string, degreeType: string, programName: string): Promise<DegreeProgramRow | null> {
    const result = await query<DegreeProgramRow>(
      `
      select *
      from degree_programs
      where academic_catalog_id = $1
        and degree_type = $2
        and program_name = $3
      limit 1
      `,
      [academicCatalogId, degreeType, programName]
    );
    return result.rows[0] || null;
  }

  async listDegreeProgramsForCatalog(academicCatalogId: string): Promise<DegreeProgramRow[]> {
    const result = await query<DegreeProgramRow>(
      `
      select *
      from degree_programs
      where academic_catalog_id = $1
      order by degree_type asc, program_name asc
      `,
      [academicCatalogId]
    );
    return result.rows;
  }

  async upsertMajor(input: {
    majorId: string;
    degreeProgramId: string;
    canonicalName: string;
    displayName: string;
    cipCode?: string | null;
    departmentName?: string | null;
    isActive?: boolean;
  }): Promise<void> {
    await query(
      `
      insert into majors (
        major_id,
        degree_program_id,
        canonical_name,
        display_name,
        cip_code,
        department_name,
        is_active
      ) values ($1,$2,$3,$4,$5,$6,$7)
      on conflict (degree_program_id, canonical_name) do update set
        display_name = excluded.display_name,
        cip_code = excluded.cip_code,
        department_name = excluded.department_name,
        is_active = excluded.is_active
      `,
      [
        input.majorId,
        input.degreeProgramId,
        input.canonicalName,
        input.displayName,
        input.cipCode ?? null,
        input.departmentName ?? null,
        input.isActive ?? true,
      ]
    );
  }

  async getMajor(degreeProgramId: string, canonicalName: string): Promise<MajorRow | null> {
    const result = await query<MajorRow>(
      `
      select *
      from majors
      where degree_program_id = $1 and canonical_name = $2
      limit 1
      `,
      [degreeProgramId, canonicalName]
    );
    return result.rows[0] || null;
  }

  async listMajorsForDegreeProgram(degreeProgramId: string): Promise<MajorRow[]> {
    const result = await query<MajorRow>(
      `
      select *
      from majors
      where degree_program_id = $1
      order by display_name asc
      `,
      [degreeProgramId]
    );
    return result.rows;
  }

  async getMinor(degreeProgramId: string, canonicalName: string): Promise<MinorRow | null> {
    const result = await query<MinorRow>(
      `
      select *
      from minors
      where degree_program_id = $1 and canonical_name = $2
      limit 1
      `,
      [degreeProgramId, canonicalName]
    );
    return result.rows[0] || null;
  }

  async upsertMinor(input: {
    minorId: string;
    degreeProgramId: string;
    canonicalName: string;
    displayName: string;
    departmentName?: string | null;
    isActive?: boolean;
  }): Promise<void> {
    await query(
      `
      insert into minors (
        minor_id,
        degree_program_id,
        canonical_name,
        display_name,
        department_name,
        is_active
      ) values ($1,$2,$3,$4,$5,$6)
      on conflict (degree_program_id, canonical_name) do update set
        display_name = excluded.display_name,
        department_name = excluded.department_name,
        is_active = excluded.is_active
      `,
      [
        input.minorId,
        input.degreeProgramId,
        input.canonicalName,
        input.displayName,
        input.departmentName ?? null,
        input.isActive ?? true,
      ]
    );
  }

  async listMinorsForDegreeProgram(degreeProgramId: string): Promise<MinorRow[]> {
    const result = await query<MinorRow>(
      `
      select *
      from minors
      where degree_program_id = $1
      order by display_name asc
      `,
      [degreeProgramId]
    );
    return result.rows;
  }

  async getConcentration(majorId: string, canonicalName: string): Promise<ConcentrationRow | null> {
    const result = await query<ConcentrationRow>(
      `
      select *
      from concentrations
      where major_id = $1 and canonical_name = $2
      limit 1
      `,
      [majorId, canonicalName]
    );
    return result.rows[0] || null;
  }

  async listConcentrationsForMajor(majorId: string): Promise<ConcentrationRow[]> {
    const result = await query<ConcentrationRow>(
      `
      select *
      from concentrations
      where major_id = $1
      order by display_name asc
      `,
      [majorId]
    );
    return result.rows;
  }

  async upsertCatalogCourse(input: {
    catalogCourseId: string;
    academicCatalogId: string;
    courseCode: string;
    courseTitle: string;
    department?: string | null;
    creditsMin?: number | null;
    creditsMax?: number | null;
    description?: string | null;
    levelHint?: "introductory" | "intermediate" | "advanced" | "graduate" | "mixed" | null;
  }): Promise<void> {
    await query(
      `
      insert into catalog_courses (
        catalog_course_id,
        academic_catalog_id,
        course_code,
        course_title,
        department,
        credits_min,
        credits_max,
        description,
        level_hint
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      on conflict (academic_catalog_id, course_code) do update set
        course_title = excluded.course_title,
        department = excluded.department,
        credits_min = excluded.credits_min,
        credits_max = excluded.credits_max,
        description = excluded.description,
        level_hint = excluded.level_hint
      `,
      [
        input.catalogCourseId,
        input.academicCatalogId,
        input.courseCode,
        input.courseTitle,
        input.department ?? null,
        input.creditsMin ?? null,
        input.creditsMax ?? null,
        input.description ?? null,
        input.levelHint ?? null,
      ]
    );
  }

  async getCatalogCourse(academicCatalogId: string, courseCode: string): Promise<CatalogCourseRow | null> {
    const result = await query<CatalogCourseRow>(
      `
      select *
      from catalog_courses
      where academic_catalog_id = $1
        and course_code = $2
      limit 1
      `,
      [academicCatalogId, courseCode]
    );
    return result.rows[0] || null;
  }

  async listCatalogCourses(academicCatalogId: string): Promise<CatalogCourseRow[]> {
    const result = await query<CatalogCourseRow>(
      `
      select *
      from catalog_courses
      where academic_catalog_id = $1
      order by course_code asc
      `,
      [academicCatalogId]
    );
    return result.rows;
  }

  async replaceCatalogCourseAliases(input: {
    catalogCourseId: string;
    aliases: Array<{
      catalogCourseAliasId: string;
      aliasCode?: string | null;
      aliasTitle?: string | null;
      sourceType: "catalog" | "transfer-guide" | "manual" | "transcript-observed";
    }>;
  }): Promise<void> {
    await query(`delete from catalog_course_aliases where catalog_course_id = $1`, [input.catalogCourseId]);

    for (const alias of input.aliases) {
      await query(
        `
        insert into catalog_course_aliases (
          catalog_course_alias_id,
          catalog_course_id,
          alias_code,
          alias_title,
          source_type
        ) values ($1,$2,$3,$4,$5)
        `,
        [
          alias.catalogCourseAliasId,
          input.catalogCourseId,
          alias.aliasCode ?? null,
          alias.aliasTitle ?? null,
          alias.sourceType,
        ]
      );
    }
  }

  async replaceCoursePrerequisites(input: {
    catalogCourseId: string;
    prerequisites: Array<{
      coursePrerequisiteId: string;
      prerequisiteCourseId?: string | null;
      logicGroup?: string | null;
      relationshipType: "prerequisite" | "corequisite" | "recommended";
    }>;
  }): Promise<void> {
    await query(`delete from course_prerequisites where catalog_course_id = $1`, [input.catalogCourseId]);

    for (const prerequisite of input.prerequisites) {
      await query(
        `
        insert into course_prerequisites (
          course_prerequisite_id,
          catalog_course_id,
          prerequisite_course_id,
          logic_group,
          relationship_type
        ) values ($1,$2,$3,$4,$5)
        `,
        [
          prerequisite.coursePrerequisiteId,
          input.catalogCourseId,
          prerequisite.prerequisiteCourseId ?? null,
          prerequisite.logicGroup ?? null,
          prerequisite.relationshipType,
        ]
      );
    }
  }

  async upsertRequirementSet(input: {
    requirementSetId: string;
    majorId?: string | null;
    minorId?: string | null;
    concentrationId?: string | null;
    setType: "major" | "minor" | "concentration" | "degree_core" | "general_education";
    displayName: string;
    totalCreditsRequired?: number | null;
  }): Promise<void> {
    await query(
      `
      insert into requirement_sets (
        requirement_set_id,
        major_id,
        minor_id,
        concentration_id,
        set_type,
        display_name,
        total_credits_required
      ) values ($1,$2,$3,$4,$5,$6,$7)
      on conflict (requirement_set_id) do update set
        major_id = excluded.major_id,
        minor_id = excluded.minor_id,
        concentration_id = excluded.concentration_id,
        set_type = excluded.set_type,
        display_name = excluded.display_name,
        total_credits_required = excluded.total_credits_required
      `,
      [
        input.requirementSetId,
        input.majorId ?? null,
        input.minorId ?? null,
        input.concentrationId ?? null,
        input.setType,
        input.displayName,
        input.totalCreditsRequired ?? null,
      ]
    );
  }

  async getRequirementSetByMajor(majorId: string, setType: RequirementSetRow["set_type"]): Promise<RequirementSetRow | null> {
    const result = await query<RequirementSetRow>(
      `
      select *
      from requirement_sets
      where major_id = $1 and set_type = $2
      limit 1
      `,
      [majorId, setType]
    );
    return result.rows[0] || null;
  }

  async replaceRequirementGroups(input: {
    requirementSetId: string;
    groups: Array<{
      requirementGroupId: string;
      groupName: string;
      groupType: "all_of" | "choose_n" | "credits_bucket" | "one_of" | "capstone" | "gpa_rule";
      minCoursesRequired?: number | null;
      minCreditsRequired?: number | null;
      displayOrder?: number | null;
      notes?: string | null;
    }>;
  }): Promise<void> {
    await query(`delete from requirement_groups where requirement_set_id = $1`, [input.requirementSetId]);

    for (const group of input.groups) {
      await query(
        `
        insert into requirement_groups (
          requirement_group_id,
          requirement_set_id,
          group_name,
          group_type,
          min_courses_required,
          min_credits_required,
          display_order,
          notes
        ) values ($1,$2,$3,$4,$5,$6,$7,$8)
        `,
        [
          group.requirementGroupId,
          input.requirementSetId,
          group.groupName,
          group.groupType,
          group.minCoursesRequired ?? null,
          group.minCreditsRequired ?? null,
          group.displayOrder ?? null,
          group.notes ?? null,
        ]
      );
    }
  }

  async replaceRequirementItems(input: {
    requirementGroupId: string;
    items: Array<{
      requirementItemId: string;
      catalogCourseId?: string | null;
      itemLabel?: string | null;
      itemType: "course" | "course_pattern" | "free_elective" | "department_elective" | "manual_rule";
      coursePrefix?: string | null;
      minLevel?: number | null;
      creditsIfUsed?: number | null;
      displayOrder?: number | null;
    }>;
  }): Promise<void> {
    await query(`delete from requirement_items where requirement_group_id = $1`, [input.requirementGroupId]);

    for (const item of input.items) {
      await query(
        `
        insert into requirement_items (
          requirement_item_id,
          requirement_group_id,
          catalog_course_id,
          item_label,
          item_type,
          course_prefix,
          min_level,
          credits_if_used,
          display_order
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `,
        [
          item.requirementItemId,
          input.requirementGroupId,
          item.catalogCourseId ?? null,
          item.itemLabel ?? null,
          item.itemType,
          item.coursePrefix ?? null,
          item.minLevel ?? null,
          item.creditsIfUsed ?? null,
          item.displayOrder ?? null,
        ]
      );
    }
  }

  async listRequirementGroups(requirementSetId: string): Promise<RequirementGroupRow[]> {
    const result = await query<RequirementGroupRow>(
      `
      select *
      from requirement_groups
      where requirement_set_id = $1
      order by display_order asc nulls last, group_name asc
      `,
      [requirementSetId]
    );
    return result.rows;
  }

  async listRequirementItems(requirementGroupId: string): Promise<RequirementItemRow[]> {
    const result = await query<RequirementItemRow>(
      `
      select *
      from requirement_items
      where requirement_group_id = $1
      order by display_order asc nulls last, item_label asc nulls last
      `,
      [requirementGroupId]
    );
    return result.rows;
  }

  async upsertStudentCatalogAssignment(input: {
    studentCatalogAssignmentId: string;
    studentProfileId: string;
    institutionId: string;
    academicCatalogId: string;
    degreeProgramId?: string | null;
    majorId?: string | null;
    minorId?: string | null;
    concentrationId?: string | null;
    assignmentSource: "student_selected" | "transcript_inferred" | "advisor_confirmed" | "system_inferred";
    isPrimary?: boolean;
  }): Promise<void> {
    await query(
      `
      insert into student_catalog_assignments (
        student_catalog_assignment_id,
        student_profile_id,
        institution_id,
        academic_catalog_id,
        degree_program_id,
        major_id,
        minor_id,
        concentration_id,
        assignment_source,
        is_primary,
        created_at,
        updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),now())
      on conflict (student_catalog_assignment_id) do update set
        institution_id = excluded.institution_id,
        academic_catalog_id = excluded.academic_catalog_id,
        degree_program_id = excluded.degree_program_id,
        major_id = excluded.major_id,
        minor_id = excluded.minor_id,
        concentration_id = excluded.concentration_id,
        assignment_source = excluded.assignment_source,
        is_primary = excluded.is_primary,
        updated_at = now()
      `,
      [
        input.studentCatalogAssignmentId,
        input.studentProfileId,
        input.institutionId,
        input.academicCatalogId,
        input.degreeProgramId ?? null,
        input.majorId ?? null,
        input.minorId ?? null,
        input.concentrationId ?? null,
        input.assignmentSource,
        input.isPrimary ?? true,
      ]
    );
  }

  async getPrimaryStudentCatalogAssignment(studentProfileId: string): Promise<StudentCatalogAssignmentRow | null> {
    const result = await query<StudentCatalogAssignmentRow>(
      `
      select *
      from student_catalog_assignments
      where student_profile_id = $1 and is_primary = true
      limit 1
      `,
      [studentProfileId]
    );
    return result.rows[0] || null;
  }

  async getPrimaryStudentCatalogContext(studentProfileId: string): Promise<StudentCatalogContextRow | null> {
    const result = await query<StudentCatalogContextRow>(
      `
      select
        sca.student_catalog_assignment_id,
        sca.student_profile_id,
        sca.institution_id,
        i.canonical_name as institution_canonical_name,
        i.display_name as institution_display_name,
        sca.academic_catalog_id,
        ac.catalog_label,
        sca.degree_program_id,
        dp.degree_type,
        dp.program_name,
        sca.major_id,
        m.canonical_name as major_canonical_name,
        m.display_name as major_display_name,
        sca.minor_id,
        mi.canonical_name as minor_canonical_name,
        mi.display_name as minor_display_name,
        sca.concentration_id,
        c.canonical_name as concentration_canonical_name,
        c.display_name as concentration_display_name,
        sca.assignment_source,
        sca.is_primary
      from student_catalog_assignments sca
      join institutions i on i.institution_id = sca.institution_id
      join academic_catalogs ac on ac.academic_catalog_id = sca.academic_catalog_id
      left join degree_programs dp on dp.degree_program_id = sca.degree_program_id
      left join majors m on m.major_id = sca.major_id
      left join minors mi on mi.minor_id = sca.minor_id
      left join concentrations c on c.concentration_id = sca.concentration_id
      where sca.student_profile_id = $1
        and sca.is_primary = true
      limit 1
      `,
      [studentProfileId]
    );
    return result.rows[0] || null;
  }
}
