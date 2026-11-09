import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
export class ArticleDto {
  @ApiProperty({ required: true, type: String })
  @IsString()
  @MinLength(8)
  @MaxLength(180)
  title!: string;
  @ApiProperty({ required: true, type: String })
  @IsString()
  @MaxLength(80)
  niche!: string;
  @ApiProperty({ required: false, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  intent?: string;
  @ApiProperty({ required: false, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  excerpt?: string;
  @ApiProperty({ required: false, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(200000)
  html?: string;
  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  labels?: string[];
  @ApiProperty({ required: false, type: Boolean })
  @IsOptional()
  @IsBoolean()
  aiAssisted?: boolean;
  @ApiProperty({ required: false, type: Boolean })
  @IsOptional()
  @IsBoolean()
  disclosure?: boolean;
  @ApiProperty({ required: false, type: Number })
  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;
  @ApiProperty({ required: false, type: String })
  @IsOptional()
  @IsUrl({ protocols: ["https"], require_protocol: true })
  canonicalUrl?: string;
}
export class PlanningDto {
  @ApiProperty({ type: Number })
  @IsInt()
  @Min(0)
  @Max(3)
  backlogPriority!: number;
  @ApiProperty({ type: String })
  @IsString()
  @MaxLength(3000)
  planningNotes!: string;
  @ApiProperty({ type: Number })
  @IsInt()
  @Min(1)
  planningVersion!: number;
}
export class SourceDto {
  @ApiProperty({ required: true, type: String })
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2048)
  url!: string;
  @ApiProperty({ required: true, type: String })
  @IsString()
  @MaxLength(300)
  title!: string;
  @ApiProperty({ required: true, type: String })
  @IsString()
  @MaxLength(3000)
  note!: string;
}
export class TransitionDto {
  @ApiProperty({ required: true, type: String })
  @IsIn(["NEEDS_REVIEW", "APPROVED", "REJECTED"])
  status!: "NEEDS_REVIEW" | "APPROVED" | "REJECTED";
  @ApiProperty({ required: true, type: String })
  @IsString()
  @MinLength(5)
  @MaxLength(3000)
  reason!: string;
}
export class ScheduleDto {
  @ApiProperty({ required: true, type: String })
  @IsDateString()
  at!: string;
  @ApiProperty({ required: false, type: Boolean })
  @IsOptional()
  @IsBoolean()
  liveTest?: boolean;
}
export class SettingsDto {
  @ApiProperty({ required: true, type: Boolean })
  @IsBoolean()
  paused!: boolean;
  @ApiProperty({ required: true, type: Boolean })
  @IsBoolean()
  emergencyStop!: boolean;
  @ApiProperty({ required: true, type: Number })
  @IsInt()
  @Min(1)
  @Max(10)
  dailyLimit!: number;
  @ApiProperty({ required: true, type: [String] })
  @IsArray()
  @ArrayMaxSize(10)
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { each: true })
  times!: string[];
}
export class FinanceDto {
  @ApiProperty({ required: true, type: String })
  @IsDateString()
  date!: string;
  @ApiProperty({ required: true, type: String })
  @IsIn(["ACTUAL_REVENUE", "ESTIMATED_REVENUE", "EXPENSE"])
  kind!: string;
  @ApiProperty({ required: true, type: String })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  category!: string;
  @ApiProperty({ required: true, type: Number })
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  @Max(1000000)
  amount!: number;
  @ApiProperty({ required: true, type: String })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  reference!: string;
  @ApiProperty({ required: true, type: String })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  source!: string;
  @ApiProperty({ required: false, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
export class CsvDto {
  @ApiProperty({ required: true, type: String })
  @IsString()
  @MaxLength(1000000)
  csv!: string;
}
export class TrafficDto {
  @ApiProperty({ required: true, type: String })
  @IsDateString()
  date!: string;
  @ApiProperty({ required: false, type: String })
  @IsOptional()
  @IsUrl({ protocols: ["https"], require_protocol: true })
  url?: string;
  @ApiProperty({ required: false, type: Number })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000000)
  pageviews?: number;
  @ApiProperty({ required: false, type: Number })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000000)
  impressions?: number;
  @ApiProperty({ required: false, type: Number })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000000)
  clicks?: number;
  @ApiProperty({ required: true, type: String })
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  source!: string;
}
export class MediaDto {
  @ApiProperty({ required: false, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  providerPhotoId?: string;
  @ApiProperty({ required: true, type: String })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;
  @ApiProperty({ required: true, type: String })
  @IsUrl({ protocols: ["https"], require_protocol: true })
  url!: string;
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
  @IsUrl({ protocols: ["https"], require_protocol: true })
  sourceUrl!: string;
  @ApiProperty({ required: false, type: String })
  @IsOptional()
  @IsUrl({ protocols: ["https"], require_protocol: true })
  profileUrl?: string;
  @ApiProperty({ required: true, type: String })
  @IsIn(["ORIGINAL", "WIKIMEDIA", "UNSPLASH"])
  provider!: string;
  @ApiProperty({ required: true, type: String })
  @IsIn([
    "Original work",
    "CC0",
    "Public domain",
    "CC BY 4.0",
    "CC BY-SA 4.0",
    "Unsplash",
  ])
  license!: string;
  @ApiProperty({ required: true, type: String })
  @IsUrl({ protocols: ["https"], require_protocol: true })
  licenseUrl!: string;
  @ApiProperty({ required: true, type: String })
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  attribution!: string;
  @ApiProperty({ required: true, type: Boolean })
  @IsBoolean()
  rightsConfirmed!: boolean;
}
export class AttachDto {
  @ApiProperty({ required: true, type: String })
  @IsString()
  mediaId!: string;
}
export class BlogDto {
  @ApiProperty({ required: true, type: String })
  @IsString()
  @Matches(/^\d+$/)
  blogId!: string;
}
export class ConfirmDto {
  @ApiProperty({ required: true, type: String })
  @IsString()
  confirmation!: string;
}
export class ReconcileDto {
  @ApiProperty({ required: true, type: String })
  @IsString()
  @Matches(/^\d+$/)
  postId!: string;
  @ApiProperty({ required: true, type: String })
  @IsString()
  confirmation!: string;
}
export class ReminderDto {
  @ApiProperty({ required: true, type: String })
  @IsDateString()
  at!: string;
}
export class SitemapDto {
  @ApiProperty({ required: true, type: String })
  @IsUrl({ protocols: ["https"], require_protocol: true })
  url!: string;
}
export class AnalyticsSyncDto {
  @ApiProperty({ required: true, type: String })
  @IsDateString()
  start!: string;
  @ApiProperty({ required: true, type: String })
  @IsDateString()
  end!: string;
}
export class GenerateDto {
  @ApiProperty({ required: true, type: String })
  @IsIn(["draft", "topics"])
  task!: "draft" | "topics";
  @ApiProperty({ required: false, type: String })
  @IsOptional()
  @IsString()
  articleId?: string;
  @ApiProperty({ required: true, type: String })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  niche!: string;
}
