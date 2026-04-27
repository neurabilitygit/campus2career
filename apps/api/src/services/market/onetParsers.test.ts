import test from "node:test";
import assert from "node:assert/strict";
import {
  applyOnetJobZoneToOccupation,
  normalizeOnetCareerOutlookToMarketSignals,
  normalizeOnetDetailsToSkillRequirements,
  normalizeOnetTechnologySkillsToSkillRequirements,
  normalizeOnetOverviewToOccupation,
  normalizeOnetSearchResultToOccupation,
} from "./onetParsers";

test("normalizeOnetSearchResultToOccupation prefers configured O*NET codes", () => {
  const normalized = normalizeOnetSearchResultToOccupation(
    {
      occupation: [
        { code: "15-0000.00", title: "General Technology Workers" },
        { code: "15-2051.00", title: "Data Scientists" },
        { code: "15-1252.00", title: "Software Developers" },
      ],
    },
    "software developer",
    { preferredOnetSocCodes: ["15-1252.00", "15-2051.00"] }
  );

  assert.equal(normalized?.onetCode, "15-1252.00");
  assert.equal(normalized?.title, "Software Developers");
});

test("normalizeOnetDetailsToSkillRequirements assigns descending importance for summary skills", () => {
  const skills = normalizeOnetDetailsToSkillRequirements(
    {
      element: [
        { name: "Critical Thinking" },
        { name: "Active Listening" },
        { name: "Complex Problem Solving" },
      ],
    },
    "financial analyst"
  );

  assert.equal(skills.length, 3);
  assert.equal(skills[0]?.skillName, "Critical Thinking");
  assert.equal(skills[0]?.importanceScore, 92);
  assert.equal(skills[1]?.importanceScore, 88);
  assert.equal(skills[2]?.importanceScore, 84);
});

test("normalizeOnetCareerOutlookToMarketSignals maps outlook and salary into scoring signals", () => {
  const signals = normalizeOnetCareerOutlookToMarketSignals({
    raw: {
      outlook: { category: "Bright" },
      bright_outlook: [{ title: "Openings" }],
      salary: { annual_median: 120000 },
    },
    occupationCanonicalName: "software developer",
    effectiveDate: "2026-01-01",
  });

  assert.deepEqual(
    signals.map((signal) => signal.signalType),
    ["demand_growth", "openings_trend", "wage"]
  );
  assert.equal(signals[0]?.signalDirection, "rising");
  assert.equal(signals[1]?.signalValue, 8.8);
  assert.ok((signals[2]?.signalValue || 0) > 0);
});

test("normalizeOnetTechnologySkillsToSkillRequirements extracts technical examples when generic skills are absent", () => {
  const skills = normalizeOnetTechnologySkillsToSkillRequirements(
    {
      category: [
        {
          example: [{ title: "PyTorch" }, { title: "Amazon Redshift" }],
        },
      ],
    },
    "data scientist"
  );

  assert.deepEqual(
    skills.map((skill) => skill.skillName),
    ["PyTorch", "Amazon Redshift"]
  );
  assert.ok(skills.every((skill) => skill.skillCategory === "technical"));
});

test("normalizeOnetOverviewToOccupation and applyOnetJobZoneToOccupation build persisted occupation metadata", () => {
  const occupation = applyOnetJobZoneToOccupation(
    normalizeOnetOverviewToOccupation(
      {
        code: "15-1252.00",
        title: "Software Developers",
        what_they_do: "Develop software applications.",
      },
      "software developer"
    ),
    { code: 4 }
  );

  assert.equal(occupation.onetCode, "15-1252.00");
  assert.equal(occupation.description, "Develop software applications.");
  assert.equal(occupation.jobZone, 4);
});
