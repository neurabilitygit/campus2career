import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { createInvitationEmailService } from "./invitationEmailService";

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

afterEach(() => {
  process.env = { ...originalEnv };
  globalThis.fetch = originalFetch;
});

test("invitation email service falls back to development logging when provider is not configured", async () => {
  delete process.env.INVITATION_EMAIL_PROVIDER;
  delete process.env.SENDGRID_API_KEY;
  delete process.env.INVITATION_EMAIL_FROM;
  delete process.env.SENDGRID_FROM_EMAIL;

  const service = createInvitationEmailService();
  const result = await service.sendHouseholdInvitation({
    invitedEmail: "student@example.com",
    invitedPersona: "student",
    inviterName: "Parent User",
    householdName: "Example household",
    inviteLink: "http://localhost:3000/signup?invite=test-token",
    expiresAt: new Date("2026-05-01T12:00:00Z").toISOString(),
  });

  assert.equal(result.provider, "development_log");
  assert.equal(result.state, "logged");
});

test("invitation email service uses SendGrid when configured", async () => {
  process.env.INVITATION_EMAIL_PROVIDER = "sendgrid";
  process.env.SENDGRID_API_KEY = "sg_test_key";
  process.env.INVITATION_EMAIL_FROM = "noreply@example.com";
  process.env.INVITATION_EMAIL_FROM_NAME = "Campus2Career";

  const captured: { current?: { url: string; init?: RequestInit } } = {};
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    captured.current = { url: String(url), init };
    return new Response(null, { status: 202 });
  }) as typeof fetch;

  const service = createInvitationEmailService();
  const result = await service.sendHouseholdInvitation({
    invitedEmail: "coach@example.com",
    invitedPersona: "coach",
    inviterName: "Parent User",
    householdName: "Example household",
    inviteLink: "https://example.com/signup?invite=token",
    expiresAt: new Date("2026-05-01T12:00:00Z").toISOString(),
  });

  assert.equal(result.provider, "sendgrid");
  assert.equal(result.state, "sent");
  if (!captured.current) {
    throw new Error("Expected SendGrid request to be captured.");
  }
  assert.equal(captured.current.url, "https://api.sendgrid.com/v3/mail/send");
  assert.match(
    String(captured.current.init?.headers && (captured.current.init.headers as Record<string, string>).authorization),
    /Bearer sg_test_key/
  );
});
