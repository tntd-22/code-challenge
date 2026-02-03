import 'dotenv/config';
import app from './app.js';
import { config } from './config/index.js';
import { closeDatabase } from './db/index.js';
import { logger } from './common/middleware/index.js';

// Startup banner for development
if (config.isDevelopment) {
  console.log('\n' + '═'.repeat(60));
  console.log('  🚀 E-Commerce API Server');
  console.log('═'.repeat(60));
}

const server = app.listen(config.port, () => {
  if (config.isDevelopment) {
    console.log(`
  ✓ Server running on http://localhost:${config.port}
  ✓ API Docs: http://localhost:${config.port}/api-docs
  ✓ Health: http://localhost:${config.port}/health
  ✓ Environment: ${config.nodeEnv}
${'─'.repeat(60)}
  Endpoints:
    GET/POST       /users
    GET/PATCH/DEL  /users/:id
    GET/POST       /products
    GET/PATCH/DEL  /products/:id
    GET/POST       /orders
    GET/PATCH/DEL  /orders/:id
${'─'.repeat(60)}
  Logs:
`);
  } else {
    logger.info({
      port: config.port,
      environment: config.nodeEnv,
    }, 'Server started');
  }
});

async function gracefulShutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutdown signal received, starting graceful shutdown');

  server.close(async () => {
    logger.info('HTTP server closed');
    try {
      await closeDatabase();
      logger.info('Database connection closed');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error closing database');
      process.exit(1);
    }
  });

  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
