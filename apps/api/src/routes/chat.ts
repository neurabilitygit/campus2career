import type { IncomingMessage, ServerResponse } from "node:http";
import { demoDataAnalystScoringInput } from "../fixtures/demoStudentScoringInput";
import { runScoring } from "../services/scoring";
import { runScenarioChat } from "../services/chat/scenarioChat";

export async function scenarioChatDemoRoute(_req: IncomingMessage, res: ServerResponse) {
  const scoring = runScoring(demoDataAnalystScoringInput);

  const response = await runScenarioChat({
    studentName: "Demo Student",
    targetRoleFamily: demoDataAnalystScoringInput.targetRoleFamily,
    targetSectorCluster: demoDataAnalystScoringInput.targetSectorCluster,
    scenarioQuestion: "What if I stay in economics but add one SQL project this semester instead of trying to switch majors?",
    communicationStyle: "direct",
    parentVisibleInsights: [
      "Student responds better to concise guidance",
      "Student needs visible proof-of-work"
    ],
    truthNotes: demoDataAnalystScoringInput.dataQualityNotes,
    scoring
  });

  res.statusCode = 200;
  res.setHeader("content-type", "application/json");
  res.end(
    JSON.stringify(
      {
        ok: true,
        mode: "demo",
        warning: "This endpoint returns demo-only scenario guidance and does not read any real student record.",
        response: response.response,
        deliveryMode: response.deliveryMode,
        degradedReason: response.degradedReason || null,
      },
      null,
      2
    )
  );
}
