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
    <AppShell title="First Diagnostic">
      <RequireRole expectedRoles={["student", "admin"]} fallbackTitle="Student sign-in required">
        <SectionCard title="Generate first diagnostic">
          <p>Use this after profile, sector, upload, and deadline setup.</p>
          <button onClick={generate}>Generate diagnostic</button>
          {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
          {result ? (
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          ) : null}
        </SectionCard>
      </RequireRole>
    </AppShell>
  );
}
