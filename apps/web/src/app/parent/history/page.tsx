"use client";

import { AppShell } from "../../../components/layout/AppShell";
import { SectionCard } from "../../../components/layout/SectionCard";
import { RequireRole } from "../../../components/RequireRole";
import { useApiData } from "../../../hooks/useApiData";

type HistoryResponse = {
  ok: boolean;
  entries: Array<{
    parentCommunicationEntryId: string;
    category: string;
    status: string;
    urgency: string;
    deliveryIntent: string;
    parentConcerns?: string | null;
  }>;
  strategies: Array<{
    communicationStrategyId: string;
    generationMode: string;
    status: string;
    consentState: string;
    withholdDelivery: boolean;
    recommendedChannel?: string | null;
    createdAt?: string;
  }>;
  drafts: Array<{
    communicationMessageDraftId: string;
    selectedChannel: string;
    providerMode: string;
    status: string;
    deliveredAt?: string | null;
    createdAt?: string;
  }>;
  audit: Array<{
    communicationAuditLogId: string;
    eventType: string;
    eventSummary: string;
    createdAt?: string;
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

export default function ParentCommunicationHistoryPage() {
  const history = useApiData<HistoryResponse>("/parents/me/communication-history", true);

  return (
    <AppShell
      title="Communication history"
      subtitle="Review what was saved, translated, held, or mock-delivered so the feature stays auditable."
    >
      <RequireRole expectedRoles={["parent", "admin"]} fallbackTitle="Parent sign-in required">
        <SectionCard title="Entries" subtitle="Parent-originated context and concerns.">
          {history.loading ? <p>Loading history...</p> : null}
          <div style={{ display: "grid", gap: 10 }}>
            {(history.data?.entries || []).map((entry) => (
              <div key={entry.parentCommunicationEntryId} style={{ border: "1px solid #dbe4f0", borderRadius: 14, padding: 14 }}>
                <strong>{titleCase(entry.category)}</strong>
                <div style={{ color: "#52657d", marginTop: 6 }}>{entry.parentConcerns || "No summary provided"}</div>
                <small>{titleCase(entry.status)} · {titleCase(entry.urgency)} · {titleCase(entry.deliveryIntent)}</small>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Strategies" subtitle="Generated translation plans and their consent state.">
          <div style={{ display: "grid", gap: 10 }}>
            {(history.data?.strategies || []).map((strategy) => (
              <div key={strategy.communicationStrategyId} style={{ border: "1px solid #dbe4f0", borderRadius: 14, padding: 14 }}>
                <strong>{titleCase(strategy.status)}</strong>
                <div style={{ color: "#52657d", marginTop: 6 }}>
                  {titleCase(strategy.generationMode)} · Consent {titleCase(strategy.consentState)} · Channel {titleCase(strategy.recommendedChannel)}
                </div>
                {strategy.withholdDelivery ? (
                  <div style={{ color: "#b91c1c", marginTop: 6 }}>Delivery was withheld by consent or safety rules.</div>
                ) : null}
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Drafts and delivery" subtitle="Draft status and any mock sends recorded locally.">
          <div style={{ display: "grid", gap: 10 }}>
            {(history.data?.drafts || []).map((draft) => (
              <div key={draft.communicationMessageDraftId} style={{ border: "1px solid #dbe4f0", borderRadius: 14, padding: 14 }}>
                <strong>{titleCase(draft.status)}</strong>
                <div style={{ color: "#52657d", marginTop: 6 }}>
                  {titleCase(draft.selectedChannel)} · {titleCase(draft.providerMode)}
                </div>
                {draft.deliveredAt ? <small>Delivered at {new Date(draft.deliveredAt).toLocaleString()}</small> : null}
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Audit log" subtitle="Every important action is logged here.">
          <div style={{ display: "grid", gap: 10 }}>
            {(history.data?.audit || []).map((item) => (
              <div key={item.communicationAuditLogId} style={{ border: "1px solid #dbe4f0", borderRadius: 14, padding: 14 }}>
                <strong>{titleCase(item.eventType)}</strong>
                <div style={{ color: "#334155", marginTop: 6 }}>{item.eventSummary}</div>
                {item.createdAt ? <small>{new Date(item.createdAt).toLocaleString()}</small> : null}
              </div>
            ))}
          </div>
        </SectionCard>
      </RequireRole>
    </AppShell>
  );
}
