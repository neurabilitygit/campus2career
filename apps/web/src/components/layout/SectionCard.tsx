"use client";

export function SectionCard(props: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{
      border: "1px solid #ddd",
      borderRadius: 10,
      padding: 16,
      background: "#fff",
      marginBottom: 16
    }}>
      <h2 style={{ marginTop: 0, fontSize: 20 }}>{props.title}</h2>
      {props.children}
    </section>
  );
}
