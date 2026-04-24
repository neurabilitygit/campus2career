"use client";

import Link from "next/link";
import { AppShell } from "../../components/layout/AppShell";
import { SectionCard } from "../../components/layout/SectionCard";
import { RequireRole } from "../../components/RequireRole";

const steps = [
  {
    href: "/onboarding/profile",
    title: "Academic path",
    description: "Start with the school, major, and graduation timing so the platform can understand what the student is trying to complete.",
  },
  {
    href: "/uploads",
    title: "Documents and proof",
    description: "Upload a transcript, resume, or supporting files so the platform can work from real student evidence instead of assumptions.",
  },
  {
    href: "/student",
    title: "Student dashboard",
    description: "Open the dashboard early to see current status, main risk, next best move, and what information is still missing.",
  },
  {
    href: "/onboarding/sectors",
    title: "Career interests",
    description: "Pick the broad areas that should guide the first version of scoring until a more exact target job is saved.",
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
];

export default function OnboardingPage() {
  return (
    <AppShell
      title="Set up the student path"
      subtitle="Start with the academic path and one real document, then open the dashboard to see where the student stands and what to do next."
    >
      <RequireRole expectedRoles={["student", "parent", "admin"]} fallbackTitle="Sign in to start onboarding">
        <SectionCard
          title="Recommended setup order"
          subtitle="You do not need everything at once. The fastest route to value is school and major first, real evidence second, then the dashboard."
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
                className="ui-feature-link-card"
              >
                <div className="ui-pill">
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
          title="What this unlocks"
          subtitle="Each step makes the dashboard more useful, more specific, and easier for families to trust."
          tone="quiet"
        >
          <div style={{ display: "grid", gap: 12, color: "#334155", lineHeight: 1.7 }}>
            <div>The academic path tells the system what the student is studying and what requirements may matter.</div>
            <div>Uploaded documents give the platform real evidence to score, explain, and prioritize next steps.</div>
            <div>Career interests, network context, and deadlines make the advice more practical once the basics are in place.</div>
          </div>
        </SectionCard>
      </RequireRole>
    </AppShell>
  );
}
