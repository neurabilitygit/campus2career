"use client";

import { useMemo, useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { SectionCard } from "../../components/layout/SectionCard";

type HelpTopic = {
  category: string;
  title: string;
  role: "shared" | "student" | "parent" | "coach";
  status: "available" | "in progress" | "coming soon";
  summary: string;
  whenToUse: string;
  youNeed: string;
  howToUse: string[];
  output: string;
  mistakes: string[];
  privacy?: string;
};

const topics: HelpTopic[] = [
  {
    category: "Getting started",
    title: "Open the right workspace",
    role: "shared",
    status: "available",
    summary: "Use the app shell to move between home, dashboards, onboarding, documents, and help.",
    whenToUse: "Start here when you are new to the platform or returning after some time away.",
    youNeed: "A signed-in account is helpful, but the help library is open without sign-in.",
    howToUse: [
      "Use the left navigation to choose the workspace you need.",
      "Use the account menu in the upper-right to sign in or open the workspace available to your account.",
      "Use Help whenever you want feature instructions without leaving the app.",
    ],
    output: "A clearer path into the right dashboard or task flow.",
    mistakes: [
      "Starting uploads before the academic path is set.",
      "Assuming every role can open every workspace without the right account access.",
    ],
  },
  {
    category: "Student dashboard",
    title: "Read the student dashboard",
    role: "student",
    status: "available",
    summary: "The student dashboard shows current status, top risk, next best action, evidence on file, and practical guidance.",
    whenToUse: "Use this after onboarding or after uploading new evidence.",
    youNeed: "A student account or an authorized preview context.",
    howToUse: [
      "Start in Big picture to see the current status and next move.",
      "Open Evidence to see what the system can actually verify.",
      "Open Next steps to review risks, actions, and scenario guidance.",
    ],
    output: "A transparent readiness read, not a hidden prediction.",
    mistakes: [
      "Treating missing evidence as the same thing as low readiness.",
      "Changing targets repeatedly before reviewing the evidence section.",
    ],
    privacy: "Student-specific guidance uses the account’s saved context and respects communication preferences where available.",
  },
  {
    category: "Parent dashboard",
    title: "Use the parent dashboard",
    role: "parent",
    status: "available",
    summary: "The parent dashboard turns the current student picture into calmer, parent-safe context and support actions.",
    whenToUse: "Use this when you want to understand what matters most without overloading the student.",
    youNeed: "A parent account tied to a household or an authorized preview context.",
    howToUse: [
      "Start with Parent summary to see the goal, overall status, top concern, and next best action.",
      "Use Communication translator when a concern needs reframing before it becomes a message.",
      "Generate the monthly parent update when you want a saved snapshot for the current reporting month.",
    ],
    output: "A clearer, family-facing view of progress, risk, and support options.",
    mistakes: [
      "Treating the parent dashboard as a live surveillance feed.",
      "Sending translated parent-originated content without checking consent and review status.",
    ],
    privacy: "Parent-originated translated messages should only be delivered when student consent allows it.",
  },
  {
    category: "Coach dashboard",
    title: "Review coach diagnostics",
    role: "coach",
    status: "available",
    summary: "The coach dashboard focuses on role-mapping quality, diagnostics, and whether the scoring inputs are trustworthy.",
    whenToUse: "Use this when you want to validate the system before leaning on edge-case scoring.",
    youNeed: "A coach account or an authorized preview context.",
    howToUse: [
      "Check Current platform picture for the main diagnostic risk.",
      "Review Role mappings to confirm O*NET links and visible skill coverage.",
      "Open validation details when you need raw fixture context.",
    ],
    output: "A faster path to spotting technical weaknesses in role coverage.",
    mistakes: [
      "Assuming the coach view is a student coaching workspace; it is currently diagnostic-heavy.",
      "Relying on role mappings without checking missing links or skill gaps first.",
    ],
  },
  {
    category: "Academic progress",
    title: "Set and strengthen the academic path",
    role: "shared",
    status: "available",
    summary: "The academic path anchors school, catalog, major, minor, and requirement progress.",
    whenToUse: "Use this before expecting transcript and requirement-aware scoring to feel specific.",
    youNeed: "The school, major, and ideally a structured catalog or official requirement document.",
    howToUse: [
      "Start in Student profile and choose the institution when available.",
      "If the system cannot find a reliable catalog path, upload an official program PDF.",
      "Review Evidence later to confirm whether the requirement graph is bound and complete.",
    ],
    output: "A more credible academic-progress read tied to real program requirements.",
    mistakes: [
      "Leaving the school path incomplete and expecting strong requirement matching.",
      "Uploading unofficial files when an official catalog or requirement PDF is available.",
    ],
  },
  {
    category: "Career readiness score",
    title: "Understand the score",
    role: "shared",
    status: "available",
    summary: "The score is a transparent readiness framework built from evidence, not a hidden forecast of future success.",
    whenToUse: "Use this when the overall score feels surprising or when you need to explain it to someone else.",
    youNeed: "A target role and enough evidence for the system to evaluate.",
    howToUse: [
      "Start with the explanation panel before changing the target job.",
      "Look at missing evidence separately from weak readiness.",
      "Use comparison mode only after reviewing the current target and evidence base.",
    ],
    output: "A clearer understanding of what is known, weak, missing, or still provisional.",
    mistakes: [
      "Treating seeded or fallback data as equal to direct evidence.",
      "Reading a provisional score as a final answer.",
    ],
  },
  {
    category: "Evidence and documents",
    title: "Upload documents that matter",
    role: "shared",
    status: "available",
    summary: "Uploads improve scoring, academic progress, and evidence quality by grounding the app in real files.",
    whenToUse: "Use this after onboarding or anytime new transcript, resume, or requirement material exists.",
    youNeed: "The source file and the right upload type.",
    howToUse: [
      "Use Transcript for academic history.",
      "Use Resume for experience and project evidence.",
      "Use Program PDF when the school website does not expose reliable requirement structure.",
    ],
    output: "More grounded academic and career context for the dashboards.",
    mistakes: [
      "Uploading a file to the wrong category.",
      "Assuming every uploaded file immediately creates structured evidence; some flows remain summary-first.",
    ],
    privacy: "Uploaded documents become part of the auditable student evidence record used by the current account context.",
  },
  {
    category: "Communication translator",
    title: "Translate family concerns constructively",
    role: "parent",
    status: "available",
    summary: "The communication translator helps parents reframe concerns into student-appropriate language without hiding the parent origin.",
    whenToUse: "Use this when a topic matters, but the usual wording tends to create friction or defensiveness.",
    youNeed: "A saved parent communication baseline plus the concern, context, and desired outcome.",
    howToUse: [
      "Save the concern first, even if it is context only.",
      "Generate a translation strategy and review the what-not-to-say guidance.",
      "Only save or send a draft when consent and review conditions allow it.",
    ],
    output: "A communication strategy, message draft, and audit trail.",
    mistakes: [
      "Using the tool to disguise parent involvement.",
      "Skipping consent and sensitivity checks because the draft sounds calmer.",
    ],
    privacy: "Parent-originated content should remain transparent and may be withheld when consent or sensitivity rules require it.",
  },
  {
    category: "Parent briefs",
    title: "Generate the monthly parent update",
    role: "parent",
    status: "available",
    summary: "The monthly brief saves a parent-friendly summary for the current reporting month.",
    whenToUse: "Use this when you want a stable monthly snapshot instead of only the live dashboard state.",
    youNeed: "A working parent dashboard context tied to the student record.",
    howToUse: [
      "Open the Parent dashboard.",
      "Use Generate / refresh this month in the monthly parent update section.",
      "Review the saved brief after it is generated.",
    ],
    output: "A saved month-specific parent summary with risks, actions, and context.",
    mistakes: [
      "Treating an old monthly brief as the current live state without checking the dashboard above it.",
    ],
  },
  {
    category: "Action planning",
    title: "Turn the score into next steps",
    role: "shared",
    status: "available",
    summary: "The most useful output of the platform is the next best move, not the raw number by itself.",
    whenToUse: "Use this after reviewing status and evidence quality.",
    youNeed: "A current score or at least a current target and available evidence.",
    howToUse: [
      "Start with the top recommendation before trying to optimize everything at once.",
      "Use deadlines and network notes to make actions more concrete.",
      "Use scenario guidance when a real decision needs a short plan.",
    ],
    output: "A smaller set of actions that match the student’s current evidence and target.",
    mistakes: [
      "Trying to close every gap at once.",
      "Ignoring the main risk because other sections feel more interesting.",
    ],
  },
  {
    category: "Account and workspace switching",
    title: "Use the account menu",
    role: "shared",
    status: "available",
    summary: "The upper-right account menu handles sign-in, sign-out, workspace access, and persona preview when that testing mode is allowed.",
    whenToUse: "Use this whenever you need to open a workspace, sign in, or switch preview context.",
    youNeed: "A configured sign-in provider for real auth. Persona preview only appears for specifically allowed testing accounts.",
    howToUse: [
      "Open the menu in the upper-right corner.",
      "Use Continue with Google if you are signed out.",
      "Use Switch workspace/persona only if your account explicitly allows preview mode.",
    ],
    output: "A cleaner, centralized account-control flow.",
    mistakes: [
      "Assuming persona preview is available to every account.",
      "Expecting settings to be fully implemented today; that area is still limited.",
    ],
  },
  {
    category: "Privacy, consent, and data use",
    title: "Understand privacy and consent boundaries",
    role: "shared",
    status: "available",
    summary: "The app should make truth, consent, and delivery status explicit instead of silently inventing certainty.",
    whenToUse: "Use this when reviewing family communication, uploads, or inferred academic data.",
    youNeed: "The specific screen or workflow you are using.",
    howToUse: [
      "Check whether a message is direct, translated, withheld, or saved as context only.",
      "Review whether evidence is direct, inferred, fallback, or unresolved.",
      "Use uploaded official sources whenever you need the strongest provenance.",
    ],
    output: "A clearer understanding of what the platform knows, what it inferred, and what it should not send.",
    mistakes: [
      "Treating all system output as equally verified.",
      "Assuming consent for family communication when the student has not granted it.",
    ],
  },
];

const statusColors: Record<HelpTopic["status"], { background: string; color: string }> = {
  available: { background: "#e8f7f1", color: "#166534" },
  "in progress": { background: "#fff6df", color: "#a16207" },
  "coming soon": { background: "#f1f5f9", color: "#475569" },
};

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function HelpPage() {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<HelpTopic["role"] | "all">("all");

  const filteredTopics = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return topics.filter((topic) => {
      if (roleFilter !== "all" && topic.role !== "shared" && topic.role !== roleFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        topic.category,
        topic.title,
        topic.summary,
        topic.whenToUse,
        topic.youNeed,
        topic.output,
        topic.privacy || "",
        ...topic.howToUse,
        ...topic.mistakes,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [query, roleFilter]);

  return (
    <AppShell
      title="Help and documentation"
      subtitle="Use this library to understand what each feature does, when to use it, what information it needs, and what it produces."
    >
      <SectionCard
        title="Find the right guide"
        subtitle="Search by feature, role, or task. Status labels stay honest about what is available right now."
        tone="highlight"
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 12,
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 700, color: "#183153" }}>Search help</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search dashboards, documents, translator, consent..."
              style={{
                width: "100%",
                borderRadius: 14,
                border: "1px solid #d0d8e8",
                padding: "12px 14px",
                fontSize: 15,
                background: "#ffffff",
              }}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 700, color: "#183153" }}>Role focus</span>
            <select
              value={roleFilter}
              onChange={(event) =>
                setRoleFilter(event.target.value as HelpTopic["role"] | "all")
              }
              style={{
                width: "100%",
                borderRadius: 14,
                border: "1px solid #d0d8e8",
                padding: "12px 14px",
                fontSize: 15,
                background: "#ffffff",
              }}
            >
              <option value="all">All roles</option>
              <option value="student">Student</option>
              <option value="parent">Parent</option>
              <option value="coach">Coach</option>
              <option value="shared">Shared</option>
            </select>
          </label>
        </div>
      </SectionCard>

      <div style={{ display: "grid", gap: 16 }}>
        {filteredTopics.map((topic) => (
          <SectionCard
            key={`${topic.category}-${topic.title}`}
            title={topic.title}
            subtitle={topic.summary}
            tone="default"
            actions={
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  borderRadius: 999,
                  background: statusColors[topic.status].background,
                  color: statusColors[topic.status].color,
                  fontWeight: 800,
                  textTransform: "capitalize",
                }}
              >
                {topic.status}
              </div>
            }
          >
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ color: "#64748b", fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.05 }}>
                {topic.category} · {titleCase(topic.role)}
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <strong>When to use it</strong>
                <p style={{ margin: 0, color: "#475569", lineHeight: 1.65 }}>{topic.whenToUse}</p>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <strong>What you need</strong>
                <p style={{ margin: 0, color: "#475569", lineHeight: 1.65 }}>{topic.youNeed}</p>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <strong>How to complete the task</strong>
                <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 8 }}>
                  {topic.howToUse.map((step) => (
                    <li key={step} style={{ lineHeight: 1.6 }}>
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <strong>What the system produces</strong>
                <p style={{ margin: 0, color: "#475569", lineHeight: 1.65 }}>{topic.output}</p>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <strong>Common mistakes</strong>
                <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 8 }}>
                  {topic.mistakes.map((mistake) => (
                    <li key={mistake} style={{ lineHeight: 1.6 }}>
                      {mistake}
                    </li>
                  ))}
                </ul>
              </div>
              {topic.privacy ? (
                <div style={{ display: "grid", gap: 8 }}>
                  <strong>Privacy or consent notes</strong>
                  <p style={{ margin: 0, color: "#475569", lineHeight: 1.65 }}>{topic.privacy}</p>
                </div>
              ) : null}
            </div>
          </SectionCard>
        ))}
      </div>
    </AppShell>
  );
}
