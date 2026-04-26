"use client";

export type WorkspaceRole = "student" | "parent" | "coach" | "admin" | null;

export function workspaceHrefForRole(role: WorkspaceRole): string {
  if (role === "student") return "/student?section=strategy";
  if (role === "parent") return "/parent";
  if (role === "coach") return "/coach";
  if (role === "admin") return "/admin";
  return "/";
}

export function workspaceLabelForRole(role: WorkspaceRole): string {
  if (role === "student") return "Student workspace";
  if (role === "parent") return "Parent workspace";
  if (role === "coach") return "Coach workspace";
  if (role === "admin") return "Admin workspace";
  return "Home";
}

export function shouldRedirectWorkspaceRole(args: {
  authenticatedRole: WorkspaceRole;
  expectedRoles: string[];
}): boolean {
  if (!args.authenticatedRole) return false;
  return !args.expectedRoles.includes(args.authenticatedRole);
}
