import { test, expect } from "./fixtures";
import { ensureSidebarGroupExpanded } from "./navigation";
import { reseedSyntheticWorld } from "./reseed";
import { DEMO_AUTH_STORAGE_KEY } from "../../apps/web/src/lib/demoAuth";
import { makeDemoAuthState } from "../synthetic/factories";

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

test("student action-plan choices persist from the student dashboard into the parent dashboard", async ({
  page,
  openAs,
  switchAs,
}) => {
  await openAs("studentLeo", "/student");
  await expect(page.getByRole("heading", { name: "Student dashboard" })).toBeVisible();

  const actionPlanSection = page.locator("section").filter({ hasText: "Best next actions" }).first();
  const firstActionCard = actionPlanSection.getByTestId("action-plan-option").first();
  const chosenTitle = (await firstActionCard.getByTestId("action-plan-option-title").textContent())?.trim();
  expect(chosenTitle).toBeTruthy();

  await firstActionCard.getByLabel("Explore").check();
  await expect(firstActionCard.getByLabel("How to act on this")).toBeVisible();
  await firstActionCard.getByLabel("How to act on this").fill(
    "Turn one repeated class or work task into a short before-and-after workflow example."
  );
  await firstActionCard.getByLabel("Next-step date").fill("2026-05-15");
  await firstActionCard.getByRole("button", { name: "Save action choice" }).click();
  await expect(actionPlanSection.getByText("Action plan updated.")).toBeVisible();

  await switchAs("parentLeo", "/parent");
  await expect(page.getByRole("heading", { name: "Parent dashboard" })).toBeVisible();

  const sharedPlanSection = page.locator("section").filter({ hasText: "Shared student action plan" }).first();
  await expect(sharedPlanSection.getByText(chosenTitle || "").first()).toBeVisible();
  await expect(sharedPlanSection.getByText("2026-05-15")).toBeVisible();
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
  await expect(page.getByRole("link", { name: "Communication hub" })).toBeVisible();
  await page.getByRole("link", { name: "Communication hub" }).click();
  await expect(page).toHaveURL(/\/communication/);
  await expect(page.getByRole("heading", { name: "Communication", level: 1 })).toBeVisible();
});

test("parent onboarding baseline is split into smaller steps and still saves correctly", async ({
  page,
  openAs,
}) => {
  await openAs("parentMaya", "/parent/onboarding");

  await expect(page.getByRole("heading", { name: "Parent communication baseline" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "How you want this used" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Parent profile" })).toHaveCount(0);

  await page.getByRole("button", { name: /Next: Parent profile/i }).click();
  await expect(page.getByRole("heading", { name: "Parent profile" })).toBeVisible();

  await page.locator("label").filter({ hasText: "What are you most worried about?" }).locator("textarea").fill(
    "I want communication to stay calm while the internship search gets moving again."
  );
  await page.getByRole("button", { name: "Save parent baseline" }).click();

  await expect(page).toHaveURL(/\/parent$/);
  await expect(page.getByRole("heading", { name: "Parent dashboard" })).toBeVisible();
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

  await expect(page).toHaveURL(/\/parent$/);
  await expect(page.getByRole("heading", { name: "Parent dashboard" })).toBeVisible();
});

test("parent can open Career Goal in read-only mode for the connected student", async ({
  page,
  openAs,
}) => {
  await openAs("parentMaya", "/career-scenarios");

  await expect(page.getByRole("heading", { name: "Career Goal", exact: true })).toBeVisible();
  await expect(page.getByText("can review saved Career Goals", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create new Career Goal" })).toBeDisabled();
});

test("parent can open a prefilled translator nudge when degree requirements still need student review", async ({
  page,
  openAs,
}) => {
  await openAs("parentLeo", "/parent");

  const curriculumSection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Degree Requirements Review" }) })
    .first();

  await expect(
    curriculumSection.getByText("Want the system to help nudge Leo", { exact: false })
  ).toBeVisible();
  await curriculumSection.getByRole("link", { name: "Open communication translator" }).click();

  await expect(page).toHaveURL(/\/communication\?section=translator/);
  await expect(page.getByRole("heading", { name: "Parent-to-student translator" })).toBeVisible();
  await expect(page.locator("textarea").first()).toHaveValue(/degree requirements/i);
});

test("Eric parent preview resolves a usable student context and does not emit missing-student API errors", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(
    ({ demoAuthKey, demoAuthValue, previewKey }) => {
      window.localStorage.setItem(demoAuthKey, demoAuthValue);
      window.localStorage.setItem(previewKey, "parent");
    },
    {
      demoAuthKey: DEMO_AUTH_STORAGE_KEY,
      demoAuthValue: JSON.stringify(makeDemoAuthState("adminEric")),
      previewKey: "rising-senior:test-context-role",
    }
  );

  await page.goto("/parent");

  await expect(page.getByRole("heading", { name: "Parent dashboard" })).toBeVisible();
  await expect(page.locator('[data-topbar-key="student-context"]')).toContainText(/Leo|Maya/);
  await expect(page.getByText("No student profile could be resolved for the authenticated user")).toHaveCount(0);
});

test("Eric can open the student workspace directly and the API follows the inferred preview role", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(
    ({ demoAuthKey, demoAuthValue, previewKey }) => {
      window.localStorage.setItem(demoAuthKey, demoAuthValue);
      window.localStorage.removeItem(previewKey);
    },
    {
      demoAuthKey: DEMO_AUTH_STORAGE_KEY,
      demoAuthValue: JSON.stringify(makeDemoAuthState("adminEric")),
      previewKey: "rising-senior:test-context-role",
    }
  );

  await page.goto("/student");

  await expect(page.getByRole("heading", { name: "Student dashboard" })).toBeVisible();
  await expect(page.getByText("No student profile could be resolved for the authenticated user")).toHaveCount(0);
});

test("Eric can open the shared profile page from student preview without losing the selected student context", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(
    ({ demoAuthKey, demoAuthValue, previewKey, previewStudentKey }) => {
      window.localStorage.setItem(demoAuthKey, demoAuthValue);
      window.localStorage.removeItem(previewKey);
      window.localStorage.removeItem(previewStudentKey);
    },
    {
      demoAuthKey: DEMO_AUTH_STORAGE_KEY,
      demoAuthValue: JSON.stringify(makeDemoAuthState("adminEric")),
      previewKey: "rising-senior:test-context-role",
      previewStudentKey: "rising-senior:test-context-student-profile-id",
    }
  );

  await page.goto("/student");
  await expect(page.getByRole("heading", { name: "Student dashboard" })).toBeVisible();

  await page.goto("/profile");

  await expect(page.getByText("Student profile")).toBeVisible();
  await expect(
    page.getByText(/help the platform address (Leo|Maya) more clearly/i)
  ).toBeVisible();
  await expect(page.getByText("No student profile could be resolved for the authenticated user")).toHaveCount(0);
});

test("Eric keeps student preview context when moving from Student dashboard into Career Goal", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(
    ({ demoAuthKey, demoAuthValue, previewKey }) => {
      window.localStorage.setItem(demoAuthKey, demoAuthValue);
      window.localStorage.removeItem(previewKey);
    },
    {
      demoAuthKey: DEMO_AUTH_STORAGE_KEY,
      demoAuthValue: JSON.stringify(makeDemoAuthState("adminEric")),
      previewKey: "rising-senior:test-context-role",
    }
  );

  await page.goto("/student");
  await expect(page.getByRole("heading", { name: "Student dashboard" })).toBeVisible();
  await expect(page.getByText("No student profile could be resolved for the authenticated user")).toHaveCount(0);

  await page.goto("/career-scenarios");
  await expect(page.getByRole("heading", { name: "Career Goal", exact: true })).toBeVisible();
  await expect(page.getByText("A studentProfileId is required for admin scenario access")).toHaveCount(0);
  await expect(page.getByText("No career goals have been saved yet.")).toBeVisible();
});

test("Eric can select student persona for the session and Career Goal keeps that student preview context", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(
    ({ demoAuthKey, demoAuthValue, previewKey }) => {
      window.localStorage.setItem(demoAuthKey, demoAuthValue);
      window.localStorage.removeItem(previewKey);
    },
    {
      demoAuthKey: DEMO_AUTH_STORAGE_KEY,
      demoAuthValue: JSON.stringify(makeDemoAuthState("adminEric")),
      previewKey: "rising-senior:test-context-role",
    }
  );

  await page.goto("/admin");
  await page.getByRole("button", { name: /Account Eric Bass/i }).click();
  await page.getByRole("button", { name: "student", exact: true }).click();

  await page.goto("/career-scenarios");

  await expect(page.getByRole("heading", { name: "Career Goal", exact: true })).toBeVisible();
  await expect(page.getByText("A studentProfileId is required for admin scenario access")).toHaveCount(0);
  await expect(page.getByText("Student workspace")).toBeVisible();
  await expect(
    page
      .getByLabel("Detail workspace")
      .getByText(/compare how well (Leo|Maya) lines up/i)
  ).toBeVisible();
});
