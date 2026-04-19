import Link from "next/link";
import { AuthButtons } from "../components/AuthButtons";

export default function HomePage() {
  return (
    <main style={{ padding: 32, maxWidth: 960, margin: "0 auto" }}>
      <h1>Campus2Career</h1>
      <p>Parent-first career intelligence platform starter.</p>
      <AuthButtons />
      <nav style={{ display: "flex", gap: 16, margin: "16px 0" }}>
        <Link href="/parent">Parent Dashboard</Link>
        <Link href="/student">Student Dashboard</Link>
        <Link href="/coach">Coach Dashboard</Link>
      </nav>
      <ul>
        <li>Parent dashboard</li>
        <li>Student dashboard</li>
        <li>Coach dashboard</li>
        <li>Scenario chat</li>
        <li>Parent briefs and alerts</li>
      </ul>
    </main>
  );
}
