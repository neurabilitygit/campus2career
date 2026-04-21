"use client";

import Link from "next/link";
import { useState } from "react";
import { uploadFileViaSignedUrl } from "../../lib/storageUpload";

export function FileUploadForm(props: {
  artifactType: string;
  title: string;
  description: string;
  accept?: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");

  async function upload() {
    if (!file) {
      setError("Select a file first.");
      return;
    }

    try {
      setError(null);
      setStatus("Preparing your upload...");
      const data = await uploadFileViaSignedUrl({
        artifactType: props.artifactType,
        file,
      });
      setStatus("Upload complete.");
      setResult(data);
    } catch (err: any) {
      setStatus("");
      setError(err?.message || String(err));
    }
  }

  const completionMessage =
    result?.completion?.message ||
    "Your document was uploaded successfully and is now available to the system.";
  const artifactId = result?.completion?.academicArtifactId;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <p style={{ margin: 0, color: "#52657d", lineHeight: 1.6 }}>{props.description}</p>
      <input
        type="file"
        accept={props.accept}
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        style={{
          borderRadius: 16,
          border: "1px solid rgba(73, 102, 149, 0.18)",
          padding: "12px 14px",
          background: "rgba(255,255,255,0.82)",
        }}
      />
      {file ? (
        <div
          style={{
            borderRadius: 18,
            padding: "14px 16px",
            background: "rgba(248, 251, 255, 0.86)",
            border: "1px solid rgba(73, 102, 149, 0.12)",
          }}
        >
          <strong>{file.name}</strong>
          <p style={{ margin: "6px 0 0 0", color: "#52657d" }}>
            {(file.size / 1024 / 1024).toFixed(2)} MB
          </p>
        </div>
      ) : null}
      <button
        onClick={upload}
        style={{
          width: "fit-content",
          border: "none",
          borderRadius: 999,
          padding: "13px 18px",
          background: "linear-gradient(135deg, #155eef, #16a3ff)",
          color: "#ffffff",
          fontWeight: 800,
        }}
      >
        Upload document
      </button>
      {status ? <p style={{ margin: 0, color: "#155eef" }}>{status}</p> : null}
      {error ? <p style={{ margin: 0, color: "crimson" }}>{error}</p> : null}
      {result ? (
        <div
          style={{
            display: "grid",
            gap: 12,
            borderRadius: 22,
            padding: "18px 18px 20px",
            background: "linear-gradient(180deg, rgba(240, 253, 250, 0.95), rgba(236, 248, 255, 0.95))",
            border: "1px solid rgba(15, 159, 116, 0.18)",
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <strong style={{ fontSize: 18 }}>Document added successfully</strong>
            <p style={{ margin: 0, color: "#33546b", lineHeight: 1.6 }}>{completionMessage}</p>
            {artifactId ? (
              <p style={{ margin: 0, color: "#5f728a", fontSize: 14 }}>
                Reference ID: {artifactId}
              </p>
            ) : null}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link
              href="/uploads"
              style={{
                textDecoration: "none",
                borderRadius: 999,
                padding: "11px 16px",
                background: "#ffffff",
                border: "1px solid rgba(73, 102, 149, 0.16)",
                fontWeight: 700,
              }}
            >
              Back to documents
            </Link>
            <Link
              href="/student"
              style={{
                textDecoration: "none",
                borderRadius: 999,
                padding: "11px 16px",
                background: "linear-gradient(135deg, #155eef, #16a3ff)",
                color: "#ffffff",
                fontWeight: 800,
              }}
            >
              View student dashboard
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
