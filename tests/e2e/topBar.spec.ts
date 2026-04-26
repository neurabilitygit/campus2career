import { test, expect } from "./fixtures";
import { reseedSyntheticWorld } from "./reseed";
import { SYNTHETIC_STUDENTS } from "../synthetic/scenarios";

test.beforeEach(async ({ page }) => {
  await page.goto("about:blank");
  reseedSyntheticWorld();
});

test("student sees Help, Account, Communication, and the active Career Goal in the top bar", async ({
  page,
  openAs,
}) => {
  await openAs("studentMaya", "/student");

  await expect(page.getByRole("heading", { name: "Student dashboard" })).toBeVisible();
  await expect(page.locator('[data-topbar-key="workspace"]')).toContainText("Student dashboard");
  await expect(page.locator('[data-topbar-key="active-scenario"]')).toBeVisible();
  await expect(page.locator('[data-topbar-key="communication"]')).toBeVisible();
  await expect(page.locator('[data-topbar-key="help"]')).toBeVisible();
  await expect(page.locator('[data-topbar-key="account"]')).toBeVisible();
  await expect(page.locator('[data-topbar-key="student-context"]')).toHaveCount(0);
});

test("parent sees the connected student context in the top bar", async ({ page, openAs }) => {
  await openAs("parentMaya", "/parent");

  await expect(page.getByRole("heading", { name: "Parent dashboard" })).toBeVisible();
  await expect(page.locator('[data-topbar-key="student-context"]')).toContainText("Maya");
});

test("coach with a selected student sees student context in the top bar", async ({ page, openAs }) => {
  await openAs(
    "coachTaylor",
    `/coach?studentProfileId=${encodeURIComponent(SYNTHETIC_STUDENTS.maya.studentProfileId)}`
  );

  await expect(page.getByRole("heading", { name: /Maya Rivera review workspace/i })).toBeVisible();
  await expect(page.locator('[data-topbar-key="student-context"]')).toContainText("Maya");
});

test("Needs Attention appears when the current fixture has attention-worthy blockers", async ({
  page,
  openAs,
}) => {
  await openAs("studentLeo", "/student");

  await expect(page.getByRole("heading", { name: "Student dashboard" })).toBeVisible();
  await expect(page.locator('[data-topbar-key="needs-attention"]')).toBeVisible();
});

test("top bar shortcuts route to Communication and Help, and Account still opens", async ({
  page,
  openAs,
}) => {
  await openAs("studentMaya", "/student");

  await page.locator('[data-topbar-key="communication"]').click();
  await expect(page).toHaveURL(/\/communication/);

  await page.locator('[data-topbar-key="help"]').click();
  await expect(page).toHaveURL(/\/help/);

  await page.getByRole("button", { name: "Account" }).click();
  await expect(page.getByRole("menu", { name: "Account menu" })).toBeVisible();
});

test("top bar remains usable on mobile", async ({ page, openAs }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAs("studentMaya", "/student");

  await expect(page.locator('[data-topbar-key="workspace"]')).toBeVisible();
  await expect(page.locator('[data-topbar-key="help"]')).toBeVisible();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByLabel("Primary navigation")).toBeVisible();
});
