import { Module } from "@nestjs/common";
import { AuthModule } from "./auth.module";
import { IntegrationsModule } from "./integrations.module";
import { GrowthController } from "../api/growth.controller";
import { GrowthService } from "../application/growth.service";
@Module({
  imports: [AuthModule, IntegrationsModule],
  controllers: [GrowthController],
  providers: [GrowthService],
})
export class GrowthModule {}
