"use client";

import Link from "next/link";
import { AppShell } from "../../components/layout/AppShell";
import { SectionCard } from "../../components/layout/SectionCard";
import { SessionGate } from "../../components/SessionGate";

function HouseholdSetupContent() {
  return (
    <AppShell
      title="Household setup"
      subtitle="See how Rising Senior connects student, parent, and coach accounts so permissions, dashboards, and invitations stay aligned."
    >
      <SectionCard
        title="How account linking works"
        subtitle="Rising Senior already runs on a household model that centers on a student and scopes parent, coach, and admin access appropriately."
      >
        <div style={{ display: "grid", gap: 14 }}>
          <p style={{ margin: 0, color: "#475569", lineHeight: 1.7 }}>
            A household usually centers on one student. That household can also include a parent or guardian and, when coaching support is part of the experience, an optional coach relationship that is scoped to the student.
          </p>
          <div className="ui-soft-panel">
            <strong>What is true today</strong>
            <ul style={{ marginBottom: 0 }}>
              <li>Parents can create a household and manage invitations, join requests, and household permissions.</li>
              <li>Students and coaches can join the right household through an invitation or an approved access request.</li>
              <li>Accounts already resolve into a role-aware workspace after sign-in, and the system protects what each role can and cannot see.</li>
              <li>Student, parent, and coach views all depend on this underlying household and relationship model.</li>
            </ul>
          </div>
          <div className="ui-soft-panel" style={{ background: "#fff8e7", borderColor: "rgba(180, 83, 9, 0.18)" }}>
            <strong>What may become more detailed later</strong>
            <p style={{ margin: "6px 0 0 0", color: "#7c2d12", lineHeight: 1.7 }}>
              A later enrollment flow may collect or confirm household membership, parent or guardian linkage, and optional coach assignment in a more guided way. That future enrollment layer would refine the experience, not replace the household model already in use today.
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/help" className="ui-button ui-button--secondary">
              Open Help
            </Link>
          </div>
        </div>
      </SectionCard>
    </AppShell>
  );
}

export default function HouseholdSetupPage() {
  return (
    <SessionGate fallbackTitle="Sign in required">
      <HouseholdSetupContent />
    </SessionGate>
  );
}
