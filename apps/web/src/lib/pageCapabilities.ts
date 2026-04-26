import type { CapabilityKey } from "../../../../packages/shared/src/capabilities";

const PAGE_CAPABILITY_RULES: Array<{ prefix: string; capability: CapabilityKey }> = [
  { prefix: "/student", capability: "view_student_dashboard" },
  { prefix: "/onboarding", capability: "edit_student_profile" },
  { prefix: "/uploads/catalog", capability: "view_academic_evidence" },
  { prefix: "/uploads", capability: "view_documents" },
  { prefix: "/parent/history", capability: "view_parent_brief" },
  { prefix: "/parent/onboarding", capability: "edit_parent_profile" },
  { prefix: "/parent", capability: "view_parent_dashboard" },
  { prefix: "/coach", capability: "view_coach_dashboard" },
  { prefix: "/diagnostic", capability: "view_coach_dashboard" },
  { prefix: "/career-scenarios", capability: "view_career_goals" },
  { prefix: "/communication", capability: "view_communication" },
  { prefix: "/profile", capability: "view_student_information" },
  { prefix: "/household-setup", capability: "view_household_admin" },
  { prefix: "/admin", capability: "view_household_admin" },
];

export function capabilityForPath(pathname: string): CapabilityKey | null {
  return PAGE_CAPABILITY_RULES.find((rule) => pathname.startsWith(rule.prefix))?.capability || null;
}
