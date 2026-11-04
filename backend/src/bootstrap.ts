import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { SafeExceptionFilter } from "./api/errors";
import { env, requireSecret } from "./config";
export async function createApp() {
  requireSecret("SESSION_SECRET");
  const key = requireSecret("TOKEN_ENCRYPTION_KEY");
  if (!/^[0-9a-f]{64}$/i.test(key))
    throw new Error("TOKEN_ENCRYPTION_KEY must be 32 hex-encoded bytes.");
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
  });
  app.setGlobalPrefix("api");
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: env.frontendOrigins, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new SafeExceptionFilter());
  app.enableShutdownHooks();
  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("AutoBlog Studio API")
      .setDescription(
        "Owner session cookie and X-CSRF-Token required for mutations. All business logic is in NestJS.",
      )
      .setVersion("0.1.0")
      .addCookieAuth("autoblog_session")
      .build(),
  );
  SwaggerModule.setup("api/docs", app, doc, {
    swaggerOptions: { persistAuthorization: false },
  });
  return app;
}
