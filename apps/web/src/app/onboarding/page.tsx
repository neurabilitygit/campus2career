"use client";

import Link from "next/link";
import { AppShell } from "../../components/layout/AppShell";
import { SectionCard } from "../../components/layout/SectionCard";
import { RequireRole } from "../../components/RequireRole";

export default function OnboardingPage() {
  return (
    <AppShell
      title="Campus2Career Onboarding"
      subtitle="Parent-first onboarding with student profile, sector selection, résumé upload, and deadline setup."
    >
      <RequireRole expectedRoles={["student", "parent", "admin"]} fallbackTitle="Sign in to start onboarding">
        <SectionCard title="Onboarding Steps">
          <ol style={{ paddingLeft: 18, lineHeight: 1.8 }}>
            <li><Link href="/onboarding/profile">Student profile</Link></li>
            <li><Link href="/onboarding/sectors">Sector clusters and role families</Link></li>
            <li><Link href="/uploads">Résumé and transcript uploads</Link></li>
            <li><Link href="/onboarding/network">Network baseline</Link></li>
            <li><Link href="/onboarding/deadlines">Manual deadlines and decision points</Link></li>
            <li><Link href="/student">First diagnostic dashboard</Link></li>
          </ol>
        </SectionCard>
      </RequireRole>
    </AppShell>
  );
}
