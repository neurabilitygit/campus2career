import type { IncomingMessage } from "node:http";
import type { CapabilityKey } from "../../../../../packages/shared/src/capabilities";
import { getAuthenticatedUser } from "../../middleware/auth";
import { AppError } from "../../utils/appError";
import { resolveRequestContext } from "./resolveRequestContext";
import { hasCapability } from "./permissions";
import { isReturningSuperUserIdentity } from "./superAdminIdentity";

type RouteRule = {
  method?: string;
  path: string;
  match?: "exact" | "prefix";
  capability: CapabilityKey;
};

export const ROUTE_RULES: RouteRule[] = [
  { method: "GET", path: "/communication/profile", capability: "view_communication" },
  { method: "GET", path: "/communication/prompts/next", capability: "view_communication" },
  { method: "POST", path: "/communication/prompts/skip", capability: "view_communication" },
  { method: "POST", path: "/communication/parent-inputs", capability: "communication_profile_parent_edit" },
  { method: "PATCH", path: "/communication/parent-inputs/", match: "prefix", capability: "communication_profile_parent_edit" },
  { method: "DELETE", path: "/communication/parent-inputs/", match: "prefix", capability: "communication_profile_parent_edit" },
  { method: "POST", path: "/communication/student-inputs", capability: "communication_profile_student_edit" },
  { method: "PATCH", path: "/communication/student-inputs/", match: "prefix", capability: "communication_profile_student_edit" },
  { method: "DELETE", path: "/communication/student-inputs/", match: "prefix", capability: "communication_profile_student_edit" },
  { method: "POST", path: "/communication/translate", capability: "use_chatbot" },
  { method: "POST", path: "/communication/feedback", capability: "communication_feedback_submit" },
  { method: "GET", path: "/communication/summary", capability: "communication_summary_view" },
  { method: "POST", path: "/communication/insights/", match: "prefix", capability: "communication_summary_view" },
  { method: "POST", path: "/auth/signup/create-household", capability: "create_household" },
  { method: "POST", path: "/auth/signup/request-household-access", capability: "request_household_access" },
  { method: "POST", path: "/auth/invitations/accept", capability: "accept_household_invitation" },
  { method: "GET", path: "/students/me/account-profile", capability: "view_student_profile" },
  { method: "POST", path: "/students/me/account-profile", capability: "edit_student_profile" },
  { method: "GET", path: "/students/me/profile", capability: "view_student_profile" },
  { method: "POST", path: "/students/me/profile", capability: "edit_student_profile" },
  { method: "POST", path: "/students/me/deadlines", capability: "edit_student_profile" },
  { method: "POST", path: "/students/me/onboarding/", match: "prefix", capability: "edit_student_profile" },
  { method: "POST", path: "/students/me/uploads/presign", capability: "upload_documents" },
  { method: "POST", path: "/students/me/uploads/complete", capability: "upload_documents" },
  { method: "GET", path: "/students/me/job-targets", capability: "view_career_goals" },
  { method: "POST", path: "/students/me/job-targets", capability: "create_career_goals" },
  { method: "PATCH", path: "/students/me/job-targets/primary", capability: "edit_career_goals" },
  { method: "GET", path: "/students/me/scoring", capability: "view_scoring" },
  { method: "POST", path: "/students/me/scoring/", match: "prefix", capability: "run_scoring" },
  { method: "GET", path: "/students/me/communication-preferences", capability: "edit_student_profile" },
  { method: "POST", path: "/students/me/communication-preferences", capability: "edit_student_profile" },
  { method: "GET", path: "/students/me/communication-", match: "prefix", capability: "view_communication" },
  { method: "POST", path: "/students/me/communication-", match: "prefix", capability: "use_chatbot" },
  { method: "GET", path: "/students/me/career-scenarios", capability: "view_career_goals" },
  { method: "GET", path: "/students/me/career-scenarios/", match: "prefix", capability: "view_career_goals" },
  { method: "POST", path: "/students/me/career-scenarios/delete", capability: "delete_career_goals" },
  { method: "POST", path: "/students/me/career-scenarios/analyze", capability: "analyze_career_goals" },
  { method: "POST", path: "/students/me/career-scenarios", capability: "create_career_goals" },
  { method: "POST", path: "/students/me/career-scenarios/update", capability: "edit_career_goals" },
  { method: "POST", path: "/students/me/career-scenarios/duplicate", capability: "create_career_goals" },
  { method: "POST", path: "/students/me/career-scenarios/set-active", capability: "edit_career_goals" },
  { method: "GET", path: "/students/me/academic-evidence", capability: "view_academic_evidence" },
  { method: "POST", path: "/students/me/academic-evidence/discover-offerings", capability: "edit_academic_evidence" },
  { method: "POST", path: "/students/me/academic-evidence/manual-offering", capability: "edit_academic_evidence" },
  { method: "POST", path: "/students/me/academic-evidence/discover-degree-requirements", capability: "edit_academic_evidence" },
  { method: "POST", path: "/students/me/academic/program-requirements/discover", capability: "edit_academic_evidence" },
  { method: "POST", path: "/students/me/academic/catalog-assignment", capability: "edit_academic_evidence" },
  { method: "GET", path: "/students/me/academic/catalog-assignment", capability: "view_academic_evidence" },
  { method: "POST", path: "/students/me/academic/catalog-discovery", capability: "edit_academic_evidence" },
  { method: "GET", path: "/students/me/academic/transcript/latest", capability: "view_academic_evidence" },
  { method: "POST", path: "/students/me/academic/transcript/extract", capability: "edit_academic_evidence" },
  { method: "POST", path: "/students/me/academic/transcript/extract-from-artifact", capability: "edit_academic_evidence" },
  { method: "POST", path: "/students/me/academic/catalog/extract-from-artifact", capability: "edit_academic_evidence" },
  { method: "GET", path: "/students/me/academic/requirements/primary", capability: "view_academic_evidence" },
  { method: "GET", path: "/students/me/academic/curriculum-review", capability: "view_academic_evidence" },
  { method: "POST", path: "/students/me/academic/curriculum-review/verify", capability: "verify_curriculum" },
  { method: "POST", path: "/students/me/academic/curriculum-review/request-population", capability: "edit_academic_evidence" },
  { method: "POST", path: "/students/me/academic/curriculum-review/link-upload", capability: "edit_academic_evidence" },
  { method: "POST", path: "/students/me/academic/curriculum-review/coach-review", capability: "coach_review_curriculum" },
  { method: "GET", path: "/students/me/outcomes", capability: "view_student_information" },
  { method: "PATCH", path: "/students/me/outcomes", capability: "edit_student_profile" },
  { method: "POST", path: "/students/me/outcomes", capability: "edit_student_profile" },
  { method: "POST", path: "/students/me/outcomes/archive", capability: "edit_student_profile" },
  { method: "GET", path: "/students/me/outcomes/summary", capability: "view_student_information" },
  { method: "GET", path: "/students/me/coach-feed", capability: "view_recommendations" },
  { method: "GET", path: "/students/me/ai-documents", capability: "view_documents" },
  { method: "GET", path: "/students/me/diagnostic/first", capability: "run_scoring" },
  { method: "GET", path: "/households/me/admin", capability: "view_household_admin" },
  { method: "POST", path: "/households/me/invitations", capability: "manage_household" },
  { method: "POST", path: "/households/me/join-requests/approve", capability: "approve_household_join_request" },
  { method: "POST", path: "/households/me/join-requests/deny", capability: "approve_household_join_request" },
  { method: "POST", path: "/households/me/permissions", capability: "manage_permissions" },
  { method: "GET", path: "/admin/users", capability: "access_admin_console" },
  { method: "GET", path: "/parents/me/profile", capability: "view_parent_profile" },
  { method: "POST", path: "/parents/me/profile", capability: "edit_parent_profile" },
  { method: "GET", path: "/parents/me/communication-profile", capability: "view_parent_profile" },
  { method: "POST", path: "/parents/me/communication-profile", capability: "edit_parent_profile" },
  { method: "GET", path: "/parents/me/communication-entries", capability: "view_communication" },
  { method: "POST", path: "/parents/me/communication-entries", capability: "view_communication" },
  { method: "POST", path: "/parents/me/communication-entries/status", capability: "view_communication" },
  { method: "POST", path: "/parents/me/communication-translate", capability: "use_chatbot" },
  { method: "POST", path: "/parents/me/communication-drafts/save", capability: "view_communication" },
  { method: "POST", path: "/parents/me/communication-drafts/send-mock", capability: "view_communication" },
  { method: "GET", path: "/parents/me/communication-history", capability: "view_communication" },
  { method: "GET", path: "/parents/me/outcomes", capability: "view_student_information" },
  { method: "POST", path: "/parents/me/outcomes", capability: "edit_student_profile" },
  { method: "PATCH", path: "/parents/me/outcomes", capability: "edit_student_profile" },
  { method: "POST", path: "/parents/me/outcomes/archive", capability: "edit_student_profile" },
  { method: "GET", path: "/parents/me/outcomes/summary", capability: "view_student_information" },
  { method: "GET", path: "/parents/me/coach-feed", capability: "view_recommendations" },
  { method: "GET", path: "/parents/me/career-scenarios", capability: "view_career_goals" },
  { method: "GET", path: "/parents/me/career-scenarios/active", capability: "view_career_goals" },
  { method: "GET", path: "/parents/me/career-scenarios/item", capability: "view_career_goals" },
  { method: "GET", path: "/coaches/me/outcomes", capability: "view_student_information" },
  { method: "POST", path: "/coaches/me/outcomes", capability: "manage_coach_notes" },
  { method: "POST", path: "/coaches/me/outcomes/review", capability: "manage_coach_notes" },
  { method: "GET", path: "/coaches/me/outcomes/summary", capability: "view_student_information" },
  { method: "GET", path: "/coaches/me/roster", capability: "view_coach_dashboard" },
  { method: "GET", path: "/coaches/me/profile", capability: "view_coach_profile" },
  { method: "POST", path: "/coaches/me/profile", capability: "edit_coach_profile" },
  { method: "GET", path: "/coaches/me/workspace", capability: "view_coach_dashboard" },
  { method: "GET", path: "/coaches/me/career-scenarios", capability: "view_career_goals" },
  { method: "POST", path: "/coaches/me/career-scenarios", capability: "create_career_goals" },
  { method: "GET", path: "/coaches/me/career-scenarios/active", capability: "view_career_goals" },
  { method: "GET", path: "/coaches/me/career-scenarios/item", capability: "view_career_goals" },
  { method: "POST", path: "/coaches/me/career-scenarios/update", capability: "edit_career_goals" },
  { method: "POST", path: "/coaches/me/career-scenarios/duplicate", capability: "create_career_goals" },
  { method: "POST", path: "/coaches/me/career-scenarios/delete", capability: "delete_career_goals" },
  { method: "POST", path: "/coaches/me/career-scenarios/set-active", capability: "edit_career_goals" },
  { method: "POST", path: "/coaches/me/career-scenarios/analyze", capability: "analyze_career_goals" },
  { method: "POST", path: "/coaches/me/notes", capability: "manage_coach_notes" },
  { method: "POST", path: "/coaches/me/findings", capability: "manage_coach_notes" },
  { method: "POST", path: "/coaches/me/recommendations", capability: "edit_recommendations" },
  { method: "POST", path: "/coaches/me/action-items", capability: "edit_recommendations" },
  { method: "POST", path: "/coaches/me/flags", capability: "manage_coach_notes" },
  { method: "POST", path: "/coaches/me/outbound-messages/draft", capability: "manage_coach_notes" },
  { method: "POST", path: "/coaches/me/outbound-messages/send-mock", capability: "manage_coach_notes" },
  { method: "GET", path: "/v1/briefs/live", capability: "view_parent_brief" },
  { method: "POST", path: "/v1/briefs/generate", capability: "view_parent_brief" },
  { method: "POST", path: "/v1/chat/scenario/live", capability: "use_chatbot" },
  { method: "GET", path: "/v1/parents/me/briefs/latest", capability: "view_parent_brief" },
  { method: "POST", path: "/v1/academic/catalogs/ingest", capability: "manage_system_settings" },
  { method: "GET", path: "/v1/academic/institutions/search", capability: "view_student_profile" },
  { method: "POST", path: "/v1/academic/institutions/bulk-upsert", capability: "manage_system_settings" },
  { method: "GET", path: "/v1/academic/directory/options", capability: "view_student_profile" },
  { method: "GET", path: "/v1/market/diagnostics/role-mappings", capability: "access_admin_console" },
  { method: "GET", path: "/coach", match: "prefix", capability: "view_coach_dashboard" },
  { method: "POST", path: "/coach", match: "prefix", capability: "manage_coach_notes" },
  { method: "GET", path: "/parent", match: "prefix", capability: "view_parent_dashboard" },
  { method: "POST", path: "/parent", match: "prefix", capability: "view_parent_dashboard" },
];

const RETURNING_SUPERUSER_CAPABILITIES: CapabilityKey[] = [
  "access_admin_console",
  "manage_household",
  "manage_permissions",
  "view_household_admin",
];

function matches(rule: RouteRule, method: string, pathname: string) {
  if (rule.method && rule.method !== method) {
    return false;
  }
  if ((rule.match || "exact") === "prefix") {
    return pathname.startsWith(rule.path);
  }
  return pathname === rule.path;
}

export function isPublicPath(pathname: string) {
  return (
    pathname === "/health" ||
    pathname === "/auth/invitations/preview"
  );
}

export function findRouteRule(method: string, pathname: string) {
  return ROUTE_RULES.find((candidate) => matches(candidate, method.toUpperCase(), pathname));
}

export async function authorizeApiRequest(req: IncomingMessage, pathname: string) {
  if (isPublicPath(pathname)) {
    return;
  }

  const method = (req.method || "GET").toUpperCase();
  const rule = findRouteRule(method, pathname);
  if (!rule) {
    return;
  }

  let ctx;
  try {
    ctx = await resolveRequestContext(req);
  } catch (error) {
    const auth = await getAuthenticatedUser(req);
    const canFallback =
      error instanceof AppError
        ? error.code === "auth_user_sync_failed" || error.code === "auth_role_resolution_failed"
        : isReturningSuperUserIdentity(auth);

    if (
      canFallback &&
      isReturningSuperUserIdentity(auth) &&
      RETURNING_SUPERUSER_CAPABILITIES.includes(rule.capability)
    ) {
      return;
    }

    throw error;
  }
  const allowed = hasCapability(
    { isSuperAdmin: !!ctx.isSuperAdmin, grantedCapabilities: ctx.effectiveCapabilities || [] },
    rule.capability
  );

  if (!allowed) {
    throw new AppError({
      status: 403,
      code: "forbidden_capability",
      message: "The current account does not have permission to use this API route.",
      details: {
        capability: rule.capability,
        pathname,
        method,
      },
    });
  }
}
