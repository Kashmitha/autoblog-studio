import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { spawnSync } from "node:child_process";
config({ quiet: true });
const name = "autoblog_restore_" + Date.now();
if (!/^autoblog_restore_[0-9]+$/.test(name))
  throw new Error("Invalid isolated restore database name.");
const admin = new PrismaClient();
try {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
} finally {
  await admin.$disconnect();
}
const result = spawnSync(
  "docker",
  [
    "compose",
    "exec",
    "-T",
    "postgres",
    "sh",
    "-c",
    'pg_restore -U "$POSTGRES_USER" -d "$1" --no-owner --no-privileges /tmp/autoblog-backup.dump',
    "--",
    name,
  ],
  { stdio: "inherit" },
);
if (result.status !== 0)
  throw new Error("Restore failed; inspect the isolated restore database.");
const url = new URL(process.env.DATABASE_URL);
url.pathname = "/" + name;
const restored = new PrismaClient({ datasourceUrl: url.href });
try {
  const owners = await restored.user.count(),
    settings = await restored.automationSettings.count();
  if (!owners || !settings)
    throw new Error("Restored owner/settings verification failed.");
  console.log(
    JSON.stringify({
      restore: "passed",
      database: name,
      owners,
      settings,
      articles: await restored.article.count(),
    }),
  );
} finally {
  await restored.$disconnect();
}
