import 'dotenv/config';

import app from './app';
import { runMigrations } from './db/migrate';

const PORT = process.env.PORT || 3000;

async function main(): Promise<void> {
  await runMigrations();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

main().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
