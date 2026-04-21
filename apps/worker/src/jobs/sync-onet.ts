import fs from "node:fs";
import path from "node:path";
import { TARGET_ROLE_SEEDS } from "../../../../packages/shared/src/market/targetRoleSeeds";
import {
  inferBandFromImportance,
  inferSkillCategory,
} from "../../../api/src/services/market/normalizers";
import {
  persistNormalizedOccupation,
  replaceNormalizedSkillsForOccupation,
} from "../../../api/src/services/market/persistence";

type TabRow = Record<string, string>;

interface OnetOccupationRow {
  onetSocCode: string;
  title: string;
  description: string;
  alternateTitles: string[];
  jobZone?: number;
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function splitTabLine(line: string): string[] {
  return line.split("\t").map((part) => part.replace(/\r$/, ""));
}

function readTabDelimitedFile(filePath: string): TabRow[] {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const lines = raw.split("\n").filter((line) => line.trim().length > 0);
  const header = splitTabLine(lines[0] || "");

  return lines.slice(1).map((line) => {
    const values = splitTabLine(line);
    const row: TabRow = {};
    for (let index = 0; index < header.length; index += 1) {
      row[header[index]] = values[index] || "";
    }
    return row;
  });
}

function resolveOnetDatabaseDir(): string {
  const dir = process.env.ONET_DATABASE_DIR;
  if (!dir) {
    throw new Error("ONET_DATABASE_DIR is required and must point to an extracted O*NET text download directory");
  }

  const resolved = path.resolve(dir);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    throw new Error(`ONET_DATABASE_DIR does not exist or is not a directory: ${resolved}`);
  }

  return resolved;
}

function resolveFilePath(baseDir: string, fileName: string): string {
  const exact = path.join(baseDir, fileName);
  if (fs.existsSync(exact)) {
    return exact;
  }

  const normalizedTarget = normalizeText(fileName);
  const entries = fs.readdirSync(baseDir);
  const matched = entries.find((entry) => normalizeText(entry) === normalizedTarget);
  if (!matched) {
    throw new Error(`Required O*NET file not found in ${baseDir}: ${fileName}`);
  }

  return path.join(baseDir, matched);
}

function buildOccupationIndex(baseDir: string) {
  const occupationRows = readTabDelimitedFile(resolveFilePath(baseDir, "Occupation Data.txt"));
  const alternateTitleRows = readTabDelimitedFile(resolveFilePath(baseDir, "Alternate Titles.txt"));
  const jobZoneRows = readTabDelimitedFile(resolveFilePath(baseDir, "Job Zones.txt"));

  const alternateTitlesByCode = new Map<string, string[]>();
  for (const row of alternateTitleRows) {
    const code = row["O*NET-SOC Code"];
    const alternateTitle = row["Alternate Title"] || row["Short Title"];
    if (!code || !alternateTitle) continue;
    const existing = alternateTitlesByCode.get(code) || [];
    existing.push(alternateTitle);
    alternateTitlesByCode.set(code, existing);
  }

  const jobZoneByCode = new Map<string, number>();
  for (const row of jobZoneRows) {
    const code = row["O*NET-SOC Code"];
    const jobZone = Number(row["Job Zone"]);
    if (!code || !Number.isFinite(jobZone)) continue;
    jobZoneByCode.set(code, jobZone);
  }

  return occupationRows.map((row) => ({
    onetSocCode: row["O*NET-SOC Code"],
    title: row["Title"],
    description: row["Description"],
    alternateTitles: alternateTitlesByCode.get(row["O*NET-SOC Code"]) || [],
    jobZone: jobZoneByCode.get(row["O*NET-SOC Code"]),
  })) satisfies OnetOccupationRow[];
}

function buildOccupationByCodeIndex(occupations: OnetOccupationRow[]) {
  return new Map(occupations.map((occupation) => [occupation.onetSocCode, occupation]));
}

function computeMatchScore(seedTerms: string[], occupation: OnetOccupationRow): number {
  const titleNorm = normalizeText(occupation.title);
  const aliasesNorm = occupation.alternateTitles.map(normalizeText);

  let bestScore = 0;

  for (const rawTerm of seedTerms) {
    const term = normalizeText(rawTerm);
    if (!term) continue;

    if (titleNorm === term) {
      bestScore = Math.max(bestScore, 300);
    } else if (aliasesNorm.includes(term)) {
      bestScore = Math.max(bestScore, 260);
    } else if (titleNorm.includes(term)) {
      bestScore = Math.max(bestScore, 220);
    } else if (aliasesNorm.some((alias) => alias.includes(term))) {
      bestScore = Math.max(bestScore, 200);
    } else {
      const termTokens = term.split(" ");
      const overlappingTitleTokens = termTokens.filter((token) => titleNorm.includes(token)).length;
      const overlappingAliasTokens = termTokens.filter((token) =>
        aliasesNorm.some((alias) => alias.includes(token))
      ).length;
      bestScore = Math.max(bestScore, overlappingTitleTokens * 20, overlappingAliasTokens * 15);
    }
  }

  return bestScore;
}

function chooseBestOccupation(
  seed: (typeof TARGET_ROLE_SEEDS)[number],
  occupations: OnetOccupationRow[],
  skillCountsByCode: Map<string, number>
) {
  const occupationByCode = buildOccupationByCodeIndex(occupations);

  if (seed.overrideOnetSocCode) {
    const overridden = occupationByCode.get(seed.overrideOnetSocCode);
    if (overridden) {
      return overridden;
    }
  }

  const searchTerms = [
    seed.canonicalName,
    ...seed.onetSearchTerms,
    ...seed.typicalEntryTitles,
  ];

  const ranked = occupations
    .map((occupation) => ({
      occupation,
      score: (() => {
        let score = computeMatchScore(searchTerms, occupation);
        const skillCount = skillCountsByCode.get(occupation.onetSocCode) || 0;

        if (seed.preferredOnetSocCodes?.includes(occupation.onetSocCode)) {
          score += 500;
        }

        if (skillCount > 0) {
          score += Math.min(skillCount, 40);
        } else {
          score -= 300;
        }

        return score;
      })(),
    }))
    .filter((item) => item.score > -250)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.occupation || null;
}

function normalizeImportanceToPercent(dataValue: number): number {
  return Math.max(0, Math.min(100, ((dataValue - 1) / 4) * 100));
}

function loadSkillRowsByCode(baseDir: string): Map<string, TabRow[]> {
  const rows = readTabDelimitedFile(resolveFilePath(baseDir, "Skills.txt"));
  const byCode = new Map<string, TabRow[]>();

  for (const row of rows) {
    const code = row["O*NET-SOC Code"];
    if (!code) continue;
    const existing = byCode.get(code) || [];
    existing.push(row);
    byCode.set(code, existing);
  }

  return byCode;
}

function countRelevantImportanceRows(skillRowsByCode: Map<string, TabRow[]>): Map<string, number> {
  const counts = new Map<string, number>();

  for (const [code, rows] of skillRowsByCode.entries()) {
    const count = rows.filter((row) => {
      if ((row["Scale ID"] || "").trim() !== "IM") return false;
      if ((row["Not Relevant"] || "").trim() === "Y") return false;
      if ((row["Recommend Suppress"] || "").trim() === "Y") return false;
      return Number.isFinite(Number(row["Data Value"]));
    }).length;

    counts.set(code, count);
  }

  return counts;
}

export async function syncOnet() {
  console.log("Starting O*NET sync from local database files...");

  const baseDir = resolveOnetDatabaseDir();
  const occupations = buildOccupationIndex(baseDir);
  const skillRowsByCode = loadSkillRowsByCode(baseDir);
  const skillCountsByCode = countRelevantImportanceRows(skillRowsByCode);

  for (const seed of TARGET_ROLE_SEEDS) {
    try {
      const matched = chooseBestOccupation(seed, occupations, skillCountsByCode);

      if (!matched) {
        console.warn(`No O*NET database occupation match found for ${seed.canonicalName}`);
        continue;
      }

      await persistNormalizedOccupation({
        canonicalName: seed.canonicalName,
        onetCode: matched.onetSocCode,
        title: matched.title,
        description: matched.description || `Resolved from O*NET database for ${seed.canonicalName}`,
        jobZone: matched.jobZone,
        source: "onet",
      });

      const skillRows = skillRowsByCode.get(matched.onetSocCode) || [];
      const bestSkillByName = new Map<
        string,
        {
          skillName: string;
          importanceScore: number;
        }
      >();

      for (const row of skillRows) {
        if ((row["Scale ID"] || "").trim() !== "IM") continue;
        if ((row["Not Relevant"] || "").trim() === "Y") continue;
        if ((row["Recommend Suppress"] || "").trim() === "Y") continue;

        const skillName = (row["Element Name"] || "").trim();
        const dataValue = Number(row["Data Value"]);
        if (!skillName || !Number.isFinite(dataValue)) continue;

        const importanceScore = normalizeImportanceToPercent(dataValue);
        const existing = bestSkillByName.get(skillName.toLowerCase());

        if (!existing || importanceScore > existing.importanceScore) {
          bestSkillByName.set(skillName.toLowerCase(), {
            skillName,
            importanceScore,
          });
        }
      }

      const rankedSkills = Array.from(bestSkillByName.values())
        .sort((a, b) => b.importanceScore - a.importanceScore)
        .slice(0, 20);

      if (rankedSkills.length > 0) {
        await replaceNormalizedSkillsForOccupation(
          seed.canonicalName,
          rankedSkills.map((skill) => ({
            occupationCanonicalName: seed.canonicalName,
            skillName: skill.skillName,
            skillCategory: inferSkillCategory(skill.skillName),
            importanceScore: skill.importanceScore,
            requiredProficiencyBand: inferBandFromImportance(skill.importanceScore),
            evidenceSource: "onet_database",
          }))
        );
      } else {
        console.warn(
          `No usable O*NET skill rows found for ${seed.canonicalName} (${matched.onetSocCode}); preserving existing seeded skill requirements`
        );
      }

      console.log(
        `Synced O*NET database occupation ${matched.onetSocCode} for ${seed.canonicalName} with ${rankedSkills.length} skills`
      );
    } catch (error) {
      console.error(`O*NET database sync failed for ${seed.canonicalName}`, error);
    }
  }

  console.log("O*NET database sync complete.");
}
