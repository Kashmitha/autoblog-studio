import { Module } from "@nestjs/common";
import { ArticlesController } from "../api/articles.controller";
import { ArticlesService } from "../application/articles.service";
import { AuthModule } from "./auth.module";
import { ContentPlanningService } from "../application/content-planning.service";
import { ContentArchiveService } from "../application/content-archive.service";
import { ContentArchiveController } from "../api/content-archive.controller";
import { ContentImportService } from "../application/content-import.service";
@Module({
  imports: [AuthModule],
  controllers: [ArticlesController, ContentArchiveController],
  providers: [
    ArticlesService,
    ContentPlanningService,
    ContentArchiveService,
    ContentImportService,
  ],
  exports: [ArticlesService],
})
export class ArticlesModule {}
