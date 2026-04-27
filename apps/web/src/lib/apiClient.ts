import { getSupabaseBrowserClient } from "./supabaseClient";
import { demoAuthHeaders, readStoredDemoAuth } from "./demoAuth";
import {
  getStoredTestContextRole,
  getStoredTestContextStudentProfileId,
  inferTestContextRoleFromBrowserState,
} from "./testContext";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";
const DEFAULT_API_TIMEOUT_MS = 15000;

export type ApiRequestInit = RequestInit & {
  timeoutMs?: number;
};

export async function apiFetch(path: string, init: ApiRequestInit = {}) {
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

  const demoAuth = !token ? readStoredDemoAuth() : null;
  if (demoAuth) {
    const demoHeaders = demoAuthHeaders(demoAuth);
    headers.set("x-demo-user-id", demoHeaders["x-demo-user-id"]);
    headers.set("x-demo-role-type", demoHeaders["x-demo-role-type"]);
    headers.set("x-demo-email", demoHeaders["x-demo-email"]);
  }

  const testContextRole =
    getStoredTestContextRole() ||
    inferTestContextRoleFromBrowserState(
      typeof window !== "undefined" ? window.location.pathname : null
    );
  if (testContextRole) {
    headers.set("x-test-context-role", testContextRole);
  }

  if (typeof window !== "undefined") {
    const searchStudentProfileId = new URLSearchParams(window.location.search).get("studentProfileId")?.trim() || null;
    const storedStudentProfileId = getStoredTestContextStudentProfileId();
    const studentProfileId = searchStudentProfileId || storedStudentProfileId;
    if (studentProfileId) {
      headers.set("x-test-context-student-profile-id", studentProfileId);
    }
  }

  const timeoutMs = init.timeoutMs ?? DEFAULT_API_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  let response: Response;
  try {
    const { timeoutMs: _timeoutMs, ...fetchInit } = init;
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...fetchInit,
      headers,
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    window.clearTimeout(timeoutId);
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`API request timed out after ${timeoutMs / 1000}s: ${path}`);
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
