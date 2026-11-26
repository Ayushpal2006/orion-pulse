#!/usr/bin/env node
/**
 * Unified local runner for Apka Bill / Orion POS.
 * Usage:
 *   node scripts/run-local.mjs dev          # Ensure local Postgres + run backend (:8080) & frontend (:8081)
 *   node scripts/run-local.mjs dev:backend  # Ensure local Postgres + run backend (:8080)
 *   node scripts/run-local.mjs start        # Ensure local Postgres (when local) + run built backend
 *   node scripts/run-local.mjs ensure-db    # Ensure local Postgres only
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");

function readBackendDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim();
  const envPath = path.join(ROOT_DIR, "backend", ".env");
  if (!fs.existsSync(envPath)) return "postgresql://postgres:postgres@localhost:5432/orion";
  const raw = fs.readFileSync(envPath, "utf8");
  const match = raw.match(/^\s*DATABASE_URL=(.+)$/m);
  return match ? match[1].trim().replace(/^['"]|['"]$/g, "") : "postgresql://postgres:postgres@localhost:5432/orion";
}

function isLocalDatabaseUrl(dbUrl) {
  return /@(localhost|127\.0\.0\.1)(:|\/)/i.test(dbUrl) || /\/\/(localhost|127\.0\.0\.1)(:|\/)/i.test(dbUrl);
}

function commandExists(cmd) {
  try {
    execFileSync("which", [cmd], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function canQueryOrionDb() {
  if (!commandExists("psql")) return false;
  try {
    execFileSync("psql", ["-h", "localhost", "-U", "postgres", "-d", "orion", "-Atc", "select 1"], {
      stdio: "ignore",
      timeout: 3000,
    });
    return true;
  } catch {
    return false;
  }
}

function isPortOpen() {
  if (!commandExists("pg_isready")) return false;
  try {
    execFileSync("pg_isready", ["-h", "localhost", "-p", "5432"], {
      stdio: "ignore",
      timeout: 2000,
    });
    return true;
  } catch {
    return false;
  }
}

function getInstalledBrewFormulas() {
  if (!commandExists("brew")) return new Set();
  try {
    const out = execFileSync("brew", ["list", "--formula", "-1"], {
      encoding: "utf8",
      timeout: 5000,
    });
    return new Set(out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean));
  } catch {
    return new Set();
  }
}

function runBrewService(action, formula) {
  try {
    execFileSync("brew", ["services", action, formula], {
      stdio: "inherit",
      timeout: 15000,
    });
    return true;
  } catch {
    return false;
  }
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDatabase(maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    if (canQueryOrionDb() || (!commandExists("psql") && isPortOpen())) {
      return true;
    }
    await sleep(500);
  }
  return false;
}

export async function ensureLocalPostgres() {
  const dbUrl = readBackendDatabaseUrl();
  if (!isLocalDatabaseUrl(dbUrl)) {
    console.log("[db] External PostgreSQL configured — skipping local Homebrew start.");
    return;
  }

  if (canQueryOrionDb()) {
    console.log("[db] Local PostgreSQL ('orion') is ready on localhost:5432.");
    return;
  }

  if (!commandExists("brew")) {
    if (isPortOpen()) {
      console.log("[db] PostgreSQL is accepting connections on localhost:5432.");
      return;
    }
    console.warn("[db] Homebrew not found and localhost:5432 is not responding; continuing anyway.");
    return;
  }

  const formulas = getInstalledBrewFormulas();
  const has18 = formulas.has("postgresql@18");
  const has17 = formulas.has("postgresql@17");

  // Local `orion` database with user `postgres` lives in postgresql@18 (see scripts/dev-local.sh).
  // If postgresql@17 grabbed port 5432 without the `orion` DB, switch to postgresql@18 cleanly.
  if (has18) {
    if (isPortOpen() && has17) {
      console.log("[db] Port 5432 is busy without 'orion' DB; switching postgresql@17 -> postgresql@18...");
      runBrewService("stop", "postgresql@17");
      await sleep(800);
    }
    console.log("[db] Starting Homebrew postgresql@18...");
    runBrewService("start", "postgresql@18");
    if (await waitForDatabase()) {
      console.log("[db] Local PostgreSQL (postgresql@18) ready on localhost:5432.");
      return;
    }
  }

  if (has17) {
    console.log("[db] Starting Homebrew postgresql@17...");
    runBrewService("start", "postgresql@17");
    if (await waitForDatabase()) {
      console.log("[db] Local PostgreSQL (postgresql@17) ready on localhost:5432.");
      return;
    }
  }

  console.warn("[db] Could not verify 'orion' on localhost:5432; backend will still attempt connection.");
}

function spawnPrefixed(name, cmd, args) {
  const npmCmd = process.platform === "win32" ? `${cmd}.cmd` : cmd;
  const child = spawn(npmCmd, args, {
    cwd: ROOT_DIR,
    stdio: ["inherit", "pipe", "pipe"],
    env: process.env,
  });

  const prefixStream = (stream, target) => {
    let buffer = "";
    stream.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        target.write(`[${name}] ${line}\n`);
      }
    });
    stream.on("end", () => {
      if (buffer.length > 0) {
        target.write(`[${name}] ${buffer}\n`);
      }
    });
  };

  prefixStream(child.stdout, process.stdout);
  prefixStream(child.stderr, process.stderr);
  return child;
}

async function runMode(mode) {
  await ensureLocalPostgres();

  if (mode === "ensure-db") {
    return;
  }

  if (mode === "dev:backend") {
    const backend = spawnPrefixed("backend", "npm", ["run", "dev", "--workspace=backend"]);
    process.on("SIGINT", () => backend.kill("SIGINT"));
    process.on("SIGTERM", () => backend.kill("SIGTERM"));
    backend.on("exit", (code) => process.exit(code ?? 0));
    return;
  }

  if (mode === "start") {
    const distServer = path.join(ROOT_DIR, "backend", "dist", "server.js");
    if (!fs.existsSync(distServer)) {
      console.log("[build] backend/dist/server.js not found — building backend first...");
      execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build:backend"], {
        cwd: ROOT_DIR,
        stdio: "inherit",
      });
    }
    const backend = spawnPrefixed("backend", "npm", ["run", "start", "--workspace=backend"]);
    process.on("SIGINT", () => backend.kill("SIGINT"));
    process.on("SIGTERM", () => backend.kill("SIGTERM"));
    backend.on("exit", (code) => process.exit(code ?? 0));
    return;
  }

  if (mode === "dev") {
    console.log("🚀 Starting Apka Bill Local Stack:");
    console.log("   • Backend API:  http://localhost:8080");
    console.log("   • Frontend Web: http://localhost:8081");
    console.log("   Press Ctrl+C to stop both.\n");

    const backend = spawnPrefixed("backend", "npm", ["run", "dev", "--workspace=backend"]);
    const frontend = spawnPrefixed("frontend", "npm", ["run", "dev", "--workspace=tanstack_start_ts"]);

    let shuttingDown = false;
    const shutdown = (exitCode = 0) => {
      if (shuttingDown) return;
      shuttingDown = true;
      for (const proc of [backend, frontend]) {
        if (!proc.killed) proc.kill("SIGTERM");
      }
      setTimeout(() => process.exit(exitCode), 300);
    };

    process.on("SIGINT", () => shutdown(0));
    process.on("SIGTERM", () => shutdown(0));

    backend.on("exit", (code) => {
      if (!shuttingDown) {
        console.error(`[backend] exited with code ${code ?? 0}`);
        shutdown(code ?? 1);
      }
    });
    frontend.on("exit", (code) => {
      if (!shuttingDown) {
        console.error(`[frontend] exited with code ${code ?? 0}`);
        shutdown(code ?? 1);
      }
    });
    return;
  }

  console.error(`Unknown mode: ${mode}`);
  process.exit(1);
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const mode = process.argv[2] || "dev";
  runMode(mode).catch((err) => {
    console.error("[run-local] Failed:", err?.message || err);
    process.exit(1);
  });
}

