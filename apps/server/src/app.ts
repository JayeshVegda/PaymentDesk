import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
import { databaseHealth, type DatabaseRuntime } from '@payment-ledger/database';
import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { createApi } from './api.js';

export interface AppOptions {
  runtime: DatabaseRuntime;
  expectedHost: string;
  expectedOrigin?: string;
  webBuildDirectory?: string;
  logLevel?: string;
}

interface ErrorBody {
  error: { code: string; message: string };
}

function log(level: string, message: string, fields: Record<string, unknown> = {}): void {
  process.stdout.write(
    `${JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...fields })}\n`
  );
}

export function createApp(options: AppOptions): Hono {
  const app = new Hono();
  const defaultWebBuildDirectory = 'apps/web-react/build';
  const webBuildDirectory = resolve(options.webBuildDirectory ?? defaultWebBuildDirectory);
  const logLevel = options.logLevel ?? 'info';

  app.use('*', secureHeaders());
  app.use('*', async (context, next) => {
    const host = context.req.header('host');
    if (options.expectedHost !== '*' && host !== options.expectedHost) {
      return context.json<ErrorBody>(
        { error: { code: 'INVALID_HOST', message: 'Request host is not allowed' } },
        403
      );
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(context.req.method)) {
      const origin = context.req.header('origin');
      const expectedOrigin = options.expectedOrigin ?? `http://${options.expectedHost}`;
      if (options.expectedHost !== '*' && origin && origin !== expectedOrigin) {
        return context.json<ErrorBody>(
          { error: { code: 'INVALID_ORIGIN', message: 'Request origin is not allowed' } },
          403
        );
      }
    }
    const startedAt = performance.now();
    await next();
    // Request logs are useful during development, but writing one line for
    // every polling request is unnecessary on the always-on workstation.
    if (logLevel === 'debug' || logLevel === 'info') {
      log('info', 'request', {
        method: context.req.method,
        path: new URL(context.req.url).pathname,
        status: context.res.status,
        durationMs: Number((performance.now() - startedAt).toFixed(1))
      });
    }
  });

  app.get('/api/health', async (context) => {
    const database = await databaseHealth(options.runtime.db);
    return context.json({ status: 'ok' as const, version: '0.1.0', database });
  });
  app.route('/api', createApi(options.runtime));

  if (existsSync(webBuildDirectory)) {
    app.use('*', serveStatic({ root: webBuildDirectory }));
  }

  app.notFound(async (context) => {
    const pathname = new URL(context.req.url).pathname;
    if (pathname.startsWith('/api/')) {
      return context.json<ErrorBody>(
        { error: { code: 'NOT_FOUND', message: 'API route not found' } },
        404
      );
    }
    if (context.req.method === 'GET' && existsSync(resolve(webBuildDirectory, 'index.html'))) {
      return context.html(readFileSync(resolve(webBuildDirectory, 'index.html'), 'utf8'));
    }
    return context.text('Not found', 404);
  });

  app.onError((error, context) => {
    log('error', 'request_failed', {
      method: context.req.method,
      path: new URL(context.req.url).pathname,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    const expected =
      error instanceof TypeError ||
      error instanceof RangeError ||
      ['ClosedBusinessDateError', 'TransactionConflictError', 'TransactionNotFoundError', 'DuplicateTransactionError', 'NewPayeeRequiresConfirmationError'].includes(
        error.name
      );
    
    let code = expected ? error.name.replace(/Error$/, '').toUpperCase() : 'INTERNAL_ERROR';
    if (error.name === 'DuplicateTransactionError') code = 'DUPLICATE_TRANSACTION';
    if (error.name === 'NewPayeeRequiresConfirmationError') code = 'NEW_PAYEE_UNCONFIRMED';

    return context.json<ErrorBody>(
      {
        error: {
          code,
          message: expected ? error.message : 'The request could not be completed'
        }
      },
      expected
        ? error.name.includes('Conflict') || error.name.includes('Closed') || error.name === 'DuplicateTransactionError' || error.name === 'NewPayeeRequiresConfirmationError'
          ? 409
          : 400
        : 500
    );
  });

  return app;
}
