import { getSupabaseBrowserClient } from "./supabaseClient";
import { getStoredTestContextRole } from "./testContext";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";
const API_TIMEOUT_MS = 8000;

export async function apiFetch(path: string, init: RequestInit = {}) {
  const supabase = getSupabaseBrowserClient();
  let token: string | undefined;

  if (supabase) {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw new Error(`Failed to get session: ${error.message}`);
    }
    token = data.session?.access_token;
  }

  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json");

  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  const testContextRole = getStoredTestContextRole();
  if (testContextRole) {
    headers.set("x-test-context-role", testContextRole);
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, API_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    window.clearTimeout(timeoutId);
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`API request timed out after ${API_TIMEOUT_MS / 1000}s: ${path}`);
    }
    throw error;
  }

  window.clearTimeout(timeoutId);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API request failed: ${response.status} ${text}`);
  }

  return response.json();
}
