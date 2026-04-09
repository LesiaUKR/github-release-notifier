import { migrate } from 'drizzle-orm/postgres-js/migrator';

import { db } from './index';

export async function runMigrations(): Promise<void> {
  console.log('Running database migrations...');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations completed successfully');
}
