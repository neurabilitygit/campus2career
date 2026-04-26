"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "../../hooks/useAuthContext";
import { SessionGate } from "../../components/SessionGate";
import { AppShell } from "../../components/layout/AppShell";

function Redirector() {
  const router = useRouter();
  const auth = useAuthContext();

  useEffect(() => {
    const role = auth.data?.context?.authenticatedRoleType;
    if (!role) return;
    if (role === "parent") router.replace("/parent");
    else if (role === "student") router.replace("/student");
    else if (role === "coach") router.replace("/coach");
    else router.replace("/admin");
  }, [auth.data, router]);

  useEffect(() => {
    if (!auth.isAuthenticated || auth.loading || !auth.error) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      router.replace("/signup");
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [auth.error, auth.isAuthenticated, auth.loading, router]);

  if (auth.loading) {
    return (
      <div style={{ display: "grid", gap: 10 }}>
        <p style={{ margin: 0, fontWeight: 700 }}>Opening your workspace...</p>
        <p style={{ margin: 0, color: "#52657d" }}>
          We&apos;re checking your account and sending you to the right dashboard.
        </p>
      </div>
    );
  }

  if (auth.error) {
    return (
      <div style={{ display: "grid", gap: 10 }}>
        <p style={{ color: "#92400e", marginBottom: 0, fontWeight: 700 }}>
          We hit an account setup issue while opening your workspace.
        </p>
        <p style={{ margin: 0, color: "#52657d", lineHeight: 1.6 }}>
          Rising Senior is sending you to signup and household setup so you can finish the account wiring instead of getting stuck here.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/signup" className="ui-button ui-button--primary">
            Open signup and setup
          </Link>
          <button type="button" className="ui-button ui-button--secondary" onClick={() => auth.refresh()}>
            Retry workspace check
          </button>
        </div>
      </div>
    );
  }

  return <p style={{ margin: 0, color: "#52657d" }}>Sending you to the best next page for this account...</p>;
}

export default function AppLandingPage() {
  return (
    <AppShell
      title="Welcome back"
      subtitle="Rising Senior will open the dashboard that matches your account so you can pick up where you left off."
    >
      <SessionGate fallbackTitle="Sign in required">
        <Redirector />
      </SessionGate>
    </AppShell>
  );
}
