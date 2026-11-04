import { Module } from "@nestjs/common";
import { DatabaseModule } from "./modules/database.module";
import { PublishingModule } from "./modules/publishing.module";
@Module({ imports: [DatabaseModule, PublishingModule] })
export class WorkerModule {}
