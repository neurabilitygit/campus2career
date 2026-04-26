import { AuthUserRepository } from "../../repositories/auth/authUserRepository";
import type { AuthenticatedUser } from "../../types/auth";

const repo = new AuthUserRepository();

export async function syncAuthenticatedUser(user: AuthenticatedUser): Promise<string> {
  if (!user.email) return user.userId;

  return repo.upsertUserFromAuth({
    userId: user.userId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    preferredName: user.preferredName,
    roleType: user.roleType,
  });
}
