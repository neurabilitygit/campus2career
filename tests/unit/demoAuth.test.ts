import test from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_AUTH_STORAGE_KEY,
  clearStoredDemoAuth,
  demoAuthHeaders,
  parseDemoAuthState,
  writeStoredDemoAuth,
} from "../../apps/web/src/lib/demoAuth";

function memoryStorage() {
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
  };
}

test("parseDemoAuthState accepts a valid serialized demo auth record", () => {
  const parsed = parseDemoAuthState(
    JSON.stringify({
      userId: "11111111-1111-4111-8111-111111111111",
      roleType: "student",
      email: "maya@synthetic.local",
    })
  );

  assert.deepEqual(parsed, {
    userId: "11111111-1111-4111-8111-111111111111",
    roleType: "student",
    email: "maya@synthetic.local",
  });
});

test("parseDemoAuthState rejects malformed or incomplete values", () => {
  assert.equal(parseDemoAuthState("not-json"), null);
  assert.equal(parseDemoAuthState(JSON.stringify({ roleType: "student" })), null);
  assert.equal(
    parseDemoAuthState(
      JSON.stringify({
        userId: "11111111-1111-4111-8111-111111111111",
        roleType: "observer",
        email: "maya@synthetic.local",
      })
    ),
    null
  );
});

test("writeStoredDemoAuth and clearStoredDemoAuth use the shared storage key", () => {
  const storage = memoryStorage();
  writeStoredDemoAuth(
    {
      userId: "11111111-1111-4111-8111-111111111111",
      roleType: "coach",
      email: "coach@synthetic.local",
    },
    storage
  );

  assert.ok(storage.getItem(DEMO_AUTH_STORAGE_KEY));
  clearStoredDemoAuth(storage);
  assert.equal(storage.getItem(DEMO_AUTH_STORAGE_KEY), null);
});

test("demoAuthHeaders returns the expected API header map", () => {
  assert.deepEqual(
    demoAuthHeaders({
      userId: "11111111-1111-4111-8111-111111111111",
      roleType: "parent",
      email: "parent@synthetic.local",
    }),
    {
      "x-demo-user-id": "11111111-1111-4111-8111-111111111111",
      "x-demo-role-type": "parent",
      "x-demo-email": "parent@synthetic.local",
    }
  );
});
