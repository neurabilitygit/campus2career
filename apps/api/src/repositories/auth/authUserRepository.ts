import { query } from "../../db/client";

export interface UpsertUserInput {
  userId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
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
        email,
        account_status,
        created_at,
        updated_at
      ) values ($1,$2,$3,$4,$5,'active',now(),now())
      on conflict (user_id) do update set
        email = excluded.email,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        role_type = excluded.role_type,
        updated_at = now()
      `,
      [
        input.userId,
        input.roleType || "student",
        input.firstName || "Unknown",
        input.lastName || "User",
        input.email,
      ]
    );
  }
}
