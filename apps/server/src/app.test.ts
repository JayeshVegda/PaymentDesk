import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase, type DatabaseRuntime } from '@payment-ledger/database';
import { createApp } from './app.js';

const runtimes: DatabaseRuntime[] = [];
const directories: string[] = [];

afterEach(async () => {
  for (const runtime of runtimes.splice(0)) await runtime.close();
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, maxRetries: 5, retryDelay: 100 });
});

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'payment-ledger-server-test-'));
  directories.push(directory);
  const runtime = openDatabase({ databasePath: join(directory, 'ledger.sqlite3') });
  runtimes.push(runtime);
  return createApp({
    runtime,
    expectedHost: '127.0.0.1:4782',
    webBuildDirectory: directory,
    logLevel: 'silent'
  });
}

describe('server app', () => {
  it('reports application and database health', async () => {
    const response = await fixture().request('/api/health', {
      headers: { host: '127.0.0.1:4782' }
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      version: '0.1.0',
      database: 'ok'
    });
  });

  it('rejects unexpected hosts and origins', async () => {
    const app = fixture();
    const hostResponse = await app.request('/api/health', { headers: { host: 'evil.example' } });
    expect(hostResponse.status).toBe(403);
    const originResponse = await app.request('/api/missing', {
      method: 'POST',
      headers: { host: '127.0.0.1:4782', origin: 'https://evil.example' }
    });
    expect(originResponse.status).toBe(403);
  });

  it('accepts the configured HTTPS origin', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'payment-ledger-server-test-'));
    directories.push(directory);
    const runtime = openDatabase({ databasePath: join(directory, 'ledger.sqlite3') });
    runtimes.push(runtime);
    const app = createApp({
      runtime,
      expectedHost: 'ledger.local',
      expectedOrigin: 'https://ledger.local',
      webBuildDirectory: directory,
      logLevel: 'silent'
    });
    const response = await app.request('/api/missing', {
      method: 'POST',
      headers: { host: 'ledger.local', origin: 'https://ledger.local' }
    });
    expect(response.status).toBe(404);
  });

  it('returns a typed API 404', async () => {    const response = await fixture().request('/api/missing', {
      headers: { host: '127.0.0.1:4782' }
    });
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'NOT_FOUND' } });
  });

  it('supports master-data CRUD and safe linked-record deletion through the API', async () => {
    const app = fixture();
    const headers = { host: '127.0.0.1:4782', 'content-type': 'application/json' };
    const categoryResponse = await app.request('/api/categories', {
      method: 'POST', headers,
      body: JSON.stringify({ name: 'API Category', aliases: ['api-cat'], note: 'API note', sortOrder: 999 })
    });
    expect(categoryResponse.status).toBe(201);
    const category = await categoryResponse.json() as { id: number };
    const editedCategory = await app.request(`/api/categories/${category.id}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ name: 'API Category Edited', aliases: ['api-edited'], note: 'Edited', active: true })
    });
    expect(editedCategory.status).toBe(200);

    const methodResponse = await app.request('/api/payment-methods', {
      method: 'POST', headers,
      body: JSON.stringify({ code: 'api-method', displayName: 'API Method' })
    });
    expect(methodResponse.status).toBe(201);
    const method = await methodResponse.json() as { id: number };
    const editedMethod = await app.request(`/api/payment-methods/${method.id}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ code: 'api-method-edited', displayName: 'API Method Edited' })
    });
    expect(editedMethod.status).toBe(200);

    const payeeResponse = await app.request('/api/payees', {
      method: 'POST', headers,
      body: JSON.stringify({ type: 'company', name: 'API Payee', aliases: ['api-payee'], defaultCategoryId: category.id, defaultPaymentMethodId: method.id })
    });
    expect(payeeResponse.status).toBe(201);
    const payee = await payeeResponse.json() as { id: number };
    expect((await app.request(`/api/payees/${payee.id}`, { method: 'PATCH', headers, body: JSON.stringify({ name: 'API Payee Edited' }) })).status).toBe(200);

    await expect((await app.request(`/api/categories/${category.id}`, { method: 'DELETE', headers })).json()).resolves.toMatchObject({ status: 'archived', count: 1 });
    await expect((await app.request(`/api/payment-methods/${method.id}`, { method: 'DELETE', headers })).json()).resolves.toMatchObject({ status: 'archived', count: 1 });
    await expect((await app.request(`/api/payees/${payee.id}`, { method: 'DELETE', headers })).json()).resolves.toMatchObject({ status: 'deleted' });

    const disposableCategory = await (await app.request('/api/categories', { method: 'POST', headers, body: JSON.stringify({ name: 'Disposable Category' }) })).json() as { id: number };
    await expect((await app.request(`/api/categories/${disposableCategory.id}`, { method: 'DELETE', headers })).json()).resolves.toEqual({ status: 'deleted' });
    const missing = await app.request('/api/categories/999999', { method: 'DELETE', headers });
    expect(missing.status).toBe(400);
    await expect(missing.json()).resolves.toMatchObject({ error: { code: 'RANGE' } });
  });

  it('exports transactions as a formatted xlsx workbook and csv with injection safety', async () => {
    const app = fixture();
    const headers = { host: '127.0.0.1:4782', 'content-type': 'application/json' };
    await app.request('/api/payees', {
      method: 'POST', headers,
      body: JSON.stringify({ type: 'company', name: 'Export Electric', defaultCategoryId: null, defaultPaymentMethodId: null })
    });
    const save = await app.request('/api/quick-entry/save', {
      method: 'POST', headers,
      body: JSON.stringify({ command: `test export 800`, confirmNewPayee: true })
    });
    expect(save.status).toBe(201);
    const saved = await save.json() as { testRun: boolean; transaction: unknown };
    expect(saved.testRun).toBe(true);
    expect(saved.transaction).toBeNull();

    await app.request('/api/quick-entry/save', {
      method: 'POST', headers,
      body: JSON.stringify({ command: 'export electric 1200 tools', confirmNewPayee: true })
    });

    const xlsx = await app.request('/api/export/transactions.xlsx?voidedOnly=true', { headers });
    expect(xlsx.status).toBe(200);
    expect(xlsx.headers.get('content-type')).toContain('spreadsheetml');
    const bytes = new Uint8Array(await xlsx.arrayBuffer());
    expect(bytes.length).toBeGreaterThan(0);
    // XLSX files are ZIP archives starting with PK
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);

    const postedXlsx = await app.request('/api/export/transactions.xlsx', { headers });
    expect(postedXlsx.status).toBe(200);
    expect((await postedXlsx.arrayBuffer()).byteLength).toBeGreaterThan(1000);

    const csv = await app.request('/api/export/transactions.csv', { headers });
    expect(csv.status).toBe(200);
    const text = await csv.text();
    expect(text).not.toContain('=HYPERLINK');
  });

  it('requires an exact confirmation phrase for forced payee deletion', async () => {
    const app = fixture();
    const headers = { host: '127.0.0.1:4782', 'content-type': 'application/json' };
    const payee = await (await app.request('/api/payees', {
      method: 'POST', headers,
      body: JSON.stringify({ type: 'person', name: 'Doomed Dev' })
    })).json() as { id: number };
    // create a transaction so force deletion has something to erase
    const savedResponse = await app.request('/api/quick-entry/save', {
      method: 'POST', headers,
      body: JSON.stringify({ command: 'doomed dev 300 wages cash', confirmNewPayee: true })
    });
    const savedBody = await savedResponse.json() as { transaction: { id: number } };
    const transactionId = Number(savedBody.transaction.id);
    expect(transactionId).toBeGreaterThan(0);

    const wrong = await app.request(`/api/payees/${payee.id}?force=true`, {
      method: 'DELETE', headers,
      body: JSON.stringify({ confirm: 'wrong phrase' })
    });
    expect(wrong.status).toBe(400);

    const right = await app.request(`/api/payees/${payee.id}?force=true`, {
      method: 'DELETE', headers,
      body: JSON.stringify({ confirm: 'DELETE Doomed Dev' })
    });
    expect(right.status).toBe(200);
    await expect(right.json()).resolves.toMatchObject({
      status: 'deleted',
      forced: true,
      cleanedTransactions: 1,
      backupFile: expect.any(String)
    });
  });

  it('restores voided transactions through the API', async () => {
    const app = fixture();
    const headers = { host: '127.0.0.1:4782', 'content-type': 'application/json' };
    const saved = await (await app.request('/api/quick-entry/save', {
      method: 'POST', headers,
      body: JSON.stringify({ command: 'restore raja 450 wages', confirmNewPayee: true })
    })).json() as { transaction: { id: number } };

    await app.request(`/api/transactions/${saved.transaction.id}/void`, {
      method: 'POST', headers,
      body: JSON.stringify({ reason: 'testing restore' })
    });
    const restored = await app.request(`/api/transactions/${saved.transaction.id}/unvoid`, {
      method: 'POST', headers
    });
    expect(restored.status).toBe(200);
    await expect(restored.json()).resolves.toMatchObject({ status: 'posted' });
  });

  it('exposes and updates notification settings through the API', async () => {
    const app = fixture();
    const headers = { host: '127.0.0.1:4782', 'content-type': 'application/json' };

    const initial = await (await app.request('/api/settings', { headers })).json() as {
      forwardEnabled: boolean;
      summariesEnabled: boolean;
    };
    expect(initial).toEqual({ forwardEnabled: true, summariesEnabled: true });

    const paused = await app.request('/api/settings', {
      method: 'PATCH', headers,
      body: JSON.stringify({ forwardEnabled: false })
    });
    expect(paused.status).toBe(200);
    await expect(paused.json()).resolves.toEqual({ forwardEnabled: false, summariesEnabled: true });

    const status = await (await app.request('/api/system/status', { headers })).json() as {
      telegram: { forwardEnabled: boolean };
    };
    expect(status.telegram.forwardEnabled).toBe(false);

    const invalid = await app.request('/api/settings', {
      method: 'PATCH', headers,
      body: JSON.stringify({ forwardEnabled: 'yes' })
    });
    expect(invalid.status).toBe(400);

    const resumed = await app.request('/api/settings', {
      method: 'PATCH', headers,
      body: JSON.stringify({ forwardEnabled: true, summariesEnabled: false })
    });
    await expect(resumed.json()).resolves.toEqual({ forwardEnabled: true, summariesEnabled: false });
  });

  it('searches transactions by amount and category name', async () => {
    const app = fixture();
    const headers = { host: '127.0.0.1:4782', 'content-type': 'application/json' };
    await app.request('/api/quick-entry/save', {
      method: 'POST', headers,
      body: JSON.stringify({ command: 'search tester 1250.50 cash transport', confirmNewPayee: true })
    });
    const byAmount = await (await app.request('/api/transactions?search=1250.5', { headers })).json() as { items: unknown[] };
    expect(byAmount.items).toHaveLength(1);
    const byCategory = await (await app.request('/api/transactions?search=transport', { headers })).json() as { items: unknown[] };
    expect(byCategory.items).toHaveLength(1);
  });

  it('keeps version stable when a correction is a no-op', async () => {
    const app = fixture();
    const headers = { host: '127.0.0.1:4782', 'content-type': 'application/json' };
    const saved = await (await app.request('/api/quick-entry/save', {
      method: 'POST', headers,
      body: JSON.stringify({ command: 'stable sam 300 cash', confirmNewPayee: true })
    })).json() as { transaction: { id: number; updatedAt: string; version: number } };
    const master = await (await app.request('/api/master-data', { headers })).json() as {
      categories: Array<{ id: number }>;
      paymentMethods: Array<{ id: number; code: string }>;
    };
    const categoryId = master.categories[0]!.id;
    const methodId = master.paymentMethods.find((method) => method.code === 'cash')!.id;

    const first = await app.request(`/api/transactions/${saved.transaction.id}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ categoryId, paymentMethodId: methodId, needsReview: false, expectedUpdatedAt: saved.transaction.updatedAt })
    });
    const afterFirst: { updatedAt: string; version: number } = await first.json();
    expect(afterFirst.version).toBeGreaterThan(saved.transaction.version);

    const second = await app.request(`/api/transactions/${saved.transaction.id}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ categoryId, paymentMethodId: methodId, needsReview: false, expectedUpdatedAt: afterFirst.updatedAt })
    });
    const afterSecond: { updatedAt: string; version: number } = await second.json();
    expect(afterSecond.updatedAt).toBe(afterFirst.updatedAt);
    expect(afterSecond.version).toBe(afterFirst.version);

    const audit = await (await app.request(`/api/transactions/${saved.transaction.id}/audit`, { headers })).json() as Array<{ action: string }>;
    expect(audit.filter((entry) => entry.action === 'corrected')).toHaveLength(1);
  });

  it('merges duplicate payees and moves their payment history', async () => {
    const app = fixture();
    const headers = { host: '127.0.0.1:4782', 'content-type': 'application/json' };
    await app.request('/api/quick-entry/save', {
      method: 'POST', headers,
      body: JSON.stringify({ command: 'khusbu 500 cash wages', confirmNewPayee: true })
    });
    await app.request('/api/quick-entry/save', {
      method: 'POST', headers,
      body: JSON.stringify({ command: 'khusbu metal 900 upi wages', confirmNewPayee: true })
    });

    const masterBefore = await (await app.request('/api/master-data', { headers })).json() as {
      payees: Array<{ id: number; name: string }>;
    };
    const source = masterBefore.payees.find((payee) => payee.name.toLowerCase() === 'khusbu')!;
    const target = masterBefore.payees.find((payee) => payee.id !== source.id && payee.name.toLowerCase().includes('metal'))!;

    const sameGuard = await app.request('/api/payees/merge', {
      method: 'POST', headers,
      body: JSON.stringify({ sourceId: source.id, targetId: source.id })
    });
    expect(sameGuard.status).toBe(400);

    const mergedResponse = await app.request('/api/payees/merge', {
      method: 'POST', headers,
      body: JSON.stringify({ sourceId: source.id, targetId: target.id })
    });
    expect(mergedResponse.status).toBe(200);
    await expect(mergedResponse.json()).resolves.toMatchObject({
      movedTransactions: 1,
      source: { id: source.id, name: source.name },
      target: { id: target.id }
    });

    const targetTransactions = await (await app.request(`/api/transactions?payeeId=${target.id}`, { headers })).json() as { items: Array<{ payeeName: string }> };
    expect(targetTransactions.items).toHaveLength(2);
    expect(targetTransactions.items.every((item) => item.payeeName === target.name)).toBe(true);

    const masterAfter = await (await app.request('/api/master-data', { headers })).json() as {
      payees: Array<{ id: number; name: string; active: boolean; aliases: string[] }>;
    };
    const mergedTarget = masterAfter.payees.find((payee) => payee.id === target.id)!;
    expect(mergedTarget.active).toBe(true);
    expect(mergedTarget.aliases).toContain(source.name);
    expect(masterAfter.payees.find((payee) => payee.id === source.id)).toBeUndefined();
  });
});
