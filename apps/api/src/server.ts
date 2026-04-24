import type { IncomingMessage, ServerResponse } from "node:http";
import { scoringRoute } from "./routes/scoring";

function applyCors(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin || "*";
  res.setHeader("access-control-allow-origin", origin);
  res.setHeader("vary", "origin");
  res.setHeader(
    "access-control-allow-headers",
    "authorization, content-type, x-demo-user-id, x-demo-role-type, x-demo-email, x-test-context-role"
  );
  res.setHeader("access-control-allow-methods", "GET, POST, PATCH, OPTIONS");
  res.setHeader("access-control-allow-credentials", "true");
}

export async function router(req: IncomingMessage, res: ServerResponse) {
  applyCors(req, res);
  res.setHeader("content-type", "application/json");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const requestUrl = new URL(req.url || "/", "http://localhost");
  const url = requestUrl.pathname;

  if (url === "/health") {
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, service: "api" }));
    return;
  }

  if (url === "/auth/me") {
    const { authMeRoute } = await import("./routes/auth");
    await authMeRoute(req, res);
    return;
  }

  if (url === "/auth/intro-onboarding/complete" && req.method === "POST") {
    const { introOnboardingCompleteRoute } = await import("./routes/auth");
    await introOnboardingCompleteRoute(req, res);
    return;
  }

  if (url === "/auth/intro-onboarding/skip" && req.method === "POST") {
    const { introOnboardingSkipRoute } = await import("./routes/auth");
    await introOnboardingSkipRoute(req, res);
    return;
  }

  if (url === "/auth/intro-onboarding/replay" && req.method === "POST") {
    const { introOnboardingReplayRoute } = await import("./routes/auth");
    await introOnboardingReplayRoute(req, res);
    return;
  }

  if (url === "/v1/scoring/demo") {
    await scoringRoute(req, res);
    return;
  }

  if (url === "/students/me/scoring" && req.method === "GET") {
    const { scoringLiveRoute } = await import("./routes/scoring");
    await scoringLiveRoute(req, res);
    return;
  }

  if (url === "/students/me/scoring/preview" && req.method === "POST") {
    const { scoringPreviewRoute } = await import("./routes/scoring");
    await scoringPreviewRoute(req, res);
    return;
  }

  if (url === "/students/me/scoring/explain" && req.method === "POST") {
    const { scoringExplainRoute } = await import("./routes/scoring");
    await scoringExplainRoute(req, res);
    return;
  }

  if (url === "/students/me/profile" && req.method === "POST") {
    const { studentProfileUpsertRoute } = await import("./routes/studentWrite");
    await studentProfileUpsertRoute(req, res);
    return;
  }

  if (url === "/students/me/profile" && req.method === "GET") {
    const { studentProfileReadRoute } = await import("./routes/studentWrite");
    await studentProfileReadRoute(req, res);
    return;
  }

  if (url === "/students/me/account-profile" && req.method === "GET") {
    const { studentEditableProfileReadRoute } = await import("./routes/profiles");
    await studentEditableProfileReadRoute(req, res);
    return;
  }

  if (url === "/students/me/account-profile" && req.method === "POST") {
    const { studentEditableProfileUpsertRoute } = await import("./routes/profiles");
    await studentEditableProfileUpsertRoute(req, res);
    return;
  }

  if (url === "/students/me/deadlines" && req.method === "POST") {
    const { deadlineCreateRoute } = await import("./routes/studentWrite");
    await deadlineCreateRoute(req, res);
    return;
  }

  if (url === "/students/me/uploads/presign" && req.method === "POST") {
    const { uploadPresignRoute } = await import("./routes/studentWrite");
    await uploadPresignRoute(req, res);
    return;
  }

  if (url === "/students/me/onboarding/cluster-selection" && req.method === "POST") {
    const { sectorSelectionRoute } = await import("./routes/studentWrite");
    await sectorSelectionRoute(req, res);
    return;
  }

  if (url === "/students/me/onboarding/network-baseline" && req.method === "POST") {
    const { networkBaselineRoute } = await import("./routes/studentWrite");
    await networkBaselineRoute(req, res);
    return;
  }

  if (url === "/students/me/uploads/complete" && req.method === "POST") {
    const { uploadCompleteRoute } = await import("./routes/studentWrite");
    await uploadCompleteRoute(req, res);
    return;
  }

  if (url === "/students/me/job-targets" && req.method === "GET") {
    const { studentJobTargetsListRoute } = await import("./routes/jobTargets");
    await studentJobTargetsListRoute(req, res);
    return;
  }

  if (url === "/students/me/job-targets" && req.method === "POST") {
    const { studentJobTargetCreateRoute } = await import("./routes/jobTargets");
    await studentJobTargetCreateRoute(req, res);
    return;
  }

  if (url === "/students/me/job-targets/primary" && req.method === "PATCH") {
    const { studentJobTargetSetPrimaryRoute } = await import("./routes/jobTargets");
    await studentJobTargetSetPrimaryRoute(req, res);
    return;
  }

  if (url === "/students/me/outcomes" && req.method === "GET") {
    const { studentOutcomesListRoute } = await import("./routes/outcomes");
    await studentOutcomesListRoute(req, res);
    return;
  }

  if (url === "/students/me/outcomes" && req.method === "POST") {
    const { studentOutcomesCreateRoute } = await import("./routes/outcomes");
    await studentOutcomesCreateRoute(req, res);
    return;
  }

  if (url === "/students/me/outcomes" && req.method === "PATCH") {
    const { studentOutcomesUpdateRoute } = await import("./routes/outcomes");
    await studentOutcomesUpdateRoute(req, res);
    return;
  }

  if (url === "/students/me/outcomes/archive" && req.method === "POST") {
    const { studentOutcomesArchiveRoute } = await import("./routes/outcomes");
    await studentOutcomesArchiveRoute(req, res);
    return;
  }

  if (url === "/students/me/outcomes/summary" && req.method === "GET") {
    const { studentOutcomesSummaryRoute } = await import("./routes/outcomes");
    await studentOutcomesSummaryRoute(req, res);
    return;
  }

  if (url === "/students/me/communication-preferences" && req.method === "GET") {
    const { studentCommunicationPreferencesReadRoute } = await import("./routes/communication");
    await studentCommunicationPreferencesReadRoute(req, res);
    return;
  }

  if (url === "/students/me/communication-preferences" && req.method === "POST") {
    const { studentCommunicationPreferencesUpsertRoute } = await import("./routes/communication");
    await studentCommunicationPreferencesUpsertRoute(req, res);
    return;
  }

  if (url === "/students/me/communication-messages" && req.method === "GET") {
    const { studentCommunicationMessagesRoute } = await import("./routes/communication");
    await studentCommunicationMessagesRoute(req, res);
    return;
  }

  if (url === "/students/me/coach-feed" && req.method === "GET") {
    const { studentCoachFeedRoute } = await import("./routes/coach");
    await studentCoachFeedRoute(req, res);
    return;
  }

  if (url === "/students/me/diagnostic/first" && req.method === "GET") {
    const { firstDiagnosticRoute } = await import("./routes/studentWrite");
    await firstDiagnosticRoute(req, res);
    return;
  }

  if (url === "/students/me/ai-documents" && req.method === "GET") {
    const { studentAiDocumentsRoute } = await import("./routes/aiDocuments");
    await studentAiDocumentsRoute(req, res);
    return;
  }

  if (url === "/students/me/academic/catalog-assignment" && req.method === "POST") {
    const { studentCatalogAssignmentRoute } = await import("./routes/academic");
    await studentCatalogAssignmentRoute(req, res);
    return;
  }

  if (url === "/students/me/academic/catalog-assignment" && req.method === "GET") {
    const { studentCatalogAssignmentReadRoute } = await import("./routes/institutionDirectory");
    await studentCatalogAssignmentReadRoute(req, res);
    return;
  }

  if (url === "/students/me/academic/catalog-discovery" && req.method === "POST") {
    const { catalogDiscoveryRoute } = await import("./routes/academic");
    await catalogDiscoveryRoute(req, res);
    return;
  }

  if (url === "/students/me/academic/program-requirements/discover" && req.method === "POST") {
    const { programRequirementDiscoveryRoute } = await import("./routes/academic");
    await programRequirementDiscoveryRoute(req, res);
    return;
  }

  if (url === "/students/me/academic/transcript/latest" && req.method === "GET") {
    const { latestTranscriptGraphRoute } = await import("./routes/academic");
    await latestTranscriptGraphRoute(req, res);
    return;
  }

  if (url === "/students/me/academic/transcript/extract" && req.method === "POST") {
    const { transcriptExtractRoute } = await import("./routes/academic");
    await transcriptExtractRoute(req, res);
    return;
  }

  if (url === "/students/me/academic/transcript/extract-from-artifact" && req.method === "POST") {
    const { transcriptExtractFromArtifactRoute } = await import("./routes/academic");
    await transcriptExtractFromArtifactRoute(req, res);
    return;
  }

  if (url === "/students/me/academic/catalog/extract-from-artifact" && req.method === "POST") {
    const { catalogExtractFromArtifactRoute } = await import("./routes/academic");
    await catalogExtractFromArtifactRoute(req, res);
    return;
  }

  if (url === "/students/me/academic/requirements/primary" && req.method === "GET") {
    const { primaryRequirementGraphRoute } = await import("./routes/academic");
    await primaryRequirementGraphRoute(req, res);
    return;
  }

  if (url === "/students/me/academic/curriculum-review" && req.method === "GET") {
    const { curriculumReviewRoute } = await import("./routes/academic");
    await curriculumReviewRoute(req, res);
    return;
  }

  if (url === "/students/me/academic/curriculum-review/verify" && req.method === "POST") {
    const { curriculumVerifyRoute } = await import("./routes/academic");
    await curriculumVerifyRoute(req, res);
    return;
  }

  if (url === "/students/me/academic/curriculum-review/request-population" && req.method === "POST") {
    const { curriculumRequestPopulationRoute } = await import("./routes/academic");
    await curriculumRequestPopulationRoute(req, res);
    return;
  }

  if (url === "/students/me/academic/curriculum-review/link-upload" && req.method === "POST") {
    const { curriculumLinkUploadRoute } = await import("./routes/academic");
    await curriculumLinkUploadRoute(req, res);
    return;
  }

  if (url === "/students/me/academic/curriculum-review/coach-review" && req.method === "POST") {
    const { curriculumCoachReviewRoute } = await import("./routes/academic");
    await curriculumCoachReviewRoute(req, res);
    return;
  }

  if (url === "/v1/academic/catalogs/ingest" && req.method === "POST") {
    const { catalogIngestionRoute } = await import("./routes/academic");
    await catalogIngestionRoute(req, res);
    return;
  }

  if (url === "/v1/academic/institutions/search" && req.method === "GET") {
    const { institutionDirectorySearchRoute } = await import("./routes/institutionDirectory");
    await institutionDirectorySearchRoute(req, res);
    return;
  }

  if (url === "/v1/academic/institutions/bulk-upsert" && req.method === "POST") {
    const { institutionDirectoryBulkUpsertRoute } = await import("./routes/institutionDirectory");
    await institutionDirectoryBulkUpsertRoute(req, res);
    return;
  }

  if (url === "/v1/academic/directory/options" && req.method === "GET") {
    const { institutionDirectoryOptionsRoute } = await import("./routes/institutionDirectory");
    await institutionDirectoryOptionsRoute(req, res);
    return;
  }

  if (url === "/v1/market/fixtures/validate") {
    const { validateFixtures } = await import("./services/market/fixtureValidation");
    res.statusCode = 200;
    res.end(JSON.stringify(validateFixtures(), null, 2));
    return;
  }

  if (url === "/v1/market/diagnostics/role-mappings" && req.method === "GET") {
    const { roleMappingsDiagnosticsRoute } = await import("./routes/market");
    await roleMappingsDiagnosticsRoute(req, res);
    return;
  }

  if (url === "/parents/me/communication-profile" && req.method === "GET") {
    const { parentCommunicationProfileReadRoute } = await import("./routes/communication");
    await parentCommunicationProfileReadRoute(req, res);
    return;
  }

  if (url === "/parents/me/profile" && req.method === "GET") {
    const { parentEditableProfileReadRoute } = await import("./routes/profiles");
    await parentEditableProfileReadRoute(req, res);
    return;
  }

  if (url === "/parents/me/profile" && req.method === "POST") {
    const { parentEditableProfileUpsertRoute } = await import("./routes/profiles");
    await parentEditableProfileUpsertRoute(req, res);
    return;
  }

  if (url === "/parents/me/communication-profile" && req.method === "POST") {
    const { parentCommunicationProfileUpsertRoute } = await import("./routes/communication");
    await parentCommunicationProfileUpsertRoute(req, res);
    return;
  }

  if (url === "/parents/me/communication-entries" && req.method === "GET") {
    const { parentCommunicationEntriesListRoute } = await import("./routes/communication");
    await parentCommunicationEntriesListRoute(req, res);
    return;
  }

  if (url === "/parents/me/communication-entries" && req.method === "POST") {
    const { parentCommunicationEntryCreateRoute } = await import("./routes/communication");
    await parentCommunicationEntryCreateRoute(req, res);
    return;
  }

  if (url === "/parents/me/communication-entries/status" && req.method === "POST") {
    const { parentCommunicationEntryStatusRoute } = await import("./routes/communication");
    await parentCommunicationEntryStatusRoute(req, res);
    return;
  }

  if (url === "/parents/me/communication-translate" && req.method === "POST") {
    const { parentCommunicationTranslateRoute } = await import("./routes/communication");
    await parentCommunicationTranslateRoute(req, res);
    return;
  }

  if (url === "/parents/me/communication-drafts/save" && req.method === "POST") {
    const { parentCommunicationDraftSaveRoute } = await import("./routes/communication");
    await parentCommunicationDraftSaveRoute(req, res);
    return;
  }

  if (url === "/parents/me/communication-drafts/send-mock" && req.method === "POST") {
    const { parentCommunicationDraftSendMockRoute } = await import("./routes/communication");
    await parentCommunicationDraftSendMockRoute(req, res);
    return;
  }

  if (url === "/parents/me/communication-history" && req.method === "GET") {
    const { parentCommunicationHistoryRoute } = await import("./routes/communication");
    await parentCommunicationHistoryRoute(req, res);
    return;
  }

  if (url === "/parents/me/outcomes" && req.method === "GET") {
    const { parentOutcomesListRoute } = await import("./routes/outcomes");
    await parentOutcomesListRoute(req, res);
    return;
  }

  if (url === "/parents/me/outcomes" && req.method === "POST") {
    const { parentOutcomesCreateRoute } = await import("./routes/outcomes");
    await parentOutcomesCreateRoute(req, res);
    return;
  }

  if (url === "/parents/me/outcomes" && req.method === "PATCH") {
    const { parentOutcomesUpdateRoute } = await import("./routes/outcomes");
    await parentOutcomesUpdateRoute(req, res);
    return;
  }

  if (url === "/parents/me/outcomes/archive" && req.method === "POST") {
    const { parentOutcomesArchiveRoute } = await import("./routes/outcomes");
    await parentOutcomesArchiveRoute(req, res);
    return;
  }

  if (url === "/parents/me/outcomes/summary" && req.method === "GET") {
    const { parentOutcomesSummaryRoute } = await import("./routes/outcomes");
    await parentOutcomesSummaryRoute(req, res);
    return;
  }

  if (url === "/parents/me/coach-feed" && req.method === "GET") {
    const { parentCoachFeedRoute } = await import("./routes/coach");
    await parentCoachFeedRoute(req, res);
    return;
  }

  if (url === "/coaches/me/outcomes" && req.method === "GET") {
    const { coachOutcomesListRoute } = await import("./routes/outcomes");
    await coachOutcomesListRoute(req, res);
    return;
  }

  if (url === "/coaches/me/outcomes" && req.method === "POST") {
    const { coachOutcomesCreateRoute } = await import("./routes/outcomes");
    await coachOutcomesCreateRoute(req, res);
    return;
  }

  if (url === "/coaches/me/outcomes/review" && req.method === "POST") {
    const { coachOutcomesReviewRoute } = await import("./routes/outcomes");
    await coachOutcomesReviewRoute(req, res);
    return;
  }

  if (url === "/coaches/me/outcomes/summary" && req.method === "GET") {
    const { coachOutcomesSummaryRoute } = await import("./routes/outcomes");
    await coachOutcomesSummaryRoute(req, res);
    return;
  }

  if (url === "/coaches/me/roster" && req.method === "GET") {
    const { coachRosterRoute } = await import("./routes/coach");
    await coachRosterRoute(req, res);
    return;
  }

  if (url === "/coaches/me/profile" && req.method === "GET") {
    const { coachEditableProfileReadRoute } = await import("./routes/profiles");
    await coachEditableProfileReadRoute(req, res);
    return;
  }

  if (url === "/coaches/me/profile" && req.method === "POST") {
    const { coachEditableProfileUpsertRoute } = await import("./routes/profiles");
    await coachEditableProfileUpsertRoute(req, res);
    return;
  }

  if (url === "/coaches/me/workspace" && req.method === "GET") {
    const { coachWorkspaceRoute } = await import("./routes/coach");
    await coachWorkspaceRoute(req, res);
    return;
  }

  if (url === "/coaches/me/notes" && req.method === "POST") {
    const { coachNoteCreateRoute } = await import("./routes/coach");
    await coachNoteCreateRoute(req, res);
    return;
  }

  if (url === "/coaches/me/findings" && req.method === "POST") {
    const { coachFindingCreateRoute } = await import("./routes/coach");
    await coachFindingCreateRoute(req, res);
    return;
  }

  if (url === "/coaches/me/recommendations" && req.method === "POST") {
    const { coachRecommendationCreateRoute } = await import("./routes/coach");
    await coachRecommendationCreateRoute(req, res);
    return;
  }

  if (url === "/coaches/me/action-items" && req.method === "POST") {
    const { coachActionItemCreateRoute } = await import("./routes/coach");
    await coachActionItemCreateRoute(req, res);
    return;
  }

  if (url === "/coaches/me/flags" && req.method === "POST") {
    const { coachFlagCreateRoute } = await import("./routes/coach");
    await coachFlagCreateRoute(req, res);
    return;
  }

  if (url === "/coaches/me/outbound-messages/draft" && req.method === "POST") {
    const { coachOutboundDraftSaveRoute } = await import("./routes/coach");
    await coachOutboundDraftSaveRoute(req, res);
    return;
  }

  if (url === "/coaches/me/outbound-messages/send-mock" && req.method === "POST") {
    const { coachOutboundSendMockRoute } = await import("./routes/coach");
    await coachOutboundSendMockRoute(req, res);
    return;
  }

  if (url === "/v1/briefs/demo") {
    const { parentBriefDemoRoute } = await import("./routes/briefs");
    await parentBriefDemoRoute(req, res);
    return;
  }

  if (url === "/v1/briefs/live") {
    if (req.method === "GET") {
      const { parentBriefGetLiveRoute } = await import("./routes/briefsLive");
      await parentBriefGetLiveRoute(req, res);
      return;
    }
    res.statusCode = 405;
    res.setHeader("allow", "GET");
    res.end(
      JSON.stringify({
        error: "method_not_allowed",
        message: "GET returns the persisted brief for the current reporting month; use POST /v1/briefs/generate to create or refresh it",
      })
    );
    return;
  }

  if (url === "/v1/briefs/generate") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("allow", "POST");
      res.end(
        JSON.stringify({
          error: "method_not_allowed",
          message: "POST runs scoring and persists the brief for the current reporting month",
        })
      );
      return;
    }
    const { parentBriefGenerateRoute } = await import("./routes/briefsLive");
    await parentBriefGenerateRoute(req, res);
    return;
  }

  if (url === "/v1/chat/scenario/demo") {
    const { scenarioChatDemoRoute } = await import("./routes/chat");
    await scenarioChatDemoRoute(req, res);
    return;
  }

  if (url === "/v1/chat/scenario/live") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("allow", "POST");
      res.end(JSON.stringify({ error: "method_not_allowed", message: "Use POST with JSON body: { scenarioQuestion, communicationStyle? }" }));
      return;
    }
    const { scenarioChatLiveRoute } = await import("./routes/chatLive");
    await scenarioChatLiveRoute(req, res);
    return;
  }

  if (url === "/v1/parents/me/briefs/latest" && req.method === "GET") {
    const { parentLatestBriefRoute } = await import("./routes/parentBriefsRead");
    await parentLatestBriefRoute(req, res);
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: "not_found" }));
}
