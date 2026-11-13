import "reflect-metadata";
import "./config";
import { NestFactory } from "@nestjs/core";
import { Worker, UnrecoverableError, DelayedError } from "bullmq";
import { randomBytes } from "node:crypto";
import { WorkerModule } from "./worker.module";
import {
  PublishingService,
  redisConnection,
  DeferredPublication,
} from "./application/publishing.service";
import { PrismaService } from "./infrastructure/prisma.service";
import { EditorialService } from "./application/editorial.service";
async function main() {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ["error", "warn", "log"],
  });
  const publisher = app.get(PublishingService),
    editorial = app.get(EditorialService),
    db = app.get(PrismaService),
    id = randomBytes(8).toString("hex");
  const worker = new Worker(
    "autoblog-publish",
    async (job, token) => {
      try {
        await publisher.process(job.data.id);
      } catch (e) {
        const err = e as Error;
        if (err instanceof DeferredPublication) {
          await job.moveToDelayed(Date.now() + 30000, token);
          throw new DelayedError();
        }
        await publisher.recordFailure(
          job.data.id,
          err,
          err instanceof UnrecoverableError ||
            job.attemptsMade + 1 >= (job.opts.attempts || 5),
        );
        throw e;
      }
    },
    { connection: redisConnection(), concurrency: 1, lockDuration: 180000 },
  );
  worker.on("error", () =>
    console.error(
      JSON.stringify({
        level: "error",
        event: "worker_error",
        message: "Queue connection failed; check Redis.",
      }),
    ),
  );
  const reconcile = async () => {
    try {
      await db.workerHeartbeat.upsert({
        where: { id },
        create: { id },
        update: { lastSeen: new Date() },
      });
      await publisher.reconcile();
      await editorial.tick();
    } catch {
      console.error(
        JSON.stringify({
          level: "error",
          event: "reconcile_failed",
          message: "Check database and Redis availability.",
        }),
      );
    }
  };
  await reconcile();
  const interval = setInterval(reconcile, 30000);
  console.log(JSON.stringify({ level: "info", event: "worker_ready", id }));
  const stop = async () => {
    clearInterval(interval);
    await worker.close();
    await app.close();
    process.exit(0);
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}
main().catch((e) => {
  console.error(
    JSON.stringify({
      level: "error",
      event: "worker_startup_failed",
      message: e instanceof Error ? e.message : "Unknown startup error",
    }),
  );
  process.exit(1);
});
