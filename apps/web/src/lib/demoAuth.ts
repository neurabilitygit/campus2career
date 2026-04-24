"use client";

export type DemoAuthRole = "student" | "parent" | "coach" | "admin";

export type DemoAuthState = {
  userId: string;
  roleType: DemoAuthRole;
  email: string;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const DEMO_AUTH_STORAGE_KEY = "rising-senior:test-demo-auth";

function isDemoAuthRole(value: string | null | undefined): value is DemoAuthRole {
  return value === "student" || value === "parent" || value === "coach" || value === "admin";
}

export function isDemoAuthEnabled() {
  return process.env.NEXT_PUBLIC_ENABLE_TEST_DEMO_AUTH === "true";
}

export function parseDemoAuthState(value: string | null | undefined): DemoAuthState | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<DemoAuthState>;
    if (
      typeof parsed.userId === "string" &&
      typeof parsed.email === "string" &&
      isDemoAuthRole(parsed.roleType)
    ) {
      return {
        userId: parsed.userId,
        roleType: parsed.roleType,
        email: parsed.email,
      };
    }
  } catch {
    return null;
  }

  return null;
}

function getStorage(storage?: StorageLike | null): StorageLike | null {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function readStoredDemoAuth(storage?: StorageLike | null): DemoAuthState | null {
  if (!isDemoAuthEnabled()) return null;
  const target = getStorage(storage);
  if (!target) return null;
  return parseDemoAuthState(target.getItem(DEMO_AUTH_STORAGE_KEY));
}

export function writeStoredDemoAuth(state: DemoAuthState, storage?: StorageLike | null) {
  const target = getStorage(storage);
  if (!target) return;
  target.setItem(DEMO_AUTH_STORAGE_KEY, JSON.stringify(state));
}

export function clearStoredDemoAuth(storage?: StorageLike | null) {
  const target = getStorage(storage);
  if (!target) return;
  target.removeItem(DEMO_AUTH_STORAGE_KEY);
}

export function demoAuthHeaders(state: DemoAuthState) {
  return {
    "x-demo-user-id": state.userId,
    "x-demo-role-type": state.roleType,
    "x-demo-email": state.email,
  } as const;
}
