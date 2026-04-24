export const neurodivergentCategoryOptions = [
  "ADHD",
  "Dyslexia",
  "ASD / Autism Spectrum",
  "Anxiety",
  "Executive function challenges",
  "Other",
  "Prefer not to say",
] as const;

export type NeurodivergentCategory = (typeof neurodivergentCategoryOptions)[number];

export interface BaseEditableProfile {
  fullName: string;
  preferredName: string | null;
  communicationPreferences: string | null;
  updatedAt?: string;
}

export interface StudentEditableProfile extends BaseEditableProfile {
  age: number | null;
  gender: string | null;
  housingStatus: string | null;
  knownNeurodivergentCategories: NeurodivergentCategory[];
  otherNeurodivergentDescription: string | null;
  personalChoices: string | null;
}

export interface ParentHouseholdMember {
  name: string;
  relationship: string | null;
}

export interface ParentEditableProfile extends BaseEditableProfile {
  familyUnitName: string | null;
  relationshipToStudent: string | null;
  householdMembers: ParentHouseholdMember[];
  familyStructure: string | null;
  partnershipStructure: string | null;
  knownNeurodivergentCategories: NeurodivergentCategory[];
  demographicInformation: string | null;
  parentGoalsOrConcerns: string | null;
}

export interface CoachEditableProfile extends BaseEditableProfile {
  professionalTitle: string | null;
  organizationName: string | null;
  coachingSpecialties: string[];
}
