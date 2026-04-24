import { test, expect } from "./fixtures";
import { ensureSidebarGroupExpanded } from "./navigation";
import { reseedSyntheticWorld } from "./reseed";

test.beforeEach(async ({ page }) => {
  await page.goto("about:blank");
  reseedSyntheticWorld();
});

test("parent views student progress and sees relevant coach-sourced action items", async ({
  page,
  openAs,
}) => {
  await openAs("parentMaya", "/parent");

  await expect(page.getByRole("heading", { name: "Parent dashboard" })).toBeVisible();
  await expect(page.getByText("Coach updates visible to the family")).toBeVisible();
  await expect(page.getByText("Finish resume revision")).toBeVisible();
  await expect(page.getByText(/Recommended by Coach Taylor Brooks/i).first()).toBeVisible();
});

test("missing or concerning student data shows the expected visible coach flag", async ({
  page,
  openAs,
}) => {
  await openAs("parentMaya", "/parent");

  await expect(page.getByText("Outcome activity is missing")).toBeVisible();
  await expect(
    page.getByText("No new application, interview, or offer activity has been recorded this month.")
  ).toBeVisible();
});

test("parent can update family profile and sees only parent-appropriate navigation", async ({
  page,
  openAs,
}) => {
  await openAs("parentMaya", "/parent");
  await expect(page.getByRole("heading", { name: "Parent dashboard" })).toBeVisible();

  await page.goto("/profile");

  await expect(page.getByText("Parent profile")).toBeVisible();
  const profileSection = page.locator("section").filter({ hasText: "Parent profile" }).first();
  await profileSection.locator("label").filter({ hasText: "Full name" }).locator("input").fill("Elena Marisol Rivera");
  await profileSection
    .locator("label")
    .filter({ hasText: "Family unit name" })
    .locator("input")
    .fill("Rivera household");
  await profileSection
    .locator("label")
    .filter({ hasText: "Relationship to the student" })
    .locator("input")
    .fill("Mother");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page).toHaveURL(/\/parent$/);

  const primaryNav = page.getByLabel("Primary navigation");
  await expect(primaryNav.getByRole("button", { name: "Parent", exact: true })).toBeVisible();
  await expect(primaryNav.getByRole("button", { name: "Communication", exact: true })).toBeVisible();
  await expect(primaryNav.getByRole("button", { name: "Student", exact: true })).toHaveCount(0);
  await expect(primaryNav.getByRole("button", { name: "Coach", exact: true })).toHaveCount(0);

  await ensureSidebarGroupExpanded(page, "Parent");
  await expect(page.getByRole("link", { name: "Parent dashboard" })).toBeVisible();

  await ensureSidebarGroupExpanded(page, "Communication");
  await expect(page.getByRole("link", { name: "Messages & chat" })).toBeVisible();
  await page.getByRole("link", { name: "Messages & chat" }).click();
  await expect(page).toHaveURL(/\/communication/);
  await expect(page.getByRole("heading", { name: "Communication", level: 1 })).toBeVisible();
});

test("parent saves a communication entry and returns to the previous page", async ({
  page,
  openAs,
}) => {
  await openAs("parentMaya", "/parent");
  await expect(page.getByRole("heading", { name: "Parent dashboard" })).toBeVisible();

  await page.goto("/parent/communication");
  await expect(page.getByRole("heading", { name: "Communication translator" })).toBeVisible();
  await page.locator("label").filter({ hasText: "Concerns" }).locator("textarea").fill(
    "The internship search has stalled for two weeks."
  );
  await page.locator("label").filter({ hasText: "Preferred outcome" }).locator("textarea").fill(
    "A calmer conversation with one concrete next step."
  );
  await page.getByRole("button", { name: "Save concern or question" }).click();

  await expect(page).toHaveURL(/\/parent$/);
  await expect(page.getByRole("heading", { name: "Parent dashboard" })).toBeVisible();
});

test("parent cannot open coach-only routes directly", async ({ page, openAs }) => {
  await openAs("parentMaya", "/coach");

  await expect(page.getByText("This page is for a different account view")).toBeVisible();
});
