"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuthContext } from "../../hooks/useAuthContext";
import { useIntroOnboarding } from "../../hooks/useIntroOnboarding";
import { useRoleIntroOnboarding } from "../../hooks/useRoleIntroOnboarding";
import { rememberSaveNavigationRoute } from "../../lib/saveNavigation";
import { IntroTourOverlay } from "../onboarding/IntroTourOverlay";
import { IntroWelcomeSplash } from "../onboarding/IntroWelcomeSplash";
import { INTRO_TOUR_STEPS, ROLE_INTRO_TOUR_STEPS } from "../onboarding/introTourConfig";
import { buildBottomBackAction, type BottomBackAction } from "./backNavigation";
import { buildNavigationGroups, type ShellNavGroup, type ShellNavItem } from "./navigation";
import { TopBarNavigation } from "./TopBarNavigation";

const SIDEBAR_WIDTH_STORAGE_KEY = "rising-senior:sidebar-width";
const DEFAULT_SIDEBAR_WIDTH = 272;
const MIN_SIDEBAR_WIDTH = 224;
const MAX_SIDEBAR_WIDTH = 360;

function pathFromHref(href: string): string {
  return href.split("?")[0] || "/";
}

function querySectionFromHref(href: string): string | null {
  const query = href.split("?")[1];
  if (!query) return null;
  return new URLSearchParams(query).get("section");
}

function titleCase(value: string): string {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function clampWidth(value: number) {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, value));
}

function resolveTheme(
  pathname: string,
  role?: "student" | "parent" | "coach" | "admin" | null
): "student" | "parent" | "coach" | "system" {
  if (
    pathname.startsWith("/student") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/uploads")
  ) {
    return "student";
  }

  if (pathname.startsWith("/parent")) {
    return "parent";
  }

  if (pathname.startsWith("/coach") || pathname.startsWith("/diagnostic")) {
    return "coach";
  }

  if (pathname.startsWith("/profile") || pathname.startsWith("/communication")) {
    if (role === "student") return "student";
    if (role === "parent") return "parent";
    if (role === "coach") return "coach";
  }

  return "system";
}

export function AppShell(props: {
  title: string;
  subtitle?: string;
  secondaryNavTitle?: string;
  secondaryNavItems?: Array<{
    key: string;
    href: string;
    label: string;
    description?: string;
  }>;
  activeSecondaryNavKey?: string;
  backAction?: BottomBackAction | null | false;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const auth = useAuthContext();
  const currentRole = auth.data?.context?.authenticatedRoleType || null;
  const currentCapabilities = auth.data?.context?.effectiveCapabilities || [];
  const theme = resolveTheme(pathname, currentRole);
  const navGroups = useMemo(
    () => buildNavigationGroups(currentRole, currentCapabilities),
    [currentCapabilities, currentRole]
  );
  const introOnboarding = useIntroOnboarding({
    pathname,
    authenticated: auth.isAuthenticated,
    authResolved: !auth.loading && !!auth.data?.context,
    userId: auth.data?.context?.authenticatedUserId || null,
    role: currentRole,
    introOnboardingStatus: auth.data?.context?.introOnboardingStatus,
    introOnboardingVersion: auth.data?.context?.introOnboardingVersion,
    introOnboardingShouldAutoShow: auth.data?.context?.introOnboardingShouldAutoShow,
    steps: INTRO_TOUR_STEPS,
  });
  const roleIntroOnboarding = useRoleIntroOnboarding({
    pathname,
    authenticated: auth.isAuthenticated,
    authResolved: !auth.loading && !!auth.data?.context,
    userId: auth.data?.context?.authenticatedUserId || null,
    role: currentRole,
    steps: ROLE_INTRO_TOUR_STEPS,
  });
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  function isActive(item: ShellNavItem): boolean {
    const itemPath = pathFromHref(item.href);
    const itemSection = item.sectionKey || querySectionFromHref(item.href);

    if (itemSection) {
      return pathname === itemPath && (props.activeSecondaryNavKey || "strategy") === itemSection;
    }

    if (itemPath === "/") {
      return pathname === "/";
    }

    return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
  }

  function itemHasActiveChild(item: ShellNavItem) {
    return item.children?.some((child) => isActive(child)) || false;
  }

  function groupContainsActive(group: ShellNavGroup) {
    return group.items.some((item) => isActive(item) || itemHasActiveChild(item));
  }

  useEffect(() => {
    const storedWidth = window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
    if (!storedWidth) {
      return;
    }

    const parsed = Number(storedWidth);
    if (Number.isFinite(parsed)) {
      setSidebarWidth(clampWidth(parsed));
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    rememberSaveNavigationRoute(`${pathname}${window.location.search}`);
  }, [pathname]);

  useEffect(() => {
    setExpandedGroups((current) => {
      const next = { ...current };
      let changed = false;

      for (const group of navGroups) {
        if (groupContainsActive(group) && !next[group.key]) {
          next[group.key] = true;
          changed = true;
        }
      }

      if (!Object.keys(next).length) {
        for (const group of navGroups) {
          next[group.key] = groupContainsActive(group);
        }
        return next;
      }

      return changed ? next : current;
    });

    setExpandedItems((current) => {
      const next = { ...current };
      let changed = false;

      for (const group of navGroups) {
        for (const item of group.items) {
          if (item.children?.length && itemHasActiveChild(item) && !next[item.href]) {
            next[item.href] = true;
            changed = true;
          }
        }
      }

      return changed ? next : current;
    });
  }, [pathname, props.activeSecondaryNavKey]);

  useEffect(() => {
    if (introOnboarding.stage !== "hidden") {
      return;
    }

    if (roleIntroOnboarding.stage !== "hidden") {
      return;
    }

    if (introOnboarding.lastDismissal !== "completed") {
      return;
    }

    if (!roleIntroOnboarding.canAutoLaunch) {
      return;
    }

    roleIntroOnboarding.startTour();
  }, [
    introOnboarding.lastDismissal,
    introOnboarding.stage,
    roleIntroOnboarding.canAutoLaunch,
    roleIntroOnboarding.stage,
    roleIntroOnboarding.startTour,
  ]);

  const currentWorkspace = useMemo(() => {
    if (pathname === "/") {
      return "Home";
    }

    if (pathname === "/help") {
      return "Help";
    }

    return props.title || titleCase(pathname.split("/").filter(Boolean)[0] || "Workspace");
  }, [pathname, props.title]);

  const bottomBackAction = useMemo(() => {
    if (props.backAction === false) {
      return null;
    }

    if (props.backAction) {
      return props.backAction;
    }

    return buildBottomBackAction({
      pathname,
      role: currentRole,
    });
  }, [currentRole, pathname, props.backAction]);

  const showSecondaryGroup = !!props.secondaryNavItems?.length && pathname !== "/student";

  function beginResize(event: React.PointerEvent<HTMLButtonElement>) {
    if (window.matchMedia("(max-width: 980px)").matches) {
      return;
    }

    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidth;

    function handleMove(moveEvent: PointerEvent) {
      const nextWidth = clampWidth(startWidth + (moveEvent.clientX - startX));
      setSidebarWidth(nextWidth);
    }

    function handleUp() {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }

  return (
    <main
      className="app-shell"
      data-role-theme={theme}
      data-mobile-nav-open={mobileNavOpen ? "true" : "false"}
      style={{ ["--app-sidebar-width" as string]: `${sidebarWidth}px` }}
    >
      <div
        className="app-shell__scrim"
        aria-hidden={mobileNavOpen ? "false" : "true"}
        onClick={() => setMobileNavOpen(false)}
      />

      <aside className="app-sidebar" aria-label="Primary navigation">
        <div className="app-sidebar__inner">
          <div className="app-sidebar__brand">
            <Link href="/" className="app-sidebar__logo">
              <span className="app-sidebar__logo-mark" aria-hidden="true" />
              <span>Rising Senior</span>
            </Link>
            <div className="app-sidebar__context">
              <div className="app-sidebar__eyebrow">Current workspace</div>
              <strong>{currentWorkspace}</strong>
              <p>{props.subtitle || "Open the section you need, then work in the detail panel on the right."}</p>
            </div>
          </div>

          <nav className="app-sidebar__nav">
            {navGroups.map((group) => {
              const groupActive = groupContainsActive(group);
              const isExpanded = expandedGroups[group.key] ?? groupActive;

              return (
                <section
                  key={group.key}
                  className="app-sidebar__group"
                  data-active={groupActive ? "true" : "false"}
                >
                  <button
                    type="button"
                    className="app-sidebar__group-toggle"
                    aria-expanded={isExpanded ? "true" : "false"}
                    onClick={() =>
                      setExpandedGroups((current) => ({
                        ...current,
                        [group.key]: !(current[group.key] ?? groupActive),
                      }))
                    }
                  >
                    <span>{group.label}</span>
                    <span aria-hidden="true">{isExpanded ? "−" : "+"}</span>
                  </button>

                  {isExpanded ? (
                    <div className="app-sidebar__group-items">
                      {group.items.map((item) => {
                        const active = isActive(item);
                        const childActive = itemHasActiveChild(item);
                        const itemExpanded = expandedItems[item.href] ?? childActive;

                        return (
                          <div
                            key={item.href}
                            className="app-sidebar__item-block"
                            data-active={active || childActive ? "true" : "false"}
                          >
                            <div className="app-sidebar__item-head">
                              <Link
                                href={item.href}
                                className="app-sidebar__link"
                                data-active={active || childActive ? "true" : "false"}
                                data-intro-target={item.introTargetKey || undefined}
                              >
                                <span>{item.label}</span>
                                {item.description ? <small>{item.description}</small> : null}
                              </Link>
                              {item.children?.length ? (
                                <button
                                  type="button"
                                  className="app-sidebar__item-toggle"
                                  aria-label={`${itemExpanded ? "Collapse" : "Expand"} ${item.label}`}
                                  aria-expanded={itemExpanded ? "true" : "false"}
                                  onClick={() =>
                                    setExpandedItems((current) => ({
                                      ...current,
                                      [item.href]: !(current[item.href] ?? childActive),
                                    }))
                                  }
                                >
                                  {itemExpanded ? "−" : "+"}
                                </button>
                              ) : null}
                            </div>

                            {item.children?.length && itemExpanded ? (
                              <div className="app-sidebar__children" aria-label={`${item.label} subsections`}>
                                {item.children.map((child) => {
                                  const childActiveState = isActive(child);
                                  return (
                                    <Link
                                      key={child.href}
                                      href={child.href}
                                      className="app-sidebar__child-link"
                                      data-active={childActiveState ? "true" : "false"}
                                    >
                                      {child.label}
                                    </Link>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </section>
              );
            })}

            {showSecondaryGroup ? (
              <section className="app-sidebar__group" data-active="true">
                <div className="app-sidebar__group-toggle" aria-hidden="true">
                  <span>{props.secondaryNavTitle || "This page"}</span>
                  <span aria-hidden="true">•</span>
                </div>
                <div className="app-sidebar__children app-sidebar__children--standalone">
                  {props.secondaryNavItems?.map((item) => {
                    const active = item.key === props.activeSecondaryNavKey;
                    return (
                      <Link
                        key={item.key}
                        href={item.href}
                        className="app-sidebar__child-link"
                        data-active={active ? "true" : "false"}
                      >
                        <span>{item.label}</span>
                        {item.description ? <small>{item.description}</small> : null}
                      </Link>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </nav>
        </div>

        <button
          type="button"
          className="app-sidebar__resize-handle"
          aria-label="Resize navigation sidebar"
          onPointerDown={beginResize}
        />
      </aside>

      <section className="app-detail" aria-label="Detail workspace">
        <header className="app-topbar">
          <TopBarNavigation
            currentWorkspace={currentWorkspace}
            authContext={auth.data?.context}
            onOpenNavigation={() => setMobileNavOpen(true)}
          />
        </header>

        <header className="app-detail__header">
          <div className="app-detail__kicker">
            {theme === "student"
              ? "Student workspace"
              : theme === "parent"
                ? "Parent workspace"
                : theme === "coach"
                  ? "Coach workspace"
                  : "Platform workspace"}
          </div>
          <h1>{props.title}</h1>
          {props.subtitle ? <p>{props.subtitle}</p> : null}
        </header>

        <div className="app-detail__content">
          {props.children}
          {bottomBackAction ? (
            <div className="app-detail__footer-nav">
              <Link
                href={bottomBackAction.href}
                className="ui-button ui-button--secondary app-detail__footer-back"
                aria-label={bottomBackAction.ariaLabel || bottomBackAction.label}
                data-testid="app-bottom-back"
              >
                ← {bottomBackAction.label}
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      {introOnboarding.stage === "splash" ? (
        <IntroWelcomeSplash
          onContinue={introOnboarding.startTour}
          onSkip={introOnboarding.openSkipConfirmation}
        />
      ) : null}

      {introOnboarding.stage === "tour" && introOnboarding.activeStep ? (
        <IntroTourOverlay
          step={introOnboarding.activeStep}
          stepIndex={introOnboarding.currentIndex}
          totalSteps={introOnboarding.steps.length}
          target={introOnboarding.target}
          canGoBack={introOnboarding.canGoBack}
          isLastStep={introOnboarding.isLastStep}
          busy={introOnboarding.pending === "complete"}
          error={introOnboarding.error}
          onBack={introOnboarding.goBack}
          onNext={introOnboarding.goNext}
          onSkip={introOnboarding.openSkipConfirmation}
          onFinish={introOnboarding.complete}
        />
      ) : null}

      {roleIntroOnboarding.stage === "tour" && roleIntroOnboarding.activeStep ? (
        <IntroTourOverlay
          step={roleIntroOnboarding.activeStep}
          stepIndex={roleIntroOnboarding.currentIndex}
          totalSteps={roleIntroOnboarding.steps.length}
          target={roleIntroOnboarding.target}
          canGoBack={roleIntroOnboarding.canGoBack}
          isLastStep={roleIntroOnboarding.isLastStep}
          error={roleIntroOnboarding.error}
          onBack={roleIntroOnboarding.goBack}
          onNext={roleIntroOnboarding.goNext}
          onSkip={roleIntroOnboarding.openSkipConfirmation}
          onFinish={roleIntroOnboarding.complete}
        />
      ) : null}

      {introOnboarding.stage === "skip_confirm" ? (
        <div className="intro-onboarding intro-onboarding--confirm" role="dialog" aria-modal="true" aria-labelledby="intro-skip-title">
          <div className="intro-onboarding__scrim" aria-hidden="true" />
          <div className="intro-confirm">
            <h2 id="intro-skip-title">Skip the intro?</h2>
            <p>You can restart it later from Help.</p>
            {introOnboarding.error ? <div className="intro-tour__error">{introOnboarding.error}</div> : null}
            <div className="intro-confirm__actions">
              <button type="button" className="ui-button ui-button--ghost" onClick={introOnboarding.cancelSkipConfirmation}>
                Keep intro
              </button>
              <button
                type="button"
                className="ui-button ui-button--primary"
                onClick={introOnboarding.skip}
                disabled={introOnboarding.pending === "skip"}
              >
                {introOnboarding.pending === "skip" ? "Skipping..." : "Skip intro"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {roleIntroOnboarding.stage === "skip_confirm" ? (
        <div className="intro-onboarding intro-onboarding--confirm" role="dialog" aria-modal="true" aria-labelledby="role-intro-skip-title">
          <div className="intro-onboarding__scrim" aria-hidden="true" />
          <div className="intro-confirm">
            <h2 id="role-intro-skip-title">Skip the role walkthrough?</h2>
            <p>You can restart it later from Help or the account menu.</p>
            {roleIntroOnboarding.error ? <div className="intro-tour__error">{roleIntroOnboarding.error}</div> : null}
            <div className="intro-confirm__actions">
              <button type="button" className="ui-button ui-button--ghost" onClick={roleIntroOnboarding.cancelSkipConfirmation}>
                Keep walkthrough
              </button>
              <button type="button" className="ui-button ui-button--primary" onClick={roleIntroOnboarding.skip}>
                Skip walkthrough
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
