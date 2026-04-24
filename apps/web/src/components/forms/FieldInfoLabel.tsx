"use client";

import { useState } from "react";

export function FieldInfoLabel(props: {
  label: string;
  info: string;
  example?: string;
}) {
  const [open, setOpen] = useState(false);

  function toggle(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setOpen((current) => !current);
  }

  function close(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setOpen(false);
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
      }}
    >
      <span>{props.label}</span>
      <button
        type="button"
        aria-label={`More information about ${props.label}`}
        onClick={toggle}
        style={{
          width: 18,
          height: 18,
          borderRadius: 999,
          border: "1px solid #9bb0cf",
          background: open ? "#155eef" : "#ffffff",
          color: open ? "#ffffff" : "#3b4c65",
          fontSize: 11,
          fontWeight: 800,
          lineHeight: 1,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          padding: 0,
        }}
      >
        i
      </button>
      {open ? (
        <span
          style={{
            display: "inline-flex",
            alignItems: "flex-start",
            gap: 10,
            padding: "10px 12px",
            borderRadius: 14,
            background: "#f8fbff",
            border: "1px solid #dbe4f0",
            color: "#3d4f68",
            fontSize: 13,
            fontWeight: 500,
            lineHeight: 1.5,
            maxWidth: 420,
          }}
        >
          <span style={{ display: "grid", gap: 4 }}>
            <span>{props.info}</span>
            {props.example ? <span><strong>Example:</strong> {props.example}</span> : null}
          </span>
          <button
            type="button"
            aria-label={`Close information about ${props.label}`}
            onClick={close}
            style={{
              border: "none",
              background: "transparent",
              color: "#64748b",
              fontSize: 14,
              fontWeight: 800,
              cursor: "pointer",
              padding: 0,
              lineHeight: 1,
            }}
          >
            x
          </button>
        </span>
      ) : null}
    </span>
  );
}
