"use client";

import { useMemo, useState } from "react";
import { AppShell } from "../../../components/layout/AppShell";
import { SectionCard } from "../../../components/layout/SectionCard";
import { RequireRole } from "../../../components/RequireRole";
import { FieldInfoLabel } from "../../../components/forms/FieldInfoLabel";
import { useAuthContext } from "../../../hooks/useAuthContext";
import { useApiData } from "../../../hooks/useApiData";
import { apiFetch } from "../../../lib/apiClient";
import { formatStudentReference, normalizeFirstName } from "../../../lib/studentName";

type ParentProfileResponse = {
  ok: boolean;
  profile: {
    consentAcknowledged?: boolean;
  } | null;
};

type EntryRecord = {
  parentCommunicationEntryId: string;
  category: string;
  status: string;
  urgency: string;
  deliveryIntent: string;
  parentConcerns?: string | null;
  preferredOutcome?: string | null;
  createdAt?: string;
};

type EntriesResponse = {
  ok: boolean;
  count: number;
  entries: EntryRecord[];
};

type StrategyRecord = {
  communicationStrategyId: string;
  consentState: string;
  status: string;
  generationMode: "llm" | "fallback";
  recommendedChannel?: string | null;
  recommendedTone?: string | null;
  recommendedTiming?: string | null;
  recommendedFrequency?: string | null;
  defensivenessRisk: string;
  reasonForRecommendation: string;
  studentFacingMessageDraft: string;
  parentFacingExplanation: string;
  whatNotToSay: string;
  humanReviewRecommended: boolean;
  withholdDelivery: boolean;
  withholdReason?: string | null;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 14,
  border: "1px solid #d0d8e8",
  padding: "12px 14px",
  fontSize: 15,
  background: "#ffffff",
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  fontWeight: 700,
  color: "#183153",
};

function titleCase(value: string | null | undefined) {
  if (!value) return "Unknown";
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export default function ParentCommunicationPage() {
  const auth = useAuthContext();
  const profile = useApiData<ParentProfileResponse>("/parents/me/communication-profile", true);
  const [entriesNonce, setEntriesNonce] = useState(0);
  const entries = useApiData<EntriesResponse>("/parents/me/communication-entries", true, entriesNonce);
  const [selectedEntryId, setSelectedEntryId] = useState<string>("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [strategy, setStrategy] = useState<StrategyRecord | null>(null);
  const [draftStatus, setDraftStatus] = useState("");
  const [form, setForm] = useState({
    category: "career_concern",
    urgency: "medium",
    deliveryIntent: "context_only",
    factsStudentShouldKnow: "",
    questionsParentWantsAnswered: "",
    parentConcerns: "",
    recurringCommunicationFailures: "",
    defensiveTopics: "",
    priorAttemptsThatDidNotWork: "",
    preferredOutcome: "",
    freeformContext: "",
  });

  const sortedEntries = entries.data?.entries || [];
  const activeEntryId = selectedEntryId || sortedEntries[0]?.parentCommunicationEntryId || "";
  const activeEntry = useMemo(
    () => sortedEntries.find((entry) => entry.parentCommunicationEntryId === activeEntryId) || null,
    [activeEntryId, sortedEntries]
  );
  const studentFirstName = normalizeFirstName(auth.data?.context?.studentFirstName);

  async function saveEntry() {
    setStatus("Saving communication context...");
    setError("");
    try {
      const response = await apiFetch("/parents/me/communication-entries", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setSelectedEntryId(response.parentCommunicationEntryId);
      setEntriesNonce((value) => value + 1);
      setStatus("Saved. You can translate this concern now or keep it as context only.");
    } catch (err) {
      setStatus("");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function translateEntry() {
    if (!activeEntryId) return;
    setStatus("Generating a communication strategy...");
    setError("");
    setDraftStatus("");
    try {
      const response = await apiFetch("/parents/me/communication-translate", {
        method: "POST",
        body: JSON.stringify({ parentCommunicationEntryId: activeEntryId }),
      });
      setStrategy(response.strategy as StrategyRecord);
      setStatus(
        response.strategy.withholdDelivery
          ? "Strategy generated and held for review because consent or sensitivity rules apply."
          : "Strategy generated. Review the message before saving a draft."
      );
      setEntriesNonce((value) => value + 1);
    } catch (err) {
      setStatus("");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function saveDraft() {
    if (!strategy?.communicationStrategyId) return;
    setDraftStatus("Saving draft...");
    setError("");
    try {
      const response = await apiFetch("/parents/me/communication-drafts/save", {
        method: "POST",
        body: JSON.stringify({
          communicationStrategyId: strategy.communicationStrategyId,
          selectedChannel: strategy.recommendedChannel || "email",
        }),
      });
      setDraftStatus(
        response.draft?.reviewRequired
          ? "Draft saved for review."
          : "Draft saved and ready for mock delivery."
      );
    } catch (err) {
      setDraftStatus("");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function sendMock() {
    if (!strategy?.communicationStrategyId) return;
    setDraftStatus("Saving and sending a mock delivery...");
    setError("");
    try {
      const saved = await apiFetch("/parents/me/communication-drafts/save", {
        method: "POST",
        body: JSON.stringify({
          communicationStrategyId: strategy.communicationStrategyId,
          selectedChannel: strategy.recommendedChannel || "email",
        }),
      });
      const sent = await apiFetch("/parents/me/communication-drafts/send-mock", {
        method: "POST",
        body: JSON.stringify({
          communicationMessageDraftId: saved.communicationMessageDraftId,
        }),
      });
      setDraftStatus(sent.delivered ? "Mock delivery recorded. No real message was sent." : sent.message || "Delivery was blocked.");
      setEntriesNonce((value) => value + 1);
    } catch (err) {
      setDraftStatus("");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <AppShell
      title="Communication translator"
      subtitle={`Translate a concern into something ${formatStudentReference(studentFirstName, {
        fallback: "the student",
      })} is more likely to receive constructively, while keeping consent and dignity intact.`}
    >
      <RequireRole expectedRoles={["parent", "admin"]} fallbackTitle="Parent sign-in required">
        {!profile.data?.profile?.consentAcknowledged ? (
          <SectionCard
            title="Finish the parent baseline first"
            subtitle="The translator is safer when it has your communication baseline."
            tone="warm"
          >
            <p style={{ marginTop: 0, color: "#334155", lineHeight: 1.7 }}>
              Complete the parent onboarding once so the system knows what usually happens in these conversations and what you want to improve.
            </p>
            <a href="/parent/onboarding">Open parent onboarding</a>
          </SectionCard>
        ) : null}

        <SectionCard
          title="Add parent context"
          subtitle="Save facts, concerns, and questions even if you are not ready to send anything yet."
          tone="highlight"
        >
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <label style={labelStyle}>
                <FieldInfoLabel
                  label="Category"
                  info="Classify the kind of concern or question you are adding."
                  example="Academic concern"
                />
                <select
                  value={form.category}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                  style={inputStyle}
                >
                  <option value="career_concern">Career concern</option>
                  <option value="academic_concern">Academic concern</option>
                  <option value="internship_job_search_concern">Internship or job-search concern</option>
                  <option value="financial_tuition_concern">Financial or tuition concern</option>
                  <option value="independence_life_skills_concern">Independence or life-skills concern</option>
                  <option value="emotional_motivational_concern">Emotional or motivational concern</option>
                  <option value="logistical_question">Logistical question</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label style={labelStyle}>
                <FieldInfoLabel
                  label="Urgency"
                  info="Show how time-sensitive this issue feels right now."
                  example="High"
                />
                <select
                  value={form.urgency}
                  onChange={(event) => setForm((current) => ({ ...current, urgency: event.target.value }))}
                  style={inputStyle}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>
              <label style={labelStyle}>
                <FieldInfoLabel
                  label="Intended use"
                  info="Choose whether this is just context or something that may become a message."
                  example="Save as context only"
                />
                <select
                  value={form.deliveryIntent}
                  onChange={(event) => setForm((current) => ({ ...current, deliveryIntent: event.target.value }))}
                  style={inputStyle}
                >
                  <option value="context_only">Save as context only</option>
                  <option value="direct">Potential direct message</option>
                  <option value="indirect">Indirect conversation support</option>
                  <option value="delayed">Delay before raising it</option>
                </select>
              </label>
            </div>

            {[
              [
                "factsStudentShouldKnow",
                "Facts the student should know",
                "State information that matters before any advice is given.",
                "The internship deadline is in three weeks",
              ],
              [
                "questionsParentWantsAnswered",
                "Questions you want answered",
                "List the questions you hope the student will eventually address.",
                "Have you asked anyone to review your resume yet?",
              ],
              [
                "parentConcerns",
                "Concerns",
                "Name the concern plainly without drafting the final message yet.",
                "Applications have not started and time is running short",
              ],
              [
                "recurringCommunicationFailures",
                "Recurring communication failures",
                "Describe patterns where these conversations usually go off track.",
                "The student stops replying when I send a long text",
              ],
              [
                "defensiveTopics",
                "Topics that tend to create defensiveness",
                "Call out subjects that need extra care or slower timing.",
                "Grades, money, and comparing to peers",
              ],
              [
                "priorAttemptsThatDidNotWork",
                "Prior attempts that did not work",
                "Record what you already tried so the system does not repeat it.",
                "I reminded them twice by text and then called the same night",
              ],
              [
                "preferredOutcome",
                "Preferred outcome",
                "Describe the result you want from the conversation.",
                "A calm plan for the next two application steps",
              ],
              [
                "freeformContext",
                "Any other context",
                "Add nuance that does not fit the other fields.",
                "This week is already heavy because of exams",
              ],
            ].map(([key, label, info, example]) => (
              <label key={key} style={labelStyle}>
                <FieldInfoLabel
                  label={label}
                  info={info}
                  example={example}
                />
                <textarea
                  rows={key === "freeformContext" ? 5 : 3}
                  value={(form as Record<string, string>)[key]}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, [key]: event.target.value }))
                  }
                  style={inputStyle}
                />
              </label>
            ))}

            <div style={{ display: "grid", gap: 10 }}>
              <button onClick={() => void saveEntry()} className="ui-button ui-button--primary" style={{ width: "fit-content" }}>
                Save concern or question
              </button>
              {status ? <p style={{ margin: 0, color: "#155eef" }}>{status}</p> : null}
              {error ? <p style={{ margin: 0, color: "crimson" }}>{error}</p> : null}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Saved entries"
          subtitle="Choose the parent concern you want to translate. Saving as context alone is always allowed."
        >
          {entries.loading ? <p>Loading saved entries...</p> : null}
          {!entries.loading && !sortedEntries.length ? (
            <p style={{ margin: 0, color: "#52657d" }}>No entries have been saved yet.</p>
          ) : null}
          <div style={{ display: "grid", gap: 10 }}>
            {sortedEntries.map((entry) => {
              const active = entry.parentCommunicationEntryId === activeEntryId;
              return (
                <button
                  key={entry.parentCommunicationEntryId}
                  onClick={() => setSelectedEntryId(entry.parentCommunicationEntryId)}
                  style={{
                    textAlign: "left",
                    borderRadius: 16,
                    border: `1px solid ${active ? "#87b5ff" : "#dbe4f0"}`,
                    background: active ? "#eef6ff" : "#ffffff",
                    padding: 16,
                  }}
                >
                  <strong style={{ display: "block" }}>{titleCase(entry.category)}</strong>
                  <div style={{ color: "#52657d", marginTop: 6, lineHeight: 1.6 }}>
                    {entry.parentConcerns || entry.preferredOutcome || "No summary provided"}
                  </div>
                  <small style={{ color: "#52657d" }}>
                    {titleCase(entry.status)} · {titleCase(entry.urgency)} · {titleCase(entry.deliveryIntent)}
                  </small>
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 16 }}>
            <button
              onClick={() => void translateEntry()}
              disabled={!activeEntryId}
              className={`ui-button ${activeEntryId ? "ui-button--primary" : "ui-button--secondary ui-button--disabled"}`}
            >
              Generate translation strategy
            </button>
          </div>
        </SectionCard>

        {strategy ? (
          <SectionCard
            title="Translated strategy"
            subtitle="This is the reviewed plan, not just a message draft."
            tone="quiet"
          >
            <div style={{ display: "grid", gap: 12 }}>
              <div><strong>Consent state:</strong> {titleCase(strategy.consentState)}</div>
              <div><strong>Status:</strong> {titleCase(strategy.status)}</div>
              <div><strong>Generation mode:</strong> {titleCase(strategy.generationMode)}</div>
              <div><strong>Recommended channel:</strong> {titleCase(strategy.recommendedChannel)}</div>
              <div><strong>Recommended tone:</strong> {titleCase(strategy.recommendedTone)}</div>
              <div><strong>Timing:</strong> {strategy.recommendedTiming || "Not specified"}</div>
              <div><strong>Frequency:</strong> {titleCase(strategy.recommendedFrequency)}</div>
              <div><strong>Risk of defensiveness:</strong> {titleCase(strategy.defensivenessRisk)}</div>
              <div><strong>Reason:</strong> {strategy.reasonForRecommendation}</div>
              <div><strong>Student-facing draft:</strong> {strategy.studentFacingMessageDraft}</div>
              <div><strong>Why it was changed:</strong> {strategy.parentFacingExplanation}</div>
              <div><strong>What not to say:</strong> {strategy.whatNotToSay}</div>
              {strategy.withholdDelivery ? (
                <div style={{ color: "#b91c1c" }}>
                  <strong>Delivery withheld:</strong> {strategy.withholdReason || "Safety or consent rules require review."}
                </div>
              ) : null}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button onClick={() => void saveDraft()} className="ui-button ui-button--secondary">
                  Save draft
                </button>
                <button
                  onClick={() => void sendMock()}
                  disabled={strategy.withholdDelivery}
                  className={`ui-button ${strategy.withholdDelivery ? "ui-button--secondary ui-button--disabled" : "ui-button--primary"}`}
                >
                  Record mock delivery
                </button>
              </div>
              {draftStatus ? <p style={{ margin: 0, color: "#155eef" }}>{draftStatus}</p> : null}
            </div>
          </SectionCard>
        ) : null}
      </RequireRole>
    </AppShell>
  );
}
