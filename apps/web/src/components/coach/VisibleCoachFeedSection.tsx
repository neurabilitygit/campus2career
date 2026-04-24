"use client";

import { useApiData } from "../../hooks/useApiData";
import { SectionCard } from "../layout/SectionCard";

type Mode = "student" | "parent";

type CoachFeedResponse = {
  ok: boolean;
  feed: {
    recommendations: Array<{
      coachRecommendationId: string;
      title: string;
      recommendedNextStep: string;
      priority: string;
      dueDate?: string | null;
      coachDisplayName?: string | null;
    }>;
    actionItems: Array<{
      coachActionItemId: string;
      title: string;
      description?: string | null;
      priority: string;
      dueDate?: string | null;
      status: string;
      coachDisplayName?: string | null;
    }>;
    flags: Array<{
      coachFlagId: string;
      title: string;
      description: string;
      severity: string;
      status: string;
    }>;
    notes: Array<{
      coachNoteId: string;
      title: string;
      body: string;
      noteType: string;
      coachDisplayName?: string | null;
      createdAt?: string;
    }>;
  };
};

function endpoint(mode: Mode) {
  return mode === "student" ? "/students/me/coach-feed" : "/parents/me/coach-feed";
}

function titleCase(value: string | undefined | null): string {
  if (!value) return "Unknown";
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function sectionCopy(mode: Mode) {
  if (mode === "student") {
    return {
      title: "Coach-sourced actions and feedback",
      subtitle: "These items were created or shared by a coach and stay labeled that way.",
      empty: "No coach-visible actions, flags, or recommendations are available yet.",
    };
  }

  return {
    title: "Coach updates visible to the family",
    subtitle: "This section only shows coach-sourced items that were marked visible to a parent.",
    empty: "No parent-visible coach recommendations, actions, or flags are available yet.",
  };
}

function sourceLabel(name?: string | null) {
  return name ? `Recommended by Coach ${name}` : "Coach-sourced action";
}

export function VisibleCoachFeedSection(props: { mode: Mode }) {
  const copy = sectionCopy(props.mode);
  const feed = useApiData<CoachFeedResponse>(endpoint(props.mode));

  const hasContent = !!(
    feed.data?.feed?.recommendations?.length ||
    feed.data?.feed?.actionItems?.length ||
    feed.data?.feed?.flags?.length ||
    feed.data?.feed?.notes?.length
  );

  return (
    <SectionCard title={copy.title} subtitle={copy.subtitle} tone="quiet">
      {feed.loading ? <p>Loading coach updates...</p> : null}
      {feed.error ? <p style={{ color: "crimson" }}>{feed.error}</p> : null}
      {!feed.loading && !feed.error && !hasContent ? <p style={{ margin: 0, color: "#64748b" }}>{copy.empty}</p> : null}
      {!feed.loading && !feed.error && hasContent ? (
        <div style={{ display: "grid", gap: 16 }}>
          {(feed.data?.feed?.actionItems || []).length ? (
            <div style={{ display: "grid", gap: 10 }}>
              <strong>Coach-sourced action items</strong>
              {(feed.data?.feed?.actionItems || []).map((item) => (
                <div key={item.coachActionItemId} className="ui-soft-panel">
                  <div style={{ fontWeight: 800 }}>{item.title}</div>
                  {item.description ? <div style={{ color: "#334155", lineHeight: 1.5 }}>{item.description}</div> : null}
                  <div style={{ color: "#64748b", fontSize: 14, lineHeight: 1.5 }}>
                    {sourceLabel(item.coachDisplayName)} · {titleCase(item.priority)} priority · {titleCase(item.status)}
                    {item.dueDate ? ` · Due ${new Date(item.dueDate).toLocaleDateString()}` : ""}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {(feed.data?.feed?.recommendations || []).length ? (
            <div style={{ display: "grid", gap: 10 }}>
              <strong>Coach recommendations</strong>
              {(feed.data?.feed?.recommendations || []).map((item) => (
                <div key={item.coachRecommendationId} className="ui-soft-panel">
                  <div style={{ fontWeight: 800 }}>{item.title}</div>
                  <div style={{ color: "#334155", lineHeight: 1.5 }}>{item.recommendedNextStep}</div>
                  <div style={{ color: "#64748b", fontSize: 14, lineHeight: 1.5 }}>
                    {sourceLabel(item.coachDisplayName)} · {titleCase(item.priority)} priority
                    {item.dueDate ? ` · Due ${new Date(item.dueDate).toLocaleDateString()}` : ""}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {(feed.data?.feed?.flags || []).length ? (
            <div style={{ display: "grid", gap: 10 }}>
              <strong>Open coach flags</strong>
              {(feed.data?.feed?.flags || []).map((item) => (
                <div key={item.coachFlagId} className="ui-soft-panel">
                  <div style={{ fontWeight: 800 }}>{item.title}</div>
                  <div style={{ color: "#334155", lineHeight: 1.5 }}>{item.description}</div>
                  <div style={{ color: "#64748b", fontSize: 14 }}>
                    {titleCase(item.severity)} · {titleCase(item.status)}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {(feed.data?.feed?.notes || []).length ? (
            <div style={{ display: "grid", gap: 10 }}>
              <strong>Recent coach feedback</strong>
              {(feed.data?.feed?.notes || []).map((item) => (
                <div key={item.coachNoteId} className="ui-soft-panel">
                  <div style={{ fontWeight: 800 }}>{item.title}</div>
                  <div style={{ color: "#334155", lineHeight: 1.5 }}>{item.body}</div>
                  <div style={{ color: "#64748b", fontSize: 14 }}>
                    {sourceLabel(item.coachDisplayName)} · {titleCase(item.noteType)}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </SectionCard>
  );
}
