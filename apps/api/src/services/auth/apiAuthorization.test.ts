import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findRouteRule, isPublicPath } from "./apiAuthorization";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.resolve(here, "../../server.ts");

function shouldRequireCentralCapability(pathname: string) {
  return (
    pathname.startsWith("/students/me/") ||
    pathname.startsWith("/parents/me/") ||
    pathname.startsWith("/coaches/me/") ||
    pathname.startsWith("/households/me/") ||
    pathname === "/auth/signup/create-household" ||
    pathname === "/auth/signup/request-household-access" ||
    pathname === "/auth/invitations/accept" ||
    pathname === "/admin/users" ||
    pathname === "/v1/briefs/live" ||
    pathname === "/v1/briefs/generate" ||
    pathname === "/v1/chat/scenario/live" ||
    pathname === "/v1/parents/me/briefs/latest" ||
    pathname === "/v1/academic/catalogs/ingest" ||
    pathname === "/v1/academic/institutions/search" ||
    pathname === "/v1/academic/institutions/bulk-upsert" ||
    pathname === "/v1/academic/directory/options" ||
    pathname === "/v1/market/diagnostics/role-mappings"
  );
}

test("central API capability map covers protected routes declared in server.ts", () => {
  const source = fs.readFileSync(serverPath, "utf8");
  const regex = /if\s*\(url === "([^"]+)"(?:\s*&&\s*req\.method === "([A-Z]+)")?/g;
  const discovered: Array<{ pathname: string; method: string | null }> = [];
  let match: RegExpExecArray | null = null;

  while ((match = regex.exec(source))) {
    const pathname = match[1];
    const method = match[2] || null;
    if (!shouldRequireCentralCapability(pathname) || isPublicPath(pathname)) {
      continue;
    }
    discovered.push({ pathname, method });
  }

  for (const entry of discovered) {
    const covered = entry.method
      ? !!findRouteRule(entry.method, entry.pathname)
      : ["GET", "POST", "PATCH"].some((method) => !!findRouteRule(method, entry.pathname));

    assert.ok(
      covered,
      `Expected centralized capability coverage for ${entry.method || "ANY"} ${entry.pathname}`
    );
  }
});
