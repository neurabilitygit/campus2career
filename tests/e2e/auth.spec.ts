import { test, expect } from "./fixtures";

const LAST_GOOGLE_ACCOUNT_KEY = "rising-senior:last-google-account";

test("auth page shows the remembered Google account after logout", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto("/");
  await page.evaluate(
    ({ key, value }) => {
      window.localStorage.setItem(key, value);
    },
    {
      key: LAST_GOOGLE_ACCOUNT_KEY,
      value: JSON.stringify({
        email: "eric.bassman@gmail.com",
        fullName: "Eric Bass",
        avatarUrl: null,
      }),
    }
  );

  await page.goto("/auth?signed_out=1");

  await expect(page.getByRole("heading", { name: "Continue as Eric Bass" })).toBeVisible();
  await expect(page.getByText("You signed out successfully.")).toBeVisible();
  await expect(page.getByText("eric.bassman@gmail.com")).toBeVisible();
  await expect(page.getByRole("button", { name: /Continue as Eric Bass/i })).toBeVisible();
  await expect(pageErrors).toEqual([]);
  await expect(consoleErrors).toEqual([]);
});
