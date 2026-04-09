import 'dotenv/config';

import app from './app';
import { config } from './config';
import { runMigrations } from './db/migrate';
import { startScanner } from './scanner';
import { logger } from './utils/logger';

async function main(): Promise<void> {
  await runMigrations();

  app.listen(config.PORT, () => {
    logger.info(`Server running on port ${config.PORT}`);
    startScanner();
  });
}

main().catch(error => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
