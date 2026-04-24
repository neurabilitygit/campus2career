import { test as base, expect, type Page } from "@playwright/test";
import { DEMO_AUTH_STORAGE_KEY } from "../../apps/web/src/lib/demoAuth";
import { makeDemoAuthState } from "../synthetic/factories";
import { SYNTHETIC_SCENARIOS, type SyntheticUser } from "../synthetic/scenarios";

type UserKey = Parameters<typeof makeDemoAuthState>[0];

async function writeDemoAuth(page: Page, userKey: UserKey) {
  const state = makeDemoAuthState(userKey);
  await page.evaluate(
    ({ key, value }) => {
      window.localStorage.setItem(key, value);
    },
    {
      key: DEMO_AUTH_STORAGE_KEY,
      value: JSON.stringify(state),
    }
  );
}

export const test = base.extend<{
  openAs: (userKey: UserKey, url: string) => Promise<void>;
  switchAs: (userKey: UserKey, url: string) => Promise<void>;
}>({
  openAs: async ({ page }, use) => {
    await use(async (userKey, url) => {
      await page.goto("/");
      await writeDemoAuth(page, userKey);
      await page.goto(url);
    });
  },
  switchAs: async ({ page }, use) => {
    await use(async (userKey, url) => {
      await writeDemoAuth(page, userKey);
      await page.goto(url);
    });
  },
});

export { expect, SYNTHETIC_SCENARIOS };
