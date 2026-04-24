import { test, expect } from "./fixtures";
import { ensureSidebarGroupExpanded } from "./navigation";
import { reseedSyntheticWorld } from "./reseed";

test.beforeEach(async ({ page }) => {
  await page.goto("about:blank");
  reseedSyntheticWorld();
});

test("student completes a multi-screen intake flow and sees the dashboard reflect the selected direction", async ({
  page,
  openAs,
}) => {
  await openAs("studentMaya", "/onboarding/sectors");
  await expect(page.getByRole("heading", { name: "Choose starting career areas" })).toBeVisible();

  await page.getByLabel("Fintech").check();
  await page.getByRole("button", { name: "Save and continue" }).click();

  await expect(page).toHaveURL(/\/student\?section=strategy/);
  await expect(page.getByText("Fintech", { exact: true })).toBeVisible();

  await page.goto("/onboarding/network");
  await page
    .getByPlaceholder("Jordan Lee - VP Finance, family friend, open to a warm introduction")
    .fill(
    "Professor Lin - mentor - synthetic test contact\nTaylor Brooks - coach - weekly check-in"
  );
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL(/\/student\?section=strategy/);

  await page.goto("/onboarding/deadlines");
  await page.getByPlaceholder("What is this date for?").fill("Synthetic internship deadline");
  await page.locator("select").first().selectOption("application_due");
  await page.locator('input[type="date"]').first().fill("2026-05-12");
  await page
    .getByPlaceholder("Add any notes you or your family should remember")
    .fill("Submit three internship applications before the deadline.");
  await page.getByRole("button", { name: "Save and continue" }).click();

  await expect(page).toHaveURL(/\/student\?section=strategy/);
  await expect(page.getByRole("heading", { name: "Student dashboard" })).toBeVisible();
  await expect(page.getByText("Business Analyst", { exact: true }).first()).toBeVisible();
});

test("invalid coach form entries surface a useful validation message", async ({ page, openAs }) => {
  await openAs("coachTaylor", "/coach");
  await expect(page.getByRole("heading", { name: "Coach workspace" })).toBeVisible();

  await page.getByText("Add recommendation").click();
  await page.getByRole("button", { name: "Save recommendation" }).click();

  await expect(page.getByText(/title:/i)).toBeVisible();
});

test("student can update profile, use the communication tab, and see personalized dashboard language", async ({
  page,
  openAs,
}) => {
  await openAs("studentMaya", "/student");
  await expect(page.getByRole("heading", { name: "Student dashboard" })).toBeVisible();

  await page.goto("/profile");
  await expect(page.getByText("Student profile")).toBeVisible();
  const profileSection = page.locator("section").filter({ hasText: "Student profile" }).first();

  await profileSection.locator("label").filter({ hasText: "Full name" }).locator("input").fill("Maya Jordan Rivera");
  await profileSection.locator("label").filter({ hasText: "Preferred name" }).locator("input").fill("MJ");
  await profileSection
    .locator("label")
    .filter({ hasText: "Living situation or housing status" })
    .locator("input")
    .fill("On campus with one roommate");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page).toHaveURL(/\/student$/);

  const primaryNav = page.getByLabel("Primary navigation");
  await expect(primaryNav.getByRole("button", { name: "Student", exact: true })).toBeVisible();
  await expect(primaryNav.getByRole("button", { name: "Communication", exact: true })).toBeVisible();
  await expect(primaryNav.getByRole("button", { name: "Parent", exact: true })).toHaveCount(0);
  await expect(primaryNav.getByRole("button", { name: "Coach", exact: true })).toHaveCount(0);

  await ensureSidebarGroupExpanded(page, "Communication");
  await expect(page.getByRole("link", { name: "Messages & chat" })).toBeVisible();
  await page.getByRole("link", { name: "Messages & chat" }).click();
  await expect(page).toHaveURL(/\/communication/);
  await expect(page.getByRole("heading", { name: "Messages & chat" })).toBeVisible();

  await page.goto("/student");
  await expect(
    page.getByLabel("Detail workspace").getByText("MJ, track your target role", { exact: false })
  ).toBeVisible();

  await page.goto("/help");
  await expect(page.getByText("Update your profile and personalization")).toBeVisible();
  await expect(
    page.getByText("Open Messages & chat when you want chatbot guidance", { exact: false })
  ).toBeVisible();
});

test("student cannot open parent-only routes directly", async ({ page, openAs }) => {
  await openAs("studentMaya", "/parent");

  await expect(page.getByText("This page is for a different account view")).toBeVisible();
});

test("school search is visible by default and can be reopened with Change college", async ({
  page,
  openAs,
}) => {
  await openAs("studentLeo", "/onboarding/profile");
  await expect(page.getByRole("heading", { name: "Build your academic path" })).toBeVisible();

  const schoolSearch = page.getByPlaceholder("Start typing a school name");
  await expect(schoolSearch).toBeVisible();
  await schoolSearch.fill("synthetic");
  await page.getByRole("button", { name: "Synthetic State University" }).click();

  await expect(page.getByText("Selected institution")).toBeVisible();
  await expect(page.getByRole("button", { name: "Change college" })).toBeVisible();
  await expect(page.getByPlaceholder("Start typing a school name")).toHaveCount(0);

  await page.getByRole("button", { name: "Change college" }).click();
  await expect(page.getByPlaceholder("Start typing a school name")).toBeVisible();
});

test("dashboard shows missing curriculum alert and allows a population request", async ({ page, openAs }) => {
  await openAs("studentLeo", "/student?section=evidence");

  const curriculumSection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Degree Requirements Review" }) })
    .first();

  await expect(
    curriculumSection.locator("p").filter({
      hasText: "Degree requirements must be reviewed before scoring",
    })
  ).toBeVisible();
  await curriculumSection.getByRole("button", { name: "Ask the system to populate curriculum information" }).click();
  await expect(curriculumSection.getByText("Curriculum population has been requested", { exact: false })).toBeVisible();
  await expect(curriculumSection.getByRole("link", { name: "Upload a PDF of degree requirements" })).toBeVisible();
});

test("student can review curriculum details, save verification, and reach the PDF upload flow from the dashboard", async ({
  page,
  openAs,
}) => {
  await openAs("studentMaya", "/student?section=evidence");

  const curriculumSection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Degree Requirements Review" }) })
    .first();

  await expect(
    curriculumSection.locator("strong").filter({ hasText: /^Needs review$/ }).first()
  ).toBeVisible();
  await curriculumSection.getByRole("button", { name: "Review curriculum details" }).click();
  await expect(curriculumSection.getByText("Core courses")).toBeVisible();
  await expect(
    curriculumSection.getByRole("listitem").filter({ hasText: /^ECON 101\b/ }).first()
  ).toBeVisible();

  const uploadLink = curriculumSection.getByRole("link", { name: "Upload a PDF" });
  await expect(uploadLink).toBeVisible();
  await uploadLink.click();
  await expect(page).toHaveURL(/\/uploads\/catalog/);

  await page.goto("/student?section=evidence");
  const refreshedSection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Degree Requirements Review" }) })
    .first();
  await refreshedSection.getByLabel("I have visually inspected these degree requirements and confirm they look complete enough to use for scoring.").check();
  await refreshedSection.getByRole("button", { name: "Save curriculum verification" }).click();
  await expect(page).toHaveURL(/\/student\?section=evidence/);
  await expect(refreshedSection.locator("strong").filter({ hasText: /^Verified$/ })).toBeVisible();

  const scoreSection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Score details" }) })
    .first();
  await expect(scoreSection.getByText("Degree requirements must be reviewed before scoring", { exact: false })).toHaveCount(0);
});

test("happy-path synthetic student journey updates the outcome timeline and dashboard output", async ({
  page,
  openAs,
}) => {
  await openAs("studentMaya", "/onboarding/profile");
  await expect(page.getByRole("heading", { name: "Build your academic path" })).toBeVisible();

  await page.getByPlaceholder("What kind of role or trajectory are you aiming for?").fill(
    "I want to move toward business analyst internships with a fintech focus."
  );
  await page.getByRole("textbox", { name: "School name", exact: true }).fill("Northeastern University");
  await page.getByPlaceholder("Primary major").fill("Economics");
  await page
    .getByPlaceholder(
      "Add context that the structured catalog does not capture, such as unofficial plans, transfer details, pre-professional tracks, or advisor guidance."
    )
    .fill("Synthetic profile update for Playwright coverage.");
  await page.getByRole("button", { name: "Save academic path" }).click();
  await expect(page).toHaveURL(/\/student$/);

  await page.goto("/student?section=outcomes");
  await expect(page.getByRole("heading", { name: "Student dashboard" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Outcome tracking" })).toBeVisible();

  const outcomeSection = page.locator("section").filter({ has: page.getByRole("heading", { name: "Outcome tracking" }) }).first();
  await outcomeSection.locator("select").nth(0).selectOption("offer");
  await outcomeSection.locator("select").nth(1).selectOption("offer");
  await outcomeSection.getByPlaceholder("Pfizer").fill("Brightpath Capital");
  await outcomeSection.getByPlaceholder("Data Analyst Intern").fill("Strategy Intern");
  await outcomeSection.locator('input[type="date"]').fill("2026-04-24");
  await outcomeSection
    .getByPlaceholder("Short context that will still make sense later")
    .fill("Synthetic happy-path offer entry.");
  await page.getByRole("button", { name: "Report a new outcome" }).click();

  await expect(page).toHaveURL(/\/student\?section=outcomes/);
  await expect(page.getByText("Brightpath Capital")).toBeVisible();
  await expect(page.getByText("Offers received")).toBeVisible();
});
