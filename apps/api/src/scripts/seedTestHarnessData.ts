import * as seedModule from "../../../../tests/fixtures/seedSyntheticData";

const seedAndCloseSyntheticTestData =
  (seedModule as any).seedAndCloseSyntheticTestData ||
  (seedModule as any).default?.seedAndCloseSyntheticTestData;

if (typeof seedAndCloseSyntheticTestData !== "function") {
  throw new Error("seedAndCloseSyntheticTestData export was not found");
}

seedAndCloseSyntheticTestData().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
