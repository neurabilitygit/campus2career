import fs from "node:fs";
import path from "node:path";
import { normalizeOnetSearchResultToOccupation, normalizeOnetDetailsToSkillRequirements } from "./onetParsers";
import { normalizeBlsSeriesToMarketSignal } from "./blsParsers";

export function validateFixtures() {
  const dir = path.resolve(process.cwd(), "src/services/market/fixtures");

  const onetSearch = JSON.parse(fs.readFileSync(path.join(dir, "onet-search.sample.json"), "utf8"));
  const onetDetails = JSON.parse(fs.readFileSync(path.join(dir, "onet-details.sample.json"), "utf8"));
  const blsLatest = JSON.parse(fs.readFileSync(path.join(dir, "bls-latest.sample.json"), "utf8"));

  const occ = normalizeOnetSearchResultToOccupation(onetSearch, "financial analyst");
  const skills = normalizeOnetDetailsToSkillRequirements(onetDetails, "financial analyst");
  const signal = normalizeBlsSeriesToMarketSignal({
    raw: blsLatest,
    sourceName: "BLS:LNS14000000:March",
    signalType: "unemployment_pressure",
    occupationCanonicalName: "macro",
  });

  return { occ, skills, signal };
}
