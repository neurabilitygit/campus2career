import test, { after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { closeDbPool } from "../../apps/api/src/db/client";
import { CURRENT_INTRO_ONBOARDING_VERSION } from "../../packages/shared/src/contracts/introOnboarding";
import {
  authMeRoute,
  introOnboardingCompleteRoute,
  introOnboardingReplayRoute,
  introOnboardingSkipRoute,
} from "../../apps/api/src/routes/auth";
import { createAuthedRequest, createJsonRequest, createResponse } from "../fixtures/http";
import { resetSyntheticTestData, seedSyntheticTestData } from "../fixtures/seedSyntheticData";

process.env.ALLOW_DEMO_AUTH = "true";

beforeEach(async () => {
  await seedSyntheticTestData();
});

after(async () => {
  await resetSyntheticTestData();
  await closeDbPool();
});

test("first authenticated session for a new user returns intro onboarding as not started", async () => {
  const response = createResponse();

  await authMeRoute(
    createAuthedRequest("studentNova", undefined, {
      method: "GET",
      url: "/auth/me",
    }),
    response.res
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.json.context.introOnboardingStatus, "not_started");
  assert.equal(response.json.context.introOnboardingShouldAutoShow, true);
});

test("completing intro onboarding persists and prevents relaunch on the next login", async () => {
  const completeResponse = createResponse();
  await introOnboardingCompleteRoute(
    createAuthedRequest(
      "studentNova",
      { introOnboardingVersion: CURRENT_INTRO_ONBOARDING_VERSION },
      { method: "POST", url: "/auth/intro-onboarding/complete" }
    ),
    completeResponse.res
  );

  assert.equal(completeResponse.statusCode, 200);
  assert.equal(completeResponse.json.onboarding.introOnboardingStatus, "completed");

  const authResponse = createResponse();
  await authMeRoute(
    createAuthedRequest("studentNova", undefined, {
      method: "GET",
      url: "/auth/me",
    }),
    authResponse.res
  );

  assert.equal(authResponse.statusCode, 200);
  assert.equal(authResponse.json.context.introOnboardingStatus, "completed");
  assert.equal(authResponse.json.context.introOnboardingShouldAutoShow, false);
});

test("skipping intro onboarding persists and replay does not corrupt the stored state", async () => {
  const skipResponse = createResponse();
  await introOnboardingSkipRoute(
    createAuthedRequest(
      "studentNova",
      { introOnboardingVersion: CURRENT_INTRO_ONBOARDING_VERSION },
      { method: "POST", url: "/auth/intro-onboarding/skip" }
    ),
    skipResponse.res
  );

  assert.equal(skipResponse.statusCode, 200);
  assert.equal(skipResponse.json.onboarding.introOnboardingStatus, "skipped");

  const replayResponse = createResponse();
  await introOnboardingReplayRoute(
    createAuthedRequest("studentNova", {}, {
      method: "POST",
      url: "/auth/intro-onboarding/replay",
    }),
    replayResponse.res
  );

  assert.equal(replayResponse.statusCode, 200);
  assert.equal(replayResponse.json.replayAvailable, true);
  assert.equal(replayResponse.json.onboarding.introOnboardingStatus, "skipped");

  const authResponse = createResponse();
  await authMeRoute(
    createAuthedRequest("studentNova", undefined, {
      method: "GET",
      url: "/auth/me",
    }),
    authResponse.res
  );

  assert.equal(authResponse.statusCode, 200);
  assert.equal(authResponse.json.context.introOnboardingStatus, "skipped");
});

test("returning superuser can replay and complete intro onboarding without full context resolution", async () => {
  const replayResponse = createResponse();
  await introOnboardingReplayRoute(
    createAuthedRequest("adminEric", {}, {
      method: "POST",
      url: "/auth/intro-onboarding/replay",
    }),
    replayResponse.res
  );

  assert.equal(replayResponse.statusCode, 200);
  assert.equal(replayResponse.json.replayAvailable, true);

  const completeResponse = createResponse();
  await introOnboardingCompleteRoute(
    createAuthedRequest(
      "adminEric",
      { introOnboardingVersion: CURRENT_INTRO_ONBOARDING_VERSION },
      { method: "POST", url: "/auth/intro-onboarding/complete" }
    ),
    completeResponse.res
  );

  assert.equal(completeResponse.statusCode, 200);
  assert.equal(completeResponse.json.onboarding.introOnboardingStatus, "completed");

  const authResponse = createResponse();
  await authMeRoute(
    createAuthedRequest("adminEric", undefined, {
      method: "GET",
      url: "/auth/me",
    }),
    authResponse.res
  );

  assert.equal(authResponse.statusCode, 200);
  assert.equal(authResponse.json.context.isSuperAdmin, true);
});

test("returning superuser with a different upstream auth user id reuses the canonical Eric account", async () => {
  const replayResponse = createResponse();
  await introOnboardingReplayRoute(
    createJsonRequest({}, {
      method: "POST",
      url: "/auth/intro-onboarding/replay",
      headers: {
        "x-demo-user-id": "77777777-7777-4777-8777-777777777777",
        "x-demo-role-type": "student",
        "x-demo-email": "eric.bassman@gmail.com",
      },
    }),
    replayResponse.res
  );

  assert.equal(replayResponse.statusCode, 200);
  assert.equal(replayResponse.json.replayAvailable, true);

  const completeResponse = createResponse();
  await introOnboardingCompleteRoute(
    createJsonRequest(
      { introOnboardingVersion: CURRENT_INTRO_ONBOARDING_VERSION },
      {
        method: "POST",
        url: "/auth/intro-onboarding/complete",
        headers: {
          "x-demo-user-id": "77777777-7777-4777-8777-777777777777",
          "x-demo-role-type": "student",
          "x-demo-email": "eric.bassman@gmail.com",
        },
      }
    ),
    completeResponse.res
  );

  assert.equal(completeResponse.statusCode, 200);
  assert.equal(completeResponse.json.onboarding.introOnboardingStatus, "completed");

  const authResponse = createResponse();
  await authMeRoute(
    createJsonRequest(undefined, {
      method: "GET",
      url: "/auth/me",
      headers: {
        "x-demo-user-id": "77777777-7777-4777-8777-777777777777",
        "x-demo-role-type": "student",
        "x-demo-email": "eric.bassman@gmail.com",
      },
    }),
    authResponse.res
  );

  assert.equal(authResponse.statusCode, 200);
  assert.equal(authResponse.json.context.isSuperAdmin, true);
  assert.equal(authResponse.json.context.authenticatedUserId, "99999999-9999-4999-8999-999999999999");
});
