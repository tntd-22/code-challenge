import { Request, Response, NextFunction } from 'express';
import pino, { Logger } from 'pino';
import pinoHttpLib from 'pino-http';
import { v4 as uuidv4 } from 'uuid';
import { IncomingMessage, ServerResponse } from 'http';
import { config } from '../../config/index.js';

// Work around type issue with pino-http
const PinoHttp = pinoHttpLib as unknown as typeof pinoHttpLib.default;

// Extend Express Request to include pino-http's id property
declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

// Development transport with pino-pretty for human-readable logs
const devTransport = {
  target: 'pino-pretty',
  options: {
    colorize: true,
    translateTime: 'HH:MM:ss.l',
    ignore: 'pid,hostname',
    messageFormat: '{msg}',
    singleLine: false,
  },
};

// Create base logger
export const logger: Logger = pino({
  level: config.isProduction ? 'info' : 'debug',
  transport: config.isDevelopment ? devTransport : undefined,
  formatters: {
    level: (label: string) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Custom log serializer for readable request/response info
const formatRequest = (req: IncomingMessage) => {
  const { method, url, headers } = req;
  return {
    method,
    url,
    userAgent: headers['user-agent'],
    contentType: headers['content-type'],
  };
};

const formatResponse = (res: ServerResponse) => ({
  statusCode: res.statusCode,
});

// HTTP request logger middleware with correlation IDs
export const httpLogger = PinoHttp({
  logger,
  genReqId: (req: IncomingMessage): string => {
    const existingId = req.headers['x-correlation-id'] || req.headers['x-request-id'];
    return (existingId as string) || uuidv4().slice(0, 8); // Shorter ID for readability
  },
  customProps: (req: IncomingMessage) => ({
    correlationId: (req as Express.Request).id,
  }),
  // Custom log level based on status code
  customLogLevel: (_req: IncomingMessage, res: ServerResponse, err?: Error) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req: IncomingMessage, res: ServerResponse, responseTime: number) => {
    const method = req.method;
    const url = req.url;
    const status = res.statusCode;
    const time = responseTime.toFixed(0);

    // Color-code status in message for development
    let statusText = `${status}`;
    if (status >= 500) statusText = `${status} ERROR`;
    else if (status >= 400) statusText = `${status} CLIENT_ERROR`;
    else if (status >= 300) statusText = `${status} REDIRECT`;
    else if (status >= 200) statusText = `${status} OK`;

    return `${method} ${url} → ${statusText} (${time}ms)`;
  },
  customErrorMessage: (req: IncomingMessage, res: ServerResponse, err: Error) => {
    return `${req.method} ${req.url} → ${res.statusCode} FAILED: ${err.message}`;
  },
  customAttributeKeys: {
    req: 'request',
    res: 'response',
    err: 'error',
    responseTime: 'duration',
  },
  serializers: {
    req: formatRequest,
    res: formatResponse,
  },
  // Don't log health checks in development to reduce noise
  autoLogging: {
    ignore: (req: IncomingMessage) => {
      return config.isDevelopment && req.url === '/health';
    },
  },
});

// Middleware to attach correlation ID to response headers
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const correlationId = req.id || uuidv4();
  res.setHeader('x-correlation-id', String(correlationId));
  next();
}

// Utility function for logging with context (for use in services/controllers)
export function createChildLogger(context: string) {
  return logger.child({ context });
}
