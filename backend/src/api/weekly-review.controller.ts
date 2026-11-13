import { Controller, Get, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { SessionGuard } from "./auth";
import { WeeklyReviewService } from "../application/weekly-review.service";

@Controller("dashboard/weekly-review")
@UseGuards(SessionGuard)
export class WeeklyReviewController {
  constructor(private readonly review: WeeklyReviewService) {}
  @Get()
  async summary(@Res({ passthrough: true }) response: Response) {
    response.setHeader("Cache-Control", "no-store");
    return this.review.summary();
  }
}
