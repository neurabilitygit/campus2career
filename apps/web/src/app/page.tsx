"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthButtons } from "../components/AuthButtons";
import { useSession } from "../hooks/useSession";
import { useApiData } from "../hooks/useApiData";
import {
  getStoredTestContextRole,
  setStoredTestContextRole,
  subscribeToTestContextRole,
  type TestContextRole,
} from "../lib/testContext";

const roleDescriptions = {
  guest: {
    label: "See the full journey",
    summary:
      "Campus2Career helps students, parents, and coaches turn school choices into a clearer plan for internships, early career momentum, and family decision-making.",
    accent: "#f97316",
  },
  student: {
    label: "For students",
    summary:
      "See how your major, coursework, and activities translate into real career readiness, then focus on the next moves that matter most.",
    accent: "#155eef",
  },
  parent: {
    label: "For parents",
    summary:
      "Follow the student’s direction with less guesswork through concise updates, clearer priorities, and family-friendly next steps.",
    accent: "#0891b2",
  },
  coach: {
    label: "For coaches",
    summary:
      "Guide students from one connected view of academics, career targets, and action signals instead of piecing together context manually.",
    accent: "#7c3aed",
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
    palette: "linear-gradient(135deg, rgba(21,94,239,0.18), rgba(75,179,253,0.28))",
  },
  {
    title: "Parent visibility without overload",
    body:
      "Show what is changing for the student in a calmer, more useful way so parents can help without micromanaging.",
    href: "/parent",
    palette: "linear-gradient(135deg, rgba(8,145,178,0.18), rgba(45,212,191,0.26))",
  },
  {
    title: "Coach and platform workflow",
    body:
      "Keep onboarding, scoring, documents, and role-based guidance connected through one shared system of record.",
    href: "/coach",
    palette: "linear-gradient(135deg, rgba(124,58,237,0.18), rgba(236,72,153,0.24))",
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
    testContextSwitchingEnabled?: boolean;
    testContextAllowedRoles?: TestContextRole[];
    testContextOverrideRole?: TestContextRole | null;
    email?: string;
  };
};

function ContextSwitcher(props: {
  isAuthenticated: boolean;
  auth: ReturnType<typeof useApiData<AuthMeResponse>>;
}) {
  const [selectedRole, setSelectedRole] = useState<TestContextRole | null>(null);

  useEffect(() => {
    setSelectedRole(getStoredTestContextRole());
    return subscribeToTestContextRole(setSelectedRole);
  }, []);

  const canSwitch = !!props.auth.data?.context?.testContextSwitchingEnabled;
  const allowedRoles = props.auth.data?.context?.testContextAllowedRoles || [];
  const effectiveRole = props.auth.data?.context?.authenticatedRoleType;

  if (!props.isAuthenticated) {
    return null;
  }

  if (props.auth.loading) {
    return (
      <div
        style={{
          padding: 18,
          borderRadius: 22,
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.12)",
        }}
      >
        <strong style={{ display: "block", marginBottom: 8 }}>Testing context</strong>
        <p style={{ margin: 0, color: "#dbe7ff" }}>
          Checking whether this account can preview multiple workspaces.
        </p>
      </div>
    );
  }

  if (!canSwitch) {
    return null;
  }

  const handleRoleSelection = (role: TestContextRole | null) => {
    setStoredTestContextRole(role);
    window.location.reload();
  };

  return (
    <div
      style={{
        padding: 18,
        borderRadius: 22,
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.12)",
        display: "grid",
        gap: 14,
      }}
    >
      <div style={{ display: "grid", gap: 6 }}>
        <strong style={{ fontSize: 16 }}>Workspace preview</strong>
        <p style={{ margin: 0, color: "#dbe7ff", lineHeight: 1.5 }}>
          This account can temporarily switch between student, parent, and coach views for local testing.
        </p>
        <p style={{ margin: 0, color: "#c7d8ff", fontSize: 13 }}>
          Current workspace: <strong>{effectiveRole || "unknown"}</strong>
          {" · "}
          Preview mode: <strong>{selectedRole || "account default"}</strong>
        </p>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {allowedRoles.map((role) => {
          const isActive = selectedRole === role;
          return (
            <button
              key={role}
              onClick={() => handleRoleSelection(role)}
              style={{
                border: "none",
                borderRadius: 999,
                padding: "11px 16px",
                cursor: "pointer",
                fontWeight: 800,
                textTransform: "capitalize",
                background: isActive
                  ? "linear-gradient(135deg, #34d399 0%, #7dd3fc 100%)"
                  : "rgba(255,255,255,0.12)",
                color: isActive ? "#082f49" : "#f8fafc",
                boxShadow: isActive ? "0 14px 28px rgba(52, 211, 153, 0.22)" : "none",
              }}
            >
              {role}
            </button>
          );
        })}
        <button
          onClick={() => handleRoleSelection(null)}
          style={{
            borderRadius: 999,
            padding: "11px 16px",
            cursor: "pointer",
            fontWeight: 800,
            border: "1px solid rgba(255,255,255,0.18)",
            background: selectedRole === null ? "#f8fafc" : "transparent",
            color: selectedRole === null ? "#0f172a" : "#f8fafc",
          }}
        >
          Default
        </button>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { isAuthenticated } = useSession();
  const auth = useApiData<AuthMeResponse>(
    "/auth/me",
    isAuthenticated
  );

  const resolvedRole = auth.data?.context?.authenticatedRoleType || "guest";
  const roleContent = roleDescriptions[resolvedRole];

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "28px 24px 48px",
        background:
          "radial-gradient(circle at top left, rgba(255,183,71,0.35), transparent 28%), radial-gradient(circle at top right, rgba(75,179,253,0.28), transparent 30%), linear-gradient(180deg, #fff8ef 0%, #f7fbff 44%, #eef6ff 100%)",
      }}
    >
      <div style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gap: 28 }}>
        <section
          style={{
            borderRadius: 32,
            padding: "32px clamp(20px, 5vw, 44px)",
            background:
              "linear-gradient(135deg, rgba(9, 12, 31, 0.96), rgba(17, 37, 79, 0.93) 48%, rgba(9, 93, 122, 0.9) 100%)",
            color: "#f8fafc",
            boxShadow: "0 32px 60px rgba(15, 23, 42, 0.18)",
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
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 14px",
                    borderRadius: 999,
                    background: "rgba(248, 250, 252, 0.1)",
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: 0.4,
                    textTransform: "uppercase",
                  }}
                >
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
                  Campus2Career
                </h1>
                <p style={{ margin: 0, fontSize: "clamp(1rem, 1.8vw, 1.2rem)", lineHeight: 1.6, color: "#dbe7ff" }}>
                  {roleContent.summary}
                </p>
              </div>
              <div
                style={{
                  minWidth: 280,
                  maxWidth: 360,
                  padding: 20,
                  borderRadius: 24,
                  background: "rgba(255,255,255,0.08)",
                  backdropFilter: "blur(10px)",
                  display: "grid",
                  gap: 14,
                }}
              >
                <div style={{ display: "grid", gap: 6 }}>
                  <strong style={{ fontSize: 16 }}>Open your account</strong>
                  <p style={{ margin: 0, color: "#c7d8ff", lineHeight: 1.5 }}>
                    Continue with Google to reach your saved experience. Active controls stay lit, while inactive controls fade back.
                  </p>
                </div>
                <AuthButtons />
                <ContextSwitcher isAuthenticated={isAuthenticated} auth={auth} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link
                href="/app"
                style={{
                  textDecoration: "none",
                  background: "linear-gradient(135deg, #ff7a18 0%, #ffd166 100%)",
                  color: "#1f2937",
                  padding: "14px 20px",
                  borderRadius: 999,
                  fontWeight: 800,
                  boxShadow: "0 14px 30px rgba(255, 122, 24, 0.28)",
                }}
              >
                Open my workspace
              </Link>
              <Link
                href="/onboarding"
                style={{
                  textDecoration: "none",
                  background: "rgba(255,255,255,0.12)",
                  color: "#f8fafc",
                  padding: "14px 20px",
                  borderRadius: 999,
                  fontWeight: 700,
                  border: "1px solid rgba(255,255,255,0.18)",
                }}
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
              style={{
                textDecoration: "none",
                color: "#0f172a",
                borderRadius: 26,
                padding: 22,
                background: card.palette,
                border: "1px solid rgba(148, 163, 184, 0.18)",
                boxShadow: "0 18px 30px rgba(148, 163, 184, 0.16)",
                display: "grid",
                gap: 10,
              }}
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
                <strong style={{ color: "#0891b2" }}>Parents</strong>
                <p style={{ margin: "6px 0 0 0", lineHeight: 1.6 }}>
                  See parent-safe summaries, month-by-month trajectory updates, and focused context about where support is most useful.
                </p>
              </div>
              <div>
                <strong style={{ color: "#7c3aed" }}>Coaches</strong>
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
                <div
                  key={step.title}
                  style={{
                    borderRadius: 18,
                    padding: "14px 16px",
                    background: "rgba(255,255,255,0.8)",
                    border: "1px solid rgba(21, 94, 239, 0.1)",
                  }}
                >
                  <strong>{step.title}</strong>
                  <p style={{ margin: "6px 0 0 0", lineHeight: 1.6 }}>{step.body}</p>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
              <Link href="/student" style={{ textDecoration: "none", color: "#155eef", fontWeight: 700 }}>
                Student dashboard
              </Link>
              <Link href="/parent" style={{ textDecoration: "none", color: "#0891b2", fontWeight: 700 }}>
                Parent dashboard
              </Link>
              <Link href="/uploads" style={{ textDecoration: "none", color: "#7c3aed", fontWeight: 700 }}>
                Upload center
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
