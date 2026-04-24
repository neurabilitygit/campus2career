"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AccountMenu } from "./AccountMenu";

type ShellNavItem = {
  href: string;
  label: string;
  description?: string;
  sectionKey?: string;
  children?: ShellNavItem[];
};

type ShellNavGroup = {
  key: string;
  label: string;
  items: ShellNavItem[];
};

const SIDEBAR_WIDTH_STORAGE_KEY = "rising-senior:sidebar-width";
const DEFAULT_SIDEBAR_WIDTH = 272;
const MIN_SIDEBAR_WIDTH = 224;
const MAX_SIDEBAR_WIDTH = 360;

const navGroups: ShellNavGroup[] = [
  {
    key: "start",
    label: "Start",
    items: [
      { href: "/", label: "Home", description: "Overview and sign-in" },
      { href: "/app", label: "Workspace", description: "Open the right dashboard" },
    ],
  },
  {
    key: "student",
    label: "Student",
    items: [
      {
        href: "/student?section=strategy",
        label: "Student dashboard",
        description: "Readiness, evidence, and next moves",
        children: [
          { href: "/student?section=strategy", label: "Strategy", sectionKey: "strategy" },
          { href: "/student?section=evidence", label: "Evidence", sectionKey: "evidence" },
          { href: "/student?section=guidance", label: "Career readiness", sectionKey: "guidance" },
          { href: "/student?section=outcomes", label: "Outcome tracking", sectionKey: "outcomes" },
          { href: "/student/messages", label: "Messages" },
        ],
      },
      {
        href: "/onboarding",
        label: "Onboarding",
        description: "Academic path and preferences",
        children: [
          { href: "/onboarding/profile", label: "Student profile" },
          { href: "/onboarding/sectors", label: "Career interests" },
          { href: "/onboarding/network", label: "Network baseline" },
          { href: "/onboarding/deadlines", label: "Important dates" },
        ],
      },
      {
        href: "/uploads",
        label: "Documents",
        description: "Source material and evidence",
        children: [
          { href: "/uploads", label: "All documents" },
          { href: "/uploads/transcript", label: "Transcript" },
          { href: "/uploads/resume", label: "Resume" },
          { href: "/uploads/catalog", label: "Program PDF" },
          { href: "/uploads/other", label: "Supporting files" },
        ],
      },
    ],
  },
  {
    key: "parent",
    label: "Parent",
    items: [
      { href: "/parent", label: "Parent dashboard", description: "Family-facing summary and actions" },
      { href: "/parent/communication", label: "Communication translator", description: "Translate concerns into calmer guidance" },
      { href: "/parent/history", label: "History", description: "Review prior messages and activity" },
      { href: "/parent/onboarding", label: "Parent onboarding", description: "Set communication baseline" },
    ],
  },
  {
    key: "coach",
    label: "Coach",
    items: [
      { href: "/coach", label: "Coach dashboard", description: "Diagnostics and intervention context" },
      { href: "/diagnostic", label: "Diagnostics", description: "Detailed technical checks" },
    ],
  },
  {
    key: "system",
    label: "System",
    items: [{ href: "/help", label: "Help and documentation", description: "Guides, consent notes, and feature references" }],
  },
];

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

function resolveTheme(pathname: string): "student" | "parent" | "coach" | "system" {
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
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const theme = resolveTheme(pathname);
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

  const currentWorkspace = useMemo(() => {
    if (pathname === "/") {
      return "Home";
    }

    if (pathname === "/help") {
      return "Help";
    }

    return props.title || titleCase(pathname.split("/").filter(Boolean)[0] || "Workspace");
  }, [pathname, props.title]);

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
          <div className="app-topbar__leading">
            <button
              type="button"
              className="app-topbar__menu-button"
              aria-label="Open navigation"
              onClick={() => setMobileNavOpen(true)}
            >
              ☰
            </button>
            <div className="app-topbar__workspace-chip">
              <span className="app-topbar__workspace-label">Workspace</span>
              <strong>{currentWorkspace}</strong>
            </div>
          </div>

          <div className="app-topbar__actions">
            <Link href="/help" className="ui-button ui-button--secondary">
              Help
            </Link>
            <AccountMenu />
          </div>
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

        <div className="app-detail__content">{props.children}</div>
      </section>
    </main>
  );
}
