"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { clearStoredDemoAuth } from "../../lib/demoAuth";
import { launchIntroOnboardingReplay } from "../../lib/introOnboarding";
import { launchRoleIntroOnboardingReplay } from "../../lib/roleIntroOnboarding";
import { getSupabaseBrowserClient, getSupabaseConfigError } from "../../lib/supabaseClient";
import {
  getStoredTestContextRole,
  setStoredTestContextRole,
  subscribeToTestContextRole,
  type TestContextRole,
} from "../../lib/testContext";
import { useAuthContext } from "../../hooks/useAuthContext";

type WorkspaceItem = {
  key: "student" | "parent" | "coach" | "admin";
  label: string;
  href: string;
};

const workspaceItems: WorkspaceItem[] = [
  { key: "student", label: "Student", href: "/student?section=strategy" },
  { key: "parent", label: "Parent", href: "/parent" },
  { key: "coach", label: "Coach", href: "/coach" },
  { key: "admin", label: "Administration", href: "/admin" },
];

function displayName(input: {
  preferredName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}) {
  const preferredName = input.preferredName?.trim() || null;
  const firstName = input.firstName?.trim() || null;
  const lastName = input.lastName?.trim() || null;
  const placeholderName =
    firstName?.toLowerCase() === "unknown" && lastName?.toLowerCase() === "user";
  if (preferredName) {
    return placeholderName ? preferredName : [preferredName, lastName].filter(Boolean).join(" ");
  }
  const parts = placeholderName ? [] : [firstName, lastName].filter(Boolean);
  if (parts.length) {
    return parts.join(" ");
  }

  return input.email?.trim() || "Signed in";
}

export function AccountMenu() {
  const supabase = getSupabaseBrowserClient();
  const configError = getSupabaseConfigError();
  const auth = useAuthContext();
  const [open, setOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<"sign_in" | "sign_out" | null>(null);
  const [selectedPreviewRole, setSelectedPreviewRole] = useState<TestContextRole | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSelectedPreviewRole(getStoredTestContextRole());
    return subscribeToTestContextRole(setSelectedPreviewRole);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const context = auth.data?.context;
  const capabilities = context?.effectiveCapabilities || [];
  const allowedPreviewRoles = context?.testContextAllowedRoles || [];
  const canPreview = !!context?.testContextSwitchingEnabled && allowedPreviewRoles.length > 0;
  const currentRole = context?.authenticatedRoleType || null;
  const availableWorkspaces = useMemo(() => {
    if (canPreview) {
      return workspaceItems.filter((item) =>
        allowedPreviewRoles.includes(item.key as TestContextRole)
      );
    }

    if (currentRole === "student" || currentRole === "parent" || currentRole === "coach" || currentRole === "admin") {
      return workspaceItems.filter((item) => item.key === currentRole);
    }

    return [];
  }, [allowedPreviewRoles, canPreview, currentRole]);

  const userLabel = displayName({
    preferredName: context?.authenticatedPreferredName,
    firstName: context?.authenticatedFirstName,
    lastName: context?.authenticatedLastName,
    email: context?.email || null,
  });
  const triggerValue = auth.isAuthenticated ? userLabel : "Sign in";
  const triggerLabel = auth.isAuthenticated ? "Account" : null;
  const avatarLetter = (context?.authenticatedFirstName || context?.email || "A")
    .trim()
    .charAt(0)
    .toUpperCase();

  async function signInWithGoogle() {
    if (!supabase) return;
    setBusyAction("sign_in");
    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function signOut() {
    setBusyAction("sign_out");
    try {
      clearStoredDemoAuth();
      if (supabase) {
        await supabase.auth.signOut();
      }
      setStoredTestContextRole(null);
      window.location.href = "/";
    } finally {
      setBusyAction(null);
    }
  }

  function handlePreviewSelection(role: TestContextRole | null) {
    setStoredTestContextRole(role);
    setOpen(false);
    window.location.reload();
  }

  return (
    <div className="account-menu" ref={rootRef}>
      <button
        type="button"
        className="account-menu__trigger"
        data-intro-target="account-profile"
        aria-haspopup="menu"
        aria-expanded={open ? "true" : "false"}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="account-menu__avatar" aria-hidden="true">
          {avatarLetter}
        </span>
        <span className="account-menu__meta">
          {triggerLabel ? (
            <span className="account-menu__meta-label">
              {triggerLabel}
            </span>
          ) : null}
          <span className="account-menu__meta-value">
            {triggerValue}
          </span>
        </span>
        <span className="account-menu__chevron" aria-hidden="true">
          ▾
        </span>
      </button>

      {open ? (
        <div className="account-menu__panel" role="menu" aria-label="Account menu">
          {auth.isAuthenticated ? (
            <>
              <div className="account-menu__section">
                <div className="account-menu__section-label">Account</div>
                <div className="account-menu__summary">
                  <strong>{userLabel}</strong>
                  <span>{context?.email || "Signed in"}</span>
                  <span>
                    Workspace:{" "}
                    <strong style={{ textTransform: "capitalize" }}>
                      {selectedPreviewRole || currentRole || "default"}
                    </strong>
                  </span>
                </div>
              </div>

              <div className="account-menu__section">
                <div className="account-menu__section-label">Open workspace</div>
                <div className="account-menu__link-list">
                  {availableWorkspaces.length ? (
                    availableWorkspaces.map((item) => (
                      <Link
                        key={item.key}
                        href={item.href}
                        className="account-menu__link"
                        role="menuitem"
                        onClick={() => setOpen(false)}
                      >
                        {item.label}
                      </Link>
                    ))
                  ) : (
                    <div className="account-menu__hint">No alternate workspace is available for this account.</div>
                  )}
                </div>
              </div>

              <div className="account-menu__section">
                <div className="account-menu__section-label">Profile and tools</div>
                <div className="account-menu__link-list">
                  <Link href="/profile" className="account-menu__link" role="menuitem" onClick={() => setOpen(false)}>
                    Profile
                  </Link>
                  {capabilities.includes("view_household_admin") ? (
                    <Link href="/household-setup" className="account-menu__link" role="menuitem" onClick={() => setOpen(false)}>
                      Household setup
                    </Link>
                  ) : null}
                  {capabilities.includes("view_household_admin") ? (
                    <Link href="/admin" className="account-menu__link" role="menuitem" onClick={() => setOpen(false)}>
                      Household administration
                    </Link>
                  ) : null}
                  {capabilities.includes("view_communication") ? (
                    <Link href="/communication" className="account-menu__link" role="menuitem" onClick={() => setOpen(false)}>
                      Messages & chat
                    </Link>
                  ) : null}
                </div>
              </div>

              <div className="account-menu__section">
                <div className="account-menu__section-label">Switch workspace/persona</div>
                {canPreview ? (
                  <div className="account-menu__persona-list">
                    {allowedPreviewRoles.map((role) => {
                      const active = selectedPreviewRole === role;
                      return (
                        <button
                          key={role}
                          type="button"
                          className="account-menu__persona-button"
                          data-active={active ? "true" : "false"}
                          onClick={() => handlePreviewSelection(role)}
                        >
                          {role}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      className="account-menu__persona-button"
                      data-active={selectedPreviewRole === null ? "true" : "false"}
                      onClick={() => handlePreviewSelection(null)}
                    >
                      Default
                    </button>
                  </div>
                ) : (
                  <div className="account-menu__hint">
                    Persona switching is not available for this account.
                  </div>
                )}
              </div>

              <div className="account-menu__actions">
                <button
                  type="button"
                  className="ui-button ui-button--secondary"
                  onClick={() => {
                    launchIntroOnboardingReplay();
                    setOpen(false);
                  }}
                >
                  Replay intro
                </button>
                {currentRole ? (
                  <button
                    type="button"
                    className="ui-button ui-button--secondary"
                    onClick={() => {
                      launchRoleIntroOnboardingReplay();
                      setOpen(false);
                    }}
                  >
                    Replay role walkthrough
                  </button>
                ) : null}
                <button
                  type="button"
                  className="ui-button ui-button--ghost"
                  onClick={() => {
                    void auth.refreshSession();
                    setOpen(false);
                  }}
                >
                  Refresh account
                </button>
                <button
                  type="button"
                  className="ui-button ui-button--primary"
                  onClick={() => {
                    void signOut();
                  }}
                >
                  {busyAction === "sign_out" ? "Signing out..." : "Sign out"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="account-menu__section">
                <div className="account-menu__section-label">Account</div>
                <div className="account-menu__hint">
                  Sign in to open your saved workspace, documents, and role-specific dashboards.
                </div>
              </div>
              <div className="account-menu__actions">
                <button
                  type="button"
                  className="ui-button ui-button--primary"
                  onClick={() => {
                    void signInWithGoogle();
                  }}
                  disabled={!supabase || busyAction !== null || auth.sessionLoading}
                >
                  {busyAction === "sign_in"
                    ? "Opening Google..."
                    : auth.sessionLoading
                      ? "Checking session..."
                      : "Continue with Google"}
                </button>
              </div>
              {configError ? <div className="account-menu__error">{configError}</div> : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
