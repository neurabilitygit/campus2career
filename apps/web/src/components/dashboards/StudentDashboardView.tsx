"use client";

import { useMemo, useState } from "react";
import { AppShell } from "../layout/AppShell";
import { SectionCard } from "../layout/SectionCard";
import { KeyValueList } from "../layout/KeyValueList";
import { RequireRole } from "../RequireRole";
import { useApiData, useApiJsonPost } from "../../hooks/useApiData";

const DEFAULT_SCENARIO_QUESTION =
  "What if I keep my current major but focus this semester on the highest-signal gap-closing actions?";

export default function StudentDashboardView() {
  const auth = useApiData("/auth/me");
  const scoring = useApiData("/students/me/scoring");

  const [draftQuestion, setDraftQuestion] = useState(DEFAULT_SCENARIO_QUESTION);
  const [draftStyle, setDraftStyle] = useState("direct");
  const [applied, setApplied] = useState({
    scenarioQuestion: DEFAULT_SCENARIO_QUESTION,
    communicationStyle: "direct",
  });
  const [requestedScenario, setRequestedScenario] = useState(false);

  const scenarioBody = useMemo(
    () => ({
      scenarioQuestion: applied.scenarioQuestion,
      ...(applied.communicationStyle !== "direct"
        ? { communicationStyle: applied.communicationStyle }
        : {}),
    }),
    [applied.scenarioQuestion, applied.communicationStyle],
  );

  const scenario = useApiJsonPost("/v1/chat/scenario/live", scenarioBody, requestedScenario);

  return (
    <AppShell title="Student Dashboard" subtitle="Scoring, action signals, and scenario guidance.">
      <RequireRole expectedRoles={["student", "admin"]} fallbackTitle="Student sign-in required">
        <SectionCard title="Resolved Context">
          <KeyValueList items={[
            { label: "Authenticated role", value: auth.data?.context?.authenticatedRoleType || "Unknown" },
            { label: "Student profile ID", value: auth.data?.context?.studentProfileId || "None" },
            { label: "Household ID", value: auth.data?.context?.householdId || "None" },
          ]} />
        </SectionCard>

        <SectionCard title="Scoring">
          {scoring.loading ? <p>Loading scoring...</p> : null}
          {scoring.error ? <p style={{ color: "crimson" }}>{scoring.error}</p> : null}
          {!scoring.loading && !scoring.error ? (
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{JSON.stringify(scoring.data, null, 2)}</pre>
          ) : null}
        </SectionCard>

        <SectionCard title="Scenario Guidance">
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span>Your question</span>
              <textarea
                value={draftQuestion}
                onChange={(e) => setDraftQuestion(e.target.value)}
                rows={4}
                style={{ width: "100%", maxWidth: 640, fontFamily: "inherit" }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 280 }}>
              <span>Communication style</span>
              <select value={draftStyle} onChange={(e) => setDraftStyle(e.target.value)}>
                <option value="direct">Direct</option>
                <option value="supportive">Supportive</option>
                <option value="coaching">Coaching</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() =>
                {
                  setApplied({
                    scenarioQuestion: draftQuestion.trim() || DEFAULT_SCENARIO_QUESTION,
                    communicationStyle: draftStyle.trim() || "direct",
                  });
                  setRequestedScenario(true);
                }
              }
            >
              {scenario.loading ? "Loading…" : "Get guidance"}
            </button>
          </div>
          {scenario.loading ? <p>Loading scenario guidance...</p> : null}
          {scenario.error ? <p style={{ color: "crimson" }}>{scenario.error}</p> : null}
          {!scenario.loading && !scenario.error ? (
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{JSON.stringify(scenario.data, null, 2)}</pre>
          ) : null}
        </SectionCard>
      </RequireRole>
    </AppShell>
  );
}
