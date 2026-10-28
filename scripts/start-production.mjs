import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.NODE_ENV = 'production';
// Keep V8 from growing an unnecessarily large heap on the 4 GB workstation.
// An explicit user-provided NODE_OPTIONS always wins.
process.env.NODE_OPTIONS ??= '--max-old-space-size=512';

// NSSM service processes only carry AppEnvironmentExtra values, so the
// project .env (MUSE_API_KEY, TELEGRAM_*, PAYMENT_LEDGER_*) is loaded here.
// Existing process env values always win.
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dotenvPath = resolve(projectRoot, '.env');
if (existsSync(dotenvPath)) {
  for (const rawLine of readFileSync(dotenvPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key && value && !(key in process.env)) process.env[key] = value;
  }
}

await import('../apps/server/dist/index.js');
