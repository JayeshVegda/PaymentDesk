import { migrateDatabase, openDatabase } from '../packages/database/dist/index.js';

const runtime = openDatabase({ migrate: false });
try {
  const applied = migrateDatabase(runtime.sqlite);
  process.stdout.write(
    `${JSON.stringify({ status: 'ok', database: runtime.paths.databasePath, applied })}\n`
  );
} finally {
  await runtime.close();
}
