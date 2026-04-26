import test from "node:test";
import assert from "node:assert/strict";
import {
  assessDiscoveredProgramQuality,
  buildCatalogSeedUrls,
  cleanProgramDisplayName,
  isLikelyUndergraduateDegreeType,
  isClearlyNonProgramLabel,
  looksLikeProgramName,
  selectPersistablePrograms,
} from "./catalogDiscoveryService";

test("cleanProgramDisplayName strips UI affordances from discovered labels", () => {
  assert.equal(
    cleanProgramDisplayName("Explore Majors, Minors, & Certificates keyboard_arrow_right"),
    "Explore Majors, Minors, & Certificates"
  );
  assert.equal(cleanProgramDisplayName("Accessibility (link is external)"), "Accessibility");
});

test("buildCatalogSeedUrls prioritizes curated official URLs without losing generic fallbacks", () => {
  const seeds = buildCatalogSeedUrls("https://www.example.edu/", [
    "https://catalog.example.edu/programs/",
    "https://catalog.example.edu/",
  ]);

  assert.deepEqual(seeds.slice(0, 2), [
    "https://catalog.example.edu/programs/",
    "https://catalog.example.edu/",
  ]);
  assert.equal(seeds.includes("https://www.example.edu/"), true);
  assert.equal(seeds.includes("https://bulletin.example.edu/"), true);
});

test("looksLikeProgramName rejects noisy navigation and address-like labels", () => {
  assert.equal(looksLikeProgramName("2 The Green"), false);
  assert.equal(looksLikeProgramName("Accessibility (link is external)"), false);
  assert.equal(looksLikeProgramName("Computer Science"), true);
});

test("isClearlyNonProgramLabel rejects common marketing and navigation fragments", () => {
  assert.equal(isClearlyNonProgramLabel("Find Your"), true);
  assert.equal(isClearlyNonProgramLabel("Explore Majors, Minors, & Certificates"), true);
  assert.equal(isClearlyNonProgramLabel("Advice for Applicants"), true);
  assert.equal(isClearlyNonProgramLabel("< back"), true);
  assert.equal(isClearlyNonProgramLabel("Computer Science"), false);
});

test("assessDiscoveredProgramQuality accepts directory-like academic programs and rejects weak labels", () => {
  const accepted = assessDiscoveredProgramQuality({
    displayName: "Computer Science",
    sourceUrl: "https://catalog.example.edu/academics/majors-minors/computer-science",
    kind: "major",
  });
  assert.equal(accepted.accepted, true);

  const rejected = assessDiscoveredProgramQuality({
    displayName: "Activities and Recreation",
    sourceUrl: "https://admissions.example.edu/student-life/activities-recreation",
    kind: "major",
  });
  assert.equal(rejected.accepted, false);

  const undergraduateGuideAccepted = assessDiscoveredProgramQuality({
    displayName: "Anthropology",
    sourceUrl: "https://guide.wisc.edu/undergraduate/letters-science/anthropology/anthropology-ba/",
    kind: "major",
  });
  assert.equal(undergraduateGuideAccepted.accepted, true);

  const historyNotMisclassified = assessDiscoveredProgramQuality({
    displayName: "Art History",
    sourceUrl: "https://guide.wisc.edu/undergraduate/letters-science/art-history/art-history-ba/",
    kind: "major",
  });
  assert.equal(historyNotMisclassified.accepted, true);

  const academicPossibilitiesAccepted = assessDiscoveredProgramQuality({
    displayName: "Computer Science",
    sourceUrl: "https://admissions.duke.edu/academic-possibilities/",
    kind: "major",
  });
  assert.equal(academicPossibilitiesAccepted.accepted, true);

  const washingtonCatalogAccepted = assessDiscoveredProgramQuality({
    displayName: "Anthropology",
    sourceUrl: "https://uw.edu/students/gencat/program/S/Anthropology-102.html",
    kind: "major",
  });
  assert.equal(washingtonCatalogAccepted.accepted, true);
});

test("selectPersistablePrograms accepts strong BA/BS major-minor results", () => {
  const selection = selectPersistablePrograms([
    {
      displayName: "Economics",
      canonicalName: "economics",
      kind: "major",
      degreeType: "BA",
      programName: "Auto-discovered Montclair undergraduate programs",
      sourceUrl: "https://www.montclair.edu/academics/programs/ba-economics/",
    },
    {
      displayName: "Economics",
      canonicalName: "economics",
      kind: "minor",
      degreeType: "BA",
      programName: "Auto-discovered Montclair undergraduate programs",
      sourceUrl: "https://www.montclair.edu/academics/programs/ba-economics/",
    },
    {
      displayName: "Accounting",
      canonicalName: "accounting",
      kind: "major",
      degreeType: "BS",
      programName: "Auto-discovered Montclair undergraduate programs",
      sourceUrl: "https://www.montclair.edu/academics/programs/bs-accounting/",
    },
  ]);

  assert.equal(selection.isSufficient, true);
  assert.equal(selection.programs.filter((program) => program.kind === "major").length, 2);
  assert.equal(selection.programs.filter((program) => program.kind === "minor").length, 1);
});

test("isLikelyUndergraduateDegreeType accepts common undergraduate degree labels", () => {
  assert.equal(isLikelyUndergraduateDegreeType("Undergraduate"), true);
  assert.equal(isLikelyUndergraduateDegreeType("BA"), true);
  assert.equal(isLikelyUndergraduateDegreeType("BS"), true);
  assert.equal(isLikelyUndergraduateDegreeType("Graduate"), false);
  assert.equal(isLikelyUndergraduateDegreeType("Master's"), false);
});
