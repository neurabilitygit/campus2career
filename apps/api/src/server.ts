import type { IncomingMessage, ServerResponse } from "node:http";
import { scoringRoute } from "./routes/scoring";

function applyCors(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin || "*";
  res.setHeader("access-control-allow-origin", origin);
  res.setHeader("vary", "origin");
  res.setHeader("access-control-allow-headers", "authorization, content-type, x-demo-user-id, x-demo-role-type, x-demo-email");
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

  if (url === "/v1/scoring/demo") {
    await scoringRoute(req, res);
    return;
  }

  if (url === "/students/me/scoring" && req.method === "GET") {
    const { scoringLiveRoute } = await import("./routes/scoring");
    await scoringLiveRoute(req, res);
    return;
  }

  if (url === "/students/me/profile" && req.method === "POST") {
    const { studentProfileUpsertRoute } = await import("./routes/studentWrite");
    await studentProfileUpsertRoute(req, res);
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

  if (url === "/students/me/diagnostic/first" && req.method === "GET") {
    const { firstDiagnosticRoute } = await import("./routes/studentWrite");
    await firstDiagnosticRoute(req, res);
    return;
  }

  if (url === "/students/me/academic/catalog-assignment" && req.method === "POST") {
    const { studentCatalogAssignmentRoute } = await import("./routes/academic");
    await studentCatalogAssignmentRoute(req, res);
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

  if (url === "/students/me/academic/requirements/primary" && req.method === "GET") {
    const { primaryRequirementGraphRoute } = await import("./routes/academic");
    await primaryRequirementGraphRoute(req, res);
    return;
  }

  if (url === "/v1/academic/catalogs/ingest" && req.method === "POST") {
    const { catalogIngestionRoute } = await import("./routes/academic");
    await catalogIngestionRoute(req, res);
    return;
  }

  if (url === "/v1/market/fixtures/validate") {
    const { validateFixtures } = await import("./services/market/fixtureValidation");
    res.statusCode = 200;
    res.end(JSON.stringify(validateFixtures(), null, 2));
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
