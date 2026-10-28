import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { TransactionService, TransactionConflictError } from '@payment-ledger/core';
import {
  businessNow,
  LedgerService,
  migrateDatabase,
  openDatabase,
  SqliteTransactionRepository
} from './index.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { recursive: true, maxRetries: 5, retryDelay: 100 });
});

function createFixture() {
  const directory = mkdtempSync(join(tmpdir(), 'payment-ledger-test-'));
  temporaryDirectories.push(directory);
  const runtime = openDatabase({ databasePath: join(directory, 'ledger.sqlite3') });
  const categoryId = Number(
    runtime.sqlite.prepare("SELECT id FROM categories WHERE name = 'Tools'").pluck().get()
  );
  const methodId = Number(
    runtime.sqlite.prepare("SELECT id FROM payment_methods WHERE code = 'cash'").pluck().get()
  );
  const payeeId = Number(
    runtime.sqlite
      .prepare(
        "INSERT INTO payees (type, name, normalized_name) VALUES ('person', 'Ramesh', 'ramesh')"
      )
      .run().lastInsertRowid
  );
  return { runtime, categoryId, methodId, payeeId };
}

describe('database foundation', () => {
  it('enables reliability pragmas and applies migrations idempotently', async () => {
    const { runtime } = createFixture();
    expect(runtime.sqlite.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(runtime.sqlite.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(runtime.sqlite.pragma('busy_timeout', { simple: true })).toBe(5000);
    expect(migrateDatabase(runtime.sqlite)).toEqual([]);
    expect(runtime.sqlite.prepare('SELECT count(*) FROM schema_migrations').pluck().get()).toBe(12);
    await runtime.close();
  });

  it('creates, corrects and voids with append-only audit records', async () => {
    const { runtime, categoryId, methodId, payeeId } = createFixture();
    const service = new TransactionService(new SqliteTransactionRepository(runtime.db));
    const created = await service.create({
      transactionDate: '2026-08-01',
      transactionTime: '09:30:00',
      payeeId,
      amountPaise: 80_000,
      categoryId,
      paymentMethodId: methodId,
      note: 'Furnace work',
      source: 'web',
      needsReview: false
    });
    const corrected = await service.correct(created.id, {
      amountPaise: 85_000,
      expectedUpdatedAt: created.updatedAt,
      source: 'web'
    });
    expect(corrected.version).toBe(2);
    await expect(
      service.correct(created.id, {
        amountPaise: 90_000,
        expectedUpdatedAt: created.updatedAt,
        source: 'web'
      })
    ).rejects.toBeInstanceOf(TransactionConflictError);
    const voided = await service.void(created.id, 'Duplicate entry', 'web');
    expect(voided.status).toBe('voided');
    expect(runtime.sqlite.prepare('SELECT count(*) FROM transaction_audit').pluck().get()).toBe(3);
    expect(runtime.sqlite.prepare('SELECT count(*) FROM transaction_audit WHERE transaction_id = ?').pluck().get(created.id)).toBe(3);
    await runtime.close();
  });

  it('rejects a changed migration checksum', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'payment-ledger-migration-test-'));
    temporaryDirectories.push(directory);
    const migrations = join(directory, 'migrations');
    const { mkdirSync } = await import('node:fs');
    mkdirSync(migrations);
    writeFileSync(
      join(migrations, '001_test.sql'),
      'CREATE TABLE test (id INTEGER PRIMARY KEY) STRICT;'
    );
    const runtime = openDatabase({
      databasePath: join(directory, 'ledger.sqlite3'),
      migrate: false
    });
    migrateDatabase(runtime.sqlite, migrations);
    const original = readFileSync(join(migrations, '001_test.sql'), 'utf8');
    writeFileSync(join(migrations, '001_test.sql'), `${original}\n-- changed`);
    expect(() => migrateDatabase(runtime.sqlite, migrations)).toThrow(/checksum changed/);
    await runtime.close();
  });

  it('supports master data, quick capture and reports', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'payment-ledger-product-test-'));
    temporaryDirectories.push(directory);
    const runtime = openDatabase({ databasePath: join(directory, 'ledger.sqlite3') });
    const ledger = new LedgerService(runtime);
    const master = ledger.getMasterData();
    const cash = master.paymentMethods.find((method) => method.code === 'cash');
    const tools = master.categories.find((category) => category.name === 'Tools');
    const payee = ledger.createPayee({
      type: 'company',
      name: 'ABC Tools',
      aliases: ['abc'],
      defaultCategoryId: tools?.id ?? null,
      defaultPaymentMethodId: cash?.id ?? null,
      favourite: true
    });
    const preview = ledger.previewQuickEntry('abc 12.5k drill bits');
    expect(preview).toMatchObject({ valid: true, payeeId: payee.id, amountPaise: 1_250_000 });
    expect(ledger.previewQuickEntry('abc 800 3-jan')).toMatchObject({
      transactionDate: '2026-01-03',
      paymentMethodName: 'Cash',
      note: null
    });
    expect(ledger.previewQuickEntry('abc 800 bank 3-jan')).toMatchObject({
      paymentMethodName: 'Bank transfer'
    });
    expect(ledger.previewQuickEntry('abc 800 3-1-2026')).toMatchObject({
      transactionDate: '2026-01-03',
      note: null
    });
    expect(ledger.previewQuickEntry('abc 800 25/06/2026')).toMatchObject({
      transactionDate: '2026-06-25',
      note: null
    });
    const saved = await ledger.createFromCommand('abc 12.5k drill bits');
    expect(saved.transaction?.amountPaise).toBe(1_250_000);
    const clock = businessNow();
    const reports = ledger.getReports(clock.date, clock.date);
    expect((reports.totals as { paymentCount: number }).paymentCount).toBe(1);
    expect(
      (reports.categories[0] as { averageTransactionPaise: number }).averageTransactionPaise
    ).toBe(1_250_000);
    await runtime.close();
  });

  it('installs the exact cash-out taxonomy with notes and aliases', async () => {
    const { runtime } = createFixture();
    const categories = new LedgerService(runtime).getMasterData().categories;
    expect(categories.map((category) => category.name)).toEqual([
      'Raw Material', 'Tools', 'Supplies', 'Machines', 'Repairs', 'Wages', 'Outside Work',
      'Power & Fuel', 'Transport', 'Packing', 'Factory Expense', 'Office Expense',
      'Tax & Fees', 'Advance', 'Investment'
    ]);
    expect(categories.every((category) => category.note.length > 0)).toBe(true);
    expect(categories.find((category) => category.name === 'Raw Material')?.aliases).toContain('brass');
    expect(categories.find((category) => category.name === 'Advance')?.sortOrder).toBe(140);
    expect(categories.find((category) => category.name === 'Investment')).toMatchObject({
      sortOrder: 170,
      aliases: expect.arrayContaining(['SIP', 'mutual fund', 'fixed deposit', 'NPS'])
    });
    await runtime.close();
  });

  it('supports category CRUD, removes aliases, and archives referenced categories', async () => {
    const { runtime, payeeId } = createFixture();
    const ledger = new LedgerService(runtime);
    const created = ledger.createCategory({ name: 'Test Category', aliases: ['test cat'], note: 'Test note', sortOrder: 999 });
    expect(created).toMatchObject({ name: 'Test Category', note: 'Test note', aliases: expect.arrayContaining(['test cat']) });
    const updated = ledger.updateCategory(created!.id, { name: 'Edited Category', aliases: ['edited'], note: 'Edited note', sortOrder: 998 });
    expect(updated).toMatchObject({ name: 'Edited Category', note: 'Edited note', sortOrder: 998 });
    expect(ledger.deleteCategory(created!.id)).toEqual({ status: 'deleted' });
    expect(runtime.sqlite.prepare('SELECT count(*) FROM category_aliases WHERE category_id = ?').pluck().get(created!.id)).toBe(0);
    const linked = ledger.createCategory({ name: 'Linked Category' })!;
    runtime.sqlite.prepare('UPDATE payees SET default_category_id = ? WHERE id = ?').run(linked.id, payeeId);
    expect(ledger.deleteCategory(linked.id)).toEqual({ status: 'archived', count: 1 });
    expect(ledger.getMasterData({ includeInactive: true }).categories.find((category) => category.id === linked.id)?.active).toBe(false);
    expect(() => ledger.createCategory({ name: 'Tools' })).toThrow();
    expect(() => ledger.updateCategory(999999, { name: 'Missing' })).toThrow(/not found/);
    await runtime.close();
  });

  it('supports payment-method CRUD and archives referenced methods', async () => {
    const { runtime, payeeId } = createFixture();
    const ledger = new LedgerService(runtime);
    const created = ledger.createPaymentMethod({ code: 'card', displayName: 'Card' })!;
    expect(ledger.updatePaymentMethod(created.id, { code: 'credit-card', displayName: 'Credit Card' })).toMatchObject({ code: 'credit-card', displayName: 'Credit Card' });
    expect(ledger.deletePaymentMethod(created.id)).toEqual({ status: 'deleted' });
    const linked = ledger.createPaymentMethod({ code: 'wallet', displayName: 'Wallet' })!;
    runtime.sqlite.prepare('UPDATE payees SET default_payment_method_id = ? WHERE id = ?').run(linked.id, payeeId);
    expect(ledger.deletePaymentMethod(linked.id)).toEqual({ status: 'archived', count: 1 });
    expect(() => ledger.createPaymentMethod({ code: 'cash', displayName: 'Duplicate Cash' })).toThrow();
    expect(() => ledger.updatePaymentMethod(999999, { displayName: 'Missing' })).toThrow(/not found/);
    await runtime.close();
  });

  it('deletes unused payees and archives payees that have transactions', async () => {
    const { runtime, categoryId, methodId } = createFixture();
    const ledger = new LedgerService(runtime);
    const unused = ledger.createPayee({ type: 'person', name: 'Unused Payee', aliases: ['unused'] });
    expect(await ledger.deletePayee(unused.id)).toEqual({ status: 'deleted' });
    const linked = ledger.createPayee({ type: 'company', name: 'Linked Payee' });
    runtime.sqlite.prepare(`INSERT INTO transactions (transaction_date, transaction_time, payee_id, amount_paise, category_id, payment_method_id, source) VALUES ('2026-08-03','10:00:00',?,?,?,?, 'web')`).run(linked.id, 10000, categoryId, methodId);
    expect(await ledger.deletePayee(linked.id)).toEqual({ status: 'archived', count: 1 });
    expect(ledger.getMasterData({ includeInactive: true }).payees.find((payee) => payee.id === linked.id)?.active).toBe(false);
    expect(() => ledger.createPayee({ type: 'person', name: 'Linked Payee' })).toThrow();
    await runtime.close();
  });

  it('allows an uncategorised new payee and remembers a supplied category', async () => {
    const { runtime } = createFixture();
    const ledger = new LedgerService(runtime);

    const review = await ledger.createFromCommand('mahis 3l', { confirmNewPayee: true });
    expect(review.transaction).toMatchObject({ needsReview: true, categoryId: null });
    expect(ledger.getMasterData({ includeInactive: true }).payees.find((payee) => payee.id === review.transaction?.payeeId)?.defaultCategoryId).toBeNull();

    const posted = await ledger.createFromCommand('nilesh 2l tools', { confirmNewPayee: true });
    expect(posted.transaction).toMatchObject({ needsReview: false });
    expect(ledger.getMasterData({ includeInactive: true }).payees.find((payee) => payee.id === posted.transaction?.payeeId)?.defaultCategoryId).toBe(posted.transaction?.categoryId ?? null);

    await runtime.close();
  });

  it('runs test-mode quick entries without storing anything', async () => {
    const { runtime, categoryId, methodId, payeeId } = createFixture();
    const ledger = new LedgerService(runtime);
    runtime.sqlite
      .prepare('UPDATE payees SET default_category_id = ?, default_payment_method_id = ? WHERE id = ?')
      .run(categoryId, methodId, payeeId);

    const before = Number(runtime.sqlite.prepare('SELECT count(*) FROM transactions').pluck().get());
    const result = await ledger.createFromCommand(`test ramesh 800`);
    expect(result.testRun).toBe(true);
    expect(result.transaction).toBeNull();

    const afterCount = Number(runtime.sqlite.prepare('SELECT count(*) FROM transactions').pluck().get());
    expect(afterCount).toBe(before);
    expect(Number(runtime.sqlite.prepare('SELECT count(*) FROM transaction_audit').pluck().get())).toBe(0);
    await runtime.close();
  });

  it('stores the silent flag and keeps silent rows out of telegram forwarding scope', async () => {
    const { runtime, categoryId, methodId, payeeId } = createFixture();
    const service = new TransactionService(new SqliteTransactionRepository(runtime.db));
    const created = await service.create({
      transactionDate: '2026-08-01',
      transactionTime: '10:00:00',
      payeeId,
      amountPaise: 12_000,
      categoryId,
      paymentMethodId: methodId,
      note: 'quiet entry',
      source: 'web',
      needsReview: false,
      silent: true
    });
    expect(created.silent).toBe(true);
    const row = runtime.sqlite.prepare('SELECT silent FROM transactions WHERE id = ?').pluck().get(created.id);
    expect(row).toBe(1);
    await runtime.close();
  });

  it('restores a voided transaction and records a restored audit row', async () => {
    const { runtime, categoryId, methodId, payeeId } = createFixture();
    const ledger = new LedgerService(runtime);
    runtime.sqlite
      .prepare(
        `INSERT INTO transactions (transaction_date, transaction_time, payee_id, amount_paise, category_id, payment_method_id, source)
         VALUES ('2026-08-03','10:00:00',?,?,?,?,'web')`
      )
      .run(payeeId, 20_000, categoryId, methodId);
    const id = Number(runtime.sqlite.prepare('SELECT max(id) FROM transactions').pluck().get());

    await ledger.voidTransaction(id, 'mistake');
    expect(ledger.getTransaction(id).status).toBe('voided');

    const restored = await ledger.unvoidTransaction(id);
    expect(restored.status).toBe('posted');
    const actions = (ledger.getTransactionAudit(id) as Array<{ action: string }>).map((row) => row.action);
    expect(actions).toContain('restored');
    await runtime.close();
  });

  it('guards force deletion behind a confirmation phrase and logs destruction', async () => {
    const { runtime, categoryId, methodId, payeeId } = createFixture();
    const ledger = new LedgerService(runtime);
    runtime.sqlite
      .prepare(
        `INSERT INTO transactions (transaction_date, transaction_time, payee_id, amount_paise, category_id, payment_method_id, source)
         VALUES ('2026-08-03','10:00:00',?,?,?,?,'web')`
      )
      .run(payeeId, 30_000, categoryId, methodId);
    runtime.sqlite
      .prepare("UPDATE payees SET name = 'Zed Corp', normalized_name = 'zed corp' WHERE id = ?")
      .run(payeeId);

    // wrong phrase is rejected with a TypeError -> maps to 400 at the API layer
    await expect(
      ledger.deletePayee(payeeId, { force: true, confirmPhrase: 'delete zed corp' })
    ).rejects.toThrow(TypeError);

    const result = await ledger.deletePayee(payeeId, { force: true, confirmPhrase: 'DELETE Zed Corp' });
    expect(result).toMatchObject({ status: 'deleted', forced: true, cleanedTransactions: 1 });
    expect(result.backupFile).toBeTruthy();

    const log = runtime.sqlite
      .prepare('SELECT entity_name, transaction_count, backup_file FROM destruction_log')
      .all() as Array<{ entity_name: string; transaction_count: number; backup_file: string | null }>;
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ entity_name: 'Zed Corp', transaction_count: 1 });
    expect(log[0]?.backup_file).toBeTruthy();

    const remainingTransactions = Number(
      runtime.sqlite.prepare('SELECT count(*) FROM transactions WHERE payee_id = ?').pluck().get(payeeId)
    );
    expect(remainingTransactions).toBe(0);
    await runtime.close();
  });

  it('neutralises spreadsheet formula injection in csv export', async () => {
    const { runtime } = createFixture();
    const ledger = new LedgerService(runtime);
    runtime.sqlite
      .prepare(
        `INSERT INTO payees (type, name, normalized_name) VALUES ('company', '=HYPERLINK(evil)', '=hyperlink(evil)')`
      )
      .run();
    const hostilePayeeId = Number(runtime.sqlite.prepare('SELECT max(id) FROM payees').pluck().get());
    const categoryId = Number(runtime.sqlite.prepare("SELECT id FROM categories WHERE name = 'Tools'").pluck().get());
    const methodId = Number(runtime.sqlite.prepare("SELECT id FROM payment_methods WHERE code = 'cash'").pluck().get());
    runtime.sqlite
      .prepare(
        `INSERT INTO transactions (transaction_date, transaction_time, payee_id, amount_paise, category_id, payment_method_id, source)
         VALUES ('2026-08-03','10:00:00',?,?,?,?,'web')`
      )
      .run(hostilePayeeId, 5_000, categoryId, methodId);

    const csv = ledger.exportTransactionsCsv({});
    expect(csv).toContain("'=HYPERLINK");
    await runtime.close();
  });
});
