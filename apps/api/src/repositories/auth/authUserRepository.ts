import { query } from "../../db/client";
import type { IntroOnboardingState } from "../../../../../packages/shared/src/contracts/introOnboarding";

export interface UpsertUserInput {
  userId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  preferredName?: string | null;
  roleType?: "student" | "parent" | "coach" | "admin";
}

export class AuthUserRepository {
  async upsertUserFromAuth(input: UpsertUserInput): Promise<void> {
    await query(
      `
      insert into users (
        user_id,
        role_type,
        first_name,
        last_name,
        preferred_name,
        email,
        account_status,
        created_at,
        updated_at
      ) values ($1,$2,'Unknown','User',$3,$4,'active',now(),now())
      on conflict (user_id) do nothing
      `,
      [
        input.userId,
        input.roleType || "student",
        input.preferredName || null,
        input.email,
      ]
    );

    await query(
      `
      update users
      set
        email = $2,
        role_type = $3,
        first_name = coalesce($4, first_name),
        last_name = coalesce($5, last_name),
        preferred_name = coalesce($6, preferred_name),
        updated_at = now()
      where user_id = $1
      `,
      [
        input.userId,
        input.email,
        input.roleType || "student",
        input.firstName ?? null,
        input.lastName ?? null,
        input.preferredName ?? null,
      ]
    );
  }

  async getIntroOnboardingState(userId: string): Promise<IntroOnboardingState | null> {
    const result = await query<IntroOnboardingState>(
      `
      select
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

  async markIntroOnboardingCompleted(userId: string, version: number) {
    await query(
      `
      update users
      set
        has_completed_intro_onboarding = true,
        intro_onboarding_completed_at = now(),
        intro_onboarding_skipped_at = null,
        intro_onboarding_version = $2,
        intro_onboarding_status = 'completed',
        updated_at = now()
      where user_id = $1
      `,
      [userId, version]
    );
  }

  async markIntroOnboardingSkipped(userId: string, version: number) {
    await query(
      `
      update users
      set
        has_completed_intro_onboarding = false,
        intro_onboarding_completed_at = null,
        intro_onboarding_skipped_at = now(),
        intro_onboarding_version = $2,
        intro_onboarding_status = 'skipped',
        updated_at = now()
      where user_id = $1
      `,
      [userId, version]
    );
  }
}
