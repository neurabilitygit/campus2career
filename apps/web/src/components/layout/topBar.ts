import type { CapabilityKey } from "../../../../../packages/shared/src/capabilities";
import type { WorkspaceRole } from "../../lib/workspaceAccess";

export const MAX_TOP_BAR_ITEMS = 7;

export type TopBarAttentionItem = {
  key: string;
  label: string;
  href: string;
  priority: number;
};

export type TopBarItem = {
  key: string;
  kind: "workspace" | "student" | "scenario" | "attention" | "link" | "account";
  label: string;
  shortLabel?: string;
  href?: string;
  priority: number;
  badgeCount?: number;
  group: "leading" | "actions";
  title?: string;
  dataPriority?: "high" | "medium" | "low";
};

export type BuildTopBarItemsInput = {
  role: WorkspaceRole;
  currentWorkspace: string;
  capabilities?: CapabilityKey[];
  selectedStudentName?: string | null;
  selectedStudentHref?: string | null;
  canViewStudentContext?: boolean;
  activeScenario?: {
    scenarioName?: string | null;
    status?: string | null;
    targetRole?: string | null;
    targetProfession?: string | null;
  } | null;
  activeScenarioHref?: string | null;
  attentionItems?: TopBarAttentionItem[];
  communicationHref?: string | null;
  helpHref?: string;
};

function hasCapability(capabilities: CapabilityKey[] | undefined, capability: CapabilityKey) {
  return !!capabilities?.includes(capability);
}

function compactScenarioLabel(input: BuildTopBarItemsInput["activeScenario"]) {
  if (!input) return null;
  return input.scenarioName?.trim() || input.targetRole?.trim() || input.targetProfession?.trim() || null;
}

export function buildTopBarItems(input: BuildTopBarItemsInput): TopBarItem[] {
  const items: TopBarItem[] = [
    {
      key: "workspace",
      kind: "workspace",
      label: "Workspace",
      shortLabel: input.currentWorkspace,
      priority: 100,
      group: "leading",
      dataPriority: "high",
      title: input.currentWorkspace,
    },
  ];

  if (input.selectedStudentName && input.canViewStudentContext) {
    items.push({
      key: "student-context",
      kind: "student",
      label: "Student",
      shortLabel: input.selectedStudentName,
      href: input.selectedStudentHref || undefined,
      priority: 90,
      group: "leading",
      dataPriority: "medium",
      title: `Student: ${input.selectedStudentName}`,
    });
  }

  const scenarioLabel = hasCapability(input.capabilities, "view_career_goals")
    ? compactScenarioLabel(input.activeScenario)
    : null;
  if (scenarioLabel) {
    items.push({
      key: "active-scenario",
      kind: "scenario",
      label: "Career Goal",
      shortLabel: scenarioLabel,
      href: input.activeScenarioHref || undefined,
      priority: 80,
      group: "leading",
      dataPriority: "low",
      title: `Career Goal: ${scenarioLabel}`,
    });
  }

  if ((input.attentionItems || []).length) {
    const highestPriority = [...(input.attentionItems || [])].sort((a, b) => b.priority - a.priority)[0];
    items.push({
      key: "needs-attention",
      kind: "attention",
      label: "Needs Attention",
      shortLabel: "Needs Attention",
      href: highestPriority?.href,
      priority: 70,
      badgeCount: input.attentionItems?.length || 0,
      group: "actions",
      dataPriority: "high",
      title: highestPriority ? `${highestPriority.label}${input.attentionItems!.length > 1 ? ` +${input.attentionItems!.length - 1} more` : ""}` : "Needs Attention",
    });
  }

  if (input.communicationHref && hasCapability(input.capabilities, "view_communication")) {
    items.push({
      key: "communication",
      kind: "link",
      label: "Communication",
      href: input.communicationHref,
      priority: 60,
      group: "actions",
      dataPriority: "medium",
      title: "Open Communication",
    });
  }

  items.push({
    key: "help",
    kind: "link",
    label: "Help",
    href: input.helpHref || "/help",
    priority: 50,
    group: "actions",
    dataPriority: "high",
    title: "Open Help",
  });

  items.push({
    key: "account",
    kind: "account",
    label: "Account",
    priority: 40,
    group: "actions",
    dataPriority: "high",
    title: "Open account menu",
  });

  return items
    .sort((a, b) => b.priority - a.priority)
    .slice(0, MAX_TOP_BAR_ITEMS);
}

export function getTopBarAttentionItems(input: {
  role: WorkspaceRole;
  accountStatus?: string | null;
  selectedStudentProfileId?: string | null;
  curriculumStatus?: "missing" | "present_unverified" | "verified" | "needs_attention" | null;
  degreeRequirementsStatus?: string | null;
  hasActiveScenario?: boolean;
  activeScenarioStatus?: string | null;
  pendingJoinRequestCount?: number;
  pendingCommunicationPromptTitle?: string | null;
}): TopBarAttentionItem[] {
  const studentScopedHref =
    input.role === "student"
      ? "/student?section=evidence"
      : input.role === "parent"
        ? "/parent"
        : input.role === "coach"
          ? input.selectedStudentProfileId
            ? `/coach?studentProfileId=${encodeURIComponent(input.selectedStudentProfileId)}`
            : "/coach"
          : "/admin";

  const items: TopBarAttentionItem[] = [];

  if (input.pendingJoinRequestCount && input.pendingJoinRequestCount > 0) {
    items.push({
      key: "household-requests",
      label: `${input.pendingJoinRequestCount} household request${input.pendingJoinRequestCount === 1 ? "" : "s"} waiting for review`,
      href: "/admin",
      priority: 100,
    });
  }

  if (input.curriculumStatus && input.curriculumStatus !== "verified") {
    items.push({
      key: "curriculum",
      label:
        input.curriculumStatus === "missing"
          ? "Curriculum still needs to be collected before scoring can be trusted"
          : "Curriculum is present but still needs review",
      href: studentScopedHref,
      priority: 95,
    });
  }

  if (input.degreeRequirementsStatus && ["failed", "upload_required", "needs_review", "questionable"].includes(input.degreeRequirementsStatus)) {
    items.push({
      key: "academic-evidence",
      label: "Academic evidence or degree requirements still need review",
      href: studentScopedHref,
      priority: 90,
    });
  }

  if (input.activeScenarioStatus === "needs_rerun") {
    items.push({
      key: "scenario-rerun",
      label: "The active Career Goal needs to be re-run",
      href: "/career-scenarios",
      priority: 85,
    });
  } else if (input.hasActiveScenario === false) {
    items.push({
      key: "scenario-missing",
      label: "No active Career Goal is set yet",
      href: "/career-scenarios",
      priority: 70,
    });
  }

  if (input.accountStatus && input.accountStatus !== "active") {
    items.push({
      key: "profile-setup",
      label: "Account setup is still incomplete",
      href: "/profile",
      priority: 65,
    });
  }

  if (input.pendingCommunicationPromptTitle) {
    items.push({
      key: "communication-prompt",
      label: `Communication prompt pending: ${input.pendingCommunicationPromptTitle}`,
      href: "/communication",
      priority: 55,
    });
  }

  return items.sort((a, b) => b.priority - a.priority);
}
