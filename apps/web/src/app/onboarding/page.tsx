"use client";

import Link from "next/link";
import { AppShell } from "../../components/layout/AppShell";
import { SectionCard } from "../../components/layout/SectionCard";
import { RequireRole } from "../../components/RequireRole";

const steps = [
  {
    href: "/onboarding/profile",
    title: "Academic path",
    description: "Choose the school, major, minor, and graduation timing that anchor the rest of the platform.",
  },
  {
    href: "/onboarding/sectors",
    title: "Career interests",
    description: "Pick the broad career areas you want the system to prioritize while scoring and guidance are still getting started.",
  },
  {
    href: "/uploads",
    title: "Documents and proof",
    description: "Upload a transcript, resume, and supporting files so the platform can work from real student evidence.",
  },
  {
    href: "/onboarding/network",
    title: "Network baseline",
    description: "Capture who already knows the student and where warm introductions may be possible.",
  },
  {
    href: "/onboarding/deadlines",
    title: "Important dates",
    description: "Add internship windows, application due dates, and decision checkpoints that should shape the student plan.",
  },
  {
    href: "/student",
    title: "Student dashboard",
    description: "Review score, readiness, risk areas, and the best next move for the student right now.",
  },
];

export default function OnboardingPage() {
  return (
    <AppShell
      title="Set up the student journey"
      subtitle="Move through the essentials in order so the dashboards become more accurate, more useful, and much easier to trust."
    >
      <RequireRole expectedRoles={["student", "parent", "admin"]} fallbackTitle="Sign in to start onboarding">
        <SectionCard
          title="Recommended setup order"
          subtitle="You do not need everything at once, but each step makes the next dashboard more useful."
          tone="highlight"
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 16,
            }}
          >
            {steps.map((step, index) => (
              <Link
                key={step.href}
                href={step.href}
                style={{
                  textDecoration: "none",
                  color: "#132238",
                  borderRadius: 22,
                  padding: "18px 18px 20px",
                  background: "rgba(255,255,255,0.82)",
                  border: "1px solid rgba(73, 102, 149, 0.12)",
                  boxShadow: "0 14px 30px rgba(15, 23, 42, 0.06)",
                  display: "grid",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    width: "fit-content",
                    padding: "6px 10px",
                    borderRadius: 999,
                    background: "rgba(21, 94, 239, 0.08)",
                    color: "#155eef",
                    fontSize: 12,
                    fontWeight: 800,
                    textTransform: "uppercase",
                  }}
                >
                  Step {index + 1}
                </div>
                <strong style={{ fontSize: 20 }}>{step.title}</strong>
                <p style={{ margin: 0, color: "#52657d", lineHeight: 1.6 }}>{step.description}</p>
                <span style={{ fontWeight: 700 }}>Open step →</span>
              </Link>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="What this setup unlocks"
          subtitle="The product becomes meaningfully stronger once it has both academic context and real documents."
          tone="quiet"
        >
          <div style={{ display: "grid", gap: 12, color: "#334155", lineHeight: 1.7 }}>
            <div>School and major selection let the platform understand the academic path behind the student’s decisions.</div>
            <div>Uploaded documents add evidence that the system can use instead of relying on assumptions.</div>
            <div>Deadlines and network context make recommendations more practical and time-sensitive.</div>
          </div>
        </SectionCard>
      </RequireRole>
    </AppShell>
  );
}
