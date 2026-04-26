import test from "node:test";
import assert from "node:assert/strict";
import { AppError } from "../utils/appError";
import { shouldLogServerError } from "../utils/errorLogging";

test("shouldLogServerError suppresses expected 4xx AppErrors", () => {
  const error = new AppError({
    status: 400,
    code: "target_role_unresolved",
    message: "Target role could not be resolved.",
  });

  assert.equal(shouldLogServerError(error), false);
});

test("shouldLogServerError still logs 5xx AppErrors and unknown failures", () => {
  const appError = new AppError({
    status: 500,
    code: "boom",
    message: "Boom",
  });

  assert.equal(shouldLogServerError(appError), true);
  assert.equal(shouldLogServerError(new Error("plain failure")), true);
});
