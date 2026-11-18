import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  IsIn,
  IsInt,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from "class-validator";
import { SessionGuard } from "./auth";
import { GrowthService } from "../application/growth.service";
class GrowthReportDto {
  @IsInt() @IsIn([7, 28, 90]) days!: number;
}
class ResearchBriefDto {
  @IsString() @MinLength(1) @MaxLength(500) query!: string;
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2048)
  url!: string;
}
@Controller("growth")
@UseGuards(SessionGuard)
export class GrowthController {
  constructor(private readonly growth: GrowthService) {}
  @Get("articles") @Header("Cache-Control", "no-store") articles() {
    return this.growth.articles();
  }
  @Get("articles/:id/promotion") @Header("Cache-Control", "no-store") pack(
    @Param("id") id: string,
  ) {
    return this.growth.pack(id);
  }
  @Post("reports") @Header("Cache-Control", "no-store") report(
    @Body() input: GrowthReportDto,
  ) {
    return this.growth.report(input.days);
  }
  @Post("research-briefs") plan(@Body() input: ResearchBriefDto) {
    return this.growth.plan(input.query, input.url);
  }
}
