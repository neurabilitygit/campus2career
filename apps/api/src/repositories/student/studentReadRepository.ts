import { query } from "../../db/client";

export interface StudentProfileRow {
  student_profile_id: string;
  user_id: string;
  school_name: string | null;
  expected_graduation_date: string | null;
  major_primary: string | null;
  major_secondary: string | null;
  preferred_geographies: string[] | null;
  career_goal_summary: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

export interface InsightRow {
  insight_id: string;
  insight_statement: string;
  parent_safe_summary: string | null;
  visibility_level: "student_only" | "coach_only" | "parent_summary_eligible" | "shared";
  confidence_score: number;
  status: "active" | "tentative" | "deprecated" | "contradicted";
}

export interface DeadlineRow {
  deadline_id: string;
  title: string;
  due_date: string;
  deadline_type: string;
  notes: string | null;
  completed: boolean | null;
}

export interface AccomplishmentRow {
  experience_id: string;
  title: string;
  organization: string | null;
  deliverables_summary: string | null;
  start_date: string | null;
  end_date: string | null;
  relevance_rating?: number | null;
  tools_used?: string[] | null;
}

export interface CourseCoverageRow {
  course_id: string;
  skill_name: string;
  coverage_strength: "low" | "medium" | "high";
  confidence_score: number;
}

export interface ArtifactRow {
  academic_artifact_id: string;
  artifact_type: string;
  extracted_summary: string | null;
  parsed_status: string;
}

export interface ContactRow {
  contact_id: string;
  warmth_level: "cold" | "warm" | "strong" | null;
  relationship_type: string | null;
}

export interface OutreachRow {
  outreach_interaction_id: string;
  interaction_type: string;
  outcome: string | null;
}

export interface SectorRow {
  sector_cluster: string;
}

export interface OccupationSkillRow {
  skill_name: string;
  skill_category: "technical" | "analytical" | "communication" | "operational" | "interpersonal" | "creative" | "managerial" | "ai_fluency";
  importance_score: number;
  required_proficiency_band: "basic" | "intermediate" | "advanced";
}

export class StudentReadRepository {
  async getStudentProfile(studentProfileId: string): Promise<StudentProfileRow | null> {
    const result = await query<StudentProfileRow>(
      `
      select
        sp.student_profile_id,
        sp.user_id,
        sp.school_name,
        sp.expected_graduation_date,
        sp.major_primary,
        sp.major_secondary,
        sp.preferred_geographies,
        sp.career_goal_summary,
        u.first_name,
        u.last_name
      from student_profiles sp
      left join users u on u.user_id = sp.user_id
      where sp.student_profile_id = $1
      `,
      [studentProfileId]
    );
    return result.rows[0] || null;
  }

  async getParentVisibleInsights(studentProfileId: string): Promise<InsightRow[]> {
    const result = await query<InsightRow>(
      `
      select
        insight_id,
        insight_statement,
        parent_safe_summary,
        visibility_level,
        confidence_score,
        status
      from insight_objects
      where student_profile_id = $1
        and status = 'active'
        and visibility_level in ('parent_summary_eligible', 'shared')
      order by confidence_score desc, last_updated_at desc
      limit 10
      `,
      [studentProfileId]
    );
    return result.rows;
  }

  async getUpcomingDeadlines(studentProfileId: string): Promise<DeadlineRow[]> {
    try {
      const result = await query<DeadlineRow>(
        `
        select
          deadline_id,
          title,
          due_date,
          deadline_type,
          notes,
          completed
        from deadlines
        where student_profile_id = $1
        order by due_date asc
        limit 25
        `,
        [studentProfileId]
      );
      return result.rows;
    } catch {
      return [];
    }
  }

  async getRecentAccomplishments(studentProfileId: string): Promise<AccomplishmentRow[]> {
    const result = await query<AccomplishmentRow>(
      `
      select
        experience_id,
        title,
        organization,
        deliverables_summary,
        start_date,
        end_date,
        relevance_rating,
        tools_used
      from experiences
      where student_profile_id = $1
      order by coalesce(end_date, start_date) desc nulls last
      limit 25
      `,
      [studentProfileId]
    );
    return result.rows;
  }

  async getCourseCoverage(studentProfileId: string): Promise<CourseCoverageRow[]> {
    const result = await query<CourseCoverageRow>(
      `
      select
        csc.course_id,
        csc.skill_name,
        csc.coverage_strength,
        csc.confidence_score
      from course_skill_coverage csc
      join courses c on c.course_id = csc.course_id
      join academic_terms t on t.academic_term_id = c.academic_term_id
      where t.student_profile_id = $1
      `,
      [studentProfileId]
    );
    return result.rows;
  }

  async getArtifacts(studentProfileId: string): Promise<ArtifactRow[]> {
    const result = await query<ArtifactRow>(
      `
      select
        academic_artifact_id,
        artifact_type,
        extracted_summary,
        parsed_status
      from academic_artifacts
      where student_profile_id = $1
      order by uploaded_at desc
      `,
      [studentProfileId]
    );
    return result.rows;
  }

  async getContacts(studentProfileId: string): Promise<ContactRow[]> {
    const result = await query<ContactRow>(
      `
      select contact_id, warmth_level, relationship_type
      from contacts
      where student_profile_id = $1
      order by created_at asc, contact_name asc
      `,
      [studentProfileId]
    );
    return result.rows;
  }

  async getOutreach(studentProfileId: string): Promise<OutreachRow[]> {
    const result = await query<OutreachRow>(
      `
      select outreach_interaction_id, interaction_type, outcome
      from outreach_interactions
      where student_profile_id = $1
      `,
      [studentProfileId]
    );
    return result.rows;
  }

  async getSelectedSectors(studentProfileId: string): Promise<SectorRow[]> {
    try {
      const result = await query<SectorRow>(
        `select sector_cluster from student_sector_selections where student_profile_id = $1 order by created_at asc`,
        [studentProfileId]
      );
      return result.rows;
    } catch {
      return [];
    }
  }

  async getOccupationSkillsForCanonicalRole(canonicalName: string): Promise<OccupationSkillRow[]> {
    const result = await query<OccupationSkillRow>(
      `
      select
        osr.skill_name,
        osr.skill_category,
        osr.importance_score,
        osr.required_proficiency_band
      from occupation_skill_requirements osr
      join occupation_clusters oc on oc.occupation_cluster_id = osr.occupation_cluster_id
      where lower(oc.canonical_name) = lower($1)
      order by osr.importance_score desc
      limit 20
      `,
      [canonicalName]
    );
    return result.rows;
  }
}
