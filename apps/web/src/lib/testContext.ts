"use client";

import {
  SAVE_NAVIGATION_CURRENT_ROUTE_KEY,
  SAVE_NAVIGATION_PREVIOUS_ROUTE_KEY,
} from "./saveNavigation";

export type TestContextRole = "student" | "parent" | "coach";

const STORAGE_KEY = "rising-senior:test-context-role";
const CHANGE_EVENT = "rising-senior:test-context-role-change";
const STUDENT_STORAGE_KEY = "rising-senior:test-context-student-profile-id";
const STUDENT_CHANGE_EVENT = "rising-senior:test-context-student-profile-id-change";

function isTestContextRole(value: string | null): value is TestContextRole {
  return value === "student" || value === "parent" || value === "coach";
}

export function getStoredTestContextRole(): TestContextRole | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(STORAGE_KEY);
  return isTestContextRole(value) ? value : null;
}

export function inferTestContextRoleFromPath(pathname: string | null | undefined): TestContextRole | null {
  if (!pathname) {
    return null;
  }

  if (pathname === "/student" || pathname.startsWith("/student/")) {
    return "student";
  }

  if (pathname === "/parent" || pathname.startsWith("/parent/")) {
    return "parent";
  }

  if (pathname === "/coach" || pathname.startsWith("/coach/")) {
    return "coach";
  }

  return null;
}

function pathFromRoute(route: string | null | undefined): string | null {
  if (!route) {
    return null;
  }

  const trimmed = route.trim();
  if (!trimmed.startsWith("/")) {
    return null;
  }

  return trimmed.split("?")[0] || "/";
}

export function inferTestContextRoleFromRoute(route: string | null | undefined): TestContextRole | null {
  return inferTestContextRoleFromPath(pathFromRoute(route));
}

export function inferTestContextRoleFromBrowserState(
  pathname: string | null | undefined
): TestContextRole | null {
  const directRole = inferTestContextRoleFromPath(pathname);
  if (directRole || typeof window === "undefined") {
    return directRole;
  }

  const rememberedCurrentRole = inferTestContextRoleFromRoute(
    window.sessionStorage.getItem(SAVE_NAVIGATION_CURRENT_ROUTE_KEY)
  );
  if (rememberedCurrentRole) {
    return rememberedCurrentRole;
  }

  return inferTestContextRoleFromRoute(
    window.sessionStorage.getItem(SAVE_NAVIGATION_PREVIOUS_ROUTE_KEY)
  );
}

export function getStoredTestContextStudentProfileId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(STUDENT_STORAGE_KEY)?.trim();
  return value || null;
}

export function setStoredTestContextRole(role: TestContextRole | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (role) {
    window.localStorage.setItem(STORAGE_KEY, role);
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }

  window.dispatchEvent(
    new CustomEvent(CHANGE_EVENT, {
      detail: { role },
    })
  );
}

export function setStoredTestContextStudentProfileId(studentProfileId: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (studentProfileId?.trim()) {
    window.localStorage.setItem(STUDENT_STORAGE_KEY, studentProfileId.trim());
  } else {
    window.localStorage.removeItem(STUDENT_STORAGE_KEY);
  }

  window.dispatchEvent(
    new CustomEvent(STUDENT_CHANGE_EVENT, {
      detail: { studentProfileId: studentProfileId?.trim() || null },
    })
  );
}

export function subscribeToTestContextRole(
  callback: (role: TestContextRole | null) => void
) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = () => {
    callback(getStoredTestContextRole());
  };

  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener("storage", handler);

  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

export function subscribeToTestContextStudentProfileId(
  callback: (studentProfileId: string | null) => void
) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = () => {
    callback(getStoredTestContextStudentProfileId());
  };

  window.addEventListener(STUDENT_CHANGE_EVENT, handler);
  window.addEventListener("storage", handler);

  return () => {
    window.removeEventListener(STUDENT_CHANGE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}
