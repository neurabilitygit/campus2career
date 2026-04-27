import test from "node:test";
import assert from "node:assert/strict";
import { isReturningSuperUserIdentity } from "./superAdminIdentity";

test("super-admin identity requires the exact trusted email", () => {
  assert.equal(
    isReturningSuperUserIdentity({
      email: "eric.bassman@gmail.com",
      firstName: "Someone",
      lastName: "Else",
      preferredName: "Not Eric",
    }),
    true
  );

  assert.equal(
    isReturningSuperUserIdentity({
      email: "ordinary.user@example.com",
      firstName: "Eric",
      lastName: "Bass",
      preferredName: "Eric",
    }),
    false
  );
});
