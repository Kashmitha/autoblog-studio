import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import type { Response } from "express";
@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("API");
  catch(error: unknown, host: ArgumentsHost) {
    const id = randomBytes(6).toString("hex");
    let status = 500,
      message: unknown =
        "An unexpected error occurred. Check service health and the server logs.";
    if (error instanceof HttpException) {
      status = error.getStatus();
      const body = error.getResponse();
      message =
        typeof body === "string"
          ? body
          : (body as { message: unknown }).message;
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        status = 409;
        message = "A record with this reference already exists.";
      }
      if (error.code === "P2025") {
        status = 404;
        message = "Record not found.";
      }
    }
    this.logger.warn(
      JSON.stringify({
        requestId: id,
        status,
        errorType: error instanceof Error ? error.name : "Unknown",
      }),
    );
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ statusCode: status, message, requestId: id });
  }
}
