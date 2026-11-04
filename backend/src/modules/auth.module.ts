import { Module } from "@nestjs/common";
import { AuthController, SessionGuard } from "../api/auth";
@Module({
  controllers: [AuthController],
  providers: [SessionGuard],
  exports: [SessionGuard],
})
export class AuthModule {}
