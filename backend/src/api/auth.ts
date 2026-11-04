import { ApiProperty } from "@nestjs/swagger";
import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  Post,
  Req,
  Res,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";
import { Throttle } from "@nestjs/throttler";
import { createHmac, randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import { PrismaService } from "../infrastructure/prisma.service";
import { verifyPassword } from "../domain/security";
import { env, requireSecret } from "../config";
export const sessionId = (token: string) =>
  createHmac("sha256", requireSecret("SESSION_SECRET"))
    .update(token)
    .digest("hex");
export type AuthRequest = Request & {
  session?: { id: string; csrfToken: string; userId: string };
};
export function assertOrigin(req: Request) {
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    (!req.headers.origin || !env.frontendOrigins.includes(req.headers.origin))
  )
    throw new ForbiddenException("Request origin is not allowed.");
}
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly db: PrismaService) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<AuthRequest>();
    assertOrigin(req);
    const token = req.cookies?.autoblog_session;
    if (!token) throw new UnauthorizedException("Sign in to continue.");
    const session = await this.db.session.findUnique({
      where: { id: sessionId(token) },
    });
    if (!session || session.expiresAt < new Date())
      throw new UnauthorizedException("Session expired. Sign in again.");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers["x-csrf-token"] !== session.csrfToken
    )
      throw new ForbiddenException("Refresh the page and try again.");
    req.session = session;
    return true;
  }
}
class LoginDto {
  @ApiProperty({ required: true, type: String })
  @IsEmail({ require_tld: false })
  email!: string;
  @ApiProperty({ required: true, type: String })
  @IsString()
  @MinLength(12)
  @MaxLength(256)
  password!: string;
}
@Controller("auth")
export class AuthController {
  constructor(private readonly db: PrismaService) {}
  @Post("login")
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    assertOrigin(req);
    const user = await this.db.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user || !verifyPassword(dto.password, user.passwordHash))
      throw new UnauthorizedException("Invalid email or password.");
    const token = randomBytes(32).toString("hex"),
      csrfToken = randomBytes(32).toString("hex");
    await this.db.session.create({
      data: {
        id: sessionId(token),
        userId: user.id,
        csrfToken,
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
    res.cookie("autoblog_session", token, {
      httpOnly: true,
      secure: env.production,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 86400000,
    });
    return { email: user.email, csrfToken };
  }
  @Get("session") async session(@Req() req: Request) {
    const token = req.cookies?.autoblog_session;
    if (!token) throw new UnauthorizedException();
    const s = await this.db.session.findUnique({
      where: { id: sessionId(token) },
      include: { user: true },
    });
    if (!s || s.expiresAt < new Date()) throw new UnauthorizedException();
    return { email: s.user.email, csrfToken: s.csrfToken };
  }
  @Post("logout") async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    assertOrigin(req);
    if (req.cookies?.autoblog_session)
      await this.db.session.deleteMany({
        where: { id: sessionId(req.cookies.autoblog_session) },
      });
    res.clearCookie("autoblog_session", { path: "/" });
    return { ok: true };
  }
}
