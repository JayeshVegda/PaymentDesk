import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase, type DatabaseRuntime } from '@payment-ledger/database';
import { createApp } from './app.js';

const MUSE_KEY = 'test-muse-key-0123456789';

const runtimes: DatabaseRuntime[] = [];
const directories: string[] = [];

afterEach(async () => {
  for (const runtime of runtimes.splice(0)) await runtime.close();
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, maxRetries: 5, retryDelay: 100 });
});

function fixture(museApiKey?: string) {
  const directory = mkdtempSync(join(tmpdir(), 'payment-ledger-muse-test-'));
  directories.push(directory);
  const runtime = openDatabase({ databasePath: join(directory, 'ledger.sqlite3') });
  runtimes.push(runtime);
  return createApp({
    runtime,
    expectedHost: '127.0.0.1:4782',
    webBuildDirectory: directory,
    logLevel: 'silent',
    ...(museApiKey ? { museApiKey } : {})
  });
}

function withKey(headers: Record<string, string> = {}): Record<string, string> {
  return { host: '127.0.0.1:4782', 'x-muse-key': MUSE_KEY, ...headers };
}

describe('muse api', () => {
  it('mounts nothing when the key is absent', async () => {
    const response = await fixture().request('/muse/v1/state', { headers: withKey() });
    expect(response.status).toBe(404);
  });

  it('rejects requests without or with a wrong key', async () => {
    const app = fixture(MUSE_KEY);
    const missing = await app.request('/muse/v1/state', { headers: { host: '127.0.0.1:4782' } });
    expect(missing.status).toBe(401);
    const wrong = await app.request('/muse/v1/state', {
      headers: { host: '127.0.0.1:4782', 'x-muse-key': 'wrong-key' }
    });
    expect(wrong.status).toBe(401);
    const wrongBearer = await app.request('/muse/v1/state', {
      headers: { host: '127.0.0.1:4782', authorization: 'Bearer wrong-key' }
    });
    expect(wrongBearer.status).toBe(401);
  });

  it('bootstraps clock, master data and system state in one call', async () => {
    const response = await fixture(MUSE_KEY).request('/muse/v1/state', { headers: withKey() });
    expect(response.status).toBe(200);
    const body: { clock: { date: string }; masterData: { payees: unknown[]; paymentMethods: unknown[] }; system: unknown } =
      await response.json();
    expect(body.clock.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.masterData.paymentMethods.length).toBeGreaterThan(0);
  });

  it('accepts the bearer token alternative', async () => {
    const response = await fixture(MUSE_KEY).request('/muse/v1/state', {
      headers: { host: '127.0.0.1:4782', authorization: `Bearer ${MUSE_KEY}` }
    });
    expect(response.status).toBe(200);
  });

  it('previews a quick entry command without saving', async () => {
    const response = await fixture(MUSE_KEY).request('/muse/v1/quick-entry/preview', {
      method: 'POST',
      headers: withKey({ 'content-type': 'application/json' }),
      body: JSON.stringify({ command: 'Maya Traders 2.5k "advance adjustment"' })
    });
    expect(response.status).toBe(200);
    const body: { valid: boolean; payeeName: string | null; amountPaise: number | null; errors: string[] } =
      await response.json();
    expect(body.valid).toBe(true);
    expect(body.payeeName).toBe('Maya Traders');
    expect(body.amountPaise).toBe(250_000);
  });

  it('creates, voids, queries and restores a transaction with confirmations', async () => {
    const app = fixture(MUSE_KEY);
    const jsonHeaders = withKey({ 'content-type': 'application/json' });

    const unconfirmed = await app.request('/muse/v1/quick-entry/save', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ command: 'Maya Traders 2.5k advance "sample"', source: 'muse' })
    });
    expect(unconfirmed.status).toBe(409);
    expect((await unconfirmed.json()).error.code).toBe('NEW_PAYEE_UNCONFIRMED');

    const confirmed = await app.request('/muse/v1/quick-entry/save', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        command: 'Maya Traders 2.5k advance "sample"',
        confirmNewPayee: true,
        source: 'muse'
      })
    });
    expect(confirmed.status).toBe(201);
    const created: { transaction: { id: number; payeeId: number } | null; createdPayee: boolean } =
      await confirmed.json();
    expect(created.createdPayee).toBe(true);
    expect(created.transaction).not.toBeNull();
    const transactionId = created.transaction!.id;

    const duplicate = await app.request('/muse/v1/quick-entry/save', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ command: 'Maya Traders 2.5k' })
    });
    expect(duplicate.status).toBe(409);
    expect((await duplicate.json()).error.code).toBe('DUPLICATE_TRANSACTION');

    const listed = await app.request('/muse/v1/payees/' + created.transaction!.payeeId + '/transactions', {
      headers: withKey()
    });
    const listBody: { items: Array<{ id: number }> } = await listed.json();
    expect(listBody.items.some((row) => row.id === transactionId)).toBe(true);

    const auditBefore = await app.request(`/muse/v1/transactions/${transactionId}/audit`, {
      headers: withKey()
    });
    expect(auditBefore.status).toBe(200);

    const voided = await app.request(`/muse/v1/transactions/${transactionId}/void`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ reason: 'Muse test undo' })
    });
    expect(voided.status).toBe(200);

    const restored = await app.request(`/muse/v1/transactions/${transactionId}/unvoid`, {
      method: 'POST',
      headers: jsonHeaders
    });
    expect(restored.status).toBe(200);
  });

  it('records silent payments through the quick-entry prefix', async () => {
    const app = fixture(MUSE_KEY);
    const response = await app.request('/muse/v1/quick-entry/save', {
      method: 'POST',
      headers: withKey({ 'content-type': 'application/json' }),
      body: JSON.stringify({ command: 'silent quiet trader 1.2k wages', confirmNewPayee: true, source: 'muse' })
    });
    expect(response.status).toBe(201);
    const created: { transaction: { id: number } } = await response.json();

    const audit = await app.request(`/muse/v1/transactions/${created.transaction.id}/audit`, {
      headers: withKey()
    });
    const entries: Array<{ newData: { silent: boolean; source: string } }> = await audit.json();
    const [createdEntry] = entries;
    expect(createdEntry?.newData.silent).toBe(true);
    expect(createdEntry?.newData.source).toBe('muse');
  });

  it('exposes dashboard, activity and reports', async () => {
    const app = fixture(MUSE_KEY);
    const dashboard = await app.request('/muse/v1/dashboard', { headers: withKey() });
    expect(dashboard.status).toBe(200);
    const activity = await app.request('/muse/v1/activity?limit=5', { headers: withKey() });
    expect(activity.status).toBe(200);
    const reports = await app.request('/muse/v1/reports', { headers: withKey() });
    expect(reports.status).toBe(200);
  });
});
