import { Module } from "@nestjs/common";
import { EditorialService } from "../application/editorial.service";
import { EditorialController } from "../api/editorial.controller";
import { PublishingModule } from "./publishing.module";
import { ArticlesModule } from "./articles.module";
import { IntegrationsModule } from "./integrations.module";
@Module({
  imports: [PublishingModule, ArticlesModule, IntegrationsModule],
  providers: [EditorialService],
  controllers: [EditorialController],
  exports: [EditorialService],
})
export class EditorialModule {}
