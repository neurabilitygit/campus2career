import { query } from "../../db/client";

export interface HouseholdStudentContext {
  householdId: string | null;
  studentProfileId: string | null;
  studentUserId: string | null;
  roleInHousehold: string | null;
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
        order by uhr.created_at asc
        limit 1
      )
      select
        hm.household_id,
        sp.student_profile_id,
        sp.user_id as student_user_id,
        hm.role_in_household
      from household_membership hm
      left join households h on h.household_id = hm.household_id
      left join student_profiles sp on sp.user_id = h.primary_student_user_id
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
      order by created_at asc
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
}
