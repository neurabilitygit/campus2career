"use client";

import Link from "next/link";
import { AppShell } from "../../components/layout/AppShell";
import { SectionCard } from "../../components/layout/SectionCard";
import { RequireRole } from "../../components/RequireRole";

export default function UploadsHomePage() {
  return (
    <AppShell title="Uploads">
      <RequireRole expectedRoles={["student", "admin"]} fallbackTitle="Student sign-in required">
        <SectionCard title="Upload flows">
          <ul>
            <li><Link href="/uploads/resume">Upload résumé</Link></li>
            <li><Link href="/uploads/transcript">Upload transcript</Link></li>
            <li><Link href="/uploads/catalog">Upload catalog or program PDF</Link></li>
            <li><Link href="/uploads/other">Upload other relevant artifacts</Link></li>
          </ul>
        </SectionCard>
      </RequireRole>
    </AppShell>
  );
}
