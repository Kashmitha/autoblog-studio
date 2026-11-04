import { ApiProperty } from "@nestjs/swagger";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from "class-validator";
import { Transform } from "class-transformer";
import { randomBytes, createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Response } from "express";
import { PrismaService } from "../infrastructure/prisma.service";
import { SessionGuard } from "./auth";
const uploads = resolve(__dirname, "../../../uploads");
class UploadDto {
  @ApiProperty({ required: true, type: String })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;
  @ApiProperty({ required: true, type: String })
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  alt!: string;
  @ApiProperty({ required: true, type: String })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  creator!: string;
  @ApiProperty({ required: true, type: String })
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  attribution!: string;
  @ApiProperty({ required: true, type: Boolean })
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  rightsConfirmed!: boolean;
  @ApiProperty({ required: false, type: String })
  @IsOptional()
  @IsUrl({ protocols: ["https"], require_protocol: true })
  publicUrl?: string;
}
class PublicImageDto {
  @ApiProperty({ required: true, type: String })
  @IsUrl({ protocols: ["https"], require_protocol: true })
  url!: string;
}
@Controller("media")
@UseGuards(SessionGuard)
export class MediaController {
  constructor(private readonly db: PrismaService) {}
  @Post("upload")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 8 },
    }),
  )
  async upload(@UploadedFile() file: { buffer: Buffer }, @Body() d: UploadDto) {
    if (!file?.buffer || !d.rightsConfirmed)
      throw new BadRequestException(
        "Upload an original image and confirm that you own its rights.",
      );
    const b = file.buffer;
    const ext =
      b.length > 12 &&
      b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        ? "png"
        : b.length > 3 && b[0] === 255 && b[1] === 216 && b[2] === 255
          ? "jpg"
          : b.length > 12 &&
              b.toString("ascii", 0, 4) === "RIFF" &&
              b.toString("ascii", 8, 12) === "WEBP"
            ? "webp"
            : null;
    if (!ext)
      throw new BadRequestException(
        "Only original PNG, JPEG or WebP images are accepted. SVG and executable formats are rejected.",
      );
    const id = randomBytes(12).toString("hex"),
      storageKey = id + "." + ext;
    await mkdir(uploads, { recursive: true });
    await writeFile(resolve(uploads, storageKey), b, { flag: "wx" });
    const url = d.publicUrl || "/api/media/files/" + id;
    return this.db.mediaAsset.create({
      data: {
        id,
        title: d.title,
        alt: d.alt,
        creator: d.creator,
        attribution: d.attribution,
        rightsConfirmed: true,
        provider: "ORIGINAL",
        license: "Original work",
        url,
        sourceUrl: url,
        licenseUrl: url,
        metadata: {
          storageKey,
          contentType: ext === "jpg" ? "image/jpeg" : "image/" + ext,
          sha256: createHash("sha256").update(b).digest("hex"),
          ownershipAttestedAt: new Date().toISOString(),
        },
      },
    });
  }
  @Get("files/:id") async file(@Param("id") id: string, @Res() res: Response) {
    const asset = await this.db.mediaAsset.findUniqueOrThrow({ where: { id } });
    const metadata = asset.metadata as {
      storageKey?: string;
      contentType?: string;
    };
    if (
      !metadata.storageKey ||
      !/^\w+\.(png|jpg|webp)$/.test(metadata.storageKey)
    )
      throw new BadRequestException(
        "No original file is stored for this asset.",
      );
    const content = await readFile(resolve(uploads, metadata.storageKey));
    res.setHeader(
      "Content-Type",
      metadata.contentType || "application/octet-stream",
    );
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(content);
  }
  @Patch(":id/public-url") async delivery(
    @Param("id") id: string,
    @Body() d: PublicImageDto,
  ) {
    return this.db.$transaction(async (tx) => {
      const asset = await tx.mediaAsset.findUniqueOrThrow({
        where: { id },
        include: { articles: { include: { article: true } } },
      });
      if (asset.provider !== "ORIGINAL")
        throw new BadRequestException(
          "Stock images must preserve provider delivery URLs.",
        );
      if (
        asset.articles.some((a) =>
          ["SCHEDULED", "PUBLISHING", "PUBLISHED"].includes(a.article.status),
        )
      )
        throw new BadRequestException(
          "Unschedule all attached articles before changing delivery. Published assets are immutable.",
        );
      await tx.article.updateMany({
        where: { id: { in: asset.articles.map((a) => a.articleId) } },
        data: {
          status: "NEEDS_REVIEW",
          approvedAt: null,
          version: { increment: 1 },
        },
      });
      return tx.mediaAsset.update({
        where: { id },
        data: {
          url: d.url,
          sourceUrl: d.url,
          licenseUrl: d.url,
          checkedAt: new Date(),
        },
      });
    });
  }
}
