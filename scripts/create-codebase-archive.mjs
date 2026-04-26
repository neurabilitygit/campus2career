import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const repoName = path.basename(repoRoot);
const exportsDir = path.join(repoRoot, "exports");

const requiredDirectories = [
  { relativePath: "apps/web/src", minFiles: 10 },
  { relativePath: "apps/api/src", minFiles: 10 },
  { relativePath: "packages/shared/src", minFiles: 3 },
  { relativePath: "packages/db/migrations", minFiles: 5 },
];

const requiredArchiveEntries = [
  "package.json",
  "README.md",
  "apps/web/src/app/layout.tsx",
  "apps/web/src/components/layout/navigation.ts",
  "apps/api/src/server.ts",
  "packages/shared/src/capabilities.ts",
];

const zipExcludes = [
  ".git/*",
  "node_modules/*",
  "apps/web/node_modules/*",
  "apps/api/node_modules/*",
  "apps/worker/node_modules/*",
  "apps/web/.next/*",
  "apps/web/.next-dev/*",
  "apps/web/.next-dev-e2e/*",
  "exports/*",
  "*.zip",
  ".DS_Store",
];

function countFilesRecursive(directoryPath) {
  let count = 0;
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      count += countFilesRecursive(absolutePath);
    } else if (entry.isFile()) {
      count += 1;
    }
  }
  return count;
}

function validateRequiredDirectories() {
  const results = [];
  for (const requirement of requiredDirectories) {
    const absolutePath = path.join(repoRoot, requirement.relativePath);
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isDirectory()) {
      throw new Error(`Required directory is missing: ${requirement.relativePath}`);
    }
    const fileCount = countFilesRecursive(absolutePath);
    if (fileCount < requirement.minFiles) {
      throw new Error(
        `Required directory looks incomplete: ${requirement.relativePath} has ${fileCount} files, expected at least ${requirement.minFiles}`
      );
    }
    results.push({ path: requirement.relativePath, fileCount });
  }
  return results;
}

function timestampLabel(date = new Date()) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${min}${ss}Z`;
}

function runOrThrow(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with code ${result.status}\n${result.stderr || result.stdout || ""}`.trim()
    );
  }

  return result.stdout || "";
}

function verifyArchive(archivePath) {
  const listing = runOrThrow("unzip", ["-l", archivePath]);
  for (const requiredEntry of requiredArchiveEntries) {
    if (!listing.includes(requiredEntry)) {
      throw new Error(`Archive verification failed: missing ${requiredEntry}`);
    }
  }
}

function ensureExportsDir() {
  fs.mkdirSync(exportsDir, { recursive: true });
}

function createArchive() {
  ensureExportsDir();
  const archiveBaseName = `${repoName}-source-${timestampLabel()}.zip`;
  const finalArchivePath = path.join(exportsDir, archiveBaseName);
  const tempArchivePath = path.join(os.tmpdir(), archiveBaseName);

  try {
    if (fs.existsSync(tempArchivePath)) {
      fs.unlinkSync(tempArchivePath);
    }

    const args = ["-rq", tempArchivePath, ".", "-x", ...zipExcludes];
    runOrThrow("zip", args);
    verifyArchive(tempArchivePath);
    fs.renameSync(tempArchivePath, finalArchivePath);
    return finalArchivePath;
  } finally {
    if (fs.existsSync(tempArchivePath)) {
      fs.unlinkSync(tempArchivePath);
    }
  }
}

function main() {
  const directoryChecks = validateRequiredDirectories();
  const archivePath = createArchive();

  console.log("Created verified source archive:");
  console.log(archivePath);
  console.log("");
  for (const result of directoryChecks) {
    console.log(`- ${result.path}: ${result.fileCount} files`);
  }
}

main();
