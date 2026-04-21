"use client";

export function KeyValueList(props: {
  items: Array<{ label: string; value: React.ReactNode }>;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: 12,
      }}
    >
      {props.items.map((item, idx) => (
        <div
          key={idx}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(140px, 200px) 1fr",
            gap: 14,
            alignItems: "start",
            padding: "12px 14px",
            borderRadius: 16,
            background: "rgba(248, 251, 255, 0.82)",
            border: "1px solid rgba(148, 163, 184, 0.16)",
          }}
        >
          <strong
            style={{
              color: "#5f728a",
              fontSize: 13,
              lineHeight: 1.4,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {item.label}
          </strong>
          <span style={{ color: "#132238", lineHeight: 1.55 }}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}
