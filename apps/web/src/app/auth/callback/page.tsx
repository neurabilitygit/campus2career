"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, getSupabaseConfigError } from "../../../lib/supabaseClient";
import { refreshSession } from "../../../lib/sessionStore";

function readHashParams() {
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  return new URLSearchParams(hash);
}

export default function AuthCallbackPage() {
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
        await refreshSession({ force: true });
        window.location.replace("/app");
      } else {
        setMessage("No active session found.");
      }
    }
    complete();
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "min(560px, 100%)",
          borderRadius: 30,
          padding: "32px clamp(22px, 5vw, 36px)",
          background:
            "linear-gradient(155deg, rgba(12, 18, 42, 0.98), rgba(18, 49, 104, 0.94) 55%, rgba(8, 145, 178, 0.9) 100%)",
          color: "#f8fafc",
          boxShadow: "0 30px 70px rgba(15, 23, 42, 0.18)",
          display: "grid",
          gap: 14,
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            justifySelf: "center",
            alignItems: "center",
            gap: 10,
            padding: "8px 14px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.1)",
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: 0.06,
            textTransform: "uppercase",
          }}
        >
          Rising Senior
        </div>
        <h1 style={{ margin: 0, fontSize: "clamp(2rem, 6vw, 3rem)" }}>Finishing sign-in</h1>
        <p style={{ margin: 0, color: "#dbe7ff", lineHeight: 1.7 }}>{message}</p>
      </div>
    </main>
  );
}
