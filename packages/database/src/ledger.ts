import { join } from 'node:path';
import { readdirSync, statSync } from 'node:fs';
import {
  TransactionNotFoundError,
  DuplicateTransactionError,
  NewPayeeRequiresConfirmationError,
  TransactionService,
  type TransactionRecord
} from '@payment-ledger/core';
import {
  normalizeLookupText,
  parseQuickEntry,
  type QuickEntryPreview
} from '@payment-ledger/parser';
import {
  createTransactionSchema,
  type ChangeSource,
  type CorrectTransactionInput
} from '@payment-ledger/shared';
import type Database from 'better-sqlite3';
import {
  SqliteTransactionRepository,
  verifyDatabaseIntegrity,
  type DatabaseRuntime
} from './index.js';

interface PayeeRow {
  id: number;
  type: 'person' | 'company';
  name: string;
  normalized_name: string;
  default_category_id: number | null;
  default_payment_method_id: number | null;
  active: number;
  favourite: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  aliases: string | null;
  payment_count?: number;
  total_paid_paise?: number;
  this_month_paid_paise?: number;
}

interface CategoryRow {
  id: number;
  name: string;
  parent_id: number | null;
  active: number;
  sort_order: number;
  note: string;
  aliases: string | null;
}

interface PaymentMethodRow {
  id: number;
  code: string;
  display_name: string;
  active: number;
}

interface TransactionListRow {
  id: number;
  transaction_date: string;
  transaction_time: string;
  payee_id: number;
  payee_name: string;
  amount_paise: number;
  category_id: number | null;
  category_name: string | null;
  payment_method_id: number | null;
  payment_method_name: string | null;
  payment_method_code: string | null;
  note: string | null;
  source: ChangeSource;
  status: 'posted' | 'voided';
  needs_review: number;
  silent: number;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface ListTransactionOptions {
  date?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  search?: string | undefined;
  methodId?: number | undefined;
  categoryId?: number | undefined;
  payeeId?: number | undefined;
  reviewOnly?: boolean | undefined;
  includeVoided?: boolean | undefined;
  voidedOnly?: boolean | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

export interface CreatePayeeInput {
  type: 'person' | 'company';
  name: string;
  aliases?: string[];
  defaultCategoryId?: number | null;
  defaultPaymentMethodId?: number | null;
  favourite?: boolean;
  notes?: string | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function businessNow(date = new Date()): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    time: `${value('hour')}:${value('minute')}:${value('second')}`
  };
}

function requiredName(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length < 2 || value.trim().length > 160) {
    throw new TypeError('Name must contain 2 to 160 characters');
  }
  return value.trim();
}

function mapPayee(row: PayeeRow) {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    defaultCategoryId: row.default_category_id,
    defaultPaymentMethodId: row.default_payment_method_id,
    active: row.active === 1,
    favourite: row.favourite === 1,
    notes: row.notes,
    aliases: row.aliases ? row.aliases.split('|||').filter(Boolean) : [],
    paymentCount: row.payment_count ?? 0,
    totalPaidPaise: row.total_paid_paise ?? 0,
    thisMonthPaidPaise: row.this_month_paid_paise ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapCategory(row: CategoryRow) {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    active: row.active === 1,
    sortOrder: row.sort_order,
    note: row.note,
    aliases: row.aliases ? row.aliases.split('|||').filter(Boolean) : []
  };
}

function mapMethod(row: PaymentMethodRow) {
  return {
    id: row.id,
    code: row.code,
    displayName: row.display_name,
    active: row.active === 1
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function paiseToDecimalString(paise: number): string {
  const sign = paise < 0 ? '-' : '';
  const absolute = Math.abs(paise);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
}

export interface ExportTransaction {
  id: number;
  transactionDate: string;
  transactionTime: string;
  payeeName: string;
  amountPaise: number;
  categoryName: string | null;
  paymentMethodName: string | null;
  paymentMethodCode: string | null;
  note: string | null;
  source: ChangeSource;
  status: 'posted' | 'voided';
  needsReview: boolean;
}

function mapExportTransaction(row: TransactionListRow): ExportTransaction {
  return {
    id: row.id,
    transactionDate: row.transaction_date,
    transactionTime: row.transaction_time,
    payeeName: row.payee_name,
    amountPaise: row.amount_paise,
    categoryName: row.category_name,
    paymentMethodName: row.payment_method_name,
    paymentMethodCode: row.payment_method_code,
    note: row.note,
    source: row.source,
    status: row.status,
    needsReview: row.needs_review === 1
  };
}

const EXPORT_HEADERS = [
  'Date',
  'Time',
  'Payee',
  'Amount (INR)',
  'Category',
  'Method',
  'Note',
  'Source',
  'Status',
  'Needs review'
];

function transactionsToCsv(rows: ExportTransaction[]): string {
  const csvRows = [
    EXPORT_HEADERS,
    ...rows.map((item) => [
      item.transactionDate,
      item.transactionTime,
      item.payeeName,
      paiseToDecimalString(item.amountPaise),
      item.categoryName ?? 'Uncategorised',
      item.paymentMethodName,
      item.note,
      item.source,
      item.status,
      item.needsReview ? 'yes' : 'no'
    ])
  ];
  return csvRows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

function mapListTransaction(row: TransactionListRow) {
  return {
    id: row.id,
    transactionDate: row.transaction_date,
    transactionTime: row.transaction_time,
    payeeId: row.payee_id,
    payeeName: row.payee_name,
    amountPaise: row.amount_paise,
    categoryId: row.category_id,
    categoryName: row.category_name,
    paymentMethodId: row.payment_method_id,
    paymentMethodName: row.payment_method_name,
    paymentMethodCode: row.payment_method_code,
    note: row.note,
    source: row.source,
    status: row.status,
    needsReview: row.needs_review === 1,
    silent: row.silent === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version
  };
}

function csvCell(value: string | number | null): string {
  let text = value === null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export class LedgerService {
  private readonly transactions: TransactionService;

  constructor(private readonly runtime: DatabaseRuntime) {
    this.transactions = new TransactionService(new SqliteTransactionRepository(runtime.db));
  }

  private get sqlite(): Database.Database {
    return this.runtime.sqlite;
  }

  getMasterData(options: { includeInactive?: boolean } = {}) {
    const activeClause = options.includeInactive ? '' : 'WHERE p.active = 1';
    const istMonthStart = `${businessNow().date.slice(0, 8)}01`;
    const payees = this.sqlite
      .prepare(
        `SELECT p.*,
          (SELECT group_concat(alias, '|||') FROM payee_aliases WHERE payee_id = p.id) AS aliases,
          (SELECT count(*) FROM transactions WHERE payee_id = p.id AND status = 'posted') AS payment_count,
          (SELECT coalesce(sum(amount_paise), 0) FROM transactions WHERE payee_id = p.id AND status = 'posted') AS total_paid_paise,
          (SELECT coalesce(sum(amount_paise), 0) FROM transactions WHERE payee_id = p.id AND status = 'posted' AND transaction_date >= ?) AS this_month_paid_paise
        FROM payees p
        ${activeClause}
        ORDER BY p.favourite DESC, p.name COLLATE NOCASE`
      )
      .all(istMonthStart) as PayeeRow[];
    const categoryWhere = options.includeInactive ? '' : 'WHERE c.active = 1';
    const categories = this.sqlite
      .prepare(
        `SELECT c.*, group_concat(ca.alias, '|||') AS aliases
         FROM categories c LEFT JOIN category_aliases ca ON ca.category_id = c.id
         ${categoryWhere}
         GROUP BY c.id ORDER BY c.sort_order, c.name COLLATE NOCASE`
      )
      .all() as CategoryRow[];
    const methodWhere = options.includeInactive ? '' : 'WHERE active = 1';
    const methods = this.sqlite
      .prepare(`SELECT * FROM payment_methods ${methodWhere} ORDER BY id`)
      .all() as PaymentMethodRow[];
    return {
      payees: payees.map(mapPayee),
      categories: categories.map(mapCategory),
      paymentMethods: methods.map(mapMethod)
    };
  }

  createPayee(input: CreatePayeeInput) {
    const name = requiredName(input.name);
    if (input.type !== 'person' && input.type !== 'company')
      throw new TypeError('Invalid payee type');
    const aliases = [
      ...new Set((input.aliases ?? []).map((alias) => alias.trim()).filter(Boolean))
    ];
    const create = this.sqlite.transaction(() => {
      const result = this.sqlite
        .prepare(
          `INSERT INTO payees
           (type, name, normalized_name, default_category_id, default_payment_method_id, favourite, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          input.type,
          name,
          normalizeLookupText(name),
          input.defaultCategoryId ?? null,
          input.defaultPaymentMethodId ?? null,
          input.favourite ? 1 : 0,
          input.notes?.trim() || null
        );
      const id = Number(result.lastInsertRowid);
      const aliasStatement = this.sqlite.prepare(
        'INSERT INTO payee_aliases (payee_id, alias, normalized_alias) VALUES (?, ?, ?)'
      );
      for (const alias of aliases) aliasStatement.run(id, alias, normalizeLookupText(alias));
      return id;
    });
    return this.getPayee(create());
  }

  updatePayee(id: number, input: Partial<CreatePayeeInput> & { active?: boolean }) {
    const existing = this.getPayee(id);
    const name = input.name === undefined ? existing.name : requiredName(input.name);
    const type = input.type ?? existing.type;
    const update = this.sqlite.transaction(() => {
      this.sqlite
        .prepare(
          `UPDATE payees SET type = ?, name = ?, normalized_name = ?, default_category_id = ?,
           default_payment_method_id = ?, favourite = ?, active = ?, notes = ?, updated_at = ? WHERE id = ?`
        )
        .run(
          type,
          name,
          normalizeLookupText(name),
          input.defaultCategoryId === undefined
            ? existing.defaultCategoryId
            : input.defaultCategoryId,
          input.defaultPaymentMethodId === undefined
            ? existing.defaultPaymentMethodId
            : input.defaultPaymentMethodId,
          input.favourite === undefined ? (existing.favourite ? 1 : 0) : input.favourite ? 1 : 0,
          input.active === undefined ? (existing.active ? 1 : 0) : input.active ? 1 : 0,
          input.notes === undefined ? existing.notes : input.notes?.trim() || null,
          nowIso(),
          id
        );
      if (input.aliases) {
        this.sqlite.prepare('DELETE FROM payee_aliases WHERE payee_id = ?').run(id);
        const insert = this.sqlite.prepare(
          'INSERT INTO payee_aliases (payee_id, alias, normalized_alias) VALUES (?, ?, ?)'
        );
        for (const alias of [
          ...new Set(input.aliases.map((value) => value.trim()).filter(Boolean))
        ]) {
          insert.run(id, alias, normalizeLookupText(alias));
        }
      }
    });
    update();
    return this.getPayee(id);
  }

  async deletePayee(id: number, options: { force?: boolean; confirmPhrase?: string } = {}) {
    const txCount = Number(
      (
        this.sqlite
          .prepare('SELECT count(*) AS count FROM transactions WHERE payee_id = ?')
          .get(id) as { count: number }
      ).count
    );

    if (options.force) {
      const payee = this.getPayee(id);
      const expectedPhrase = `DELETE ${payee.name}`;
      if ((options.confirmPhrase ?? '').trim() !== expectedPhrase) {
        throw new TypeError(`Type "${expectedPhrase}" to permanently delete this payee`);
      }

      const snapshotRows = this.sqlite
        .prepare('SELECT * FROM transactions WHERE payee_id = ? ORDER BY id')
        .all(id) as Array<Record<string, unknown>>;
      const totalPaise = snapshotRows.reduce(
        (sum, row) => sum + Number(row.amount_paise ?? 0),
        0
      );

      const backup = await this.createBackup();

      const forceDelete = this.sqlite.transaction(() => {
        this.sqlite
          .prepare(
            `INSERT INTO destruction_log
             (entity_type, entity_id, entity_name, transaction_count, total_amount_paise,
              snapshot, confirm_phrase, backup_file)
             VALUES ('payee', ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            id,
            payee.name,
            txCount,
            totalPaise,
            JSON.stringify(snapshotRows),
            expectedPhrase,
            backup.filename ?? null
          );
        const txIds = snapshotRows.map((row) => Number(row.id));
        if (txIds.length > 0) {
          const placeholders = txIds.map(() => '?').join(',');
          this.sqlite
            .prepare(`DELETE FROM transaction_audit WHERE transaction_id IN (${placeholders})`)
            .run(...txIds);
          this.sqlite.prepare('DELETE FROM transactions WHERE payee_id = ?').run(id);
        }
        this.sqlite.prepare('DELETE FROM payee_aliases WHERE payee_id = ?').run(id);
        this.sqlite.prepare('DELETE FROM payees WHERE id = ?').run(id);
      });
      forceDelete();
      return {
        status: 'deleted',
        forced: true,
        cleanedTransactions: txCount,
        backupFile: backup.filename,
        integrity: backup.integrity
      };
    }

    if (txCount > 0) {
      this.updatePayee(id, { active: false });
      return { status: 'archived', count: txCount };
    }

    const remove = this.sqlite.transaction(() => {
      this.sqlite.prepare('DELETE FROM payee_aliases WHERE payee_id = ?').run(id);
      this.sqlite.prepare('DELETE FROM payees WHERE id = ?').run(id);
    });
    remove();
    return { status: 'deleted' };
  }

  private getPayee(id: number) {
    const row = this.sqlite
      .prepare(
        `SELECT p.*, group_concat(pa.alias, '|||') AS aliases
         FROM payees p LEFT JOIN payee_aliases pa ON pa.payee_id = p.id
         WHERE p.id = ? GROUP BY p.id`
      )
      .get(id) as PayeeRow | undefined;
    if (!row) throw new RangeError(`Payee ${id} was not found`);
    return mapPayee(row);
  }

  createCategory(input: {
    name: string;
    parentId?: number | null;
    aliases?: string[];
    sortOrder?: number;
    note?: string;
  }) {
    const name = requiredName(input.name);
    const create = this.sqlite.transaction(() => {
      const result = this.sqlite
        .prepare('INSERT INTO categories (name, parent_id, sort_order, note) VALUES (?, ?, ?, ?)')
        .run(name, input.parentId ?? null, input.sortOrder ?? 0, input.note?.trim() ?? '');
      const id = Number(result.lastInsertRowid);
      const aliases = [name, ...(input.aliases ?? [])];
      const insert = this.sqlite.prepare(
        'INSERT OR IGNORE INTO category_aliases (category_id, alias, normalized_alias) VALUES (?, ?, ?)'
      );
      for (const alias of aliases.map((value) => value.trim()).filter(Boolean)) {
        insert.run(id, alias, normalizeLookupText(alias));
      }
      return id;
    });
    const id = create();
    return this.getMasterData({ includeInactive: true }).categories.find(
      (category) => category.id === id
    );
  }

  updateCategory(
    id: number,
    input: {
      name?: string;
      parentId?: number | null;
      aliases?: string[];
      sortOrder?: number;
      note?: string;
      active?: boolean;
    }
  ) {
    const current = this.getMasterData({ includeInactive: true }).categories.find(
      (category) => category.id === id
    );
    if (!current) throw new RangeError(`Category ${id} was not found`);
    const name = input.name === undefined ? current.name : requiredName(input.name);
    const update = this.sqlite.transaction(() => {
      this.sqlite
        .prepare(
          `UPDATE categories SET name = ?, parent_id = ?, sort_order = ?, note = ?, active = ?, updated_at = ? WHERE id = ?`
        )
        .run(
          name,
          input.parentId === undefined ? current.parentId : input.parentId,
          input.sortOrder ?? current.sortOrder,
          input.note === undefined ? current.note : input.note.trim(),
          input.active === undefined ? (current.active ? 1 : 0) : input.active ? 1 : 0,
          nowIso(),
          id
        );
      if (input.aliases || input.name) {
        this.sqlite.prepare('DELETE FROM category_aliases WHERE category_id = ?').run(id);
        const insert = this.sqlite.prepare(
          'INSERT INTO category_aliases (category_id, alias, normalized_alias) VALUES (?, ?, ?)'
        );
        for (const alias of [...new Set([name, ...(input.aliases ?? current.aliases)])]) {
          insert.run(id, alias, normalizeLookupText(alias));
        }
      }
    });
    update();
    return this.getMasterData({ includeInactive: true }).categories.find(
      (category) => category.id === id
    );
  }

  deleteCategory(id: number) {
    const category = this.getMasterData({ includeInactive: true }).categories.find((item) => item.id === id);
    if (!category) throw new RangeError(`Category ${id} was not found`);
    const references = Number((this.sqlite.prepare(
      'SELECT (SELECT count(*) FROM transactions WHERE category_id = ?) + (SELECT count(*) FROM payees WHERE default_category_id = ?) AS count'
    ).get(id, id) as { count: number }).count);
    if (references > 0) {
      this.updateCategory(id, { active: false });
      return { status: 'archived', count: references };
    }
    this.sqlite.transaction(() => {
      this.sqlite.prepare('DELETE FROM category_aliases WHERE category_id = ?').run(id);
      this.sqlite.prepare('DELETE FROM categories WHERE id = ?').run(id);
    })();
    return { status: 'deleted' };
  }

  updatePaymentMethod(id: number, input: { code?: string; displayName?: string; active?: boolean }) {
    const current = this.getMasterData({ includeInactive: true }).paymentMethods.find(
      (method) => method.id === id
    );
    if (!current) throw new RangeError(`Payment method ${id} was not found`);
    this.sqlite
      .prepare(
        'UPDATE payment_methods SET code = ?, display_name = ?, active = ?, updated_at = ? WHERE id = ?'
      )
      .run(
        input.code === undefined ? current.code : requiredName(input.code).toLowerCase(),
        input.displayName?.trim() || current.displayName,
        input.active === undefined ? (current.active ? 1 : 0) : input.active ? 1 : 0,
        nowIso(),
        id
      );
    return this.getMasterData({ includeInactive: true }).paymentMethods.find(
      (method) => method.id === id
    );
  }

  createPaymentMethod(input: { code: string; displayName: string; active?: boolean }) {
    const code = requiredName(input.code).toLowerCase();
    const displayName = requiredName(input.displayName);
    const active = input.active !== false ? 1 : 0;
    const stmt = this.sqlite.prepare(
      `INSERT INTO payment_methods (code, display_name, active) VALUES (?, ?, ?)`
    );
    const result = stmt.run(code, displayName, active);
    return this.getMasterData({ includeInactive: true }).paymentMethods.find(
      (method) => method.id === Number(result.lastInsertRowid)
    );
  }

  deletePaymentMethod(id: number) {
    const current = this.getMasterData({ includeInactive: true }).paymentMethods.find((item) => item.id === id);
    if (!current) throw new RangeError(`Payment method ${id} was not found`);
    const references = Number((this.sqlite.prepare(
      'SELECT (SELECT count(*) FROM transactions WHERE payment_method_id = ?) + (SELECT count(*) FROM payees WHERE default_payment_method_id = ?) AS count'
    ).get(id, id) as { count: number }).count);
    if (references > 0) {
      this.updatePaymentMethod(id, { active: false });
      return { status: 'archived', count: references };
    }
    this.sqlite.prepare('DELETE FROM payment_methods WHERE id = ?').run(id);
    return { status: 'deleted' };
  }

  previewQuickEntry(command: string): QuickEntryPreview {
    if (typeof command !== 'string' || command.trim().length === 0) {
      throw new TypeError('Enter a payment command');
    }
    const recentMap = new Map<number, { category_id: number | null; payment_method_id: number | null }>();
    const rows = this.sqlite.prepare(
      `SELECT payee_id, category_id, payment_method_id
       FROM (
         SELECT payee_id, category_id, payment_method_id,
                ROW_NUMBER() OVER (PARTITION BY payee_id ORDER BY transaction_date DESC, transaction_time DESC, id DESC) as rn
         FROM transactions
         WHERE status = 'posted'
       )
       WHERE rn = 1`
    ).all() as Array<{ payee_id: number; category_id: number | null; payment_method_id: number | null }>;
    for (const row of rows) {
      recentMap.set(row.payee_id, row);
    }

    const master = this.getMasterData();
    const preview = parseQuickEntry(command, {
      payees: master.payees.map((payee) => {
        const recent = recentMap.get(payee.id);
        return {
          id: payee.id,
          name: payee.name,
          normalizedNames: [
            normalizeLookupText(payee.name),
            ...payee.aliases.map(normalizeLookupText)
          ],
          defaultCategoryId: payee.defaultCategoryId ?? recent?.category_id ?? null,
          defaultPaymentMethodId:
            payee.defaultPaymentMethodId ?? recent?.payment_method_id ?? null
        };
      }),
      categories: master.categories.map((category) => ({
        id: category.id,
        name: category.name,
        normalizedNames: [
          normalizeLookupText(category.name),
          ...(normalizeLookupText(category.name).endsWith('s')
            ? [normalizeLookupText(category.name).slice(0, -1)]
            : []),
          ...category.aliases.map(normalizeLookupText)
        ]
      })),
      paymentMethods: master.paymentMethods.map((method) => ({
        id: method.id,
        code: method.code,
        displayName: method.displayName,
        aliases:
          method.code === 'cash'
            ? ['c', 'cash']
            : method.code === 'upi'
              ? ['u', 'upi']
              : method.code === 'bank'
                ? ['b', 'bank']
                : ['ch', 'cheque']
      }))
    });
    const clock = this.resolveCommandClock(command);
    if (preview.payeeId && preview.amountPaise) {
      const history = this.sqlite
        .prepare(
          `SELECT round(avg(amount_paise)) AS average, count(*) AS count
           FROM transactions WHERE payee_id = ? AND status = 'posted'`
        )
        .get(preview.payeeId) as { average: number | null; count: number };
      if (
        history.count >= 3 &&
        history.average &&
        preview.amountPaise >= 5_000_000 &&
        preview.amountPaise >= history.average * 2
      ) {
        preview.warnings.push(
          `Unusually high: ${Math.round((preview.amountPaise / history.average) * 10) / 10}× this payee's average`
        );
      }
    }
    return {
      ...preview,
      transactionDate: clock.date,
      transactionTime: clock.time,
      note:
        preview.note
          ?.replace(/\b(?:today|yesterday)\b/gi, '')
          .replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, '')
          .replace(
            /\b(?:\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[-/]\d{1,2}(?:[-/]\d{2,4})?|\d{1,2}[-/](?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:[-/]\d{2,4})?)\b/gi,
            ''
          )
          .trim() || null
    };
  }

  private resolveCommandClock(command: string) {
    const current = businessNow();
    let date = current.date;
    const iso = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/.exec(command);
    const numericIndian = /\b(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?\b/.exec(command);
    const namedIndian =
      /\b(\d{1,2})[-/](jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:[-/](\d{2,4}))?\b/i.exec(
        command
      );
    const normalizeYear = (value: string | undefined) =>
      value
        ? value.length === 2
          ? 2000 + Number(value)
          : Number(value)
        : Number(current.date.slice(0, 4));
    const validDate = (year: number, month: number, day: number) => {
      const candidate = new Date(Date.UTC(year, month - 1, day));
      return candidate.getUTCFullYear() === year &&
        candidate.getUTCMonth() === month - 1 &&
        candidate.getUTCDate() === day
        ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        : null;
    };
    if (iso) date = validDate(Number(iso[1]), Number(iso[2]), Number(iso[3])) ?? date;
    else if (namedIndian) {
      const months = [
        'jan',
        'feb',
        'mar',
        'apr',
        'may',
        'jun',
        'jul',
        'aug',
        'sep',
        'oct',
        'nov',
        'dec'
      ];
      const month = months.findIndex((name) => namedIndian[2]?.toLowerCase().startsWith(name)) + 1;
      date = validDate(normalizeYear(namedIndian[3]), month, Number(namedIndian[1])) ?? date;
    } else if (numericIndian) {
      date =
        validDate(
          normalizeYear(numericIndian[3]),
          Number(numericIndian[2]),
          Number(numericIndian[1])
        ) ?? date;
    } else if (/\byesterday\b/i.test(command)) {
      const previous = new Date(`${current.date}T12:00:00+05:30`);
      previous.setUTCDate(previous.getUTCDate() - 1);
      date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(previous);
    }
    let time = current.time;
    const match = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i.exec(command);
    if (match) {
      let hour = Number(match[1]) % 12;
      if (match[3]?.toLowerCase() === 'pm') hour += 12;
      time = `${String(hour).padStart(2, '0')}:${match[2] ?? '00'}:00`;
    }
    return { date, time };
  }

  async createFromCommand(
    command: string,
    options?: {
      confirmNewPayee?: boolean | undefined;
      confirmDuplicate?: boolean | undefined;
      source?: ChangeSource | undefined;
    }
  ): Promise<{
    testRun: boolean;
    transaction: TransactionRecord | null;
    duplicate: boolean;
    duplicateReason: string | null;
    createdPayee: boolean;
  }> {
    const preview = this.previewQuickEntry(command);
    if (!preview.valid || !preview.payeeName || !preview.amountPaise) {
      throw new TypeError(preview.errors.join('. ') || 'Command is incomplete');
    }
    let payeeId = preview.payeeId;
    if (preview.test && !payeeId) {
      return {
        testRun: true,
        transaction: null,
        duplicate: false,
        duplicateReason: null,
        createdPayee: preview.isNewPayee
      };
    }
    let createdPayee = false;
    if (!payeeId && preview.isNewPayee) {
      if (!options?.confirmNewPayee) {
        throw new NewPayeeRequiresConfirmationError('New payee requires confirmation');
      }
      const cashMethod = this.getMasterData().paymentMethods.find(
        (method) => method.code === 'cash'
      );
      const isCompany = /\b(traders|corp|industries|supply|agency|transport|enterprises|works|mart|station|paints|earthmovers|crushers|machinery|brick|hydraulic|spares)\b/i.test(preview.payeeName);
      const newPayee = this.createPayee({
        type: isCompany ? 'company' : 'person',
        name: preview.payeeName,
        defaultCategoryId: preview.categoryId,
        defaultPaymentMethodId: cashMethod?.id ?? null
      });
      payeeId = newPayee.id;
      createdPayee = true;
    }
    if (!payeeId) throw new TypeError('Choose or enter a payee');
    const clock = {
      date: preview.transactionDate ?? businessNow().date,
      time: preview.transactionTime ?? businessNow().time
    };
    const currentClock = businessNow();
    const explicitlyDated =
      /\b\d{4}-\d{1,2}-\d{1,2}\b/.test(command) ||
      /\b\d{1,2}[-/](?:\d{1,2}|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i.test(
        command
      ) ||
      /\byesterday\b/i.test(command);
    const explicitTime = /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i.test(command);
    const backdated =
      (explicitlyDated && clock.date !== currentClock.date) || explicitTime;
    const recencyClause = backdated
      ? 'amount_paise = ?'
      : "(amount_paise = ? OR created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 minutes'))";
    const duplicateMatch = this.sqlite
      .prepare(
        `SELECT amount_paise, transaction_time,
          CASE WHEN amount_paise = ? THEN 'Same payee and amount already recorded for this day'
               ELSE 'This payee was paid during the last 30 minutes' END AS reason
       FROM transactions
       WHERE transaction_date = ? AND payee_id = ? AND status = 'posted'
         AND ${recencyClause}
       ORDER BY (amount_paise = ?) DESC, id DESC LIMIT 1`
      )
      .get(
        preview.amountPaise,
        clock.date,
        payeeId,
        preview.amountPaise,
        preview.amountPaise
      ) as { reason: string; amount_paise: number; transaction_time: string } | undefined;
    const duplicate = !!duplicateMatch && !options?.confirmDuplicate;
    const duplicateReason = duplicateMatch
      ? `${duplicateMatch.reason} at ${duplicateMatch.transaction_time.slice(0, 5)}`
      : null;
    if (preview.test) {
      return {
        testRun: true,
        transaction: null,
        duplicate,
        duplicateReason,
        createdPayee: false
      };
    }
    if (duplicate && duplicateReason) {
      throw new DuplicateTransactionError(duplicateReason);
    }

    const transaction = await this.transactions.create({
      transactionDate: clock.date,
      transactionTime: clock.time,
      payeeId,
      amountPaise: preview.amountPaise,
      categoryId: preview.categoryId,
      paymentMethodId: preview.paymentMethodId,
      note: preview.note,
      source: options?.source ?? 'web',
      needsReview: preview.needsReview,
      silent: preview.silent
    });
    return {
      testRun: false,
      transaction,
      duplicate: Boolean(duplicateMatch),
      duplicateReason: duplicateMatch?.reason ?? null,
      createdPayee
    };
  }

  async createTransaction(input: {
    transactionDate?: string;
    transactionTime?: string;
    payeeId: number;
    amountPaise: number;
    categoryId: number | null;
    paymentMethodId: number | null;
    note: string | null;
    needsReview: boolean;
    silent?: boolean;
  }) {
    const clock = businessNow();
    return this.transactions.create({
      transactionDate: input.transactionDate ?? clock.date,
      transactionTime: input.transactionTime ?? clock.time,
      payeeId: input.payeeId,
      amountPaise: input.amountPaise,
      categoryId: input.categoryId,
      paymentMethodId: input.paymentMethodId,
      note: input.note,
      source: 'web',
      needsReview: input.needsReview,
      silent: input.silent ?? false
    });
  }

  createBatchTransactions(input: {
    rows: Array<{
      transactionDate: string;
      transactionTime?: string;
      payeeId: number;
      amountPaise: number;
      categoryId: number | null;
      paymentMethodId: number | null;
      note: string | null;
      needsReview?: boolean;
    }>;
  }) {
    if (!Array.isArray(input.rows) || input.rows.length < 1 || input.rows.length > 100) {
      throw new TypeError('Batch must contain 1 to 100 payments');
    }
    const clock = businessNow();
    const rows = input.rows.map((row) =>
      createTransactionSchema.parse({
        ...row,
        transactionTime: row.transactionTime ?? clock.time,
        source: 'web',
        needsReview: row.needsReview ?? (row.categoryId === null || row.paymentMethodId === null)
      })
    );
    return this.sqlite.transaction(() => {
      const insert = this.sqlite.prepare(
        `INSERT INTO transactions
         (transaction_date, transaction_time, payee_id, amount_paise, category_id,
          payment_method_id, note, source, needs_review)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'web', ?)`
      );
      const audit = this.sqlite.prepare(
        `INSERT INTO transaction_audit
         (transaction_id, action, previous_data, new_data, change_source)
         VALUES (?, 'created', NULL, ?, 'web')`
      );
      const created = [];
      for (const row of rows) {
        const result = insert.run(
          row.transactionDate,
          row.transactionTime,
          row.payeeId,
          row.amountPaise,
          row.categoryId,
          row.paymentMethodId,
          row.note,
          row.needsReview ? 1 : 0
        );
        const transaction = this.getTransaction(Number(result.lastInsertRowid));
        audit.run(transaction.id, JSON.stringify(transaction));
        created.push(transaction);
      }
      return { created, count: created.length };
    })();
  }

  async correctTransaction(id: number, input: Omit<CorrectTransactionInput, 'source'>) {
    return this.transactions.correct(id, { ...input, source: 'web' });
  }

  async voidTransaction(id: number, reason: string) {
    return this.transactions.void(id, reason, 'web');
  }

  async unvoidTransaction(id: number) {
    return this.transactions.unvoid(id, 'web');
  }

  private transactionFilter(options: ListTransactionOptions): {
    where: string;
    parameters: Array<string | number>;
  } {
    const conditions: string[] = [];
    const parameters: Array<string | number> = [];
    if (options.date) {
      conditions.push('t.transaction_date = ?');
      parameters.push(options.date);
    }
    if (options.from) {
      conditions.push('t.transaction_date >= ?');
      parameters.push(options.from);
    }
    if (options.to) {
      conditions.push('t.transaction_date <= ?');
      parameters.push(options.to);
    }
    if (options.search) {
      conditions.push("(p.name LIKE ? ESCAPE '\\' OR t.note LIKE ? ESCAPE '\\')");
      parameters.push(`%${escapeLike(options.search)}%`, `%${escapeLike(options.search)}%`);
    }
    if (options.methodId) {
      conditions.push('t.payment_method_id = ?');
      parameters.push(options.methodId);
    }
    if (options.categoryId) {
      conditions.push('t.category_id = ?');
      parameters.push(options.categoryId);
    }
    if (options.payeeId) {
      conditions.push('t.payee_id = ?');
      parameters.push(options.payeeId);
    }
    if (options.reviewOnly) conditions.push('t.needs_review = 1');
    if (options.voidedOnly) conditions.push("t.status = 'voided'");
    else if (!options.includeVoided) conditions.push("t.status = 'posted'");
    return {
      where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
      parameters
    };
  }

  listTransactions(options: ListTransactionOptions = {}) {
    const { where, parameters } = this.transactionFilter(options);
    const pageSize = Math.min(Math.max(options.pageSize ?? 50, 1), 100);
    const page = Math.max(options.page ?? 1, 1);
    const count = Number(
      (
        this.sqlite
          .prepare(
            `SELECT count(*) AS count FROM transactions t JOIN payees p ON p.id = t.payee_id ${where}`
          )
          .get(...parameters) as { count: number }
      ).count
    );
    const rows = this.sqlite
      .prepare(
        `SELECT t.*, p.name AS payee_name, c.name AS category_name,
          pm.display_name AS payment_method_name, pm.code AS payment_method_code
         FROM transactions t
         JOIN payees p ON p.id = t.payee_id
         LEFT JOIN categories c ON c.id = t.category_id
         LEFT JOIN payment_methods pm ON pm.id = t.payment_method_id
         ${where}
         ORDER BY t.transaction_date DESC, t.transaction_time DESC, t.id DESC
         LIMIT ? OFFSET ?`
      )
      .all(...parameters, pageSize, (page - 1) * pageSize) as TransactionListRow[];
    return { items: rows.map(mapListTransaction), total: count, page, pageSize };
  }

  getTransactionAudit(transactionId: number) {
    return this.sqlite
      .prepare(
        `SELECT id, action, previous_data AS previousData, new_data AS newData,
         changed_at AS changedAt, change_source AS changeSource
         FROM transaction_audit WHERE transaction_id = ? ORDER BY id DESC`
      )
      .all(transactionId)
      .map((row) => {
        const typed = row as {
          id: number;
          action: string;
          previousData: string | null;
          newData: string;
          changedAt: string;
          changeSource: string;
        };
        return {
          ...typed,
          previousData: typed.previousData ? JSON.parse(typed.previousData) : null,
          newData: JSON.parse(typed.newData)
        };
      });
  }

  getActivity(limit = 100) {
    return this.sqlite
      .prepare(
        `SELECT ta.id, ta.action, ta.changed_at AS changedAt, ta.change_source AS source,
        t.id AS transactionId, t.amount_paise AS amountPaise, p.name AS payeeName
       FROM transaction_audit ta
       JOIN transactions t ON t.id = ta.transaction_id
       JOIN payees p ON p.id = t.payee_id
       ORDER BY ta.id DESC LIMIT ?`
      )
      .all(Math.min(Math.max(limit, 1), 250));
  }

  getSystemStatus() {
    const database = statSync(this.runtime.paths.databasePath);
    const backups = readdirSync(this.runtime.paths.backupDir)
      .filter((name) => name.endsWith('.sqlite3'))
      .map((name) => {
        const path = join(this.runtime.paths.backupDir, name);
        const stats = statSync(path);
        return { name, sizeBytes: stats.size, modifiedAt: stats.mtime.toISOString() };
      })
      .sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt));
    const counts = this.sqlite
      .prepare(
        `SELECT count(*) AS total,
       sum(CASE WHEN status = 'posted' THEN 1 ELSE 0 END) AS posted,
       sum(CASE WHEN status = 'voided' THEN 1 ELSE 0 END) AS voided,
       sum(CASE WHEN status = 'posted' AND needs_review = 1 THEN 1 ELSE 0 END) AS review
       FROM transactions`
      )
      .get() as { total: number; posted: number; voided: number; review: number };
    const payeeCount = Number(
      (
        this.sqlite.prepare('SELECT count(*) AS count FROM payees WHERE active = 1').get() as {
          count: number;
        }
      ).count
    );
    const lastActivity =
      (
        this.sqlite
          .prepare('SELECT changed_at AS changedAt FROM transaction_audit ORDER BY id DESC LIMIT 1')
          .get() as { changedAt: string } | undefined
      )?.changedAt ?? null;
    return {
      databasePath: this.runtime.paths.databasePath,
      databaseSizeBytes: database.size,
      integrity: String(this.sqlite.pragma('quick_check', { simple: true })),
      journalMode: String(this.sqlite.pragma('journal_mode', { simple: true })),
      foreignKeys: Number(this.sqlite.pragma('foreign_keys', { simple: true })) === 1,
      backupCount: backups.length,
      lastBackup: backups[0] ?? null,
      backupsSizeBytes: backups.reduce((sum, backup) => sum + backup.sizeBytes, 0),
      counts,
      payeeCount,
      lastActivity
    };
  }

  getNotificationSettings() {
    const read = (key: string): boolean => {
      try {
        const row = this.sqlite.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as
          | { value: string }
          | undefined;
        if (!row) return true;
        return (JSON.parse(row.value) as unknown) !== false;
      } catch {
        return true;
      }
    };
    return {
      forwardEnabled: read('telegram.forward.enabled'),
      summariesEnabled: read('telegram.summaries.enabled')
    };
  }

  updateNotificationSettings(input: {
    forwardEnabled?: boolean;
    summariesEnabled?: boolean;
  }) {
    const write = (key: string, value: boolean | undefined): void => {
      if (typeof value !== 'boolean') throw new TypeError(`Setting ${key} must be true or false`);
      this.sqlite
        .prepare(
          `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
        )
        .run(key, JSON.stringify(value));
    };
    if ('forwardEnabled' in input) write('telegram.forward.enabled', input.forwardEnabled);
    if ('summariesEnabled' in input) write('telegram.summaries.enabled', input.summariesEnabled);
    return this.getNotificationSettings();
  }

  getTransaction(transactionId: number) {
    const row = this.sqlite
      .prepare(
        `SELECT t.*, p.name AS payee_name, c.name AS category_name,
          pm.display_name AS payment_method_name, pm.code AS payment_method_code
         FROM transactions t
         JOIN payees p ON p.id = t.payee_id
         LEFT JOIN categories c ON c.id = t.category_id
         LEFT JOIN payment_methods pm ON pm.id = t.payment_method_id
         WHERE t.id = ?`
      )
      .get(transactionId) as TransactionListRow | undefined;
    if (!row) throw new TransactionNotFoundError(`Transaction ${transactionId} was not found`);
    return mapListTransaction(row);
  }

  getDashboard(date = businessNow().date) {
    const totals = this.sqlite
      .prepare(
        `SELECT coalesce(sum(t.amount_paise), 0) AS total,
          count(*) AS count,
          coalesce(sum(CASE WHEN pm.code = 'cash' THEN t.amount_paise ELSE 0 END), 0) AS cash,
          coalesce(sum(CASE WHEN pm.code != 'cash' THEN t.amount_paise ELSE 0 END), 0) AS digital,
          sum(CASE WHEN t.needs_review = 1 THEN 1 ELSE 0 END) AS review_count,
          count(DISTINCT t.payee_id) AS unique_payee_count,
          coalesce(max(t.amount_paise), 0) AS largest_payment
         FROM transactions t LEFT JOIN payment_methods pm ON pm.id = t.payment_method_id
         WHERE t.transaction_date = ? AND t.status = 'posted'`
      )
      .get(date) as {
      total: number;
      count: number;
      cash: number;
      digital: number;
      review_count: number;
      unique_payee_count: number;
      largest_payment: number;
    };
    const monthStart = `${date.slice(0, 7)}-01`;
    const monthDate = new Date(`${monthStart}T00:00:00Z`);
    monthDate.setUTCMonth(monthDate.getUTCMonth() - 1);
    const previousMonthStart = monthDate.toISOString().slice(0, 10);
    const monthMetrics = this.sqlite
      .prepare(
        `SELECT
          coalesce(sum(CASE WHEN transaction_date >= ? AND transaction_date <= ? THEN amount_paise ELSE 0 END), 0) AS month_total,
          coalesce(sum(CASE WHEN transaction_date >= ? AND transaction_date < ? THEN amount_paise ELSE 0 END), 0) AS previous_month_total,
          coalesce(round(
            sum(CASE WHEN transaction_date >= ? AND transaction_date <= ? THEN amount_paise ELSE 0 END) * 1.0 /
            nullif(count(DISTINCT CASE WHEN transaction_date >= ? AND transaction_date <= ? THEN transaction_date END), 0)
          ), 0) AS average_active_day
         FROM transactions WHERE status = 'posted'`
      )
      .get(
        monthStart,
        date,
        previousMonthStart,
        monthStart,
        monthStart,
        date,
        monthStart,
        date
      ) as { month_total: number; previous_month_total: number; average_active_day: number };
    const recent = this.listTransactions({ date, pageSize: 12 }).items;
    const frequent = this.sqlite
      .prepare(
        `SELECT p.id, p.name, p.type, p.favourite, count(t.id) AS paymentCount,
          coalesce(sum(t.amount_paise), 0) AS totalPaidPaise
         FROM payees p LEFT JOIN transactions t ON t.payee_id = p.id AND t.status = 'posted'
         WHERE p.active = 1
         GROUP BY p.id ORDER BY p.favourite DESC, paymentCount DESC, p.name LIMIT 12`
      )
      .all();
    return {
      date,
      totalOutgoingPaise: totals.total,
      paymentCount: totals.count,
      cashPaise: totals.cash,
      digitalPaise: totals.digital,
      reviewCount: totals.review_count ?? 0,
      uniquePayeeCount: totals.unique_payee_count ?? 0,
      largestPaymentPaise: totals.largest_payment ?? 0,
      monthTotalPaise: monthMetrics.month_total ?? 0,
      previousMonthTotalPaise: monthMetrics.previous_month_total ?? 0,
      averageActiveDayPaise: monthMetrics.average_active_day ?? 0,
      recent,
      frequent
    };
  }

  getReports(
    from: string,
    to: string,
    options?: {
      reportGroup?: string | undefined;
      categoryId?: number | undefined;
      payeeId?: number | undefined;
      paymentMethodId?: number | undefined;
      needsReview?: boolean | undefined;
    }
  ) {
    const conditions: string[] = ["t.status = 'posted'", 't.transaction_date BETWEEN ? AND ?'];
    const parameters: Array<string | number> = [from, to];

    if (options?.categoryId) {
      conditions.push('t.category_id = ?');
      parameters.push(options.categoryId);
    }
    if (options?.payeeId) {
      conditions.push('t.payee_id = ?');
      parameters.push(options.payeeId);
    }
    if (options?.paymentMethodId) {
      conditions.push('t.payment_method_id = ?');
      parameters.push(options.paymentMethodId);
    }
    if (options?.needsReview) {
      conditions.push('t.needs_review = 1');
    }

    if (options?.reportGroup) {
      const groupMap: Record<string, string[]> = {
        'Business Operating': ['Raw Material', 'Tools', 'Supplies', 'Repairs', 'Wages', 'Outside Work', 'Power & Fuel', 'Transport', 'Packing', 'Factory Expense', 'Office Expense', 'Tax & Fees'],
        'Business Capital': ['Machines'],
        'Advance / Unsettled': ['Advance'],
        'Investment / Asset Transfer': ['Investment'],
        'Personal / House': ['Construction', 'Home Expense']
      };
      const catNames = groupMap[options.reportGroup];
      if (catNames && catNames.length > 0) {
        const placeholders = catNames.map(() => '?').join(', ');
        conditions.push(`c.name IN (${placeholders})`);
        parameters.push(...catNames);
      }
    }

    const whereClause = conditions.join(' AND ');

    const daily = this.sqlite
      .prepare(
        `SELECT t.transaction_date AS label, sum(t.amount_paise) AS totalPaise, count(*) AS paymentCount,
          sum(CASE WHEN pm.code = 'cash' THEN t.amount_paise ELSE 0 END) AS cashPaise,
          sum(CASE WHEN pm.code != 'cash' THEN t.amount_paise ELSE 0 END) AS nonCashPaise,
          sum(CASE WHEN c.name IN ('Raw Material', 'Tools', 'Supplies', 'Repairs', 'Wages', 'Outside Work', 'Power & Fuel', 'Transport', 'Packing', 'Factory Expense', 'Office Expense', 'Tax & Fees') THEN t.amount_paise ELSE 0 END) AS businessOperatingPaise
         FROM transactions t
         LEFT JOIN payment_methods pm ON pm.id = t.payment_method_id
         LEFT JOIN categories c ON c.id = t.category_id
         WHERE ${whereClause}
         GROUP BY t.transaction_date ORDER BY t.transaction_date`
      )
      .all(...parameters);

    const categories = this.sqlite
      .prepare(
        `SELECT c.id AS categoryId, coalesce(c.name, 'Uncategorised') AS label, sum(t.amount_paise) AS totalPaise,
          count(*) AS paymentCount, round(avg(t.amount_paise)) AS averageTransactionPaise,
          count(DISTINCT t.transaction_date) AS activeDays,
          round(sum(t.amount_paise) * 1.0 / count(DISTINCT t.transaction_date)) AS averageActiveDayPaise
         FROM transactions t
         LEFT JOIN categories c ON c.id = t.category_id
         WHERE ${whereClause}
         GROUP BY t.category_id ORDER BY totalPaise DESC`
      )
      .all(...parameters);

    const methods = this.sqlite
      .prepare(
        `SELECT coalesce(pm.display_name, 'Needs review') AS label, pm.code,
          sum(t.amount_paise) AS totalPaise, count(*) AS paymentCount,
          round(avg(t.amount_paise)) AS averageTransactionPaise
         FROM transactions t
         LEFT JOIN payment_methods pm ON pm.id = t.payment_method_id
         LEFT JOIN categories c ON c.id = t.category_id
         WHERE ${whereClause}
         GROUP BY t.payment_method_id ORDER BY totalPaise DESC`
      )
      .all(...parameters);

    const payees = this.sqlite
      .prepare(
        `SELECT p.id, p.name AS label, p.type, sum(t.amount_paise) AS totalPaise, count(*) AS paymentCount
         FROM transactions t
         JOIN payees p ON p.id = t.payee_id
         LEFT JOIN categories c ON c.id = t.category_id
         WHERE ${whereClause}
         GROUP BY p.id ORDER BY totalPaise DESC LIMIT 50`
      )
      .all(...parameters);

    const largest = this.sqlite
      .prepare(
        `SELECT t.id, t.transaction_date AS transactionDate, p.name AS payeeName,
          t.amount_paise AS amountPaise, t.note
         FROM transactions t
         JOIN payees p ON p.id = t.payee_id
         LEFT JOIN categories c ON c.id = t.category_id
         WHERE ${whereClause}
         ORDER BY t.amount_paise DESC LIMIT 20`
      )
      .all(...parameters);

    const repeated = this.sqlite
      .prepare(
        `SELECT p.name AS payeeName, t.amount_paise AS amountPaise, count(*) AS occurrences
         FROM transactions t
         JOIN payees p ON p.id = t.payee_id
         LEFT JOIN categories c ON c.id = t.category_id
         WHERE ${whereClause}
         GROUP BY t.payee_id, t.amount_paise HAVING count(*) > 1
         ORDER BY occurrences DESC, amountPaise DESC LIMIT 20`
      )
      .all(...parameters);

    const unusual = this.sqlite
      .prepare(
        `SELECT t.id, t.transaction_date AS transactionDate, p.name AS payeeName,
          t.amount_paise AS amountPaise, round(avg_for_payee.average) AS averagePaise
         FROM transactions t
         JOIN payees p ON p.id = t.payee_id
         LEFT JOIN categories c ON c.id = t.category_id
         JOIN (
           SELECT payee_id, avg(amount_paise) AS average FROM transactions WHERE status = 'posted' GROUP BY payee_id
         ) avg_for_payee ON avg_for_payee.payee_id = t.payee_id
         WHERE ${whereClause}
           AND t.amount_paise >= 5000000 AND t.amount_paise >= avg_for_payee.average * 2
         ORDER BY t.amount_paise DESC LIMIT 20`
      )
      .all(...parameters);

    const totalsRaw = this.sqlite
      .prepare(
        `SELECT coalesce(sum(t.amount_paise), 0) AS totalPaise,
          coalesce(sum(CASE WHEN c.name IN ('Raw Material', 'Tools', 'Supplies', 'Repairs', 'Wages', 'Outside Work', 'Power & Fuel', 'Transport', 'Packing', 'Factory Expense', 'Office Expense', 'Tax & Fees') THEN t.amount_paise ELSE 0 END), 0) AS businessOperatingPaise,
          coalesce(sum(CASE WHEN c.name = 'Raw Material' THEN t.amount_paise ELSE 0 END), 0) AS rawMaterialPaise,
          count(*) AS paymentCount,
          count(DISTINCT t.payee_id) AS payeeCount,
          count(DISTINCT t.transaction_date) AS activeDayCount,
          coalesce(round(avg(t.amount_paise)), 0) AS averageTransactionPaise,
          coalesce(sum(CASE WHEN t.needs_review = 1 THEN 1 ELSE 0 END), 0) AS needsReviewCount
         FROM transactions t
         LEFT JOIN categories c ON c.id = t.category_id
         WHERE ${whereClause}`
      )
      .get(...parameters) as {
      totalPaise: number;
      businessOperatingPaise: number;
      rawMaterialPaise: number;
      paymentCount: number;
      payeeCount: number;
      activeDayCount: number;
      averageTransactionPaise: number;
      needsReviewCount: number;
    };

    const outflowGroupRows = this.sqlite
      .prepare(
        `SELECT
          CASE
            WHEN c.name IN ('Raw Material', 'Tools', 'Supplies', 'Repairs', 'Wages', 'Outside Work', 'Power & Fuel', 'Transport', 'Packing', 'Factory Expense', 'Office Expense', 'Tax & Fees') THEN 'Business Operating'
            WHEN c.name = 'Machines' THEN 'Business Capital'
            WHEN c.name = 'Advance' THEN 'Advance / Unsettled'
            WHEN c.name = 'Investment' THEN 'Investment / Asset Transfer'
            WHEN c.name IN ('Construction', 'Home Expense') THEN 'Personal / House'
            ELSE 'Other'
          END AS groupName,
          sum(t.amount_paise) AS amountPaise,
          count(*) AS transactionCount
         FROM transactions t
         LEFT JOIN categories c ON c.id = t.category_id
         WHERE ${whereClause}
         GROUP BY groupName
         ORDER BY amountPaise DESC`
      )
      .all(...parameters) as Array<{ groupName: string; amountPaise: number; transactionCount: number }>;

    const totalOutflow = totalsRaw.totalPaise || 1;
    const outflowGroups = outflowGroupRows.map((row) => ({
      ...row,
      percentage: Number(((row.amountPaise / totalOutflow) * 100).toFixed(1))
    }));

    return {
      from,
      to,
      totals: totalsRaw,
      outflowGroups,
      daily,
      categories,
      methods,
      payees,
      largest,
      repeated,
      unusual
    };
  }

  exportTransactionsCsv(options: ListTransactionOptions): string {
    return transactionsToCsv(this.collectTransactionsForExport(options));
  }

  collectTransactionsForExport(options: ListTransactionOptions): ExportTransaction[] {
    const { where, parameters } = this.transactionFilter(options);
    const rows = this.sqlite
      .prepare(
        `SELECT t.*, p.name AS payee_name, c.name AS category_name,
          pm.display_name AS payment_method_name, pm.code AS payment_method_code
         FROM transactions t
         JOIN payees p ON p.id = t.payee_id
         LEFT JOIN categories c ON c.id = t.category_id
         LEFT JOIN payment_methods pm ON pm.id = t.payment_method_id
         ${where}
         ORDER BY t.transaction_date DESC, t.transaction_time DESC, t.id DESC`
      )
      .all(...parameters) as TransactionListRow[];
    return rows.map(mapExportTransaction);
  }

  async createBackup() {
    const stamp = new Date().toISOString().replaceAll(':', '').replaceAll('.', '');
    const destination = join(this.runtime.paths.backupDir, `manual-${stamp}.sqlite3`);
    await this.runtime.sqlite.backup(destination);
    const integrity = verifyDatabaseIntegrity(destination);
    if (integrity !== 'ok') throw new Error(`Backup integrity check failed: ${integrity}`);
    return { filename: destination.split(/[\\/]/).at(-1), integrity };
  }
}
