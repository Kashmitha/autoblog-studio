import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { IsString, MaxLength } from "class-validator";
import { createHash } from "node:crypto";
import type { Response } from "express";
import { PrismaService } from "../infrastructure/prisma.service";
import { SessionGuard } from "./auth";
import { parseAdsterraReport } from "../domain/adsterra-report";

class SaveAdReportDto {
  @IsString() @MaxLength(200) filename!: string;
  @IsString() @MaxLength(200) scopeLabel!: string;
  @IsString() @MaxLength(80) timezoneLabel!: string;
}

@Controller("finance/ad-reports")
@UseGuards(SessionGuard)
export class AdReportController {
  constructor(private readonly db: PrismaService) {}

  @Get()
  async list(@Res({ passthrough: true }) response: Response) {
    response.setHeader("Cache-Control", "no-store");
    return this.db.adReport.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 30,
      select: {
        id: true,
        filename: true,
        scopeLabel: true,
        timezoneLabel: true,
        createdAt: true,
      },
    });
  }

  @Get(":id")
  async get(
    @Param("id") id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader("Cache-Control", "no-store");
    const saved = await this.db.adReport.findUnique({ where: { id } });
    if (!saved) throw new NotFoundException("Saved ad report not found.");
    return saved;
  }

  @Post()
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 1_000_000, files: 1, fields: 3 },
    }),
  )
  async save(
    @Body() dto: SaveAdReportDto,
    @UploadedFile() file?: { buffer: Buffer },
  ) {
    if (!file) throw new BadRequestException("Choose an Adsterra CSV file.");
    let report: ReturnType<typeof parseAdsterraReport>;
    try {
      report = parseAdsterraReport(file.buffer.toString("utf8"));
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Invalid ad report.",
      );
    }
    const scopeLabel = dto.scopeLabel.trim(),
      timezoneLabel = dto.timezoneLabel.trim();
    const fingerprint = createHash("sha256")
      .update(JSON.stringify({ report, scopeLabel, timezoneLabel }))
      .digest("hex");
    // A unique normalized snapshot prevents duplicates on retry/concurrent saves.
    // Overlapping or revised snapshots remain separate and are never added together.
    return this.db.adReport.upsert({
      where: { fingerprint },
      update: {},
      create: {
        fingerprint,
        filename: dto.filename.trim() || "Adsterra CSV",
        scopeLabel,
        timezoneLabel,
        report,
      },
    });
  }
}
