import { config } from "dotenv";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
config({ quiet: true });
const rootUrl = new URL(process.env.DATABASE_URL);
const target = new URL(rootUrl);
target.pathname = "/autoblog_test";
const db = new PrismaClient({ datasourceUrl: rootUrl.href });
try {
  const exists =
    await db.$queryRaw`SELECT 1 FROM pg_database WHERE datname = 'autoblog_test'`;
  if (!exists.length)
    await db.$executeRawUnsafe("CREATE DATABASE autoblog_test");
} finally {
  await db.$disconnect();
}
const taskEnv = { ...process.env, DATABASE_URL: target.href };
let r = spawnSync(
  process.execPath,
  [
    "node_modules/prisma/build/index.js",
    "migrate",
    "deploy",
    "--schema",
    "backend/prisma/schema.prisma",
  ],
  { stdio: "inherit", env: taskEnv },
);
if (r.status !== 0) process.exit(r.status || 1);
r = spawnSync(
  process.execPath,
  [
    "--experimental-vm-modules",
    "../node_modules/jest/bin/jest.js",
    "--runInBand",
    "--config",
    "jest.integration.cjs",
  ],
  { cwd: "backend", stdio: "inherit", env: taskEnv },
);
process.exit(r.status || 0);
