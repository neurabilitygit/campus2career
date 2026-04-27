import test from "node:test";
import assert from "node:assert/strict";
import {
  getStoredTestContextStudentProfileId,
  inferTestContextRoleFromBrowserState,
  inferTestContextRoleFromRoute,
  setStoredTestContextStudentProfileId,
} from "../../apps/web/src/lib/testContext";
import {
  SAVE_NAVIGATION_CURRENT_ROUTE_KEY,
  SAVE_NAVIGATION_PREVIOUS_ROUTE_KEY,
} from "../../apps/web/src/lib/saveNavigation";

function makeWindowWithSessionStorage(initialValues?: Record<string, string>) {
  const values = new Map<string, string>(Object.entries(initialValues || {}));
  return {
    sessionStorage: {
      getItem(key: string) {
        return values.has(key) ? values.get(key)! : null;
      },
      setItem(key: string, value: string) {
        values.set(key, value);
      },
      removeItem(key: string) {
        values.delete(key);
      },
      clear() {
        values.clear();
      },
    },
    localStorage: {
      getItem(key: string) {
        return values.has(key) ? values.get(key)! : null;
      },
      setItem(key: string, value: string) {
        values.set(key, value);
      },
      removeItem(key: string) {
        values.delete(key);
      },
      clear() {
        values.clear();
      },
    },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return true;
    },
  };
}

test("inferTestContextRoleFromRoute resolves role-specific routes and ignores shared routes", () => {
  assert.equal(inferTestContextRoleFromRoute("/student?section=strategy"), "student");
  assert.equal(inferTestContextRoleFromRoute("/parent"), "parent");
  assert.equal(inferTestContextRoleFromRoute("/coach"), "coach");
  assert.equal(inferTestContextRoleFromRoute("/career-scenarios"), null);
});

test("inferTestContextRoleFromBrowserState falls back to remembered role-specific routes", () => {
  const originalWindow = globalThis.window;
  (globalThis as typeof globalThis & { window: any }).window = makeWindowWithSessionStorage({
    [SAVE_NAVIGATION_CURRENT_ROUTE_KEY]: "/student?section=strategy",
    [SAVE_NAVIGATION_PREVIOUS_ROUTE_KEY]: "/admin",
  });

  try {
    assert.equal(inferTestContextRoleFromBrowserState("/career-scenarios"), "student");
  } finally {
    (globalThis as typeof globalThis & { window?: any }).window = originalWindow;
  }
});

test("inferTestContextRoleFromBrowserState prefers the current pathname when it is role-specific", () => {
  const originalWindow = globalThis.window;
  (globalThis as typeof globalThis & { window: any }).window = makeWindowWithSessionStorage({
    [SAVE_NAVIGATION_CURRENT_ROUTE_KEY]: "/parent",
    [SAVE_NAVIGATION_PREVIOUS_ROUTE_KEY]: "/student?section=strategy",
  });

  try {
    assert.equal(inferTestContextRoleFromBrowserState("/coach"), "coach");
  } finally {
    (globalThis as typeof globalThis & { window?: any }).window = originalWindow;
  }
});

test("test-context studentProfileId storage round-trips explicit preview selection", () => {
  const originalWindow = globalThis.window;
  (globalThis as typeof globalThis & { window: any }).window = makeWindowWithSessionStorage();

  try {
    assert.equal(getStoredTestContextStudentProfileId(), null);
    setStoredTestContextStudentProfileId("student-profile-123");
    assert.equal(getStoredTestContextStudentProfileId(), "student-profile-123");
    setStoredTestContextStudentProfileId(null);
    assert.equal(getStoredTestContextStudentProfileId(), null);
  } finally {
    (globalThis as typeof globalThis & { window?: any }).window = originalWindow;
  }
});
