import { test, expect } from "./fixtures";
import { DEMO_AUTH_STORAGE_KEY } from "../../apps/web/src/lib/demoAuth";
import { reseedSyntheticWorld } from "./reseed";

test.beforeEach(async ({ page }) => {
  await page.goto("about:blank");
  reseedSyntheticWorld();
});

test("new user sees the welcome splash, can move through the tour, and does not see it again after completion", async ({
  page,
  openAs,
  switchAs,
}) => {
  await openAs("studentNova", "/app");

  await expect(page.getByRole("heading", { name: "Welcome to Rising Senior" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("1 of")).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Start in the workspace" })).toBeVisible();

  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByRole("heading", { name: "Use the left navigation as your map" })).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(dialog.getByRole("heading", { name: "Start in the workspace" })).toBeVisible();

  for (let step = 0; step < 7; step += 1) {
    const finishButton = dialog.getByRole("button", { name: "Finish" });
    if (await finishButton.isVisible()) {
      await finishButton.click();
      break;
    }

    await page.keyboard.press("ArrowRight");
  }

  const roleDialog = page.getByRole("dialog");
  await expect(roleDialog.getByRole("heading", { name: "Student dashboard centers strategy and readiness" })).toBeVisible();
  for (let step = 0; step < 6; step += 1) {
    const finishButton = roleDialog.getByRole("button", { name: "Finish" });
    if (await finishButton.isVisible()) {
      await finishButton.click();
      break;
    }

    await page.keyboard.press("ArrowRight");
  }

  await expect(page.getByRole("heading", { name: "Student dashboard" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Welcome to Rising Senior" })).toHaveCount(0);

  await page.evaluate(() => {
    window.localStorage.removeItem("rising-senior:test-demo-auth");
  });
  await switchAs("studentNova", "/student");

  await expect(page.getByRole("heading", { name: "Student dashboard" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Welcome to Rising Senior" })).toHaveCount(0);
});

test("user can skip the intro and replay it later from Help", async ({ page, openAs }) => {
  await openAs("studentNova", "/app");

  await expect(page.getByRole("heading", { name: "Welcome to Rising Senior" })).toBeVisible();
  await page.getByRole("button", { name: "Skip intro" }).click();
  await expect(page.getByRole("heading", { name: "Skip the intro?" })).toBeVisible();
  await expect(page.getByText("You can restart it later from Help.")).toBeVisible();
  await page.getByRole("button", { name: "Skip intro" }).last().click();

  await expect(page.getByRole("heading", { name: "Student dashboard" })).toBeVisible();
  await page.goto("/help");
  await expect(page.getByRole("button", { name: "Replay intro" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Replay role walkthrough" })).toBeVisible();
  await page.getByRole("button", { name: "Replay intro" }).click();
  await expect(page.getByRole("heading", { name: "Welcome to Rising Senior" })).toBeVisible();
});

test("tour supports keyboard navigation and gracefully skips missing targets on Help", async ({ page, openAs }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openAs("studentMaya", "/help");

  await page.getByRole("button", { name: "Replay intro" }).click();
  await expect(page.getByRole("heading", { name: "Welcome to Rising Senior" })).toBeVisible();
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/of [1-7]/)).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByRole("heading", { name: "Use the left navigation as your map" })).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(dialog.getByRole("heading", { name: "Start in the workspace" })).toBeVisible();

  const counter = await dialog.locator(".intro-tour__counter").textContent();
  expect(counter).toBeTruthy();
  const totalSteps = Number(counter?.split(" of ")[1] || "0");
  expect(totalSteps).toBeGreaterThan(0);
  expect(totalSteps).toBeLessThanOrEqual(7);
});

test("student can replay the role walkthrough after the shared intro is complete", async ({ page, openAs }) => {
  await openAs("studentMaya", "/help");

  await page.getByRole("button", { name: "Replay role walkthrough" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Student dashboard centers strategy and readiness" })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  const counter = await dialog.locator(".intro-tour__counter").textContent();
  expect(counter).toBeTruthy();
  expect(counter?.startsWith("2 of")).toBeTruthy();
});

test("Eric can sign out, sign back in, replay the shared intro from admin, and finish without API errors", async ({
  page,
  openAs,
}) => {
  await openAs("adminEric", "/admin");

  await expect(page.getByRole("heading", { name: "Household administration" }).first()).toBeVisible();
  await page.getByRole("button", { name: /Account Eric Bass/i }).click();
  const signOutButton = page.getByRole("button", { name: "Sign out" });
  await signOutButton.scrollIntoViewIfNeeded();
  await signOutButton.evaluate((element) => {
    (element as HTMLButtonElement).click();
  });

  await expect(page).toHaveURL(/\/$/);
  await expect
    .poll(() => page.evaluate((storageKey) => window.localStorage.getItem(storageKey), DEMO_AUTH_STORAGE_KEY))
    .toBeNull();

  await openAs("adminEric", "/admin");
  await expect(page.getByRole("heading", { name: "Household administration" }).first()).toBeVisible();

  await page.getByRole("button", { name: /Account Eric Bass/i }).click();
  await page.getByRole("button", { name: "Replay intro" }).click();

  await expect(page.getByRole("heading", { name: "Welcome to Rising Senior" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  const dialog = page.getByRole("dialog");
  for (let step = 0; step < 7; step += 1) {
    const finishButton = dialog.getByRole("button", { name: "Finish" });
    if (await finishButton.isVisible()) {
      await finishButton.click();
      break;
    }

    await page.keyboard.press("ArrowRight");
  }

  await expect(dialog).toBeHidden();
  await expect(page.getByText('API request failed: 500 {"error":"internal_server_error"}')).toHaveCount(0);
  await expect(
    page.getByText("We could not save your intro progress yet. Try again in a moment with your session still active.")
  ).toHaveCount(0);
});
