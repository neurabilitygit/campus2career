import test from "node:test";
import assert from "node:assert/strict";
import {
  CAPABILITY_CATALOG,
  capabilityAppliesToPersona,
  expandCapabilitiesWithDependencies,
  getPersonaDefaultCapabilities,
  validateCapabilityCatalog,
} from "../../packages/shared/src/capabilities";

test("capability catalog dependencies are internally valid", () => {
  assert.doesNotThrow(() => validateCapabilityCatalog());
});

test("persona defaults include required dependencies", () => {
  for (const capability of getPersonaDefaultCapabilities("coach")) {
    const expanded = expandCapabilitiesWithDependencies([capability]);
    for (const dependency of CAPABILITY_CATALOG.find((item) => item.key === capability)?.dependencies || []) {
      assert.ok(expanded.includes(dependency));
    }
  }
});

test("capabilities only apply to the personas declared in the catalog", () => {
  assert.equal(capabilityAppliesToPersona("invite_student", "parent"), true);
  assert.equal(capabilityAppliesToPersona("invite_student", "student"), false);
  assert.equal(capabilityAppliesToPersona("manage_system_settings", "admin"), true);
});
