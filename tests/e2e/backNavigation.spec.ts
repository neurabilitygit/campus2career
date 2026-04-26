import { test, expect } from "./fixtures";
import { reseedSyntheticWorld } from "./reseed";

async function dismissIntroIfPresent(page: any) {
  const dialog = page.getByRole("dialog");
  const introAppeared = await dialog
    .waitFor({ state: "visible", timeout: 1500 })
    .then(() => true)
    .catch(() => false);

  if (!introAppeared) {
    return;
  }

  const skipButton = page.getByRole("button", { name: "Skip" }).last();
  if ((await skipButton.isVisible().catch(() => false)) && (await skipButton.isEnabled().catch(() => false))) {
    await skipButton.click();
  }

  const confirmSkip = page.getByRole("button", { name: "Skip intro" }).last();
  if ((await confirmSkip.isVisible().catch(() => false)) && (await confirmSkip.isEnabled().catch(() => false))) {
    await confirmSkip.click();
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto("about:blank");
  reseedSyntheticWorld();
});

test("student help screen offers a bottom back button to the dashboard", async ({ openAs, page }) => {
  await openAs("studentMaya", "/help");
  await dismissIntroIfPresent(page);

  const backButton = page.getByTestId("app-bottom-back");
  await expect(backButton).toBeVisible();
  await expect(backButton).toContainText("Back to dashboard");

  await backButton.click();
  await expect(page).toHaveURL(/\/student\?section=strategy$/);
  await expect(page.getByRole("heading", { name: "Student dashboard" })).toBeVisible();
});

test("student upload detail screens offer a bottom back button to the document center", async ({ openAs, page }) => {
  await openAs("studentMaya", "/uploads/resume");
  await dismissIntroIfPresent(page);

  const backButton = page.getByTestId("app-bottom-back");
  await expect(backButton).toBeVisible();
  await expect(backButton).toContainText("Back to documents");

  await backButton.click();
  await expect(page).toHaveURL(/\/uploads$/);
  await expect(page.getByRole("heading", { name: "Document center" })).toBeVisible();
});

test("parent detail screens offer a bottom back button to the parent dashboard", async ({ openAs, page }) => {
  await openAs("parentMaya", "/parent/history");
  await dismissIntroIfPresent(page);

  const backButton = page.getByTestId("app-bottom-back");
  await expect(backButton).toBeVisible();
  await expect(backButton).toContainText("Back to parent dashboard");

  await backButton.click();
  await expect(page).toHaveURL(/\/parent$/);
  await expect(page.getByRole("heading", { name: "Parent dashboard" })).toBeVisible();
});

test("workspace root pages do not add a redundant bottom back button", async ({ openAs, page }) => {
  await openAs("studentMaya", "/student");
  await dismissIntroIfPresent(page);

  await expect(page.getByTestId("app-bottom-back")).toHaveCount(0);
});
