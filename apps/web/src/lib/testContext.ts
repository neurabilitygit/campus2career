"use client";

export type TestContextRole = "student" | "parent" | "coach";

const STORAGE_KEY = "rising-senior:test-context-role";
const CHANGE_EVENT = "rising-senior:test-context-role-change";

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
