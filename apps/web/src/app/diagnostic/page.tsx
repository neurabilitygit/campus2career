"use client";

import { useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { SectionCard } from "../../components/layout/SectionCard";
import { RequireRole } from "../../components/RequireRole";
import { apiFetch } from "../../lib/apiClient";

export default function DiagnosticPage() {
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>("");

  async function generate() {
    try {
      setError("");
      const data = await apiFetch("/students/me/diagnostic/first", {
        method: "GET",
      });
      setResult(data);
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  }

  return (
    <AppShell
      title="Generate a first diagnostic"
      subtitle="Use this once profile setup, sectors, uploads, and deadlines are in place and you want an initial diagnostic snapshot."
    >
      <RequireRole expectedRoles={["student", "admin"]} fallbackTitle="Student sign-in required">
        <SectionCard
          title="Diagnostic run"
          subtitle="This is a manual trigger for an early-stage diagnostic check."
          tone="highlight"
        >
          <button
            onClick={generate}
            className="ui-button ui-button--primary"
          >
            Generate diagnostic
          </button>
          {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
          {result ? (
            <details
              style={{
                borderRadius: 18,
                padding: "14px 16px",
                background: "rgba(255,255,255,0.82)",
                border: "1px solid rgba(73, 102, 149, 0.12)",
              }}
            >
              <summary style={{ fontWeight: 800 }}>Open diagnostic payload</summary>
              <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", marginBottom: 0 }}>
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          ) : null}
        </SectionCard>
      </RequireRole>
    </AppShell>
  );
}
