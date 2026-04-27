"use client";

import { useMemo, useState } from "react";
import { FieldInfoLabel } from "../../components/forms/FieldInfoLabel";
import { AppShell } from "../../components/layout/AppShell";
import { SectionCard } from "../../components/layout/SectionCard";
import { useAuthContext } from "../../hooks/useAuthContext";
import { launchIntroOnboardingReplay } from "../../lib/introOnboarding";
import { launchRoleIntroOnboardingReplay } from "../../lib/roleIntroOnboarding";

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
    title: "Take the introductory tour",
    role: "shared",
    status: "available",
    summary: "Newly registered users see a shared introduction first, then a shorter role walkthrough once the system knows whether the account is currently operating as a student, parent, or coach.",
    whenToUse: "Use this after first registration or anytime you want to replay the shared overview or your role walkthrough.",
    youNeed: "A signed-in account. Existing users can replay both tours manually from Help or the account menu.",
    howToUse: [
      "After a brand-new registration, the welcome splash appears before the shared orientation.",
      "The shared orientation now covers the workspace shell, navigation, profile, household setup, academic path, documents and evidence, Career Goal, communication, and help.",
      "After the shared orientation finishes, a shorter role walkthrough explains the most important student, parent, or coach features for the current workspace.",
      "Use Next, Back, Skip, or Finish to move at your own pace.",
      "Replay intro for the shared overview, or replay role walkthrough for the role-specific tour.",
    ],
    output: "A lighter first-run experience that starts broad, then becomes role-aware after sign-in context resolves.",
    mistakes: [
      "Expecting the intro to appear after every normal login.",
      "Skipping the tour and forgetting that both versions can be relaunched later from Help.",
    ],
  },
  {
    category: "Getting started",
    title: "Understand roles and household setup",
    role: "shared",
    status: "available",
    summary: "Rising Senior uses a parent-created household model with invitation and request-based access for students and coaches.",
    whenToUse: "Use this when you want to understand why the same sign-in can lead to different workspaces and how household membership drives permissions.",
    youNeed: "A signed-in account helps because role-aware navigation and workspace routing depend on resolved account context.",
    howToUse: [
      "Parents create households and become the first household administrators.",
      "Students and coaches join by invitation, or by requesting access to an existing parent-managed household.",
      "After sign-in, the system resolves the current workspace role from active household membership first and falls back to the account role only when membership wiring is incomplete.",
      "A household usually centers on one student and can include a parent or guardian plus an optional coach relationship.",
      "Open Household administration to manage invitations, join requests, persona assignments, and feature-level permissions.",
    ],
    output: "A clearer understanding of how parent, student, coach, and admin access relate to the same underlying student record without exposing unrelated household data.",
    mistakes: [
      "Assuming one account should freely open every workspace without a matching role.",
      "Assuming hidden navigation means a broken UI; it often means the capability is not enabled for the current role or household.",
    ],
  },
  {
    category: "Getting started",
    title: "Choose the correct signup flow",
    role: "shared",
    status: "available",
    summary: "Signup now branches into parent household creation, student household access requests, or coach household access requests.",
    whenToUse: "Use this when you are creating a new account or accepting an invitation.",
    youNeed: "Google sign-in works today. Apple sign-in and email/password are visible as future options but are not active yet.",
    howToUse: [
      "Parents sign in and create the household first.",
      "Students use an invitation link when possible. If no invitation exists, they request access using the parent email tied to the household.",
      "Coaches use an invitation link when possible. If no invitation exists, they request access to the parent-managed household.",
      "If an invitation link is present, Rising Senior validates the token, checks expiration, and then attaches the signed-in account to the correct household and persona.",
    ],
    output: "A cleaner first-run experience that wires the account into the correct household and permission model before normal work begins.",
    mistakes: [
      "Expecting students or coaches to create households directly.",
      "Using an invitation link while signed in as a different email than the invited address.",
    ],
  },
  {
    category: "Administration",
    title: "Manage household permissions",
    role: "shared",
    status: "available",
    summary: "Household administration shows members, pending invitations, pending join requests, and feature-level capability controls.",
    whenToUse: "Use this when you need to invite a student or coach, review a join request, or change what a user can see and do.",
    youNeed: "A parent household administrator or a platform administrator account.",
    howToUse: [
      "Open Household administration from the left navigation or account menu.",
      "Invite a student or coach by email to generate a secure, expiring invite link.",
      "If SendGrid invitation delivery is configured, the system emails the invite directly. In local development, the secure invite link is logged instead.",
      "Review join requests and approve only the users who should join the household.",
      "Change a user’s primary persona and feature-level permissions with the capability checkboxes.",
      "If a capability is denied, the related navigation item, page access, and API access are all removed or blocked together.",
      "The super administrator also sees a read-only cross-household user directory for platform-level troubleshooting.",
    ],
    output: "A single place to manage household membership and explain why certain features appear or disappear for a user.",
    mistakes: [
      "Granting a feature without its dependent context and expecting it to work in isolation.",
      "Assuming a hidden navigation item is still usable by direct URL; denied routes are blocked.",
    ],
  },
  {
    category: "Getting started",
    title: "Open the right workspace",
    role: "shared",
    status: "available",
    summary: "Use the app shell to move between home, your role-specific workspace, communication, profile, documents, and help.",
    whenToUse: "Start here when you are new to the platform or returning after some time away.",
    youNeed: "A signed-in account is helpful, but the help library is open without sign-in.",
    howToUse: [
      "Use the left navigation to choose the workspace and tools your role is allowed to use.",
      "Open Profile when you want to update account details, optional personal context, or role-specific preferences.",
      "Open Messages & chat when you want chatbot guidance, translated family communication, or role-specific communication tools.",
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
    category: "Getting started",
    title: "Update your profile and personalization",
    role: "shared",
    status: "available",
    summary: "Each role now has its own profile screen so names, communication preferences, and optional personal context stay accurate.",
    whenToUse: "Use this when your name, family context, coaching identity, or optional preferences need to be updated.",
    youNeed: "A signed-in account. Sensitive fields remain optional.",
    howToUse: [
      "Open Profile from the left navigation or the account menu.",
      "Students can update name and optional personal-choice fields without touching system-managed records.",
      "Parents can update family context, optional demographic details, and communication preferences.",
      "Coaches can update professional identity, specialties, and communication preferences.",
    ],
    output: "More accurate personalization, clearer attribution, and profile-aware help across the app.",
    mistakes: [
      "Assuming optional fields are required.",
      "Expecting hidden system or scoring fields to be editable from the profile screen.",
    ],
    privacy: "Optional demographic, neurodivergence, housing, and family-structure fields are user-controlled and do not need to be disclosed.",
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
      "Open Next steps to review risks, actions, and Career Goal guidance.",
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
    summary: "The coach workspace is built for roster management, selected-student review, and turning insight into notes, recommendations, and actions.",
    whenToUse: "Use this when you want to review one assigned student quickly and turn that review into visible next steps.",
    youNeed: "A coach account or an authorized preview context.",
    howToUse: [
      "Start with Coach roster to pick the assigned student you want to review.",
      "Use the selected student workspace to see evidence gaps, outcomes, flags, notes, and recommendations in one place.",
      "Create notes, findings, recommendations, action items, and draft follow-up messages from the same workspace.",
    ],
    output: "A faster path to preparing for the next coaching session without rebuilding the student picture by hand.",
    mistakes: [
      "Assuming coaches can open any student; only assigned students appear in the roster.",
      "Making notes visible to parents or students before checking the selected visibility setting.",
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
      "The system now checks seeded data first, then tries school-site discovery, then LLM-assisted recovery, and finally manual entry or PDF upload when automation is still weak.",
      "If the system cannot find a reliable catalog path, upload an official program PDF.",
      "Review the Academic Evidence card and Degree Requirements Review card later to confirm whether the requirement graph is bound, complete, and visually verified.",
    ],
    output: "A more credible academic-progress read tied to real program requirements.",
    mistakes: [
      "Leaving the school path incomplete and expecting strong requirement matching.",
      "Uploading unofficial files when an official catalog or requirement PDF is available.",
    ],
  },
  {
    category: "Academic progress",
    title: "Review and verify degree requirements",
    role: "shared",
    status: "available",
    summary: "Curriculum verification makes sure the system does not treat degree requirements as confirmed until someone has visually reviewed them.",
    whenToUse: "Use this when curriculum information appears on the dashboard or when the dashboard warns that requirements are missing or unverified.",
    youNeed: "A saved school path plus either discovered requirements or an uploaded degree-requirement PDF.",
    howToUse: [
      "Open the Academic Evidence card from the dashboard first to see which source produced the current curriculum path.",
      "Then open the Degree Requirements Review card from the dashboard.",
      "Inspect the institution, program, major, catalog year, requirement groups, and parsing notes.",
      "If requirements are missing, ask the system to populate them or upload an official program PDF.",
      "Only check the verification box after the curriculum looks complete enough to use for scoring.",
    ],
    output: "A verified curriculum record that lets scoring treat degree requirements as reviewed rather than provisional.",
    mistakes: [
      "Treating unverified requirements as final just because the dashboard found a curriculum source.",
      "Skipping the PDF upload when the discovery result still says the source is incomplete or uncertain.",
    ],
    privacy: "Verification records keep source attribution and review timing so the platform can distinguish confirmed curriculum from provisional curriculum.",
  },
  {
    category: "Career Goal",
    title: "Compare real job targets with Career Goal",
    role: "shared",
    status: "available",
    summary: "Career Goal lets you save multiple named job-target goals, paste a real job description, and compare the student record against each one without overwriting the general baseline.",
    whenToUse: "Use this when you want role-specific guidance instead of only a broad readiness view.",
    youNeed: "A saved student record and, ideally, a pasted job description or a clear target profession.",
    howToUse: [
      "Open Career Goal from the left navigation.",
      "Create a unique Career Goal name, then paste a job description or define a manual target.",
      "Adjust role, sector, geography, or other assumptions that should travel with that Career Goal.",
      "Save the Career Goal to make it active, then review the result summary, strengths, gaps, missing evidence, and next actions.",
      "Use the comparison view to place two saved Career Goals side by side before deciding which target should stay active.",
      "Use duplicate, save as new, re-run, or delete when you want to compare alternative directions without losing student data.",
    ],
    output: "A job-specific readiness view that can change the active dashboard context and make recommendations more targeted.",
    mistakes: [
      "Assuming the active Career Goal replaces the student record itself; it only changes the current job-target frame.",
      "Forgetting to re-run a Career Goal after major, curriculum, or evidence changes.",
    ],
    privacy: "Deleting a Career Goal removes the saved Career Goal record only. It does not delete student profile, academic evidence, uploads, or household data.",
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
      "Treat missing or unverified curriculum as a scoring-confidence issue, not automatically as poor student performance.",
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
    category: "Communication",
    title: "Build the communication profile over time",
    role: "shared",
    status: "available",
    summary: "Communication is now a core workspace where parent insight, student preferences, translation help, and coach-visible summaries all live together.",
    whenToUse: "Use this when family support is getting lost in friction, shutdown, defensiveness, or repeated misunderstandings.",
    youNeed: "A signed-in role with Communication access. Prompts can be answered gradually.",
    howToUse: [
      "Open Communication from the left navigation.",
      "Parents can add deeper context about worries, strengths, friction points, and what has or has not worked before.",
      "Students can answer shorter prompts about reminders, tone, stress triggers, and what adults misunderstand.",
      "Edit or delete saved responses when your understanding changes instead of leaving outdated context behind.",
      "Review system-learned communication patterns and confirm or reject them so future guidance stays accurate.",
      "Use the translation helper when you want the system to rewrite a message more clearly and with less friction.",
      "Rate translations as helpful, too direct, too soft, or off-target so future guidance improves.",
      "Check the Communication analytics cards to see which prompts are getting answered, skipped, or flagged for revisit and how translation feedback is trending.",
    ],
    output: "Role-aware communication profiles, translation history, and clearer tone guidance across the system.",
    mistakes: [
      "Treating inferred communication themes as if the user explicitly said them.",
      "Using the translator to hide who a message came from.",
      "Assuming every saved note is visible to every household role.",
    ],
    privacy: "Each communication response has a visibility scope. Private or system-only items may guide tone without being shown directly to another person.",
  },
  {
    category: "Communication",
    title: "Use the parent-to-student translator respectfully",
    role: "parent",
    status: "available",
    summary: "Parents can rewrite reminders, worries, and check-ins so they are more likely to land without pressure, shame, or escalation.",
    whenToUse: "Use this when a topic matters, but the usual wording tends to create friction or defensiveness.",
    youNeed: "The concern you want to raise plus enough communication context for the system to understand how this family dynamic usually works.",
    howToUse: [
      "Open Communication and choose the translator section.",
      "Paste what you actually want to say first.",
      "Review the rewritten, shorter, softer, and more direct versions.",
      "Check the rationale, risk flags, and suggested next step before using the message.",
    ],
    output: "A clearer student-facing message plus an explanation of why the wording changed.",
    mistakes: [
      "Using the tool to disguise parent involvement.",
      "Ignoring risk flags when the system is telling you the message may still escalate conflict.",
    ],
    privacy: "Parent-originated content should remain transparent and may be softened for clarity, but not used to manipulate the student.",
  },
  {
    category: "Communication",
    title: "Tell the system what actually helps you",
    role: "student",
    status: "available",
    summary: "Students can answer low-friction prompts that help the system and adults communicate in ways that feel more useful and less annoying.",
    whenToUse: "Use this whenever reminders, pressure, or planning conversations are landing badly.",
    youNeed: "Only your own perspective. Short answers are enough.",
    howToUse: [
      "Open Communication and use My Communication Preferences or What I Wish Adults Understood.",
      "Answer only the prompts that feel useful right now.",
      "Choose a visibility level so private responses can stay private or summary-only.",
      "Use the Parent Message Helper when you want help saying something clearly to an adult.",
    ],
    output: "Saved student communication preferences, visibility-scoped insights, and better tone guidance in later support.",
    mistakes: [
      "Assuming skipped prompts must be answered now.",
      "Forgetting that visibility controls affect what other people may see directly.",
    ],
    privacy: "Private student responses can guide system tone without automatically becoming visible to a parent or coach.",
  },
  {
    category: "Communication",
    title: "Use coach-visible communication context carefully",
    role: "coach",
    status: "available",
    summary: "Coaches can see authorized communication summaries and friction-reduction cues for the currently selected student.",
    whenToUse: "Use this before drafting outreach, giving accountability feedback, or stepping into a tense family dynamic.",
    youNeed: "A coach relationship that includes Communication access for the selected student.",
    howToUse: [
      "Open Communication and review the Communication Context section.",
      "Use shared themes and friction signals to choose calmer phrasing and timing.",
      "Do not assume missing profile data means there is no communication issue; it may simply be incomplete.",
    ],
    output: "A limited, role-safe communication summary with coach suggestions and missing-profile alerts.",
    mistakes: [
      "Expecting raw private family notes to appear in coach view.",
      "Treating coach-visible summaries as permission to override household boundaries.",
    ],
    privacy: "Coach view is limited to authorized summaries and permitted details only for the selected student context.",
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
      "Use Career Goal guidance when a real decision needs a short plan.",
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
    summary: "The upper-right account menu handles sign-in, sign-out, workspace access, and quick links to profile and communication.",
    whenToUse: "Use this whenever you need to open a workspace, sign in, or switch preview context.",
    youNeed: "A configured sign-in provider for real auth. Persona preview only appears for specifically allowed testing accounts.",
    howToUse: [
      "Open the menu in the upper-right corner.",
      "Use Open sign-in if you are signed out, then continue through the dedicated Google sign-in screen.",
      "Use Profile to edit role-specific account details and optional personalization fields.",
      "Use Messages & chat when you need communication tools without digging into another workspace first.",
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
  const auth = useAuthContext();
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
        actions={
          auth.isAuthenticated ? (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                className="ui-button ui-button--primary"
                onClick={launchIntroOnboardingReplay}
              >
                Replay intro
              </button>
              {auth.data?.context?.authenticatedRoleType ? (
                <button
                  type="button"
                  className="ui-button ui-button--secondary"
                  onClick={launchRoleIntroOnboardingReplay}
                >
                  Replay role walkthrough
                </button>
              ) : null}
            </div>
          ) : null
        }
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 12,
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <FieldInfoLabel
              label="Search help"
              info="Search guides by feature, task, or keyword."
              example="transcript, parent brief, coach notes"
            />
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
            <FieldInfoLabel
              label="Role focus"
              info="Limit guides to the role you want help with."
              example="Parent"
            />
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
