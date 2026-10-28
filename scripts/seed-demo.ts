import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { openDatabase } from '../packages/database/dist/index.js';

// Safety: never seed the real database. Force an isolated sandbox directory
// unless PAYMENT_LEDGER_DATA_DIR already points somewhere custom.
const productionRoot = join(process.env.LOCALAPPDATA ?? '', 'PaymentLedger');
const configured = process.env.PAYMENT_LEDGER_DATA_DIR?.trim();
let sandboxDir: string | null = null;
if (!configured || resolve(configured) === resolve(productionRoot)) {
  sandboxDir = mkdtempSync(join(tmpdir(), 'payment-ledger-seed-'));
  process.env.PAYMENT_LEDGER_DATA_DIR = sandboxDir;
}

const runtime = openDatabase({ migrate: true });
const db = runtime.sqlite;
const marker = 'demo_seed_2026_h1';

type DemoPayee = {
  name: string;
  type: 'person' | 'company';
  category: string;
  method: string;
  favourite?: boolean;
  aliases?: string[];
  notes: string[];
  minimumRupees: number;
  maximumRupees: number;
};

const payees: DemoPayee[] = [
  {
    name: 'Ramesh Kumar',
    type: 'person',
    category: 'Wages',
    method: 'cash',
    favourite: true,
    aliases: ['ramesh'],
    notes: ['daily wages', 'overtime', 'site work'],
    minimumRupees: 650,
    maximumRupees: 1800
  },
  {
    name: 'Mahesh Transport',
    type: 'company',
    category: 'Transport',
    method: 'bank',
    favourite: true,
    aliases: ['mahesh', 'mahesh truck'],
    notes: ['material delivery', 'truck hire', 'diesel advance'],
    minimumRupees: 2500,
    maximumRupees: 18000
  },
  {
    name: 'ABC Tools',
    type: 'company',
    category: 'Tools',
    method: 'bank',
    favourite: true,
    aliases: ['abc'],
    notes: ['drill bits', 'cutting discs', 'hand tools'],
    minimumRupees: 1200,
    maximumRupees: 24000
  },
  {
    name: 'Suresh Yadav',
    type: 'person',
    category: 'Wages',
    method: 'cash',
    aliases: ['suresh'],
    notes: ['daily wages', 'loading work', 'overtime'],
    minimumRupees: 650,
    maximumRupees: 1600
  },
  {
    name: 'Imran Sheikh',
    type: 'person',
    category: 'Wages',
    method: 'upi',
    aliases: ['imran'],
    notes: ['fabrication work', 'daily wages', 'site work'],
    minimumRupees: 700,
    maximumRupees: 2200
  },
  {
    name: 'Shree Ganesh Suppliers',
    type: 'company',
    category: 'Raw Material',
    method: 'bank',
    aliases: ['ganesh supplier'],
    notes: ['monthly supplies', 'consumables', 'hardware stock'],
    minimumRupees: 4500,
    maximumRupees: 42000
  },
  {
    name: 'Patel Steel Traders',
    type: 'company',
    category: 'Raw Material',
    method: 'cheque',
    favourite: true,
    aliases: ['patel steel'],
    notes: ['steel sections', 'sheet material', 'material balance'],
    minimumRupees: 12000,
    maximumRupees: 85000
  },
  {
    name: 'Vijay Courier Service',
    type: 'company',
    category: 'Transport',
    method: 'upi',
    aliases: ['vijay courier'],
    notes: ['parcel dispatch', 'urgent documents', 'spare delivery'],
    minimumRupees: 180,
    maximumRupees: 1800
  },
  {
    name: 'Vijay Patel',
    type: 'person',
    category: 'Outside Work',
    method: 'upi',
    favourite: true,
    aliases: ['vijaybhai', 'vijay p'],
    notes: ['fabrication contract', 'site advance', 'labour settlement'],
    minimumRupees: 1500,
    maximumRupees: 18000
  },
  {
    name: 'Vinay Shah',
    type: 'person',
    category: 'Office Expense',
    method: 'upi',
    aliases: ['vinay', 'v shah'],
    notes: ['office purchase', 'reimbursement', 'printing expense'],
    minimumRupees: 300,
    maximumRupees: 6500
  },
  {
    name: 'Lakshmi Electricals',
    type: 'company',
    category: 'Raw Material',
    method: 'upi',
    aliases: ['lakshmi electric'],
    notes: ['cables and sockets', 'electrical parts', 'site consumables'],
    minimumRupees: 800,
    maximumRupees: 16000
  },
  {
    name: 'Anil Verma',
    type: 'person',
    category: 'Wages',
    method: 'cash',
    aliases: ['anil'],
    notes: ['helper wages', 'site work', 'loading work'],
    minimumRupees: 550,
    maximumRupees: 1300
  },
  {
    name: 'City Crane Services',
    type: 'company',
    category: 'Transport',
    method: 'bank',
    aliases: ['city crane'],
    notes: ['crane hire', 'lifting charge', 'equipment transport'],
    minimumRupees: 6500,
    maximumRupees: 38000
  },
  {
    name: 'Om Hardware Mart',
    type: 'company',
    category: 'Tools',
    method: 'cash',
    aliases: ['om hardware'],
    notes: ['fasteners', 'replacement tools', 'workshop supplies'],
    minimumRupees: 500,
    maximumRupees: 9500
  }
];

let state = 0x5eed2026;
function random(): number {
  state = (state * 1664525 + 1013904223) >>> 0;
  return state / 0x100000000;
}
function pick<T>(values: T[]): T {
  return values[Math.floor(random() * values.length)]!;
}
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
function timestamp(date: string, time: string): string {
  return `${date}T${time}.000Z`;
}

try {
  // Allow seeding always for demo data generation

  const categoryRows = db.prepare('SELECT id, name FROM categories').all() as Array<{
    id: number;
    name: string;
  }>;
  const methodRows = db.prepare('SELECT id, code FROM payment_methods').all() as Array<{
    id: number;
    code: string;
  }>;
  const categoryIds = new Map(categoryRows.map((row) => [row.name, row.id]));
  const methodIds = new Map(methodRows.map((row) => [row.code, row.id]));

  const seed = db.transaction(() => {
    const insertPayee = db.prepare(`INSERT INTO payees
      (type, name, normalized_name, default_category_id, default_payment_method_id, active, notes, favourite)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)`);
    const insertAlias = db.prepare(
      'INSERT INTO payee_aliases (payee_id, alias, normalized_alias) VALUES (?, ?, ?)'
    );
    const payeeIds = new Map<string, number>();

    for (const payee of payees) {
      const result = insertPayee.run(
        payee.type,
        payee.name,
        payee.name.toLocaleLowerCase('en-IN'),
        categoryIds.get(payee.category),
        methodIds.get(payee.method),
        `[DEMO] Synthetic payee for local testing`,
        payee.favourite ? 1 : 0
      );
      const id = Number(result.lastInsertRowid);
      payeeIds.set(payee.name, id);
      for (const alias of payee.aliases ?? [])
        insertAlias.run(id, alias, alias.toLocaleLowerCase('en-IN'));
    }

    const insertTransaction = db.prepare(`INSERT INTO transactions
      (transaction_date, transaction_time, payee_id, amount_paise, category_id, payment_method_id,
       note, source, status, needs_review, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'import', 'posted', ?, ?, ?)`);
    const insertAudit = db.prepare(`INSERT INTO transaction_audit
      (transaction_id, action, previous_data, new_data, changed_at, change_source)
      VALUES (?, 'created', NULL, ?, ?, 'import')`);
    let transactionCount = 0;
    let reviewCount = 0;
    let totalPaise = 0;
    const start = new Date('2026-02-01T00:00:00Z');
    const end = new Date('2026-08-02T00:00:00Z');

    for (let day = new Date(start); day <= end; day.setUTCDate(day.getUTCDate() + 1)) {
      const date = isoDate(day);
      const weekday = day.getUTCDay();
      const isToday = date === '2026-08-02';
      const baseCount = isToday ? 5 : weekday === 0 ? 0 : weekday === 6 ? 2 : 3;
      const count = isToday ? 5 : baseCount + Math.floor(random() * 4);
      for (let index = 0; index < count; index += 1) {
        const payee = pick(payees);
        const wholeRupees =
          Math.round(
            (payee.minimumRupees + random() * (payee.maximumRupees - payee.minimumRupees)) / 10
          ) * 10;
        const amountPaise = wholeRupees * 100;
        const hour = 8 + Math.floor(random() * 11);
        const minute = Math.floor(random() * 60);
        const second = Math.floor(random() * 60);
        const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
        const needsReview = random() < 0.025 ? 1 : 0;
        const createdAt = timestamp(date, time);
        const note = `[DEMO] ${pick(payee.notes)}`;
        const methodId = methodIds.get(payee.method)!;
        const result = insertTransaction.run(
          date,
          time,
          payeeIds.get(payee.name),
          amountPaise,
          categoryIds.get(payee.category),
          methodId,
          note,
          needsReview,
          createdAt,
          createdAt
        );
        const id = Number(result.lastInsertRowid);
        insertAudit.run(
          id,
          JSON.stringify({
            id,
            transaction_date: date,
            transaction_time: time,
            payee: payee.name,
            amount_paise: amountPaise,
            category: payee.category,
            payment_method: payee.method,
            note,
            source: 'import',
            status: 'posted',
            needs_review: needsReview
          }),
          createdAt
        );
        transactionCount += 1;
        reviewCount += needsReview;
        totalPaise += amountPaise;
      }
    }

    db.prepare(`INSERT INTO app_settings (key, value) VALUES (?, json(?))`).run(
      marker,
      JSON.stringify({
        synthetic: true,
        range: ['2026-02-01', '2026-08-01'],
        created_at: new Date().toISOString()
      })
    );
    return {
      payees: payees.length,
      transactions: transactionCount,
      reviews: reviewCount,
      total_paise: totalPaise
    };
  });

  const result = seed();
  process.stdout.write(
    `${JSON.stringify({ status: 'ok', marker, sandbox: runtime.paths.dataDir, ...result })}\n`
  );
} finally {
  await runtime.close();
  if (sandboxDir) rmSync(sandboxDir, { recursive: true, force: true, maxRetries: 5 });
}
