import { test, expect } from "./fixtures";
import { DEMO_AUTH_STORAGE_KEY } from "../../apps/web/src/lib/demoAuth";

async function dismissIntroIfPresent(page: any) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const dialog = page.getByRole("dialog");
    const introAppeared = await dialog
      .waitFor({ state: "visible", timeout: 2500 })
      .then(() => true)
      .catch(() => false);

    if (!introAppeared) {
      return;
    }

    const continueButton = dialog.getByRole("button", { name: "Continue" });
    if (
      (await continueButton.isVisible().catch(() => false)) &&
      (await continueButton.isEnabled().catch(() => false))
    ) {
      await continueButton.click();
    }

    const skipButton = page.getByRole("button", { name: "Skip" }).last();
    if (
      (await skipButton.isVisible().catch(() => false)) &&
      (await skipButton.isEnabled().catch(() => false))
    ) {
      await skipButton.click();
    }

    const confirmSkip = page.getByRole("button", { name: "Skip intro" }).last();
    if (
      (await confirmSkip.isVisible().catch(() => false)) &&
      (await confirmSkip.isEnabled().catch(() => false))
    ) {
      await confirmSkip.click();
    }

    const finishButton = page.getByRole("button", { name: "Finish" }).last();
    if (
      (await finishButton.isVisible().catch(() => false)) &&
      (await finishButton.isEnabled().catch(() => false))
    ) {
      await finishButton.click();
    }

    const dialogHidden = await page
      .getByRole("dialog")
      .waitFor({ state: "hidden", timeout: 3000 })
      .then(() => true)
      .catch(() => false);

    if (dialogHidden) {
      return;
    }
  }
}

test("parent first-subscriber can create a household from the signup flow", async ({ openAs, page }) => {
  await openAs("parentAvery", "/signup");
  await dismissIntroIfPresent(page);

  await expect(page.getByRole("heading", { name: "Create the right household and role wiring" })).toBeVisible();
  await dismissIntroIfPresent(page);
  await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});
  await page.getByLabel("Household name").fill("Stone household");
  await dismissIntroIfPresent(page);
  await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});
  await page.getByRole("button", { name: "Create household" }).click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Household administration" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Invite a student or coach" })).toBeVisible();
});

test("returning superuser bypasses signup and opens the system directly", async ({ openAs, page }) => {
  await openAs("adminEric", "/signup");

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Household administration" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Create the right household and role wiring" })).toHaveCount(0);
});

test("Eric can sign out, sign back in, and reopen household administration cleanly", async ({ openAs, page }) => {
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
    .poll(() =>
      page.evaluate((storageKey) => window.localStorage.getItem(storageKey), DEMO_AUTH_STORAGE_KEY)
    )
    .toBeNull();

  await openAs("adminEric", "/admin");

  await expect(page.getByRole("heading", { name: "Household administration" }).first()).toBeVisible();
  await expect(
    page.getByText('API request failed: 500 {"error":"internal_server_error"}')
  ).toHaveCount(0);
});

test("student signup without invitation submits a household access request", async ({ openAs, page }) => {
  await openAs("studentNova", "/signup");

  await dismissIntroIfPresent(page);

  const requestCard = page
    .getByRole("heading", { name: "Student or coach access request" })
    .locator("xpath=ancestor::section[1]");
  await requestCard.getByRole("button", { name: "Student", exact: true }).click();
  await page.getByLabel("Parent email").fill("elena.rivera@synthetic.rising-senior.local");
  await page.getByRole("button", { name: "Request household access" }).click();

  await expect(page.getByText("Household access request submitted.")).toBeVisible();
});

test("signup still offers manual setup without exposing raw API errors when auto-detection fails", async ({ openAs, page }) => {
  await page.route("**/auth/signup/decision", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "internal_server_error" }),
    });
  });

  await openAs("studentNova", "/signup");
  await dismissIntroIfPresent(page);

  await expect(
    page.getByText("We could not auto-detect the exact signup path, so you can choose it manually below.", {
      exact: false,
    })
  ).toBeVisible();
  await expect(page.getByText('API request failed: 500 {"error":"internal_server_error"}')).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Student or coach access request" })).toBeVisible();
});

test("household administration shows invitation tools for parent accounts", async ({ openAs, page }) => {
  await openAs("parentMaya", "/admin");

  await expect(page.getByRole("heading", { name: /household administration/i })).toBeVisible();
  await page.getByPlaceholder("student.or.coach@example.com").fill("robin.kline@synthetic.rising-senior.local");
  await page.getByRole("button", { name: "Send invite" }).click();

  await expect(page.getByText(/Invitation created\./)).toBeVisible();
});

test("super admin can see the cross-household user directory", async ({ openAs, page }) => {
  await openAs("adminEric", "/admin");

  await expect(page.getByRole("heading", { name: /super-admin user directory/i })).toBeVisible();
  await expect(page.getByText("eric.bassman@gmail.com")).toBeVisible();
});

test("household administration shows calm recovery copy instead of raw API errors", async ({ openAs, page }) => {
  await page.route("**/households/me/admin", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "internal_server_error" }),
    });
  });

  await openAs("adminEric", "/admin");

  await expect(
    page.getByText("We could not finish loading household administration yet.", { exact: false })
  ).toBeVisible();
  await expect(page.getByText('API request failed: 500 {"error":"internal_server_error"}')).toHaveCount(0);
});

test("super-admin directory shows calm recovery copy instead of raw API errors", async ({ openAs, page }) => {
  await page.route("**/admin/users", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "internal_server_error" }),
    });
  });

  await openAs("adminEric", "/admin");

  await expect(
    page.getByText("We could not finish loading the super-admin directory yet.", { exact: false })
  ).toBeVisible();
  await expect(page.getByText('API request failed: 500 {"error":"internal_server_error"}')).toHaveCount(0);
});

test("household setup page explains the live household model without stub language", async ({ openAs, page }) => {
  await openAs("parentMaya", "/household-setup");
  await dismissIntroIfPresent(page);

  await expect(page.getByRole("heading", { name: "Household setup" })).toBeVisible();
  await expect(
    page.getByLabel("Detail workspace").getByText("See how Rising Senior connects student, parent, and coach accounts", {
      exact: false,
    })
  ).toBeVisible();
  await expect(page.getByText("What is true today")).toBeVisible();
  await expect(
    page.getByText("Parents can create a household and manage invitations, join requests, and household permissions.", {
      exact: false,
    })
  ).toBeVisible();
  await expect(page.getByText("This stub", { exact: false })).toHaveCount(0);
});
