const cp = require("child_process");
const fs = require("fs");
const path = require("path");

const logFile = path.join(__dirname, "../server_boot.log");
// Reset the log file
fs.writeFileSync(logFile, "");

const out = fs.openSync(logFile, "a");
const err = fs.openSync(logFile, "a");

console.log("🚀 Spawning npx tsx src/server.ts...");
const child = cp.spawn("npx", ["tsx", "src/server.ts"], {
  detached: true,
  stdio: ["ignore", out, err],
  cwd: __dirname
});

child.unref();
console.log("✅ Server spawned with PID:", child.pid);
process.exit(0);
