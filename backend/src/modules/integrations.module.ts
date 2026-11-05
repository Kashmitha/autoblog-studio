import { Module } from "@nestjs/common";
import {
  GoogleService,
  LiveBloggerAdapter,
} from "../infrastructure/blogger.service";
import { AiProvider, OpenAiProvider } from "../infrastructure/ai.provider";
import { AiService } from "../application/ai.service";
import { MediaService } from "../application/media.service";
import { ReportingService } from "../application/reporting.service";
import { SearchConsoleService } from "../application/search-console.service";
import { SearchConsoleAdapter } from "../infrastructure/search-console.adapter";
import { ArticlesModule } from "./articles.module";
import { MetricsModule } from "./metrics.module";
@Module({
  imports: [ArticlesModule, MetricsModule],
  providers: [
    GoogleService,
    LiveBloggerAdapter,
    AiService,
    MediaService,
    ReportingService,
    SearchConsoleService,
    SearchConsoleAdapter,
    { provide: AiProvider, useClass: OpenAiProvider },
  ],
  exports: [
    GoogleService,
    LiveBloggerAdapter,
    AiService,
    MediaService,
    ReportingService,
    SearchConsoleService,
    SearchConsoleAdapter,
  ],
})
export class IntegrationsModule {}
