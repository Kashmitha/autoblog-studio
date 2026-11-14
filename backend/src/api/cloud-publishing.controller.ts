import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { SessionGuard } from "./auth";
import { ScheduleDto, ReconcileDto } from "./dtos";
import { CloudPublishingService } from "../application/cloud-publishing.service";
import { IsInt, IsString, Min, MaxLength } from "class-validator";
class DraftHandoffDto {
  @IsInt() @Min(1) version!: number;
  @IsString() @MaxLength(100) confirmation!: string;
}
@Controller("blogger")
@UseGuards(SessionGuard)
export class CloudPublishingController {
  constructor(private readonly cloud: CloudPublishingService) {}
  @Post("articles/:id/draft") draft(
    @Param("id") id: string,
    @Body() input: DraftHandoffDto,
  ) {
    return this.cloud.prepareDraft(id, input.version, input.confirmation);
  }
  @Post("sync") sync() {
    return this.cloud.sync();
  }
  @Post("articles/:id/sync") syncOne(@Param("id") id: string) {
    return this.cloud.sync(id);
  }
  @Post("articles/:id/schedule") schedule(
    @Param("id") id: string,
    @Body() d: ScheduleDto,
  ) {
    return this.cloud.schedule(id, d.at);
  }
  @Post("articles/:id/link") link(
    @Param("id") id: string,
    @Body() d: ReconcileDto,
  ) {
    return this.cloud.link(id, d.postId, d.confirmation);
  }
}
