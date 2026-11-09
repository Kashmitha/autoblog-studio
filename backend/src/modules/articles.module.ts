import { Module } from "@nestjs/common";
import { ArticlesController } from "../api/articles.controller";
import { ArticlesService } from "../application/articles.service";
import { AuthModule } from "./auth.module";
import { ContentPlanningService } from "../application/content-planning.service";
@Module({
  imports: [AuthModule],
  controllers: [ArticlesController],
  providers: [ArticlesService, ContentPlanningService],
  exports: [ArticlesService],
})
export class ArticlesModule {}
