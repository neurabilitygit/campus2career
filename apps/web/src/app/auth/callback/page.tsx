"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient, getSupabaseConfigError } from "../../../lib/supabaseClient";

function readHashParams() {
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  return new URLSearchParams(hash);
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Completing sign-in...");

  useEffect(() => {
    async function complete() {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        setMessage(getSupabaseConfigError() || "Supabase is not configured.");
        return;
      }

      const hashParams = readHashParams();
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (setSessionError) {
          setMessage(`Auth error: ${setSessionError.message}`);
          return;
        }

        window.history.replaceState({}, document.title, window.location.pathname);
      }

      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setMessage(`Auth error: ${error.message}`);
        return;
      }
      if (data.session) {
        setMessage("Signed in. Redirecting you into the app...");
        router.replace("/app");
      } else {
        setMessage("No active session found.");
      }
    }
    complete();
  }, [router]);

  return (
    <main style={{ padding: 32 }}>
      <h1>Campus2Career Auth Callback</h1>
      <p>{message}</p>
    </main>
  );
}
