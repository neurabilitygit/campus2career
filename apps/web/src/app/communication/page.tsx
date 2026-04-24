"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { SectionCard } from "../../components/layout/SectionCard";
import { SessionGate } from "../../components/SessionGate";
import { FieldInfoLabel } from "../../components/forms/FieldInfoLabel";
import { useAuthContext } from "../../hooks/useAuthContext";
import { useApiData, useApiJsonPost } from "../../hooks/useApiData";
import { buildDirectAddressName, formatNamedReference } from "../../lib/personalization";

type ScenarioResponse = {
  response?: {
    mode: "llm" | "fallback";
    headline: string;
    summary: string;
    whyThisMattersNow: string;
    recommendedActions: Array<{ title: string; rationale: string; timeframe: string }>;
    risksToWatch: string[];
    basedOn: string[];
    encouragement: string;
    providerError?: string | null;
  };
};

type StudentMessagesResponse = {
  messages: Array<{
    communicationMessageDraftId: string;
    selectedChannel: string;
    messageBody: string;
    deliveredAt?: string | null;
  }>;
};

const DEFAULT_SCENARIO_QUESTION = "What should I focus on next to strengthen my path this month?";

function StudentCommunicationView() {
  const [draftQuestion, setDraftQuestion] = useState(DEFAULT_SCENARIO_QUESTION);
  const [draftStyle, setDraftStyle] = useState("direct");
  const [requested, setRequested] = useState(false);
  const auth = useAuthContext();
  const messages = useApiData<StudentMessagesResponse>("/students/me/communication-messages", true);
  const body = useMemo(
    () => ({
      scenarioQuestion: draftQuestion.trim() || DEFAULT_SCENARIO_QUESTION,
      communicationStyle: draftStyle,
    }),
    [draftQuestion, draftStyle]
  );
  const scenario = useApiJsonPost<ScenarioResponse>("/v1/chat/scenario/live", body, requested, {
    timeoutMs: 30000,
  });

  const name =
    buildDirectAddressName({
      preferredName: auth.data?.context?.authenticatedPreferredName,
      firstName: auth.data?.context?.authenticatedFirstName,
      lastName: auth.data?.context?.authenticatedLastName,
      fallback: "you",
    }) || "you";

  return (
    <>
      <SectionCard
        title="Communication and guidance"
        subtitle={`${name}, this is the fastest place to ask for guidance and review any translated family messages that were explicitly delivered to you.`}
      >
        <div style={{ display: "grid", gap: 16 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <FieldInfoLabel
              label="What do you want help thinking through?"
              info="Ask about a real decision, obstacle, or next step."
              example="Should I focus on one analytics project or networking first?"
            />
            <textarea
              rows={4}
              style={{ width: "100%", borderRadius: 14, border: "1px solid #d0d8e8", padding: "12px 14px", fontFamily: "inherit" }}
              value={draftQuestion}
              onChange={(event) => setDraftQuestion(event.target.value)}
            />
          </label>

          <label style={{ display: "grid", gap: 6, maxWidth: 280 }}>
            <FieldInfoLabel
              label="How should the response feel?"
              info="Choose the style that would be easiest to use right now."
              example="Direct"
            />
            <select
              style={{ borderRadius: 14, border: "1px solid #d0d8e8", padding: "12px 14px", background: "#fff" }}
              value={draftStyle}
              onChange={(event) => setDraftStyle(event.target.value)}
            >
              <option value="direct">Direct</option>
              <option value="supportive">Supportive</option>
              <option value="coaching">Coaching</option>
            </select>
          </label>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button type="button" className="ui-button ui-button--primary" onClick={() => setRequested(true)}>
              {scenario.loading ? "Processing…" : "Get guidance"}
            </button>
            <Link href="/student?section=guidance" className="ui-button ui-button--secondary">
              Open full guidance view
            </Link>
          </div>

          {scenario.loading ? <p>Processing guidance...</p> : null}
          {scenario.error ? <p style={{ color: "crimson" }}>{scenario.error}</p> : null}
          {!scenario.loading && !scenario.error && scenario.data?.response ? (
            <div style={{ display: "grid", gap: 14, padding: 18, borderRadius: 18, background: "#f8fbff", border: "1px solid #dbe4f0" }}>
              <strong style={{ fontSize: 20 }}>{scenario.data.response.headline}</strong>
              <p style={{ margin: 0, color: "#334155", lineHeight: 1.7 }}>{scenario.data.response.summary}</p>
              <div>
                <strong>Recommended actions</strong>
                <ul style={{ marginBottom: 0 }}>
                  {scenario.data.response.recommendedActions.map((action) => (
                    <li key={`${action.title}-${action.timeframe}`}>{action.title}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        title="Family messages"
        subtitle="Only translated family messages that were explicitly delivered through the system appear here."
      >
        {messages.loading ? <p>Loading messages...</p> : null}
        {messages.error ? <p style={{ color: "crimson" }}>{messages.error}</p> : null}
        {!messages.loading && !messages.error && !(messages.data?.messages || []).length ? (
          <p>No translated family messages have been delivered through the system yet.</p>
        ) : null}
        <div style={{ display: "grid", gap: 12 }}>
          {(messages.data?.messages || []).slice(0, 3).map((message) => (
            <div key={message.communicationMessageDraftId} style={{ padding: 16, borderRadius: 16, background: "#fff", border: "1px solid #dbe4f0" }}>
              <div style={{ fontWeight: 700 }}>{message.selectedChannel}</div>
              <div style={{ color: "#334155", marginTop: 6, lineHeight: 1.6 }}>{message.messageBody}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16 }}>
          <Link href="/student/messages">Open full message history</Link>
        </div>
      </SectionCard>
    </>
  );
}

function ParentCommunicationView() {
  const auth = useAuthContext();
  const studentLabel = formatNamedReference(
    {
      preferredName: auth.data?.context?.studentPreferredName,
      firstName: auth.data?.context?.studentFirstName,
      lastName: auth.data?.context?.studentLastName,
    },
    { fallback: "your student", preferPreferred: true }
  );

  return (
    <>
      <SectionCard
        title="Communication translator"
        subtitle={`Use this area to translate concerns into something ${studentLabel} is more likely to receive constructively.`}
      >
        <div style={{ display: "grid", gap: 14 }}>
          <div className="ui-soft-panel">
            <strong>Translate a concern</strong>
            <p style={{ margin: "6px 0 0 0", color: "#52657d", lineHeight: 1.6 }}>
              Save context, generate a translation strategy, and review what not to say before anything is drafted or delivered.
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/parent/communication" className="ui-button ui-button--primary">
              Open translator
            </Link>
            <Link href="/parent/history" className="ui-button ui-button--secondary">
              Open communication history
            </Link>
          </div>
        </div>
      </SectionCard>
    </>
  );
}

function CoachCommunicationView() {
  const auth = useAuthContext();
  const studentLabel = formatNamedReference(
    {
      preferredName: auth.data?.context?.studentPreferredName,
      firstName: auth.data?.context?.studentFirstName,
      lastName: auth.data?.context?.studentLastName,
    },
    { fallback: "this student", preferPreferred: true }
  );

  return (
    <SectionCard
      title="Coach communication tools"
      subtitle={`Use this area to manage follow-up drafts, visible communication guidance, and role-appropriate outreach for ${studentLabel}.`}
    >
      <div style={{ display: "grid", gap: 14 }}>
        <div className="ui-soft-panel">
          <strong>Open outbound drafts in the coach workspace</strong>
          <p style={{ margin: "6px 0 0 0", color: "#52657d", lineHeight: 1.6 }}>
            Drafts and mock-send actions remain inside the coach workspace so they stay tied to the selected student and the current review context.
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/coach" className="ui-button ui-button--primary">
            Open coach workspace
          </Link>
        </div>
      </div>
    </SectionCard>
  );
}

function CommunicationContent() {
  const auth = useAuthContext();
  const role = auth.data?.context?.authenticatedRoleType;
  const title =
    role === "student"
      ? "Messages & chat"
      : role === "parent"
        ? "Communication"
        : role === "coach"
          ? "Communication"
          : "Communication";

  return (
    <AppShell
      title={title}
      subtitle="Communication tools now live in their own navigation area so guidance, translated messages, and outreach workflows are easier to find."
    >
      {role === "student" ? <StudentCommunicationView /> : null}
      {role === "parent" ? <ParentCommunicationView /> : null}
      {role === "coach" ? <CoachCommunicationView /> : null}
      {!role ? <SectionCard title="Communication"><p>We could not determine your account role yet.</p></SectionCard> : null}
    </AppShell>
  );
}

export default function CommunicationPage() {
  return (
    <SessionGate fallbackTitle="Sign in required">
      <CommunicationContent />
    </SessionGate>
  );
}
