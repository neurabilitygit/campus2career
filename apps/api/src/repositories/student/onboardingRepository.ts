import crypto from "node:crypto";
import { executeQuery, query, type DbExecutor } from "../../db/client";

export interface OnboardingStateRow {
  onboarding_state_id: string;
  student_profile_id: string;
  profile_completed: boolean;
  sectors_completed: boolean;
  uploads_completed: boolean;
  network_completed: boolean;
  deadlines_completed: boolean;
  onboarding_completed: boolean;
  first_diagnostic_generated: boolean;
}

function stableUuidFromKey(key: string): string {
  const hex = crypto.createHash("sha256").update(key).digest("hex").slice(0, 32);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

export class OnboardingRepository {
  async getState(studentProfileId: string): Promise<OnboardingStateRow | null> {
    const result = await query<OnboardingStateRow>(
      `
      select *
      from onboarding_states
      where student_profile_id = $1
      `,
      [studentProfileId]
    );
    return result.rows[0] || null;
  }

  async ensureState(studentProfileId: string, onboardingStateId: string, executor?: DbExecutor) {
    await executeQuery(
      executor,
      `
      insert into onboarding_states (
        onboarding_state_id,
        student_profile_id,
        created_at,
        updated_at
      ) values ($1,$2,now(),now())
      on conflict (student_profile_id) do nothing
      `,
      [onboardingStateId, studentProfileId]
    );
  }

  async updateFlags(studentProfileId: string, flags: Record<string, boolean>, executor?: DbExecutor) {
    const allowed = [
      "profile_completed",
      "sectors_completed",
      "uploads_completed",
      "network_completed",
      "deadlines_completed",
      "onboarding_completed",
      "first_diagnostic_generated",
    ];
    const pairs = Object.entries(flags).filter(([k]) => allowed.includes(k));
    if (!pairs.length) return;

    const sets = pairs.map(([k], idx) => `${k} = $${idx + 2}`);
    const values = pairs.map(([, v]) => v);

    await executeQuery(
      executor,
      `
      update onboarding_states
      set ${sets.join(", ")},
          updated_at = now()
      where student_profile_id = $1
      `,
      [studentProfileId, ...values]
    );
  }

  async replaceSectorSelections(studentProfileId: string, selections: string[]) {
    await query(
      `
      delete from student_sector_selections
      where student_profile_id = $1
      `,
      [studentProfileId]
    );

    for (const sector of selections) {
      const selectionId = stableUuidFromKey(`${studentProfileId}:${sector}`);
      await query(
        `
        insert into student_sector_selections (
          student_sector_selection_id,
          student_profile_id,
          sector_cluster,
          created_at
        ) values ($1,$2,$3,now())
        on conflict (student_profile_id, sector_cluster) do nothing
        `,
        [selectionId, studentProfileId, sector]
      );
    }
  }
}
