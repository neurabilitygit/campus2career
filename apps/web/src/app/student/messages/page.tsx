"use client";

import Link from "next/link";
import { AppShell } from "../../../components/layout/AppShell";
import { SectionCard } from "../../../components/layout/SectionCard";
import { RequireRole } from "../../../components/RequireRole";
import { useApiData } from "../../../hooks/useApiData";
import { useAuthContext } from "../../../hooks/useAuthContext";
import { buildDirectAddressName } from "../../../lib/personalization";

type StudentCommunicationMessagesResponse = {
  ok: boolean;
  count: number;
  messages: Array<{
    communicationMessageDraftId: string;
    selectedChannel: string;
    messageBody: string;
    deliveredAt?: string | null;
    createdAt?: string | null;
  }>;
};

function titleCase(value: string | null | undefined) {
  if (!value) return "Unknown";
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export default function StudentMessagesPage() {
  const auth = useAuthContext();
  const messages = useApiData<StudentCommunicationMessagesResponse>(
    "/students/me/communication-messages",
    true
  );
  const directName =
    buildDirectAddressName({
      preferredName: auth.data?.context?.authenticatedPreferredName,
      firstName: auth.data?.context?.authenticatedFirstName,
      lastName: auth.data?.context?.authenticatedLastName,
      fallback: "you",
    }) || "you";

  return (
    <AppShell
      title="Family messages"
      subtitle={`${directName}, review translated parent-originated messages that were explicitly delivered through the system. These should stay transparent, respectful, and easy to read.`}
    >
      <RequireRole expectedRoles={["student", "admin"]} fallbackTitle="Student sign-in required">
        <SectionCard
          title="How this works"
          subtitle="This area is for review, not pressure."
          tone="highlight"
        >
          <div style={{ display: "grid", gap: 10, color: "#334155", lineHeight: 1.7 }}>
            <div>Only translated parent-originated messages that were actually delivered through the system appear here.</div>
            <div>The system should stay transparent about the parent origin and should not disguise those messages as neutral system advice.</div>
            <div>You can update your communication preferences from the <Link href="/profile">profile</Link> page.</div>
          </div>
        </SectionCard>

        <SectionCard
          title="Received messages"
          subtitle="Newest first."
        >
          {messages.loading ? <p>Loading messages...</p> : null}
          {messages.error ? <p style={{ color: "crimson" }}>{messages.error}</p> : null}
          {!messages.loading && !messages.error && !(messages.data?.messages || []).length ? (
            <p style={{ margin: 0, color: "#52657d", lineHeight: 1.7 }}>
              No translated family messages have been delivered through the system yet.
            </p>
          ) : null}

          <div style={{ display: "grid", gap: 14 }}>
            {(messages.data?.messages || []).map((message) => (
              <article
                key={message.communicationMessageDraftId}
                style={{
                  borderRadius: 18,
                  border: "1px solid #dbe4f0",
                  background: "#ffffff",
                  padding: 18,
                  display: "grid",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <strong>{titleCase(message.selectedChannel)}</strong>
                  <small style={{ color: "#64748b" }}>
                    {message.deliveredAt
                      ? `Delivered ${new Date(message.deliveredAt).toLocaleString()}`
                      : message.createdAt
                        ? `Saved ${new Date(message.createdAt).toLocaleString()}`
                        : ""}
                  </small>
                </div>
                <div style={{ color: "#0f172a", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
                  {message.messageBody}
                </div>
              </article>
            ))}
          </div>
        </SectionCard>
      </RequireRole>
    </AppShell>
  );
}
