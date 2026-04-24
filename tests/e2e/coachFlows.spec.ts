import { test, expect } from "./fixtures";
import { ensureSidebarGroupExpanded } from "./navigation";
import { reseedSyntheticWorld } from "./reseed";
import { SYNTHETIC_STUDENTS } from "../synthetic/scenarios";

test.beforeEach(async ({ page }) => {
  await page.goto("about:blank");
  reseedSyntheticWorld();
});

test("coach can record a recommendation and the student can see it afterward", async ({
  page,
  openAs,
  switchAs,
}) => {
  await openAs(
    "coachTaylor",
    `/coach?studentProfileId=${encodeURIComponent(SYNTHETIC_STUDENTS.maya.studentProfileId)}`
  );

  await expect(page.getByRole("heading", { name: "Coach workspace" })).toBeVisible();
  await page.getByText("Add recommendation").click();
  const recommendationForm = page.locator("details").filter({ hasText: "Add recommendation" }).first();
  await recommendationForm
    .getByPlaceholder("Recommendation title")
    .fill("Create a simple informational interview script");
  await recommendationForm.locator("select").nth(0).selectOption("networking");
  await recommendationForm.locator("select").nth(1).selectOption("high");
  await recommendationForm.locator("select").nth(2).selectOption("student_visible");
  await recommendationForm
    .getByPlaceholder("Why this matters now")
    .fill("The student needs a low-friction first outreach step.");
  await recommendationForm
    .getByPlaceholder("Recommended next step")
    .fill("Draft one short outreach script and send it for review.");
  await recommendationForm.locator('input[type="date"]').fill("2026-05-06");
  await page.getByRole("button", { name: "Save recommendation" }).click();

  await expect(page.getByText("Coach recommendation saved")).toBeVisible();

  await switchAs("studentMaya", "/student");
  await expect(page.getByRole("heading", { name: "Student dashboard" })).toBeVisible();
  await expect(page.getByText("Create a simple informational interview script")).toBeVisible();
  await expect(page.getByText("Draft one short outreach script and send it for review.")).toBeVisible();
});

test("coach can switch between authorized students without data leakage", async ({
  page,
  openAs,
}) => {
  await openAs("coachTaylor", "/coach");
  await expect(page.getByRole("heading", { name: "Coach workspace" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Coach roster" })).toBeVisible();

  await expect(page.getByText("Start weekly alumni outreach")).toBeVisible();

  const rosterCard = page.locator("section").filter({ has: page.getByRole("heading", { name: "Coach roster" }) }).first();
  await rosterCard.locator("select").first().selectOption(SYNTHETIC_STUDENTS.leo.studentProfileId);

  await expect(page.getByText("Tighten GitHub project routine")).toBeVisible();
  await expect(page.getByText("Ship one portfolio update").first()).toBeVisible();
  await expect(page.getByText("Start weekly alumni outreach")).not.toBeVisible();
});

test("coach can update profile, keep coach-only navigation, and see the selected student name", async ({
  page,
  openAs,
}) => {
  await openAs("coachTaylor", "/profile");

  await expect(page.getByText("Coach profile")).toBeVisible();
  const profileSection = page.locator("section").filter({ hasText: "Coach profile" }).first();
  await profileSection.locator("label").filter({ hasText: "Full name" }).locator("input").fill("Taylor Anne Brooks");
  await profileSection
    .locator("label")
    .filter({ hasText: "Professional title" })
    .locator("input")
    .fill("Senior Career Coach");
  await profileSection
    .locator("label")
    .filter({ hasText: "Organization name" })
    .locator("input")
    .fill("North Star Advising");
  await profileSection
    .locator("input")
    .nth(4)
    .fill("Networking, Career direction");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile saved.")).toBeVisible();

  await expect(page.getByRole("button", { name: "Coach", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Communication", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Student", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Parent", exact: true })).toHaveCount(0);

  await page.goto(
    `/coach?studentProfileId=${encodeURIComponent(SYNTHETIC_STUDENTS.maya.studentProfileId)}`
  );
  await expect(page.getByRole("heading", { name: /Maya Rivera review workspace/i })).toBeVisible();

  await ensureSidebarGroupExpanded(page, "Communication");
  await expect(page.getByRole("link", { name: "Messages & chat" })).toBeVisible();
  await page.getByRole("link", { name: "Messages & chat" }).click();
  await expect(page).toHaveURL(/\/communication/);
  await expect(page.getByRole("heading", { name: "Communication", level: 1 })).toBeVisible();
});

test("coach cannot open parent-only routes directly", async ({ page, openAs }) => {
  await openAs("coachTaylor", "/parent");

  await expect(page.getByText("This page is for a different account view")).toBeVisible();
});
