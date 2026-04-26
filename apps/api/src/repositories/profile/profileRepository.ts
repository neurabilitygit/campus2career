import { executeQuery, query, type DbExecutor } from "../../db/client";
import type {
  CoachEditableProfile,
  ParentEditableProfile,
  ParentHouseholdMember,
  StudentEditableProfile,
} from "../../../../../packages/shared/src/contracts/profile";

export interface UserIdentityRow {
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
}

function fullName(firstName?: string | null, lastName?: string | null) {
  return [firstName?.trim(), lastName?.trim()].filter(Boolean).join(" ").trim();
}

export class ProfileRepository {
  async updateUserIdentity(input: {
    userId: string;
    firstName: string;
    lastName: string;
    preferredName?: string | null;
  }, executor?: DbExecutor) {
    await executeQuery(
      executor,
      `
      update users
      set
        first_name = $2,
        last_name = $3,
        preferred_name = $4,
        updated_at = now()
      where user_id = $1
      `,
      [input.userId, input.firstName, input.lastName, input.preferredName ?? null]
    );
  }

  async getStudentEditableProfile(studentProfileId: string): Promise<StudentEditableProfile | null> {
    const result = await query<{
      first_name: string | null;
      last_name: string | null;
      preferred_name: string | null;
      age: number | null;
      gender: string | null;
      housing_status: string | null;
      known_neurodivergent_categories: string[] | null;
      other_neurodivergent_description: string | null;
      communication_preferences: string | null;
      personal_choices: string | null;
      updated_at: string;
    }>(
      `
      select
        u.first_name,
        u.last_name,
        u.preferred_name,
        sp.age,
        sp.gender,
        sp.housing_status,
        sp.known_neurodivergent_categories,
        sp.other_neurodivergent_description,
        sp.communication_preferences,
        sp.personal_choices,
        sp.updated_at::text
      from student_profiles sp
      join users u on u.user_id = sp.user_id
      where sp.student_profile_id = $1
      limit 1
      `,
      [studentProfileId]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      fullName: fullName(row.first_name, row.last_name) || "",
      preferredName: row.preferred_name,
      age: row.age,
      gender: row.gender,
      housingStatus: row.housing_status,
      knownNeurodivergentCategories:
        (row.known_neurodivergent_categories || []) as StudentEditableProfile["knownNeurodivergentCategories"],
      otherNeurodivergentDescription: row.other_neurodivergent_description,
      communicationPreferences: row.communication_preferences,
      personalChoices: row.personal_choices,
      updatedAt: row.updated_at,
    };
  }

  async updateStudentEditableProfile(input: {
    studentProfileId: string;
    profile: StudentEditableProfile;
  }, executor?: DbExecutor) {
    await executeQuery(
      executor,
      `
      update student_profiles
      set
        age = $2,
        gender = $3,
        housing_status = $4,
        known_neurodivergent_categories = $5,
        other_neurodivergent_description = $6,
        communication_preferences = $7,
        personal_choices = $8,
        updated_at = now()
      where student_profile_id = $1
      `,
      [
        input.studentProfileId,
        input.profile.age,
        input.profile.gender,
        input.profile.housingStatus,
        input.profile.knownNeurodivergentCategories,
        input.profile.otherNeurodivergentDescription,
        input.profile.communicationPreferences,
        input.profile.personalChoices,
      ]
    );
  }

  async getParentEditableProfile(userId: string): Promise<ParentEditableProfile | null> {
    const result = await query<{
      first_name: string | null;
      last_name: string | null;
      preferred_name: string | null;
      family_unit_name: string | null;
      relationship_to_student: string | null;
      household_members: ParentHouseholdMember[] | null;
      family_structure: string | null;
      partnership_structure: string | null;
      known_neurodivergent_categories: string[] | null;
      demographic_information: string | null;
      communication_preferences: string | null;
      parent_goals_or_concerns: string | null;
      updated_at: string | null;
    }>(
      `
      select
        u.first_name,
        u.last_name,
        u.preferred_name,
        pp.family_unit_name,
        pp.relationship_to_student,
        pp.household_members,
        pp.family_structure,
        pp.partnership_structure,
        pp.known_neurodivergent_categories,
        pp.demographic_information,
        pp.communication_preferences,
        pp.parent_goals_or_concerns,
        pp.updated_at::text
      from users u
      left join parent_profiles pp on pp.parent_user_id = u.user_id
      where u.user_id = $1
      limit 1
      `,
      [userId]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      fullName: fullName(row.first_name, row.last_name) || "",
      preferredName: row.preferred_name,
      familyUnitName: row.family_unit_name,
      relationshipToStudent: row.relationship_to_student,
      householdMembers: row.household_members || [],
      familyStructure: row.family_structure,
      partnershipStructure: row.partnership_structure,
      knownNeurodivergentCategories:
        (row.known_neurodivergent_categories || []) as ParentEditableProfile["knownNeurodivergentCategories"],
      demographicInformation: row.demographic_information,
      communicationPreferences: row.communication_preferences,
      parentGoalsOrConcerns: row.parent_goals_or_concerns,
      updatedAt: row.updated_at || undefined,
    };
  }

  async upsertParentEditableProfile(input: {
    profileId: string;
    userId: string;
    householdId?: string | null;
    profile: ParentEditableProfile;
  }, executor?: DbExecutor) {
    await executeQuery(
      executor,
      `
      insert into parent_profiles (
        parent_profile_id,
        parent_user_id,
        household_id,
        family_unit_name,
        relationship_to_student,
        household_members,
        family_structure,
        partnership_structure,
        known_neurodivergent_categories,
        demographic_information,
        communication_preferences,
        parent_goals_or_concerns,
        created_at,
        updated_at
      ) values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,now(),now())
      on conflict (parent_user_id) do update set
        household_id = excluded.household_id,
        family_unit_name = excluded.family_unit_name,
        relationship_to_student = excluded.relationship_to_student,
        household_members = excluded.household_members,
        family_structure = excluded.family_structure,
        partnership_structure = excluded.partnership_structure,
        known_neurodivergent_categories = excluded.known_neurodivergent_categories,
        demographic_information = excluded.demographic_information,
        communication_preferences = excluded.communication_preferences,
        parent_goals_or_concerns = excluded.parent_goals_or_concerns,
        updated_at = now()
      `,
      [
        input.profileId,
        input.userId,
        input.householdId ?? null,
        input.profile.familyUnitName,
        input.profile.relationshipToStudent,
        JSON.stringify(input.profile.householdMembers || []),
        input.profile.familyStructure,
        input.profile.partnershipStructure,
        input.profile.knownNeurodivergentCategories,
        input.profile.demographicInformation,
        input.profile.communicationPreferences,
        input.profile.parentGoalsOrConcerns,
      ]
    );
  }

  async getCoachEditableProfile(userId: string): Promise<CoachEditableProfile | null> {
    const result = await query<{
      first_name: string | null;
      last_name: string | null;
      preferred_name: string | null;
      professional_title: string | null;
      organization_name: string | null;
      coaching_specialties: string[] | null;
      communication_preferences: string | null;
      updated_at: string | null;
    }>(
      `
      select
        u.first_name,
        u.last_name,
        u.preferred_name,
        cp.professional_title,
        cp.organization_name,
        cp.coaching_specialties,
        cp.communication_preferences,
        cp.updated_at::text
      from users u
      left join coach_profiles cp on cp.coach_user_id = u.user_id
      where u.user_id = $1
      limit 1
      `,
      [userId]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      fullName: fullName(row.first_name, row.last_name) || "",
      preferredName: row.preferred_name,
      professionalTitle: row.professional_title,
      organizationName: row.organization_name,
      coachingSpecialties: row.coaching_specialties || [],
      communicationPreferences: row.communication_preferences,
      updatedAt: row.updated_at || undefined,
    };
  }

  async upsertCoachEditableProfile(input: {
    profileId: string;
    userId: string;
    profile: CoachEditableProfile;
  }, executor?: DbExecutor) {
    await executeQuery(
      executor,
      `
      insert into coach_profiles (
        coach_profile_id,
        coach_user_id,
        professional_title,
        organization_name,
        coaching_specialties,
        communication_preferences,
        created_at,
        updated_at
      ) values ($1,$2,$3,$4,$5,$6,now(),now())
      on conflict (coach_user_id) do update set
        professional_title = excluded.professional_title,
        organization_name = excluded.organization_name,
        coaching_specialties = excluded.coaching_specialties,
        communication_preferences = excluded.communication_preferences,
        updated_at = now()
      `,
      [
        input.profileId,
        input.userId,
        input.profile.professionalTitle,
        input.profile.organizationName,
        input.profile.coachingSpecialties,
        input.profile.communicationPreferences,
      ]
    );
  }
}
