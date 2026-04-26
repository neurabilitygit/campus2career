"use client";

import { workspaceHrefForRole, type WorkspaceRole } from "../../lib/workspaceAccess";

export type BottomBackAction = {
  href: string;
  label: string;
  ariaLabel?: string;
};

function workspaceBackAction(role: WorkspaceRole): BottomBackAction {
  const href = workspaceHrefForRole(role);
  if (role === "parent") {
    return { href, label: "Back to parent dashboard" };
  }
  if (role === "coach") {
    return { href, label: "Back to coach dashboard" };
  }
  if (role === "admin") {
    return { href, label: "Back to administration" };
  }
  if (role === "student") {
    return { href, label: "Back to dashboard" };
  }
  return { href, label: "Back to home" };
}

export function buildBottomBackAction(args: {
  pathname: string;
  role: WorkspaceRole;
}): BottomBackAction | null {
  const { pathname, role } = args;

  if (
    pathname === "/" ||
    pathname === "/app" ||
    pathname === "/student" ||
    pathname === "/parent" ||
    pathname === "/coach" ||
    pathname === "/admin" ||
    pathname === "/career-scenarios"
  ) {
    return null;
  }

  if (pathname === "/help" || pathname === "/household-setup" || pathname === "/profile" || pathname === "/communication") {
    return workspaceBackAction(role);
  }

  if (pathname === "/signup") {
    return role ? workspaceBackAction(role) : { href: "/", label: "Back to home" };
  }

  if (pathname === "/onboarding") {
    return workspaceBackAction(role);
  }

  if (pathname.startsWith("/onboarding/")) {
    return { href: "/onboarding", label: "Back to onboarding" };
  }

  if (pathname === "/uploads") {
    return workspaceBackAction(role);
  }

  if (pathname.startsWith("/uploads/")) {
    return { href: "/uploads", label: "Back to documents" };
  }

  if (pathname === "/parent/onboarding" || pathname === "/parent/history" || pathname === "/parent/communication") {
    return { href: "/parent", label: "Back to parent dashboard" };
  }

  if (pathname === "/student/messages") {
    return { href: "/student", label: "Back to dashboard" };
  }

  if (pathname === "/diagnostic") {
    return { href: "/coach", label: "Back to coach dashboard" };
  }

  return null;
}
