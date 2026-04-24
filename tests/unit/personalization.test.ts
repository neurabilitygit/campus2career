import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDirectAddressName,
  buildFullName,
  formatNamedReference,
} from "../../apps/web/src/lib/personalization";

test("buildDirectAddressName prefers preferred name for direct address", () => {
  const result = buildDirectAddressName({
    preferredName: "MJ",
    firstName: "Maya",
    lastName: "Rivera",
    fallback: "you",
  });

  assert.equal(result, "MJ");
});

test("formatNamedReference falls back gracefully when no user name is known", () => {
  const result = formatNamedReference(
    {
      preferredName: null,
      firstName: null,
      lastName: null,
    },
    { fallback: "your student", possessive: true }
  );

  assert.equal(result, "your student's");
});

test("buildFullName joins first and last names when present", () => {
  const result = buildFullName({
    firstName: "Taylor",
    lastName: "Brooks",
    fallback: "Coach",
  });

  assert.equal(result, "Taylor Brooks");
});
