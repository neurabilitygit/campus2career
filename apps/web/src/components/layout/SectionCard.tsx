"use client";

export function SectionCard(props: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  tone?: "default" | "highlight" | "warm" | "quiet";
  testId?: string;
  introTarget?: string;
  children: React.ReactNode;
}) {
  const toneStyles =
    props.tone === "highlight"
      ? {
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--role-soft, #eef3f8) 82%, white), rgba(255, 255, 255, 0.98))",
          border: "1px solid color-mix(in srgb, var(--role-accent, #155eef) 18%, white)",
        }
      : props.tone === "warm"
        ? {
            background:
              "linear-gradient(180deg, rgba(255, 252, 246, 0.98), rgba(255, 246, 229, 0.96))",
            border: "1px solid rgba(245, 158, 11, 0.18)",
          }
        : props.tone === "quiet"
          ? {
              background: "rgba(255, 255, 255, 0.72)",
              border: "1px solid rgba(129, 140, 169, 0.14)",
            }
          : {
              background: "rgba(255, 255, 255, 0.86)",
              border: "1px solid rgba(73, 102, 149, 0.14)",
            };

  return (
    <section
      data-testid={props.testId}
      data-intro-target={props.introTarget}
      style={{
        ...toneStyles,
        borderRadius: 26,
        padding: "22px clamp(18px, 2.6vw, 28px)",
        boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)",
        backdropFilter: "blur(14px)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          marginBottom: props.subtitle || props.eyebrow || props.actions ? 18 : 14,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 8, maxWidth: 760 }}>
          {props.eyebrow ? (
            <div
              style={{
                display: "inline-flex",
                width: "fit-content",
                padding: "6px 10px",
                borderRadius: 999,
                background: "color-mix(in srgb, var(--role-soft, #eef3f8) 90%, white)",
                color: "var(--role-accent, #155eef)",
                fontSize: 12,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              {props.eyebrow}
            </div>
          ) : null}
          <div style={{ display: "grid", gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: "clamp(1.3rem, 2.4vw, 1.65rem)", lineHeight: 1.05 }}>
              {props.title}
            </h2>
            {props.subtitle ? (
              <p style={{ margin: 0, color: "#52657d", lineHeight: 1.65 }}>{props.subtitle}</p>
            ) : null}
          </div>
        </div>
        {props.actions ? <div>{props.actions}</div> : null}
      </div>
      {props.children}
    </section>
  );
}
