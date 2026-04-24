import test from "node:test";
import assert from "node:assert/strict";
import {
  SAVE_NAVIGATION_CURRENT_ROUTE_KEY,
  SAVE_NAVIGATION_PREVIOUS_ROUTE_KEY,
  buildAppRoute,
  rememberSaveNavigationRoute,
  resolveSaveReturnRoute,
} from "../../apps/web/src/lib/saveNavigation";

function makeSessionStorage() {
  const values = new Map<string, string>();
  return {
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
  };
}

test("buildAppRoute keeps the query string when present", () => {
  assert.equal(
    buildAppRoute("/student", new URLSearchParams("section=evidence")),
    "/student?section=evidence"
  );
  assert.equal(buildAppRoute("/student", null), "/student");
});

test("rememberSaveNavigationRoute tracks current and previous routes", () => {
  const originalWindow = globalThis.window;
  const sessionStorage = makeSessionStorage();
  (globalThis as typeof globalThis & { window: any }).window = {
    sessionStorage,
  };

  try {
    rememberSaveNavigationRoute("/student");
    rememberSaveNavigationRoute("/profile");

    assert.equal(
      sessionStorage.getItem(SAVE_NAVIGATION_CURRENT_ROUTE_KEY),
      "/profile"
    );
    assert.equal(
      sessionStorage.getItem(SAVE_NAVIGATION_PREVIOUS_ROUTE_KEY),
      "/student"
    );
  } finally {
    (globalThis as typeof globalThis & { window?: any }).window = originalWindow;
  }
});

test("resolveSaveReturnRoute prefers the remembered previous route", () => {
  const originalWindow = globalThis.window;
  const sessionStorage = makeSessionStorage();
  sessionStorage.setItem(SAVE_NAVIGATION_PREVIOUS_ROUTE_KEY, "/parent");
  (globalThis as typeof globalThis & { window: any }).window = {
    sessionStorage,
  };

  try {
    assert.equal(resolveSaveReturnRoute("/parent/communication", "/parent"), "/parent");
    assert.equal(resolveSaveReturnRoute("/parent", "/student"), "/student");
  } finally {
    (globalThis as typeof globalThis & { window?: any }).window = originalWindow;
  }
});

test("resolveSaveReturnRoute ignores generic launch pages", () => {
  const originalWindow = globalThis.window;
  const sessionStorage = makeSessionStorage();
  sessionStorage.setItem(SAVE_NAVIGATION_PREVIOUS_ROUTE_KEY, "/");
  (globalThis as typeof globalThis & { window: any }).window = {
    sessionStorage,
  };

  try {
    assert.equal(
      resolveSaveReturnRoute("/onboarding/sectors", "/student?section=strategy"),
      "/student?section=strategy"
    );
  } finally {
    (globalThis as typeof globalThis & { window?: any }).window = originalWindow;
  }
});
