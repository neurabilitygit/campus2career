"use client";

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
      setStatus("Requesting signed upload target...");
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

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <p>{props.description}</p>
      <input
        type="file"
        accept={props.accept}
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      <button onClick={upload}>Upload file</button>
      {status ? <p>{status}</p> : null}
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      {result ? (
        <div>
          <p>Upload succeeded.</p>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
