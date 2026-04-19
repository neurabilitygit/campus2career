import { query } from "../../db/client";

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

  async ensureState(studentProfileId: string, onboardingStateId: string) {
    await query(
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

  async updateFlags(studentProfileId: string, flags: Record<string, boolean>) {
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

    await query(
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
      await query(
        `
        insert into student_sector_selections (
          student_sector_selection_id,
          student_profile_id,
          sector_cluster,
          created_at
        ) values (md5($1 || ':' || $2)::uuid, $1, $2, now())
        on conflict (student_profile_id, sector_cluster) do nothing
        `,
        [studentProfileId, sector]
      );
    }
  }
}
