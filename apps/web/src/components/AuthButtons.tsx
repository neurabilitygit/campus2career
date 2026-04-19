"use client";

import { getSupabaseBrowserClient, getSupabaseConfigError } from "../lib/supabaseClient";

export function AuthButtons() {
  const supabase = getSupabaseBrowserClient();
  const disabledReason = getSupabaseConfigError();

  async function signInWithGoogle() {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={signInWithGoogle} disabled={!supabase}>Sign in with Google</button>
        <button onClick={signOut} disabled={!supabase}>Sign out</button>
      </div>
      {disabledReason ? <p style={{ margin: 0, color: "crimson" }}>{disabledReason}</p> : null}
    </div>
  );
}
