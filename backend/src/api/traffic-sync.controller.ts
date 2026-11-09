import { Controller, Get, Post, UseGuards } from "@nestjs/common";
import { SessionGuard } from "./auth";
import { TrafficSyncService } from "../application/traffic-sync.service";
@Controller("reports/search-console")
@UseGuards(SessionGuard)
export class TrafficSyncController {
  constructor(private readonly sync: TrafficSyncService) {}
  @Get("status") status() {
    return this.sync.status();
  }
  @Post("refresh-due") refreshDue() {
    return this.sync.sync(true);
  }
}
