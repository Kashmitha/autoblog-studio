import { Module } from "@nestjs/common";
import { MetricsService } from "../application/metrics.service";
import { PerformanceService } from "../application/performance.service";
import { AdReportController } from "../api/ad-report.controller";
@Module({
  controllers: [AdReportController],
  providers: [MetricsService, PerformanceService],
  exports: [MetricsService, PerformanceService],
})
export class MetricsModule {}
