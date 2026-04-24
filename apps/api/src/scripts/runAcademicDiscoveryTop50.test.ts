import test from "node:test";
import assert from "node:assert/strict";
import { parseArgs, selectRequirementTargets } from "./runAcademicDiscoveryTop50";

test("parseArgs keeps best-program requirements as the default scope", () => {
  const args = parseArgs(["--school", "Harvard University", "--include-requirements"]);

  assert.equal(args.includeRequirements, true);
  assert.equal(args.requirementsScope, "best");
  assert.equal(args.requirementsLimit, 0);
});

test("selectRequirementTargets returns the single best-program target by default", () => {
  const targets = selectRequirementTargets({
    scope: "best",
    limit: 0,
    targets: [
      {
        degreeType: "BA",
        programName: "Programs",
        majorCanonicalName: "economics",
        majorDisplayName: "Economics",
        sourceUrl: "https://example.edu/econ",
        confidenceLabel: "high",
        truthStatus: "direct",
      },
    ],
    bestProgram: {
      degreeType: "BS",
      programName: "Programs",
      majorCount: 20,
      minorCount: 4,
      majorCanonicalName: "computer-science",
      majorDisplayName: "Computer Science",
    },
  });

  assert.deepEqual(targets.map((target) => target.majorCanonicalName), ["computer-science"]);
});

test("selectRequirementTargets safe-subset filters out higher-risk program labels and caps the batch", () => {
  const targets = selectRequirementTargets({
    scope: "safe-subset",
    limit: 2,
    targets: [
      {
        degreeType: "BA",
        programName: "Programs",
        majorCanonicalName: "economics",
        majorDisplayName: "Economics",
        sourceUrl: "https://example.edu/econ",
        confidenceLabel: "high",
        truthStatus: "direct",
      },
      {
        degreeType: "BA",
        programName: "Programs",
        majorCanonicalName: "online-business",
        majorDisplayName: "Business Administration (Online)",
        sourceUrl: "https://example.edu/online-business",
        confidenceLabel: "high",
        truthStatus: "direct",
      },
      {
        degreeType: "BS",
        programName: "Programs",
        majorCanonicalName: "biology",
        majorDisplayName: "Biology",
        sourceUrl: "https://example.edu/biology",
        confidenceLabel: "medium",
        truthStatus: "direct",
      },
    ],
    bestProgram: null,
  });

  assert.deepEqual(targets.map((target) => target.majorCanonicalName), ["economics", "biology"]);
});

test("selectRequirementTargets all scope keeps the full ranked list unless capped", () => {
  const targets = selectRequirementTargets({
    scope: "all",
    limit: 0,
    targets: [
      {
        degreeType: "BA",
        programName: "Programs",
        majorCanonicalName: "economics",
        majorDisplayName: "Economics",
        sourceUrl: "https://example.edu/econ",
        confidenceLabel: "high",
        truthStatus: "direct",
      },
      {
        degreeType: "BS",
        programName: "Programs",
        majorCanonicalName: "biology",
        majorDisplayName: "Biology",
        sourceUrl: "https://example.edu/biology",
        confidenceLabel: "medium",
        truthStatus: "direct",
      },
      {
        degreeType: "BA",
        programName: "Programs",
        majorCanonicalName: "history",
        majorDisplayName: "History",
        sourceUrl: null,
        confidenceLabel: "low",
        truthStatus: "inferred",
      },
    ],
    bestProgram: null,
  });

  assert.equal(targets.length, 3);
  assert.deepEqual(targets.map((target) => target.majorCanonicalName), ["economics", "biology", "history"]);
});
