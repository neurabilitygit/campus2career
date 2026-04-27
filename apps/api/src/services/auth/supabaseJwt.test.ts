import test from "node:test";
import assert from "node:assert/strict";
import { mapSupabaseRole } from "./supabaseJwt";

test("mapSupabaseRole ignores user_metadata.role", () => {
  assert.equal(
    mapSupabaseRole({
      user_metadata: { role: "admin" },
      app_metadata: {},
      role: "authenticated",
    }),
    "student"
  );
});

test("mapSupabaseRole still honors trusted app metadata role", () => {
  assert.equal(
    mapSupabaseRole({
      user_metadata: { role: "admin" },
      app_metadata: { role: "parent" },
      role: "authenticated",
    }),
    "parent"
  );
});
