"use client";

import { AppShell } from "../../../components/layout/AppShell";
import { SectionCard } from "../../../components/layout/SectionCard";
import { RequireRole } from "../../../components/RequireRole";
import { FileUploadForm } from "../../../components/uploads/FileUploadForm";

export default function TranscriptUploadPage() {
  return (
    <AppShell title="Upload Transcript">
      <RequireRole expectedRoles={["student", "admin"]} fallbackTitle="Student sign-in required">
        <SectionCard title="Transcript upload">
          <FileUploadForm
            artifactType="transcript"
            title="Upload Transcript"
            description="Upload a transcript source document. PDF is supported and preferred."
            accept=".pdf,.txt,.csv,.json,application/pdf,text/plain,text/csv,application/json"
          />
        </SectionCard>
      </RequireRole>
    </AppShell>
  );
}
