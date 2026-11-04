import { config } from "dotenv";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: resolve(root, ".env"), quiet: true });
const r = spawnSync(
  process.execPath,
  [
    resolve(root, "node_modules/prisma/build/index.js"),
    ...process.argv.slice(2),
    "--schema",
    resolve(root, "backend/prisma/schema.prisma"),
  ],
  { cwd: root, env: process.env, stdio: "inherit" },
);
process.exit(r.status || 0);
