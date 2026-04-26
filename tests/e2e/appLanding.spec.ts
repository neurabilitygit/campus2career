import { test, expect } from "./fixtures";
import { reseedSyntheticWorld } from "./reseed";

test.beforeEach(async ({ page }) => {
  await page.goto("about:blank");
  reseedSyntheticWorld();
});

test("workspace landing falls back to signup when auth context cannot be resolved", async ({
  page,
  openAs,
}) => {
  await page.route("**/auth/me", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "internal_server_error" }),
    });
  });

  await openAs("studentNova", "/app");

  await expect(
    page.getByText("We hit an account setup issue while opening your workspace.", { exact: false })
  ).toBeVisible();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.getByRole("heading", { name: "Create the right household and role wiring" })).toBeVisible();
});
