import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ArticlesService } from "../application/articles.service";
import { SessionGuard } from "./auth";
import { ContentPlanningService } from "../application/content-planning.service";
import { PlanningDto } from "./dtos";
import { ArticleDto, AttachDto, SourceDto, TransitionDto } from "./dtos";
@Controller("articles")
@UseGuards(SessionGuard)
export class ArticlesController {
  constructor(
    private readonly articles: ArticlesService,
    private readonly planning: ContentPlanningService,
  ) {}
  @Get("backlog") backlog() {
    return this.planning.backlog();
  }
  @Patch(":id/planning") planningUpdate(
    @Param("id") id: string,
    @Body() d: PlanningDto,
  ) {
    return this.planning.update(id, d);
  }
  @Get(":id/internal-links") links(@Param("id") id: string) {
    return this.planning.links(id);
  }
  @Get() list() {
    return this.articles.list();
  }
  @Post() create(@Body() d: ArticleDto) {
    return this.articles.create(d);
  }
  @Get(":id") get(@Param("id") id: string) {
    return this.articles.get(id);
  }
  @Patch(":id") update(@Param("id") id: string, @Body() d: ArticleDto) {
    return this.articles.update(id, d);
  }
  @Post(":id/transition") transition(
    @Param("id") id: string,
    @Body() d: TransitionDto,
  ) {
    return this.articles.transition(id, d.status, d.reason);
  }
  @Post(":id/quality") quality(@Param("id") id: string) {
    return this.articles.quality(id);
  }
  @Post(":id/sources") source(@Param("id") id: string, @Body() d: SourceDto) {
    return this.articles.addSource(id, d);
  }
  @Delete(":id/sources/:sourceId") removeSource(
    @Param("id") id: string,
    @Param("sourceId") sourceId: string,
  ) {
    return this.articles.removeSource(id, sourceId);
  }
  @Post(":id/verify-sources") verify(@Param("id") id: string) {
    return this.articles.verifySources(id);
  }
  @Post(":id/media") attach(@Param("id") id: string, @Body() d: AttachDto) {
    return this.articles.attach(id, d.mediaId);
  }
  @Delete(":id/media/:mediaId") detach(
    @Param("id") id: string,
    @Param("mediaId") mediaId: string,
  ) {
    return this.articles.detach(id, mediaId);
  }
}
