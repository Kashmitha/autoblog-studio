import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { SessionGuard } from "./auth";
import { ScheduleDto, ReconcileDto } from "./dtos";
import { CloudPublishingService } from "../application/cloud-publishing.service";
@Controller("blogger")
@UseGuards(SessionGuard)
export class CloudPublishingController {
  constructor(private readonly cloud: CloudPublishingService) {}
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
