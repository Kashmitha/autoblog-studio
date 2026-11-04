import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../infrastructure/prisma.service";
import { PublishingService } from "../application/publishing.service";
@Controller("health")
export class HealthController {
  constructor(
    private readonly db: PrismaService,
    private readonly publisher: PublishingService,
  ) {}
  @Get() async check() {
    try {
      await this.db.$queryRaw`SELECT 1`;
      await this.publisher.queue.getJobCounts();
      const workers = await this.db.workerHeartbeat.count({
        where: { lastSeen: { gte: new Date(Date.now() - 90000) } },
      });
      return {
        status: "ok",
        database: "connected",
        redis: "connected",
        worker: workers ? "healthy" : "not running",
        time: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException("Database or queue unavailable.");
    }
  }
}
