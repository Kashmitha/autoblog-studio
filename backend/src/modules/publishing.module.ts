import { Module } from "@nestjs/common";
import { PublishingService } from "../application/publishing.service";
import { ArticlesModule } from "./articles.module";
import { IntegrationsModule } from "./integrations.module";
@Module({
  imports: [ArticlesModule, IntegrationsModule],
  providers: [PublishingService],
  exports: [PublishingService],
})
export class PublishingModule {}
