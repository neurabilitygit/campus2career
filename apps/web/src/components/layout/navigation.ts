import type { CapabilityKey } from "../../../../../packages/shared/src/capabilities";

export type NavigationRole = "student" | "parent" | "coach" | "admin" | null;

export type ShellNavItem = {
  href: string;
  label: string;
  description?: string;
  sectionKey?: string;
  introTargetKey?: string;
  allowedRoles?: NavigationRole[];
  requiredCapability?: CapabilityKey;
  children?: ShellNavItem[];
};

export type ShellNavGroup = {
  key: string;
  label: string;
  allowedRoles?: NavigationRole[];
  requiredCapability?: CapabilityKey;
  items: ShellNavItem[];
};

const ALL_ROLES: NavigationRole[] = ["student", "parent", "coach", "admin", null];

const navGroups: ShellNavGroup[] = [
  {
    key: "start",
    label: "Start",
    allowedRoles: ALL_ROLES,
    items: [
      { href: "/", label: "Home", description: "Overview and sign-in", allowedRoles: ALL_ROLES },
      {
        href: "/app",
        label: "Workspace",
        description: "Open the right dashboard",
        introTargetKey: "nav-workspace",
        allowedRoles: ["student", "parent", "coach", "admin"],
      },
      {
        href: "/profile",
        label: "Profile",
        description: "Update your account details and preferences",
        introTargetKey: "nav-profile",
        allowedRoles: ["student", "parent", "coach", "admin"],
        requiredCapability: "view_student_information",
      },
      {
        href: "/household-setup",
        label: "Household setup",
        description: "See how student, parent, and optional coach accounts connect",
        introTargetKey: "nav-household",
        allowedRoles: ["student", "parent", "coach", "admin"],
        requiredCapability: "view_household_admin",
      },
    ],
  },
  {
    key: "student",
    label: "Student",
    allowedRoles: ["student", "admin"],
    requiredCapability: "view_student_dashboard",
    items: [
      {
        href: "/student?section=strategy",
        label: "Student dashboard",
        description: "Readiness, evidence, and next moves",
        allowedRoles: ["student", "admin"],
        requiredCapability: "view_student_dashboard",
        children: [
          { href: "/student?section=strategy", label: "Strategy", sectionKey: "strategy", allowedRoles: ["student", "admin"], requiredCapability: "view_student_dashboard" },
          { href: "/student?section=evidence", label: "Evidence", sectionKey: "evidence", allowedRoles: ["student", "admin"], requiredCapability: "view_academic_evidence" },
          { href: "/student?section=guidance", label: "Career readiness", sectionKey: "guidance", allowedRoles: ["student", "admin"], requiredCapability: "view_recommendations" },
          { href: "/student?section=outcomes", label: "Outcome tracking", sectionKey: "outcomes", allowedRoles: ["student", "admin"], requiredCapability: "view_student_information" },
        ],
      },
      {
        href: "/onboarding",
        label: "Onboarding",
        description: "Academic path and preferences",
        introTargetKey: "nav-onboarding",
        allowedRoles: ["student", "admin"],
        requiredCapability: "edit_student_profile",
        children: [
          { href: "/onboarding/profile", label: "Academic path", allowedRoles: ["student", "admin"], requiredCapability: "edit_student_profile" },
          { href: "/onboarding/sectors", label: "Career interests", allowedRoles: ["student", "admin"], requiredCapability: "edit_student_profile" },
          { href: "/onboarding/network", label: "Network baseline", allowedRoles: ["student", "admin"], requiredCapability: "edit_student_profile" },
          { href: "/onboarding/deadlines", label: "Important dates", allowedRoles: ["student", "admin"], requiredCapability: "edit_student_profile" },
        ],
      },
      {
        href: "/uploads",
        label: "Documents",
        description: "Source material and evidence",
        introTargetKey: "nav-documents",
        allowedRoles: ["student", "admin"],
        requiredCapability: "view_documents",
        children: [
          { href: "/uploads", label: "All documents", allowedRoles: ["student", "admin"], requiredCapability: "view_documents" },
          { href: "/uploads/transcript", label: "Transcript", allowedRoles: ["student", "admin"], requiredCapability: "upload_documents" },
          { href: "/uploads/resume", label: "Resume", allowedRoles: ["student", "admin"], requiredCapability: "upload_documents" },
          { href: "/uploads/catalog", label: "Program PDF", allowedRoles: ["student", "admin"], requiredCapability: "upload_degree_requirements_pdf" },
          { href: "/uploads/other", label: "Supporting files", allowedRoles: ["student", "admin"], requiredCapability: "upload_documents" },
        ],
      },
    ],
  },
  {
    key: "parent",
    label: "Parent",
    allowedRoles: ["parent", "admin"],
    requiredCapability: "view_parent_dashboard",
    items: [
      { href: "/parent", label: "Parent dashboard", description: "Family-facing summary and actions", introTargetKey: "nav-parent-dashboard", allowedRoles: ["parent", "admin"], requiredCapability: "view_parent_dashboard" },
      { href: "/parent/history", label: "History", description: "Review prior messages and activity", introTargetKey: "nav-parent-history", allowedRoles: ["parent", "admin"], requiredCapability: "view_parent_brief" },
      { href: "/parent/onboarding", label: "Parent onboarding", description: "Set communication baseline", introTargetKey: "nav-parent-onboarding", allowedRoles: ["parent", "admin"], requiredCapability: "edit_parent_profile" },
    ],
  },
  {
    key: "coach",
    label: "Coach",
    allowedRoles: ["coach", "admin"],
    requiredCapability: "view_coach_dashboard",
    items: [
      { href: "/coach", label: "Coach dashboard", description: "Roster, review, and follow-up workflow", introTargetKey: "nav-coach-dashboard", allowedRoles: ["coach", "admin"], requiredCapability: "view_coach_dashboard" },
      { href: "/diagnostic", label: "Diagnostics", description: "Detailed technical checks", allowedRoles: ["coach", "admin"], requiredCapability: "view_coach_dashboard" },
    ],
  },
  {
    key: "career-scenario",
    label: "Career Goal",
    allowedRoles: ["student", "parent", "coach", "admin"],
    requiredCapability: "view_career_goals",
    items: [
      {
        href: "/career-scenarios",
        label: "Career Goal",
        description: "Saved job-target goals, comparisons, and job-specific readiness guidance",
        introTargetKey: "nav-career-goal",
        allowedRoles: ["student", "parent", "coach", "admin"],
        requiredCapability: "view_career_goals",
      },
    ],
  },
  {
    key: "communication",
    label: "Communication",
    allowedRoles: ["student", "parent", "coach", "admin"],
    requiredCapability: "view_communication",
    items: [
      {
        href: "/communication",
        label: "Communication hub",
        description: "Role-aware communication profiles, translators, and summaries",
        introTargetKey: "nav-communication",
        allowedRoles: ["student", "parent", "coach", "admin"],
        requiredCapability: "view_communication",
      },
      {
        href: "/communication?section=profile",
        label: "Communication profile",
        description: "Parent communication baseline and profile context",
        allowedRoles: ["parent", "admin"],
        requiredCapability: "communication_profile_parent_edit",
      },
      {
        href: "/communication?section=insights",
        label: "Insight prompts",
        description: "Add parent context and student friction cues over time",
        allowedRoles: ["parent", "admin"],
        requiredCapability: "communication_profile_parent_edit",
      },
      {
        href: "/communication?section=translator",
        label: "Translator",
        description: "Translate parent concerns into lower-friction student language",
        allowedRoles: ["parent", "admin"],
        requiredCapability: "communication_translate_parent_to_student",
      },
      {
        href: "/communication?section=preferences",
        label: "My preferences",
        description: "Student communication preferences and support style",
        allowedRoles: ["student", "admin"],
        requiredCapability: "communication_profile_student_edit",
      },
      {
        href: "/communication?section=wish",
        label: "What adults should know",
        description: "Student context that helps adults communicate more usefully",
        allowedRoles: ["student", "admin"],
        requiredCapability: "communication_profile_student_edit",
      },
      {
        href: "/communication?section=helper",
        label: "Conversation helper",
        description: "Translate a student message into parent-readable language",
        allowedRoles: ["student", "admin"],
        requiredCapability: "communication_translate_student_to_parent",
      },
      {
        href: "/communication?section=context",
        label: "Communication context",
        description: "Coach-visible communication summary and friction-reduction cues",
        allowedRoles: ["coach", "admin"],
        requiredCapability: "communication_coach_context_view",
      },
    ],
  },
  {
    key: "administration",
    label: "Administration",
    allowedRoles: ["parent", "admin"],
    requiredCapability: "view_household_admin",
    items: [
      {
        href: "/admin",
        label: "Household administration",
        description: "Manage members, invitations, join requests, and permissions",
        allowedRoles: ["parent", "admin"],
        requiredCapability: "view_household_admin",
      },
    ],
  },
  {
    key: "system",
    label: "System",
    allowedRoles: ALL_ROLES,
    items: [{ href: "/help", label: "Help and documentation", description: "Guides, consent notes, and feature references", allowedRoles: ALL_ROLES }],
  },
];

function includesRole(allowedRoles: NavigationRole[] | undefined, role: NavigationRole) {
  if (!allowedRoles?.length) {
    return true;
  }
  return allowedRoles.includes(role);
}

function includesCapability(requiredCapability: CapabilityKey | undefined, capabilities: CapabilityKey[]) {
  if (!requiredCapability) {
    return true;
  }
  return capabilities.includes(requiredCapability);
}

function filterItem(item: ShellNavItem, role: NavigationRole, capabilities: CapabilityKey[]): ShellNavItem | null {
  if (!includesRole(item.allowedRoles, role) || !includesCapability(item.requiredCapability, capabilities)) {
    return null;
  }

  const children = item.children
    ?.map((child) => filterItem(child, role, capabilities))
    .filter((child): child is ShellNavItem => !!child);

  return {
    ...item,
    children,
  };
}

export function buildNavigationGroups(role: NavigationRole, capabilities: CapabilityKey[] = []): ShellNavGroup[] {
  return navGroups
    .filter((group) => includesRole(group.allowedRoles, role) && includesCapability(group.requiredCapability, capabilities))
    .map((group) => ({
      ...group,
      items: group.items
        .map((item) => filterItem(item, role, capabilities))
        .filter((item): item is ShellNavItem => !!item),
    }))
    .filter((group) => group.items.length > 0);
}
