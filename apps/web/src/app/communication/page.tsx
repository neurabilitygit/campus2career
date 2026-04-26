"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "../../components/layout/AppShell";
import { SectionCard } from "../../components/layout/SectionCard";
import { SessionGate } from "../../components/SessionGate";
import { FieldInfoLabel } from "../../components/forms/FieldInfoLabel";
import { RequireRole } from "../../components/RequireRole";
import { useAuthContext } from "../../hooks/useAuthContext";
import { useApiData } from "../../hooks/useApiData";
import { apiFetch } from "../../lib/apiClient";
import { buildDirectAddressName, formatNamedReference } from "../../lib/personalization";

type PromptDefinition = {
  key: string;
  audience: "parent" | "student";
  category: string;
  title: string;
  questionText: string;
  helperText: string;
  placeholder: string;
  suggestedVisibilityScope: string;
  suggestedSensitivityLevel: string;
};

type TranslationOutput = {
  rewrittenMessage: string;
  shorterVersion: string;
  softerVersion: string;
  directVersion: string;
  rationale: string;
  riskFlags: string[];
  suggestedNextStep: string;
  confidence: string;
  sourceContextUsed: string[];
  privacyNotes: string[];
  likelyMeaning?: string | null;
  suggestedResponse?: string | null;
};

type CommunicationProfileResponse = {
  ok: boolean;
  parentProfile?: {
    mainWorries?: string | null;
    usualApproach?: string | null;
    whatDoesNotWork?: string | null;
    wantsToImprove?: string | null;
    consentAcknowledged?: boolean;
  } | null;
  studentPreferences?: {
    preferredChannels?: string[];
    dislikedChannels?: string[];
    preferredTone?: string | null;
    sensitiveTopics?: string[];
    preferredFrequency?: string | null;
    bestTimeOfDay?: string | null;
    preferredGuidanceFormats?: string[];
    consentParentTranslatedMessages?: boolean;
    notes?: string | null;
  } | null;
  parentInputs?: Array<{
    parentCommunicationInputId: string;
    promptKey: string;
    questionText: string;
    responseText: string;
    category: string;
    visibilityScope: string;
    sensitivityLevel: string;
    confidenceLevel?: string | null;
  }>;
  studentInputs?: Array<{
    studentCommunicationInputId: string;
    promptKey: string;
    questionText: string;
    responseText: string;
    category: string;
    visibilityScope: string;
    sensitivityLevel: string;
  }>;
  translationEvents?: Array<{
    communicationTranslationEventId: string;
    sourceRole: string;
    targetRole: string;
    translationGoal?: string;
    feedbackRating?: string | null;
    createdAt?: string | null;
  }>;
  completion?: {
    parent?: { total: number; answered: number; completionPercent: number };
    student?: { total: number; answered: number; completionPercent: number };
  };
};

type SavedCommunicationInput = {
  id: string;
  promptKey: string;
  questionText: string;
  responseText: string;
  category: string;
  visibilityScope: string;
  sensitivityLevel: string;
  confidenceLevel?: string | null;
};

type CommunicationSummaryResponse = {
  ok: boolean;
  summary?: {
    parentVisibleDetails?: string[];
    studentVisibleDetails?: string[];
    sharedThemes?: string[];
    frictionSignals?: string[];
    preferenceNotes?: string[];
    coachSuggestions?: string[];
    recentTranslationActivity?: {
      direction: string;
      createdAt?: string | null;
      feedbackRating?: string | null;
    } | null;
  };
  completion?: {
    parent?: { total: number; answered: number; completionPercent: number };
    student?: { total: number; answered: number; completionPercent: number };
  };
  inferredInsights?: Array<{
    communicationInferredInsightId: string;
    insightKey: string;
    insightType: string;
    title: string;
    summaryText: string;
    confidenceLabel: string;
    status: string;
    reviewNotes?: string | null;
  }>;
  analytics?: {
    promptStats: {
      parent: { answered: number; skipped: number; revisitLater: number; totalPrompts: number };
      student: { answered: number; skipped: number; revisitLater: number; totalPrompts: number };
    };
    translationStats: {
      totalTranslations: number;
      feedbackCount: number;
      latestCreatedAt: string | null;
    };
    feedbackBreakdown: Record<string, number>;
    topPromptSignals: Array<{
      promptKey: string;
      audience: "parent" | "student";
      status: string;
      count: number;
    }>;
  };
};

type NextPromptResponse = {
  ok: boolean;
  audience: "parent" | "student";
  nextPrompt?: PromptDefinition | null;
  completion?: { total: number; answered: number; completionPercent: number };
};

type TranslationResponse = {
  ok: boolean;
  communicationTranslationEventId: string;
  mode: "llm" | "fallback";
  output: TranslationOutput;
  degradedReason?: string | null;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 14,
  border: "1px solid #d0d8e8",
  padding: "12px 14px",
  fontSize: 15,
  background: "#ffffff",
};

const sectionButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 999,
  border: "1px solid #d0d8e8",
  padding: "10px 14px",
  background: "#fff",
  fontWeight: 700,
};

function titleCase(value: string | null | undefined) {
  if (!value) return "Not set";
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not yet";
  return new Date(value).toLocaleString();
}

function CompletionBadge(props: { label: string; percent: number | undefined }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 999,
        background: "#f8fbff",
        border: "1px solid #dbe4f0",
      }}
    >
      <strong>{props.label}</strong>
      <span>{props.percent ?? 0}% complete</span>
    </div>
  );
}

function AnalyticsPanel(props: { analytics?: CommunicationSummaryResponse["analytics"] }) {
  const analytics = props.analytics;
  if (!analytics) {
    return <p style={{ margin: 0, color: "#52657d" }}>Analytics will appear after prompts and translation feedback accumulate.</p>;
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="ui-soft-panel">
        <strong>Prompt completion signals</strong>
        <div style={{ marginTop: 6, color: "#334155", lineHeight: 1.6 }}>
          Parent answered {analytics.promptStats.parent.answered}/{analytics.promptStats.parent.totalPrompts}, skipped {analytics.promptStats.parent.skipped}, revisit later {analytics.promptStats.parent.revisitLater}.
        </div>
        <div style={{ marginTop: 6, color: "#334155", lineHeight: 1.6 }}>
          Student answered {analytics.promptStats.student.answered}/{analytics.promptStats.student.totalPrompts}, skipped {analytics.promptStats.student.skipped}, revisit later {analytics.promptStats.student.revisitLater}.
        </div>
      </div>
      <div className="ui-soft-panel">
        <strong>Translation feedback</strong>
        <div style={{ marginTop: 6, color: "#334155", lineHeight: 1.6 }}>
          {analytics.translationStats.totalTranslations} translations, {analytics.translationStats.feedbackCount} feedback responses, latest activity {formatDateTime(analytics.translationStats.latestCreatedAt)}.
        </div>
        <div style={{ marginTop: 6, color: "#334155", lineHeight: 1.6 }}>
          Helpful: {analytics.feedbackBreakdown.helpful || 0} · Too direct: {analytics.feedbackBreakdown.too_direct || 0} · Too soft: {analytics.feedbackBreakdown.too_soft || 0} · Missed the point: {analytics.feedbackBreakdown.missed_the_point || 0}
        </div>
      </div>
      {analytics.topPromptSignals.length ? (
        <div className="ui-soft-panel">
          <strong>Most common prompt signals</strong>
          <ul style={{ marginBottom: 0 }}>
            {analytics.topPromptSignals.map((item) => (
              <li key={`${item.audience}:${item.promptKey}:${item.status}`}>
                {titleCase(item.audience)} · {item.promptKey} · {titleCase(item.status)}: {item.count}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function InferredInsightsPanel(props: {
  inferredInsights?: CommunicationSummaryResponse["inferredInsights"];
  canReview?: boolean;
  onChanged: () => void;
}) {
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function reviewInsight(insightId: string, nextStatus: "confirmed" | "rejected") {
    setReviewingId(insightId);
    setStatus("");
    setError("");
    try {
      await apiFetch(`/communication/insights/${encodeURIComponent(insightId)}/review`, {
        method: "POST",
        body: JSON.stringify({ status: nextStatus }),
      });
      setStatus(nextStatus === "confirmed" ? "Pattern confirmed." : "Pattern rejected.");
      props.onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setReviewingId(null);
    }
  }

  if (!props.inferredInsights?.length) {
    return <p style={{ margin: 0, color: "#52657d" }}>No inferred communication patterns are ready for review yet.</p>;
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {props.inferredInsights.map((item) => (
        <div key={item.communicationInferredInsightId} className="ui-soft-panel">
          <strong>{item.title}</strong>
          <div style={{ marginTop: 6, color: "#334155", lineHeight: 1.6 }}>{item.summaryText}</div>
          <div style={{ marginTop: 6, color: "#64748b", fontSize: 14 }}>
            {titleCase(item.confidenceLabel)} confidence · {titleCase(item.status)}
          </div>
          {props.canReview ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              <button
                type="button"
                className="ui-button ui-button--secondary"
                disabled={reviewingId === item.communicationInferredInsightId}
                onClick={() => void reviewInsight(item.communicationInferredInsightId, "confirmed")}
              >
                Confirm
              </button>
              <button
                type="button"
                className="ui-button ui-button--secondary"
                disabled={reviewingId === item.communicationInferredInsightId}
                onClick={() => void reviewInsight(item.communicationInferredInsightId, "rejected")}
              >
                Reject
              </button>
            </div>
          ) : null}
        </div>
      ))}
      {status ? <p style={{ margin: 0, color: "#155eef" }}>{status}</p> : null}
      {error ? <p style={{ margin: 0, color: "crimson" }}>{error}</p> : null}
    </div>
  );
}

function SavedInputList(props: {
  audience: "parent" | "student";
  items: SavedCommunicationInput[];
  emptyText: string;
  onChanged: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{
    responseText: string;
    visibilityScope: string;
    sensitivityLevel: string;
  } | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  function startEdit(item: SavedCommunicationInput) {
    setEditingId(item.id);
    setDraft({
      responseText: item.responseText,
      visibilityScope: item.visibilityScope,
      sensitivityLevel: item.sensitivityLevel,
    });
    setStatus("");
    setError("");
  }

  async function saveEdit(item: SavedCommunicationInput) {
    if (!draft) return;
    setStatus("Saving...");
    setError("");
    try {
      await apiFetch(
        props.audience === "parent"
          ? `/communication/parent-inputs/${encodeURIComponent(item.id)}`
          : `/communication/student-inputs/${encodeURIComponent(item.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            promptKey: item.promptKey,
            category: item.category,
            questionText: item.questionText,
            responseText: draft.responseText.trim(),
            visibilityScope: draft.visibilityScope,
            sensitivityLevel: draft.sensitivityLevel,
            ...(props.audience === "parent" ? { confidenceLevel: item.confidenceLevel || "user_reported" } : {}),
          }),
        }
      );
      setEditingId(null);
      setDraft(null);
      setStatus("Saved.");
      props.onChanged();
    } catch (err) {
      setStatus("");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function deleteItem(item: SavedCommunicationInput) {
    if (!window.confirm("Delete this saved communication response?")) return;
    setStatus("Deleting...");
    setError("");
    try {
      await apiFetch(
        props.audience === "parent"
          ? `/communication/parent-inputs/${encodeURIComponent(item.id)}`
          : `/communication/student-inputs/${encodeURIComponent(item.id)}`,
        { method: "DELETE" }
      );
      setStatus("Deleted.");
      props.onChanged();
    } catch (err) {
      setStatus("");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (!props.items.length) {
    return <p>{props.emptyText}</p>;
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {props.items.map((item) => {
        const isEditing = editingId === item.id && draft;
        return (
          <div key={item.id} className="ui-soft-panel">
            <strong>{item.questionText}</strong>
            {isEditing ? (
              <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                <textarea
                  rows={4}
                  style={{ ...inputStyle, fontFamily: "inherit" }}
                  value={draft.responseText}
                  onChange={(event) => setDraft((current) => current ? { ...current, responseText: event.target.value } : current)}
                />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                  <select
                    value={draft.visibilityScope}
                    onChange={(event) => setDraft((current) => current ? { ...current, visibilityScope: event.target.value } : current)}
                    style={inputStyle}
                  >
                    <option value="private_to_user">Private to me</option>
                    <option value="shared_summary_only">Shared as summary only</option>
                    <option value={props.audience === "parent" ? "visible_to_parent" : "visible_to_student"}>Visible to me in raw form</option>
                    <option value="visible_to_household_admin">Visible to household admin</option>
                    <option value="visible_to_coach">Visible to coach</option>
                    <option value="visible_to_system_only">System only</option>
                  </select>
                  <select
                    value={draft.sensitivityLevel}
                    onChange={(event) => setDraft((current) => current ? { ...current, sensitivityLevel: event.target.value } : current)}
                    style={inputStyle}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" className="ui-button ui-button--primary" onClick={() => void saveEdit(item)}>
                    Save changes
                  </button>
                  <button type="button" className="ui-button ui-button--secondary" onClick={() => { setEditingId(null); setDraft(null); }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ marginTop: 6, color: "#334155", lineHeight: 1.6 }}>{item.responseText}</div>
                <div style={{ marginTop: 6, color: "#64748b", fontSize: 14 }}>
                  {titleCase(item.visibilityScope)} · {titleCase(item.sensitivityLevel)}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  <button type="button" className="ui-button ui-button--secondary" onClick={() => startEdit(item)}>
                    Edit
                  </button>
                  <button type="button" className="ui-button ui-button--secondary" onClick={() => void deleteItem(item)}>
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}
      {status ? <p style={{ margin: 0, color: "#155eef" }}>{status}</p> : null}
      {error ? <p style={{ margin: 0, color: "crimson" }}>{error}</p> : null}
    </div>
  );
}

function CommunicationSectionNav(props: {
  section: string;
  items: Array<{ key: string; label: string }>;
}) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {props.items.map((item) => (
        <Link
          key={item.key}
          href={`/communication?section=${item.key}`}
          style={{
            ...sectionButtonStyle,
            background: props.section === item.key ? "#183153" : "#fff",
            color: props.section === item.key ? "#fff" : "#183153",
          }}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}

function PromptComposer(props: {
  audience: "parent" | "student";
  nextPrompt?: PromptDefinition | null;
  onSaved: () => void;
}) {
  const [responseText, setResponseText] = useState("");
  const [visibilityScope, setVisibilityScope] = useState(props.nextPrompt?.suggestedVisibilityScope || "shared_summary_only");
  const [sensitivityLevel, setSensitivityLevel] = useState(props.nextPrompt?.suggestedSensitivityLevel || "medium");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setResponseText("");
    setVisibilityScope(props.nextPrompt?.suggestedVisibilityScope || (props.audience === "parent" ? "shared_summary_only" : "private_to_user"));
    setSensitivityLevel(props.nextPrompt?.suggestedSensitivityLevel || "medium");
  }, [props.audience, props.nextPrompt]);

  if (!props.nextPrompt) {
    return <p style={{ margin: 0, color: "#52657d" }}>You have answered the current prompt set. You can revisit saved responses below.</p>;
  }

  async function save() {
    if (!responseText.trim()) return;
    setStatus("Saving...");
    setError("");
    try {
      await apiFetch(props.audience === "parent" ? "/communication/parent-inputs" : "/communication/student-inputs", {
        method: "POST",
        body: JSON.stringify({
          promptKey: props.nextPrompt?.key,
          category: props.nextPrompt?.category,
          questionText: props.nextPrompt?.questionText,
          responseText: responseText.trim(),
          visibilityScope,
          sensitivityLevel,
          ...(props.audience === "parent" ? { confidenceLevel: "user_reported" } : {}),
        }),
      });
      setStatus("Saved.");
      setResponseText("");
      props.onSaved();
    } catch (err) {
      setStatus("");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function updatePromptStatus(nextStatus: "skipped" | "revisit_later") {
    setStatus(nextStatus === "skipped" ? "Skipping for now..." : "We’ll bring this back later...");
    setError("");
    try {
      await apiFetch("/communication/prompts/skip", {
        method: "POST",
        body: JSON.stringify({
          audience: props.audience,
          promptKey: props.nextPrompt?.key,
          status: nextStatus,
        }),
      });
      props.onSaved();
    } catch (err) {
      setStatus("");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="ui-soft-panel">
        <strong>{props.nextPrompt.title}</strong>
        <p style={{ margin: "6px 0 0 0", color: "#52657d", lineHeight: 1.6 }}>{props.nextPrompt.helperText}</p>
      </div>
      <label style={{ display: "grid", gap: 6 }}>
        <FieldInfoLabel
          label={props.nextPrompt.questionText}
          info="Answer only what feels useful right now. You can always edit or add more later."
          example={props.nextPrompt.placeholder}
        />
        <textarea
          rows={5}
          style={{ ...inputStyle, fontFamily: "inherit" }}
          value={responseText}
          onChange={(event) => setResponseText(event.target.value)}
          placeholder={props.nextPrompt.placeholder}
        />
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <FieldInfoLabel
            label="Who should this be visible to?"
            info="Private responses can still guide system tone without being shown directly to others."
            example="Shared summary only"
          />
          <select value={visibilityScope} onChange={(event) => setVisibilityScope(event.target.value)} style={inputStyle}>
            <option value="private_to_user">Private to me</option>
            <option value="shared_summary_only">Shared as summary only</option>
            <option value={props.audience === "parent" ? "visible_to_parent" : "visible_to_student"}>
              Visible to me in raw form
            </option>
            <option value="visible_to_household_admin">Visible to household admin</option>
            <option value="visible_to_coach">Visible to coach</option>
            <option value="visible_to_system_only">System only</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <FieldInfoLabel
            label="How sensitive is this?"
            info="This helps the system decide how carefully to use it."
            example="Medium"
          />
          <select value={sensitivityLevel} onChange={(event) => setSensitivityLevel(event.target.value)} style={inputStyle}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button type="button" className="ui-button ui-button--primary" onClick={() => void save()}>
          Save response
        </button>
        <button type="button" className="ui-button ui-button--secondary" onClick={() => void updatePromptStatus("revisit_later")}>
          Revisit later
        </button>
        <button type="button" className="ui-button ui-button--secondary" onClick={() => void updatePromptStatus("skipped")}>
          Skip for now
        </button>
      </div>
      {status ? <p style={{ margin: 0, color: "#155eef" }}>{status}</p> : null}
      {error ? <p style={{ margin: 0, color: "crimson" }}>{error}</p> : null}
    </div>
  );
}

function TranslationPanel(props: {
  sourceRole: "parent" | "student";
  targetRole: "student" | "parent";
  title: string;
  subtitle: string;
  placeholder: string;
  defaultGoal: string;
}) {
  const [originalText, setOriginalText] = useState("");
  const [translationGoal, setTranslationGoal] = useState(props.defaultGoal);
  const [tone, setTone] = useState("gentle");
  const [result, setResult] = useState<TranslationResponse | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");

  async function translate() {
    if (!originalText.trim()) return;
    setStatus("Translating...");
    setError("");
    setFeedbackStatus("");
    try {
      const response = await apiFetch("/communication/translate", {
        method: "POST",
        body: JSON.stringify({
          sourceRole: props.sourceRole,
          targetRole: props.targetRole,
          originalText: originalText.trim(),
          translationGoal,
          tone,
        }),
      });
      setResult(response as TranslationResponse);
      setStatus("");
    } catch (err) {
      setStatus("");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function sendFeedback(feedbackRating: string) {
    if (!result?.communicationTranslationEventId) return;
    setFeedbackStatus("Saving feedback...");
    try {
      await apiFetch("/communication/feedback", {
        method: "POST",
        body: JSON.stringify({
          communicationTranslationEventId: result.communicationTranslationEventId,
          feedbackRating,
        }),
      });
      setFeedbackStatus("Feedback saved.");
    } catch (err) {
      setFeedbackStatus(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <SectionCard title={props.title} subtitle={props.subtitle}>
      <div style={{ display: "grid", gap: 14 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <FieldInfoLabel
            label="Original message"
            info="Write what you actually want to say first. The system will help make it clearer, kinder, and easier to receive."
            example={props.placeholder}
          />
          <textarea
            rows={5}
            style={{ ...inputStyle, fontFamily: "inherit" }}
            value={originalText}
            onChange={(event) => setOriginalText(event.target.value)}
            placeholder={props.placeholder}
          />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <FieldInfoLabel label="Goal" info="Tell the translator what the message is trying to do." example="Reduce friction" />
            <select value={translationGoal} onChange={(event) => setTranslationGoal(event.target.value)} style={inputStyle}>
              <option value="clarify">Clarify</option>
              <option value="reduce_friction">Reduce friction</option>
              <option value="reminder">Reminder</option>
              <option value="check_in">Check-in</option>
              <option value="boundary_setting">Boundary setting</option>
              <option value="status_update">Status update</option>
              <option value="encouragement">Encouragement</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <FieldInfoLabel label="Tone" info="Choose the tone you want the translator to lean toward." example="Gentle" />
            <select value={tone} onChange={(event) => setTone(event.target.value)} style={inputStyle}>
              <option value="gentle">Gentle</option>
              <option value="neutral">Neutral</option>
              <option value="direct">Direct</option>
              <option value="encouraging">Encouraging</option>
              <option value="question_led">Question-led</option>
              <option value="summary_first">Summary-first</option>
            </select>
          </label>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button type="button" className="ui-button ui-button--primary" onClick={() => void translate()}>
            {status || "Translate"}
          </button>
        </div>
        {error ? <p style={{ margin: 0, color: "crimson" }}>{error}</p> : null}
        {result?.output ? (
          <div
            data-testid="communication-translation-result"
            style={{ display: "grid", gap: 14, padding: 18, borderRadius: 18, background: "#f8fbff", border: "1px solid #dbe4f0" }}
          >
            <div>
              <strong>Rewritten message</strong>
              <p style={{ margin: "6px 0 0 0", color: "#334155", lineHeight: 1.7 }}>{result.output.rewrittenMessage}</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <div className="ui-soft-panel">
                <strong>Shorter</strong>
                <div style={{ marginTop: 6, color: "#334155", lineHeight: 1.6 }}>{result.output.shorterVersion}</div>
              </div>
              <div className="ui-soft-panel">
                <strong>Softer</strong>
                <div style={{ marginTop: 6, color: "#334155", lineHeight: 1.6 }}>{result.output.softerVersion}</div>
              </div>
              <div className="ui-soft-panel">
                <strong>More direct</strong>
                <div style={{ marginTop: 6, color: "#334155", lineHeight: 1.6 }}>{result.output.directVersion}</div>
              </div>
            </div>
            <div>
              <strong>Why the wording changed</strong>
              <p style={{ margin: "6px 0 0 0", color: "#334155", lineHeight: 1.7 }}>{result.output.rationale}</p>
            </div>
            {result.output.likelyMeaning ? (
              <div className="ui-soft-panel">
                <strong>Likely meaning</strong>
                <div style={{ marginTop: 6, color: "#334155", lineHeight: 1.6 }}>{result.output.likelyMeaning}</div>
              </div>
            ) : null}
            {result.output.suggestedResponse ? (
              <div className="ui-soft-panel">
                <strong>Suggested response</strong>
                <div style={{ marginTop: 6, color: "#334155", lineHeight: 1.6 }}>{result.output.suggestedResponse}</div>
              </div>
            ) : null}
            <div>
              <strong>Suggested next step</strong>
              <p style={{ margin: "6px 0 0 0", color: "#334155", lineHeight: 1.7 }}>{result.output.suggestedNextStep}</p>
            </div>
            {result.output.riskFlags.length ? (
              <div>
                <strong>Risk flags</strong>
                <ul style={{ marginBottom: 0 }}>
                  {result.output.riskFlags.map((flag) => (
                    <li key={flag}>{flag}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["helpful", "not_helpful", "too_direct", "too_soft", "missed_the_point", "made_it_worse"].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  className="ui-button ui-button--secondary"
                  onClick={() => void sendFeedback(rating)}
                >
                  {titleCase(rating)}
                </button>
              ))}
            </div>
            {feedbackStatus ? <p style={{ margin: 0, color: "#155eef" }}>{feedbackStatus}</p> : null}
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}

function ParentCommunicationWorkspace() {
  const searchParams = useSearchParams();
  const section = searchParams.get("section") || "profile";
  const auth = useAuthContext();
  const studentLabel = formatNamedReference(
    {
      preferredName: auth.data?.context?.studentPreferredName,
      firstName: auth.data?.context?.studentFirstName,
      lastName: auth.data?.context?.studentLastName,
    },
    { fallback: "your student", preferPreferred: true }
  );
  const [nonce, setNonce] = useState(0);
  const profile = useApiData<CommunicationProfileResponse>("/communication/profile", true, nonce);
  const summary = useApiData<CommunicationSummaryResponse>("/communication/summary", true, nonce);
  const nextPrompt = useApiData<NextPromptResponse>("/communication/prompts/next?audience=parent", true, nonce);

  return (
    <>
      <CommunicationSectionNav
        section={section}
        items={[
          { key: "profile", label: "Communication Profile" },
          { key: "insights", label: "Student Insight Prompts" },
          { key: "translator", label: "Parent-to-Student Translator" },
          { key: "history", label: "History & Notes" },
        ]}
      />

      {section === "profile" ? (
        <>
          <SectionCard
            title="Parent communication profile"
            subtitle={`Help the system understand ${studentLabel} more deeply so it can lower friction instead of increasing it.`}
          >
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <CompletionBadge label="Parent insight prompts" percent={summary.data?.completion?.parent?.completionPercent} />
                <CompletionBadge label="Student preferences available" percent={summary.data?.completion?.student?.completionPercent} />
              </div>
              <div className="ui-soft-panel">
                <strong>Existing baseline</strong>
                <ul style={{ marginBottom: 0 }}>
                  <li>Main worries: {profile.data?.parentProfile?.mainWorries || "Not yet saved"}</li>
                  <li>What does not work: {profile.data?.parentProfile?.whatDoesNotWork || "Not yet saved"}</li>
                  <li>What you want to improve: {profile.data?.parentProfile?.wantsToImprove || "Not yet saved"}</li>
                </ul>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link href="/parent/onboarding" className="ui-button ui-button--primary">
                  Update parent baseline
                </Link>
                <Link href="/help" className="ui-button ui-button--secondary">
                  Communication help
                </Link>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="What the system is learning"
            subtitle="Private notes stay private. Shared-summary items can shape tone and guidance without exposing the full wording."
          >
            <div style={{ display: "grid", gap: 12 }}>
              {(summary.data?.summary?.sharedThemes || []).length ? (
                <div className="ui-soft-panel">
                  <strong>Shared themes</strong>
                  <div style={{ marginTop: 6, color: "#334155" }}>{summary.data?.summary?.sharedThemes?.join(", ")}</div>
                </div>
              ) : null}
              {(summary.data?.summary?.frictionSignals || []).length ? (
                <div className="ui-soft-panel">
                  <strong>Friction signals</strong>
                  <ul style={{ marginBottom: 0 }}>
                    {summary.data?.summary?.frictionSignals?.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p style={{ margin: 0, color: "#52657d" }}>No friction signals have been surfaced yet.</p>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="Review inferred patterns"
            subtitle="Confirm or reject the communication patterns the system thinks it is seeing, so future translation guidance gets sharper."
          >
            <InferredInsightsPanel
              inferredInsights={summary.data?.inferredInsights}
              canReview
              onChanged={() => setNonce((value) => value + 1)}
            />
          </SectionCard>
        </>
      ) : null}

      {section === "insights" ? (
        <>
          <SectionCard
            title="Student insight prompts"
            subtitle="These prompts help the system understand family communication patterns, stress points, and what tends to help."
          >
            <PromptComposer audience="parent" nextPrompt={nextPrompt.data?.nextPrompt} onSaved={() => setNonce((value) => value + 1)} />
          </SectionCard>
          <SectionCard title="Saved parent insights" subtitle="Update or remove saved responses when your understanding changes.">
            <SavedInputList
              audience="parent"
              items={(profile.data?.parentInputs || []).map((item) => ({
                id: item.parentCommunicationInputId,
                promptKey: item.promptKey,
                questionText: item.questionText,
                responseText: item.responseText,
                category: item.category,
                visibilityScope: item.visibilityScope,
                sensitivityLevel: item.sensitivityLevel,
                confidenceLevel: item.confidenceLevel || null,
              }))}
              emptyText="No parent communication insights have been saved yet."
              onChanged={() => setNonce((value) => value + 1)}
            />
          </SectionCard>
        </>
      ) : null}

      {section === "translator" ? (
        <>
          <TranslationPanel
            sourceRole="parent"
            targetRole="student"
            title="Parent-to-student translator"
            subtitle={`Start with what you really want to say to ${studentLabel}. The system will translate it into clearer, lower-friction language.`}
            placeholder="I’m worried you’re waiting too long to start internship applications, and I don’t want this to turn into another argument."
            defaultGoal="reduce_friction"
          />
          <SectionCard title="Recent translation activity" subtitle="The system uses feedback to adjust tone guidance over time.">
            {summary.data?.summary?.recentTranslationActivity ? (
              <div className="ui-soft-panel">
                <strong>{titleCase(summary.data.summary.recentTranslationActivity.direction)}</strong>
                <div style={{ marginTop: 6, color: "#334155" }}>
                  Last used {formatDateTime(summary.data.summary.recentTranslationActivity.createdAt)}
                </div>
                <div style={{ marginTop: 4, color: "#64748b" }}>
                  Feedback: {titleCase(summary.data.summary.recentTranslationActivity.feedbackRating)}
                </div>
              </div>
            ) : (
              <p>No translation activity has been recorded yet.</p>
            )}
          </SectionCard>
        </>
      ) : null}

      {section === "history" ? (
        <>
          <SectionCard
            title="History and notes"
            subtitle="Use the detailed parent translator history when you need a full audit trail of entries, drafts, and delivered messages."
          >
            <div style={{ display: "grid", gap: 12 }}>
              <Link href="/parent/history" className="ui-button ui-button--primary">
                Open detailed history
              </Link>
              <Link href="/parent/communication" className="ui-button ui-button--secondary">
                Open detailed parent translator
              </Link>
            </div>
          </SectionCard>
          <SectionCard
            title="Communication analytics"
            subtitle="These lightweight usage signals help show where prompts are landing and where translation feedback says the system still needs work."
          >
            <AnalyticsPanel analytics={summary.data?.analytics} />
          </SectionCard>
        </>
      ) : null}
    </>
  );
}

function StudentCommunicationWorkspace() {
  const searchParams = useSearchParams();
  const section = searchParams.get("section") || "preferences";
  const [nonce, setNonce] = useState(0);
  const profile = useApiData<CommunicationProfileResponse>("/communication/profile", true, nonce);
  const summary = useApiData<CommunicationSummaryResponse>("/communication/summary", true, nonce);
  const nextPrompt = useApiData<NextPromptResponse>("/communication/prompts/next?audience=student", true, nonce);

  return (
    <>
      <CommunicationSectionNav
        section={section}
        items={[
          { key: "preferences", label: "My Communication Preferences" },
          { key: "wish", label: "What I Wish Adults Understood" },
          { key: "helper", label: "Parent Message Helper" },
          { key: "help", label: "Help" },
        ]}
      />

      {section === "preferences" ? (
        <>
          <SectionCard
            title="My communication preferences"
            subtitle="Tell the system what feels helpful, what feels annoying, and how you want support to show up."
          >
            <div style={{ display: "grid", gap: 14 }}>
              <CompletionBadge label="Student prompt progress" percent={summary.data?.completion?.student?.completionPercent} />
              <div className="ui-soft-panel">
                <strong>Saved preference snapshot</strong>
                <ul style={{ marginBottom: 0 }}>
                  <li>Preferred tone: {titleCase(profile.data?.studentPreferences?.preferredTone)}</li>
                  <li>Preferred frequency: {titleCase(profile.data?.studentPreferences?.preferredFrequency)}</li>
                  <li>Best time of day: {titleCase(profile.data?.studentPreferences?.bestTimeOfDay)}</li>
                </ul>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link href="/onboarding/profile" className="ui-button ui-button--primary">
                  Update profile-based preferences
                </Link>
              </div>
            </div>
          </SectionCard>
          <SectionCard title="Quick preference prompts" subtitle="Short answers are enough. Skip anything you do not want to answer yet.">
            <PromptComposer audience="student" nextPrompt={nextPrompt.data?.nextPrompt} onSaved={() => setNonce((value) => value + 1)} />
          </SectionCard>
        </>
      ) : null}

      {section === "wish" ? (
        <>
          <SectionCard title="What I wish adults understood" subtitle="These responses help the system translate meaning without making you feel watched or judged.">
            <SavedInputList
              audience="student"
              items={(profile.data?.studentInputs || []).map((item) => ({
                id: item.studentCommunicationInputId,
                promptKey: item.promptKey,
                questionText: item.questionText,
                responseText: item.responseText,
                category: item.category,
                visibilityScope: item.visibilityScope,
                sensitivityLevel: item.sensitivityLevel,
              }))}
              emptyText="No student communication responses are saved yet."
              onChanged={() => setNonce((value) => value + 1)}
            />
          </SectionCard>
          <SectionCard
            title="Review inferred patterns"
            subtitle="Confirm or reject the system’s communication takeaways so future reminders and translation help fit you better."
          >
            <InferredInsightsPanel
              inferredInsights={summary.data?.inferredInsights}
              canReview
              onChanged={() => setNonce((value) => value + 1)}
            />
          </SectionCard>
        </>
      ) : null}

      {section === "helper" ? (
        <TranslationPanel
          sourceRole="student"
          targetRole="parent"
          title="Student-to-parent translator"
          subtitle="Use this when you want to explain what is going on without it turning into another frustrating conversation."
          placeholder="I know it looks like I’m avoiding this, but I’m overwhelmed and every reminder feels like more pressure."
          defaultGoal="clarify"
        />
      ) : null}

      {section === "help" ? (
        <>
          <SectionCard title="Communication help" subtitle="This area is designed to make support clearer and less annoying, not to force conversations.">
            <div style={{ display: "grid", gap: 12 }}>
              <p style={{ margin: 0, color: "#334155", lineHeight: 1.7 }}>
                Private responses can still guide tone without being shown directly to adults. Shared-summary answers may be used to help the system explain what tends to work best for you.
              </p>
              <Link href="/help" className="ui-button ui-button--primary">
                Open full help
              </Link>
            </div>
          </SectionCard>
          <SectionCard
            title="Communication analytics"
            subtitle="These signals show how your prompt progress and translation feedback are shaping future communication guidance."
          >
            <AnalyticsPanel analytics={summary.data?.analytics} />
          </SectionCard>
        </>
      ) : null}
    </>
  );
}

function CoachCommunicationWorkspace() {
  const searchParams = useSearchParams();
  const selectedStudentProfileId = searchParams.get("studentProfileId");
  const summary = useApiData<CommunicationSummaryResponse>(
    selectedStudentProfileId
      ? `/communication/summary?studentProfileId=${encodeURIComponent(selectedStudentProfileId)}`
      : "/communication/summary",
    true
  );
  const auth = useAuthContext();
  const studentLabel = formatNamedReference(
    {
      preferredName: auth.data?.context?.studentPreferredName,
      firstName: auth.data?.context?.studentFirstName,
      lastName: auth.data?.context?.studentLastName,
    },
    { fallback: "the selected student", preferPreferred: true }
  );

  return (
    <>
      <CommunicationSectionNav section="context" items={[{ key: "context", label: "Communication Context" }]} />
      <SectionCard
        title="Communication context summary"
        subtitle={`Use this to reduce friction, respect communication preferences, and avoid stepping into family dynamics without context for ${studentLabel}.`}
      >
        <div style={{ display: "grid", gap: 12 }}>
          {(summary.data?.summary?.sharedThemes || []).length ? (
            <div className="ui-soft-panel">
              <strong>Shared themes</strong>
              <div style={{ marginTop: 6, color: "#334155" }}>{summary.data.summary.sharedThemes?.join(", ")}</div>
            </div>
          ) : null}
          {(summary.data?.summary?.frictionSignals || []).length ? (
            <div className="ui-soft-panel">
              <strong>Friction signals</strong>
              <ul style={{ marginBottom: 0 }}>
                {summary.data.summary.frictionSignals?.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p style={{ margin: 0, color: "#52657d" }}>No friction signals are shared with coach view yet.</p>
          )}
          <div className="ui-soft-panel">
            <strong>Friction-reduction suggestions</strong>
            <ul style={{ marginBottom: 0 }}>
              {(summary.data?.summary?.coachSuggestions || []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="ui-soft-panel">
            <strong>Missing communication profile alert</strong>
            <div style={{ marginTop: 6, color: "#334155" }}>
              Parent completion: {summary.data?.completion?.parent?.completionPercent ?? 0}% · Student completion: {summary.data?.completion?.student?.completionPercent ?? 0}%
            </div>
          </div>
          <div className="ui-soft-panel">
            <strong>System-learned patterns</strong>
            <InferredInsightsPanel
              inferredInsights={summary.data?.inferredInsights}
              onChanged={() => {}}
            />
          </div>
          <div className="ui-soft-panel">
            <strong>Communication analytics</strong>
            <AnalyticsPanel analytics={summary.data?.analytics} />
          </div>
        </div>
      </SectionCard>
    </>
  );
}

function CommunicationContent() {
  const auth = useAuthContext();
  const role = auth.data?.context?.authenticatedRoleType;
  const directName =
    buildDirectAddressName({
      preferredName: auth.data?.context?.authenticatedPreferredName,
      firstName: auth.data?.context?.authenticatedFirstName,
      lastName: auth.data?.context?.authenticatedLastName,
      fallback: "you",
    }) || "you";

  return (
    <AppShell
      title="Communication"
      subtitle={`${directName}, use this area to improve how family support, reminders, coaching language, and translation between adults and students actually lands.`}
    >
      <RequireRole
        expectedRoles={["student", "parent", "coach", "admin"]}
        fallbackTitle="Communication access required"
        requiredCapability="view_communication"
      >
        {role === "parent" ? <ParentCommunicationWorkspace /> : null}
        {role === "student" ? <StudentCommunicationWorkspace /> : null}
        {role === "coach" ? <CoachCommunicationWorkspace /> : null}
        {role === "admin" ? <ParentCommunicationWorkspace /> : null}
        {!role ? <SectionCard title="Communication"><p>We could not determine your account role yet.</p></SectionCard> : null}
      </RequireRole>
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
