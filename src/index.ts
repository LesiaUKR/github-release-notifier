import 'dotenv/config';

import type { Server as HttpServer } from 'node:http';

import * as grpc from '@grpc/grpc-js';

import app from './app';
import { config } from './config';
import { runMigrations } from './db/migrate';
import { startGrpcServer } from './grpc/server';
import { startScanner, stopScanner } from './scanner';
import { logger } from './utils/logger';

const GRPC_SHUTDOWN_TIMEOUT_MS = 5000;
let isShuttingDown = false;

function closeHttpServer(server: HttpServer): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close(error => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function closeGrpcServer(server: grpc.Server): Promise<void> {
  return new Promise(resolve => {
    let settled = false;

    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      logger.warn('gRPC graceful shutdown timed out, forcing shutdown');
      server.forceShutdown();
      resolve();
    }, GRPC_SHUTDOWN_TIMEOUT_MS);

    server.tryShutdown(error => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);

      if (error) {
        logger.warn('gRPC graceful shutdown failed, forcing shutdown', { error });
        server.forceShutdown();
      }

      resolve();
    });
  });
}

function registerGracefulShutdown(httpServer: HttpServer, grpcServer: grpc.Server): void {
  async function shutdown(signal: NodeJS.Signals): Promise<void> {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;

    logger.info(`Received ${signal}, shutting down services...`);
    stopScanner();

    const [httpResult, grpcResult] = await Promise.allSettled([
      closeHttpServer(httpServer),
      closeGrpcServer(grpcServer),
    ]);

    if (httpResult.status === 'rejected') {
      logger.error('HTTP shutdown failed:', httpResult.reason);
    }
    if (grpcResult.status === 'rejected') {
      logger.error('gRPC shutdown failed:', grpcResult.reason);
    }

    const exitCode = httpResult.status === 'fulfilled' && grpcResult.status === 'fulfilled' ? 0 : 1;
    logger.info(`Shutdown complete (exit code ${exitCode})`);
    process.exit(exitCode);
  }

  process.once('SIGINT', () => {
    void shutdown('SIGINT');
  });

  process.once('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

async function main(): Promise<void> {
  await runMigrations();

  const httpServer = app.listen(config.PORT, () => {
    logger.info(`Server running on port ${config.PORT}`);
    startScanner();
  });

  const grpcServer = startGrpcServer();
  registerGracefulShutdown(httpServer, grpcServer);
}

main().catch(error => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
