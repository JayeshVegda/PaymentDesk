import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import {
  TransactionConflictError,
  TransactionNotFoundError,
  type TransactionRecord,
  type TransactionRepository
} from '@payment-ledger/core';
import type {
  ChangeSource,
  CorrectTransactionInput,
  CreateTransactionInput
} from '@payment-ledger/shared';
import { Kysely, SqliteDialect, sql, type Generated, type Selectable } from 'kysely';

interface TransactionTable {
  id: Generated<number>;
  transaction_date: string;
  transaction_time: string;
  payee_id: number;
  amount_paise: number;
  category_id: number | null;
  payment_method_id: number | null;
  note: string | null;
  source: ChangeSource;
  status: 'posted' | 'voided';
  needs_review: number;
  silent: number;
  created_at: Generated<string>;
  updated_at: Generated<string>;
  version: Generated<number>;
}

interface TransactionAuditTable {
  id: Generated<number>;
  transaction_id: number;
  action: 'created' | 'corrected' | 'voided' | 'restored';
  previous_data: string | null;
  new_data: string;
  changed_at: Generated<string>;
  change_source: ChangeSource;
}

export interface LedgerDatabase {
  transactions: TransactionTable;
  transaction_audit: TransactionAuditTable;
}

export interface RuntimePaths {
  rootDir: string;
  dataDir: string;
  backupDir: string;
  databasePath: string;
}

export interface DatabaseRuntime {
  sqlite: Database.Database;
  db: Kysely<LedgerDatabase>;
  paths: RuntimePaths;
  close(): Promise<void>;
}

export function resolveRuntimePaths(environment: NodeJS.ProcessEnv = process.env): RuntimePaths {
  const configuredRoot = environment.PAYMENT_LEDGER_DATA_DIR?.trim();
  const defaultRoot =
    process.platform === 'win32' && environment.LOCALAPPDATA
      ? join(environment.LOCALAPPDATA, 'PaymentLedger')
      : resolve(process.cwd());
  const rootDir = resolve(configuredRoot || defaultRoot);
  const dataDir = join(rootDir, 'data');
  const backupDir = join(rootDir, 'backups');
  return { rootDir, dataDir, backupDir, databasePath: join(dataDir, 'ledger.sqlite3') };
}

export function configureSqlite(sqlite: Database.Database): void {
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('busy_timeout = 5000');
  sqlite.pragma('wal_autocheckpoint = 1000');
  sqlite.pragma('journal_size_limit = 67108864');
}

export function verifyDatabaseIntegrity(databasePath: string): string {
  const verification = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    return String(verification.pragma('integrity_check', { simple: true }));
  } finally {
    verification.close();
  }
}

export function openDatabase(
  options: { databasePath?: string; migrate?: boolean } = {}
): DatabaseRuntime {
  const paths = resolveRuntimePaths();
  const databasePath = options.databasePath ? resolve(options.databasePath) : paths.databasePath;
  mkdirSync(dirname(databasePath), { recursive: true });
  mkdirSync(paths.backupDir, { recursive: true });
  const sqlite = new Database(databasePath);
  configureSqlite(sqlite);
  if (options.migrate !== false) migrateDatabase(sqlite);
  const db = new Kysely<LedgerDatabase>({ dialect: new SqliteDialect({ database: sqlite }) });
  return {
    sqlite,
    db,
    paths: { ...paths, databasePath },
    async close() {
      await db.destroy();
      if (sqlite.open) sqlite.close();
    }
  };
}

export function migrationsDirectory(): string {
  return fileURLToPath(new URL('../../../migrations', import.meta.url));
}

export function migrateDatabase(
  sqlite: Database.Database,
  directory = migrationsDirectory()
): string[] {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ) STRICT, WITHOUT ROWID;
  `);
  const applied = new Map(
    sqlite
      .prepare('SELECT name, checksum FROM schema_migrations ORDER BY name')
      .all()
      .map((row) => {
        const typed = row as { name: string; checksum: string };
        return [typed.name, typed.checksum] as const;
      })
  );
  const names = readdirSync(directory)
    .filter((name) => /^\d{3}_[a-z0-9_]+\.sql$/.test(name))
    .sort();
  const newlyApplied: string[] = [];

  for (const name of names) {
    const migrationSql = readFileSync(join(directory, name), 'utf8');
    const checksum = createHash('sha256').update(migrationSql).digest('hex');
    const previousChecksum = applied.get(name);
    if (previousChecksum) {
      if (previousChecksum !== checksum)
        throw new Error(`Applied migration checksum changed: ${name}`);
      continue;
    }
    sqlite.exec('BEGIN IMMEDIATE');
    try {
      sqlite.exec(migrationSql);
      sqlite
        .prepare('INSERT INTO schema_migrations (name, checksum) VALUES (?, ?)')
        .run(name, checksum);
      sqlite.exec('COMMIT');
      newlyApplied.push(name);
    } catch (error) {
      sqlite.exec('ROLLBACK');
      throw error;
    }
  }
  return newlyApplied;
}

function mapTransaction(row: Selectable<TransactionTable>): TransactionRecord {
  return {
    id: Number(row.id),
    transactionDate: row.transaction_date,
    transactionTime: row.transaction_time,
    payeeId: row.payee_id,
    amountPaise: row.amount_paise,
    categoryId: row.category_id,
    paymentMethodId: row.payment_method_id,
    note: row.note,
    source: row.source,
    status: row.status,
    needsReview: row.needs_review === 1,
    silent: row.silent === 1,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    version: Number(row.version)
  };
}

export class SqliteTransactionRepository implements TransactionRepository {
  constructor(private readonly db: Kysely<LedgerDatabase>) {}

  async create(input: CreateTransactionInput): Promise<TransactionRecord> {
    return this.db.transaction().execute(async (transaction) => {
      const row = await transaction
        .insertInto('transactions')
        .values({
          transaction_date: input.transactionDate,
          transaction_time: input.transactionTime,
          payee_id: input.payeeId,
          amount_paise: input.amountPaise,
          category_id: input.categoryId,
          payment_method_id: input.paymentMethodId,
          note: input.note,
          source: input.source,
          status: 'posted',
          needs_review: input.needsReview ? 1 : 0,
          silent: input.silent ? 1 : 0
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      const mapped = mapTransaction(row);
      await transaction
        .insertInto('transaction_audit')
        .values({
          transaction_id: mapped.id,
          action: 'created',
          previous_data: null,
          new_data: JSON.stringify(mapped),
          change_source: input.source
        })
        .execute();
      return mapped;
    });
  }

  async correct(id: number, input: CorrectTransactionInput): Promise<TransactionRecord> {
    return this.db.transaction().execute(async (transaction) => {
      const currentRow = await transaction
        .selectFrom('transactions')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      if (!currentRow) throw new TransactionNotFoundError(`Transaction ${id} was not found`);
      const current = mapTransaction(currentRow);
      if (current.updatedAt !== input.expectedUpdatedAt) {
        throw new TransactionConflictError(`Transaction ${id} changed after it was loaded`);
      }
      if (current.status === 'voided')
        throw new TransactionConflictError('A voided transaction cannot be corrected');

      const categoryId = input.categoryId === undefined ? current.categoryId : input.categoryId;
      const paymentMethodId =
        input.paymentMethodId === undefined ? current.paymentMethodId : input.paymentMethodId;
      const needsReview = input.needsReview ?? current.needsReview;
      if (!needsReview && (categoryId === null || paymentMethodId === null)) {
        throw new TypeError('Missing category or payment method requires review');
      }
      const now = Date.now();
      const previous = Date.parse(current.updatedAt);
      const updatedAt = new Date(Number.isFinite(previous) && now <= previous ? previous + 1 : now).toISOString();
      const row = await transaction
        .updateTable('transactions')
        .set({
          transaction_date: input.transactionDate ?? current.transactionDate,
          transaction_time: input.transactionTime ?? current.transactionTime,
          amount_paise: input.amountPaise ?? current.amountPaise,
          category_id: categoryId,
          payment_method_id: paymentMethodId,
          note: input.note === undefined ? current.note : input.note,
          needs_review: needsReview ? 1 : 0,
          updated_at: updatedAt,
          version: sql<number>`version + 1`
        })
        .where('id', '=', id)
        .where('updated_at', '=', input.expectedUpdatedAt)
        .returningAll()
        .executeTakeFirst();
      if (!row) throw new TransactionConflictError(`Transaction ${id} changed during correction`);
      const mapped = mapTransaction(row);
      await transaction
        .insertInto('transaction_audit')
        .values({
          transaction_id: id,
          action: 'corrected',
          previous_data: JSON.stringify(current),
          new_data: JSON.stringify(mapped),
          change_source: input.source
        })
        .execute();
      return mapped;
    });
  }

  async void(id: number, reason: string, source: ChangeSource): Promise<TransactionRecord> {
    return this.db.transaction().execute(async (transaction) => {
      const currentRow = await transaction
        .selectFrom('transactions')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      if (!currentRow) throw new TransactionNotFoundError(`Transaction ${id} was not found`);
      const current = mapTransaction(currentRow);
      if (current.status === 'voided')
        throw new TransactionConflictError('Transaction is already voided');
      const row = await transaction
        .updateTable('transactions')
        .set({
          status: 'voided',
          updated_at: new Date(Math.max(Date.now(), Date.parse(current.updatedAt) + 1)).toISOString(),
          version: sql<number>`version + 1`
        })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
      const mapped = mapTransaction(row);
      await transaction
        .insertInto('transaction_audit')
        .values({
          transaction_id: id,
          action: 'voided',
          previous_data: JSON.stringify(current),
          new_data: JSON.stringify({ transaction: mapped, reason }),
          change_source: source
        })
        .execute();
      return mapped;
    });
  }

  async findById(id: number): Promise<TransactionRecord | null> {
    const row = await this.db
      .selectFrom('transactions')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? mapTransaction(row) : null;
  }

  async unvoid(id: number, source: ChangeSource): Promise<TransactionRecord> {
    return this.db.transaction().execute(async (transaction) => {
      const currentRow = await transaction
        .selectFrom('transactions')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      if (!currentRow) throw new TransactionNotFoundError(`Transaction ${id} was not found`);
      const current = mapTransaction(currentRow);
      if (current.status !== 'voided')
        throw new TransactionConflictError('Only a voided transaction can be restored');
      const row = await transaction
        .updateTable('transactions')
        .set({
          status: 'posted',
          updated_at: new Date(Math.max(Date.now(), Date.parse(current.updatedAt) + 1)).toISOString(),
          version: sql<number>`version + 1`
        })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
      const mapped = mapTransaction(row);
      await transaction
        .insertInto('transaction_audit')
        .values({
          transaction_id: id,
          action: 'restored',
          previous_data: JSON.stringify(current),
          new_data: JSON.stringify(mapped),
          change_source: source
        })
        .execute();
      return mapped;
    });
  }
}

export async function databaseHealth(db: Kysely<LedgerDatabase>): Promise<'ok'> {
  await sql`select 1`.execute(db);
  return 'ok';
}

export { LedgerService, businessNow } from './ledger.js';
export type { CreatePayeeInput, ListTransactionOptions, ExportTransaction } from './ledger.js';
