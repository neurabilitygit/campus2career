"use client";

import Link from "next/link";
import { AuthButtons } from "../AuthButtons";

export function AppShell(props: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <header style={{ marginBottom: 24, borderBottom: "1px solid #e5e5e5", paddingBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
          <div>
            <h1 style={{ margin: 0 }}>{props.title}</h1>
            {props.subtitle ? <p style={{ margin: "8px 0 0 0", color: "#555" }}>{props.subtitle}</p> : null}
          </div>
          <AuthButtons />
        </div>
        <nav style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
          <Link href="/">Home</Link>
          <Link href="/parent">Parent</Link>
          <Link href="/student">Student</Link>
          <Link href="/coach">Coach</Link>
          <Link href="/onboarding">Onboarding</Link>
          <Link href="/uploads">Uploads</Link>
        </nav>
      </header>
      {props.children}
    </main>
  );
}
