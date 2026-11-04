import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";
config({ quiet: true });
const password = process.env.OWNER_PASSWORD,
  email = process.env.OWNER_EMAIL;
if (!email || !password || password.length < 12)
  throw new Error(
    "Set OWNER_EMAIL and a unique OWNER_PASSWORD (at least 12 characters) in local .env first.",
  );
const salt = randomBytes(16).toString("hex");
const db = new PrismaClient();
try {
  const owner = await db.user.findUniqueOrThrow({
    where: { email: email.toLowerCase() },
  });
  await db.$transaction([
    db.user.update({
      where: { id: owner.id },
      data: {
        passwordHash:
          salt + ":" + scryptSync(password, salt, 64).toString("hex"),
      },
    }),
    db.session.deleteMany({ where: { userId: owner.id } }),
  ]);
  console.log("Owner password updated. Previous sessions revoked.");
} finally {
  await db.$disconnect();
}
