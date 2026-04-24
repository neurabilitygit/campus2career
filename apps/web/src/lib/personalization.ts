export function normalizeNamePart(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

export function buildFullName(input: {
  firstName?: string | null;
  lastName?: string | null;
  fallback?: string;
}) {
  const full = [normalizeNamePart(input.firstName), normalizeNamePart(input.lastName)]
    .filter(Boolean)
    .join(" ")
    .trim();
  return full || input.fallback || null;
}

export function buildDirectAddressName(input: {
  preferredName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  fallback?: string;
}) {
  return (
    normalizeNamePart(input.preferredName) ||
    normalizeNamePart(input.firstName) ||
    buildFullName(input) ||
    input.fallback ||
    null
  );
}

export function formatNamedReference(
  input: {
    preferredName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  },
  options?: {
    possessive?: boolean;
    fallback?: string;
    preferPreferred?: boolean;
  }
) {
  const base =
    (options?.preferPreferred ? buildDirectAddressName(input) : null) ||
    buildFullName(input) ||
    buildDirectAddressName(input) ||
    options?.fallback ||
    null;

  if (!base) {
    return options?.fallback || "";
  }

  if (!options?.possessive) {
    return base;
  }

  return base.endsWith("s") ? `${base}'` : `${base}'s`;
}
