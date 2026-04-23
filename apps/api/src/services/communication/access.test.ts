import test from "node:test";
import assert from "node:assert/strict";
import {
  canAccessParentCommunication,
  canAccessStudentCommunication,
} from "./access";

test("canAccessParentCommunication only allows parent and admin roles", () => {
  assert.equal(canAccessParentCommunication("parent"), true);
  assert.equal(canAccessParentCommunication("admin"), true);
  assert.equal(canAccessParentCommunication("student"), false);
  assert.equal(canAccessParentCommunication("coach"), false);
});

test("canAccessStudentCommunication only allows student and admin roles", () => {
  assert.equal(canAccessStudentCommunication("student"), true);
  assert.equal(canAccessStudentCommunication("admin"), true);
  assert.equal(canAccessStudentCommunication("parent"), false);
  assert.equal(canAccessStudentCommunication("coach"), false);
});
