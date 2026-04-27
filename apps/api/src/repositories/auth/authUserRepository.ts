import { query } from "../../db/client";
import type { IntroOnboardingState } from "../../../../../packages/shared/src/contracts/introOnboarding";

export interface UpsertUserInput {
  userId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  preferredName?: string | null;
  roleType?: "student" | "parent" | "coach" | "admin";
  authProvider?: string | null;
}

export class AuthUserRepository {
  async upsertUserFromAuth(input: UpsertUserInput): Promise<string> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const isEricBass = normalizedEmail === "eric.bassman@gmail.com";
    const resolvedRoleType = isEricBass ? "admin" : input.roleType || "student";
    const defaultAccountStatus = isEricBass ? "active" : "pending_setup";
    const existingByEmail = await query<{ userId: string }>(
      `
      select user_id as "userId"
      from users
      where lower(email) = $1
      limit 1
      `,
      [normalizedEmail]
    );
    const canonicalUserId = existingByEmail.rows[0]?.userId ?? input.userId;

    if (canonicalUserId !== input.userId) {
      await query(
        `
        update users
        set
          email = $2,
          role_type = $3,
          first_name = coalesce($4, first_name),
          last_name = coalesce($5, last_name),
          preferred_name = coalesce($6, preferred_name),
          auth_provider = coalesce($7, auth_provider),
          is_super_admin = case when $8 then true else is_super_admin end,
          account_status = case
            when account_status = 'active' then account_status
            when $8 then 'active'
            else account_status
          end,
          updated_at = now()
        where user_id = $1
        `,
        [
          canonicalUserId,
          input.email,
          resolvedRoleType,
          input.firstName ?? null,
          input.lastName ?? null,
          input.preferredName ?? null,
          input.authProvider || "supabase_google",
          isEricBass,
        ]
      );

      return canonicalUserId;
    }

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
        account_status,
        created_at,
        updated_at
      ) values ($1,$2,'Unknown','User',$3,$4,$5,$6,$7,now(),now())
      on conflict (user_id) do nothing
      `,
      [
        canonicalUserId,
        resolvedRoleType,
        input.preferredName || null,
        input.email,
        input.authProvider || "supabase_google",
        isEricBass,
        defaultAccountStatus,
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
        auth_provider = coalesce($7, auth_provider),
        is_super_admin = case when $8 then true else is_super_admin end,
        account_status = case
          when account_status = 'active' then account_status
          when $8 then 'active'
          else account_status
        end,
        updated_at = now()
      where user_id = $1
      `,
      [
        canonicalUserId,
        input.email,
        resolvedRoleType,
        input.firstName ?? null,
        input.lastName ?? null,
        input.preferredName ?? null,
        input.authProvider || "supabase_google",
        isEricBass,
      ]
    );

    return canonicalUserId;
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
