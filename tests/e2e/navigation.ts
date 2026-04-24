import { expect, type Page } from "@playwright/test";

export async function ensureSidebarGroupExpanded(page: Page, groupName: string) {
  const toggle = page.getByRole("button", { name: groupName, exact: true });
  await expect(toggle).toBeVisible();

  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    await toggle.click();
  }
}
