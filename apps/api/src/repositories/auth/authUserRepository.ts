import { query } from "../../db/client";

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
}
