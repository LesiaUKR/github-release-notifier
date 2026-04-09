import { migrate } from 'drizzle-orm/postgres-js/migrator';

import { logger } from '../utils/logger';
import { db } from './index';

export async function runMigrations(): Promise<void> {
  logger.info('Running database migrations...');
  await migrate(db, { migrationsFolder: './drizzle' });
  logger.info('Migrations completed successfully');
}
