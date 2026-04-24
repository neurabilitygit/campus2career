export function normalizeFirstName(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.split(/\s+/)[0] || null;
}

export function formatStudentReference(
  firstName: string | null | undefined,
  options?: { possessive?: boolean; fallback?: string }
): string {
  const normalized = normalizeFirstName(firstName);
  const fallback = options?.fallback || "the student";

  if (!normalized) {
    return fallback;
  }

  if (!options?.possessive) {
    return normalized;
  }

  return normalized.endsWith("s") ? `${normalized}'` : `${normalized}'s`;
}
