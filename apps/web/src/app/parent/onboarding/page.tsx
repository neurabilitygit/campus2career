"use client";

import { useEffect, useState } from "react";
import { AppShell } from "../../../components/layout/AppShell";
import { SectionCard } from "../../../components/layout/SectionCard";
import { RequireRole } from "../../../components/RequireRole";
import { useApiData } from "../../../hooks/useApiData";
import { apiFetch } from "../../../lib/apiClient";

type ParentProfileResponse = {
  ok: boolean;
  profile: {
    mainWorries?: string | null;
    usualApproach?: string | null;
    whatDoesNotWork?: string | null;
    wantsToImprove?: string | null;
    sendPreference?: "review_before_send" | "send_direct_if_allowed" | null;
    preferredCommunicationStyle?: string | null;
    consentAcknowledged?: boolean;
  } | null;
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

export default function ParentOnboardingPage() {
  const profile = useApiData<ParentProfileResponse>("/parents/me/communication-profile", true);
  const [didHydrate, setDidHydrate] = useState(false);
  const [form, setForm] = useState({
    mainWorries: "",
    usualApproach: "",
    whatDoesNotWork: "",
    wantsToImprove: "",
    sendPreference: "review_before_send",
    preferredCommunicationStyle: "",
    consentAcknowledged: false,
  });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (profile.loading || didHydrate) return;
    setDidHydrate(true);
    if (!profile.data?.profile) return;
    setForm({
      mainWorries: profile.data.profile.mainWorries || "",
      usualApproach: profile.data.profile.usualApproach || "",
      whatDoesNotWork: profile.data.profile.whatDoesNotWork || "",
      wantsToImprove: profile.data.profile.wantsToImprove || "",
      sendPreference: profile.data.profile.sendPreference || "review_before_send",
      preferredCommunicationStyle: profile.data.profile.preferredCommunicationStyle || "",
      consentAcknowledged: !!profile.data.profile.consentAcknowledged,
    });
  }, [didHydrate, profile.data, profile.loading]);

  async function save() {
    setStatus("Saving your parent communication baseline...");
    setError("");
    try {
      await apiFetch("/parents/me/communication-profile", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setStatus("Saved. The translator can now use this context.");
    } catch (err) {
      setStatus("");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <AppShell
      title="Parent communication baseline"
      subtitle="Tell the system what you are worried about and what tends not to work so it can coach the interaction more carefully."
    >
      <RequireRole expectedRoles={["parent", "admin"]} fallbackTitle="Parent sign-in required">
        <SectionCard
          title="How you want this used"
          subtitle="This tool is designed to improve communication, not to hide parent involvement or pressure the student."
          tone="highlight"
        >
          <div style={{ display: "grid", gap: 12, color: "#334155", lineHeight: 1.7 }}>
            <div>Parent context can always be saved for coaching and planning.</div>
            <div>Parent-originated messages should only be delivered when the student has consented.</div>
            <div>The system may rephrase for tone and clarity, but it should stay transparent about the parent origin.</div>
          </div>
        </SectionCard>

        <SectionCard
          title="Parent profile"
          subtitle="These answers help the translator understand how communication has been landing so far."
        >
          <div style={{ display: "grid", gap: 14 }}>
            <label style={labelStyle}>
              What are you most worried about?
              <textarea
                rows={4}
                value={form.mainWorries}
                onChange={(event) => setForm((current) => ({ ...current, mainWorries: event.target.value }))}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              How do you usually communicate with the student?
              <textarea
                rows={4}
                value={form.usualApproach}
                onChange={(event) => setForm((current) => ({ ...current, usualApproach: event.target.value }))}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              What tends not to work?
              <textarea
                rows={4}
                value={form.whatDoesNotWork}
                onChange={(event) => setForm((current) => ({ ...current, whatDoesNotWork: event.target.value }))}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              What would you like to improve?
              <textarea
                rows={4}
                value={form.wantsToImprove}
                onChange={(event) => setForm((current) => ({ ...current, wantsToImprove: event.target.value }))}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Preferred workflow
              <select
                value={form.sendPreference}
                onChange={(event) => setForm((current) => ({ ...current, sendPreference: event.target.value as typeof form.sendPreference }))}
                style={inputStyle}
              >
                <option value="review_before_send">Review translated messages before sending</option>
                <option value="send_direct_if_allowed">Direct send is acceptable if consent and safety allow it</option>
              </select>
            </label>

            <label style={labelStyle}>
              Preferred parent communication style
              <input
                value={form.preferredCommunicationStyle}
                onChange={(event) => setForm((current) => ({ ...current, preferredCommunicationStyle: event.target.value }))}
                style={inputStyle}
                placeholder="Calm, concise, question-led"
              />
            </label>

            <label
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                padding: 16,
                borderRadius: 16,
                background: "#f8fbff",
                border: "1px solid #dbe4f0",
              }}
            >
              <input
                type="checkbox"
                checked={form.consentAcknowledged}
                onChange={(event) => setForm((current) => ({ ...current, consentAcknowledged: event.target.checked }))}
                style={{ marginTop: 4 }}
              />
              <span style={{ lineHeight: 1.6 }}>
                I understand this feature is for respectful communication support. It is not a covert surveillance or manipulation tool.
              </span>
            </label>

            <div style={{ display: "grid", gap: 10 }}>
              <button onClick={() => void save()} style={{ width: "fit-content" }}>
                Save parent baseline
              </button>
              {status ? <p style={{ margin: 0, color: "#155eef" }}>{status}</p> : null}
              {error ? <p style={{ margin: 0, color: "crimson" }}>{error}</p> : null}
            </div>
          </div>
        </SectionCard>
      </RequireRole>
    </AppShell>
  );
}
