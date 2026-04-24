import test from "node:test";
import assert from "node:assert/strict";
import { assessTop50SchoolReadiness } from "./top50Review";

test("assessTop50SchoolReadiness marks clean exact schools as ready to seed", () => {
  const result = assessTop50SchoolReadiness({
    exactMatch: true,
    websiteUrlPresent: true,
    officialProgramsUrlPresent: true,
    officialCatalogUrlPresent: true,
    catalogs: 0,
    programs: 0,
    majors: 0,
    minors: 0,
    concentrations: 0,
    requirementSets: 4,
    sampleMajors: ["Computer Science", "Mathematics"],
    latestOfferingsStatus: "succeeded",
    latestRequirementsStatus: "succeeded",
  });

  assert.equal(result.primaryRecommendation, "ready_to_seed");
});

test("assessTop50SchoolReadiness flags noisy offerings and likely PDF fallback", () => {
  const result = assessTop50SchoolReadiness({
    exactMatch: true,
    websiteUrlPresent: true,
    officialProgramsUrlPresent: true,
    officialCatalogUrlPresent: true,
    catalogs: 1,
    programs: 1,
    majors: 150,
    minors: 0,
    concentrations: 0,
    requirementSets: 0,
    sampleMajors: ["Advice for Applicants", "Computer Science"],
    latestOfferingsStatus: "succeeded",
    latestRequirementsStatus: "upload_required",
  });

  assert.equal(result.primaryRecommendation, "offerings_noisy");
  assert.ok(result.flags.includes("requirements_pdf_likely"));
});

test("assessTop50SchoolReadiness treats generic site-section labels as noisy offerings", () => {
  const result = assessTop50SchoolReadiness({
    exactMatch: true,
    websiteUrlPresent: true,
    officialProgramsUrlPresent: true,
    officialCatalogUrlPresent: true,
    catalogs: 1,
    programs: 1,
    majors: 31,
    minors: 0,
    concentrations: 0,
    requirementSets: 1,
    sampleMajors: ["A-Z", "Archive", "Arts and Communication", "Bookstore", "Close"],
    latestOfferingsStatus: "succeeded",
    latestRequirementsStatus: "succeeded",
  });

  assert.equal(result.primaryRecommendation, "offerings_noisy");
});

test("assessTop50SchoolReadiness recommends manual adapters for unresolved schools", () => {
  const result = assessTop50SchoolReadiness({
    exactMatch: false,
    websiteUrlPresent: false,
    officialProgramsUrlPresent: false,
    officialCatalogUrlPresent: true,
    catalogs: 0,
    programs: 0,
    majors: 0,
    minors: 0,
    concentrations: 0,
    requirementSets: 0,
    sampleMajors: [],
    latestOfferingsStatus: null,
    latestRequirementsStatus: null,
  });

  assert.equal(result.primaryRecommendation, "manual_adapter_recommended");
});
