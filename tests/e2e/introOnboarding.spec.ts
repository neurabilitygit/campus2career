import { test, expect } from "./fixtures";
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

  await expect(page.getByRole("heading", { name: "Welcome to Campus2Career" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("1 of")).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Start with the dashboard" })).toBeVisible();

  await dialog.getByRole("button", { name: "Next" }).click();
  await expect(dialog.getByRole("heading", { name: "Keep your profile current" })).toBeVisible();
  await dialog.getByRole("button", { name: "Back" }).click();
  await expect(dialog.getByRole("heading", { name: "Start with the dashboard" })).toBeVisible();

  for (let step = 0; step < 7; step += 1) {
    const finishButton = dialog.getByRole("button", { name: "Finish" });
    if (await finishButton.isVisible()) {
      await finishButton.click();
      break;
    }

    await dialog.getByRole("button", { name: "Next" }).click();
  }

  await expect(page.getByRole("heading", { name: "Student dashboard" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Welcome to Campus2Career" })).toHaveCount(0);

  await page.evaluate(() => {
    window.localStorage.removeItem("rising-senior:test-demo-auth");
  });
  await switchAs("studentNova", "/student");

  await expect(page.getByRole("heading", { name: "Student dashboard" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Welcome to Campus2Career" })).toHaveCount(0);
});

test("user can skip the intro and replay it later from Help", async ({ page, openAs }) => {
  await openAs("studentNova", "/app");

  await expect(page.getByRole("heading", { name: "Welcome to Campus2Career" })).toBeVisible();
  await page.getByRole("button", { name: "Skip intro" }).click();
  await expect(page.getByRole("heading", { name: "Skip the intro?" })).toBeVisible();
  await expect(page.getByText("You can restart it later from Help.")).toBeVisible();
  await page.getByRole("button", { name: "Skip intro" }).last().click();

  await expect(page.getByRole("heading", { name: "Student dashboard" })).toBeVisible();
  await page.goto("/help");
  await expect(page.getByRole("button", { name: "Replay intro" })).toBeVisible();
  await page.getByRole("button", { name: "Replay intro" }).click();
  await expect(page.getByRole("heading", { name: "Welcome to Campus2Career" })).toBeVisible();
});

test("tour supports keyboard navigation and gracefully skips missing targets on Help", async ({ page, openAs }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openAs("studentMaya", "/help");

  await page.getByRole("button", { name: "Replay intro" }).click();
  await expect(page.getByRole("heading", { name: "Welcome to Campus2Career" })).toBeVisible();
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/of [1-7]/)).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByRole("heading", { name: "Keep your profile current" })).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(dialog.getByRole("heading", { name: "Start with the dashboard" })).toBeVisible();

  const counter = await dialog.locator(".intro-tour__counter").textContent();
  expect(counter).toBeTruthy();
  const totalSteps = Number(counter?.split(" of ")[1] || "0");
  expect(totalSteps).toBeGreaterThan(0);
  expect(totalSteps).toBeLessThanOrEqual(7);
});
