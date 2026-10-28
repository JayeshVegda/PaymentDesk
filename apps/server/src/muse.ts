import { timingSafeEqual, createHash } from 'node:crypto';
import { businessNow, LedgerService, type DatabaseRuntime } from '@payment-ledger/database';
import { Hono, type Context } from 'hono';

function integer(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function id(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new TypeError('Invalid identifier');
  return parsed;
}

function yes(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}

function timingSafeMatch(value: string, expected: string): boolean {
  const digest = (input: string): Buffer => createHash('sha256').update(input, 'utf8').digest();
  return timingSafeEqual(digest(value), digest(expected));
}

function queryLedgerFilters(context: Context) {
  return {
    ...(context.req.query('date') ? { date: context.req.query('date') } : {}),
    ...(context.req.query('from') ? { from: context.req.query('from') } : {}),
    ...(context.req.query('to') ? { to: context.req.query('to') } : {}),
    ...(context.req.query('search') ? { search: context.req.query('search') } : {}),
    ...(integer(context.req.query('methodId')) ? { methodId: integer(context.req.query('methodId')) } : {}),
    ...(integer(context.req.query('categoryId')) ? { categoryId: integer(context.req.query('categoryId')) } : {}),
    ...(integer(context.req.query('payeeId')) ? { payeeId: integer(context.req.query('payeeId')) } : {}),
    includeVoided: yes(context.req.query('includeVoided')),
    voidedOnly: yes(context.req.query('voidedOnly')),
    ...(integer(context.req.query('page')) ? { page: integer(context.req.query('page')) } : {}),
    ...(integer(context.req.query('pageSize')) ? { pageSize: integer(context.req.query('pageSize')) } : {})
  };
}

export function createMuseApi(runtime: DatabaseRuntime, apiKey: string): Hono {
  const muse = new Hono();
  const ledger = new LedgerService(runtime);

  muse.use('*', async (context, next) => {
    const header = context.req.header('x-muse-key');
    const bearer = context.req.header('authorization')?.replace(/^Bearer\s+/i, '');
    const provided = header ?? (bearer !== undefined ? bearer : undefined);
    if (!provided || !timingSafeMatch(provided, apiKey)) {
      return context.json<ErrorBody>(
        { error: { code: 'MUSE_UNAUTHORIZED', message: 'Missing or invalid X-Muse-Key header' } },
        401
      );
    }
    await next();
  });

  muse.get('/v1/state', (context) =>
    context.json({
      clock: businessNow(),
      masterData: ledger.getMasterData({ includeInactive: true }),
      system: ledger.getSystemStatus()
    })
  );

  muse.get('/v1/transactions', (context) => context.json(ledger.listTransactions(queryLedgerFilters(context))));

  muse.get('/v1/payees/:id/transactions', (context) =>
    context.json(
      ledger.listTransactions({
        payeeId: id(context.req.param('id')),
        pageSize: integer(context.req.query('pageSize'))
      })
    )
  );

  muse.post('/v1/quick-entry/preview', async (context) => {
    const body = await context.req.json<{ command: string }>();
    return context.json(ledger.previewQuickEntry(body.command));
  });

  muse.post('/v1/quick-entry/save', async (context) => {
    const body = await context.req.json<{
      command: string;
      confirmNewPayee?: boolean;
      confirmDuplicate?: boolean;
      source?: string;
    }>();
    const result = await ledger.createFromCommand(body.command, {
      confirmNewPayee: body.confirmNewPayee,
      confirmDuplicate: body.confirmDuplicate,
      ...(body.source === 'muse' || body.source === 'telegram' ? { source: body.source } : {})
    });
    return context.json(result, 201);
  });

  muse.post('/v1/transactions/:id/void', async (context) => {
    const body = await context.req.json<{ reason: string }>();
    return context.json(await ledger.voidTransaction(id(context.req.param('id')), body.reason));
  });

  muse.post('/v1/transactions/:id/unvoid', async (context) =>
    context.json(await ledger.unvoidTransaction(id(context.req.param('id'))))
  );

  muse.get('/v1/transactions/:id/audit', (context) =>
    context.json(ledger.getTransactionAudit(id(context.req.param('id'))))
  );

  muse.get('/v1/dashboard', (context) => context.json(ledger.getDashboard(context.req.query('date'))));

  muse.get('/v1/activity', (context) => context.json(ledger.getActivity(integer(context.req.query('limit')))));

  muse.get('/v1/reports', (context) => {
    const clock = businessNow();
    return context.json(
      ledger.getReports(
        context.req.query('from') ?? `${clock.date.slice(0, 8)}01`,
        context.req.query('to') ?? clock.date,
        {
          reportGroup: context.req.query('reportGroup') || undefined,
          categoryId: integer(context.req.query('categoryId')),
          payeeId: integer(context.req.query('payeeId')),
          paymentMethodId: integer(context.req.query('paymentMethodId')),
          needsReview: yes(context.req.query('needsReview'))
        }
      )
    );
  });

  return muse;
}

interface ErrorBody {
  error: { code: string; message: string };
}
