import { readFile, writeFile, access } from "node:fs/promises";
import { randomBytes } from "node:crypto";
try {
  await access(".env");
  console.log(".env already exists; preserving local configuration.");
} catch {
  const template = await readFile(".env.example", "utf8");
  await writeFile(
    ".env",
    template
      .replace(
        "SESSION_SECRET=",
        "SESSION_SECRET=" + randomBytes(48).toString("hex"),
      )
      .replace(
        "TOKEN_ENCRYPTION_KEY=",
        "TOKEN_ENCRYPTION_KEY=" + randomBytes(32).toString("hex"),
      )
      .replace(
        "OWNER_PASSWORD=",
        "OWNER_PASSWORD=" + randomBytes(18).toString("base64url"),
      ),
  );
  console.log(
    "Created .env with unique local secrets. Read OWNER_PASSWORD locally to sign in; do not share it.",
  );
}
