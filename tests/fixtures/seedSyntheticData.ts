import { closeDbPool, getDbPool, query } from "../../apps/api/src/db/client";
import { CURRENT_INTRO_ONBOARDING_VERSION } from "../../packages/shared/src/contracts/introOnboarding";
import {
  SYNTHETIC_COACH_RELATIONSHIPS,
  SYNTHETIC_STUDENTS,
  SYNTHETIC_USERS,
  listSyntheticStudents,
  listSeededSyntheticUsers,
  listSyntheticUsers,
} from "../synthetic/scenarios";

const seedIds = {
  institutionSyntheticState: "10000000-0000-4000-8000-100000000000",
  catalogSynthetic2026: "10000000-0000-4000-8000-100000000001",
  degreeProgramSyntheticUndergrad: "10000000-0000-4000-8000-100000000002",
  majorSyntheticEconomics: "10000000-0000-4000-8000-100000000003",
  courseSyntheticEcon101: "10000000-0000-4000-8000-100000000004",
  courseSyntheticStat201: "10000000-0000-4000-8000-100000000005",
  courseSyntheticAcct210: "10000000-0000-4000-8000-100000000006",
  requirementSetSyntheticEconomics: "10000000-0000-4000-8000-100000000007",
  requirementGroupSyntheticCore: "10000000-0000-4000-8000-100000000008",
  requirementGroupSyntheticElectives: "10000000-0000-4000-8000-100000000009",
  requirementItemSyntheticEcon101: "10000000-0000-4000-8000-100000000010",
  requirementItemSyntheticStat201: "10000000-0000-4000-8000-100000000011",
  requirementItemSyntheticAcct210: "10000000-0000-4000-8000-100000000012",
  requirementItemSyntheticUpperDivision: "10000000-0000-4000-8000-100000000013",
  studentCatalogAssignmentMaya: "10000000-0000-4000-8000-100000000014",
  parentProfileMaya: "11111111-a0a0-40a0-80a0-111111111111",
  parentProfileLeo: "22222222-a0a0-40a0-80a0-222222222222",
  coachProfileTaylor: "33333333-a0a0-40a0-80a0-333333333333",
  communicationPreferenceMaya: "11111111-aaaa-4aaa-8aaa-111111111111",
  communicationPreferenceLeo: "22222222-aaaa-4aaa-8aaa-222222222222",
  consentParentSummaryMaya: "11111111-bbbb-4bbb-8bbb-111111111111",
  consentParentSummaryLeo: "22222222-bbbb-4bbb-8bbb-222222222222",
  householdRoleMayaStudent: "11111111-abab-4bab-8bab-111111111111",
  householdRoleMayaParent: "11111111-acac-4cac-8cac-111111111111",
  householdRoleLeoStudent: "22222222-abab-4bab-8bab-222222222222",
  householdRoleLeoParent: "22222222-acac-4cac-8cac-222222222222",
  householdRoleCoachMaya: "bbbbbbbb-abab-4bab-8bab-bbbbbbbbbbbb",
  householdRoleCoachLeo: "dddddddd-abab-4bab-8bab-dddddddddddd",
  deadlineMaya: "11111111-cccc-4ccc-8ccc-111111111111",
  deadlineLeo: "22222222-cccc-4ccc-8ccc-222222222222",
  contactMaya: "11111111-dddd-4ddd-8ddd-111111111111",
  contactLeo: "22222222-dddd-4ddd-8ddd-222222222222",
  outreachMaya: "11111111-eeee-4eee-8eee-111111111111",
  outreachLeo: "22222222-eeee-4eee-8eee-222222222222",
  outcomeMayaApplication: "11111111-ffff-4fff-8fff-111111111111",
  outcomeMayaInterview: "11111111-9999-4999-8999-111111111111",
  outcomeLeoApplication: "22222222-ffff-4fff-8fff-222222222222",
  noteMayaPrivate: "11111111-1212-4121-8121-111111111111",
  noteMayaVisible: "11111111-1313-4131-8131-111111111111",
  recommendationMayaStudent: "11111111-1414-4141-8141-111111111111",
  recommendationMayaParent: "11111111-1515-4151-8151-111111111111",
  recommendationLeoStudent: "22222222-1414-4141-8141-222222222222",
  actionMayaShared: "11111111-1616-4161-8161-111111111111",
  actionLeoStudent: "22222222-1616-4161-8161-222222222222",
  flagMayaVisible: "11111111-1717-4171-8171-111111111111",
  flagLeoVisible: "22222222-1717-4171-8171-222222222222",
  findingMaya: "11111111-1818-4181-8181-111111111111",
  outboundDraftMaya: "11111111-1919-4191-8191-111111111111",
};

const STUDENT_PROFILE_IDS = listSyntheticStudents().map((student) => student.studentProfileId);
const HOUSEHOLD_IDS = listSyntheticStudents().map((student) => student.householdId);
const USER_IDS = listSyntheticUsers().map((user) => user.userId);
const SYNTHETIC_EMAILS = listSyntheticUsers().map((user) => user.email);
const SYNTHETIC_SEED_LOCK_KEY = 42424201;

async function withSyntheticSeedLock<T>(work: () => Promise<T>): Promise<T> {
  const lockClient = await getDbPool().connect();
  try {
    await lockClient.query(`select pg_advisory_lock($1)`, [SYNTHETIC_SEED_LOCK_KEY]);
    return await work();
  } finally {
    try {
      await lockClient.query(`select pg_advisory_unlock($1)`, [SYNTHETIC_SEED_LOCK_KEY]);
    } finally {
      lockClient.release();
    }
  }
}

async function cleanupTable(table: string, column: string, ids: string[]) {
  if (!ids.length) return;
  await query(`delete from ${table} where ${column} = any($1::uuid[])`, [ids]);
}

async function resetSyntheticTestDataUnlocked() {
  const existingSyntheticUsers = await query<{ user_id: string }>(
    `
    select user_id
    from users
    where user_id = any($1::uuid[])
       or email = any($2::text[])
    `,
    [USER_IDS, SYNTHETIC_EMAILS]
  );
  const targetUserIds = Array.from(new Set([...USER_IDS, ...existingSyntheticUsers.rows.map((row) => row.user_id)]));

  await query(`delete from career_scenario_action_items where student_profile_id = any($1::uuid[])`, [
    STUDENT_PROFILE_IDS,
  ]);
  await query(
    `
    delete from action_items
    where action_plan_id in (
      select action_plan_id from action_plans where student_profile_id = any($1::uuid[])
    )
    `,
    [STUDENT_PROFILE_IDS]
  );
  await query(`delete from action_plans where student_profile_id = any($1::uuid[])`, [STUDENT_PROFILE_IDS]);
  await query(`delete from career_scenarios where student_profile_id = any($1::uuid[])`, [
    STUDENT_PROFILE_IDS,
  ]);
  await query(
    `
    delete from student_curriculum_reviews
    where student_profile_id = any($1::uuid[])
       or curriculum_verified_by_user_id = any($2::uuid[])
       or coach_reviewed_by_user_id = any($2::uuid[])
    `,
    [STUDENT_PROFILE_IDS, targetUserIds]
  );
  await query(`delete from student_sector_selections where student_profile_id = any($1::uuid[])`, [
    STUDENT_PROFILE_IDS,
  ]);
  await query(`delete from onboarding_states where student_profile_id = any($1::uuid[])`, [
    STUDENT_PROFILE_IDS,
  ]);
  await query(
    `
    delete from household_join_requests
    where requesting_user_id = any($1::uuid[])
       or reviewed_by_user_id = any($1::uuid[])
       or household_id = any($2::uuid[])
    `,
    [targetUserIds, HOUSEHOLD_IDS]
  );
  await query(
    `
    delete from household_invitations
    where household_id = any($1::uuid[])
       or invited_by_user_id = any($2::uuid[])
       or accepted_by_user_id = any($2::uuid[])
       or invited_email = any($3::text[])
    `,
    [HOUSEHOLD_IDS, targetUserIds, SYNTHETIC_EMAILS]
  );
  await query(
    `
    delete from user_capability_overrides
    where user_id = any($1::uuid[])
       or household_id = any($2::uuid[])
       or created_by_user_id = any($1::uuid[])
    `,
    [targetUserIds, HOUSEHOLD_IDS]
  );
  await cleanupTable("student_catalog_assignments", "student_catalog_assignment_id", [
    seedIds.studentCatalogAssignmentMaya,
  ]);
  await cleanupTable("requirement_items", "requirement_item_id", [
    seedIds.requirementItemSyntheticEcon101,
    seedIds.requirementItemSyntheticStat201,
    seedIds.requirementItemSyntheticAcct210,
    seedIds.requirementItemSyntheticUpperDivision,
  ]);
  await cleanupTable("requirement_groups", "requirement_group_id", [
    seedIds.requirementGroupSyntheticCore,
    seedIds.requirementGroupSyntheticElectives,
  ]);
  await cleanupTable("requirement_sets", "requirement_set_id", [seedIds.requirementSetSyntheticEconomics]);
  await cleanupTable("catalog_courses", "catalog_course_id", [
    seedIds.courseSyntheticEcon101,
    seedIds.courseSyntheticStat201,
    seedIds.courseSyntheticAcct210,
  ]);
  await cleanupTable("majors", "major_id", [seedIds.majorSyntheticEconomics]);
  await cleanupTable("degree_programs", "degree_program_id", [seedIds.degreeProgramSyntheticUndergrad]);
  await cleanupTable("academic_catalogs", "academic_catalog_id", [seedIds.catalogSynthetic2026]);
  await cleanupTable("institutions", "institution_id", [seedIds.institutionSyntheticState]);
  await cleanupTable("coach_profiles", "coach_profile_id", [seedIds.coachProfileTaylor]);
  await cleanupTable("parent_profiles", "parent_profile_id", [
    seedIds.parentProfileMaya,
    seedIds.parentProfileLeo,
  ]);
  await cleanupTable("coach_outbound_messages", "coach_outbound_message_id", [seedIds.outboundDraftMaya]);
  await cleanupTable("coach_flags", "coach_flag_id", [seedIds.flagMayaVisible, seedIds.flagLeoVisible]);
  await cleanupTable("coach_action_items", "coach_action_item_id", [seedIds.actionMayaShared, seedIds.actionLeoStudent]);
  await cleanupTable("coach_recommendations", "coach_recommendation_id", [
    seedIds.recommendationMayaStudent,
    seedIds.recommendationMayaParent,
    seedIds.recommendationLeoStudent,
  ]);
  await cleanupTable("coach_findings", "coach_finding_id", [seedIds.findingMaya]);
  await cleanupTable("coach_notes", "coach_note_id", [seedIds.noteMayaPrivate, seedIds.noteMayaVisible]);
  await cleanupTable(
    "student_outcomes",
    "student_outcome_id",
    [seedIds.outcomeMayaApplication, seedIds.outcomeMayaInterview, seedIds.outcomeLeoApplication]
  );
  await cleanupTable("outreach_interactions", "outreach_interaction_id", [
    seedIds.outreachMaya,
    seedIds.outreachLeo,
  ]);
  await cleanupTable("contacts", "contact_id", [seedIds.contactMaya, seedIds.contactLeo]);
  await cleanupTable("deadlines", "deadline_id", [seedIds.deadlineMaya, seedIds.deadlineLeo]);
  await cleanupTable("student_communication_preferences", "student_communication_preference_id", [
    seedIds.communicationPreferenceMaya,
    seedIds.communicationPreferenceLeo,
  ]);
  await cleanupTable("consent_scopes", "consent_scope_id", [
    seedIds.consentParentSummaryMaya,
    seedIds.consentParentSummaryLeo,
  ]);
  await query(
    `delete from coach_student_relationships where coach_student_relationship_id = any($1::uuid[])`,
    [SYNTHETIC_COACH_RELATIONSHIPS.map((relationship) => relationship.relationshipId)]
  );
  await query(`delete from student_profiles where student_profile_id = any($1::uuid[])`, [STUDENT_PROFILE_IDS]);
  await query(`delete from user_household_roles where household_id = any($1::uuid[]) or user_id = any($2::uuid[])`, [
    HOUSEHOLD_IDS,
    targetUserIds,
  ]);
  await query(`delete from households where household_id = any($1::uuid[])`, [HOUSEHOLD_IDS]);
  await query(`delete from users where user_id = any($1::uuid[]) or email = any($2::text[])`, [
    targetUserIds,
    SYNTHETIC_EMAILS,
  ]);
}

export async function resetSyntheticTestData() {
  await withSyntheticSeedLock(resetSyntheticTestDataUnlocked);
}

async function seedSyntheticTestDataUnlocked() {
  await resetSyntheticTestDataUnlocked();

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
    ) values ($1,'synthetic_state_university','Synthetic State University','US','NY','New York','https://synthetic-state.example.edu')
    on conflict (institution_id) do update
    set canonical_name = excluded.canonical_name,
        display_name = excluded.display_name,
        country_code = excluded.country_code,
        state_region = excluded.state_region,
        city = excluded.city,
        website_url = excluded.website_url
    `,
    [seedIds.institutionSyntheticState]
  );

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
    ) values ($1,$2,'2026-2027',2026,2027,'https://synthetic-state.example.edu/catalog/economics','html','published')
    `,
    [seedIds.catalogSynthetic2026, seedIds.institutionSyntheticState]
  );

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
    ) values ($1,$2,'Undergraduate','Synthetic State University majors','College of Social Sciences',120,30,2.0)
    `,
    [seedIds.degreeProgramSyntheticUndergrad, seedIds.catalogSynthetic2026]
  );

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
    ) values ($1,$2,'economics','Economics','45.0601','Economics',true)
    `,
    [seedIds.majorSyntheticEconomics, seedIds.degreeProgramSyntheticUndergrad]
  );

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
    ) values
      ($1,$4,'ECON 101','Intro to Economics','Economics',4,4,'Core economics introduction.','introductory'),
      ($2,$4,'STAT 201','Statistics for Social Science','Statistics',4,4,'Applied statistics requirement.','intermediate'),
      ($3,$4,'ACCT 210','Financial Accounting','Accounting',4,4,'Foundational accounting course.','intermediate')
    `,
    [
      seedIds.courseSyntheticEcon101,
      seedIds.courseSyntheticStat201,
      seedIds.courseSyntheticAcct210,
      seedIds.catalogSynthetic2026,
    ]
  );

  await query(
    `
    insert into requirement_sets (
      requirement_set_id,
      major_id,
      minor_id,
      concentration_id,
      set_type,
      display_name,
      total_credits_required,
      provenance_method,
      source_url,
      source_note
    ) values (
      $1,$2,null,null,'major','Economics major requirements',36,'direct_scrape',
      'https://synthetic-state.example.edu/catalog/economics',
      'Synthetic seeded curriculum for dashboard verification tests.'
    )
    `,
    [seedIds.requirementSetSyntheticEconomics, seedIds.majorSyntheticEconomics]
  );

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
    ) values
      ($1,$3,'Core courses','all_of',null,null,1,'Complete both core foundation courses.'),
      ($2,$3,'Elective and supporting coursework','choose_n',2,8,2,'Choose two supporting courses or approved upper-division electives.')
    `,
    [
      seedIds.requirementGroupSyntheticCore,
      seedIds.requirementGroupSyntheticElectives,
      seedIds.requirementSetSyntheticEconomics,
    ]
  );

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
    ) values
      ($1,$5,$6,'ECON 101','course',null,null,4,1),
      ($2,$5,$7,'STAT 201','course',null,null,4,2),
      ($3,$8,$9,'ACCT 210','course',null,null,4,1),
      ($4,$8,null,'Economics elective at the 300 level','course_pattern','ECON',300,4,2)
    `,
    [
      seedIds.requirementItemSyntheticEcon101,
      seedIds.requirementItemSyntheticStat201,
      seedIds.requirementItemSyntheticAcct210,
      seedIds.requirementItemSyntheticUpperDivision,
      seedIds.requirementGroupSyntheticCore,
      seedIds.courseSyntheticEcon101,
      seedIds.courseSyntheticStat201,
      seedIds.requirementGroupSyntheticElectives,
      seedIds.courseSyntheticAcct210,
    ]
  );

  for (const user of listSeededSyntheticUsers()) {
    await query(
      `
      insert into users (
        user_id,
        role_type,
        first_name,
        last_name,
        preferred_name,
        email,
        auth_provider,
        is_super_admin,
        has_completed_intro_onboarding,
        intro_onboarding_completed_at,
        intro_onboarding_version,
        intro_onboarding_status,
        timezone,
        preferred_language,
        account_status,
        created_at,
        updated_at
      ) values ($1,$2,$3,$4,$5,$6,'supabase_google',$7,true,now(),$8,'completed','America/New_York','en','active',now(),now())
      on conflict (user_id) do update
      set
        role_type = excluded.role_type,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        preferred_name = excluded.preferred_name,
        email = excluded.email,
        auth_provider = excluded.auth_provider,
        is_super_admin = excluded.is_super_admin,
        has_completed_intro_onboarding = excluded.has_completed_intro_onboarding,
        intro_onboarding_completed_at = excluded.intro_onboarding_completed_at,
        intro_onboarding_version = excluded.intro_onboarding_version,
        intro_onboarding_status = excluded.intro_onboarding_status,
        timezone = excluded.timezone,
        preferred_language = excluded.preferred_language,
        account_status = excluded.account_status,
        updated_at = now()
      `,
      [
        user.userId,
        user.roleType,
        user.firstName,
        user.lastName,
        user.preferredName ?? null,
        user.email,
        user.email === "eric.bassman@gmail.com",
        CURRENT_INTRO_ONBOARDING_VERSION,
      ]
    );
  }

  for (const student of listSyntheticStudents()) {
    const studentUser = SYNTHETIC_USERS[student.studentUserKey];
    const parentUser = SYNTHETIC_USERS[student.parentUserKey];
    await query(
      `
      insert into households (
        household_id,
        household_name,
        created_by_parent_user_id,
        primary_student_user_id,
        created_at,
        updated_at
      ) values ($1,$2,$3,$4,now(),now())
      `,
      [student.householdId, student.householdName, parentUser.userId, studentUser.userId]
    );

    await query(
      `
      insert into user_household_roles (
        user_household_role_id,
        household_id,
        user_id,
        role_in_household,
        is_primary,
        membership_status,
        approved_by_user_id,
        approved_at,
        created_at
      ) values
        ($1,$2,$3,'student',true,'active',$5,now(),now()),
        ($4,$2,$5,'parent',true,'active',$5,now(),now())
      `,
      [
        student.key === "maya" ? seedIds.householdRoleMayaStudent : seedIds.householdRoleLeoStudent,
        student.householdId,
        studentUser.userId,
        student.key === "maya" ? seedIds.householdRoleMayaParent : seedIds.householdRoleLeoParent,
        parentUser.userId,
      ]
    );

    await query(
      `
      insert into student_profiles (
        student_profile_id,
        user_id,
        household_id,
        school_name,
        expected_graduation_date,
        major_primary,
        preferred_geographies,
        career_goal_summary,
        age,
        gender,
        housing_status,
        known_neurodivergent_categories,
        communication_preferences,
        personal_choices,
        created_at,
        updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now(),now())
      `,
      [
        student.studentProfileId,
        studentUser.userId,
        student.householdId,
        student.schoolName,
        student.expectedGraduationDate,
        student.majorPrimary,
        ["New York", "Boston"],
        student.careerGoalSummary,
        student.key === "maya" ? 20 : 19,
        "Prefer not to say",
        student.key === "maya" ? "On campus during the semester" : "Off campus with family during the summer",
        student.key === "maya" ? ["ADHD"] : [],
        student.key === "maya"
          ? "Short, calm guidance works best."
          : "Direct summaries are easiest to use.",
        student.key === "maya"
          ? "Prefers local internships during the school year."
          : "Prefers structured weekly planning.",
      ]
    );
  }

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
      is_primary
    ) values ($1,$2,$3,$4,$5,$6,null,null,'student_selected',true)
    `,
    [
      seedIds.studentCatalogAssignmentMaya,
      SYNTHETIC_STUDENTS.maya.studentProfileId,
      seedIds.institutionSyntheticState,
      seedIds.catalogSynthetic2026,
      seedIds.degreeProgramSyntheticUndergrad,
      seedIds.majorSyntheticEconomics,
    ]
  );

  await query(
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
    ) values
      ($1,$2,$3,'Rivera family','Parent','[{"name":"Maya Rivera","relationship":"Student"}]'::jsonb,'Two-parent household','Married','{}','Bilingual English and Spanish household','Prefers calm weekly summaries','Support Maya without creating extra pressure at home',now(),now()),
      ($4,$5,$6,'Carter family','Parent','[{"name":"Leo Carter","relationship":"Student"}]'::jsonb,'Single-parent household','Single','{}','No demographic details added','Prefers concise updates','Keep progress visible without overwhelming Leo',now(),now())
    `,
    [
      seedIds.parentProfileMaya,
      SYNTHETIC_USERS.parentMaya.userId,
      SYNTHETIC_STUDENTS.maya.householdId,
      seedIds.parentProfileLeo,
      SYNTHETIC_USERS.parentLeo.userId,
      SYNTHETIC_STUDENTS.leo.householdId,
    ]
  );

  await query(
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
    ) values
      ($1,$2,'Career Coach','Synthetic Career Lab',ARRAY['Networking','Internship search'],'Prefers concise follow-up summaries after each session.',now(),now())
    `,
    [seedIds.coachProfileTaylor, SYNTHETIC_USERS.coachTaylor.userId]
  );

  await query(
    `
    insert into user_household_roles (
      user_household_role_id,
      household_id,
      user_id,
      role_in_household,
      is_primary,
      membership_status,
      approved_by_user_id,
      approved_at,
      created_at
    ) values
      ($1,$2,$3,'coach',false,'active',$3,now(),now()),
      ($4,$5,$3,'coach',false,'active',$3,now(),now())
    `,
    [
      seedIds.householdRoleCoachMaya,
      SYNTHETIC_STUDENTS.maya.householdId,
      SYNTHETIC_USERS.coachTaylor.userId,
      seedIds.householdRoleCoachLeo,
      SYNTHETIC_STUDENTS.leo.householdId,
    ]
  );

  for (const relationship of SYNTHETIC_COACH_RELATIONSHIPS) {
    const student = SYNTHETIC_STUDENTS[relationship.studentKey];
    const coach = SYNTHETIC_USERS[relationship.coachUserKey];
    await query(
      `
      insert into coach_student_relationships (
        coach_student_relationship_id,
        coach_user_id,
        student_profile_id,
        household_id,
        relationship_status,
        start_date,
        next_review_date,
        created_by_user_id,
        can_view_student_profile,
        can_view_evidence,
        can_create_notes,
        can_create_recommendations,
        can_create_action_items,
        can_send_communications,
        can_view_parent_facing_summaries,
        created_at,
        updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$2,true,true,true,true,true,true,true,now(),now())
      `,
      [
        relationship.relationshipId,
        coach.userId,
        student.studentProfileId,
        student.householdId,
        relationship.relationshipStatus,
        relationship.startDate,
        relationship.nextReviewDate,
      ]
    );
  }

  await query(
    `
    insert into student_communication_preferences (
      student_communication_preference_id,
      student_profile_id,
      preferred_channels,
      disliked_channels,
      preferred_tone,
      sensitive_topics,
      preferred_frequency,
      best_time_of_day,
      preferred_guidance_formats,
      identify_parent_origin,
      allow_parent_concern_rephrasing,
      consent_parent_translated_messages,
      notes,
      created_at,
      updated_at
    ) values
      ($1,$2,$3,$4,'question_led',$5,'weekly','evening',$6,true,true,true,$7,now(),now()),
      ($8,$9,$10,$11,'direct',$12,'as_needed','afternoon',$13,true,true,true,$14,now(),now())
    `,
    [
      seedIds.communicationPreferenceMaya,
      SYNTHETIC_STUDENTS.maya.studentProfileId,
      ["email", "sms"],
      ["whatsapp"],
      ["money", "pressure"],
      ["choices", "questions"],
      "Prefers short, calm guidance.",
      seedIds.communicationPreferenceLeo,
      SYNTHETIC_STUDENTS.leo.studentProfileId,
      ["email"],
      ["sms"],
      ["pressure"],
      ["direct_instructions", "summaries"],
      "Prefers direct concise guidance.",
    ]
  );

  await query(
    `
    insert into onboarding_states (
      onboarding_state_id,
      student_profile_id,
      profile_completed,
      sectors_completed,
      uploads_completed,
      network_completed,
      deadlines_completed,
      onboarding_completed,
      first_diagnostic_generated,
      created_at,
      updated_at
    ) values
      ('11111111-2020-4020-8020-111111111111',$1,true,true,false,true,true,true,false,now(),now()),
      ('22222222-2020-4020-8020-222222222222',$2,true,true,false,true,true,true,false,now(),now())
    `,
    [SYNTHETIC_STUDENTS.maya.studentProfileId, SYNTHETIC_STUDENTS.leo.studentProfileId]
  );

  await query(
    `
    insert into student_sector_selections (
      student_sector_selection_id,
      student_profile_id,
      sector_cluster,
      created_at
    ) values
      ('11111111-2121-4121-8121-111111111111',$1,$2,now()),
      ('22222222-2121-4121-8121-222222222222',$3,$4,now())
    `,
    [
      SYNTHETIC_STUDENTS.maya.studentProfileId,
      SYNTHETIC_STUDENTS.maya.sectorCluster,
      SYNTHETIC_STUDENTS.leo.studentProfileId,
      SYNTHETIC_STUDENTS.leo.sectorCluster,
    ]
  );

  await query(
    `
    insert into consent_scopes (
      consent_scope_id,
      student_user_id,
      grantee_user_id,
      scope_type,
      access_level,
      granted_at,
      notes
    ) values
      ($1,$2,$3,'parent_summary','full',now(),'Synthetic coach review consent'),
      ($4,$5,$3,'parent_summary','full',now(),'Synthetic coach review consent')
    `,
    [
      seedIds.consentParentSummaryMaya,
      SYNTHETIC_USERS.studentMaya.userId,
      SYNTHETIC_USERS.coachTaylor.userId,
      seedIds.consentParentSummaryLeo,
      SYNTHETIC_USERS.studentLeo.userId,
    ]
  );

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
    ) values
      ($1,$2,'Synthetic internship deadline','2026-05-12','application','Submit three internship applications',false,now(),now()),
      ($3,$4,'Synthetic project deadline','2026-05-15','project','Finish the portfolio demo',false,now(),now())
    `,
    [
      seedIds.deadlineMaya,
      SYNTHETIC_STUDENTS.maya.studentProfileId,
      seedIds.deadlineLeo,
      SYNTHETIC_STUDENTS.leo.studentProfileId,
    ]
  );

  await query(
    `
    insert into contacts (
      contact_id,
      student_profile_id,
      contact_name,
      relationship_type,
      warmth_level,
      notes,
      created_at,
      updated_at
    ) values
      ($1,$2,'Professor Lin','mentor','warm','Can review outreach drafts.',now(),now()),
      ($3,$4,'Avery Cole','alumni','warm','Helpful alum contact.',now(),now())
    `,
    [
      seedIds.contactMaya,
      SYNTHETIC_STUDENTS.maya.studentProfileId,
      seedIds.contactLeo,
      SYNTHETIC_STUDENTS.leo.studentProfileId,
    ]
  );

  await query(
    `
    insert into outreach_interactions (
      outreach_interaction_id,
      student_profile_id,
      contact_id,
      interaction_type,
      outcome,
      notes,
      interaction_at,
      created_at
    ) values
      ($1,$2,$3,'informational_interview','Follow-up planned','Synthetic networking touchpoint','2026-04-10T15:00:00.000Z',now()),
      ($4,$5,$6,'intro_request','Waiting on reply','Synthetic intro request','2026-04-09T15:00:00.000Z',now())
    `,
    [
      seedIds.outreachMaya,
      SYNTHETIC_STUDENTS.maya.studentProfileId,
      seedIds.contactMaya,
      seedIds.outreachLeo,
      SYNTHETIC_STUDENTS.leo.studentProfileId,
      seedIds.contactLeo,
    ]
  );

  await query(
    `
    insert into student_outcomes (
      student_outcome_id,
      student_profile_id,
      household_id,
      target_role_family,
      target_sector_cluster,
      outcome_type,
      status,
      employer_name,
      role_title,
      source_type,
      reported_by_user_id,
      reported_by_role,
      verification_status,
      action_date,
      action_date_label,
      notes,
      created_at,
      updated_at
    ) values
      ($1,$2,$3,'business analyst','fintech','internship_application','applied','Atlas Advisory','Business Analyst Intern','student_report',$4,'student','self_reported','2026-04-08','applied_date','Applied through the internship portal.',now(),now()),
      ($5,$2,$3,'business analyst','fintech','interview','interviewing','Atlas Advisory','Business Analyst Intern','student_report',$4,'student','self_reported','2026-04-18','interview_date','Phone screen completed.',now(),now()),
      ($6,$7,$8,'software developer','technology_startups','internship_application','applied','Northstar Labs','Software Engineering Intern','student_report',$9,'student','self_reported','2026-04-11','applied_date','Applied through a referral link.',now(),now())
    `,
    [
      seedIds.outcomeMayaApplication,
      SYNTHETIC_STUDENTS.maya.studentProfileId,
      SYNTHETIC_STUDENTS.maya.householdId,
      SYNTHETIC_USERS.studentMaya.userId,
      seedIds.outcomeMayaInterview,
      seedIds.outcomeLeoApplication,
      SYNTHETIC_STUDENTS.leo.studentProfileId,
      SYNTHETIC_STUDENTS.leo.householdId,
      SYNTHETIC_USERS.studentLeo.userId,
    ]
  );

  await query(
    `
    insert into coach_notes (
      coach_note_id,
      coach_user_id,
      student_profile_id,
      household_id,
      note_type,
      title,
      body,
      visibility,
      created_at,
      updated_at
    ) values
      ($1,$2,$3,$4,'session_note','Coach private planning note','Keep the next session focused on outreach follow-through.','coach_private',now(),now()),
      ($5,$2,$3,$4,'follow_up_note','Visible coach feedback','You have enough traction to start a steady outreach rhythm this week.','student_visible',now(),now())
    `,
    [
      seedIds.noteMayaPrivate,
      SYNTHETIC_USERS.coachTaylor.userId,
      SYNTHETIC_STUDENTS.maya.studentProfileId,
      SYNTHETIC_STUDENTS.maya.householdId,
      seedIds.noteMayaVisible,
    ]
  );

  await query(
    `
    insert into coach_findings (
      coach_finding_id,
      coach_user_id,
      student_profile_id,
      household_id,
      title,
      finding_category,
      severity,
      evidence_basis,
      explanation,
      visibility,
      created_at,
      updated_at
    ) values
      ($1,$2,$3,$4,'Execution is the main blocker','execution_risk','high','Outcome history and coach review','The student understands the target path but has not built a consistent weekly execution loop.','internal_system_context',now(),now())
    `,
    [
      seedIds.findingMaya,
      SYNTHETIC_USERS.coachTaylor.userId,
      SYNTHETIC_STUDENTS.maya.studentProfileId,
      SYNTHETIC_STUDENTS.maya.householdId,
    ]
  );

  await query(
    `
    insert into coach_recommendations (
      coach_recommendation_id,
      coach_user_id,
      student_profile_id,
      household_id,
      title,
      recommendation_category,
      rationale,
      recommended_next_step,
      expected_benefit,
      priority,
      due_date,
      visibility,
      status,
      created_at,
      updated_at
    ) values
      ($1,$2,$3,$4,'Start weekly alumni outreach','networking','The student needs warmer leads before the next application push.','Send three alumni outreach messages by Thursday.','Build momentum and improve signal quality.','high','2026-05-02','student_visible','active',now(),now()),
      ($5,$2,$3,$4,'Support a weekly accountability check-in','communication','A parent can help keep the follow-through rhythm calm and visible.','Agree on one weekly ten-minute check-in about applications.','Reduce last-minute pressure and confusion.','medium','2026-05-03','parent_visible','active',now(),now()),
      ($6,$2,$7,$8,'Tighten GitHub project routine','project_or_portfolio','Visible project momentum is still thin.','Ship one small portfolio update this week.','Improve proof-of-work signal.','medium','2026-05-04','student_visible','active',now(),now())
    `,
    [
      seedIds.recommendationMayaStudent,
      SYNTHETIC_USERS.coachTaylor.userId,
      SYNTHETIC_STUDENTS.maya.studentProfileId,
      SYNTHETIC_STUDENTS.maya.householdId,
      seedIds.recommendationMayaParent,
      seedIds.recommendationLeoStudent,
      SYNTHETIC_STUDENTS.leo.studentProfileId,
      SYNTHETIC_STUDENTS.leo.householdId,
    ]
  );

  await query(
    `
    insert into coach_action_items (
      coach_action_item_id,
      coach_user_id,
      coach_recommendation_id,
      student_profile_id,
      household_id,
      title,
      description,
      priority,
      due_date,
      status,
      assigned_to,
      visible_to_student,
      visible_to_parent,
      created_at,
      updated_at
    ) values
      ($1,$2,$3,$4,$5,'Finish resume revision','Update the resume bullets for the research assistant role and send the draft back to the coach.','high','2026-05-03','not_started','student',true,true,now(),now()),
      ($6,$2,$7,$8,$9,'Ship one portfolio update','Publish one small GitHub project improvement with a short README update.','medium','2026-05-05','in_progress','student',true,false,now(),now())
    `,
    [
      seedIds.actionMayaShared,
      SYNTHETIC_USERS.coachTaylor.userId,
      seedIds.recommendationMayaStudent,
      SYNTHETIC_STUDENTS.maya.studentProfileId,
      SYNTHETIC_STUDENTS.maya.householdId,
      seedIds.actionLeoStudent,
      seedIds.recommendationLeoStudent,
      SYNTHETIC_STUDENTS.leo.studentProfileId,
      SYNTHETIC_STUDENTS.leo.householdId,
    ]
  );

  await query(
    `
    insert into coach_flags (
      coach_flag_id,
      student_profile_id,
      household_id,
      created_by_user_id,
      created_by_role,
      flag_type,
      severity,
      title,
      description,
      status,
      visibility,
      created_at
    ) values
      ($1,$2,$3,$4,'coach','no_outcome_activity','warning','Outcome activity is missing','No new application, interview, or offer activity has been recorded this month.','open','student_and_parent_visible',now()),
      ($5,$6,$7,$4,'coach','missing_evidence','warning','Evidence is still thin','Transcript and project evidence are still missing for a reliable read.','open','student_visible',now())
    `,
    [
      seedIds.flagMayaVisible,
      SYNTHETIC_STUDENTS.maya.studentProfileId,
      SYNTHETIC_STUDENTS.maya.householdId,
      SYNTHETIC_USERS.coachTaylor.userId,
      seedIds.flagLeoVisible,
      SYNTHETIC_STUDENTS.leo.studentProfileId,
      SYNTHETIC_STUDENTS.leo.householdId,
    ]
  );

  await query(
    `
    insert into coach_outbound_messages (
      coach_outbound_message_id,
      coach_user_id,
      student_profile_id,
      household_id,
      recipient_type,
      recipient_user_id,
      channel,
      subject,
      body,
      status,
      provider_mode,
      linked_coach_action_item_id,
      linked_coach_recommendation_id,
      created_at,
      updated_at
    ) values
      ($1,$2,$3,$4,'student',$5,'email','Quick follow-up before Thursday','Please send your updated resume before tomorrow so we can review it together.','draft','mock',$6,$7,now(),now())
    `,
    [
      seedIds.outboundDraftMaya,
      SYNTHETIC_USERS.coachTaylor.userId,
      SYNTHETIC_STUDENTS.maya.studentProfileId,
      SYNTHETIC_STUDENTS.maya.householdId,
      SYNTHETIC_USERS.studentMaya.userId,
      seedIds.actionMayaShared,
      seedIds.recommendationMayaStudent,
    ]
  );
}

export async function seedSyntheticTestData() {
  await withSyntheticSeedLock(seedSyntheticTestDataUnlocked);
}

export async function seedAndCloseSyntheticTestData() {
  await seedSyntheticTestData();
  await closeDbPool();
}
