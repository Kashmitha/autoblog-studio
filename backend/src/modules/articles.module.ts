import { Module } from "@nestjs/common";
import { ArticlesController } from "../api/articles.controller";
import { ArticlesService } from "../application/articles.service";
import { AuthModule } from "./auth.module";
@Module({
  imports: [AuthModule],
  controllers: [ArticlesController],
  providers: [ArticlesService],
  exports: [ArticlesService],
})
export class ArticlesModule {}
