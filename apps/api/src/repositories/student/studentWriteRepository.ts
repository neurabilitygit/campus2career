import { executeQuery, query, type DbExecutor } from "../../db/client";

export interface UpsertStudentProfileInput {
  studentProfileId: string;
  userId: string;
  householdId?: string | null;
  schoolName?: string | null;
  expectedGraduationDate?: string | null;
  majorPrimary?: string | null;
  majorSecondary?: string | null;
  preferredGeographies?: string[] | null;
  careerGoalSummary?: string | null;
  academicNotes?: string | null;
}

export interface CreateDeadlineInput {
  deadlineId: string;
  studentProfileId: string;
  title: string;
  dueDate: string;
  deadlineType: string;
  notes?: string | null;
}

export interface CreateContactInput {
  contactId: string;
  studentProfileId: string;
  contactName: string;
  relationshipType?: string | null;
  warmthLevel?: "cold" | "warm" | "strong" | null;
  notes?: string | null;
}

export interface CreateExperienceInput {
  experienceId: string;
  studentProfileId: string;
  title: string;
  organization?: string | null;
  description?: string | null;
  deliverablesSummary?: string | null;
  toolsUsed?: string[] | null;
  relevanceRating?: number | null;
}

export interface EnsureAcademicTermInput {
  academicTermId: string;
  studentProfileId: string;
  termName: string;
}

export interface CreateCourseInput {
  courseId: string;
  academicTermId: string;
  courseTitle: string;
  courseCode?: string | null;
  finalGrade?: string | null;
  notes?: string | null;
}

export interface CreateCourseSkillCoverageInput {
  courseSkillCoverageId: string;
  courseId: string;
  skillName: string;
  coverageStrength: "low" | "medium" | "high";
  confidenceScore: number;
  derivedFrom: "syllabus_parse" | "course_catalog" | "manual_tagging" | "coach_review";
}

export interface CreateInsightInput {
  insightId: string;
  studentProfileId: string;
  insightCategory:
    | "motivation"
    | "blocker"
    | "strength"
    | "communication_style"
    | "work_preference"
    | "risk_pattern"
    | "value_system"
    | "developmental_pattern"
    | "unresolved_tension";
  insightStatement: string;
  parentSafeSummary?: string | null;
}

export class StudentWriteRepository {
  async upsertStudentProfile(input: UpsertStudentProfileInput, executor?: DbExecutor): Promise<void> {
    await executeQuery(
      executor,
      `
      insert into student_profiles (
        student_profile_id,
        user_id,
        household_id,
        school_name,
        expected_graduation_date,
        major_primary,
        major_secondary,
        preferred_geographies,
        career_goal_summary,
        academic_notes,
        created_at,
        updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),now())
      on conflict (student_profile_id) do update set
        household_id = excluded.household_id,
        school_name = excluded.school_name,
        expected_graduation_date = excluded.expected_graduation_date,
        major_primary = excluded.major_primary,
        major_secondary = excluded.major_secondary,
        preferred_geographies = excluded.preferred_geographies,
        career_goal_summary = excluded.career_goal_summary,
        academic_notes = excluded.academic_notes,
        updated_at = now()
      `,
      [
        input.studentProfileId,
        input.userId,
        input.householdId ?? null,
        input.schoolName ?? null,
        input.expectedGraduationDate ?? null,
        input.majorPrimary ?? null,
        input.majorSecondary ?? null,
        input.preferredGeographies ?? [],
        input.careerGoalSummary ?? null,
        input.academicNotes ?? null,
      ]
    );
  }

  async createDeadline(input: CreateDeadlineInput): Promise<void> {
    await query(
      `
      insert into deadlines (
        deadline_id,
        student_profile_id,
        title,
        due_date,
        deadline_type,
        notes,
        completed,
        created_at,
        updated_at
      ) values ($1,$2,$3,$4,$5,$6,false,now(),now())
      `,
      [
        input.deadlineId,
        input.studentProfileId,
        input.title,
        input.dueDate,
        input.deadlineType,
        input.notes ?? null,
      ]
    );
  }

  async createContact(input: CreateContactInput): Promise<void> {
    const normalizedContactName = input.contactName.trim();

    await query(
      `
      insert into contacts (
        contact_id,
        student_profile_id,
        contact_name,
        relationship_type,
        warmth_level,
        notes,
        updated_at
      ) values ($1,$2,$3,$4,$5,$6,now())
      on conflict (student_profile_id, contact_name) do update set
        relationship_type = excluded.relationship_type,
        warmth_level = excluded.warmth_level,
        notes = excluded.notes,
        updated_at = now()
      `,
      [
        input.contactId,
        input.studentProfileId,
        normalizedContactName,
        input.relationshipType ?? null,
        input.warmthLevel ?? null,
        input.notes ?? null,
      ]
    );
  }

  async createExperience(input: CreateExperienceInput): Promise<void> {
    await query(
      `
      insert into experiences (
        experience_id,
        student_profile_id,
        experience_type,
        title,
        organization,
        paid_status,
        description,
        deliverables_summary,
        tools_used,
        reference_available,
        relevance_rating
      ) values ($1,$2,'personal_project',$3,$4,'unknown',$5,$6,$7,false,$8)
      on conflict (experience_id) do update set
        title = excluded.title,
        organization = excluded.organization,
        description = excluded.description,
        deliverables_summary = excluded.deliverables_summary,
        tools_used = excluded.tools_used,
        relevance_rating = excluded.relevance_rating
      `,
      [
        input.experienceId,
        input.studentProfileId,
        input.title,
        input.organization ?? null,
        input.description ?? null,
        input.deliverablesSummary ?? null,
        input.toolsUsed ?? [],
        input.relevanceRating ?? null,
      ]
    );
  }

  async ensureAcademicTerm(input: EnsureAcademicTermInput): Promise<void> {
    await query(
      `
      insert into academic_terms (
        academic_term_id,
        student_profile_id,
        institution_term_name,
        term_type,
        status
      ) values ($1,$2,$3,'other','completed')
      on conflict (academic_term_id) do update set
        institution_term_name = excluded.institution_term_name
      `,
      [
        input.academicTermId,
        input.studentProfileId,
        input.termName,
      ]
    );
  }

  async createCourse(input: CreateCourseInput): Promise<void> {
    await query(
      `
      insert into courses (
        course_id,
        academic_term_id,
        course_code,
        course_title,
        final_grade,
        notes
      ) values ($1,$2,$3,$4,$5,$6)
      on conflict (course_id) do update set
        academic_term_id = excluded.academic_term_id,
        course_code = excluded.course_code,
        course_title = excluded.course_title,
        final_grade = excluded.final_grade,
        notes = excluded.notes
      `,
      [
        input.courseId,
        input.academicTermId,
        input.courseCode ?? null,
        input.courseTitle,
        input.finalGrade ?? null,
        input.notes ?? null,
      ]
    );
  }

  async createCourseSkillCoverage(input: CreateCourseSkillCoverageInput): Promise<void> {
    await query(
      `
      insert into course_skill_coverage (
        course_skill_coverage_id,
        course_id,
        skill_name,
        coverage_strength,
        confidence_score,
        derived_from
      ) values ($1,$2,$3,$4,$5,$6)
      on conflict (course_id, skill_name) do update set
        coverage_strength = excluded.coverage_strength,
        confidence_score = excluded.confidence_score,
        derived_from = excluded.derived_from
      `,
      [
        input.courseSkillCoverageId,
        input.courseId,
        input.skillName,
        input.coverageStrength,
        input.confidenceScore,
        input.derivedFrom,
      ]
    );
  }

  async createInsight(input: CreateInsightInput): Promise<void> {
    await query(
      `
      insert into insight_objects (
        insight_id,
        student_profile_id,
        insight_category,
        insight_statement,
        confidence_score,
        status,
        visibility_level,
        created_by_source,
        parent_safe_summary
      ) values ($1,$2,$3,$4,0.7,'active','parent_summary_eligible','system_inference',$5)
      on conflict (insight_id) do update set
        insight_category = excluded.insight_category,
        insight_statement = excluded.insight_statement,
        parent_safe_summary = excluded.parent_safe_summary,
        last_updated_at = now()
      `,
      [
        input.insightId,
        input.studentProfileId,
        input.insightCategory,
        input.insightStatement,
        input.parentSafeSummary ?? null,
      ]
    );
  }
}
