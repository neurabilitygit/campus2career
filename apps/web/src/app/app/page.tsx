"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApiData } from "../../hooks/useApiData";
import { SessionGate } from "../../components/SessionGate";
import { AppShell } from "../../components/layout/AppShell";

function Redirector() {
  const router = useRouter();
  const auth = useApiData("/auth/me");

  useEffect(() => {
    const role = auth.data?.context?.authenticatedRoleType;
    if (!role) return;
    if (role === "parent") router.replace("/parent");
    else if (role === "student") router.replace("/student");
    else if (role === "coach") router.replace("/coach");
    else router.replace("/onboarding");
  }, [auth.data, router]);

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
        <p style={{ color: "crimson", marginBottom: 0 }}>{auth.error}</p>
        <p style={{ margin: 0, color: "#52657d", lineHeight: 1.6 }}>
          We couldn&apos;t finish opening your workspace yet. Refresh after the API is available and your sign-in session is active.
        </p>
      </div>
    );
  }

  return <p style={{ margin: 0, color: "#52657d" }}>Sending you to the best next page for this account...</p>;
}

export default function AppLandingPage() {
  return (
    <AppShell
      title="Welcome back"
      subtitle="Campus2Career will open the dashboard that matches your account so you can pick up where you left off."
    >
      <SessionGate fallbackTitle="Sign in required">
        <Redirector />
      </SessionGate>
    </AppShell>
  );
}
