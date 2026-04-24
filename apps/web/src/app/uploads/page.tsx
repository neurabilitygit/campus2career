"use client";

import Link from "next/link";
import { AppShell } from "../../components/layout/AppShell";
import { SectionCard } from "../../components/layout/SectionCard";
import { RequireRole } from "../../components/RequireRole";

const uploadOptions = [
  {
    href: "/uploads/resume",
    title: "Resume",
    description: "Use this for work history, leadership, projects, and early experience signals.",
  },
  {
    href: "/uploads/transcript",
    title: "Transcript",
    description: "Use this for course history, academic progress, and degree-requirement matching.",
  },
  {
    href: "/uploads/catalog",
    title: "Program PDF",
    description: "Use this when the school website is missing or unclear and you want to add official course requirements.",
  },
  {
    href: "/uploads/other",
    title: "Supporting document",
    description: "Use this for portfolios, certifications, presentations, project writeups, and similar evidence.",
  },
];

export default function UploadsHomePage() {
  return (
    <AppShell
      title="Document center"
      subtitle="Add the files that make the dashboards more accurate and more grounded in your real work."
    >
      <RequireRole expectedRoles={["student", "admin"]} fallbackTitle="Student sign-in required">
        <SectionCard
          title="Choose a document type"
          subtitle="Each upload has a different purpose in your profile, so start with the one you want to strengthen first."
          tone="highlight"
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: 16,
            }}
          >
            {uploadOptions.map((option) => (
              <Link
                key={option.href}
                href={option.href}
                style={{
                  textDecoration: "none",
                  color: "#132238",
                  borderRadius: 22,
                  padding: "18px",
                  background: "rgba(255,255,255,0.82)",
                  border: "1px solid rgba(73, 102, 149, 0.12)",
                  boxShadow: "0 14px 30px rgba(15, 23, 42, 0.06)",
                  display: "grid",
                  gap: 10,
                }}
              >
                <strong style={{ fontSize: 20 }}>{option.title}</strong>
                <p style={{ margin: 0, color: "#52657d", lineHeight: 1.6 }}>{option.description}</p>
                <span style={{ fontWeight: 700 }}>Open upload →</span>
              </Link>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Recommended order"
          subtitle="If you are not sure where to begin, this order usually gives the system the fastest improvement in quality."
          tone="quiet"
        >
          <div style={{ display: "grid", gap: 10, color: "#334155", lineHeight: 1.7 }}>
            <div>1. Transcript for academic history and course matching.</div>
            <div>2. Resume for experience, leadership, and proof-of-work signals.</div>
            <div>3. Program PDF only when school requirements are missing or incomplete.</div>
            <div>4. Supporting files for extra evidence of meaningful work you have already done.</div>
          </div>
        </SectionCard>
      </RequireRole>
    </AppShell>
  );
}
