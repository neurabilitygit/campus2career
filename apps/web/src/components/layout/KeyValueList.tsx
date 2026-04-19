"use client";

export function KeyValueList(props: {
  items: Array<{ label: string; value: React.ReactNode }>;
}) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {props.items.map((item, idx) => (
        <div key={idx} style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12 }}>
          <strong>{item.label}</strong>
          <span>{item.value}</span>
        </div>
      ))}
    </div>
  );
}
