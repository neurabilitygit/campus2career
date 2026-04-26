import { test, expect } from "./fixtures";

async function dismissIntroIfPresent(page: any) {
  const dialog = page.getByRole("dialog");
  const introAppeared = await dialog
    .waitFor({ state: "visible", timeout: 2500 })
    .then(() => true)
    .catch(() => false);

  if (!introAppeared) {
    return;
  }

  const continueButton = dialog.getByRole("button", { name: "Continue" });
  if (await continueButton.isVisible().catch(() => false)) {
    await continueButton.click();
  }

  const skipButton = page.getByRole("button", { name: "Skip" }).last();
  if (await skipButton.isVisible().catch(() => false)) {
    await skipButton.click();
  }

  const confirmSkip = page.getByRole("button", { name: "Skip intro" }).last();
  if (await confirmSkip.isVisible().catch(() => false)) {
    await confirmSkip.click();
  }
}

test("parent can answer a communication prompt and use the translator", async ({ openAs, page }) => {
  await openAs("parentMaya", "/communication?section=insights");
  await dismissIntroIfPresent(page);

  await expect(page.getByRole("heading", { name: "Student insight prompts" })).toBeVisible();
  await page.getByRole("textbox").first().fill("Shorter check-ins and calmer timing usually work better.");
  await page.getByRole("button", { name: "Save response" }).click();

  await expect(page.getByText("Saved.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();

  await page.getByRole("button", { name: "Edit" }).first().click();
  const editCard = page.locator(".ui-soft-panel").filter({ has: page.getByRole("button", { name: "Save changes" }) }).first();
  await editCard.locator("textarea").fill("Shorter check-ins, calmer timing, and one next step usually work better.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await expect(page.getByText("one next step usually work better", { exact: false })).toBeVisible();

  await page.goto("/communication?section=profile");
  await expect(page.getByRole("heading", { name: "Review inferred patterns" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm" }).first()).toBeVisible();

  await page.goto("/communication?section=translator");
  await dismissIntroIfPresent(page);
  await expect(page.getByRole("heading", { name: "Parent-to-student translator" })).toBeVisible();
  await page.locator("textarea").first().fill("I’m worried you’re waiting too long to start and I don’t want this to turn into another argument.");
  await page.getByRole("button", { name: "Translate" }).click();

  const translationResult = page.getByTestId("communication-translation-result");
  await expect(translationResult).toBeVisible({ timeout: 30000 });
  await expect(translationResult.getByText("Rewritten message", { exact: true })).toBeVisible({ timeout: 30000 });
  await expect(translationResult.getByText("Why the wording changed", { exact: true })).toBeVisible({ timeout: 30000 });

  page.once("dialog", (dialog) => dialog.accept());
  await page.goto("/communication?section=insights");
  await page.getByRole("button", { name: "Delete" }).first().click();
  await expect(page.getByText("Deleted.")).toBeVisible();
});

test("student can answer a communication prompt and use the parent message helper", async ({ openAs, page }) => {
  await openAs("studentLeo", "/communication?section=preferences");
  await dismissIntroIfPresent(page);

  await expect(page.getByRole("heading", { name: "My communication preferences" })).toBeVisible();
  await page.getByRole("textbox").first().fill("One short reminder with one next step helps most.");
  await page.getByRole("button", { name: "Save response" }).click();

  await expect(page.getByText("Saved.")).toBeVisible();

  await page.goto("/communication?section=helper");
  await page.locator("textarea").first().fill("I need help, but pressure and long messages make it harder to respond.");
  await page.getByRole("button", { name: "Translate" }).click();

  const translationResult = page.getByTestId("communication-translation-result");
  await expect(translationResult).toBeVisible({ timeout: 30000 });
  await expect(translationResult.getByText("Suggested next step", { exact: true })).toBeVisible({
    timeout: 30000,
  });
});

test("coach can review communication context for the selected student", async ({ openAs, page }) => {
  await openAs("coachTaylor", "/communication?section=context&studentProfileId=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  await dismissIntroIfPresent(page);

  await expect(page.getByRole("heading", { name: "Communication context summary" })).toBeVisible();
  await expect(page.getByText("Friction-reduction suggestions")).toBeVisible();
});
