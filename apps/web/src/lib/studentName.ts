import { buildDirectAddressName, formatNamedReference } from "./personalization";

export function normalizeFirstName(value: string | null | undefined): string | null {
  return buildDirectAddressName({ firstName: value });
}

export function formatStudentReference(
  firstName: string | null | undefined,
  options?: { possessive?: boolean; fallback?: string }
): string {
  return formatNamedReference(
    { firstName },
    { possessive: options?.possessive, fallback: options?.fallback || "the student", preferPreferred: true }
  );
}
