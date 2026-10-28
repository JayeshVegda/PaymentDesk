import { serve } from '@hono/node-server';
import { openDatabase } from '@payment-ledger/database';
import { createApp } from './app.js';
import { startTelegramCompanion } from './telegram.js';

const production = process.env.NODE_ENV === 'production';
const portArgument = process.argv.find((argument) => argument.startsWith('--port='));
const requestedPort = portArgument ? Number(portArgument.slice('--port='.length)) : undefined;
const port = production ? 4782 : (requestedPort ?? 4782);

if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error('Invalid port');
if (production && port !== 4782) throw new Error('Production port is fixed at 4782');

const hostname = process.env.HOST ?? '127.0.0.1';
const runtime = openDatabase();
const app = createApp({
  runtime,
  expectedHost: process.env.PAYMENT_LEDGER_EXPECTED_HOST ?? `${hostname}:${port}`,
  ...(process.env.PAYMENT_LEDGER_EXPECTED_ORIGIN
    ? { expectedOrigin: process.env.PAYMENT_LEDGER_EXPECTED_ORIGIN }
    : {}),
  logLevel: process.env.PAYMENT_LEDGER_LOG_LEVEL ?? (production ? 'warn' : 'info')
});

const server = serve({ fetch: app.fetch, hostname, port }, (info) => {
  process.stdout.write(
    `${JSON.stringify({ timestamp: new Date().toISOString(), level: 'info', message: 'server_started', url: `http://${hostname}:${info.port}` })}\n`
  );
});
const telegram = startTelegramCompanion(runtime);

let stopping = false;
async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  process.stdout.write(
    `${JSON.stringify({ timestamp: new Date().toISOString(), level: 'info', message: 'server_stopping', signal })}\n`
  );
  server.close(async () => {
    await telegram?.stop();
    await runtime.close();
    process.exitCode = 0;
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
