import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { SessionGuard } from "./auth";
import { PerformanceService } from "../application/performance.service";
@Controller("traffic")
@UseGuards(SessionGuard)
export class PerformanceController {
  constructor(private readonly performance: PerformanceService) {}
  @Get("articles") report(@Query("days") days?: string) {
    return this.performance.report(days);
  }
  @Get("articles/export") async csv(
    @Query("days") days: string | undefined,
    @Res() response: Response,
  ) {
    const result = await this.performance.csv(days);
    response
      .type("text/csv")
      .setHeader(
        "Content-Disposition",
        `attachment; filename="article-performance-${result.days}-days.csv"`,
      );
    response.send(result.csv);
  }
}
