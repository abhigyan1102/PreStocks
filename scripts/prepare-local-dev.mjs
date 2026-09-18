import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const documents = join(homedir(), "Documents");

// Cloud-backed Documents folders can evict package files while Next is running.
if (process.platform !== "darwin" || !project.startsWith(`${documents}/`)) {
  process.exit(0);
}

const projectId = createHash("sha256").update(project).digest("hex").slice(0, 12);
const cache = join(homedir(), "Library", "Caches", "PreStocksGuardian", projectId);
const deps = join(cache, "dependencies");
const lockfile = join(project, "package-lock.json");
const lockHash = createHash("sha256").update(readFileSync(lockfile)).digest("hex");
const marker = join(deps, ".installed-lock-hash");
const cachedModules = join(deps, "node_modules");

mkdirSync(deps, { recursive: true });
if (!existsSync(marker) || readFileSync(marker, "utf8") !== lockHash || !existsSync(cachedModules)) {
  copyFileSync(join(project, "package.json"), join(deps, "package.json"));
  copyFileSync(lockfile, join(deps, "package-lock.json"));
  console.log("Installing dependencies in local macOS cache...");
  execFileSync("npm", ["ci", "--no-audit", "--no-fund"], { cwd: deps, stdio: "inherit" });
  writeFileSync(marker, lockHash);
}

function linkGeneratedDirectory(name, destination) {
  const source = join(project, name);
  mkdirSync(destination, { recursive: true });
  if (existsSync(source) && lstatSync(source).isSymbolicLink() && readlinkSync(source) === destination) return;

  const backup = `${source}.previous-${process.pid}`;
  if (existsSync(source)) renameSync(source, backup);
  try {
    symlinkSync(destination, source, "dir");
  } catch (error) {
    if (existsSync(backup)) renameSync(backup, source);
    throw error;
  }
  if (existsSync(backup)) rmSync(backup, { recursive: true, force: true });
}

linkGeneratedDirectory("node_modules", cachedModules);
// Generated routes execute from the cache, so Node must find packages in an ancestor.
const cacheModules = join(cache, "node_modules");
if (!existsSync(cacheModules)) symlinkSync(cachedModules, cacheModules, "dir");
linkGeneratedDirectory(".next", join(cache, "next-output"));
