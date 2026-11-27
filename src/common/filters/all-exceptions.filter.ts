import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Error as MongooseError } from 'mongoose';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = 500;
    let message: string | string[] = 'Something went wrong';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      message =
        typeof body === 'string'
          ? body
          : (body as { message: string | string[] }).message;
    } else if (exception instanceof MongooseError.CastError) {
      status = 400;
      message = `Invalid ${exception.path === '_id' ? 'id' : exception.path}`;
    } else if (exception instanceof MongooseError.ValidationError) {
      status = 400;
      message = Object.values(exception.errors).map((err) => err.message);
    } else if ((exception as { code?: number }).code === 11000) {
      status = 409;
      const keyValue =
        (exception as { keyValue?: Record<string, unknown> }).keyValue ?? {};
      message = `${Object.keys(keyValue)[0]} already exists`;
    } else {
      console.error(exception);
    }

    response.status(status).json({
      statusCode: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
