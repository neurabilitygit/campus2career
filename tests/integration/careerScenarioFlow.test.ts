import test, { after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { closeDbPool, query } from "../../apps/api/src/db/client";
import {
  coachCareerScenarioCreateRoute,
  coachCareerScenarioListRoute,
  parentCareerScenarioActiveRoute,
  studentCareerScenarioActiveRoute,
  studentCareerScenarioCreateRoute,
  studentCareerScenarioDeleteRoute,
  studentCareerScenarioDuplicateRoute,
  studentCareerScenarioListRoute,
  studentCareerScenarioSetActiveRoute,
  studentCareerScenarioUpdateRoute,
} from "../../apps/api/src/routes/careerScenarios";
import { studentProfileUpsertRoute } from "../../apps/api/src/routes/studentWrite";
import { createAuthedRequest, createResponse } from "../fixtures/http";
import { resetSyntheticTestData, seedSyntheticTestData } from "../fixtures/seedSyntheticData";
import { SYNTHETIC_COACH_RELATIONSHIPS, SYNTHETIC_STUDENTS } from "../synthetic/scenarios";

process.env.ALLOW_DEMO_AUTH = "true";

beforeEach(async () => {
  await seedSyntheticTestData();
});

after(async () => {
  await resetSyntheticTestData();
  await closeDbPool();
});

test("student can create, update, duplicate, activate, and soft-delete career scenarios without deleting student data", async () => {
  const createdScenarioResponse = createResponseFactory();
  await studentCareerScenarioCreateRoute(
    createAuthedRequest(
      "studentMaya",
      {
        scenarioName: "Fintech internship push",
        jobDescriptionText: "SQL, Excel, stakeholder communication, and internship experience preferred.",
        targetRole: "Business Analyst",
        targetSector: "Fintech",
        targetGeography: "New York",
      },
      { method: "POST", url: "/students/me/career-scenarios" }
    ),
    createdScenarioResponse.res
  );

  assert.equal(createdScenarioResponse.statusCode, 200);
  const createdId = createdScenarioResponse.json.scenario.careerScenarioId as string;
  assert.equal(createdScenarioResponse.json.scenario.isActive, true);
  assert.equal(createdScenarioResponse.json.scenario.actionItems.length > 0, true);

  const updateResponse = createResponseFactory();
  await studentCareerScenarioUpdateRoute(
    createAuthedRequest(
      "studentMaya",
      {
        careerScenarioId: createdId,
        scenarioName: "Fintech internship push",
        jobDescriptionText: "SQL, Excel, Tableau, and stakeholder communication.",
        targetRole: "Business Analyst",
        targetSector: "Fintech",
        notes: "Prioritize this through recruiting season.",
      },
      { method: "POST", url: "/students/me/career-scenarios/update" }
    ),
    updateResponse.res
  );
  assert.equal(updateResponse.statusCode, 200);
  assert.match(updateResponse.json.scenario.notes, /recruiting season/i);

  const duplicateResponse = createResponseFactory();
  await studentCareerScenarioDuplicateRoute(
    createAuthedRequest(
      "studentMaya",
      {
        careerScenarioId: createdId,
        newName: "Consulting variant",
      },
      { method: "POST", url: "/students/me/career-scenarios/duplicate" }
    ),
    duplicateResponse.res
  );
  assert.equal(duplicateResponse.statusCode, 200);
  const duplicateId = duplicateResponse.json.scenario.careerScenarioId as string;

  const activateResponse = createResponseFactory();
  await studentCareerScenarioSetActiveRoute(
    createAuthedRequest(
      "studentMaya",
      { careerScenarioId: duplicateId },
      { method: "POST", url: "/students/me/career-scenarios/set-active" }
    ),
    activateResponse.res
  );
  assert.equal(activateResponse.statusCode, 200);
  assert.equal(activateResponse.json.scenario.careerScenarioId, duplicateId);

  const activeResponse = createResponseFactory();
  await studentCareerScenarioActiveRoute(
    createAuthedRequest("studentMaya", undefined, {
      method: "GET",
      url: "/students/me/career-scenarios/active",
    }),
    activeResponse.res
  );
  assert.equal(activeResponse.statusCode, 200);
  assert.equal(activeResponse.json.activeScenario.careerScenarioId, duplicateId);
  assert.equal(activeResponse.json.activeScenario.actionItems.length > 0, true);

  const deleteResponse = createResponseFactory();
  await studentCareerScenarioDeleteRoute(
    createAuthedRequest(
      "studentMaya",
      { careerScenarioId: duplicateId },
      { method: "POST", url: "/students/me/career-scenarios/delete" }
    ),
    deleteResponse.res
  );
  assert.equal(deleteResponse.statusCode, 200);

  const remainingScenarios = await query<{ count: string }>(
    `select count(*)::text as count from career_scenarios where student_profile_id = $1 and deleted_at is null`,
    [SYNTHETIC_STUDENTS.maya.studentProfileId]
  );
  assert.equal(Number(remainingScenarios.rows[0].count) >= 1, true);

  const persistedActionItems = await query<{ count: string }>(
    `select count(*)::text as count from career_scenario_action_items where student_profile_id = $1`,
    [SYNTHETIC_STUDENTS.maya.studentProfileId]
  );
  assert.equal(Number(persistedActionItems.rows[0].count) >= 1, true);

  const studentExists = await query<{ count: string }>(
    `select count(*)::text as count from student_profiles where student_profile_id = $1`,
    [SYNTHETIC_STUDENTS.maya.studentProfileId]
  );
  assert.equal(studentExists.rows[0].count, "1");
});

test("career scenario names must stay unique per student among non-deleted scenarios", async () => {
  const first = createResponseFactory();
  await studentCareerScenarioCreateRoute(
    createAuthedRequest(
      "studentMaya",
      {
        scenarioName: "Quality analyst path",
        targetRole: "Quality Analyst",
      },
      { method: "POST", url: "/students/me/career-scenarios" }
    ),
    first.res
  );
  assert.equal(first.statusCode, 200);

  const duplicate = createResponseFactory();
  await studentCareerScenarioCreateRoute(
    createAuthedRequest(
      "studentMaya",
      {
        scenarioName: "Quality analyst path",
        targetRole: "Quality Analyst",
      },
      { method: "POST", url: "/students/me/career-scenarios" }
    ),
    duplicate.res
  );
  assert.equal(duplicate.statusCode, 400);
  assert.match(duplicate.json.message, /unique/i);
});

test("parent can view connected student scenarios and coach cannot see unrelated student scenarios", async () => {
  const studentCreate = createResponseFactory();
  await studentCareerScenarioCreateRoute(
    createAuthedRequest(
      "studentMaya",
      {
        scenarioName: "Healthcare analyst",
        targetRole: "Business Analyst",
        targetSector: "Healthcare",
      },
      { method: "POST", url: "/students/me/career-scenarios" }
    ),
    studentCreate.res
  );
  assert.equal(studentCreate.statusCode, 200);

  const parentActive = createResponseFactory();
  await parentCareerScenarioActiveRoute(
    createAuthedRequest("parentMaya", undefined, {
      method: "GET",
      url: "/parents/me/career-scenarios/active",
    }),
    parentActive.res
  );
  assert.equal(parentActive.statusCode, 200);
  assert.equal(parentActive.json.activeScenario.scenarioName, "Healthcare analyst");

  const coachForbidden = createResponseFactory();
  await coachCareerScenarioListRoute(
    createAuthedRequest("coachTaylor", undefined, {
      method: "GET",
      url: `/coaches/me/career-scenarios?studentProfileId=${encodeURIComponent("99999999-9999-4999-8999-999999999999")}`,
    }),
    coachForbidden.res
  );
  assert.equal(coachForbidden.statusCode, 403);
});

test("coach edit access is denied when the selected student relationship does not allow recommendations", async () => {
  const mayaRelationship = SYNTHETIC_COACH_RELATIONSHIPS.find((item) => item.key === "coachTaylor-maya");
  assert.ok(mayaRelationship);

  await query(
    `
    update coach_student_relationships
    set can_create_recommendations = false
    where coach_student_relationship_id = $1
    `,
    [mayaRelationship.relationshipId]
  );

  const coachCreate = createResponseFactory();
  await coachCareerScenarioCreateRoute(
    createAuthedRequest(
      "coachTaylor",
      {
        studentProfileId: SYNTHETIC_STUDENTS.maya.studentProfileId,
        scenarioName: "Coach blocked path",
        targetRole: "Analyst",
      },
      {
        method: "POST",
        url: `/coaches/me/career-scenarios?studentProfileId=${encodeURIComponent(
          SYNTHETIC_STUDENTS.maya.studentProfileId
        )}`,
      }
    ),
    coachCreate.res
  );

  assert.equal(coachCreate.statusCode, 403);
  assert.match(coachCreate.json.message, /edit access is not enabled/i);
});

test("relevant student-profile changes mark active scenarios as needs_rerun", async () => {
  const create = createResponseFactory();
  await studentCareerScenarioCreateRoute(
    createAuthedRequest(
      "studentMaya",
      {
        scenarioName: "Operations analyst",
        targetRole: "Operations Analyst",
        targetSector: "Operations",
      },
      { method: "POST", url: "/students/me/career-scenarios" }
    ),
    create.res
  );
  assert.equal(create.statusCode, 200);

  const profileUpdate = createResponseFactory();
  await studentProfileUpsertRoute(
    createAuthedRequest(
      "studentMaya",
      {
        schoolName: "Synthetic State University",
        expectedGraduationDate: "2027-05-15",
        majorPrimary: "Information Systems",
        preferredGeographies: ["Boston"],
        careerGoalSummary: "Updated for scenario rerun coverage.",
      },
      { method: "POST", url: "/students/me/profile" }
    ),
    profileUpdate.res
  );
  assert.equal(profileUpdate.statusCode, 200);

  const active = createResponseFactory();
  await studentCareerScenarioActiveRoute(
    createAuthedRequest("studentMaya", undefined, {
      method: "GET",
      url: "/students/me/career-scenarios/active",
    }),
    active.res
  );
  assert.equal(active.statusCode, 200);
  assert.equal(active.json.activeScenario.status, "needs_rerun");
});

function createResponseFactory() {
  return createResponse();
}
