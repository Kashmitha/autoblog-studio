import "reflect-metadata";
import { PrismaClient } from "@prisma/client";
import { withDatabaseLock } from "../src/infrastructure/database-lock";
import { AuthController } from "../src/api/auth";
import { PrismaService } from "../src/infrastructure/prisma.service";
import { hashPassword } from "../src/domain/security";
import type { Request, Response } from "express";

let db: PrismaClient;
const options = { timeout: 8000, maxWait: 8000 };
beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL!);
  if (url.pathname !== "/autoblog_test")
    throw Error("Isolated database required");
  url.searchParams.set("connection_limit", "3");
  url.searchParams.set("pool_timeout", "10");
  db = new PrismaClient({ datasourceUrl: url.href });
  await db.$connect();
  // Establish all three connections before measuring contended login latency.
  await Promise.all(
    Array.from(
      { length: 3 },
      () => db.$queryRaw`SELECT 1 AS ready FROM pg_sleep(0.1)`,
    ),
  );
});
afterAll(async () => {
  await db?.$disconnect();
});

test("login retains database access while eight reporting operations wait on a three-connection pool", async () => {
  const user = await db.user.create({
    data: {
      email: "pool-login@localhost",
      passwordHash: hashPassword("pool-test-password-123"),
    },
  });
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const ready = new Promise<void>((r) => (entered = r));
  let active = 0,
    maximum = 0;
  const work = async (first = false) => {
    active++;
    maximum = Math.max(maximum, active);
    try {
      if (first) {
        entered();
        await gate;
      }
      // Google token lookups and publication intent commits use the root client.
      await db.user.findUniqueOrThrow({ where: { id: user.id } });
      return true;
    } finally {
      active--;
    }
  };
  const owner = withDatabaseLock(db, 987621, () => work(true), options);
  await ready;
  const waiters = Array.from({ length: 8 }, () =>
    withDatabaseLock(db, 987621, () => work(), options),
  );
  let outcome: unknown;
  try {
    await new Promise((r) => setTimeout(r, 100));
    const controller = new AuthController(db as PrismaService);
    const cookie = jest.fn();
    const start = Date.now();
    outcome = await controller.login(
      { email: user.email, password: "pool-test-password-123" },
      { headers: { origin: "http://localhost:3100" } } as Request,
      { cookie } as unknown as Response,
    );
    expect(Date.now() - start).toBeLessThan(2000);
    expect(cookie).toHaveBeenCalledTimes(1);
    expect(outcome).toMatchObject({ email: user.email });
  } finally {
    release();
    await Promise.allSettled([owner, ...waiters]);
    await db.user.delete({ where: { id: user.id } });
  }
  expect(maximum).toBe(1);
  expect(await Promise.all(waiters)).toEqual(Array(8).fill(true));
});

test("a started callback that fails is never replayed, and its lock is released", async () => {
  const work = jest.fn(async () => {
    throw Error("ambiguous remote result");
  });
  await expect(withDatabaseLock(db, 987622, work, options)).rejects.toThrow(
    "ambiguous remote",
  );
  expect(work).toHaveBeenCalledTimes(1);
  await expect(
    withDatabaseLock(db, 987622, async () => "available", options),
  ).resolves.toBe("available");
});

test("lock wait times out without executing work or retaining pooled connections", async () => {
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>((r) => (release = r)),
    ready = new Promise<void>((r) => (entered = r));
  const owner = withDatabaseLock(
    db,
    987623,
    async () => {
      entered();
      await gate;
    },
    options,
  );
  await ready;
  const work = jest.fn(async () => true);
  try {
    await expect(
      withDatabaseLock(db, 987623, work, { timeout: 1000, maxWait: 150 }),
    ).rejects.toThrow("Another operation");
    expect(work).not.toHaveBeenCalled();
    await expect(db.$queryRaw`SELECT 1 AS value`).resolves.toEqual([
      { value: 1 },
    ]);
  } finally {
    release();
    await owner;
  }
});
