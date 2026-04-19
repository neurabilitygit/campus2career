"use client";

import { AppShell } from "../../../components/layout/AppShell";
import { SectionCard } from "../../../components/layout/SectionCard";
import { RequireRole } from "../../../components/RequireRole";
import { FileUploadForm } from "../../../components/uploads/FileUploadForm";

export default function OtherUploadPage() {
  return (
    <AppShell title="Upload Other Artifact">
      <RequireRole expectedRoles={["student", "admin"]} fallbackTitle="Student sign-in required">
        <SectionCard title="Other artifact upload">
          <FileUploadForm
            artifactType="other"
            title="Upload Other Artifact"
            description="Use this for projects, portfolios, presentations, certifications, or other relevant files. PDF source documents are supported."
            accept=".pdf,.txt,.md,.csv,.json,.doc,.docx,.ppt,.pptx,application/pdf,text/plain,text/markdown,text/csv,application/json,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          />
        </SectionCard>
      </RequireRole>
    </AppShell>
  );
}
