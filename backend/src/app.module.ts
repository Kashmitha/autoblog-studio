import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { DatabaseModule } from "./modules/database.module";
import { AuthModule } from "./modules/auth.module";
import { ArticlesModule } from "./modules/articles.module";
import { MetricsModule } from "./modules/metrics.module";
import { IntegrationsModule } from "./modules/integrations.module";
import { PublishingModule } from "./modules/publishing.module";
import { StudioController } from "./api/studio.controller";
import { HealthController } from "./api/health.controller";
import { MediaController } from "./api/media.controller";
import { CloudPublishingController } from "./api/cloud-publishing.controller";
import { SearchConsoleController } from "./api/search-console.controller";
import { PerformanceController } from "./api/performance.controller";
import { TrafficSyncController } from "./api/traffic-sync.controller";
import { FetchDiagnosticsController } from "./api/fetch-diagnostics.controller";
import { EditorialModule } from "./modules/editorial.module";
@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    ArticlesModule,
    MetricsModule,
    IntegrationsModule,
    PublishingModule,
    EditorialModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 180 }]),
  ],
  controllers: [
    StudioController,
    HealthController,
    MediaController,
    CloudPublishingController,
    SearchConsoleController,
    PerformanceController,
    TrafficSyncController,
    FetchDiagnosticsController,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
