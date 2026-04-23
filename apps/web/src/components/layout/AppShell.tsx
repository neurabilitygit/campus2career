"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthButtons } from "../AuthButtons";

type ShellNavItem = {
  href: string;
  label: string;
  description?: string;
  sectionKey?: string;
  children?: ShellNavItem[];
};

type ShellNavGroup = {
  label: string;
  items: ShellNavItem[];
};

const navGroups: ShellNavGroup[] = [
  {
    label: "Start",
    items: [
      { href: "/", label: "Home", description: "Overview and sign-in" },
      { href: "/app", label: "Workspace", description: "Open the right dashboard" },
    ],
  },
  {
    label: "Student",
    items: [
      {
        href: "/student?section=strategy",
        label: "Student dashboard",
        description: "Score, target, evidence, and advice",
        children: [
          { href: "/student?section=strategy", label: "Strategy", sectionKey: "strategy" },
          { href: "/student?section=evidence", label: "Evidence", sectionKey: "evidence" },
          { href: "/student?section=guidance", label: "Guidance", sectionKey: "guidance" },
        ],
      },
      {
        href: "/onboarding",
        label: "Onboarding",
        description: "Set up the academic and career profile",
        children: [
          { href: "/onboarding/profile", label: "Student profile" },
          { href: "/onboarding/sectors", label: "Career sectors" },
          { href: "/onboarding/network", label: "Network baseline" },
          { href: "/onboarding/deadlines", label: "Deadlines" },
        ],
      },
      {
        href: "/uploads",
        label: "Documents",
        description: "Upload source material",
        children: [
          { href: "/uploads/transcript", label: "Transcript" },
          { href: "/uploads/resume", label: "Resume" },
          { href: "/uploads/catalog", label: "Program PDF" },
          { href: "/uploads/other", label: "Other files" },
        ],
      },
    ],
  },
  {
    label: "Family and support",
    items: [
      {
        href: "/parent",
        label: "Parent",
        description: "Family-facing guidance and brief",
        children: [
          { href: "/parent", label: "Overview" },
          { href: "/parent/communication", label: "Communication" },
          { href: "/parent/history", label: "History" },
          { href: "/parent/onboarding", label: "Parent onboarding" },
        ],
      },
      { href: "/coach", label: "Coach", description: "Support and diagnostics" },
    ],
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

const shellStyle: CSSProperties = {
  minHeight: "100vh",
  fontFamily: "\"Avenir Next\", \"Segoe UI\", \"Helvetica Neue\", sans-serif",
  background:
    "radial-gradient(circle at 18% 12%, rgba(245, 158, 11, 0.18), transparent 28%), radial-gradient(circle at 88% 0%, rgba(8, 145, 178, 0.16), transparent 24%), linear-gradient(180deg, #f8fbff 0%, #eef5ff 46%, #f7f1e8 100%)",
};

const sidebarStyle: CSSProperties = {
  position: "fixed",
  inset: "0 auto 0 0",
  zIndex: 20,
  width: 240,
  padding: 14,
  display: "grid",
  gridTemplateRows: "auto minmax(0, 1fr) auto",
  gap: 14,
  color: "#f8fafc",
  background:
    "linear-gradient(180deg, rgba(12, 20, 36, 0.98) 0%, rgba(18, 37, 64, 0.98) 52%, rgba(21, 58, 91, 0.98) 100%)",
  borderRight: "1px solid rgba(255, 255, 255, 0.12)",
  boxShadow: "18px 0 44px rgba(15, 23, 42, 0.16)",
};

const sidebarPanelStyle: CSSProperties = {
  borderRadius: 20,
  padding: 13,
  background: "rgba(255, 255, 255, 0.08)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
};

const sidebarNavStyle: CSSProperties = {
  minHeight: 0,
  overflowY: "auto",
  display: "grid",
  alignContent: "start",
  gap: 14,
  paddingRight: 3,
};

const detailStyle: CSSProperties = {
  minHeight: "100vh",
  marginLeft: 240,
  padding: "20px clamp(18px, 3vw, 34px) 36px",
  display: "grid",
  alignContent: "start",
  gap: 16,
};

const detailHeaderStyle: CSSProperties = {
  borderRadius: 28,
  padding: "22px clamp(18px, 3vw, 28px)",
  background: "rgba(255, 255, 255, 0.86)",
  border: "1px solid rgba(73, 102, 149, 0.12)",
  boxShadow: "0 16px 36px rgba(15, 23, 42, 0.05)",
  backdropFilter: "blur(16px)",
};

function sidebarLinkStyle(active: boolean): CSSProperties {
  return {
    textDecoration: "none",
    display: "grid",
    gap: 3,
    padding: "11px 12px",
    borderRadius: 16,
    background: active ? "#f8fafc" : "rgba(255, 255, 255, 0.055)",
    color: active ? "#12213a" : "#eff6ff",
    border: `1px solid ${active ? "rgba(255, 255, 255, 0.5)" : "rgba(255, 255, 255, 0.08)"}`,
    boxShadow: active ? "0 10px 24px rgba(255, 255, 255, 0.1)" : "none",
  };
}

function childLinkStyle(active: boolean): CSSProperties {
  return {
    textDecoration: "none",
    display: "grid",
    gap: 2,
    padding: "8px 10px",
    borderRadius: 13,
    background: active ? "rgba(125, 211, 252, 0.16)" : "rgba(255, 255, 255, 0.035)",
    color: active ? "#e0f2fe" : "#eff6ff",
    border: `1px solid ${active ? "rgba(125, 211, 252, 0.34)" : "rgba(255, 255, 255, 0.08)"}`,
    fontSize: 13,
    fontWeight: 800,
  };
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
  const currentWorkspace =
    pathname === "/"
      ? "Home"
      : titleCase(pathname.split("/").filter(Boolean)[0] || props.title);

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

  function groupContainsActive(group: ShellNavGroup): boolean {
    return group.items.some((item) => isActive(item) || item.children?.some((child) => isActive(child)));
  }

  return (
    <main className="app-shell" style={shellStyle}>
      <aside className="app-sidebar" style={sidebarStyle} aria-label="Primary navigation">
        <div className="app-sidebar__brand" style={{ display: "grid", gap: 12 }}>
          <Link
            href="/"
            className="app-sidebar__logo"
            style={{
              width: "fit-content",
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              color: "#f8fafc",
              textDecoration: "none",
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            <span
              className="app-sidebar__logo-mark"
              style={{
                width: 11,
                height: 11,
                borderRadius: 999,
                background: "linear-gradient(135deg, #ffd166 0%, #7dd3fc 100%)",
                boxShadow: "0 0 0 6px rgba(255, 255, 255, 0.08)",
              }}
            />
            <span>Rising Senior</span>
          </Link>
          <div className="app-sidebar__context" style={sidebarPanelStyle}>
            <span className="app-sidebar__eyebrow" style={{ color: "#91a6c8", fontSize: 11, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>Current workspace</span>
            <strong style={{ display: "block", marginTop: 5, fontSize: 20, lineHeight: 1.05 }}>{currentWorkspace}</strong>
            <p style={{ margin: "7px 0 0", color: "#dbe7ff", fontSize: 13, lineHeight: 1.45 }}>{props.subtitle || "Choose a section from the left and work in the detail panel."}</p>
          </div>
        </div>

        <nav className="app-sidebar__nav" style={sidebarNavStyle}>
          {navGroups.map((group) => (
            <section
              key={group.label}
              className="app-sidebar__group"
              data-active={groupContainsActive(group) ? "true" : "false"}
              style={{ display: "grid", gap: 8 }}
            >
              <div
                className="app-sidebar__group-label"
                style={{
                  color: groupContainsActive(group) ? "#dbeafe" : "#91a6c8",
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {group.label}
              </div>
              <div className="app-sidebar__group-items" style={{ display: "grid", gap: 6 }}>
                {group.items.map((item) => {
                  const itemActive = isActive(item);
                  const childActive = item.children?.some((child) => isActive(child)) || false;
                  const active = itemActive || childActive;

                  return (
                    <div key={item.href} className="app-sidebar__item-block" style={{ display: "grid", gap: 6 }}>
                      <Link
                        href={item.href}
                        className="app-sidebar__link"
                        data-active={active ? "true" : "false"}
                        style={sidebarLinkStyle(active)}
                      >
                        <span style={{ fontSize: 14, fontWeight: 900 }}>{item.label}</span>
                        {item.description ? (
                          <small style={{ color: active ? "#52657d" : "#b8cae6", fontSize: 12, lineHeight: 1.35 }}>
                            {item.description}
                          </small>
                        ) : null}
                      </Link>

                      {item.children?.length ? (
                        <div
                          className="app-sidebar__children"
                          style={{ display: "grid", gap: 5, marginLeft: 10, paddingLeft: 10, borderLeft: "1px solid rgba(255, 255, 255, 0.14)" }}
                          aria-label={`${item.label} subsections`}
                        >
                          {item.children.map((child) => {
                            const childActive = isActive(child);
                            return (
                              <Link
                                key={child.href}
                                href={child.href}
                                className="app-sidebar__child-link"
                                data-active={childActive ? "true" : "false"}
                                style={childLinkStyle(childActive)}
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
            </section>
          ))}

          {props.secondaryNavItems?.length ? (
            <section className="app-sidebar__group" data-active="true" style={{ display: "grid", gap: 8 }}>
              <div className="app-sidebar__group-label" style={{ color: "#dbeafe", fontSize: 11, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {props.secondaryNavTitle || "Page sections"}
              </div>
              <div className="app-sidebar__children app-sidebar__children--standalone" style={{ display: "grid", gap: 5 }}>
                {props.secondaryNavItems.map((item) => {
                  const active = item.key === props.activeSecondaryNavKey;
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      className="app-sidebar__child-link"
                      data-active={active ? "true" : "false"}
                      style={childLinkStyle(active)}
                    >
                      <span>{item.label}</span>
                      {item.description ? <small style={{ color: "#b8cae6", fontSize: 11, fontWeight: 600, lineHeight: 1.35 }}>{item.description}</small> : null}
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}
        </nav>

        <div className="app-sidebar__account" style={{ ...sidebarPanelStyle, display: "grid", gap: 12 }}>
          <div>
            <strong>Account access</strong>
            <p style={{ margin: "7px 0 0", color: "#dbe7ff", fontSize: 13, lineHeight: 1.45 }}>Sign in once, then move between workspaces from this sidebar.</p>
          </div>
          <AuthButtons />
        </div>
      </aside>

      <section className="app-detail" style={detailStyle} aria-label="Detail workspace">
        <header className="app-detail__header" style={detailHeaderStyle}>
          <div
            className="app-detail__kicker"
            style={{
              display: "inline-flex",
              width: "fit-content",
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(21, 94, 239, 0.08)",
              color: "#155eef",
              fontSize: 12,
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Detail view
          </div>
          <h1 style={{ margin: "10px 0 0", color: "#0f172a", fontSize: "clamp(1.8rem, 3.3vw, 2.7rem)", lineHeight: 0.98 }}>
            {props.title}
          </h1>
          {props.subtitle ? (
            <p style={{ margin: "10px 0 0", maxWidth: 820, color: "#52657d", fontSize: "clamp(0.98rem, 1.4vw, 1.05rem)", lineHeight: 1.7 }}>
              {props.subtitle}
            </p>
          ) : null}
        </header>

        <div className="app-detail__content" style={{ minWidth: 0, display: "grid", gap: 16 }}>{props.children}</div>
      </section>
    </main>
  );
}
