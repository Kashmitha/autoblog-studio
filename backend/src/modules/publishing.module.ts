import { Module } from "@nestjs/common";
import { PublishingService } from "../application/publishing.service";
import { CloudPublishingService } from "../application/cloud-publishing.service";
import { ArticlesModule } from "./articles.module";
import { IntegrationsModule } from "./integrations.module";
@Module({
  imports: [ArticlesModule, IntegrationsModule],
  providers: [PublishingService, CloudPublishingService],
  exports: [PublishingService, CloudPublishingService],
})
export class PublishingModule {}
