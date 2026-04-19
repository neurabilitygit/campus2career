"use client";

import { AppShell } from "../../../components/layout/AppShell";
import { SectionCard } from "../../../components/layout/SectionCard";
import { RequireRole } from "../../../components/RequireRole";
import { FileUploadForm } from "../../../components/uploads/FileUploadForm";

export default function ResumeUploadPage() {
  return (
    <AppShell title="Upload Résumé">
      <RequireRole expectedRoles={["student", "admin"]} fallbackTitle="Student sign-in required">
        <SectionCard title="Résumé upload">
          <FileUploadForm
            artifactType="resume"
            title="Upload Résumé"
            description="Request a signed upload target for a résumé artifact."
          />
        </SectionCard>
      </RequireRole>
    </AppShell>
  );
}
