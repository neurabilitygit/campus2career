import { z } from "zod";
import { neurodivergentCategoryOptions } from "../../../../../packages/shared/src/contracts/profile";

function trimmedOptionalString(maxLength: number) {
  return z.preprocess(
    (value) => {
      if (value == null) {
        return undefined;
      }
      if (typeof value !== "string") {
        return value;
      }
      const trimmed = value.trim();
      return trimmed || undefined;
    },
    z.string().max(maxLength).optional()
  );
}

function trimmedRequiredString(maxLength: number) {
  return z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    z.string().min(1).max(maxLength)
  );
}

const householdMemberSchema = z.object({
  name: trimmedRequiredString(120),
  relationship: trimmedOptionalString(120),
});

export const studentEditableProfileSchema = z.object({
  fullName: trimmedRequiredString(160),
  preferredName: trimmedOptionalString(80),
  age: z.number().int().min(0).max(130).nullable().optional(),
  gender: trimmedOptionalString(80),
  housingStatus: trimmedOptionalString(120),
  knownNeurodivergentCategories: z.array(z.enum(neurodivergentCategoryOptions)).max(8).default([]),
  otherNeurodivergentDescription: trimmedOptionalString(400),
  communicationPreferences: trimmedOptionalString(4000),
  personalChoices: trimmedOptionalString(4000),
});

export const parentEditableProfileSchema = z.object({
  fullName: trimmedRequiredString(160),
  preferredName: trimmedOptionalString(80),
  familyUnitName: trimmedOptionalString(160),
  relationshipToStudent: trimmedOptionalString(120),
  householdMembers: z.array(householdMemberSchema).max(12).default([]),
  familyStructure: trimmedOptionalString(160),
  partnershipStructure: trimmedOptionalString(160),
  knownNeurodivergentCategories: z.array(z.enum(neurodivergentCategoryOptions)).max(8).default([]),
  demographicInformation: trimmedOptionalString(4000),
  communicationPreferences: trimmedOptionalString(4000),
  parentGoalsOrConcerns: trimmedOptionalString(4000),
});

export const coachEditableProfileSchema = z.object({
  fullName: trimmedRequiredString(160),
  preferredName: trimmedOptionalString(80),
  professionalTitle: trimmedOptionalString(160),
  organizationName: trimmedOptionalString(160),
  coachingSpecialties: z.array(trimmedRequiredString(120)).max(20).default([]),
  communicationPreferences: trimmedOptionalString(4000),
});

export function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: "", lastName: "" };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}
