import { NextFunction, Request, Response } from 'express';

import { AppError } from '../errors';
import { logger } from '../utils/logger';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    logger.warn(err.message, { statusCode: err.statusCode, name: err.name });

    res.status(err.statusCode).json({
      error: err.name,
      message: err.message,
    });
    return;
  }

  logger.error('Unexpected error', { message: err.message, stack: err.stack });

  res.status(500).json({
    error: 'InternalServerError',
    message: 'Something went wrong',
  });
}
