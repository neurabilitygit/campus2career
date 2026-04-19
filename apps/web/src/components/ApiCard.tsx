"use client";

export function ApiCard(props: {
  title: string;
  loading: boolean;
  error: string | null;
  data: any;
}) {
  return (
    <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 16 }}>
      <h2>{props.title}</h2>
      {props.loading && <p>Loading...</p>}
      {props.error && <p style={{ color: "crimson" }}>{props.error}</p>}
      {!props.loading && !props.error && (
        <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {JSON.stringify(props.data, null, 2)}
        </pre>
      )}
    </section>
  );
}
