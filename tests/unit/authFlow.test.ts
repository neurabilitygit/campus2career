import test from "node:test";
import assert from "node:assert/strict";
import {
  consumeStoredAuthReturnTo,
  getCurrentAppRoute,
  readRememberedGoogleAccount,
  setStoredAuthReturnTo,
  writeRememberedGoogleAccount,
} from "../../apps/web/src/lib/authFlow";

function makeWindow(initialLocalValues?: Record<string, string>, initialSessionValues?: Record<string, string>) {
  const localValues = new Map<string, string>(Object.entries(initialLocalValues || {}));
  const sessionValues = new Map<string, string>(Object.entries(initialSessionValues || {}));

  return {
    location: {
      pathname: "/student",
      search: "?section=strategy",
    },
    localStorage: {
      getItem(key: string) {
        return localValues.has(key) ? localValues.get(key)! : null;
      },
      setItem(key: string, value: string) {
        localValues.set(key, value);
      },
      removeItem(key: string) {
        localValues.delete(key);
      },
    },
    sessionStorage: {
      getItem(key: string) {
        return sessionValues.has(key) ? sessionValues.get(key)! : null;
      },
      setItem(key: string, value: string) {
        sessionValues.set(key, value);
      },
      removeItem(key: string) {
        sessionValues.delete(key);
      },
    },
  };
}

test("remembered Google account storage round-trips name, email, and avatar", () => {
  const originalWindow = globalThis.window;
  (globalThis as typeof globalThis & { window: any }).window = makeWindow();

  try {
    writeRememberedGoogleAccount({
      email: "eric.bassman@gmail.com",
      fullName: "Eric Bass",
      avatarUrl: "https://example.com/avatar.png",
    });

    assert.deepEqual(readRememberedGoogleAccount(), {
      email: "eric.bassman@gmail.com",
      fullName: "Eric Bass",
      avatarUrl: "https://example.com/avatar.png",
    });
  } finally {
    (globalThis as typeof globalThis & { window?: any }).window = originalWindow;
  }
});

test("auth return-to storage ignores invalid routes and consumes a valid saved route once", () => {
  const originalWindow = globalThis.window;
  (globalThis as typeof globalThis & { window: any }).window = makeWindow();

  try {
    setStoredAuthReturnTo("https://evil.example.com");
    assert.equal(consumeStoredAuthReturnTo("/signup"), "/signup");

    setStoredAuthReturnTo("/coach?studentProfileId=abc");
    assert.equal(consumeStoredAuthReturnTo("/signup"), "/coach?studentProfileId=abc");
    assert.equal(consumeStoredAuthReturnTo("/signup"), "/signup");
  } finally {
    (globalThis as typeof globalThis & { window?: any }).window = originalWindow;
  }
});

test("getCurrentAppRoute returns the live pathname and query string", () => {
  const originalWindow = globalThis.window;
  (globalThis as typeof globalThis & { window: any }).window = makeWindow();

  try {
    assert.equal(getCurrentAppRoute(), "/student?section=strategy");
  } finally {
    (globalThis as typeof globalThis & { window?: any }).window = originalWindow;
  }
});
