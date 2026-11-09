import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { IsString, Matches } from "class-validator";
import { ContentImportService } from "../application/content-import.service";
class ImportDto {
  @IsString() @Matches(/^[a-f0-9]{64}$/) fingerprint!: string;
}
import type { Response } from "express";
import { SessionGuard } from "./auth";
import { ContentArchiveService } from "../application/content-archive.service";
@Controller("content/archive")
@UseGuards(SessionGuard)
export class ContentArchiveController {
  constructor(
    private readonly archive: ContentArchiveService,
    private readonly importer: ContentImportService,
  ) {}
  @Post("preview")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 20 * 1024 * 1024, files: 1, fields: 0 },
    }),
  )
  preview(@UploadedFile() file?: { buffer: Buffer }) {
    if (!file) throw new BadRequestException("Choose a JSON archive file.");
    return this.importer.preview(file.buffer);
  }
  @Post("import")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 20 * 1024 * 1024, files: 1, fields: 1 },
    }),
  )
  import(
    @UploadedFile() file: { buffer: Buffer } | undefined,
    @Body() dto: ImportDto,
  ) {
    if (!file) throw new BadRequestException("Choose a JSON archive file.");
    return this.importer.import(file.buffer, dto.fingerprint);
  }
  @Get() async summary(@Res() response: Response) {
    response.setHeader("Cache-Control", "no-store");
    response.json(await this.archive.summary());
  }
  @Get("export") async export(@Res() response: Response) {
    const result = await this.archive.export();
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Archive-Exported-At", result.exportedAt);
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.filename}"`,
    );
    response.type("application/json").send(result.json);
  }
}
