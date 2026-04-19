import { getSupabaseBrowserClient, getSupabaseConfigError } from "./supabaseClient";
import { apiFetch } from "./apiClient";

export interface UploadRequestResult {
  ok: boolean;
  bucket: string;
  objectPath: string;
  token: string;
  contentType: string;
}

export async function uploadFileViaSignedUrl(input: {
  artifactType: string;
  file: File;
}) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseConfigError() || "Supabase is not configured.");
  }

  const presign = await apiFetch("/students/me/uploads/presign", {
    method: "POST",
    body: JSON.stringify({
      artifactType: input.artifactType,
      fileName: input.file.name,
      contentType: input.file.type || "application/octet-stream",
    }),
  }) as UploadRequestResult;

  const { data, error } = await supabase.storage
    .from(presign.bucket)
    .uploadToSignedUrl(
      presign.objectPath,
      presign.token,
      input.file,
      {
        contentType: presign.contentType,
      }
    );

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  const completion = await apiFetch("/students/me/uploads/complete", {
    method: "POST",
    body: JSON.stringify({
      artifactType: input.artifactType,
      objectPath: presign.objectPath,
    }),
  });

  return {
    presign,
    uploadResult: data,
    completion,
  };
}
