import type { IncomingMessage, ServerResponse } from "node:http";
import { demoFinanceAnalystScoringInput } from "../fixtures/demoStudentScoringInput";
import { runScoring } from "../services/scoring";
import { generateParentBrief } from "../services/briefs/generator";

export async function parentBriefDemoRoute(_req: IncomingMessage, res: ServerResponse) {
  const scoring = runScoring(demoFinanceAnalystScoringInput);

  const brief = await generateParentBrief({
    studentName: "Demo Student",
    monthLabel: "2026-04",
    targetGoal: "Finance and financial services, focused on financial analyst roles",
    accomplishments: [
      "Completed economics and statistics coursework with strong performance",
      "Defined target role family and preferred geographies"
    ],
    scoring,
    upcomingDeadlines: [
      "Summer internship application cycle closes in 14 days",
      "Resume revision deadline is this Friday"
    ],
    parentVisibleInsights: [
      "Student engages better with a short list of concrete next steps",
      "Student currently lacks a first-degree professional network"
    ],
    truthNotes: demoFinanceAnalystScoringInput.dataQualityNotes,
  });

  res.statusCode = 200;
  res.setHeader("content-type", "application/json");
  res.end(
    JSON.stringify(
      {
        ok: true,
        mode: "demo",
        warning: "This endpoint returns demo-only content and does not read any real student record.",
        brief: brief.brief,
        deliveryMode: brief.deliveryMode,
        degradedReason: brief.degradedReason || null,
      },
      null,
      2
    )
  );
}
