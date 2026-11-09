import { Module } from "@nestjs/common";
import { MetricsService } from "../application/metrics.service";
import { PerformanceService } from "../application/performance.service";
@Module({
  providers: [MetricsService, PerformanceService],
  exports: [MetricsService, PerformanceService],
})
export class MetricsModule {}
