import { query } from "../../db/client";
import type { IntroOnboardingState } from "../../../../../packages/shared/src/contracts/introOnboarding";

export interface HouseholdStudentContext {
  householdId: string | null;
  studentProfileId: string | null;
  studentUserId: string | null;
  roleInHousehold: string | null;
  studentFirstName?: string | null;
  studentLastName?: string | null;
  studentPreferredName?: string | null;
}

export interface PreviewStudentContext {
  householdId: string | null;
  studentProfileId: string | null;
  studentUserId: string | null;
  studentFirstName?: string | null;
  studentLastName?: string | null;
  studentPreferredName?: string | null;
}

export interface UserBasicInfo extends IntroOnboardingState {
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
}

export class UserContextRepository {
  async resolveHouseholdStudentContextForUser(userId: string): Promise<HouseholdStudentContext | null> {
    const result = await query<HouseholdStudentContext>(
      `
      with household_membership as (
        select
          uhr.household_id,
          uhr.role_in_household
        from user_household_roles uhr
        where uhr.user_id = $1
          and uhr.membership_status = 'active'
        order by
          case when uhr.is_primary then 0 else 1 end,
          uhr.created_at asc
        limit 1
      )
      select
        hm.household_id as "householdId",
        sp.student_profile_id as "studentProfileId",
        sp.user_id as "studentUserId",
        hm.role_in_household as "roleInHousehold",
        su.first_name as "studentFirstName",
        su.last_name as "studentLastName",
        su.preferred_name as "studentPreferredName"
      from household_membership hm
      left join households h on h.household_id = hm.household_id
      left join student_profiles sp on sp.user_id = h.primary_student_user_id
      left join users su on su.user_id = sp.user_id
      limit 1
      `,
      [userId]
    );

    return result.rows[0] || null;
  }

  async resolveStudentProfileForStudentUser(userId: string): Promise<{ studentProfileId: string | null } | null> {
    const result = await query<{ studentProfileId: string | null }>(
      `
      select student_profile_id as "studentProfileId"
      from student_profiles
      where user_id = $1
      limit 1
      `,
      [userId]
    );

    return result.rows[0] || null;
  }

  async resolveDefaultPreviewStudentContext(): Promise<PreviewStudentContext | null> {
    const result = await query<PreviewStudentContext>(
      `
      select
        h.household_id as "householdId",
        sp.student_profile_id as "studentProfileId",
        sp.user_id as "studentUserId",
        su.first_name as "studentFirstName",
        su.last_name as "studentLastName",
        su.preferred_name as "studentPreferredName"
      from households h
      join student_profiles sp on sp.user_id = h.primary_student_user_id
      join users su on su.user_id = sp.user_id
      where h.primary_student_user_id is not null
      order by
        h.household_name asc nulls last,
        h.created_at asc
      limit 1
      `
    );

    return result.rows[0] || null;
  }

  async resolveApplicationRoleForUser(userId: string): Promise<"student" | "parent" | "coach" | "admin" | null> {
    const householdRole = await query<{ role: "student" | "parent" | "coach" | null }>(
      `
      select
        case
          when role_in_household = 'student' then 'student'
          when role_in_household in ('parent','guardian') then 'parent'
          when role_in_household = 'coach' then 'coach'
          else null
        end as role
      from user_household_roles
      where user_id = $1
        and membership_status = 'active'
      order by
        case when is_primary then 0 else 1 end,
        created_at asc
      limit 1
      `,
      [userId]
    );
    if (householdRole.rows[0]?.role) return householdRole.rows[0].role;

    const userRole = await query<{ role_type: "student" | "parent" | "coach" | "admin" }>(
      `select role_type from users where user_id = $1 limit 1`,
      [userId]
    );
    return userRole.rows[0]?.role_type || null;
  }

  async resolveUserBasicInfo(userId: string): Promise<UserBasicInfo | null> {
    const result = await query<UserBasicInfo>(
      `
      select
        first_name as "firstName",
        last_name as "lastName",
        preferred_name as "preferredName",
        has_completed_intro_onboarding as "hasCompletedIntroOnboarding",
        intro_onboarding_completed_at as "introOnboardingCompletedAt",
        intro_onboarding_skipped_at as "introOnboardingSkippedAt",
        intro_onboarding_version as "introOnboardingVersion",
        intro_onboarding_status as "introOnboardingStatus"
      from users
      where user_id = $1
      limit 1
      `,
      [userId]
    );

    return result.rows[0] || null;
  }
}
