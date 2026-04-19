export interface AuthenticatedUser {
  userId: string;
  roleType: "student" | "parent" | "coach" | "admin";
  email?: string;
}
