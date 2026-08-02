import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

function extractMessage(exception: HttpException): string | string[] {
  const body = exception.getResponse();
  if (typeof body === 'string') {
    return body;
  }
  if (body && typeof body === 'object' && 'message' in body) {
    return (body as { message: string | string[] }).message;
  }
  return exception.message;
}

// Registered globally so every exception in the app — deliberate
// (NotFoundException, ConflictException, ...) or not (a bug, a dropped DB
// connection, an unmapped Prisma error) — passes through one place. That
// guarantees a single response envelope shape and, more importantly, means
// unexpected (5xx) errors always get logged with a stack trace instead of
// silently vanishing behind Nest's default handler.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status: number = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = isHttpException
      ? extractMessage(exception)
      : 'Internal server error';

    if (status >= Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
      this.logger.error(
        `${request.method} ${request.originalUrl} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      statusCode: status,
      message,
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
    });
  }
}
