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

  return <p>Resolving your dashboard...</p>;
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
