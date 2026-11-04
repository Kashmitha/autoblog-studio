import { Module } from "@nestjs/common";
import { MetricsService } from "../application/metrics.service";
@Module({ providers: [MetricsService], exports: [MetricsService] })
export class MetricsModule {}
