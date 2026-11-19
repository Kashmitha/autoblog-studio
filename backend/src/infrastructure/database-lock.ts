import { ConflictException } from "@nestjs/common";
import type { Prisma, PrismaClient } from "@prisma/client";

/** Wait outside the connection pool; never retry work after it starts. */
export async function withDatabaseLock<T>(
  db: PrismaClient,
  key: number,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
  options: { timeout: number; maxWait: number },
): Promise<T> {
  const deadline = Date.now() + options.maxWait;
  do {
    const result = await db.$transaction(
      async (tx) => {
        const [lock] = await tx.$queryRaw<
          { acquired: boolean }[]
        >`SELECT pg_try_advisory_xact_lock(${key}::bigint) AS acquired`;
        if (!lock.acquired) return { acquired: false as const };
        return { acquired: true as const, value: await work(tx) };
      },
      {
        timeout: options.timeout,
        maxWait: Math.max(1, Math.min(1000, deadline - Date.now())),
      },
    );
    if (result.acquired) return result.value;
    if (Date.now() >= deadline) break;
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(75, deadline - Date.now())),
    );
  } while (Date.now() < deadline);
  throw new ConflictException(
    "Another operation is still running. Refresh its status before retrying.",
  );
}
