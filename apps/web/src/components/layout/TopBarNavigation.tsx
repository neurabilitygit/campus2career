"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useApiData } from "../../hooks/useApiData";
import type { AuthContextResponse } from "../../hooks/useAuthContext";
import type { WorkspaceRole } from "../../lib/workspaceAccess";
import { AccountMenu } from "./AccountMenu";
import { buildTopBarItems, getTopBarAttentionItems, type TopBarItem } from "./topBar";

type ActiveScenarioResponse = {
  ok: boolean;
  activeScenario?: {
    careerScenarioId: string;
    scenarioName?: string | null;
    status?: string | null;
    targetRole?: string | null;
    targetProfession?: string | null;
  } | null;
};

type AcademicEvidenceResponse = {
  ok: boolean;
  academicEvidence?: {
    degreeRequirements?: {
      status?: string;
    };
    curriculum?: {
      verification?: {
        effectiveStatus?: "missing" | "present_unverified" | "verified" | "needs_attention";
      };
    };
  };
};

type CommunicationNextPromptResponse = {
  ok: boolean;
  nextPrompt?: {
    title: string;
  } | null;
};

type HouseholdAdminOverviewResponse = {
  ok: boolean;
  overview?: {
    joinRequests?: Array<unknown>;
  };
};

type CoachWorkspaceResponse = {
  ok: boolean;
  selectedStudentProfileId: string | null;
  workspace?: {
    summary?: {
      studentDisplayName?: string | null;
    };
  } | null;
};

function formatStudentName(context: AuthContextResponse["context"]) {
  const preferred = context?.studentPreferredName?.trim();
  if (preferred) return preferred;
  const first = context?.studentFirstName?.trim();
  const last = context?.studentLastName?.trim();
  return [first, last].filter(Boolean).join(" ") || null;
}

function buildActiveScenarioPath(role: WorkspaceRole, selectedStudentProfileId?: string | null) {
  if (role === "student") return "/students/me/career-scenarios/active";
  if (role === "parent") return "/parents/me/career-scenarios/active";
  if (role === "coach" && selectedStudentProfileId) {
    return `/coaches/me/career-scenarios/active?studentProfileId=${encodeURIComponent(selectedStudentProfileId)}`;
  }
  return "";
}

function buildCareerGoalHref(role: WorkspaceRole, selectedStudentProfileId?: string | null) {
  if (role === "coach" && selectedStudentProfileId) {
    return `/career-scenarios?studentProfileId=${encodeURIComponent(selectedStudentProfileId)}`;
  }
  return "/career-scenarios";
}

function buildEvidencePath(role: WorkspaceRole, selectedStudentProfileId?: string | null) {
  if (role === "coach" && selectedStudentProfileId) {
    return `/students/me/academic-evidence?studentProfileId=${encodeURIComponent(selectedStudentProfileId)}`;
  }
  if (role === "admin" && selectedStudentProfileId) {
    return `/students/me/academic-evidence?studentProfileId=${encodeURIComponent(selectedStudentProfileId)}`;
  }
  if (role === "student" || role === "parent") {
    return "/students/me/academic-evidence";
  }
  return "";
}

function buildCoachWorkspacePath(selectedStudentProfileId?: string | null) {
  if (!selectedStudentProfileId) return "";
  return `/coaches/me/workspace?studentProfileId=${encodeURIComponent(selectedStudentProfileId)}`;
}

function topBarHelpButton(item: TopBarItem) {
  return (
    <Link
      href={item.href || "/help"}
      className="ui-button ui-button--secondary app-help-button"
      aria-label={item.label}
      title={item.title}
      data-topbar-key={item.key}
      data-intro-target="help"
    >
      <span className="app-help-button__icon" aria-hidden="true">?</span>
      <span className="app-topbar__action-label">{item.label}</span>
    </Link>
  );
}

function topBarLinkOrChip(item: TopBarItem) {
  const content = (
    <>
      <span className="app-topbar__chip-label">{item.label}</span>
      {item.shortLabel ? (
        <strong className="app-topbar__chip-value" title={item.title || item.shortLabel}>
          {item.shortLabel}
        </strong>
      ) : null}
      {typeof item.badgeCount === "number" ? (
        <span className="app-topbar__badge" aria-label={`${item.badgeCount} items`}>
          {item.badgeCount}
        </span>
      ) : null}
    </>
  );

  const className = [
    "app-topbar__chip",
    item.kind === "attention" ? "app-topbar__chip--attention" : "",
    item.href ? "app-topbar__chip--link" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (item.href) {
    return (
      <Link
        key={item.key}
        href={item.href}
        className={className}
        data-topbar-key={item.key}
        data-priority={item.dataPriority}
        title={item.title}
        aria-label={item.title || item.label}
      >
        {content}
      </Link>
    );
  }

  return (
    <div
      key={item.key}
      className={className}
      data-topbar-key={item.key}
      data-priority={item.dataPriority}
      title={item.title}
      aria-label={item.title || item.label}
      role="status"
    >
      {content}
    </div>
  );
}

export function TopBarNavigation(props: {
  currentWorkspace: string;
  authContext?: AuthContextResponse["context"];
  onOpenNavigation: () => void;
}) {
  const searchParams = useSearchParams();
  const context = props.authContext;
  const role = context?.authenticatedRoleType || null;
  const capabilities = context?.effectiveCapabilities || [];
  const selectedStudentProfileId =
    searchParams.get("studentProfileId") ||
    (role && role !== "student" ? context?.studentProfileId || null : null);

  const coachWorkspace = useApiData<CoachWorkspaceResponse>(
    buildCoachWorkspacePath(selectedStudentProfileId),
    role === "coach" && !!selectedStudentProfileId
  );
  const studentDisplayName = useMemo(() => {
    if (role === "coach") {
      return coachWorkspace.data?.workspace?.summary?.studentDisplayName || null;
    }
    return formatStudentName(context);
  }, [coachWorkspace.data?.workspace?.summary?.studentDisplayName, context, role]);

  const activeScenarioPath = buildActiveScenarioPath(role, selectedStudentProfileId);
  const activeScenario = useApiData<ActiveScenarioResponse>(
    activeScenarioPath,
    !!activeScenarioPath && capabilities.includes("view_career_goals")
  );
  const academicEvidence = useApiData<AcademicEvidenceResponse>(
    buildEvidencePath(role, selectedStudentProfileId),
    capabilities.includes("view_academic_evidence") && (role !== "coach" || !!selectedStudentProfileId)
  );
  const nextPrompt = useApiData<CommunicationNextPromptResponse>(
    role === "parent"
      ? "/communication/prompts/next?audience=parent"
      : role === "student"
        ? "/communication/prompts/next?audience=student"
        : "",
    capabilities.includes("view_communication") && (role === "parent" || role === "student")
  );
  const householdOverview = useApiData<HouseholdAdminOverviewResponse>(
    "/households/me/admin",
    capabilities.includes("view_household_admin")
  );

  const selectedStudentHref =
    role === "coach" && selectedStudentProfileId
      ? `/coach?studentProfileId=${encodeURIComponent(selectedStudentProfileId)}`
      : role === "parent"
        ? "/parent"
        : undefined;

  const attentionItems = useMemo(
    () =>
      getTopBarAttentionItems({
        role,
        accountStatus: context?.accountStatus,
        selectedStudentProfileId,
        curriculumStatus:
          academicEvidence.data?.academicEvidence?.curriculum?.verification?.effectiveStatus || null,
        degreeRequirementsStatus:
          academicEvidence.data?.academicEvidence?.degreeRequirements?.status || null,
        hasActiveScenario: activeScenario.data?.activeScenario ? true : capabilities.includes("view_career_goals") ? false : undefined,
        activeScenarioStatus: activeScenario.data?.activeScenario?.status || null,
        pendingJoinRequestCount: householdOverview.data?.overview?.joinRequests?.length || 0,
        pendingCommunicationPromptTitle: nextPrompt.data?.nextPrompt?.title || null,
      }),
    [
      academicEvidence.data?.academicEvidence?.curriculum?.verification?.effectiveStatus,
      academicEvidence.data?.academicEvidence?.degreeRequirements?.status,
      activeScenario.data?.activeScenario,
      capabilities,
      context?.accountStatus,
      householdOverview.data?.overview?.joinRequests?.length,
      nextPrompt.data?.nextPrompt?.title,
      role,
      selectedStudentProfileId,
    ]
  );

  const items = useMemo(
    () =>
      buildTopBarItems({
        role,
        currentWorkspace: props.currentWorkspace,
        capabilities,
        selectedStudentName:
          role && role !== "student" && capabilities.includes("view_student_information")
            ? studentDisplayName
            : null,
        selectedStudentHref,
        canViewStudentContext: capabilities.includes("view_student_information"),
        activeScenario: activeScenario.data?.activeScenario || null,
        activeScenarioHref: buildCareerGoalHref(role, selectedStudentProfileId),
        attentionItems,
        communicationHref: capabilities.includes("view_communication") ? "/communication" : null,
        helpHref: "/help",
      }),
    [
      activeScenario.data?.activeScenario,
      attentionItems,
      capabilities,
      props.currentWorkspace,
      role,
      studentDisplayName,
      selectedStudentHref,
      selectedStudentProfileId,
    ]
  );

  const leadingItems = items.filter((item) => item.group === "leading");
  const actionItems = items.filter((item) => item.group === "actions");

  return (
    <>
      <div className="app-topbar__leading">
        <button
          type="button"
          className="app-topbar__menu-button"
          data-intro-target="nav-open"
          aria-label="Open navigation"
          onClick={props.onOpenNavigation}
        >
          ☰
        </button>
        <div className="app-topbar__contexts" aria-label="Current context">
          {leadingItems.map((item) => topBarLinkOrChip(item))}
        </div>
      </div>
      <div className="app-topbar__actions">
        <div className="app-topbar__shortcuts" aria-label="Top bar shortcuts">
          {actionItems.map((item) => {
            if (item.kind === "account") {
              return (
                <div key={item.key} data-topbar-key={item.key} data-priority={item.dataPriority}>
                  <AccountMenu />
                </div>
              );
            }

            if (item.key === "help") {
              return (
                <div key={item.key} data-priority={item.dataPriority}>
                  {topBarHelpButton(item)}
                </div>
              );
            }

            if (item.kind === "link" && item.shortLabel == null && item.badgeCount == null) {
              return (
                <Link
                  key={item.key}
                  href={item.href || "#"}
                  className="ui-button ui-button--secondary app-topbar__shortcut"
                  data-topbar-key={item.key}
                  data-priority={item.dataPriority}
                  aria-label={item.title || item.label}
                  title={item.title}
                >
                  {item.label}
                </Link>
              );
            }

            return topBarLinkOrChip(item);
          })}
        </div>
      </div>
    </>
  );
}
