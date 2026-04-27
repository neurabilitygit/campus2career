import test, { after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { closeDbPool, query } from "../../apps/api/src/db/client";
import { buildStudentScoringInput } from "../../apps/api/src/services/student/aggregateStudentContext";
import { JobTargetRepository } from "../../apps/api/src/repositories/career/jobTargetRepository";
import { resetSyntheticTestData, seedSyntheticTestData } from "../fixtures/seedSyntheticData";
import { SYNTHETIC_STUDENTS } from "../synthetic/scenarios";

beforeEach(async () => {
  await seedSyntheticTestData();
});

after(async () => {
  await resetSyntheticTestData();
  await closeDbPool();
});

test("buildStudentScoringInput does not fabricate AI fluency or count a resume as project proof", async () => {
  const initial = await buildStudentScoringInput(SYNTHETIC_STUDENTS.maya.studentProfileId);

  assert.equal(initial.signals.aiToolComfortLevel, undefined);
  assert.equal(initial.signals.hasIndependentProjectBySeniorYear, false);

  await query(
    `
    insert into academic_artifacts (
      academic_artifact_id,
      student_profile_id,
      artifact_type,
      file_uri,
      source_label,
      uploaded_at,
      parsed_status,
      extracted_summary,
      parse_truth_status,
      parse_confidence_label,
      extraction_method,
      parse_notes
    ) values (
      $1,$2,'resume','synthetic://resume/maya-latest.pdf','Resume refresh',now(),
      'parsed','Updated resume with research assistant bullets.','direct','high','plain_text',null
    )
    `,
    ["11111111-3333-4333-8333-111111111111", SYNTHETIC_STUDENTS.maya.studentProfileId]
  );

  const withResumeOnly = await buildStudentScoringInput(SYNTHETIC_STUDENTS.maya.studentProfileId);

  assert.equal(withResumeOnly.signals.aiToolComfortLevel, undefined);
  assert.equal(withResumeOnly.signals.hasIndependentProjectBySeniorYear, false);
});

test("buildStudentScoringInput persists a normalized primary target from career-goal intent before sector fallback", async () => {
  const repo = new JobTargetRepository();

  const before = await repo.getPrimaryForStudent(SYNTHETIC_STUDENTS.leo.studentProfileId);
  assert.equal(before, null);

  const scoringInput = await buildStudentScoringInput(SYNTHETIC_STUDENTS.leo.studentProfileId);

  assert.notEqual(scoringInput.targetResolution?.resolutionKind, "selected_sector_mapping");
  assert.equal(scoringInput.targetRoleFamily, "software developer");
  assert.equal(scoringInput.targetResolution?.sourceLabel, "normalized primary job target (deterministic)");

  const persisted = await repo.getPrimaryForStudent(SYNTHETIC_STUDENTS.leo.studentProfileId);
  assert.ok(persisted);
  assert.equal(persisted?.normalizedRoleFamily, "software developer");
  assert.equal(persisted?.normalizationSource, "deterministic");
  assert.equal(persisted?.isPrimary, true);
});
