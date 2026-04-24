export interface AuthenticatedUser {
  userId: string;
  roleType: "student" | "parent" | "coach" | "admin";
  email?: string;
  firstName?: string | null;
  lastName?: string | null;
  preferredName?: string | null;
}
