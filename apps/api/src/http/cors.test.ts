import test from "node:test";
import assert from "node:assert/strict";
import { resolveAllowedOrigins, resolveCorsOrigin } from "./cors";

test("resolveAllowedOrigins combines configured and local development origins", () => {
  const origins = resolveAllowedOrigins({
    API_ALLOWED_ORIGINS: "https://app.example.com, https://admin.example.com ",
    APP_BASE_URL: "https://workspace.example.com",
    NEXT_PUBLIC_APP_URL: "https://web.example.com",
    NODE_ENV: "development",
  } as NodeJS.ProcessEnv);

  assert.deepEqual(origins, [
    "https://app.example.com",
    "https://admin.example.com",
    "https://workspace.example.com",
    "https://web.example.com",
    "http://localhost:3000",
    "http://localhost:3100",
  ]);
});

test("resolveCorsOrigin returns the exact origin only when it is allowlisted", () => {
  const env = {
    API_ALLOWED_ORIGINS: "https://app.example.com",
    NODE_ENV: "production",
  } as NodeJS.ProcessEnv;

  assert.equal(resolveCorsOrigin({ origin: "https://app.example.com" }, env), "https://app.example.com");
  assert.equal(resolveCorsOrigin({ origin: "https://evil.example.com" }, env), null);
});

test("resolveCorsOrigin stays neutral for requests without an origin header", () => {
  assert.equal(resolveCorsOrigin({}, { NODE_ENV: "production" } as NodeJS.ProcessEnv), null);
});

