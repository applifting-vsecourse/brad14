import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { Client } from "pg";

const backendDir = fileURLToPath(new URL("..", import.meta.url));
config({ path: `${backendDir}/.env`, quiet: true });

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must point to the local Docker Postgres instance",
  );
}

const sourceUrl = new URL(process.env.DATABASE_URL);
if (
  !["localhost", "127.0.0.1", "[::1]"].includes(sourceUrl.hostname) ||
  sourceUrl.port !== "5433" ||
  sourceUrl.pathname !== "/quacker"
) {
  throw new Error(
    "Integration tests require the local quacker Docker database as the admin connection",
  );
}
const databaseUrl = new URL(sourceUrl);
databaseUrl.pathname = "/quacker_test";
process.env.DATABASE_URL = databaseUrl.toString();

const adminUrl = new URL(sourceUrl);
const client = new Client({ connectionString: adminUrl.toString() });
await client.connect();
try {
  const exists = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    ["quacker_test"],
  );
  if (exists.rowCount === 0) {
    await client.query("CREATE DATABASE quacker_test");
  }
} finally {
  await client.end();
}

for (const args of [
  ["exec", "prisma", "migrate", "deploy"],
  [
    "exec",
    "jest",
    "--config",
    "jest.int.config.cjs",
    "--runInBand",
    "--testRegex=\\.int-spec\\.ts$",
  ],
]) {
  const result = spawnSync("pnpm", args, {
    cwd: backendDir,
    env: {
      ...process.env,
      NODE_OPTIONS: [process.env.NODE_OPTIONS, "--experimental-vm-modules"]
        .filter(Boolean)
        .join(" "),
    },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
