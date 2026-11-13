import { Module } from "@nestjs/common";
import { DatabaseModule } from "./modules/database.module";
import { PublishingModule } from "./modules/publishing.module";
import { EditorialModule } from "./modules/editorial.module";
@Module({ imports: [DatabaseModule, PublishingModule, EditorialModule] })
export class WorkerModule {}
