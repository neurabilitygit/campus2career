const DEFAULT_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "campus2career";

function getStorageDownloadUrl(bucket: string, objectPath: string): string {
  const supabaseUrl = process.env.SUPABASE_URL || "";
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL is required");
  }

  const encodedSegments = objectPath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment));

  return `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${encodedSegments.join("/")}`;
}

function getServiceHeaders(): Headers {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
  }

  const headers = new Headers();
  headers.set("authorization", `Bearer ${serviceRoleKey}`);
  headers.set("apikey", serviceRoleKey);
  return headers;
}

export interface DownloadedArtifact {
  bucket: string;
  objectPath: string;
  fileName: string;
  contentType: string;
  buffer: Buffer;
}

export async function downloadArtifactFromStorage(input: {
  objectPath: string;
  bucket?: string;
}): Promise<DownloadedArtifact> {
  const bucket = input.bucket || DEFAULT_STORAGE_BUCKET;
  const response = await fetch(getStorageDownloadUrl(bucket, input.objectPath), {
    headers: getServiceHeaders(),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to download artifact: ${response.status} ${body}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const fileName = input.objectPath.split("/").filter(Boolean).pop() || input.objectPath;

  return {
    bucket,
    objectPath: input.objectPath,
    fileName,
    contentType: response.headers.get("content-type") || "application/octet-stream",
    buffer: Buffer.from(arrayBuffer),
  };
}
