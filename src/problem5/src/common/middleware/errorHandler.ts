import { Request, Response, NextFunction } from 'express';
import { z } from 'zod/v4';
import { DatabaseError } from 'pg';
import { AppError } from '../errors/index.js';
import { config } from '../../config/index.js';
import { logger } from './logger.js';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const correlationId = req.id;
  const errorContext = {
    correlationId,
    method: req.method,
    path: req.path,
    body: config.isDevelopment ? req.body : undefined,
  };

  if (err instanceof AppError) {
    logger.warn(
      { ...errorContext, statusCode: err.statusCode, errorType: 'AppError' },
      `⚠ ${err.message}`
    );
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  if (err instanceof z.ZodError) {
    const message = err.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
    logger.warn(
      { ...errorContext, statusCode: 400, errorType: 'ValidationError', issues: err.issues },
      `⚠ Validation failed: ${message}`
    );
    res.status(400).json({ error: message });
    return;
  }

  // Handle PostgreSQL errors
  if (err instanceof DatabaseError) {
    const dbErrorContext = {
      ...errorContext,
      errorType: 'DatabaseError',
      code: err.code,
      detail: err.detail,
      constraint: err.constraint,
    };

    // Unique constraint violation
    if (err.code === '23505') {
      logger.warn(dbErrorContext, `⚠ Duplicate entry: ${err.detail || err.constraint}`);
      res.status(409).json({ error: 'Resource already exists' });
      return;
    }

    // Foreign key violation
    if (err.code === '23503') {
      logger.warn(dbErrorContext, `⚠ Foreign key violation: ${err.detail || err.constraint}`);
      res.status(400).json({ error: 'Invalid reference' });
      return;
    }

    // Not null violation
    if (err.code === '23502') {
      logger.warn(dbErrorContext, `⚠ Missing required field: ${err.column}`);
      res.status(400).json({ error: 'Missing required field' });
      return;
    }

    logger.error(dbErrorContext, `✖ Database error: ${err.message}`);
  }

  // Unexpected errors
  logger.error(
    { ...errorContext, statusCode: 500, errorType: err.constructor.name, stack: err.stack },
    `✖ Unexpected error: ${err.message}`
  );

  const message = config.isProduction ? 'Internal server error' : err.message;
  res.status(500).json({ error: message });
}
