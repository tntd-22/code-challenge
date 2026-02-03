import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from './config/index.js';
import { errorHandler, httpLogger, logger } from './common/middleware/index.js';
import { healthCheck } from './db/index.js';
import { userRoutes } from './modules/users/index.js';
import { productRoutes } from './modules/products/index.js';
import { orderRoutes } from './modules/orders/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const openapiPath = path.join(__dirname, '..', 'openapi.yaml');
const openapiDocument = YAML.parse(fs.readFileSync(openapiPath, 'utf8'));

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
    },
  },
}));

app.use(cors({
  origin: config.cors.origin,
  credentials: config.cors.credentials,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
app.use(limiter);

// Body parsing with size limits
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Request logging with correlation IDs
app.use(httpLogger);

// Log request body in development for debugging
if (config.isDevelopment) {
  app.use((req, _res, next) => {
    if (req.body && Object.keys(req.body).length > 0) {
      logger.debug({ body: req.body, path: req.path }, '📥 Request body');
    }
    next();
  });
}

const startTime = Date.now();

app.get('/health', async (_req, res) => {
  const dbHealthy = await healthCheck();
  const status = dbHealthy ? 'ok' : 'degraded';
  const statusCode = dbHealthy ? 200 : 503;

  const memoryUsage = process.memoryUsage();

  res.status(statusCode).json({
    status,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: config.nodeEnv,
    uptime: {
      seconds: Math.floor((Date.now() - startTime) / 1000),
      human: formatUptime(Date.now() - startTime),
    },
    memory: {
      heapUsed: formatBytes(memoryUsage.heapUsed),
      heapTotal: formatBytes(memoryUsage.heapTotal),
      rss: formatBytes(memoryUsage.rss),
    },
    checks: {
      database: dbHealthy ? 'ok' : 'failed',
    },
  });
});

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiDocument));

// E-commerce API routes
app.use('/users', userRoutes);
app.use('/products', productRoutes);
app.use('/orders', orderRoutes);

// 404 handler for undefined routes
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handling
app.use(errorHandler);

export default app;
