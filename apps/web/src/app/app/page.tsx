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
    return <p>Resolving your dashboard and role context...</p>;
  }

  if (auth.error) {
    return (
      <div style={{ display: "grid", gap: 10 }}>
        <p style={{ color: "crimson", marginBottom: 0 }}>{auth.error}</p>
        <p style={{ margin: 0, color: "#475569" }}>
          The API could not resolve your role context yet. Refresh after the API is healthy and the session is active.
        </p>
      </div>
    );
  }

  return <p>Opening the dashboard for your current role...</p>;
}

export default function AppLandingPage() {
  return (
    <AppShell title="Campus2Career App">
      <SessionGate fallbackTitle="Sign in required">
        <Redirector />
      </SessionGate>
    </AppShell>
  );
}
