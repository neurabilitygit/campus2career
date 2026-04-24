export type NavigationRole = "student" | "parent" | "coach" | "admin" | null;

export type ShellNavItem = {
  href: string;
  label: string;
  description?: string;
  sectionKey?: string;
  allowedRoles?: NavigationRole[];
  children?: ShellNavItem[];
};

export type ShellNavGroup = {
  key: string;
  label: string;
  allowedRoles?: NavigationRole[];
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
        allowedRoles: ["student", "parent", "coach", "admin"],
      },
      {
        href: "/profile",
        label: "Profile",
        description: "Update your account details and preferences",
        allowedRoles: ["student", "parent", "coach", "admin"],
      },
    ],
  },
  {
    key: "student",
    label: "Student",
    allowedRoles: ["student", "admin"],
    items: [
      {
        href: "/student?section=strategy",
        label: "Student dashboard",
        description: "Readiness, evidence, and next moves",
        allowedRoles: ["student", "admin"],
        children: [
          { href: "/student?section=strategy", label: "Strategy", sectionKey: "strategy", allowedRoles: ["student", "admin"] },
          { href: "/student?section=evidence", label: "Evidence", sectionKey: "evidence", allowedRoles: ["student", "admin"] },
          { href: "/student?section=guidance", label: "Career readiness", sectionKey: "guidance", allowedRoles: ["student", "admin"] },
          { href: "/student?section=outcomes", label: "Outcome tracking", sectionKey: "outcomes", allowedRoles: ["student", "admin"] },
        ],
      },
      {
        href: "/onboarding",
        label: "Onboarding",
        description: "Academic path and preferences",
        allowedRoles: ["student", "admin"],
        children: [
          { href: "/onboarding/profile", label: "Academic path", allowedRoles: ["student", "admin"] },
          { href: "/onboarding/sectors", label: "Career interests", allowedRoles: ["student", "admin"] },
          { href: "/onboarding/network", label: "Network baseline", allowedRoles: ["student", "admin"] },
          { href: "/onboarding/deadlines", label: "Important dates", allowedRoles: ["student", "admin"] },
        ],
      },
      {
        href: "/uploads",
        label: "Documents",
        description: "Source material and evidence",
        allowedRoles: ["student", "admin"],
        children: [
          { href: "/uploads", label: "All documents", allowedRoles: ["student", "admin"] },
          { href: "/uploads/transcript", label: "Transcript", allowedRoles: ["student", "admin"] },
          { href: "/uploads/resume", label: "Resume", allowedRoles: ["student", "admin"] },
          { href: "/uploads/catalog", label: "Program PDF", allowedRoles: ["student", "admin"] },
          { href: "/uploads/other", label: "Supporting files", allowedRoles: ["student", "admin"] },
        ],
      },
    ],
  },
  {
    key: "parent",
    label: "Parent",
    allowedRoles: ["parent", "admin"],
    items: [
      { href: "/parent", label: "Parent dashboard", description: "Family-facing summary and actions", allowedRoles: ["parent", "admin"] },
      { href: "/parent/history", label: "History", description: "Review prior messages and activity", allowedRoles: ["parent", "admin"] },
      { href: "/parent/onboarding", label: "Parent onboarding", description: "Set communication baseline", allowedRoles: ["parent", "admin"] },
    ],
  },
  {
    key: "coach",
    label: "Coach",
    allowedRoles: ["coach", "admin"],
    items: [
      { href: "/coach", label: "Coach dashboard", description: "Roster, review, and follow-up workflow", allowedRoles: ["coach", "admin"] },
      { href: "/diagnostic", label: "Diagnostics", description: "Detailed technical checks", allowedRoles: ["coach", "admin"] },
    ],
  },
  {
    key: "communication",
    label: "Communication",
    allowedRoles: ["student", "parent", "coach", "admin"],
    items: [
      {
        href: "/communication",
        label: "Messages & chat",
        description: "Chatbot, translated messages, and role-aware communication tools",
        allowedRoles: ["student", "parent", "coach", "admin"],
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

function filterItem(item: ShellNavItem, role: NavigationRole): ShellNavItem | null {
  if (!includesRole(item.allowedRoles, role)) {
    return null;
  }

  const children = item.children
    ?.map((child) => filterItem(child, role))
    .filter((child): child is ShellNavItem => !!child);

  return {
    ...item,
    children,
  };
}

export function buildNavigationGroups(role: NavigationRole): ShellNavGroup[] {
  return navGroups
    .filter((group) => includesRole(group.allowedRoles, role))
    .map((group) => ({
      ...group,
      items: group.items
        .map((item) => filterItem(item, role))
        .filter((item): item is ShellNavItem => !!item),
    }))
    .filter((group) => group.items.length > 0);
}
