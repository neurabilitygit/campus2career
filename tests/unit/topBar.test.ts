import test from "node:test";
import assert from "node:assert/strict";
import { buildTopBarItems, getTopBarAttentionItems, MAX_TOP_BAR_ITEMS } from "../../apps/web/src/components/layout/topBar";

test("buildTopBarItems always includes workspace, help, and account", () => {
  const items = buildTopBarItems({
    role: "student",
    currentWorkspace: "Student dashboard",
    capabilities: ["view_student_dashboard"],
    helpHref: "/help",
  });

  assert.ok(items.some((item) => item.key === "workspace"));
  assert.ok(items.some((item) => item.key === "help"));
  assert.ok(items.some((item) => item.key === "account"));
});

test("communication shortcut appears only when the capability exists", () => {
  const withCapability = buildTopBarItems({
    role: "student",
    currentWorkspace: "Student dashboard",
    capabilities: ["view_communication"],
    communicationHref: "/communication",
  });
  const withoutCapability = buildTopBarItems({
    role: "student",
    currentWorkspace: "Student dashboard",
    capabilities: [],
    communicationHref: "/communication",
  });

  assert.ok(withCapability.some((item) => item.key === "communication"));
  assert.equal(withoutCapability.some((item) => item.key === "communication"), false);
});

test("active Career Goal chip appears only when a visible scenario exists", () => {
  const visibleScenario = buildTopBarItems({
    role: "student",
    currentWorkspace: "Student dashboard",
    capabilities: ["view_career_goals"],
    activeScenario: {
      scenarioName: "Software engineer intern",
      status: "complete",
    },
    activeScenarioHref: "/career-scenarios",
  });
  const missingScenario = buildTopBarItems({
    role: "student",
    currentWorkspace: "Student dashboard",
    capabilities: ["view_career_goals"],
    activeScenario: null,
    activeScenarioHref: "/career-scenarios",
  });
  const unauthorizedScenario = buildTopBarItems({
    role: "student",
    currentWorkspace: "Student dashboard",
    capabilities: [],
    activeScenario: {
      scenarioName: "Software engineer intern",
      status: "complete",
    },
    activeScenarioHref: "/career-scenarios",
  });

  assert.ok(visibleScenario.some((item) => item.key === "active-scenario"));
  assert.equal(missingScenario.some((item) => item.key === "active-scenario"), false);
  assert.equal(unauthorizedScenario.some((item) => item.key === "active-scenario"), false);
});

test("student context appears only when it is present and permitted", () => {
  const visibleStudent = buildTopBarItems({
    role: "parent",
    currentWorkspace: "Parent dashboard",
    capabilities: ["view_student_information"],
    selectedStudentName: "Maya Chen",
    selectedStudentHref: "/parent",
    canViewStudentContext: true,
  });
  const hiddenStudent = buildTopBarItems({
    role: "parent",
    currentWorkspace: "Parent dashboard",
    capabilities: ["view_student_information"],
    selectedStudentName: "Maya Chen",
    selectedStudentHref: "/parent",
    canViewStudentContext: false,
  });

  assert.ok(visibleStudent.some((item) => item.key === "student-context"));
  assert.equal(hiddenStudent.some((item) => item.key === "student-context"), false);
});

test("Needs Attention appears only when attention items exist", () => {
  const withAttention = buildTopBarItems({
    role: "student",
    currentWorkspace: "Student dashboard",
    attentionItems: [
      {
        key: "scenario-rerun",
        label: "The active Career Goal needs to be re-run",
        href: "/career-scenarios",
        priority: 80,
      },
    ],
  });
  const withoutAttention = buildTopBarItems({
    role: "student",
    currentWorkspace: "Student dashboard",
    attentionItems: [],
  });

  assert.ok(withAttention.some((item) => item.key === "needs-attention"));
  assert.equal(withoutAttention.some((item) => item.key === "needs-attention"), false);
});

test("top bar item builder stays within the intended max count", () => {
  const items = buildTopBarItems({
    role: "parent",
    currentWorkspace: "Parent dashboard",
    capabilities: ["view_career_goals", "view_communication", "view_student_information"],
    selectedStudentName: "Maya Chen",
    selectedStudentHref: "/parent",
    canViewStudentContext: true,
    activeScenario: {
      scenarioName: "Software engineer intern",
      status: "complete",
    },
    activeScenarioHref: "/career-scenarios",
    attentionItems: [
      {
        key: "curriculum",
        label: "Curriculum is present but still needs review",
        href: "/parent",
        priority: 95,
      },
    ],
    communicationHref: "/communication",
    helpHref: "/help",
  });

  assert.ok(items.length <= MAX_TOP_BAR_ITEMS);
});

test("attention helper returns only supported attention items", () => {
  const items = getTopBarAttentionItems({
    role: "student",
    accountStatus: "pending",
    curriculumStatus: "present_unverified",
    degreeRequirementsStatus: "needs_review",
    hasActiveScenario: false,
    pendingCommunicationPromptTitle: "How do you like reminders?",
  });

  assert.ok(items.some((item) => item.key === "curriculum"));
  assert.ok(items.some((item) => item.key === "academic-evidence"));
  assert.ok(items.some((item) => item.key === "scenario-missing"));
  assert.ok(items.some((item) => item.key === "profile-setup"));
  assert.ok(items.some((item) => item.key === "communication-prompt"));
});
