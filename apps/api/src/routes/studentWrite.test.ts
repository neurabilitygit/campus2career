import test from "node:test";
import assert from "node:assert/strict";
import { validateUploadSourceFile } from "./studentWrite";

test("validateUploadSourceFile accepts PDF uploads for curriculum requirement documents", () => {
  assert.doesNotThrow(() =>
    validateUploadSourceFile({
      artifactType: "other",
      fileName: "economics-major-requirements.pdf",
      contentType: "application/pdf",
    })
  );
});

test("validateUploadSourceFile rejects non-PDF curriculum uploads when the file type does not match", () => {
  assert.throws(
    () =>
      validateUploadSourceFile({
        artifactType: "other",
        fileName: "economics-major-requirements.exe",
        contentType: "application/octet-stream",
      }),
    /INVALID_FILE_EXTENSION/
  );
});
