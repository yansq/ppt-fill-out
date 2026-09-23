import { spawn } from "node:child_process";
import { createWriteStream, readFileSync, statSync, unlinkSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const out = process.argv[2];
if (!out) throw new Error("Usage: node docker/intranet/export-local.mjs OUTPUT_DIRECTORY");
const envLine = readFileSync(resolve(root, "apps/web/.env.local"), "utf8").split(/\r?\n/).find((line) => line.startsWith("DATABASE_URL="));
if (!envLine) throw new Error("DATABASE_URL missing from apps/web/.env.local");
const url = new URL(envLine.slice("DATABASE_URL=".length).replace(/^['"]|['"]$/g, ""));
const password = decodeURIComponent(url.password);
const mysqlArgs = [
  "run", "--rm", "--platform", "linux/amd64", "--add-host", "host.docker.internal:host-gateway",
  "--env", "MYSQL_PWD", "mysql:8.0.27", "mysqldump",
  "--host=host.docker.internal", `--port=${url.port || "3306"}`, `--user=${decodeURIComponent(url.username)}`,
  "--single-transaction", "--set-gtid-purged=OFF", "--default-character-set=utf8mb4",
  "--routines", "--triggers", "--events", "--hex-blob", "--databases", "report_platform", "report_metrics_demo"
];
const sqlPath = resolve(out, "mysql-test-data.sql.gz");
const child = spawn("docker", mysqlArgs, { env: { ...process.env, MYSQL_PWD: password }, stdio: ["ignore", "pipe", "pipe"] });
const childExit = new Promise((done) => child.on("close", done));
let stderr = "";
child.stderr.on("data", (chunk) => { stderr += chunk; });
await pipeline(child.stdout, createGzip({ level: 9 }), createWriteStream(sqlPath, { mode: 0o600 }));
const exitCode = await childExit;
if (exitCode !== 0) {
  unlinkSync(sqlPath);
  throw new Error(`mysqldump failed: ${stderr.replace(/password[^\n]*/gi, "password [redacted]")}`);
}

const tarPath = resolve(out, "report-data.tar.gz");
const tar = spawn("tar", ["-czf", tarPath, "-C", resolve(root, "data"), "templates", "previews", "generated"], { stdio: "inherit" });
const tarExit = await new Promise((done) => tar.on("close", done));
if (tarExit !== 0) throw new Error("File archive failed");
console.log(`Exported SQL ${statSync(sqlPath).size} bytes and files ${statSync(tarPath).size} bytes`);
