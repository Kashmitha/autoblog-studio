import { Module } from "@nestjs/common";
import { MetricsService } from "../application/metrics.service";
import { PerformanceService } from "../application/performance.service";
import { AdReportController } from "../api/ad-report.controller";
import { WeeklyReviewController } from "../api/weekly-review.controller";
import { WeeklyReviewService } from "../application/weekly-review.service";
@Module({
  controllers: [AdReportController, WeeklyReviewController],
  providers: [MetricsService, PerformanceService, WeeklyReviewService],
  exports: [MetricsService, PerformanceService],
})
export class MetricsModule {}
