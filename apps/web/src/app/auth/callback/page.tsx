"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, getSupabaseConfigError } from "../../../lib/supabaseClient";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Completing sign-in...");

  useEffect(() => {
    async function complete() {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        setMessage(getSupabaseConfigError() || "Supabase is not configured.");
        return;
      }
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setMessage(`Auth error: ${error.message}`);
        return;
      }
      if (data.session) {
        setMessage("Signed in. You can now return to the app.");
      } else {
        setMessage("No active session found.");
      }
    }
    complete();
  }, []);

  return (
    <main style={{ padding: 32 }}>
      <h1>Campus2Career Auth Callback</h1>
      <p>{message}</p>
    </main>
  );
}
