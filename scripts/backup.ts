import { renameSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { openDatabase, verifyDatabaseIntegrity } from '../packages/database/dist/index.js';

const defaultRetention = { daily: 14, weekly: 4, monthly: 12 } as const;
type BackupTier = keyof typeof defaultRetention;
const tierArgument = process.argv.find((argument) => argument.startsWith('--tier='));
const tier = (tierArgument?.slice('--tier='.length) ?? 'daily') as BackupTier;

const runtime = openDatabase({ migrate: false });
if (!(tier in defaultRetention)) {
  await runtime.close();
  throw new Error('Backup tier must be daily, weekly, or monthly');
}

// Retention can be tuned via app_settings key 'backup_retention' (JSON); fall back to defaults.
const retention: Record<BackupTier, number> = { ...defaultRetention };
try {
  const row = runtime.sqlite
    .prepare("SELECT value FROM app_settings WHERE key = 'backup_retention'")
    .get() as { value: string } | undefined;
  if (row) {
    const parsed = JSON.parse(row.value) as Partial<Record<BackupTier, unknown>>;
    for (const key of ['daily', 'weekly', 'monthly'] as const) {
      const value = parsed[key];
      if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
        retention[key] = value;
      }
    }
  }
} catch {
  // keep defaults on any parse problem
}
const stamp = new Date().toISOString().replaceAll(':', '').replaceAll('.', '');
const filename = `${tier}-${stamp}.sqlite3`;
const destination = join(runtime.paths.backupDir, filename);
const temporary = `${destination}.tmp`;

try {
  await runtime.sqlite.backup(temporary);
  const integrity = verifyDatabaseIntegrity(temporary);
  if (integrity !== 'ok') throw new Error(`Backup integrity check failed: ${String(integrity)}`);
  rmSync(`${temporary}-shm`, { force: true });
  rmSync(`${temporary}-wal`, { force: true });
  renameSync(temporary, destination);

  const matching = readdirSync(runtime.paths.backupDir)
    .filter((name) => name.startsWith(`${tier}-`) && name.endsWith('.sqlite3'))
    .sort()
    .reverse();
  for (const expired of matching.slice(retention[tier])) {
    rmSync(join(runtime.paths.backupDir, expired));
  }
  process.stdout.write(
    `${JSON.stringify({ status: 'ok', tier, backup: destination, integrity })}\n`
  );
} catch (error) {
  rmSync(temporary, { force: true });
  rmSync(`${temporary}-shm`, { force: true });
  rmSync(`${temporary}-wal`, { force: true });
  throw error;
} finally {
  await runtime.close();
}
