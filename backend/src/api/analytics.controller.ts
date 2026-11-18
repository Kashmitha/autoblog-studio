import {
  Body,
  Controller,
  Get,
  Header,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { IsInt, IsString, Matches, Min } from "class-validator";
import { AnalyticsConnectionService } from "../application/analytics-connection.service";
import { SessionGuard } from "./auth";
class AnalyticsConfigurationDto {
  @IsString() @Matches(/^\d{1,20}$/) propertyId!: string;
  @IsString() @Matches(/^G-[A-Z0-9]{4,20}$/) measurementId!: string;
  @IsInt() @Min(0) revision!: number;
}
@Controller("integrations/analytics")
@UseGuards(SessionGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsConnectionService) {}
  @Get("configuration") @Header("Cache-Control", "no-store") configuration() {
    return this.analytics.configuration();
  }
  @Patch("configuration") save(@Body() d: AnalyticsConfigurationDto) {
    return this.analytics.save(d.propertyId, d.measurementId, d.revision);
  }
  @Post("test") test() {
    return this.analytics.test();
  }
}
