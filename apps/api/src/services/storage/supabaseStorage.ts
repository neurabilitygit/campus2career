import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "../../config/supabase";

let adminClient: ReturnType<typeof createClient> | null = null;

function getAdminClient() {
  if (!adminClient) {
    if (!supabaseConfig.url || !supabaseConfig.serviceRoleKey) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
    }

    adminClient = createClient(
      supabaseConfig.url,
      supabaseConfig.serviceRoleKey,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );
  }

  return adminClient;
}

export interface SignedUploadTarget {
  bucket: string;
  path: string;
  token: string;
}

export async function createSignedUploadTarget(input: {
  bucket: string;
  path: string;
  upsert?: boolean;
}): Promise<SignedUploadTarget> {
  const client = getAdminClient();

  const { data, error } = await client.storage
    .from(input.bucket)
    .createSignedUploadUrl(input.path, {
      upsert: input.upsert ?? false,
    });

  if (error || !data) {
    throw new Error(`Failed to create signed upload URL: ${error?.message || "unknown error"}`);
  }

  return {
    bucket: input.bucket,
    path: input.path,
    token: data.token,
  };
}
