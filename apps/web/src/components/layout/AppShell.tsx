"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthButtons } from "../AuthButtons";

export function AppShell(props: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const navItems = [
    { href: "/", label: "Home" },
    { href: "/onboarding", label: "Onboarding" },
    { href: "/uploads", label: "Documents" },
    { href: "/student", label: "Student" },
    { href: "/parent", label: "Parent" },
    { href: "/coach", label: "Coach" },
  ];

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "24px 18px 48px",
      }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: 22 }}>
        <header
          style={{
            borderRadius: 32,
            padding: "24px clamp(18px, 3vw, 34px)",
            background:
              "linear-gradient(140deg, rgba(12, 18, 42, 0.98) 0%, rgba(18, 49, 104, 0.94) 46%, rgba(8, 145, 178, 0.9) 100%)",
            color: "#f8fafc",
            boxShadow: "0 32px 60px rgba(15, 23, 42, 0.14)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: "-80px auto auto -60px",
              width: 240,
              height: 240,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(255,255,255,0.12), rgba(255,255,255,0) 70%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: "auto -80px -120px auto",
              width: 300,
              height: 300,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(255, 184, 76, 0.28), rgba(255,184,76,0) 68%)",
            }}
          />

          <div style={{ position: "relative", display: "grid", gap: 22 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 20,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "grid", gap: 14, maxWidth: 700 }}>
                <Link
                  href="/"
                  style={{
                    textDecoration: "none",
                    display: "inline-flex",
                    width: "fit-content",
                    alignItems: "center",
                    gap: 10,
                    color: "#f8fafc",
                    fontWeight: 800,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    fontSize: 13,
                  }}
                >
                  <span
                    style={{
                      width: 11,
                      height: 11,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #ffd166 0%, #7dd3fc 100%)",
                      boxShadow: "0 0 0 6px rgba(255,255,255,0.08)",
                    }}
                  />
                  Campus2Career
                </Link>
                <div style={{ display: "grid", gap: 10 }}>
                  <h1
                    style={{
                      margin: 0,
                      fontSize: "clamp(2rem, 4.6vw, 3.35rem)",
                      lineHeight: 0.95,
                    }}
                  >
                    {props.title}
                  </h1>
                  {props.subtitle ? (
                    <p
                      style={{
                        margin: 0,
                        maxWidth: 760,
                        color: "#dbe7ff",
                        lineHeight: 1.7,
                        fontSize: "clamp(1rem, 1.7vw, 1.08rem)",
                      }}
                    >
                      {props.subtitle}
                    </p>
                  ) : null}
                </div>
              </div>

              <div
                style={{
                  minWidth: 280,
                  maxWidth: 360,
                  borderRadius: 24,
                  padding: 18,
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  backdropFilter: "blur(10px)",
                  display: "grid",
                  gap: 10,
                }}
              >
                <div style={{ display: "grid", gap: 4 }}>
                  <strong style={{ fontSize: 16 }}>Account access</strong>
                  <p style={{ margin: 0, color: "#dbe7ff", lineHeight: 1.5 }}>
                    Sign in once, then move through the product with the right dashboard and next step already queued up.
                  </p>
                </div>
                <AuthButtons />
              </div>
            </div>

            <nav style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {navItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === item.href
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      textDecoration: "none",
                      padding: "11px 16px",
                      borderRadius: 999,
                      background: isActive ? "#f8fafc" : "rgba(255,255,255,0.08)",
                      color: isActive ? "#12213a" : "#eff6ff",
                      border: `1px solid ${isActive ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.12)"}`,
                      fontWeight: 700,
                      boxShadow: isActive ? "0 10px 24px rgba(255,255,255,0.14)" : "none",
                    }}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </header>

        <div style={{ display: "grid", gap: 18 }}>{props.children}</div>
      </div>
    </main>
  );
}
