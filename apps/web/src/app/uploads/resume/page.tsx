"use client";

import { AppShell } from "../../../components/layout/AppShell";
import { SectionCard } from "../../../components/layout/SectionCard";
import { RequireRole } from "../../../components/RequireRole";
import { FileUploadForm } from "../../../components/uploads/FileUploadForm";

export default function ResumeUploadPage() {
  return (
    <AppShell
      title="Add a resume"
      subtitle="Use your resume to strengthen experience, leadership, project, and proof-of-work signals."
    >
      <RequireRole expectedRoles={["student", "admin"]} fallbackTitle="Student sign-in required">
        <SectionCard
          title="Resume document"
          subtitle="PDF is preferred, but text and common document formats are also supported."
          tone="highlight"
        >
          <FileUploadForm
            artifactType="resume"
            title="Upload Résumé"
            description="Upload a résumé source document. PDF is supported and preferred."
            accept=".pdf,.txt,.md,.doc,.docx,application/pdf,text/plain,text/markdown,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          />
        </SectionCard>
      </RequireRole>
    </AppShell>
  );
}
