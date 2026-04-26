"use client";

import Link from "next/link";
import { AppShell } from "../components/layout/AppShell";
import { useSession } from "../hooks/useSession";
import { useApiData } from "../hooks/useApiData";

const roleDescriptions = {
  guest: {
    label: "See the full journey",
    summary:
      "Rising Senior helps students, parents, and coaches turn school choices into a clearer plan for internships, early career momentum, and family decision-making.",
    accent: "#f97316",
  },
  student: {
    label: "For students",
    summary:
      "See how your major, coursework, and activities translate into real career readiness, then focus on the next moves that matter most.",
    accent: "#0d6fb8",
  },
  parent: {
    label: "For parents",
    summary:
      "Follow the student’s direction with less guesswork through concise updates, clearer priorities, and family-friendly next steps.",
    accent: "#7e57c2",
  },
  coach: {
    label: "For coaches",
    summary:
      "Guide students from one connected view of academics, career targets, and action signals instead of piecing together context manually.",
    accent: "#198c67",
  },
  admin: {
    label: "For platform testing",
    summary:
      "Move through the student, parent, and coach experiences while validating the full product flow before launch.",
    accent: "#dc2626",
  },
} as const;

const roleCards = [
  {
    title: "Student direction, not just data",
    body:
      "Translate coursework, transcripts, goals, and projects into simple signals about readiness, gaps, and the best next step.",
    href: "/student",
    palette: "linear-gradient(135deg, rgba(13,111,184,0.18), rgba(111,191,222,0.28))",
  },
  {
    title: "Parent visibility without overload",
    body:
      "Show what is changing for the student in a calmer, more useful way so parents can help without micromanaging.",
    href: "/parent",
    palette: "linear-gradient(135deg, rgba(126,87,194,0.18), rgba(205,180,255,0.26))",
  },
  {
    title: "Coach and platform workflow",
    body:
      "Keep onboarding, scoring, documents, and role-based guidance connected through one shared system of record.",
    href: "/coach",
    palette: "linear-gradient(135deg, rgba(25,140,103,0.18), rgba(138,214,183,0.24))",
  },
];

const journeySteps = [
  {
    title: "1. Set the academic path",
    body: "Choose the school, major, minor, and graduation timeline that anchor the rest of the platform.",
  },
  {
    title: "2. Add evidence",
    body: "Upload a transcript, resume, and supporting documents so the system can work from real student material.",
  },
  {
    title: "3. Score against the target job",
    body: "See readiness, market context, and the exact skill or experience gaps that still need attention.",
  },
  {
    title: "4. Act on the next best move",
    body: "Turn scoring into focused next steps for the student, the parent, and the coach.",
  },
];

type AuthMeResponse = {
  context?: {
    authenticatedRoleType?: "student" | "parent" | "coach" | "admin";
    email?: string;
  };
};

export default function HomePage() {
  const { isAuthenticated } = useSession();
  const auth = useApiData<AuthMeResponse>(
    "/auth/me",
    isAuthenticated
  );

  const resolvedRole = auth.data?.context?.authenticatedRoleType || "guest";
  const roleContent = roleDescriptions[resolvedRole];

  return (
    <AppShell
      title="Home"
      subtitle="Start here, then use the persistent sidebar to move through setup, documents, and each role workspace."
    >
      <div style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gap: 28 }}>
        <section
          style={{
            borderRadius: 32,
            padding: "32px clamp(20px, 5vw, 44px)",
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.94), rgba(244,248,253,0.96) 58%, rgba(249,244,236,0.94) 100%)",
            color: "#112033",
            border: "1px solid rgba(255,255,255,0.78)",
            boxShadow: "0 32px 60px rgba(15, 23, 42, 0.1)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: "auto -80px -110px auto",
              width: 280,
              height: 280,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(255,183,71,0.34), rgba(255,183,71,0) 68%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: "-80px auto auto -60px",
              width: 220,
              height: 220,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(93, 212, 255, 0.22), rgba(93,212,255,0) 70%)",
            }}
          />

          <div style={{ position: "relative", display: "grid", gap: 20 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 20,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "grid", gap: 14, maxWidth: 720 }}>
                <div className="ui-pill">
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: roleContent.accent }} />
                  {roleContent.label}
                </div>
                <h1
                  style={{
                    margin: 0,
                    fontSize: "clamp(2.4rem, 6vw, 4.6rem)",
                    lineHeight: 0.96,
                    letterSpacing: "-0.05em",
                  }}
                >
                  Rising Senior
                </h1>
                <p style={{ margin: 0, fontSize: "clamp(1rem, 1.8vw, 1.2rem)", lineHeight: 1.6, color: "#52657d" }}>
                  {roleContent.summary}
                </p>
              </div>
              <div
                style={{
                  minWidth: 280,
                  maxWidth: 360,
                  padding: 20,
                  borderRadius: 24,
                  background: "rgba(255,255,255,0.78)",
                  border: "1px solid rgba(255,255,255,0.74)",
                  boxShadow: "0 16px 32px rgba(15, 23, 42, 0.06)",
                  display: "grid",
                  gap: 14,
                }}
              >
                <div style={{ display: "grid", gap: 6 }}>
                  <strong style={{ fontSize: 16 }}>Start with the right flow</strong>
                  <p style={{ margin: 0, color: "#52657d", lineHeight: 1.5 }}>
                    Use the account menu in the upper-right to sign in, then move into onboarding, documents, or the workspace that matches your role.
                  </p>
                </div>
                <div
                  style={{
                    padding: 18,
                    borderRadius: 22,
                    background: "rgba(248,251,255,0.82)",
                    border: "1px solid rgba(73, 102, 149, 0.12)",
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <strong style={{ fontSize: 16 }}>Account and workspace controls</strong>
                  <p style={{ margin: 0, color: "#52657d", lineHeight: 1.6 }}>
                    Sign in, sign out, open Help, and switch preview workspaces from the header. That keeps the navigation focused on the product itself.
                  </p>
                  {isAuthenticated ? (
                    <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
                      Current account role: <strong>{auth.data?.context?.authenticatedRoleType || "unknown"}</strong>
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link
                href="/signup"
                className="ui-button ui-button--primary"
              >
                Create account
              </Link>
              <Link
                href="/app"
                className="ui-button ui-button--secondary"
              >
                Open my workspace
              </Link>
              <Link
                href="/onboarding"
                className="ui-button ui-button--secondary"
              >
                Start setup
              </Link>
            </div>
          </div>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 18,
          }}
        >
            {roleCards.map((card) => (
              <Link
                key={card.title}
                href={card.href}
                className="ui-feature-link-card"
                style={{ background: card.palette }}
              >
                <strong style={{ fontSize: 20 }}>{card.title}</strong>
                <p style={{ margin: 0, lineHeight: 1.6 }}>{card.body}</p>
              <span style={{ fontWeight: 700 }}>Explore this view →</span>
            </Link>
          ))}
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 20,
          }}
        >
          <div
            style={{
              borderRadius: 28,
              padding: 26,
              background: "#fffdf8",
              border: "1px solid rgba(248, 161, 63, 0.22)",
              boxShadow: "0 20px 40px rgba(245, 158, 11, 0.08)",
              display: "grid",
              gap: 16,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 28 }}>What each person sees</h2>
            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <strong style={{ color: "#155eef" }}>Students</strong>
                <p style={{ margin: "6px 0 0 0", lineHeight: 1.6 }}>
                  Build a clearer path from school choices and uploaded evidence to scoring, guidance, and next actions.
                </p>
              </div>
              <div>
                <strong style={{ color: "#7e57c2" }}>Parents</strong>
                <p style={{ margin: "6px 0 0 0", lineHeight: 1.6 }}>
                  See parent-safe summaries, month-by-month trajectory updates, and focused context about where support is most useful.
                </p>
              </div>
              <div>
                <strong style={{ color: "#198c67" }}>Coaches</strong>
                <p style={{ margin: "6px 0 0 0", lineHeight: 1.6 }}>
                  Work from one connected picture of profile data, uploads, deadlines, insight generation, and market-aware advising.
                </p>
              </div>
            </div>
          </div>

          <div
            style={{
              borderRadius: 28,
              padding: 26,
              background: "linear-gradient(180deg, #ffffff 0%, #f5fbff 100%)",
              border: "1px solid rgba(21, 94, 239, 0.16)",
              boxShadow: "0 20px 40px rgba(21, 94, 239, 0.08)",
              display: "grid",
              gap: 14,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 24 }}>What happens inside the product</h2>
            <div style={{ display: "grid", gap: 12 }}>
              {journeySteps.map((step) => (
                <div key={step.title} className="ui-soft-panel">
                  <strong>{step.title}</strong>
                  <p style={{ margin: "6px 0 0 0", lineHeight: 1.6 }}>{step.body}</p>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
              <Link href="/student" style={{ textDecoration: "none", color: "#155eef", fontWeight: 700 }}>
                Student dashboard
              </Link>
              <Link href="/parent" style={{ textDecoration: "none", color: "#7e57c2", fontWeight: 700 }}>
                Parent dashboard
              </Link>
              <Link href="/uploads" style={{ textDecoration: "none", color: "#198c67", fontWeight: 700 }}>
                Upload center
              </Link>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
