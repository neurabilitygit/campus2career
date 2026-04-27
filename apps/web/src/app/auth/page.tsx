"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { beginGoogleSignIn, consumeStoredAuthReturnTo, readRememberedGoogleAccount, setStoredAuthReturnTo } from "../../lib/authFlow";
import { getSupabaseBrowserClient, getSupabaseConfigError } from "../../lib/supabaseClient";
import { useSession } from "../../hooks/useSession";

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.56 2.68-3.86 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H1v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72A5.41 5.41 0 0 1 3.69 9c0-.6.1-1.18.28-1.72V4.95H1A9 9 0 0 0 0 9c0 1.45.35 2.82 1 4.05l2.97-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.33l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 1 4.95l2.97 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

function rememberedAccountLabel(account: { fullName: string | null; email: string }) {
  return account.fullName || account.email;
}

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = useSession();
  const supabase = getSupabaseBrowserClient();
  const configError = getSupabaseConfigError();
  const [busyMode, setBusyMode] = useState<"remembered" | "different" | null>(null);
  const [rememberedAccount, setRememberedAccount] = useState<ReturnType<typeof readRememberedGoogleAccount>>(null);

  const requestedReturnTo = useMemo(() => searchParams.get("next"), [searchParams]);
  const signedOut = searchParams.get("signed_out") === "1";
  const reauth = searchParams.get("reauth") === "1";

  useEffect(() => {
    setRememberedAccount(readRememberedGoogleAccount());
  }, []);

  useEffect(() => {
    if (requestedReturnTo) {
      setStoredAuthReturnTo(requestedReturnTo);
    }
  }, [requestedReturnTo]);

  useEffect(() => {
    if (!session.loading && session.isAuthenticated) {
      router.replace(consumeStoredAuthReturnTo("/signup"));
    }
  }, [router, session.isAuthenticated, session.loading]);

  async function startGoogle(mode: "remembered" | "different") {
    if (!supabase) {
      return;
    }

    setBusyMode(mode);
    try {
      await beginGoogleSignIn({
        supabase,
        returnTo: requestedReturnTo,
        loginHint: mode === "remembered" ? rememberedAccount?.email || null : null,
      });
    } finally {
      setBusyMode(null);
    }
  }

  const title = rememberedAccount ? `Continue as ${rememberedAccountLabel(rememberedAccount)}` : "Sign in with Google";
  const subtitle = rememberedAccount
    ? "Use the Google account already associated with this browser, or choose a different Google account before continuing."
    : "Use your Google account to open the right Rising Senior workspace after authentication.";
  const bannerMessage = signedOut
    ? "You signed out successfully. Sign in again to reopen your workspace."
    : reauth
      ? "Your session needs to be verified again before protected workspaces can reopen."
      : null;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "32px 18px",
        background:
          "radial-gradient(circle at top left, rgba(143, 210, 255, 0.24), transparent 30%), linear-gradient(180deg, #eef4fb 0%, #f8fafc 40%, #f3f6fb 100%)",
      }}
    >
      <div
        style={{
          width: "min(960px, 100%)",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.1fr) minmax(320px, 420px)",
          gap: 24,
          alignItems: "stretch",
        }}
      >
        <section
          style={{
            borderRadius: 32,
            padding: "clamp(24px, 4vw, 42px)",
            background: "linear-gradient(145deg, #0f172a 0%, #16345f 55%, #215f9f 100%)",
            color: "#f8fafc",
            display: "grid",
            gap: 18,
            boxShadow: "0 34px 70px rgba(15, 23, 42, 0.22)",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              width: "fit-content",
              padding: "8px 14px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.1)",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 0.06,
              textTransform: "uppercase",
            }}
          >
            Rising Senior
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: "clamp(2.2rem, 5vw, 3.4rem)", lineHeight: 0.98 }}>
              A familiar Google sign-in, with the right workspace waiting after it.
            </h1>
            <p style={{ margin: 0, color: "#dbe7ff", lineHeight: 1.7, fontSize: 16 }}>
              Authenticate first, then return to the student, parent, coach, or administration experience attached to
              your account.
            </p>
          </div>
          <div
            style={{
              display: "grid",
              gap: 14,
              padding: 20,
              borderRadius: 24,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <strong style={{ fontSize: 16 }}>What this sign-in flow now does</strong>
            <div style={{ display: "grid", gap: 10, color: "#dbe7ff", lineHeight: 1.6 }}>
              <div>Sign-out clears the current browser session so protected workspaces require authentication again.</div>
              <div>If this browser already knows your Google account, it stays visible here until you choose to continue.</div>
              <div>Google account confirmation still happens through the provider flow, which keeps the experience familiar and trustworthy.</div>
            </div>
          </div>
        </section>

        <section
          style={{
            borderRadius: 28,
            padding: "clamp(22px, 4vw, 30px)",
            background: "#ffffff",
            border: "1px solid rgba(148, 163, 184, 0.18)",
            boxShadow: "0 26px 54px rgba(15, 23, 42, 0.1)",
            display: "grid",
            gap: 18,
            alignSelf: "center",
          }}
        >
          <div style={{ display: "grid", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.08, textTransform: "uppercase", color: "#64748b" }}>
              Secure sign-in
            </span>
            <h2 style={{ margin: 0, fontSize: 28, color: "#0f172a" }}>{title}</h2>
            <p style={{ margin: 0, color: "#52657d", lineHeight: 1.6 }}>{subtitle}</p>
          </div>

          {bannerMessage ? (
            <div
              style={{
                borderRadius: 18,
                padding: "14px 16px",
                background: "#fff7ed",
                border: "1px solid #fed7aa",
                color: "#9a3412",
                lineHeight: 1.5,
              }}
            >
              {bannerMessage}
            </div>
          ) : null}

          {rememberedAccount ? (
            <div
              style={{
                display: "grid",
                gap: 12,
                borderRadius: 22,
                padding: 18,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.08, textTransform: "uppercase", color: "#64748b" }}>
                Known Google account
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {rememberedAccount.avatarUrl ? (
                  <img
                    src={rememberedAccount.avatarUrl}
                    alt=""
                    style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }}
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      background: "#dbeafe",
                      color: "#1d4ed8",
                      display: "grid",
                      placeItems: "center",
                      fontWeight: 800,
                    }}
                  >
                    {(rememberedAccount.fullName || rememberedAccount.email).trim().charAt(0).toUpperCase()}
                  </div>
                )}
                <div style={{ display: "grid", gap: 2 }}>
                  <strong style={{ color: "#0f172a" }}>{rememberedAccountLabel(rememberedAccount)}</strong>
                  <span style={{ color: "#52657d" }}>{rememberedAccount.email}</span>
                </div>
              </div>
            </div>
          ) : null}

          <div style={{ display: "grid", gap: 12 }}>
            <button
              type="button"
              className="ui-button"
              onClick={() => {
                void startGoogle(rememberedAccount ? "remembered" : "different");
              }}
              disabled={!supabase || !!busyMode || session.loading}
              style={{
                justifyContent: "center",
                minHeight: 52,
                background: rememberedAccount ? "#0f172a" : "#ffffff",
                color: rememberedAccount ? "#f8fafc" : "#0f172a",
                border: rememberedAccount ? "1px solid #0f172a" : "1px solid #d0d8e8",
                boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                <GoogleMark />
                <span>
                  {busyMode
                    ? "Opening Google..."
                    : rememberedAccount
                      ? `Continue as ${rememberedAccountLabel(rememberedAccount)}`
                      : "Continue with Google"}
                </span>
              </span>
            </button>

            {rememberedAccount ? (
              <button
                type="button"
                className="ui-button ui-button--secondary"
                onClick={() => {
                  void startGoogle("different");
                }}
                disabled={!supabase || !!busyMode || session.loading}
              >
                Use a different Google account
              </button>
            ) : null}
          </div>

          <div style={{ display: "grid", gap: 10, color: "#64748b", fontSize: 14, lineHeight: 1.6 }}>
            <div>Google will still ask you to confirm the account before returning you to Rising Senior.</div>
            <div>
              Need a different path first? <Link href="/" style={{ color: "#0d6fb8", fontWeight: 700 }}>Back to home</Link>
            </div>
          </div>

          {configError ? (
            <div style={{ borderRadius: 18, padding: "14px 16px", background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c" }}>
              {configError}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
