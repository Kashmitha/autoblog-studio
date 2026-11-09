import { Controller, Get, Param, Post, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { SessionGuard } from "./auth";
import { FetchDiagnosticsService } from "../application/fetch-diagnostics.service";
@Controller("seo/articles/:id/fetch-diagnostics")
@UseGuards(SessionGuard)
export class FetchDiagnosticsController {
  constructor(private readonly diagnostics: FetchDiagnosticsService) {}
  @Get() report(@Param("id") id: string) {
    return this.diagnostics.report(id);
  }
  @Post("run") run(@Param("id") id: string) {
    return this.diagnostics.run(id);
  }
  @Get("export") async export(
    @Param("id") id: string,
    @Res() response: Response,
  ) {
    const result = await this.diagnostics.report(id);
    response.setHeader(
      "Content-Disposition",
      'attachment; filename="article-fetch-diagnostics.json"',
    );
    response.json({ ...result, exportedAt: new Date() });
  }
}
