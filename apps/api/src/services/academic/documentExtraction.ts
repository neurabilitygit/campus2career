import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";

function normalizeExtractedText(value: string): string {
  return value
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[^\S\n]+/g, " ")
    .trim();
}

function extractPlainText(buffer: Buffer): string {
  return normalizeExtractedText(buffer.toString("utf8"));
}

function extractJsonText(buffer: Buffer): string {
  try {
    const parsed = JSON.parse(buffer.toString("utf8"));
    return normalizeExtractedText(JSON.stringify(parsed, null, 2));
  } catch {
    return extractPlainText(buffer);
  }
}

function decodePdfTextLiteral(literal: string): string {
  return literal
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t");
}

function extractPdfStringsFromChunk(chunk: string): string[] {
  const results: string[] = [];
  const literalRegex = /\((?:\\.|[^\\)])*\)/g;
  for (const match of chunk.matchAll(literalRegex)) {
    const value = match[0];
    results.push(decodePdfTextLiteral(value.slice(1, -1)));
  }
  return results;
}

function maybeInflatePdfStream(streamBuffer: Buffer): string | null {
  const attempts: Array<() => Buffer> = [
    () => zlib.inflateSync(streamBuffer),
    () => zlib.inflateRawSync(streamBuffer),
  ];

  for (const attempt of attempts) {
    try {
      return attempt().toString("latin1");
    } catch {
      continue;
    }
  }

  try {
    return streamBuffer.toString("latin1");
  } catch {
    return null;
  }
}

function extractPdfText(buffer: Buffer): string {
  const binary = buffer.toString("latin1");
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  const extracted: string[] = [];

  for (const match of binary.matchAll(streamRegex)) {
    const rawStream = match[1];
    const streamBuffer = Buffer.from(rawStream, "latin1");
    const decoded = maybeInflatePdfStream(streamBuffer);
    if (!decoded) continue;
    extracted.push(...extractPdfStringsFromChunk(decoded));
  }

  if (!extracted.length) {
    extracted.push(...extractPdfStringsFromChunk(binary));
  }

  return normalizeExtractedText(extracted.join("\n"));
}

function tryExtractPdfTextViaPdftotext(buffer: Buffer): string | null {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "c2c-pdf-"));
  const inputPath = path.join(tempDir, "document.pdf");

  try {
    fs.writeFileSync(inputPath, buffer);
    const output = execFileSync("pdftotext", [inputPath, "-"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 10 * 1024 * 1024,
    });
    const normalized = normalizeExtractedText(output);
    return normalized || null;
  } catch {
    return null;
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore temp cleanup failures.
    }
  }
}

function detectFileExtension(fileName: string): string {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || "";
}

export interface ExtractedDocumentText {
  text: string;
  method: "plain_text" | "json_text" | "pdf_text";
}

export function extractDocumentText(input: {
  buffer: Buffer;
  fileName: string;
  contentType?: string;
}): ExtractedDocumentText {
  const extension = detectFileExtension(input.fileName);
  const contentType = (input.contentType || "").toLowerCase();

  if (
    contentType.startsWith("text/") ||
    ["txt", "text", "md", "csv", "tsv"].includes(extension)
  ) {
    return {
      text: extractPlainText(input.buffer),
      method: "plain_text",
    };
  }

  if (contentType.includes("json") || extension === "json") {
    return {
      text: extractJsonText(input.buffer),
      method: "json_text",
    };
  }

  if (contentType.includes("pdf") || extension === "pdf") {
    const pdftotextResult = tryExtractPdfTextViaPdftotext(input.buffer);
    if (pdftotextResult) {
      return {
        text: pdftotextResult,
        method: "pdf_text",
      };
    }

    return {
      text: extractPdfText(input.buffer),
      method: "pdf_text",
    };
  }

  return {
    text: extractPlainText(input.buffer),
    method: "plain_text",
  };
}
