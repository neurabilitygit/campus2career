import test from "node:test";
import assert from "node:assert/strict";
import { refreshMarketReferenceData, refreshRoleMarketReference, type RefreshMarketDependencies } from "./refresh";

function buildDependencies(): RefreshMarketDependencies & {
  persistedOccupations: any[];
  replacedSkills: Array<{ canonicalName: string; skills: any[] }>;
  replacedRoleSignals: Array<{ canonicalName: string; signals: any[] }>;
  replacedMacroSignals: Array<{ signalType: string; signals: any[] }>;
} {
  const persistedOccupations: any[] = [];
  const replacedSkills: Array<{ canonicalName: string; skills: any[] }> = [];
  const replacedRoleSignals: Array<{ canonicalName: string; signals: any[] }> = [];
  const replacedMacroSignals: Array<{ signalType: string; signals: any[] }> = [];

  return {
    persistedOccupations,
    replacedSkills,
    replacedRoleSignals,
    replacedMacroSignals,
    async searchOccupationsByKeyword() {
      return {
        occupation: [{ code: "15-1252.00", title: "Software Developers" }],
      };
    },
    async getOccupationOverview() {
      return {
        code: "15-1252.00",
        title: "Software Developers",
        what_they_do: "Write and maintain software.",
      };
    },
    async getOccupationSkillsSummary() {
      return {
        element: [{ name: "Programming" }, { name: "Critical Thinking" }],
      };
    },
    async getOccupationTechnologySkillsSummary() {
      return {
        category: [],
      };
    },
    async getOccupationJobZone() {
      return { code: 4 };
    },
    async getCareerJobOutlook() {
      return {
        outlook: { category: "Bright" },
        bright_outlook: [{ title: "Openings" }],
        salary: { annual_median: 120000 },
      };
    },
    async fetchLatestBlsSeries() {
      return {
        Results: {
          series: [
            {
              data: [{ year: "2026", value: "4.2" }],
            },
          ],
        },
      };
    },
    async persistNormalizedOccupation(occupation) {
      persistedOccupations.push(occupation);
    },
    async replaceNormalizedSkillsForOccupation(canonicalName, skills) {
      replacedSkills.push({ canonicalName, skills });
    },
    async replaceNormalizedMarketSignalsForOccupation(canonicalName, signals) {
      replacedRoleSignals.push({ canonicalName, signals });
    },
    async replaceNormalizedMacroMarketSignals(signalType, signals) {
      replacedMacroSignals.push({ signalType, signals });
    },
  };
}

test("refreshRoleMarketReference persists live O*NET occupation, skills, and role signals", async () => {
  const deps = buildDependencies();

  const result = await refreshRoleMarketReference(
    {
      canonicalName: "software developer",
      sectorCluster: "technology_startups",
      onetSearchTerms: ["software developer"],
      typicalEntryTitles: ["Software Engineer I"],
      overrideOnetSocCode: "15-1252.00",
      preferredOnetSocCodes: ["15-1252.00"],
    },
    { apiKey: "test-key" },
    deps
  );

  assert.equal(result.refreshed, true);
  assert.equal(deps.persistedOccupations.length, 1);
  assert.equal(deps.replacedSkills[0]?.skills.length, 2);
  assert.deepEqual(
    deps.replacedRoleSignals[0]?.signals.map((signal) => signal.signalType),
    ["demand_growth", "openings_trend", "wage"]
  );
});

test("refreshMarketReferenceData also refreshes macro unemployment from BLS", async () => {
  const deps = buildDependencies();

  const summary = await refreshMarketReferenceData(
    { roleCanonicalNames: ["software developer"], onetAuthConfig: { apiKey: "test-key" } },
    deps
  );

  assert.equal(summary.roles.length, 1);
  assert.equal(summary.macroSignals, 1);
  assert.equal(deps.replacedMacroSignals.length, 1);
  assert.equal(deps.replacedMacroSignals[0]?.signalType, "unemployment_pressure");
  assert.equal(deps.replacedMacroSignals[0]?.signals[0]?.signalValue, 4.2);
});

test("refreshRoleMarketReference falls back to technology skills when O*NET summary skills are empty", async () => {
  const deps = buildDependencies();
  deps.getOccupationSkillsSummary = async () => ({ element: [] });
  deps.getOccupationTechnologySkillsSummary = async () => ({
    category: [
      {
        example: [{ title: "PyTorch" }, { title: "Amazon Web Services AWS software" }],
      },
    ],
  });

  const result = await refreshRoleMarketReference(
    {
      canonicalName: "data scientist",
      sectorCluster: "data_analytics",
      onetSearchTerms: ["data scientist"],
      typicalEntryTitles: ["Data Scientist"],
      overrideOnetSocCode: "15-2051.00",
      preferredOnetSocCodes: ["15-2051.00"],
    },
    { apiKey: "test-key" },
    deps
  );

  assert.equal(result.refreshed, true);
  assert.deepEqual(
    deps.replacedSkills.at(-1)?.skills.map((skill) => skill.skillName),
    ["PyTorch", "Amazon Web Services AWS software"]
  );
});
