import { createCipheriv, randomBytes } from "node:crypto";

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const host = required("METRIC_DB_HOST");
const port = Number(required("METRIC_DB_PORT"));
const username = required("METRIC_DB_USER");
const password = required("METRIC_DB_PASSWORD");
const key = Buffer.from(required("ENCRYPTION_KEY"), "base64");
if (key.length !== 32 || key.toString("base64") !== process.env.ENCRYPTION_KEY) throw new Error("Invalid ENCRYPTION_KEY");
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid METRIC_DB_PORT");
if (host.length > 255 || username.length > 191) throw new Error("Metric source field is too long");

const iv = randomBytes(12);
const cipher = createCipheriv("aes-256-gcm", key, iv);
cipher.setAAD(Buffer.from("v1"));
const encrypted = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
const payload = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
const sqlString = (value) => `CONVERT(0x${Buffer.from(value, "utf8").toString("hex")} USING utf8mb4)`;

process.stdout.write(`UPDATE report_platform.DataSource SET host=${sqlString(host)}, port=${port}, username=${sqlString(username)}, encryptedPassword=${sqlString(payload)}, encryptionKeyVersion='v1' WHERE databaseName='report_metrics_demo';\n`);
