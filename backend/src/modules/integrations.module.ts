import { Module } from "@nestjs/common";
import {
  GoogleService,
  LiveBloggerAdapter,
} from "../infrastructure/blogger.service";
import {
  AiProvider,
  ConfiguredAiProvider,
} from "../infrastructure/ai.provider";
import { AiService } from "../application/ai.service";
import { MediaService } from "../application/media.service";
import { CommonsPhotoService } from "../application/commons-photo.service";
import { PhotoPreparationService } from "../application/photo-preparation.service";
import { ReportingService } from "../application/reporting.service";
import { TrafficSyncService } from "../application/traffic-sync.service";
import { SearchConsoleService } from "../application/search-console.service";
import { SearchConsoleAdapter } from "../infrastructure/search-console.adapter";
import { DiagnosticFetcher } from "../infrastructure/diagnostic-fetcher";
import { FetchDiagnosticsService } from "../application/fetch-diagnostics.service";
import { ArticlesModule } from "./articles.module";
import { MetricsModule } from "./metrics.module";
import { AnalyticsConnectionService } from "../application/analytics-connection.service";
import { AnalyticsAdapter } from "../infrastructure/analytics.adapter";
import { AnalyticsController } from "../api/analytics.controller";
@Module({
  imports: [ArticlesModule, MetricsModule],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsConnectionService,
    AnalyticsAdapter,
    GoogleService,
    LiveBloggerAdapter,
    AiService,
    MediaService,
    CommonsPhotoService,
    PhotoPreparationService,
    ReportingService,
    TrafficSyncService,
    SearchConsoleService,
    SearchConsoleAdapter,
    DiagnosticFetcher,
    FetchDiagnosticsService,
    { provide: AiProvider, useClass: ConfiguredAiProvider },
  ],
  exports: [
    AnalyticsConnectionService,
    AnalyticsAdapter,
    GoogleService,
    LiveBloggerAdapter,
    AiService,
    MediaService,
    CommonsPhotoService,
    PhotoPreparationService,
    ReportingService,
    TrafficSyncService,
    SearchConsoleService,
    SearchConsoleAdapter,
    DiagnosticFetcher,
    FetchDiagnosticsService,
  ],
})
export class IntegrationsModule {}
