import { LedgerService, businessNow, type DatabaseRuntime } from '@payment-ledger/database';
import { Hono, type Context } from 'hono';
import { buildTransactionsWorkbook } from './export-xlsx.js';

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

export function createApi(runtime: DatabaseRuntime): Hono {
  const api = new Hono();
  const ledger = new LedgerService(runtime);

  api.get('/clock', (context) => context.json(businessNow()));
  api.get('/activity', (context) => context.json(ledger.getActivity(integer(context.req.query('limit')))));
  api.get('/system/status', (context) => {
    const settings = Object.fromEntries(
      (runtime.sqlite
        .prepare("SELECT key, value FROM app_settings WHERE key LIKE 'telegram.%'")
        .all() as Array<{ key: string; value: string }>).map((row) => [row.key, row.value])
    );
    const enabled = process.env.TELEGRAM_ENABLED === 'true';
    const configured = Boolean(
      process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ALLOWED_USER_ID && process.env.TELEGRAM_ALLOWED_CHAT_ID
    );
    const setting = (key: string): string | null => {
      const raw = settings[key];
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as unknown;
        return typeof parsed === 'string' || typeof parsed === 'number' ? String(parsed) : raw;
      } catch {
        return raw;
      }
    };
    const notifications = ledger.getNotificationSettings();
    return context.json({
      ...ledger.getSystemStatus(),
      telegram: {
        enabled,
        configured,
        status: enabled && configured ? 'active' : enabled ? 'incomplete' : 'disabled',
        forwardEnabled: notifications.forwardEnabled,
        summariesEnabled: notifications.summariesEnabled,
        summaryTimes: process.env.TELEGRAM_SUMMARY_TIMES || '18:00,20:00',
        lastForwardedTransactionId: Number(setting('telegram.forward.last_transaction_id') || 0),
        lastSummary6Date: setting('telegram.summary.18:00.last_date'),
        lastSummary8Date: setting('telegram.summary.20:00.last_date'),
        panelVersion: setting('telegram.panel.version')
      }
    });
  });
  api.get('/settings', (context) => context.json(ledger.getNotificationSettings()));
  api.patch('/settings', async (context) => {
    const body = await context.req.json<Parameters<typeof ledger.updateNotificationSettings>[0]>();
    return context.json(ledger.updateNotificationSettings(body));
  });

  api.get('/dashboard', (context) => context.json(ledger.getDashboard(context.req.query('date'))));

  api.get('/master-data', (context) =>
    context.json(
      ledger.getMasterData({ includeInactive: yes(context.req.query('includeInactive')) })
    )
  );
  api.post('/payees', async (context) => {
    const body = await context.req.json<Parameters<typeof ledger.createPayee>[0]>();
    return context.json(ledger.createPayee(body), 201);
  });
  api.patch('/payees/:id', async (context) => {
    const body = await context.req.json<Parameters<typeof ledger.updatePayee>[1]>();
    return context.json(ledger.updatePayee(id(context.req.param('id')), body));
  });
  api.delete('/payees/:id', async (context) => {
    const force = context.req.query('force') === 'true';
    let confirmPhrase: string | undefined;
    if (force) {
      try {
        const body = await context.req.json<{ confirm?: string }>();
        confirmPhrase = body.confirm;
      } catch {
        confirmPhrase = undefined;
      }
    }
    return context.json(
      await ledger.deletePayee(id(context.req.param('id')), {
        force,
        ...(confirmPhrase === undefined ? {} : { confirmPhrase })
      })
    );
  });
  api.post('/payees/:id/restore', async (context) => {
    const updated = ledger.updatePayee(id(context.req.param('id')), { active: true });
    return context.json(updated);
  });
  api.post('/categories', async (context) => {
    const body = await context.req.json<Parameters<typeof ledger.createCategory>[0]>();
    return context.json(ledger.createCategory(body), 201);
  });
  api.patch('/categories/:id', async (context) => {
    const body = await context.req.json<Parameters<typeof ledger.updateCategory>[1]>();
    return context.json(ledger.updateCategory(id(context.req.param('id')), body));
  });
  api.delete('/categories/:id', async (context) => {
    return context.json(ledger.deleteCategory(id(context.req.param('id'))));
  });
  api.post('/payment-methods', async (context) => {
    const body = await context.req.json<Parameters<typeof ledger.createPaymentMethod>[0]>();
    return context.json(ledger.createPaymentMethod(body), 201);
  });
  api.patch('/payment-methods/:id', async (context) => {
    const body = await context.req.json<Parameters<typeof ledger.updatePaymentMethod>[1]>();
    return context.json(ledger.updatePaymentMethod(id(context.req.param('id')), body));
  });
  api.delete('/payment-methods/:id', async (context) => {
    return context.json(ledger.deletePaymentMethod(id(context.req.param('id'))));
  });

  api.post('/quick-entry/preview', async (context) => {
    const body = await context.req.json<{ command: string }>();
    return context.json(ledger.previewQuickEntry(body.command));
  });
  api.post('/quick-entry/save', async (context) => {
    const body = await context.req.json<{ command: string; confirmNewPayee?: boolean; confirmDuplicate?: boolean }>();
    return context.json(await ledger.createFromCommand(body.command, {
      confirmNewPayee: body.confirmNewPayee,
      confirmDuplicate: body.confirmDuplicate
    }), 201);
  });

  api.get('/transactions', (context) =>
    context.json(
      ledger.listTransactions({
        ...(context.req.query('date') ? { date: context.req.query('date') } : {}),
        ...(context.req.query('from') ? { from: context.req.query('from') } : {}),
        ...(context.req.query('to') ? { to: context.req.query('to') } : {}),
        ...(context.req.query('search') ? { search: context.req.query('search') } : {}),
        ...(integer(context.req.query('methodId'))
          ? { methodId: integer(context.req.query('methodId')) }
          : {}),
        ...(integer(context.req.query('categoryId'))
          ? { categoryId: integer(context.req.query('categoryId')) }
          : {}),
        ...(integer(context.req.query('payeeId'))
          ? { payeeId: integer(context.req.query('payeeId')) }
          : {}),
        reviewOnly: yes(context.req.query('reviewOnly')),
        includeVoided: yes(context.req.query('includeVoided')),
        voidedOnly: yes(context.req.query('voidedOnly')),
        ...(integer(context.req.query('page')) ? { page: integer(context.req.query('page')) } : {}),
        ...(integer(context.req.query('pageSize'))
          ? { pageSize: integer(context.req.query('pageSize')) }
          : {})
      })
    )
  );
  api.post('/transactions', async (context) => {
    const body = await context.req.json<Parameters<typeof ledger.createTransaction>[0]>();
    return context.json(await ledger.createTransaction(body), 201);
  });
  api.post('/transactions/batch', async (context) => {
    const body = await context.req.json<Parameters<typeof ledger.createBatchTransactions>[0]>();
    return context.json(ledger.createBatchTransactions(body), 201);
  });
  api.get('/transactions/:id', (context) =>
    context.json(ledger.getTransaction(id(context.req.param('id'))))
  );
  api.patch('/transactions/:id', async (context) => {
    const body = await context.req.json<Parameters<typeof ledger.correctTransaction>[1]>();
    return context.json(await ledger.correctTransaction(id(context.req.param('id')), body));
  });
  api.post('/transactions/:id/void', async (context) => {
    const body = await context.req.json<{ reason: string }>();
    return context.json(await ledger.voidTransaction(id(context.req.param('id')), body.reason));
  });
  api.post('/transactions/:id/unvoid', async (context) =>
    context.json(await ledger.unvoidTransaction(id(context.req.param('id'))))
  );
  api.get('/transactions/:id/audit', (context) =>
    context.json(ledger.getTransactionAudit(id(context.req.param('id'))))
  );

  api.get('/reports', (context) => {
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
  const exportFilters = (context: Context) => ({
    ...(context.req.query('date') ? { date: context.req.query('date') } : {}),
    ...(context.req.query('from') ? { from: context.req.query('from') } : {}),
    ...(context.req.query('to') ? { to: context.req.query('to') } : {}),
    ...(context.req.query('search') ? { search: context.req.query('search') } : {}),
    ...(integer(context.req.query('methodId')) ? { methodId: integer(context.req.query('methodId')) } : {}),
    ...(integer(context.req.query('categoryId')) ? { categoryId: integer(context.req.query('categoryId')) } : {}),
    ...(integer(context.req.query('payeeId')) ? { payeeId: integer(context.req.query('payeeId')) } : {}),
    reviewOnly: yes(context.req.query('reviewOnly')),
    includeVoided: yes(context.req.query('includeVoided')),
    voidedOnly: yes(context.req.query('voidedOnly'))
  });

  api.get('/export/transactions.csv', (context) => {
    const csv = ledger.exportTransactionsCsv(exportFilters(context));
    context.header('Content-Type', 'text/csv; charset=utf-8');
    context.header('Content-Disposition', 'attachment; filename="payment-ledger.csv"');
    return context.body(`\uFEFF${csv}`);
  });
  api.get('/export/transactions.xlsx', async (context) => {
    const filters = exportFilters(context);
    const items = ledger.collectTransactionsForExport(filters);
    const workbook = await buildTransactionsWorkbook(items, { from: filters.from, to: filters.to });
    context.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    context.header('Content-Disposition', 'attachment; filename="payment-ledger.xlsx"');
    return context.body(workbook);
  });
  api.post('/system/backup', async (context) => context.json(await ledger.createBackup(), 201));

  return api;
}
